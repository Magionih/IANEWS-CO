import { createFileRoute } from "@tanstack/react-router";

import { cronUnauthorized, readJson } from "@/lib/cron-auth.server";

/** Upload com uma repetição: o storage às vezes falha sem mensagem. */
async function subir(db: any, dest: string, png: Buffer): Promise<void> {
  for (let tentativa = 0; tentativa < 3; tentativa++) {
    const { error } = await db.storage
      .from("producoes")
      .upload(dest, png, { contentType: "image/png", upsert: true });
    if (!error) return;
    if (tentativa === 2) throw new Error(error.message || "falha no envio da imagem");
    await new Promise((r) => setTimeout(r, 1500));
  }
}

/* Esteira de produção do destaque: para cada briefing enviado (ou com ajuste pedido), a IA escreve a
   matéria, a legenda e as telas; as fotos do briefing viram capa e imagens públicas; as telas viram PNG;
   o banco grava a prévia e avisa o lead. Depois, envia pelo WhatsApp os avisos automáticos pendentes. */

const SITE = process.env.NEWSLETTER_SITE_URL?.trim() || "https://ianewsbr.com";

async function copiarFotos(db: any, producaoId: string, paths: string[]): Promise<string[]> {
  const urls: string[] = [];
  for (const [i, path] of paths.slice(0, 5).entries()) {
    try {
      const { data, error } = await db.storage.from("briefings").download(path);
      if (error || !data) continue;
      const { default: sharp } = await import("sharp");
      const jpg = await sharp(Buffer.from(await data.arrayBuffer()))
        .rotate()
        .resize({ width: 1600, height: 1600, fit: "inside", withoutEnlargement: true })
        .jpeg({ quality: 86 })
        .toBuffer();
      const dest = `${producaoId}/foto-${i + 1}.jpg`;
      const { error: e2 } = await db.storage
        .from("producoes")
        .upload(dest, jpg, { contentType: "image/jpeg", upsert: true });
      if (e2) continue;
      urls.push(db.storage.from("producoes").getPublicUrl(dest).data.publicUrl);
    } catch {
      /* foto com problema não derruba a produção */
    }
  }
  return urls;
}

