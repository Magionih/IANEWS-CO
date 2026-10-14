import { createServerFn } from "@tanstack/react-start";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";

function serverClient() {
  return createClient<Database>(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_PUBLISHABLE_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } },
  );
}

export type ArticleRow = {
  id: string;
  slug: string;
  title: string;
  dek: string | null;
  why_it_matters: string | null;
  category: string;
  cover_image_url: string | null;
  source_name: string | null;
  source_url: string | null;
  author: string | null;
  read_minutes: number | null;
  published_at: string;
};

export type ArticleFull = ArticleRow & {
  body_markdown: string;
  views_count: number;
  seo_title: string | null;
  seo_description: string | null;
  tags: string[] | null;
  analysis_markdown: string | null;
  business_context: string | null;
  editorial_conclusion: string | null;
  business_impacts: string[] | null;
  sources: { name?: string; url?: string; published_at?: string | null }[] | null;
};

export const listRecentArticles = createServerFn({ method: "GET" }).handler(
  async (): Promise<ArticleRow[]> => {
    const supabase = serverClient();
    const { data, error } = await supabase
      .from("articles")
      .select(
        "id, slug, title, dek, why_it_matters, category, cover_image_url, source_name, source_url, author, read_minutes, published_at",
      )
      .order("published_at", { ascending: false })
      .limit(24);
    if (error) {
      console.error("[articles] list error", error);
      return [];
    }
    return (data ?? []) as ArticleRow[];
  },
);

export const getArticleBySlug = createServerFn({ method: "GET" })
  .inputValidator((data: { slug: string }) => data)
  .handler(async ({ data }): Promise<ArticleFull | null> => {
    const supabase = serverClient();
    const { data: row, error } = await supabase
      .from("articles")
      .select(
        "id, slug, title, dek, why_it_matters, category, cover_image_url, source_name, source_url, author, read_minutes, published_at, body_markdown, views_count, seo_title, seo_description, tags, analysis_markdown, business_context, editorial_conclusion, business_impacts, sources",
      )
      .eq("slug", data.slug)
      .maybeSingle();
    if (error) {
      console.error("[articles] detail error", error);
      return null;
    }
    return (row as unknown as ArticleFull) ?? null;
  });

export const listMostRead = createServerFn({ method: "GET" }).handler(
  async (): Promise<ArticleRow[]> => {
    const supabase = serverClient();
    const { data, error } = await supabase
      .from("articles")
      .select(
        "id, slug, title, dek, why_it_matters, category, cover_image_url, source_name, source_url, author, read_minutes, published_at",
      )
      .order("views_count", { ascending: false })
      .order("published_at", { ascending: false })
      .limit(6);
    if (error) {
      console.error("[articles] most read error", error);
      return [];
    }
    return (data ?? []) as ArticleRow[];
  },
);
export const listArticlesFiltered = createServerFn({ method: "GET" })
  .inputValidator((data: { q?: string; category?: string }) => data)
  .handler(async ({ data }): Promise<ArticleRow[]> => {
    const supabase = serverClient();
    let query = supabase
      .from("articles")
      .select(
        "id, slug, title, dek, why_it_matters, category, cover_image_url, source_name, source_url, author, read_minutes, published_at",
      )
      .order("published_at", { ascending: false })
      .limit(60);
    if (data.category && data.category !== "all") {
      query = query.eq("category", data.category);
    }
    const term = (data.q ?? "").trim();
    if (term) {
      const safe = term.replace(/[%,()]/g, " ");
      query = query.or(`title.ilike.%${safe}%,dek.ilike.%${safe}%`);
    }
    const { data: rows, error } = await query;
    if (error) {
      console.error("[articles] filtered error", error);
      return [];
    }
    return (rows ?? []) as ArticleRow[];
  });

/**
 * Retorna matérias relevantes para uma página-hub, filtrando por termos-chave
 * em título, resumo, tags e categoria.
 */
export const listArticlesForHub = createServerFn({ method: "GET" })
  .inputValidator((data: { terms: string[]; limit?: number }) => data)
  .handler(async ({ data }): Promise<ArticleRow[]> => {
    const supabase = serverClient();
    const { data: rows, error } = await supabase
      .from("articles")
      .select(
        "id, slug, title, dek, why_it_matters, category, cover_image_url, source_name, source_url, author, read_minutes, published_at, tags",
      )
      .order("published_at", { ascending: false })
      .limit(200);
    if (error) {
      console.error("[articles] hub error", error);
      return [];
    }
    const terms = (data.terms ?? []).map((t) => t.toLowerCase()).filter(Boolean);
    const limit = data.limit ?? 24;
    const matched = ((rows ?? []) as (ArticleRow & { tags?: string[] | null })[]).filter((row) => {
      const haystack = [
        row.title,
        row.dek ?? "",
        row.why_it_matters ?? "",
        row.category,
        (row.tags ?? []).join(" "),
      ]
        .join(" ")
        .toLowerCase();
      return terms.some((t) => haystack.includes(t));
    });
    return matched.slice(0, limit) as ArticleRow[];
  });
