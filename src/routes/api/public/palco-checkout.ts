import { createFileRoute } from "@tanstack/react-router";

import { PALCO_DESCRICAO, PALCO_PAGAMENTO_URL, PALCO_VALOR } from "@/lib/palco-validate";
import { PAGO, asaas, asaasKey, cnpjValido, cpfValido, soDigitos } from "@/lib/asaas.server";

/* Checkout do Palco IA News Online (/palco/checkout).
   GET  ?i=<inscrição>&t=<token>            → dados do pedido e status (consulta o Asaas se ainda estiver pendente)
   POST {i, t, documento, metodo}            → cria (ou reaproveita) o cliente e a cobrança no Asaas e devolve
                                               o Pix (QR e copia e cola) ou o endereço da fatura para cartão/boleto.
   Sem ASAAS_API_KEY, devolve o link de pagamento fixo. O token da inscrição é o que protege o pedido. */

type Metodo = "pix" | "cartao" | "boleto";
const BILLING: Record<Metodo, string> = { pix: "PIX", cartao: "CREDIT_CARD", boleto: "BOLETO" };

const UUID = /^[0-9a-f-]{36}$/i;
const TOKEN = /^[0-9a-f]{20,64}$/i;

function mascararEmail(e: string) {
  const [u, d] = e.split("@");
  if (!d) return e;
  return `${u.slice(0, 2)}${"•".repeat(Math.max(2, u.length - 2))}@${d}`;
}

async function carregar(i: string | null, t: string | null) {
  if (!i || !t || !UUID.test(i) || !TOKEN.test(t)) return null;
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const db = supabaseAdmin as any;
  const { data } = await db
    .from("palco_inscricoes")
    .select("id, nome, email, whatsapp, empresa, status, checkout_token, asaas_customer_id, asaas_payment_id, pagamento_metodo")
    .eq("id", i)
    .eq("checkout_token", t)
    .maybeSingle();
  return data ? { db, row: data as Record<string, any> } : null;
}

function dataVencimento(dias: number) {
  const d = new Date(Date.now() - 3 * 36e5 + dias * 864e5);
  return d.toISOString().slice(0, 10);
}

async function marcarPago(db: any, id: string, metodo?: string | null) {
  await db
    .from("palco_inscricoes")
    .update({ status: "pago", pago_em: new Date().toISOString(), pagamento_atualizado_em: new Date().toISOString(), ...(metodo ? { pagamento_metodo: metodo } : {}) })
    .eq("id", id)
    .neq("status", "pago");
}

export const Route = createFileRoute("/api/public/palco-checkout")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const u = new URL(request.url);
        const found = await carregar(u.searchParams.get("i"), u.searchParams.get("t"));
        if (!found) return Response.json({ ok: false, error: "Pedido não encontrado." }, { status: 404 });
        const { db, row } = found;
        let status = row.status as string;
        if (status !== "pago" && status !== "cortesia" && row.asaas_payment_id && asaasKey()) {
          try {
            const p = await asaas<{ status: string }>(`/payments/${row.asaas_payment_id}`);
            if (PAGO.has(p.status)) {
              await marcarPago(db, row.id);
              status = "pago";
            }
          } catch (err) {
            console.error("[palco-checkout] status", err instanceof Error ? err.message : err);
          }
        }
        return Response.json({
          ok: true,
          nome: row.nome,
          email: mascararEmail(row.email ?? ""),
          status,
          pago: status === "pago" || status === "cortesia",
          metodo: row.pagamento_metodo ?? null,
          integrado: !!asaasKey(),
        });
      },

      POST: async ({ request }) => {
        let body: Record<string, unknown>;
        try {
          body = (await request.json()) as Record<string, unknown>;
        } catch {
          return Response.json({ ok: false, error: "Envio inválido." }, { status: 400 });
        }
        const found = await carregar(String(body["i"] ?? ""), String(body["t"] ?? ""));
        if (!found) return Response.json({ ok: false, error: "Pedido não encontrado." }, { status: 404 });
        const { db, row } = found;
        if (row.status === "pago" || row.status === "cortesia") return Response.json({ ok: true, pago: true });

        const metodo = (["pix", "cartao", "boleto"].includes(String(body["metodo"])) ? body["metodo"] : "pix") as Metodo;
        if (!asaasKey()) return Response.json({ ok: true, modo: "link", url: PALCO_PAGAMENTO_URL });

        const doc = soDigitos(String(body["documento"] ?? ""));
        if (!(cpfValido(doc) || cnpjValido(doc))) {
          return Response.json({ ok: false, errors: { documento: "Confira o CPF ou CNPJ." } }, { status: 422 });
        }

        try {
          let customer = row.asaas_customer_id as string | null;
          if (!customer) {
            const c = await asaas<{ id: string }>("/customers", {
              method: "POST",
              body: {
                name: row.nome,
                cpfCnpj: doc,
                email: row.email,
                mobilePhone: soDigitos(row.whatsapp ?? "").slice(-11) || undefined,
                company: row.empresa || undefined,
                externalReference: row.id,
                notificationDisabled: true,
              },
            });
            customer = c.id;
          } else {
            await asaas(`/customers/${customer}`, { method: "PUT", body: { cpfCnpj: doc } }).catch(() => null);
          }

          // Reaproveita a cobrança aberta da mesma forma de pagamento; senão cria outra.
          let pay: Record<string, any> | null = null;
          if (row.asaas_payment_id && row.pagamento_metodo === metodo) {
            pay = await asaas(`/payments/${row.asaas_payment_id}`).catch(() => null);
            if (pay && PAGO.has(pay.status)) {
              await marcarPago(db, row.id, metodo);
              return Response.json({ ok: true, pago: true });
            }
            if (pay && pay.status !== "PENDING") pay = null;
          }
          if (!pay) {
            if (row.asaas_payment_id) await asaas(`/payments/${row.asaas_payment_id}`, { method: "DELETE" }).catch(() => null);
            pay = await asaas("/payments", {
              method: "POST",
              body: {
                customer,
                billingType: BILLING[metodo],
                value: PALCO_VALOR,
                dueDate: dataVencimento(metodo === "boleto" ? 3 : 1),
                description: PALCO_DESCRICAO,
                externalReference: row.id,
              },
            });
          }

          const cobranca = pay as Record<string, any>;
          await db
            .from("palco_inscricoes")
            .update({
              asaas_customer_id: customer,
              asaas_payment_id: cobranca.id,
              pagamento_metodo: metodo,
              pagamento_valor: PALCO_VALOR,
              pagamento_atualizado_em: new Date().toISOString(),
            })
            .eq("id", row.id);

          if (metodo === "pix") {
            const qr = await asaas<{ encodedImage: string; payload: string; expirationDate?: string }>(`/payments/${cobranca.id}/pixQrCode`);
            return Response.json({ ok: true, modo: "api", metodo, pix: { imagem: qr.encodedImage, codigo: qr.payload, expira: qr.expirationDate ?? null } });
          }
          return Response.json({ ok: true, modo: "api", metodo, url: (metodo === "boleto" && cobranca.bankSlipUrl) || cobranca.invoiceUrl });
        } catch (err) {
          console.error("[palco-checkout] asaas", err instanceof Error ? err.message : err);
          return Response.json(
            { ok: false, error: "Não conseguimos gerar o pagamento agora. Tente de novo em instantes ou use o link alternativo.", url: PALCO_PAGAMENTO_URL },
            { status: 502 },
          );
        }
      },
    },
  },
});
