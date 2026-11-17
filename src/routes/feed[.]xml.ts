import { createFileRoute } from "@tanstack/react-router";
import { createClient } from "@supabase/supabase-js";
import type {} from "@tanstack/react-start";

/* Feed RSS das 50 matérias mais recentes já publicadas. Usado por agregadores e assistentes de IA. */

const BASE_URL = "https://ianewsbr.com";

const esc = (v: string) =>
  v.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

export const Route = createFileRoute("/feed.xml")({
  server: {
    handlers: {
      GET: async () => {
        let rows: {
          slug: string;
          title: string;
          dek: string | null;
          category: string | null;
          cover_image_url: string | null;
          published_at: string;
        }[] = [];
        try {
          const supabase = createClient(process.env["SUPABASE_URL"]!, process.env["SUPABASE_PUBLISHABLE_KEY"]!, {
            auth: { persistSession: false, autoRefreshToken: false },
          });
          const { data, error } = await supabase
            .from("articles")
            .select("slug, title, dek, category, cover_image_url, published_at")
            .eq("status", "published")
            .lte("published_at", new Date().toISOString())
            .order("published_at", { ascending: false })
            .limit(50);
          if (error) throw error;
          rows = (data ?? []) as typeof rows;
        } catch (error) {
          console.error("[feed] failed", error);
          return new Response("Feed temporariamente indisponível", { status: 503 });
        }

        const items = rows.map((r) => {
          const url = `${BASE_URL}/materia/${encodeURIComponent(r.slug)}`;
          return [
            "    <item>",
            `      <title>${esc(r.title)}</title>`,
            `      <link>${url}</link>`,
            `      <guid isPermaLink="true">${url}</guid>`,
            `      <pubDate>${new Date(r.published_at).toUTCString()}</pubDate>`,
            r.category ? `      <category>${esc(r.category)}</category>` : null,
            r.dek ? `      <description>${esc(r.dek)}</description>` : null,
            r.cover_image_url ? `      <enclosure url="${esc(r.cover_image_url)}" type="image/jpeg" length="0" />` : null,
            "    </item>",
          ]
            .filter(Boolean)
            .join("\n");
        });

        const xml = [
          `<?xml version="1.0" encoding="UTF-8"?>`,
          `<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">`,
          "  <channel>",
          "    <title>IA News</title>",
          `    <link>${BASE_URL}</link>`,
          "    <description>Notícias de inteligência artificial para quem decide, com foco em empresas e líderes brasileiros.</description>",
          "    <language>pt-BR</language>",
          `    <atom:link href="${BASE_URL}/feed.xml" rel="self" type="application/rss+xml" />`,
          ...items,
          "  </channel>",
          "</rss>",
        ].join("\n");

        return new Response(xml, {
          headers: { "Content-Type": "application/rss+xml; charset=utf-8", "Cache-Control": "public, max-age=900" },
        });
      },
    },
  },
});
