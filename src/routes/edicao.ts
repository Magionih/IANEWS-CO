import { createFileRoute } from "@tanstack/react-router";

// Versão web da newsletter diária ("ver no navegador").
// /edicao mostra a edição de hoje (matérias de ontem); /edicao?n=5 mostra as 5 matérias mais recentes.
export const Route = createFileRoute("/edicao")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const n = Number(new URL(request.url).searchParams.get("n") ?? "");
        const { renderNewsletterPreview } = await import("@/lib/newsletter.server");
        const { html } = await renderNewsletterPreview(Number.isFinite(n) && n > 0 ? { latest: n } : {});
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
