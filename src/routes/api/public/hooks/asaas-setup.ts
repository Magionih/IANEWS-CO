import { createFileRoute } from "@tanstack/react-router";

import { cronUnauthorized } from "@/lib/cron-auth.server";
import { asaas, asaasKey, asaasWebhookToken } from "@/lib/asaas.server";

/* Registra (uma vez) o webhook do Asaas que confirma os pagamentos do Palco. Só roda com o token de rotina.
   Confere a chave (/myAccount) e não duplica se já existir um webhook para a mesma URL. */

const URL_WEBHOOK = "https://ianewsbr.com/api/public/hooks/asaas";

async function handle(request: Request) {
  const denied = await cronUnauthorized(request);
  if (denied) return denied;
  if (!asaasKey()) return Response.json({ ok: false, error: "ASAAS_API_KEY ausente." }, { status: 500 });
  const token = asaasWebhookToken();
  if (!token) return Response.json({ ok: false, error: "Sem token de webhook." }, { status: 500 });
  try {
    const conta: Record<string, any> = await asaas<Record<string, any>>("/myAccount").catch((e) => ({ erro: String(e) }));
    const lista = await asaas<{ data?: any[] }>("/webhooks");
    const existente = (lista.data ?? []).find((w) => w.url === URL_WEBHOOK);
    const corpo = {
      name: "IA News · Palco",
      url: URL_WEBHOOK,
      email: "ianewscomercial@gmail.com",
      enabled: true,
      interrupted: false,
      apiVersion: 3,
      authToken: token,
      sendType: "SEQUENTIALLY",
      events: ["PAYMENT_RECEIVED", "PAYMENT_CONFIRMED", "PAYMENT_REFUNDED", "PAYMENT_OVERDUE"],
    };
    const res = existente
      ? await asaas(`/webhooks/${existente.id}`, { method: "PUT", body: corpo })
      : await asaas("/webhooks", { method: "POST", body: corpo });
    return Response.json({ ok: true, conta: { nome: conta.name ?? conta.companyName ?? null, erro: conta.erro ?? null }, webhook: { id: (res as any).id, atualizado: !!existente } });
  } catch (err) {
    return Response.json({ ok: false, error: err instanceof Error ? err.message : String(err) }, { status: 500 });
  }
}

export const Route = createFileRoute("/api/public/hooks/asaas-setup")({
  server: { handlers: { GET: ({ request }) => handle(request), POST: ({ request }) => handle(request) } },
});
