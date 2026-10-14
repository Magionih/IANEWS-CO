import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type ReadingEvent = {
  id: string;
  article_slug: string;
  article_title: string;
  category: string;
  minutes: number;
  read_at: string;
  seconds_read?: number;
  scroll_pct?: number;
  completed?: boolean;
};

export type ReadingGoals = {
  weekly_articles: number;
  weekly_minutes: number;
  daily_streak_goal: number;
};

export type ReadingProfile = {
  full_name: string;
  email: string;
  phone: string | null;
};

export const getReadingDashboard = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;

    const since = new Date(Date.now() - 60 * 24 * 3600 * 1000).toISOString();
    const [eventsRes, goalsRes, profileRes] = await Promise.all([
      supabase
        .from("reading_events")
        .select(
          "id, article_slug, article_title, category, minutes, read_at, seconds_read, scroll_pct, completed",
        )
        .gte("read_at", since)
        .order("read_at", { ascending: false })
        .limit(200),
      supabase
        .from("reading_goals")
        .select("weekly_articles, weekly_minutes, daily_streak_goal")
        .eq("user_id", userId)
        .maybeSingle(),
      supabase
        .from("profiles")
        .select("full_name, email, phone")
        .eq("user_id", userId)
        .maybeSingle(),
    ]);

    const events = (eventsRes.data ?? []) as ReadingEvent[];
    const goals: ReadingGoals =
      (goalsRes.data as ReadingGoals | null) ?? {
        weekly_articles: 10,
        weekly_minutes: 60,
        daily_streak_goal: 5,
      };
    const profile = (profileRes.data as ReadingProfile | null) ?? null;

    return { events, goals, profile };
  });

export const saveReadingGoals = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { weekly_articles: number; weekly_minutes: number }) => input)
  .handler(async ({ data, context }) => {
    const weekly_articles = Math.max(1, Math.min(100, Math.round(data.weekly_articles)));
    const weekly_minutes = Math.max(5, Math.min(2000, Math.round(data.weekly_minutes)));
    const { error } = await context.supabase.from("reading_goals").upsert(
      { user_id: context.userId, weekly_articles, weekly_minutes },
      { onConflict: "user_id" },
    );
    if (error) throw new Error(error.message);
    return { weekly_articles, weekly_minutes };
  });

export const recordReading = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (input: {
      slug: string;
      title: string;
      category: string;
      minutes: number;
      seconds?: number;
      scrollPct?: number;
      completed?: boolean;
      device?: string;
    }) => input,
  )
  .handler(async ({ data, context }) => {
    const slug = data.slug.slice(0, 200);
    const seconds = Math.max(0, Math.min(7200, Math.round(data.seconds ?? 0)));
    const scrollPct = Math.max(0, Math.min(100, Math.round(data.scrollPct ?? 0)));
    const minutes = Math.max(
      1,
      Math.min(60, seconds > 0 ? Math.ceil(seconds / 60) : Math.round(data.minutes) || 1),
    );
    const readDate = new Date().toISOString().slice(0, 10);

    const { data: existing } = await context.supabase
      .from("reading_events")
      .select("id, seconds_read, scroll_pct, minutes")
      .eq("user_id", context.userId)
      .eq("article_slug", slug)
      .eq("read_date", readDate)
      .maybeSingle();

    const row = existing as
      | { id: string; seconds_read: number; scroll_pct: number; minutes: number }
      | null;

    if (row) {
      const nextSeconds = Math.max(row.seconds_read ?? 0, seconds);
      const { error } = await context.supabase
        .from("reading_events")
        .update({
          seconds_read: nextSeconds,
          scroll_pct: Math.max(row.scroll_pct ?? 0, scrollPct),
          minutes: Math.max(row.minutes ?? 1, Math.max(1, Math.ceil(nextSeconds / 60))),
          completed: (data.completed ?? false) || scrollPct >= 85,
        })
        .eq("id", row.id);
      if (error) throw new Error(error.message);
      return { recorded: false, updated: true };
    }

    const { error } = await context.supabase.from("reading_events").insert({
      user_id: context.userId,
      article_slug: slug,
      article_title: data.title.slice(0, 300),
      category: data.category.slice(0, 60),
      minutes,
      seconds_read: seconds,
      scroll_pct: scrollPct,
      completed: (data.completed ?? false) || scrollPct >= 85,
      device: (data.device ?? "").slice(0, 30) || null,
      read_date: readDate,
    });
    if (error) throw new Error(error.message);

    try {
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
      await supabaseAdmin.rpc("increment_article_views", { _slug: slug });
    } catch (err) {
      console.error("[reading] views increment failed", err);
    }
    return { recorded: true, updated: false };
  });

export const saveProfile = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { full_name: string; email: string; phone: string }) => input)
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.from("profiles").upsert(
      {
        user_id: context.userId,
        full_name: data.full_name.trim().slice(0, 120),
        email: data.email.trim().slice(0, 255),
        phone: data.phone.trim().slice(0, 30) || null,
      },
      { onConflict: "user_id" },
    );
    if (error) throw new Error(error.message);
    return { ok: true };
  });