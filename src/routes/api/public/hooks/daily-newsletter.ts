import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/public/hooks/daily-newsletter")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        try {
          let body: { limit?: number; ingest?: boolean } = {};
          try {
            body = (await request.json()) as typeof body;
          } catch {
            body = {};
          }

          let ingested = 0;
          if (body.ingest !== false) {
            try {
              const { runNewsIngest } = await import("@/lib/news-ingest.server");
              const result = await runNewsIngest({ limit: 8, hours: 26, topics: [] as never[] });
              ingested = result.imported ?? 0;
            } catch (err) {
              console.error("[newsletter] ingest step failed", err);
            }
          }

          const { runDailyNewsletter } = await import("@/lib/newsletter.server");
          const result = await runDailyNewsletter({
            limit: body.limit ?? 5,
            triggeredBy: "cron",
          });
          return Response.json({ ingested, ...result });
        } catch (err) {
          const message = err instanceof Error ? err.message : String(err);
          console.error("[newsletter] failed", message);
          return Response.json({ ok: false, error: message }, { status: 500 });
        }
      },
    },
  },
});