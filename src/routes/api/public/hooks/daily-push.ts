import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/public/hooks/daily-push")({
  server: {
    handlers: {
      POST: async () => {
        try {
          const { runDailyPush } = await import("@/lib/push.server");
          const result = await runDailyPush("cron");
          return Response.json(result);
        } catch (err) {
          const message = err instanceof Error ? err.message : String(err);
          console.error("[daily-push] failed", message);
          return Response.json({ ok: false, error: message }, { status: 500 });
        }
      },
    },
  },
});
