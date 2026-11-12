import { createFileRoute } from "@tanstack/react-router";

import { cronUnauthorized } from "@/lib/cron-auth.server";

/* Confere se o META_CAPI_TOKEN da Vercel funciona: manda um evento de TESTE (aba Eventos de teste), sem dados pessoais.
   Protegido como as outras rotinas (CRON_SECRET). Responde só ok/erro, nunca o token. */

async function handle(request: Request) {
  const denied = await cronUnauthorized(request);
  if (denied) return denied;
  const token = process.env.META_CAPI_TOKEN?.trim();
  const pixel = (process.env.META_PIXEL_ID || process.env.VITE_META_PIXEL_ID || "").replace(/[^0-9]/g, "");
  if (!token) return Response.json({ ok: false, motivo: "META_CAPI_TOKEN ausente" });
  if (!pixel) return Response.json({ ok: false, motivo: "Pixel ausente" });
  // Envia um PageView de teste, sem dados pessoais. Com test_code (aba "Eventos de teste"), ele só aparece lá e não entra na otimização.
  const body = (request.method === "POST" ? await request.json().catch(() => ({})) : {}) as { test_code?: string };
  const test = /^TEST\w{2,20}$/.test(String(body.test_code ?? "")) ? String(body.test_code) : null;
  if (!test) return Response.json({ ok: false, motivo: "Informe test_code (aba Eventos de teste)" });
  const res = await fetch(`https://graph.facebook.com/v21.0/${pixel}/events?access_token=${encodeURIComponent(token)}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      test_event_code: test,
      data: [
        {
          event_name: "PageView",
          event_time: Math.floor(Date.now() / 1000),
          event_id: `capi-check-${Date.now()}`,
          action_source: "website",
          event_source_url: "https://ianewsbr.com/",
          user_data: { client_user_agent: "IANews CAPI check", client_ip_address: "200.200.200.200" },
        },
      ],
    }),
  });
  const j = (await res.json().catch(() => ({}))) as { events_received?: number; error?: { message?: string } };
  return Response.json({ ok: res.ok && j.events_received === 1, recebidos: j.events_received ?? 0, erro: j.error?.message ?? null });
}

export const Route = createFileRoute("/api/public/hooks/capi-check")({
  server: { handlers: { GET: ({ request }) => handle(request), POST: ({ request }) => handle(request) } },
});
