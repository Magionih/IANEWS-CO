import { createFileRoute } from "@tanstack/react-router";

import { cronUnauthorized } from "@/lib/cron-auth.server";

/* Cobranças automáticas: prévia paga aprovada vira link de pagamento (Pix ou cartão) no Asaas.
   O link entra no CRM como tarefa com a mensagem pronta; a baixa chega pelo webhook
   /api/public/hooks/pagamento. Sem ASAAS_API_KEY, a rotina não faz nada. */

const ASAAS_URL = process.env.ASAAS_URL ?? "https://api.asaas.com/v3";

async function handle(request: Request) {
  const denied = await cronUnauthorized(request);
  if (denied) return denied;
  const apiKey = process.env.ASAAS_API_KEY;
  if (!apiKey) return Response.json({ ok: true, ignorado: "ASAAS_API_KEY não configurada." });
  try {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const db = supabaseAdmin as any;
    const { data: pendentes, error } = await db.rpc("auto_cobrancas_pendentes");
    if (error) throw new Error(error.message);
    let criadas = 0;
    for (const c of (pendentes ?? []) as {
      negocio_id: string;
      valor: number;
      titulo: string;
      pessoa: string | null;
      empresa: string | null;
    }[]) {
      const { data: pg, error: e1 } = await db
        .from("auto_pagamentos")
        .insert({ negocio_id: c.negocio_id, valor: c.valor, gateway: "asaas" })
        .select("id")
        .single();
      if (e1) throw new Error(e1.message);
      const res = await fetch(`${ASAAS_URL}/paymentLinks`, {
        method: "POST",
        headers: {
          access_token: apiKey,
          "Content-Type": "application/json",
          "User-Agent": "ianews-crm",
        },
        body: JSON.stringify({
          name: `IA News · ${c.empresa ?? c.pessoa ?? c.titulo}`.slice(0, 100),
          description: "Produção de conteúdo patrocinado (matéria e posts) na IA News.",
          billingType: "UNDEFINED",
          chargeType: "DETACHED",
          value: c.valor,
          dueDateLimitDays: 5,
          externalReference: pg.id,
          notificationEnabled: false,
        }),
      });
      if (!res.ok) {
        await db.from("auto_pagamentos").delete().eq("id", pg.id);
        throw new Error(`Asaas ${res.status}: ${(await res.text()).slice(0, 300)}`);
      }
      const link = (await res.json()) as { id: string; url: string };
      await db
        .from("auto_pagamentos")
        .update({ external_id: link.id, link: link.url })
        .eq("id", pg.id);
      const { data: neg } = await db
        .from("crm_negocios")
        .select("dono_id, empresa_id, pessoa_id")
        .eq("id", c.negocio_id)
        .single();
      await db.from("crm_tarefas").insert({
        titulo: `Enviar link de pagamento · ${c.pessoa ?? c.titulo}`.slice(0, 300),
        descricao: `Mensagem pronta:\n\n${c.pessoa?.split(" ")[0] ?? "Oi"}, a prévia foi aprovada! Para confirmarmos a data de publicação, o pagamento pode ser feito por Pix ou cartão neste link: ${link.url}\n\nAssim que o pagamento cair, a baixa é automática e eu te confirmo a data.`,
        vence_em: new Date().toLocaleDateString("en-CA", { timeZone: "America/Sao_Paulo" }),
        automatica: true,
        chave: `cobranca:${pg.id}`,
        responsavel_id: neg?.dono_id ?? null,
        empresa_id: neg?.empresa_id ?? null,
        pessoa_id: neg?.pessoa_id ?? null,
        negocio_id: c.negocio_id,
      });
      criadas++;
    }
    return Response.json({ ok: true, criadas });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[cobrancas] falhou", message);
    return Response.json({ ok: false, error: message }, { status: 500 });
  }
}

export const Route = createFileRoute("/api/public/hooks/cobrancas")({
  server: {
    handlers: { GET: ({ request }) => handle(request), POST: ({ request }) => handle(request) },
  },
});
