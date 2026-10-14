import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type AdSegmentRow = {
  key: string;
  requests: number;
  impressions: number;
  viewables: number;
  clicks: number;
  ctr: number;
  viewability: number;
  fillRate: number;
  avgVisibleMs: number;
};

export type AdMetricsData = {
  totals: {
    requests: number;
    impressions: number;
    viewables: number;
    clicks: number;
    unfilled: number;
    ctr: number;
    viewability: number;
    fillRate: number;
    avgVisibleMs: number;
  };
  byPage: AdSegmentRow[];
  byBlock: AdSegmentRow[];
  byArticle: AdSegmentRow[];
  byCountry: AdSegmentRow[];
  daily: { date: string; impressions: number; viewables: number; clicks: number; ctr: number }[];
};

type Row = {
  event: string;
  ad_name: string;
  page: string;
  article_slug: string | null;
  country: string | null;
  visible_ms: number;
  created_at: string;
};

type Bucket = {
  requests: number;
  impressions: number;
  viewables: number;
  clicks: number;
  unfilled: number;
  visibleMs: number;
  visibleSamples: number;
};

const emptyBucket = (): Bucket => ({
  requests: 0,
  impressions: 0,
  viewables: 0,
  clicks: 0,
  unfilled: 0,
  visibleMs: 0,
  visibleSamples: 0,
});

function add(bucket: Bucket, row: Row) {
  if (row.event === "request") bucket.requests += 1;
  if (row.event === "impression") bucket.impressions += 1;
  if (row.event === "unfilled" || row.event === "blocked") bucket.unfilled += 1;
  if (row.event === "click") bucket.clicks += 1;
  if (row.event === "viewable") {
    bucket.viewables += 1;
    if (row.visible_ms > 0) {
      bucket.visibleMs += row.visible_ms;
      bucket.visibleSamples += 1;
    }
  }
}

const pct = (a: number, b: number) => (b > 0 ? Math.round((a / b) * 1000) / 10 : 0);

function toRow(key: string, b: Bucket): AdSegmentRow {
  return {
    key,
    requests: b.requests,
    impressions: b.impressions,
    viewables: b.viewables,
    clicks: b.clicks,
    ctr: pct(b.clicks, b.impressions),
    viewability: pct(b.viewables, b.impressions),
    fillRate: pct(b.impressions, b.impressions + b.unfilled),
    avgVisibleMs: b.visibleSamples ? Math.round(b.visibleMs / b.visibleSamples) : 0,
  };
}

function group(rows: Row[], keyOf: (r: Row) => string | null) {
  const map = new Map<string, Bucket>();
  for (const row of rows) {
    const key = keyOf(row);
    if (!key) continue;
    const bucket = map.get(key) ?? emptyBucket();
    add(bucket, row);
    map.set(key, bucket);
  }
  return [...map.entries()]
    .map(([key, b]) => toRow(key, b))
    .sort((a, b) => b.impressions - a.impressions || b.clicks - a.clicks)
    .slice(0, 25);
}

export const getAdMetrics = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { days?: number } | undefined) => ({ days: input?.days ?? 30 }))
  .handler(async ({ data, context }): Promise<AdMetricsData> => {
    const { data: isAdmin } = await context.supabase.rpc("has_role", {
      _user_id: context.userId,
      _role: "admin",
    });
    if (!isAdmin) throw new Error("Forbidden");

    const since = new Date(Date.now() - data.days * 86400_000).toISOString();
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: raw } = await supabaseAdmin
      .from("ad_events")
      .select("event, ad_name, page, article_slug, country, visible_ms, created_at")
      .gte("created_at", since)
      .order("created_at", { ascending: false })
      .limit(50000);

    const rows = (raw ?? []) as Row[];
    const totals = emptyBucket();
    rows.forEach((r) => add(totals, r));

    const dailyMap = new Map<string, Bucket>();
    for (const row of rows) {
      const date = row.created_at.slice(0, 10);
      const bucket = dailyMap.get(date) ?? emptyBucket();
      add(bucket, row);
      dailyMap.set(date, bucket);
    }

    return {
      totals: {
        requests: totals.requests,
        impressions: totals.impressions,
        viewables: totals.viewables,
        clicks: totals.clicks,
        unfilled: totals.unfilled,
        ctr: pct(totals.clicks, totals.impressions),
        viewability: pct(totals.viewables, totals.impressions),
        fillRate: pct(totals.impressions, totals.impressions + totals.unfilled),
        avgVisibleMs: totals.visibleSamples
          ? Math.round(totals.visibleMs / totals.visibleSamples)
          : 0,
      },
      byPage: group(rows, (r) => r.page),
      byBlock: group(rows, (r) => r.ad_name),
      byArticle: group(rows, (r) => r.article_slug),
      byCountry: group(rows, (r) => r.country ?? "—"),
      daily: [...dailyMap.entries()]
        .sort((a, b) => (a[0] < b[0] ? -1 : 1))
        .slice(-30)
        .map(([date, b]) => ({
          date,
          impressions: b.impressions,
          viewables: b.viewables,
          clicks: b.clicks,
          ctr: pct(b.clicks, b.impressions),
        })),
    };
  });
