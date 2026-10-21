import { createFileRoute } from "@tanstack/react-router";
import { cronUnauthorized, emailSendingEnabled, readJson } from "@/lib/cron-auth.server";

async function handle(request: Request) {
  const denied = await cronUnauthorized(request);
  if (denied) return denied;
  try {
    if (!emailSendingEnabled()) {
      return Response.json({ ok: true, skipped: "Envio de e-mails desligado (NEWSLETTER_ENABLED)." });
    }
    const body = await readJson<{ reminderAfterHours: number }>(request);
    const { runLeadFollowUp } = await import("@/lib/lead-funnel.server");
    return Response.json(await runLeadFollowUp({ reminderAfterHours: body.reminderAfterHours ?? 24 }));
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[lead-followup] failed", message);
    return Response.json({ ok: false, error: message }, { status: 500 });
  }
}

export const Route = createFileRoute("/api/public/hooks/lead-followup")({
  server: { handlers: { GET: ({ request }) => handle(request), POST: ({ request }) => handle(request) } },
});
