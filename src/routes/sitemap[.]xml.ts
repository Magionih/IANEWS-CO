import { createFileRoute } from "@tanstack/react-router";
import { createClient } from "@supabase/supabase-js";
import type {} from "@tanstack/react-start";
import { CATEGORY_SEO_LIST } from "@/lib/categories";
import { HUB_LIST } from "@/lib/hubs";
import { isIndexable } from "@/lib/seo-quality";

const BASE_URL = "https://ianewsbr.com";

interface SitemapEntry {
  path: string;
  lastmod?: string;
  changefreq?: "always" | "hourly" | "daily" | "weekly" | "monthly" | "yearly" | "never";
  priority?: string;
  image?: string;
}

const xmlEscape = (v: string) =>
  v.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

export const Route = createFileRoute("/sitemap.xml")({
  server: {
    handlers: {
      GET: async () => {
        const entries: SitemapEntry[] = [
          { path: "/", changefreq: "hourly", priority: "1.0" },
          { path: "/noticias", changefreq: "hourly", priority: "0.9" },
          { path: "/ranking", changefreq: "weekly", priority: "0.8" },
          {
            path: "/artigos/inteligencia-artificial-nas-empresas",
            changefreq: "monthly",
            priority: "0.8",
          },
          ...HUB_LIST.map((h) => ({ path: `/guias/${h.slug}`, changefreq: "daily" as const, priority: "0.8" })),
          { path: "/assinar", changefreq: "monthly", priority: "0.7" },
          { path: "/newsletter", changefreq: "daily", priority: "0.9" },
          ...CATEGORY_SEO_LIST.map((c) => ({
            path: `/categoria/${c.slug}`,
            changefreq: "daily" as const,
            priority: "0.8",
          })),
          { path: "/sobre", changefreq: "monthly", priority: "0.6" },
          { path: "/anuncie", changefreq: "monthly", priority: "0.5" },
          { path: "/palco", changefreq: "weekly", priority: "0.8" },
          { path: "/eventos", changefreq: "weekly", priority: "0.8" },
          { path: "/selo", changefreq: "yearly", priority: "0.4" },
          { path: "/autor/henrique-magioni", changefreq: "weekly", priority: "0.6" },
          { path: "/pauta", changefreq: "monthly", priority: "0.7" },
          { path: "/gente", changefreq: "daily", priority: "0.8" },
          { path: "/empresas", changefreq: "monthly", priority: "0.6" },
          { path: "/lista100", changefreq: "weekly", priority: "0.7" },
          { path: "/lista100/criterios", changefreq: "monthly", priority: "0.5" },
          { path: "/aula", changefreq: "weekly", priority: "0.6" },
          { path: "/conselho", changefreq: "weekly", priority: "0.6" },
          { path: "/projetos", changefreq: "monthly", priority: "0.6" },
          { path: "/contato", changefreq: "monthly", priority: "0.5" },
          { path: "/termos", changefreq: "yearly", priority: "0.3" },
        ];

        try {
          const supabase = createClient(
            process.env["SUPABASE_URL"]!,
            process.env["SUPABASE_PUBLISHABLE_KEY"]!,
            { auth: { persistSession: false, autoRefreshToken: false } },
          );
          for (let offset = 0; ; offset += 1000) {
            const { data, error } = await supabase
              .from("articles")
              .select("slug, published_at, updated_at, cover_image_url, body_markdown")
              .eq("status", "published")
              .lte("published_at", new Date().toISOString())
              .order("published_at", { ascending: false })
              .order("slug", { ascending: true })
              .range(offset, offset + 999);
            if (error) throw error;
            const rows = (data ?? []) as {
              slug: string;
              published_at: string;
              updated_at: string | null;
              cover_image_url: string | null;
              body_markdown: string | null;
            }[];
            for (const row of rows) {
              if (!isIndexable(row.body_markdown)) continue;
              const pub = new Date(row.published_at).getTime();
              const upd = row.updated_at ? new Date(row.updated_at).getTime() : pub;
              entries.push({
                path: `/materia/${encodeURIComponent(row.slug)}`,
                lastmod: new Date(Math.max(pub, Math.min(upd, Date.now()))).toISOString(),
                image: row.cover_image_url ?? undefined,
                changefreq: "weekly",
                priority: "0.7",
              });
            }
            if (rows.length < 1000) break;
          }
        } catch (error) {
          console.error("[sitemap] failed to load articles", error);
          return new Response("Sitemap temporariamente indisponível", { status: 503 });
        }

        const urls = entries.map((e) =>
          [
            `  <url>`,
            `    <loc>${BASE_URL}${e.path}</loc>`,
            e.lastmod ? `    <lastmod>${e.lastmod}</lastmod>` : null,
            e.changefreq ? `    <changefreq>${e.changefreq}</changefreq>` : null,
            e.priority ? `    <priority>${e.priority}</priority>` : null,
            e.image ? `    <image:image><image:loc>${xmlEscape(e.image)}</image:loc></image:image>` : null,
            `  </url>`,
          ]
            .filter(Boolean)
            .join("\n"),
        );

        const xml = [
          `<?xml version="1.0" encoding="UTF-8"?>`,
          `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:image="http://www.google.com/schemas/sitemap-image/1.1">`,
          ...urls,
          `</urlset>`,
        ].join("\n");

        return new Response(xml, {
          headers: {
            "Content-Type": "application/xml",
            "Cache-Control": "public, max-age=3600",
          },
        });
      },
    },
  },
});
