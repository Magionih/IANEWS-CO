import { createFileRoute } from "@tanstack/react-router";

import { cronUnauthorized } from "@/lib/cron-auth.server";

/* Resumo diário da operação (7h30): conteúdo, newsletter, lista, fila, produções, radar e base.
   Vai por e-mail (Resend) para auto_config.resumo_diario_emails e pelo WhatsApp oficial para
   auto_config.resumo_diario_whatsapp quando a API estiver ligada. */

async function handle(request: Request) {
  const denied = await cronUnauthorized(request);
  if (denied) return denied;
  try {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const db = supabaseAdmin as any;
    const { data, error } = await db.rpc("auto_resumo_diario");
    if (error) throw new Error(error.message);
    const r = data as { texto: string; emails: string[]; whatsapp: string[] };
    const enviados: unknown[] = [];

    const { emailConfigured, sendEmail } = await import("@/lib/email.server");
    const { FROM_ADDRESS } = await import("@/lib/newsletter.server");
    if (emailConfigured()) {
      const html = `<pre style="font:15px/1.5 -apple-system,Segoe UI,Roboto,sans-serif;white-space:pre-wrap;color:#111">${r.texto
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/(https?:\/\/[^\s]+)/g, '<a href="$1">$1</a>')}</pre>`;
      for (const to of (r.emails ?? []).slice(0, 5)) {
        try {
          await sendEmail({
            to,
            from: FROM_ADDRESS,
            subject: r.texto.split("\n")[0] ?? "IA News · resumo do dia",
            html,
            text: r.texto,
            label: "resumo-diario",
          });
          enviados.push({ email: to, ok: true });
        } catch (err) {
          enviados.push({
            email: to,
            ok: false,
            erro: err instanceof Error ? err.message : String(err),
          });
        }
      }
    }
    const { whatsappConfigurado, enviarWhatsApp } = await import("@/lib/automacao/meta.server");
    if (whatsappConfigurado()) {
      for (const para of (r.whatsapp ?? []).slice(0, 5)) {
        try {
          await enviarWhatsApp(para, r.texto);
          enviados.push({ whatsapp: para, ok: true });
        } catch (err) {
          enviados.push({
            whatsapp: para,
            ok: false,
            erro: err instanceof Error ? err.message : String(err),
          });
        }
      }
    }
    return Response.json({ ok: true, enviados, texto: r.texto });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[resumo-diario] falhou", message);
    return Response.json({ ok: false, error: message }, { status: 500 });
  }
}

export const Route = createFileRoute("/api/public/hooks/resumo-diario")({
  server: {
    handlers: { GET: ({ request }) => handle(request), POST: ({ request }) => handle(request) },
  },
});
