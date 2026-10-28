import { createFileRoute } from "@tanstack/react-router";
import { cronUnauthorized, readJson } from "@/lib/cron-auth.server";

// CRM às 8h: automações do dia (lead aquecido, sem resposta) e e-mail para a equipe comercial.
async function handle(request: Request) {
  const denied = await cronUnauthorized(request);
  if (denied) return denied;
  try {
    const body = await readJson<{ enviarEmail: boolean }>(request);
    const { runCrmDaily } = await import("@/lib/crm/digest.server");
    return Response.json(await runCrmDaily({ enviarEmail: body.enviarEmail !== false }));
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[crm-daily] failed", message);
    return Response.json({ ok: false, error: message }, { status: 500 });
  }
}

export const Route = createFileRoute("/api/public/hooks/crm-daily")({
  server: {
    handlers: { GET: ({ request }) => handle(request), POST: ({ request }) => handle(request) },
  },
});
