import { createFileRoute } from "@tanstack/react-router";
import { cronUnauthorized, readJson } from "@/lib/cron-auth.server";

async function handle(request: Request) {
  const denied = await cronUnauthorized(request);
  if (denied) return denied;
  try {
    const body = await readJson<{ limit: number; hours: number; topics: string[] }>(request);
    const { runNewsIngest } = await import("@/lib/news-ingest.server");
    const result = await runNewsIngest({
      limit: Math.min(body.limit ?? 6, 12),
      hours: body.hours ?? 26,
      topics: (body.topics ?? []) as never[],
    });
    return Response.json({ ok: true, ...result });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[ingest] failed", message);
    return Response.json({ ok: false, error: message }, { status: 500 });
  }
}

export const Route = createFileRoute("/api/public/hooks/ingest-news")({
  server: { handlers: { GET: ({ request }) => handle(request), POST: ({ request }) => handle(request) } },
});
