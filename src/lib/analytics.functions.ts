import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type VisitRow = {
  id: string;
  path: string;
  title: string | null;
  referrer_host: string | null;
  utm_source: string | null;
  device: string;
  os: string;
  browser: string;
  country: string | null;
  visitor_hash: string;
  session_id: string;
  user_id: string | null;
  is_new_visitor: boolean;
  visited_at: string;
};

export type Bucket = { key: string; count: number };

export type SiteAnalytics = {
  totals: {
    pageviews: number;
    visitors: number;
    sessions: number;
    newVisitors: number;
    loggedVisits: number;
    pageviews24h: number;
    visitors24h: number;
    pageviews7d: number;
    visitors7d: number;
    pageviews30d: number;
    visitors30d: number;
    viewsPerSession: number;
    online: number;
  };
  byDay: { day: string; pageviews: number; visitors: number }[];
  byHour: Bucket[];
  topPages: (Bucket & { title: string | null })[];
  byReferrer: Bucket[];
  byDevice: Bucket[];
  byBrowser: Bucket[];
  byOs: Bucket[];
  byCountry: Bucket[];
  byUtm: Bucket[];
  recent: VisitRow[];
};

async function assertAdmin(supabase: any, userId: string) {
  const { data, error } = await supabase.from("user_roles").select("role").eq("user_id", userId);
  if (error) throw new Error(error.message);
  const roles = (data ?? []).map((r: { role: string }) => r.role);
  if (!roles.includes("admin")) throw new Error("Acesso restrito a administradores.");
}

function tally(values: (string | null | undefined)[], fallback = "direto"): Bucket[] {
  const map = new Map<string, number>();
  for (const raw of values) {
    const key = (raw ?? "").trim() || fallback;
    map.set(key, (map.get(key) ?? 0) + 1);
  }
  return [...map.entries()]
    .map(([key, count]) => ({ key, count }))
    .sort((a, b) => b.count - a.count);
}

export const getSiteAnalytics = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    await assertAdmin(supabase, userId);

    const since = new Date(Date.now() - 30 * 86400000).toISOString();
    const { data, error } = await supabase
      .from("site_visits")
      .select(
        "id, path, title, referrer_host, utm_source, device, os, browser, country, visitor_hash, session_id, user_id, is_new_visitor, visited_at",
      )
      .gte("visited_at", since)
      .order("visited_at", { ascending: false })
      .limit(20000);
    if (error) throw new Error(error.message);

    const visits = (data ?? []) as VisitRow[];
    const now = Date.now();
    const at = (v: VisitRow) => new Date(v.visited_at).getTime();
    const uniq = (rows: VisitRow[]) => new Set(rows.map((v) => v.visitor_hash)).size;

    const d1 = visits.filter((v) => now - at(v) < 86400000);
    const d7 = visits.filter((v) => now - at(v) < 7 * 86400000);
    const online = new Set(
      visits.filter((v) => now - at(v) < 5 * 60000).map((v) => v.visitor_hash),
    ).size;

    const dayMap = new Map<string, { pageviews: number; visitors: Set<string> }>();
    for (let i = 29; i >= 0; i -= 1) {
      dayMap.set(new Date(now - i * 86400000).toISOString().slice(0, 10), {
        pageviews: 0,
        visitors: new Set(),
      });
    }
    for (const v of visits) {
      const d = v.visited_at.slice(0, 10);
      const slot = dayMap.get(d);
      if (!slot) continue;
      slot.pageviews += 1;
      slot.visitors.add(v.visitor_hash);
    }

    const hourMap = new Map<string, number>();
    for (let h = 0; h < 24; h += 1) hourMap.set(String(h).padStart(2, "0"), 0);
    for (const v of d7) {
      const h = new Date(v.visited_at).getHours().toString().padStart(2, "0");
      hourMap.set(h, (hourMap.get(h) ?? 0) + 1);
    }

    const pageMap = new Map<string, { count: number; title: string | null }>();
    for (const v of visits) {
      const prev = pageMap.get(v.path);
      pageMap.set(v.path, { count: (prev?.count ?? 0) + 1, title: prev?.title ?? v.title });
    }

    const sessions = new Set(visits.map((v) => v.session_id || v.visitor_hash)).size;

    const analytics: SiteAnalytics = {
      totals: {
        pageviews: visits.length,
        visitors: uniq(visits),
        sessions,
        newVisitors: visits.filter((v) => v.is_new_visitor).length,
        loggedVisits: visits.filter((v) => v.user_id).length,
        pageviews24h: d1.length,
        visitors24h: uniq(d1),
        pageviews7d: d7.length,
        visitors7d: uniq(d7),
        pageviews30d: visits.length,
        visitors30d: uniq(visits),
        viewsPerSession: sessions ? Math.round((visits.length / sessions) * 10) / 10 : 0,
        online,
      },
      byDay: [...dayMap.entries()].map(([day, s]) => ({
        day,
        pageviews: s.pageviews,
        visitors: s.visitors.size,
      })),
      byHour: [...hourMap.entries()].map(([key, count]) => ({ key, count })),
      topPages: [...pageMap.entries()]
        .map(([key, s]) => ({ key, count: s.count, title: s.title }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 20),
      byReferrer: tally(visits.map((v) => v.referrer_host)).slice(0, 12),
      byDevice: tally(visits.map((v) => v.device)),
      byBrowser: tally(visits.map((v) => v.browser)).slice(0, 8),
      byOs: tally(visits.map((v) => v.os)).slice(0, 8),
      byCountry: tally(visits.map((v) => v.country), "desconhecido").slice(0, 10),
      byUtm: tally(visits.map((v) => v.utm_source)).slice(0, 8),
      recent: visits.slice(0, 60),
    };

    return analytics;
  });
