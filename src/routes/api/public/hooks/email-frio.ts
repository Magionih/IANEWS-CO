import { createFileRoute } from "@tanstack/react-router";

import { cronUnauthorized, readJson } from "@/lib/cron-auth.server";

/* E-mail frio B2B, em lotes pequenos de hora em hora (dias úteis, 9h às 17h).
   Só envia quando as três chaves existem: auto_config.email_frio_ativo = true,
   PROSPECCAO_RESEND_KEY (conta/domínio separados do domínio principal) e PROSPECCAO_FROM.
   Todo e-mail leva saída de um clique (List-Unsubscribe + resposta SAIR). */

async function handle(request: Request) {
  const denied = await cronUnauthorized(request);
  if (denied) return denied;
  try {
    const apiKey = process.env.PROSPECCAO_RESEND_KEY;
    const from = process.env.PROSPECCAO_FROM;
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const db = supabaseAdmin as any;
    const { data: cfg } = await db
      .from("auto_config")
      .select("chave, valor")
      .in("chave", ["email_frio_ativo", "pausado"]);
    const ligado = (cfg ?? []).find((c: any) => c.chave === "email_frio_ativo")?.valor === true;
    const pausado = (cfg ?? []).find((c: any) => c.chave === "pausado")?.valor === true;
    if (!ligado || pausado || !apiKey || !from) {
      return Response.json({
        ok: true,
        ignorado: "E-mail frio desligado (config ou chaves ausentes).",
      });
    }

    const body = await readJson<{ lote: number }>(request);
    const lote = Math.min(Math.max(Number(body.lote ?? 4) || 4, 1), 10);
    const hoje = new Date().toLocaleDateString("en-CA", { timeZone: "America/Sao_Paulo" });
    const { data: itens, error } = await db
      .from("auto_fila")
      .select("id, destino, assunto, mensagem")
      .eq("dia", hoje)
      .eq("canal", "email")
      .eq("status", "pendente")
      .eq("automatico", true)
      .order("nota", { ascending: false })
      .limit(lote);
    if (error) throw new Error(error.message);

    let enviados = 0;
    for (const it of (itens ?? []) as {
      id: string;
      destino: string;
      assunto: string | null;
      mensagem: string;
    }[]) {
      const rodape = "\n\n—\nSe não quiser receber mais e-mails da IA News, responda com SAIR.";
      const res = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          from,
          to: [it.destino],
          subject: it.assunto ?? "IA News",
          text: it.mensagem + rodape,
          headers: { "List-Unsubscribe": `<mailto:${from.replace(/^.*<|>$/g, "")}?subject=SAIR>` },
        }),
      });
      if (res.ok) {
        await db.rpc("auto_marcar", {
          p_id: it.id,
          p_status: "enviado",
          p_motivo: "email automático",
        });
        enviados++;
      } else {
        await db.rpc("auto_marcar", {
          p_id: it.id,
          p_status: "falhou",
          p_motivo: `Resend ${res.status}`,
        });
        if (res.status === 422 || res.status === 403) {
          await db
            .from("auto_eventos_canal")
            .insert({ canal: "email", tipo: "rejeicao_email", detalhe: it.destino });
        }
      }
      // Pequeno intervalo dentro do lote; o espaçamento maior vem dos lotes de hora em hora.
      await new Promise((r) => setTimeout(r, 4_000 + Math.random() * 6_000));
    }
    return Response.json({ ok: true, enviados });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[email-frio] falhou", message);
    return Response.json({ ok: false, error: message }, { status: 500 });
  }
}

export const Route = createFileRoute("/api/public/hooks/email-frio")({
  server: {
    handlers: { GET: ({ request }) => handle(request), POST: ({ request }) => handle(request) },
  },
});
