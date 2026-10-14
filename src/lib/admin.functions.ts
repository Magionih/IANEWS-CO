import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type AdminRole = "admin" | "editor" | "reader";

export type AdminArticle = {
  id: string;
  slug: string;
  title: string;
  dek: string | null;
  category: string;
  author: string | null;
  cover_image_url: string | null;
  source_name: string | null;
  source_url: string | null;
  read_minutes: number | null;
  views_count: number;
  quality_score: number | null;
  published_at: string;
};

export type AdminReader = {
  user_id: string;
  full_name: string;
  email: string;
  phone: string | null;
  created_at: string;
  roles: AdminRole[];
  articles_read: number;
  minutes_read: number;
  last_read_at: string | null;
  completion_rate: number;
  avg_scroll: number;
};

export type AdminIngestRun = {
  id: string;
  started_at: string;
  finished_at: string | null;
  status: string;
  imported_count: number;
  error: string | null;
};

async function assertAdmin(supabase: any, userId: string) {
  const { data, error } = await supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", userId);
  if (error) throw new Error(error.message);
  const roles = (data ?? []).map((r: { role: AdminRole }) => r.role);
  if (!roles.includes("admin")) throw new Error("Acesso restrito a administradores.");
  return roles as AdminRole[];
}

export const getMyRoles = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data } = await context.supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", context.userId);
    const roles = ((data ?? []) as { role: AdminRole }[]).map((r) => r.role);
    return { roles, isAdmin: roles.includes("admin"), isEditor: roles.includes("editor") };
  });

export const getAdminData = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    await assertAdmin(supabase, userId);

    const [articlesRes, profilesRes, rolesRes, eventsRes, goalsRes, runsRes] = await Promise.all([
      supabase
        .from("articles")
        .select(
          "id, slug, title, dek, category, author, cover_image_url, source_name, source_url, read_minutes, views_count, quality_score, published_at",
        )
        .order("published_at", { ascending: false })
        .limit(300),
      supabase
        .from("profiles")
        .select("user_id, full_name, email, phone, created_at")
        .order("created_at", { ascending: false })
        .limit(500),
      supabase.from("user_roles").select("user_id, role"),
      supabase
        .from("reading_events")
        .select(
          "user_id, category, minutes, read_at, article_title, article_slug, seconds_read, scroll_pct, completed",
        )
        .order("read_at", { ascending: false })
        .limit(1000),
      supabase.from("reading_goals").select("user_id, weekly_articles, weekly_minutes"),
      supabase
        .from("ingest_runs")
        .select("id, started_at, finished_at, status, imported_count, error")
        .order("started_at", { ascending: false })
        .limit(20),
    ]);

    const articles = (articlesRes.data ?? []) as AdminArticle[];
    const rolesByUser = new Map<string, AdminRole[]>();
    for (const r of (rolesRes.data ?? []) as { user_id: string; role: AdminRole }[]) {
      rolesByUser.set(r.user_id, [...(rolesByUser.get(r.user_id) ?? []), r.role]);
    }

    const events = (eventsRes.data ?? []) as {
      user_id: string;
      category: string;
      minutes: number;
      read_at: string;
      article_title: string;
      article_slug: string;
      seconds_read: number;
      scroll_pct: number;
      completed: boolean;
    }[];

    const readers: AdminReader[] = (
      (profilesRes.data ?? []) as {
        user_id: string;
        full_name: string;
        email: string;
        phone: string | null;
        created_at: string;
      }[]
    ).map((p) => {
      const mine = events.filter((e) => e.user_id === p.user_id);
      return {
        ...p,
        roles: rolesByUser.get(p.user_id) ?? ["reader"],
        articles_read: mine.length,
        minutes_read: mine.reduce((sum, e) => sum + (e.minutes ?? 0), 0),
        last_read_at: mine[0]?.read_at ?? null,
        completion_rate: mine.length
          ? Math.round((mine.filter((e) => e.completed).length / mine.length) * 100)
          : 0,
        avg_scroll: mine.length
          ? Math.round(mine.reduce((s, e) => s + (e.scroll_pct ?? 0), 0) / mine.length)
          : 0,
      };
    });

    const byCategory = new Map<string, number>();
    for (const a of articles) byCategory.set(a.category, (byCategory.get(a.category) ?? 0) + 1);

    const weekAgo = Date.now() - 7 * 24 * 3600 * 1000;
    const weekEvents = events.filter((e) => new Date(e.read_at).getTime() >= weekAgo);

    return {
      articles,
      readers,
      runs: (runsRes.data ?? []) as AdminIngestRun[],
      recentEvents: events.slice(0, 30),
      goalsCount: (goalsRes.data ?? []).length,
      stats: {
        totalArticles: articles.length,
        totalViews: articles.reduce((s, a) => s + (a.views_count ?? 0), 0),
        totalReaders: readers.length,
        readsThisWeek: weekEvents.length,
        minutesThisWeek: weekEvents.reduce((s, e) => s + (e.minutes ?? 0), 0),
        completionRate: events.length
          ? Math.round((events.filter((e) => e.completed).length / events.length) * 100)
          : 0,
        avgScroll: events.length
          ? Math.round(events.reduce((s, e) => s + (e.scroll_pct ?? 0), 0) / events.length)
          : 0,
        categories: [...byCategory.entries()]
          .map(([name, count]) => ({ name, count }))
          .sort((a, b) => b.count - a.count),
      },
    };
  });

