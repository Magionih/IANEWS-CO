import { createFileRoute } from "@tanstack/react-router";

import { cronUnauthorized, readJson } from "@/lib/cron-auth.server";

/* Carrossel automático das matérias de notícia: para cada matéria agendada (próximas 48 h) com capa,
   a IA monta as telas e a legenda a partir do próprio texto; as telas viram PNG 1080x1350 e ficam
   prontas no CRM (Produções → Notícias). Com a chave instagram_api_publicar ligada, o post sai pela API
   quando a matéria entrar no ar. */

async function handle(request: Request) {
  const denied = await cronUnauthorized(request);
  if (denied) return denied;
  try {
    const body = await readJson<{ limite: number }>(request);
    const limite = Math.min(Math.max(Number(body.limite ?? 3) || 3, 1), 10);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const db = supabaseAdmin as any;
    const { redigirCarrosselNoticia } = await import("@/lib/automacao/ia.server");
    const { renderTelaPng, fotoPublicaJpeg } = await import("@/lib/automacao/telas.server");

    const { data: pendentes, error } = await db.rpc("auto_carrosseis_pendentes", {
      p_limite: limite,
    });
    if (error) throw new Error(error.message);
    type Art = {
      article_id: string;
      slug: string;
      title: string;
      dek: string | null;
      body_markdown: string | null;
      cover_image_url: string;
      tags: string[] | null;
      sources: unknown;
    };
    const resultado: unknown[] = [];
    for (const a of (pendentes ?? []) as Art[]) {
      try {
        const c = await redigirCarrosselNoticia(a);
        // Capa em JPEG (as capas do site podem ser AVIF/WebP, que o renderizador não lê)
        const foto = await fotoPublicaJpeg(
          db,
          a.cover_image_url,
          `noticias/${a.article_id}/capa.jpg`,
        );
        if (!c) return Response.json({ ok: false, error: "IA não configurada." }, { status: 500 });
        // Collab: empresas e pessoas protagonistas da matéria com Instagram no CRM
        const { data: menc } = await db
          .from("crm_mencoes")
          .select("papel, empresa:crm_empresas(instagram), pessoa:crm_pessoas(instagram)")
          .eq("article_id", a.article_id)
          .eq("ativo", true)
          .limit(10);
        const collabs = Array.from(
          new Set(
            (
              (menc ?? []) as {
                papel: string;
                empresa: { instagram: string | null } | null;
                pessoa: { instagram: string | null } | null;
              }[]
            )
              .filter((m) => m.papel === "protagonista")
              .flatMap((m) => [m.pessoa?.instagram, m.empresa?.instagram])
              .map((h) =>
                (h ?? "")
                  .replace(/^https?:\/\/(www\.)?instagram\.com\//i, "")
                  .replace(/^@/, "")
                  .replace(/[/?#].*$/, "")
                  .toLowerCase(),
              )
              .filter((h) => /^[a-z0-9._]{2,30}$/.test(h)),
          ),
        ).slice(0, 3);

        const telas = [
          {
            tipo: "capa" as const,
            kicker: "IA News",
            titulo: c.capa.titulo,
            destaque: c.capa.destaque,
            subtitulo: c.capa.subtitulo,
            foto,
            credito: null,
          },
          {
            tipo: "texto" as const,
            eyebrow: c.texto.eyebrow || "O que aconteceu",
            titulo: c.texto.titulo,
            paragrafos: c.texto.paragrafos,
            foto,
          },
          ...(c.numeros.length
            ? [
                {
                  tipo: "numeros" as const,
                  eyebrow: "Em números",
                  titulo: c.texto.titulo,
                  numeros: c.numeros,
                },
              ]
            : []),
          ...(c.frase
            ? [
                {
                  tipo: "frase" as const,
                  frase: c.frase.frase,
                  quem: c.frase.quem,
                  cargo: c.frase.cargo || null,
                  foto,
                },
              ]
            : []),
          { tipo: "final" as const, titulo: c.final.titulo, texto: c.final.texto, collabs },
        ];
        const urls: string[] = [];
        for (const [i, t] of telas.entries()) {
          const png = await renderTelaPng(t);
          const dest = `noticias/${a.article_id}/tela-${i + 1}.png`;
          const { error: e3 } = await db.storage
            .from("producoes")
            .upload(dest, png, { contentType: "image/png", upsert: true });
          if (e3) throw new Error(`Tela ${i + 1}: ${e3.message}`);
          urls.push(db.storage.from("producoes").getPublicUrl(dest).data.publicUrl);
        }
        const { error: e4 } = await db.rpc("auto_carrossel_salvar", {
          p_article: a.article_id,
          p_telas: urls,
          p_legenda: c.legenda,
          p_collabs: collabs,
          p_erro: null,
        });
        if (e4) throw new Error(e4.message);
        resultado.push({ slug: a.slug, telas: urls.length, collabs });
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        await db.rpc("auto_carrossel_salvar", {
          p_article: a.article_id,
          p_telas: [],
          p_legenda: null,
          p_collabs: [],
          p_erro: msg.slice(0, 300),
        });
        resultado.push({ slug: a.slug, erro: msg });
      }
    }
    return Response.json({ ok: true, carrosseis: resultado.length, resultado });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[carrossel-noticias] falhou", message);
    return Response.json({ ok: false, error: message }, { status: 500 });
  }
}

export const Route = createFileRoute("/api/public/hooks/carrossel-noticias")({
  server: {
    handlers: { GET: ({ request }) => handle(request), POST: ({ request }) => handle(request) },
  },
});
