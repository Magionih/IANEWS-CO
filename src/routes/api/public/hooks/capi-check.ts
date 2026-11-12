import { createFileRoute } from "@tanstack/react-router";

import { cronUnauthorized } from "@/lib/cron-auth.server";

/* Confere se o META_CAPI_TOKEN da Vercel consegue acessar o Pixel, sem mandar nenhum evento.
   Protegido como as outras rotinas (CRON_SECRET). Responde só ok/erro, nunca o token. */

async function handle(request: Request) {
  const denied = await cronUnauthorized(request);
  if (denied) return denied;
  const token = process.env.META_CAPI_TOKEN?.trim();
  const pixel = (process.env.META_PIXEL_ID || process.env.VITE_META_PIXEL_ID || "").replace(/[^0-9]/g, "");
  if (!token) return Response.json({ ok: false, motivo: "META_CAPI_TOKEN ausente" });
  if (!pixel) return Response.json({ ok: false, motivo: "Pixel ausente" });
  const res = await fetch(`https://graph.facebook.com/v21.0/${pixel}?fields=id,name&access_token=${encodeURIComponent(token)}`);
  const j = (await res.json().catch(() => ({}))) as { id?: string; name?: string; error?: { message?: string } };
  return Response.json({ ok: res.ok && j.id === pixel, pixel: j.id ?? null, nome: j.name ?? null, erro: j.error?.message ?? null });
}

export const Route = createFileRoute("/api/public/hooks/capi-check")({
  server: { handlers: { GET: ({ request }) => handle(request), POST: ({ request }) => handle(request) } },
});
