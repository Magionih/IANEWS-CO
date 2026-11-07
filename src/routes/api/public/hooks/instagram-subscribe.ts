import { createFileRoute } from "@tanstack/react-router";

import { cronUnauthorized } from "@/lib/cron-auth.server";

/* Liga a assinatura de webhook (comentários) da conta do Instagram ligada ao app, usando o
   INSTAGRAM_TOKEN já guardado na Vercel. Também confere o token. Só roda com o token de rotina. */

const GRAPH = `https://graph.facebook.com/${process.env.META_GRAPH_VERSION ?? "v21.0"}`;

async function handle(request: Request) {
  const denied = await cronUnauthorized(request);
  if (denied) return denied;
  const token = process.env.INSTAGRAM_TOKEN;
  const userId = process.env.INSTAGRAM_USER_ID;
  if (!token || !userId) {
    return Response.json(
      { ok: false, error: "INSTAGRAM_TOKEN ou INSTAGRAM_USER_ID ausente." },
      { status: 500 },
    );
  }
  const auth = { Authorization: `Bearer ${token}` };
  const me = await fetch(`${GRAPH}/me?fields=id,username`, { headers: auth });
  const meJson = (await me.json().catch(() => ({}))) as Record<string, unknown>;
  if (!me.ok) return Response.json({ ok: false, etapa: "token", detalhe: meJson }, { status: 500 });

  const sub = await fetch(
    `${GRAPH}/${userId}/subscribed_apps?subscribed_fields=comments,messages`,
    {
      method: "POST",
      headers: auth,
    },
  );
  const subJson = (await sub.json().catch(() => ({}))) as Record<string, unknown>;
  const lista = await fetch(`${GRAPH}/${userId}/subscribed_apps`, { headers: auth });
  const listaJson = (await lista.json().catch(() => ({}))) as Record<string, unknown>;
  return Response.json(
    { ok: sub.ok, conta: meJson, assinatura: subJson, assinaturas: listaJson },
    { status: sub.ok ? 200 : 500 },
  );
}

export const Route = createFileRoute("/api/public/hooks/instagram-subscribe")({
  server: {
    handlers: { GET: ({ request }) => handle(request), POST: ({ request }) => handle(request) },
  },
});
