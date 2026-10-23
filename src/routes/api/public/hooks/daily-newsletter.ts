import { createFileRoute } from "@tanstack/react-router";
import { cronUnauthorized, emailSendingEnabled, readJson } from "@/lib/cron-auth.server";

async function handle(request: Request) {
  const denied = await cronUnauthorized(request);
  if (denied) return denied;
  try {
    const body = await readJson<{ limit: number; ingest: boolean }>(request);
    if (!emailSendingEnabled()) {
      return Response.json({ ok: true, skipped: "Envio de e-mails desligado (sem RESEND_API_KEY ou NEWSLETTER_ENABLED=false)." });
    }
    let ingested = 0;
    if (body.ingest === true) {
      try {
        const { runNewsIngest } = await import("@/lib/news-ingest.server");
        const result = await runNewsIngest({ limit: 8, hours: 26, topics: [] as never[] });
        ingested = result.imported ?? 0;
      } catch (err) {
        console.error("[newsletter] ingest step failed", err);
      }
    }
    const { runDailyNewsletter } = await import("@/lib/newsletter.server");
    const result = await runDailyNewsletter({ limit: body.limit ?? 20, triggeredBy: "cron" });
    return Response.json({ ingested, ...result });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[newsletter] failed", message);
    return Response.json({ ok: false, error: message }, { status: 500 });
  }
}

export const Route = createFileRoute("/api/public/hooks/daily-newsletter")({
  server: { handlers: { GET: ({ request }) => handle(request), POST: ({ request }) => handle(request) } },
});