async function handle(request: Request) {
  const denied = await cronUnauthorized(request);
  if (denied) return denied;
  try {
    const body = await readJson<{ limite: number }>(request);
    const limite = Math.min(Math.max(Number(body.limite ?? 2) || 2, 1), 5);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const db = supabaseAdmin as any;
    const { redigirDestaque } = await import("@/lib/automacao/ia.server");
    const { renderTelaPng } = await import("@/lib/automacao/telas.server");
    const { enviarWhatsApp, whatsappConfigurado } = await import("@/lib/automacao/meta.server");

    const { data: pendentes, error } = await db.rpc("auto_producoes_pendentes", {
      p_limite: limite,
    });
    if (error) throw new Error(error.message);
    type Pendente = {
      briefing_id: string;
      token: string;
      tipo: "pago" | "cortesia";
      dados: Record<string, unknown>;
      fotos: string[] | null;
      ajuste: string | null;
      empresa: string | null;
      pessoa: string | null;
      producao_id: string | null;
      conteudo_anterior: Record<string, unknown> | null;
      versao: number;
    };
    const resultado: unknown[] = [];
    for (const p of (pendentes ?? []) as Pendente[]) {
      const { data: producaoId, error: e1 } = await db.rpc("auto_producao_iniciar", {
        p_briefing: p.briefing_id,
      });
      if (e1) throw new Error(e1.message);
      try {
        const conteudo = await redigirDestaque({
          dados: p.dados ?? {},
          empresa: p.empresa,
          pessoa: p.pessoa,
          tipo: p.tipo,
          ajuste: p.ajuste,
          anterior: (p.conteudo_anterior as never) ?? null,
        });
        if (!conteudo)
          return Response.json(
            { ok: false, error: "AI_API_KEY não configurada." },
            { status: 500 },
          );

        const fotos = await copiarFotos(db, producaoId, p.fotos ?? []);
        const foto = fotos[0] ?? null;
        const nome = String(p.dados?.nome ?? p.pessoa ?? "");
        const cargo = String(p.dados?.cargo ?? "");
        const empresa = String(p.dados?.empresa ?? p.empresa ?? "");
        const telas = [
          {
            tipo: "capa" as const,
            kicker: "Destaque · IA News",
            titulo: conteudo.capa.titulo,
            destaque: conteudo.capa.destaque || nome,
            subtitulo: conteudo.capa.subtitulo,
            foto,
            credito: null,
          },
          {
            tipo: "texto" as const,
            eyebrow: conteudo.texto.eyebrow || "O que mudou com IA",
            titulo: conteudo.texto.titulo,
            paragrafos: conteudo.texto.paragrafos,
            foto: fotos[1] ?? null,
          },
          ...(conteudo.numeros.length
            ? [
                {
                  tipo: "numeros" as const,
                  eyebrow: "Em números",
                  titulo: `${empresa || nome} em números`,
                  numeros: conteudo.numeros,
                },
              ]
            : []),
          ...(conteudo.frase
            ? [
                {
                  tipo: "frase" as const,
                  frase: conteudo.frase.frase,
                  quem: conteudo.frase.quem || nome,
                  cargo: conteudo.frase.cargo || cargo || null,
                  foto: fotos[2] ?? fotos[0] ?? null,
                },
              ]
            : []),
          {
            tipo: "final" as const,
            titulo: conteudo.final.titulo,
            texto: conteudo.final.texto,
            collabs: [] as string[],
          },
        ];
        const urls: string[] = [];
        for (const [i, t] of telas.entries()) {
          const png = await renderTelaPng(t);
          const dest = `${producaoId}/v${p.versao + 1}-tela-${i + 1}.png`;
          await subir(db, dest, png).catch((e) => {
            throw new Error(`Tela ${i + 1}: ${e instanceof Error ? e.message : e}`);
          });
          urls.push(db.storage.from("producoes").getPublicUrl(dest).data.publicUrl);
        }
        const { data: salvo, error: e4 } = await db.rpc("auto_producao_salvar", {
          p_producao: producaoId,
          p_conteudo: conteudo,
          p_telas: urls,
          p_fotos: fotos,
          p_capa: foto,
          p_erro: null,
        });
        if (e4) throw new Error(e4.message);
        resultado.push(salvo);
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        await db.rpc("auto_producao_salvar", {
          p_producao: producaoId,
          p_conteudo: {},
          p_telas: [],
          p_fotos: [],
          p_capa: null,
          p_erro: msg,
        });
        resultado.push({ briefing: p.briefing_id, erro: msg });
      }
    }

    // Avisos automáticos pelo WhatsApp oficial (prévia pronta, data marcada, publicado)
    const avisos: unknown[] = [];
    if (whatsappConfigurado()) {
      const { data: fila } = await db
        .from("auto_fila")
        .select("id, destino, mensagem, negocio_id, pessoa_id")
        .eq("canal", "whatsapp")
        .eq("status", "pendente")
        .eq("automatico", true)
        .in("passo", ["previa", "data", "publicado"])
        .limit(10);
      for (const f of (fila ?? []) as {
        id: string;
        destino: string;
        mensagem: string;
        negocio_id: string;
        pessoa_id: string | null;
      }[]) {
        try {
          await enviarWhatsApp(f.destino, f.mensagem);
          await db
            .from("auto_fila")
            .update({ status: "enviado", enviado_em: new Date().toISOString() })
            .eq("id", f.id);
          await db.rpc("auto_whatsapp_enviado", {
            p_negocio: f.negocio_id,
            p_pessoa: f.pessoa_id,
            p_texto: f.mensagem,
          });
          avisos.push({ id: f.id, ok: true });
        } catch (err) {
          // Fora da janela de 24 h o WhatsApp recusa texto livre: fica na fila para a Renata enviar
          await db
            .from("auto_fila")
            .update({
              automatico: false,
              motivo: `WhatsApp: ${err instanceof Error ? err.message.slice(0, 200) : "falhou"}`,
            })
            .eq("id", f.id);
          avisos.push({ id: f.id, ok: false });
        }
      }
    }
    return Response.json({ ok: true, producoes: resultado.length, resultado, avisos, site: SITE });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[producao] falhou", message);
    return Response.json({ ok: false, error: message }, { status: 500 });
  }
}

export const Route = createFileRoute("/api/public/hooks/producao")({
  server: {
    handlers: { GET: ({ request }) => handle(request), POST: ({ request }) => handle(request) },
  },
});
