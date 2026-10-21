import { createFileRoute } from "@tanstack/react-router";
import { cronUnauthorized } from "@/lib/cron-auth.server";

async function handle(request: Request) {
  const denied = await cronUnauthorized(request);
  if (denied) return denied;
  try {
    const { runDailyPush } = await import("@/lib/push.server");
    return Response.json(await runDailyPush("cron"));
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[daily-push] failed", message);
    return Response.json({ ok: false, error: message }, { status: 500 });
  }
}

export const Route = createFileRoute("/api/public/hooks/daily-push")({
  server: { handlers: { GET: ({ request }) => handle(request), POST: ({ request }) => handle(request) } },
});
