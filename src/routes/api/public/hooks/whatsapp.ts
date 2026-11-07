import { createFileRoute } from "@tanstack/react-router";

import {
  assinaturaValida,
  enviarWhatsApp,
  verificarWebhook,
  whatsappConfigurado,
} from "@/lib/automacao/meta.server";

/* Webhook do WhatsApp Cloud API (número oficial da IA News).
   Toda mensagem recebida vira atividade no CRM, o que para as sequências daquele lead.
   Com WHATSAPP_AGENTE=on, o agente responde dentro da janela de 24 horas e passa para
   humano tudo o que envolve preço, proposta, reclamação ou assunto fora do manual. */

type Msg = { from: string; id: string; type: string; text?: { body?: string } };
type Payload = {
  entry?: {
    changes?: {
      value?: { contacts?: { profile?: { name?: string }; wa_id?: string }[]; messages?: Msg[] };
    }[];
  }[];
};

async function processar(payload: Payload) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const db = supabaseAdmin as any;
  const agenteLigado = process.env.WHATSAPP_AGENTE === "on" && whatsappConfigurado();

  for (const entry of payload.entry ?? []) {
    for (const change of entry.changes ?? []) {
      const nomes = new Map((change.value?.contacts ?? []).map((c) => [c.wa_id, c.profile?.name]));
      for (const m of change.value?.messages ?? []) {
        const texto = m.type === "text" ? (m.text?.body ?? "") : `[${m.type}]`;
        const { data: reg, error } = await db.rpc("auto_whatsapp_recebido", {
          p_telefone: m.from,
          p_nome: nomes.get(m.from) ?? null,
          p_texto: texto,
          p_msg_id: m.id,
        });
        if (error) throw new Error(error.message);
        const r = reg as { pessoa_id: string; negocio_id: string | null; repetida?: boolean };
        if (r.repetida || !agenteLigado) continue;

        if (m.type !== "text") {
          await db.rpc("auto_handoff", {
            p_pessoa: r.pessoa_id,
            p_negocio: r.negocio_id,
            p_titulo: "Responder WhatsApp (arquivo ou áudio)",
            p_texto: `O lead enviou ${m.type}. Veja no WhatsApp oficial.`,
          });
          continue;
        }

        const { data: hist } = await db.rpc("auto_conversa", { p_pessoa: r.pessoa_id });
        let linkBriefing: string | null = null;
        if (r.negocio_id) {
          const { data: b } = await db
            .from("auto_briefings")
            .select("token, status")
            .eq("negocio_id", r.negocio_id)
            .maybeSingle();
          if (b && ["aberto", "ajuste"].includes(b.status))
            linkBriefing = `https://ianewsbr.com/briefing/${b.token}`;
        }
        const { responderComoAgente } = await import("@/lib/automacao/ia.server");
        const decisao = await responderComoAgente(hist ?? [], texto, linkBriefing);
        if (!decisao) continue;
        if (decisao.acao === "passar_para_humano") {
          await db.rpc("auto_handoff", {
            p_pessoa: r.pessoa_id,
            p_negocio: r.negocio_id,
            p_titulo: "Responder WhatsApp · " + decisao.motivo.slice(0, 120),
            p_texto: `Última mensagem: ${texto}`,
          });
        }
        if (decisao.resposta.trim()) {
          await enviarWhatsApp(m.from, decisao.resposta);
          await db.rpc("auto_whatsapp_enviado", {
            p_pessoa: r.pessoa_id,
            p_negocio: r.negocio_id,
            p_texto: decisao.resposta,
          });
        }
      }
    }
  }
}

export const Route = createFileRoute("/api/public/hooks/whatsapp")({
  server: {
    handlers: {
      GET: ({ request }) => verificarWebhook(request, process.env.WHATSAPP_VERIFY_TOKEN),
      POST: async ({ request }) => {
        const corpo = await request.text();
        if (
          !assinaturaValida(
            corpo,
            request.headers.get("x-hub-signature-256"),
            process.env.META_APP_SECRET,
          )
        ) {
          return new Response("Assinatura inválida.", { status: 401 });
        }
        try {
          await processar(JSON.parse(corpo) as Payload);
        } catch (err) {
          console.error("[whatsapp] falhou", err instanceof Error ? err.message : err);
        }
        // A Meta reenvia se não receber 200; os erros ficam no log.
        return Response.json({ ok: true });
      },
    },
  },
});
