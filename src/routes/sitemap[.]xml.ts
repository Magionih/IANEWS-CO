import { createFileRoute } from "@tanstack/react-router";
import { createClient } from "@supabase/supabase-js";
import type {} from "@tanstack/react-start";
import { CATEGORY_SEO_LIST } from "@/lib/categories";

const BASE_URL = "https://ianews.site";

interface SitemapEntry {
  path: string;
  lastmod?: string;
  changefreq?: "always" | "hourly" | "daily" | "weekly" | "monthly" | "yearly" | "never";
  priority?: string;
}

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
          {
            path: "/guias/regulamentacao-da-ia-no-brasil",
            changefreq: "daily",
            priority: "0.8",
          },
          { path: "/guias/ia-para-pequenas-empresas", changefreq: "daily", priority: "0.8" },
          { path: "/guias/ia-no-atendimento-ao-cliente", changefreq: "daily", priority: "0.8" },
          { path: "/assinar", changefreq: "monthly", priority: "0.7" },
          { path: "/newsletter", changefreq: "daily", priority: "0.9" },
          ...CATEGORY_SEO_LIST.map((c) => ({
            path: `/categoria/${c.slug}`,
            changefreq: "daily" as const,
            priority: "0.8",
          })),
          { path: "/sobre", changefreq: "monthly", priority: "0.6" },
          { path: "/anuncie", changefreq: "monthly", priority: "0.5" },
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
              .select("slug, published_at")
              .order("published_at", { ascending: false })
              .order("slug", { ascending: true })
              .range(offset, offset + 999);
            if (error) throw error;
            const rows = (data ?? []) as { slug: string; published_at: string }[];
            for (const row of rows) {
              entries.push({
                path: `/materia/${encodeURIComponent(row.slug)}`,
                lastmod: new Date(row.published_at).toISOString(),
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
            `  </url>`,
          ]
            .filter(Boolean)
            .join("\n"),
        );

        const xml = [
          `<?xml version="1.0" encoding="UTF-8"?>`,
          `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">`,
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
