import { createFileRoute } from "@tanstack/react-router";

import { cronUnauthorized, readJson } from "@/lib/cron-auth.server";
import { processar, type Canal, type Entrada, type Saida } from "@/lib/automacao/minichat.server";

/* Simulador do mini chat (só com o token de rotina): roda os fluxos sem mandar nada ao Instagram e devolve
   as mensagens que seriam enviadas. Grava no banco como uma conversa real, para conferir o CRM. */

async function handle(request: Request) {
  const denied = await cronUnauthorized(request);
  if (denied) return denied;
  const body = await readJson<{ passos: Entrada[]; segue?: boolean; nome?: string }>(request);
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const db = supabaseAdmin as any;
  const log: { de: string; texto?: string | null; payload?: string | null; resposta: Saida[]; fluxo: string | null }[] = [];
  let enviadas: Saida[] = [];
  const canal: Canal = {
    respostaPrivada: async (_c, s) => void enviadas.push(s),
    direct: async (_i, s) => void enviadas.push(s),
    responderComentario: async () => undefined,
    perfil: async () => ({ name: body.nome ?? "Teste Minichat", segue: body.segue ?? true }),
    pausa: async () => undefined,
  };
  for (const e of body.passos ?? []) {
    enviadas = [];
    const r = await processar(db, canal, e);
    log.push({ de: e.tipo, texto: e.texto, payload: e.payload, resposta: enviadas, fluxo: r.fluxo });
  }
  return Response.json({ ok: true, log });
}

export const Route = createFileRoute("/api/public/hooks/minichat-teste")({
  server: { handlers: { POST: ({ request }) => handle(request) } },
});
