import { createFileRoute } from "@tanstack/react-router";

import { cronUnauthorized } from "@/lib/cron-auth.server";
import { graphInstagram } from "@/lib/automacao/meta.server";

/* Liga a assinatura de webhook (comentários e mensagens) da conta do Instagram ligada ao app, usando o
   INSTAGRAM_TOKEN guardado na Vercel, e confere o token. Funciona com token do "Login do Instagram"
   (graph.instagram.com) e com token de página do Facebook (graph.facebook.com). Só roda com o token de rotina. */

async function handle(request: Request) {
  const denied = await cronUnauthorized(request);
  if (denied) return denied;
  const token = process.env.INSTAGRAM_TOKEN?.trim();
  const userId = process.env.INSTAGRAM_USER_ID;
  if (!token || !userId) {
    return Response.json({ ok: false, error: "INSTAGRAM_TOKEN ou INSTAGRAM_USER_ID ausente." }, { status: 500 });
  }
  const base = graphInstagram();
  const ig = base.includes("graph.instagram.com");
  const auth = { Authorization: `Bearer ${token}` };
  const me = await fetch(`${base}/me?fields=${ig ? "user_id,username" : "id,username"}`, { headers: auth });
  const meJson = (await me.json().catch(() => ({}))) as Record<string, unknown>;
  if (!me.ok) return Response.json({ ok: false, etapa: "token", host: base, detalhe: meJson }, { status: 500 });

  const alvo = ig ? "me" : userId;
  const campos = ig ? "comments,messages,messaging_postbacks" : "comments,messages,messaging_postbacks";
  const sub = await fetch(`${base}/${alvo}/subscribed_apps?subscribed_fields=${campos}`, { method: "POST", headers: auth });
  const subJson = (await sub.json().catch(() => ({}))) as Record<string, unknown>;
  const lista = await fetch(`${base}/${alvo}/subscribed_apps`, { headers: auth });
  const listaJson = (await lista.json().catch(() => ({}))) as Record<string, unknown>;
  return Response.json(
    {
      ok: sub.ok,
      host: base,
      conta: meJson,
      conta_confere: String(meJson.user_id ?? meJson.id ?? "") === userId,
      assinatura: subJson,
      assinaturas: listaJson,
      segredos: { facebook: !!process.env.META_APP_SECRET, instagram: !!process.env.INSTAGRAM_APP_SECRET },
    },
    { status: sub.ok ? 200 : 500 },
  );
}

export const Route = createFileRoute("/api/public/hooks/instagram-subscribe")({
  server: {
    handlers: { GET: ({ request }) => handle(request), POST: ({ request }) => handle(request) },
  },
});
