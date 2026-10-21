import { createFileRoute } from "@tanstack/react-router";
import { cronSource, cronUnauthorized } from "@/lib/cron-auth.server";

// Só confirma que a chamada agendada está autorizada. Não executa nada.
async function handle(request: Request) {
  const denied = await cronUnauthorized(request);
  if (denied) return denied;
  return Response.json({ ok: true, source: cronSource(request) });
}

export const Route = createFileRoute("/api/public/hooks/ping")({
  server: { handlers: { GET: ({ request }) => handle(request), POST: ({ request }) => handle(request) } },
});
