import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/public/hooks/lead-followup")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        try {
          let body: { reminderAfterHours?: number } = {};
          try {
            body = (await request.json()) as typeof body;
          } catch {
            body = {};
          }
          const { runLeadFollowUp } = await import("@/lib/lead-funnel.server");
          const result = await runLeadFollowUp({
            reminderAfterHours: body.reminderAfterHours ?? 24,
          });
          return Response.json(result);
        } catch (err) {
          const message = err instanceof Error ? err.message : String(err);
          console.error("[lead-followup] failed", message);
          return Response.json({ ok: false, error: message }, { status: 500 });
        }
      },
    },
  },
});
