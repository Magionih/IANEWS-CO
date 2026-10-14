import { createFileRoute } from "@tanstack/react-router";
import { cronUnauthorized, emailSendingEnabled, readJson } from "@/lib/cron-auth.server";

async function handle(request: Request) {
  const denied = cronUnauthorized(request);
  if (denied) return denied;
  try {
    if (!emailSendingEnabled()) {
      return Response.json({ ok: true, skipped: "Envio da newsletter desligado (NEWSLETTER_ENABLED)." });
    }
    const body = await readJson<{ limit: number }>(request);
    const { runWeeklyRanking } = await import("@/lib/ranking-newsletter.server");
    return Response.json(await runWeeklyRanking({ limit: body.limit ?? 8, triggeredBy: "cron-ranking" }));
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[ranking-newsletter] failed", message);
    return Response.json({ ok: false, error: message }, { status: 500 });
  }
}

export const Route = createFileRoute("/api/public/hooks/weekly-ranking")({
  server: { handlers: { GET: ({ request }) => handle(request), POST: ({ request }) => handle(request) } },
});
