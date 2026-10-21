import { createFileRoute } from "@tanstack/react-router";

// Descadastro em um clique (cabeçalho List-Unsubscribe-Post, exigido por Gmail e Yahoo).
// GET leva para a página de confirmação, para que robôs de antivírus não descadastrem ninguém.
export const Route = createFileRoute("/api/public/unsubscribe")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const token = new URL(request.url).searchParams.get("t") ?? "";
        const { unsubscribeByToken } = await import("@/lib/newsletter.server");
        const res = await unsubscribeByToken(token);
        return Response.json({ ok: res.ok }, { status: res.ok ? 200 : 400 });
      },
      GET: async ({ request }) => {
        const token = new URL(request.url).searchParams.get("t") ?? "";
        return Response.redirect(new URL(`/descadastrar?t=${encodeURIComponent(token)}`, request.url).toString(), 302);
      },
    },
  },
});
