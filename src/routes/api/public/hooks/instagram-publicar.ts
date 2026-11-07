import { createFileRoute } from "@tanstack/react-router";

import { cronUnauthorized } from "@/lib/cron-auth.server";

/* Publica no Instagram, pela API oficial, os carrosséis de notícia cuja matéria já entrou no ar.
   Só roda com INSTAGRAM_TOKEN válido e com auto_config.instagram_api_publicar = true (decisão editorial:
   pela API as curtidas ficam visíveis). Destaques de lead continuam pelo compositor nativo. */

async function handle(request: Request) {
  const denied = await cronUnauthorized(request);
  if (denied) return denied;
  try {
    const { instagramConfigurado, publicarCarrosselInstagram } =
      await import("@/lib/automacao/meta.server");
    if (!instagramConfigurado())
      return Response.json({ ok: true, pulado: "Instagram não configurado" });
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const db = supabaseAdmin as any;
    const { data: lista, error } = await db.rpc("auto_carrosseis_para_publicar", { p_limite: 3 });
    if (error) throw new Error(error.message);
    const resultado: unknown[] = [];
    for (const c of (lista ?? []) as {
      id: string;
      slug: string;
      telas: string[];
      legenda: string | null;
      collabs: string[];
    }[]) {
      await db.from("auto_carrosseis").update({ status: "publicando" }).eq("id", c.id);
      try {
        const r = await publicarCarrosselInstagram(c.telas, c.legenda ?? "", c.collabs ?? []);
        await db.rpc("auto_carrossel_publicado", {
          p_id: c.id,
          p_media_id: r.mediaId,
          p_url: r.url,
          p_erro: null,
        });
        resultado.push({ slug: c.slug, url: r.url });
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        await db.rpc("auto_carrossel_publicado", {
          p_id: c.id,
          p_media_id: null,
          p_url: null,
          p_erro: msg.slice(0, 300),
        });
        resultado.push({ slug: c.slug, erro: msg });
      }
    }
    return Response.json({ ok: true, publicados: resultado.length, resultado });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[instagram-publicar] falhou", message);
    return Response.json({ ok: false, error: message }, { status: 500 });
  }
}

export const Route = createFileRoute("/api/public/hooks/instagram-publicar")({
  server: {
    handlers: { GET: ({ request }) => handle(request), POST: ({ request }) => handle(request) },
  },
});
