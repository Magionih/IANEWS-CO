import { createFileRoute } from "@tanstack/react-router";
import { cronUnauthorized } from "@/lib/cron-auth.server";

// Avisos do CRM no celular da equipe: o banco chama a cada minuto quando há aviso para entregar.
async function handle(request: Request) {
  const denied = await cronUnauthorized(request);
  if (denied) return denied;
  try {
    const { entregarAvisosCrm } = await import("@/lib/crm-push.server");
    return Response.json(await entregarAvisosCrm());
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[crm-notificar] failed", message);
    return Response.json({ ok: false, error: message }, { status: 500 });
  }
}

export const Route = createFileRoute("/api/public/hooks/crm-notificar")({
  server: {
    handlers: { POST: ({ request }) => handle(request) },
  },
});