export const saveArticle = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (input: {
      id?: string;
      slug: string;
      title: string;
      dek: string;
      category: string;
      author: string;
      cover_image_url: string;
      source_name: string;
      source_url: string;
      read_minutes: number;
      body_markdown?: string;
      why_it_matters?: string;
    }) => input,
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context.supabase, context.userId);
    const payload: Record<string, unknown> = {
      slug: data.slug.trim().slice(0, 200),
      title: data.title.trim().slice(0, 300),
      dek: data.dek.trim().slice(0, 500) || null,
      category: data.category.trim().slice(0, 60) || "geral",
      author: data.author.trim().slice(0, 120) || "Redação IA News",
      cover_image_url: data.cover_image_url.trim() || null,
      source_name: data.source_name.trim().slice(0, 120) || null,
      source_url: data.source_url.trim() || null,
      read_minutes: Math.max(1, Math.min(60, Math.round(data.read_minutes || 3))),
    };
    if (data.body_markdown !== undefined) payload.body_markdown = data.body_markdown;
    if (data.why_it_matters !== undefined) payload.why_it_matters = data.why_it_matters || null;

    if (data.id) {
      const { error } = await context.supabase
        .from("articles")
        .update(payload as never)
        .eq("id", data.id);
      if (error) throw new Error(error.message);
      return { id: data.id };
    }
    const { data: inserted, error } = await context.supabase
      .from("articles")
      .insert({ ...payload, body_markdown: (data.body_markdown ?? "").trim() } as never)
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    return { id: (inserted as { id: string }).id };
  });

export const deleteArticle = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { id: string }) => input)
  .handler(async ({ data, context }) => {
    await assertAdmin(context.supabase, context.userId);
    const { error } = await context.supabase.from("articles").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const setUserRole = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { user_id: string; role: AdminRole }) => input)
  .handler(async ({ data, context }) => {
    await assertAdmin(context.supabase, context.userId);
    if (data.user_id === context.userId && data.role !== "admin") {
      throw new Error("Você não pode remover seu próprio acesso de administrador.");
    }
    const { error: delError } = await context.supabase
      .from("user_roles")
      .delete()
      .eq("user_id", data.user_id);
    if (delError) throw new Error(delError.message);
    const { error } = await context.supabase
      .from("user_roles")
      .insert({ user_id: data.user_id, role: data.role });
    if (error) throw new Error(error.message);
    return { ok: true };
  });
