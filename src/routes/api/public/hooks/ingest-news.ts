import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/public/hooks/ingest-news")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        try {
          let body: { limit?: number; hours?: number; topics?: string[] } = {};
          try {
            body = (await request.json()) as typeof body;
          } catch {
            body = {};
          }
          const { runNewsIngest } = await import("@/lib/news-ingest.server");
          const result = await runNewsIngest({
            limit: body.limit ?? 8,
            hours: body.hours ?? 26,
            topics: (body.topics ?? []) as never[],
          });
          return Response.json({ ok: true, ...result });
        } catch (err) {
          const message = err instanceof Error ? err.message : String(err);
          console.error("[ingest] failed", message);
          return Response.json({ ok: false, error: message }, { status: 500 });
        }
      },
    },
  },
});
