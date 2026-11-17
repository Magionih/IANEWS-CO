import { createFileRoute } from "@tanstack/react-router";
import { createClient } from "@supabase/supabase-js";
import type {} from "@tanstack/react-start";

/* Sitemap de notícias (Google News): só matérias publicadas nas últimas 48 horas, como pede o Google. */

const BASE_URL = "https://ianewsbr.com";

const esc = (v: string) =>
  v.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&apos;");

export const Route = createFileRoute("/news-sitemap.xml")({
  server: {
    handlers: {
      GET: async () => {
        const now = new Date();
        const since = new Date(now.getTime() - 48 * 60 * 60 * 1000);
        let rows: { slug: string; title: string; published_at: string; tags: string[] | null }[] = [];
        try {
          const supabase = createClient(process.env["SUPABASE_URL"]!, process.env["SUPABASE_PUBLISHABLE_KEY"]!, {
            auth: { persistSession: false, autoRefreshToken: false },
          });
          const { data, error } = await supabase
            .from("articles")
            .select("slug, title, published_at, tags")
            .eq("status", "published")
            .gte("published_at", since.toISOString())
            .lte("published_at", now.toISOString())
            .order("published_at", { ascending: false })
            .limit(1000);
          if (error) throw error;
          rows = (data ?? []) as typeof rows;
        } catch (error) {
          console.error("[news-sitemap] failed", error);
          return new Response("Sitemap temporariamente indisponível", { status: 503 });
        }

        const urls = rows.map((r) => {
          const keywords = (r.tags ?? []).slice(0, 8).join(", ");
          return [
            "  <url>",
            `    <loc>${BASE_URL}/materia/${encodeURIComponent(r.slug)}</loc>`,
            "    <news:news>",
            "      <news:publication>",
            "        <news:name>IA News</news:name>",
            "        <news:language>pt</news:language>",
            "      </news:publication>",
            `      <news:publication_date>${new Date(r.published_at).toISOString()}</news:publication_date>`,
            `      <news:title>${esc(r.title)}</news:title>`,
            keywords ? `      <news:keywords>${esc(keywords)}</news:keywords>` : null,
            "    </news:news>",
            "  </url>",
          ]
            .filter(Boolean)
            .join("\n");
        });

        const xml = [
          `<?xml version="1.0" encoding="UTF-8"?>`,
          `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:news="http://www.google.com/schemas/sitemap-news/0.9">`,
          ...urls,
          `</urlset>`,
        ].join("\n");

        return new Response(xml, {
          headers: { "Content-Type": "application/xml", "Cache-Control": "public, max-age=900" },
        });
      },
    },
  },
});
