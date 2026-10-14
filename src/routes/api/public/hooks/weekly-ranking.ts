import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/public/hooks/weekly-ranking")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        try {
          let body: { limit?: number } = {};
          try {
            body = (await request.json()) as typeof body;
          } catch {
            body = {};
          }
          const { runWeeklyRanking } = await import("@/lib/ranking-newsletter.server");
          const result = await runWeeklyRanking({
            limit: body.limit ?? 8,
            triggeredBy: "cron-ranking",
          });
          return Response.json(result);
        } catch (err) {
          const message = err instanceof Error ? err.message : String(err);
          console.error("[ranking-newsletter] failed", message);
          return Response.json({ ok: false, error: message }, { status: 500 });
        }
      },
    },
  },
});
