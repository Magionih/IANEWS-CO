import { createFileRoute } from "@tanstack/react-router";
import { timingSafeEqual } from "node:crypto";

/* Webhook do Asaas: pagamento confirmado dá baixa sozinho no CRM (auto_pagamentos → negócio
   "Fechado" com valor, status "pago" e atividade de pagamento). O Asaas envia o token
   configurado no painel no cabeçalho "asaas-access-token" (ASAAS_WEBHOOK_TOKEN aqui). */

const PAGO = new Set(["PAYMENT_RECEIVED", "PAYMENT_CONFIRMED"]);
const ESTORNO = new Set(["PAYMENT_REFUNDED", "PAYMENT_CHARGEBACK_REQUESTED"]);

function igual(a: string, b: string) {
  const x = Buffer.from(a);
  const y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
}

type Evento = {
  event?: string;
  payment?: {
    id?: string;
    value?: number;
    billingType?: string;
    externalReference?: string | null;
    paymentLink?: string | null;
  };
};

export const Route = createFileRoute("/api/public/hooks/pagamento")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const esperado = process.env.ASAAS_WEBHOOK_TOKEN;
        const recebido = request.headers.get("asaas-access-token") ?? "";
        if (!esperado || esperado.length < 16 || !igual(recebido, esperado)) {
          return new Response("Não autorizado.", { status: 401 });
        }
        const ev = (await request.json().catch(() => ({}))) as Evento;
        const status = PAGO.has(ev.event ?? "")
          ? "pago"
          : ESTORNO.has(ev.event ?? "")
            ? "estornado"
            : null;
        if (!status || !ev.payment) return Response.json({ ok: true, ignorado: ev.event ?? null });

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const { data, error } = await (supabaseAdmin as any).rpc("auto_pagamento_status", {
          p_ref: ev.payment.externalReference ?? "",
          p_external: ev.payment.paymentLink ?? ev.payment.id ?? null,
          p_status: status,
          p_valor: ev.payment.value ?? 0,
          p_forma: ev.payment.billingType ?? null,
          p_payload: ev,
        });
        if (error) {
          console.error("[pagamento] falhou", error.message);
          return Response.json({ ok: false }, { status: 500 });
        }
        return Response.json({ ok: true, resultado: data });
      },
    },
  },
});
