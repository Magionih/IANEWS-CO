import { createFileRoute } from "@tanstack/react-router";
import { cronUnauthorized } from "@/lib/cron-auth.server";

// CRM toda segunda: resumo semanal para o admin.
async function handle(request: Request) {
  const denied = await cronUnauthorized(request);
  if (denied) return denied;
  try {
    const { runCrmWeekly } = await import("@/lib/crm/digest.server");
    return Response.json(await runCrmWeekly());
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[crm-weekly] failed", message);
    return Response.json({ ok: false, error: message }, { status: 500 });
  }
}

export const Route = createFileRoute("/api/public/hooks/crm-weekly")({
  server: {
    handlers: { GET: ({ request }) => handle(request), POST: ({ request }) => handle(request) },
  },
});
