import { createFileRoute } from "@tanstack/react-router";

// Versão web da newsletter diária ("ver no navegador").
// /edicao mostra a edição de hoje (matérias de ontem); /edicao?data=AAAA-MM-DD mostra a edição dessa data;
// /edicao?n=5 mostra as 5 matérias mais recentes.
export const Route = createFileRoute("/edicao")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const params = new URL(request.url).searchParams;
        const n = Number(params.get("n") ?? "");
        const date = params.get("data") ?? undefined;
        const { renderNewsletterPreview } = await import("@/lib/newsletter.server");
        const { html } = await renderNewsletterPreview(Number.isFinite(n) && n > 0 ? { latest: n, date } : { date });
        return new Response(html, {
          headers: {
            "content-type": "text/html; charset=utf-8",
            "cache-control": "public, max-age=300",
            "x-robots-tag": "noindex",
          },
        });
      },
    },
  },
});
