import { createFileRoute } from "@tanstack/react-router";

import { cronUnauthorized, readJson } from "@/lib/cron-auth.server";

/* Motor de leads, fonte 2: enriquecimento. Empresas e fundadores sem Instagram/LinkedIn ganham
   os canais oficiais achados pela IA com busca do Google, e com isso entram na lista do dia. */

async function handle(request: Request) {
  const denied = await cronUnauthorized(request);
  if (denied) return denied;
  try {
    const body = await readJson<{ limite: number }>(request);
    const limite = Math.min(Math.max(Number(body.limite ?? 6) || 6, 1), 15);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const db = supabaseAdmin as any;
    const { enriquecerLead } = await import("@/lib/automacao/enriquecer.server");

    const { data: pendentes, error } = await db.rpc("auto_enriquecer_pendentes", {
      p_limite: limite,
    });
    if (error) throw new Error(error.message);
    type Pendente = {
      empresa_id: string;
      empresa: string;
      site: string | null;
      pessoa_id: string | null;
      pessoa: string | null;
      cargo: string | null;
      contexto: string | null;
    };
    const resultado: unknown[] = [];
    for (const p of (pendentes ?? []) as Pendente[]) {
      try {
        const r = await enriquecerLead({
          empresa: p.empresa,
          site: p.site,
          pessoa: p.pessoa,
          cargo: p.cargo,
          contexto: p.contexto,
        });
        if (!r)
          return Response.json(
            { ok: false, error: "AI_API_KEY não configurada." },
            { status: 500 },
          );
        const { data, error: e2 } = await db.rpc("auto_enriquecer_salvar", {
          p_empresa: p.empresa_id,
          p_pessoa: p.pessoa_id,
          p_dados: r,
        });
        if (e2) throw new Error(e2.message);
        resultado.push({ empresa: p.empresa, ...data });
      } catch (err) {
        resultado.push({
          empresa: p.empresa,
          erro: err instanceof Error ? err.message : String(err),
        });
        try {
          await db.rpc("auto_enriquecer_salvar", {
            p_empresa: p.empresa_id,
            p_pessoa: p.pessoa_id,
            p_dados: null,
          });
        } catch {
          /* registra a tentativa quando der */
        }
      }
    }
    return Response.json({ ok: true, leads: resultado.length, resultado });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[enriquecer] falhou", message);
    return Response.json({ ok: false, error: message }, { status: 500 });
  }
}

export const Route = createFileRoute("/api/public/hooks/enriquecer")({
  server: {
    handlers: { GET: ({ request }) => handle(request), POST: ({ request }) => handle(request) },
  },
});
