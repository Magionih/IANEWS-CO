import { createFileRoute } from "@tanstack/react-router";
import { timingSafeEqual } from "crypto";

import { asaasWebhookToken } from "@/lib/asaas.server";

/* Webhook do Asaas: quando a cobrança do Palco é paga, marca a inscrição como paga.
   O gatilho palco_inscricao_status leva o negócio do CRM para Confirmado. Confere o cabeçalho asaas-access-token. */

function igual(a: string, b: string) {
  const x = Buffer.from(a);
  const y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
}

const PAGOS = new Set(["PAYMENT_RECEIVED", "PAYMENT_CONFIRMED"]);
const UUID = /^[0-9a-f-]{36}$/i;

export const Route = createFileRoute("/api/public/hooks/asaas")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const esperado = asaasWebhookToken();
        const recebido = request.headers.get("asaas-access-token") ?? "";
        if (!esperado || !igual(recebido, esperado)) return Response.json({ ok: false }, { status: 401 });

        const body = (await request.json().catch(() => ({}))) as { event?: string; payment?: Record<string, any> };
        const p = body.payment ?? {};
        const ref = String(p.externalReference ?? "");
        if (!body.event || !UUID.test(ref)) return Response.json({ ok: true, ignorado: true });

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const db = supabaseAdmin as any;
        const agora = new Date().toISOString();

        if (PAGOS.has(body.event)) {
          await db
            .from("palco_inscricoes")
            .update({ status: "pago", pago_em: agora, pagamento_atualizado_em: agora, asaas_payment_id: p.id ?? null })
            .eq("id", ref)
            .neq("status", "pago");
        } else if (body.event === "PAYMENT_REFUNDED") {
          await db.from("palco_inscricoes").update({ status: "cancelado", pagamento_atualizado_em: agora }).eq("id", ref);
        } else {
          await db.from("palco_inscricoes").update({ pagamento_atualizado_em: agora }).eq("id", ref);
        }
        return Response.json({ ok: true });
      },
    },
  },
});
