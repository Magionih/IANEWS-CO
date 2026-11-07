import { createFileRoute } from "@tanstack/react-router";

import { cronUnauthorized, readJson } from "@/lib/cron-auth.server";

/* Motor de leads, fonte 1: empresas e pessoas citadas nas matérias novas do site viram leads
   no CRM (negócio "Virou pauta" em Novo), antes de a fila do dia ser montada às 7h20. */

async function handle(request: Request) {
  const denied = await cronUnauthorized(request);
  if (denied) return denied;
  try {
    const body = await readJson<{ dias: number; limite: number }>(request);
    const dias = Math.min(Math.max(Number(body.dias ?? 3) || 3, 1), 14);
    // Poucas matérias por rodada: a IA pode levar mais de 1 minuto por matéria quando está lenta.
    const limite = Math.min(Math.max(Number(body.limite ?? 5) || 5, 1), 20);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const db = supabaseAdmin as any;
    const { extrairMencoes } = await import("@/lib/automacao/ia.server");

    const { data: artigos, error } = await db.rpc("auto_artigos_sem_mencao", { p_dias: dias });
    if (error) throw new Error(error.message);
    const resultado: unknown[] = [];
    type Artigo = {
      id: string;
      title: string;
      dek: string | null;
      tags: string[] | null;
      body_markdown: string | null;
    };
    for (const a of ((artigos ?? []) as Artigo[]).slice(0, limite)) {
      let m: Awaited<ReturnType<typeof extrairMencoes>>;
      try {
        m = await extrairMencoes(a);
      } catch (err) {
        // Uma matéria com falha na IA não derruba as outras; ela volta na próxima rodada.
        resultado.push({ artigo: a.title, erro: err instanceof Error ? err.message : String(err) });
        continue;
      }
      if (!m)
        return Response.json({ ok: false, error: "AI_API_KEY não configurada." }, { status: 500 });
      const { data, error: e2 } = await db.rpc("auto_registrar_pauta", {
        p_article: a.id,
        p_empresas: m.empresas,
        p_pessoas: m.pessoas,
      });
      if (e2) throw new Error(e2.message);
      resultado.push(data);
    }
    return Response.json({ ok: true, artigos: resultado.length, resultado });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[auto-leads] falhou", message);
    return Response.json({ ok: false, error: message }, { status: 500 });
  }
}

export const Route = createFileRoute("/api/public/hooks/auto-leads")({
  server: {
    handlers: { GET: ({ request }) => handle(request), POST: ({ request }) => handle(request) },
  },
});
