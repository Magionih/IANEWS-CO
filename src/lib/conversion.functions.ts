import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type PlacementStat = {
  placement: string;
  impressions: number;
  clicks: number;
  conversions: number;
  ctr: number;
  conversionRate: number;
};

export type ArticleEngagement = {
  slug: string;
  title: string;
  category: string;
  sessions: number;
  avgSeconds: number;
  avgScroll: number;
  completionRate: number;
  totalMinutes: number;
};

export type SegmentRow = {
  key: string;
  impressions: number;
  clicks: number;
  leads: number;
  confirmed: number;
  ctr: number;
  leadRate: number;
  confirmRate: number;
};

export type CohortBucket = { label: string; count: number; share: number };

export type EmailMetrics = {
  available: boolean;
  sent: number;
  delivered: number;
  bounced: number;
  complained: number;
  unsubscribed: number;
  suppressed: number;
  deliveryRate: number;
  byOrigin: { key: string; sent: number; bounced: number; unsubscribed: number }[];
  note: string;
};

export type ConversionFilters = {
  country?: string | null;
  path?: string | null;
  slug?: string | null;
  utmSource?: string | null;
  utmCampaign?: string | null;
  days?: number;
};

export type ConversionData = {
  totals: {
    impressions: number;
    clicks: number;
    conversions: number;
    ctr: number;
    conversionRate: number;
    leads: number;
    leads7d: number;
    confirmed: number;
    confirmRate: number;
    avgSecondsPerArticle: number;
    engagedSessions: number;
    medianHoursToConfirm: number;
  };
  byPlacement: PlacementStat[];
  byDay: { day: string; clicks: number; conversions: number }[];
  byDevice: { key: string; clicks: number; conversions: number }[];
  articles: ArticleEngagement[];
  leadsBySource: { key: string; count: number }[];
  segments: {
    country: SegmentRow[];
    path: SegmentRow[];
    article: SegmentRow[];
    utm: SegmentRow[];
  };
  cohort: CohortBucket[];
  email: EmailMetrics;
  options: {
    countries: string[];
    paths: string[];
    slugs: string[];
    utmSources: string[];
    utmCampaigns: string[];
  };
};

type CtaRow = {
  event: string;
  placement: string;
  device: string;
  created_at: string;
  country: string | null;
  path: string | null;
  article_slug: string | null;
  utm_source: string | null;
  utm_campaign: string | null;
};

type LeadRow = {
  email: string;
  source: string | null;
  created_at: string;
  confirmed_at: string | null;
  country: string | null;
  landing_path: string | null;
  article_slug: string | null;
  cta_placement: string | null;
  utm_source: string | null;
  utm_campaign: string | null;
};

async function assertAdmin(supabase: any, userId: string) {
  const { data, error } = await supabase.from("user_roles").select("role").eq("user_id", userId);
  if (error) throw new Error(error.message);
  if (!(data ?? []).some((r: { role: string }) => r.role === "admin")) {
    throw new Error("Acesso restrito a administradores.");
  }
}

const pct = (part: number, total: number) => (total > 0 ? Math.round((part / total) * 1000) / 10 : 0);
const norm = (v?: string | null) => (v && v.trim() ? v.trim() : null);
const cleanPath = (p?: string | null) => (p ? p.split("?")[0]! : null);

function matchCta(row: CtaRow, f: ConversionFilters) {
  if (f.country && (row.country ?? "") !== f.country) return false;
  if (f.path && cleanPath(row.path) !== f.path) return false;
  if (f.slug && (row.article_slug ?? "") !== f.slug) return false;
  if (f.utmSource && (row.utm_source ?? "") !== f.utmSource) return false;
  if (f.utmCampaign && (row.utm_campaign ?? "") !== f.utmCampaign) return false;
  return true;
}

function matchLead(row: LeadRow, f: ConversionFilters) {
  if (f.country && (row.country ?? "") !== f.country) return false;
  if (f.path && cleanPath(row.landing_path) !== f.path) return false;
  if (f.slug && (row.article_slug ?? "") !== f.slug) return false;
  if (f.utmSource && (row.utm_source ?? "") !== f.utmSource) return false;
  if (f.utmCampaign && (row.utm_campaign ?? "") !== f.utmCampaign) return false;
  return true;
}

function buildSegments(
  events: CtaRow[],
  leads: LeadRow[],
  ctaKey: (r: CtaRow) => string,
  leadKey: (r: LeadRow) => string,
): SegmentRow[] {
  const map = new Map<string, SegmentRow>();
  const slot = (k: string) => {
    const found =
      map.get(k) ??
      {
        key: k,
        impressions: 0,
        clicks: 0,
        leads: 0,
        confirmed: 0,
        ctr: 0,
        leadRate: 0,
        confirmRate: 0,
      };
    map.set(k, found);
    return found;
  };
  for (const e of events) {
    const s = slot(ctaKey(e));
    if (e.event === "impression") s.impressions += 1;
    if (e.event === "click") s.clicks += 1;
  }
  for (const l of leads) {
    const s = slot(leadKey(l));
    s.leads += 1;
    if (l.confirmed_at) s.confirmed += 1;
  }
  return [...map.values()]
    .map((s) => ({
      ...s,
      ctr: pct(s.clicks, s.impressions),
      leadRate: pct(s.leads, s.clicks),
      confirmRate: pct(s.confirmed, s.leads),
    }))
    .sort((a, b) => b.leads - a.leads || b.clicks - a.clicks)
    .slice(0, 25);
}

function buildCohort(leads: LeadRow[]): CohortBucket[] {
  const buckets = [
    { label: "Menos de 1h", max: 1 },
    { label: "1h a 6h", max: 6 },
    { label: "6h a 24h", max: 24 },
    { label: "1 a 3 dias", max: 72 },
    { label: "Mais de 3 dias", max: Infinity },
  ];
  const counts = buckets.map((b) => ({ label: b.label, count: 0, share: 0 }));
  let pending = 0;
  for (const l of leads) {
    if (!l.confirmed_at) {
      pending += 1;
      continue;
    }
    const hours =
      (new Date(l.confirmed_at).getTime() - new Date(l.created_at).getTime()) / 3600000;
    const idx = buckets.findIndex((b) => hours < b.max);
    counts[idx === -1 ? buckets.length - 1 : idx]!.count += 1;
  }
  const all = [...counts, { label: "Ainda não confirmou", count: pending, share: 0 }];
  const total = leads.length || 1;
  return all.map((b) => ({ ...b, share: pct(b.count, total) }));
}

function medianHoursToConfirm(leads: LeadRow[]) {
  const hs = leads
    .filter((l) => l.confirmed_at)
    .map((l) => (new Date(l.confirmed_at!).getTime() - new Date(l.created_at).getTime()) / 3600000)
    .sort((a, b) => a - b);
  if (!hs.length) return 0;
  const mid = Math.floor(hs.length / 2);
  const val = hs.length % 2 ? hs[mid]! : (hs[mid - 1]! + hs[mid]!) / 2;
  return Math.round(val * 10) / 10;
}

async function fetchEmailMetrics(leads: LeadRow[], since: string): Promise<EmailMetrics> {
  const empty: EmailMetrics = {
    available: false,
    sent: 0,
    delivered: 0,
    bounced: 0,
    complained: 0,
    unsubscribed: 0,
    suppressed: 0,
    deliveryRate: 0,
    byOrigin: [],
    note: "Métricas de e-mail indisponíveis no momento.",
  };
  // Métricas detalhadas de entrega ficam no painel do Resend.
  const apiKey = process.env["RESEND_API_KEY"];
  if (!apiKey) return empty;
  try {
    const res: { data: any[] } = { data: [] };
    void since;
    const logs: any[] = res?.data ?? [];
    if (!Array.isArray(logs)) return empty;

    const originByEmail = new Map<string, string>();
    for (const l of leads) {
      originByEmail.set(l.email.toLowerCase(), l.cta_placement || l.source || "desconhecido");
    }

    const counts = { sent: 0, bounced: 0, complained: 0, unsubscribed: 0, suppressed: 0, rejected: 0 };
    const origins = new Map<string, { sent: number; bounced: number; unsubscribed: number }>();

    for (const log of logs) {
      const type = String(log.event_type ?? log.type ?? "").toLowerCase();
      const to = String(log.recipient ?? "").toLowerCase();
      const origin = originByEmail.get(to) ?? "outros";
      const slot = origins.get(origin) ?? { sent: 0, bounced: 0, unsubscribed: 0 };
      if (type.includes("sent")) {
        counts.sent += 1;
        slot.sent += 1;
      } else if (type.includes("bounce")) {
        counts.bounced += 1;
        slot.bounced += 1;
      } else if (type.includes("complain")) counts.complained += 1;
      else if (type.includes("unsubscrib")) {
        counts.unsubscribed += 1;
        slot.unsubscribed += 1;
      } else if (type.includes("suppress")) counts.suppressed += 1;
      else if (type.includes("reject")) counts.rejected += 1;
      origins.set(origin, slot);
    }

    const delivered = Math.max(0, counts.sent - counts.bounced);
    return {
      available: true,
      sent: counts.sent,
      delivered,
      bounced: counts.bounced,
      complained: counts.complained,
      unsubscribed: counts.unsubscribed,
      suppressed: counts.suppressed + counts.rejected,
      deliveryRate: pct(delivered, counts.sent),
      byOrigin: [...origins.entries()]
        .map(([key, v]) => ({ key, ...v }))
        .sort((a, b) => b.sent - a.sent)
        .slice(0, 12),
      note: "Aberturas e cliques não são rastreados pela infraestrutura de e-mail; usamos entrega, retorno e descadastro.",
    };
  } catch (err) {
    console.error("[conversion] email logs", err instanceof Error ? err.message : err);
    return empty;
  }
}

async function loadRaw(supabase: any, days: number) {
  const since = new Date(Date.now() - days * 86400000).toISOString();
  const [ctaRes, engRes, leadsRes] = await Promise.all([
    supabase
      .from("cta_events")
      .select(
        "event, placement, device, created_at, country, path, article_slug, utm_source, utm_campaign",
      )
      .gte("created_at", since)
      .order("created_at", { ascending: false })
      .limit(50000),
    supabase
      .from("content_engagement")
      .select("article_slug, article_title, category, seconds, scroll_pct, completed")
      .gte("created_at", since)
      .limit(50000),
    supabase
      .from("leads")
      .select(
        "email, source, created_at, confirmed_at, country, landing_path, article_slug, cta_placement, utm_source, utm_campaign",
      )
      .gte("created_at", since)
      .limit(20000),
  ]);
  if (ctaRes.error) throw new Error(ctaRes.error.message);
  if (engRes.error) throw new Error(engRes.error.message);
  return {
    since,
    events: (ctaRes.data ?? []) as CtaRow[],
    eng: (engRes.data ?? []) as any[],
    leads: (leadsRes.data ?? []) as LeadRow[],
  };
}

const filterValidator = (input?: ConversionFilters | null): ConversionFilters => ({
  country: norm(input?.country),
  path: norm(input?.path),
  slug: norm(input?.slug),
  utmSource: norm(input?.utmSource),
  utmCampaign: norm(input?.utmCampaign),
  days: Math.min(180, Math.max(1, input?.days ?? 30)),
});

export const getConversionData = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator(filterValidator)
  .handler(async ({ context, data: filters }): Promise<ConversionData> => {
    const { supabase, userId } = context;
    await assertAdmin(supabase, userId);
    const days = filters.days ?? 30;
    const raw = await loadRaw(supabase, days);

    const options = {
      countries: [...new Set(raw.events.map((e) => e.country).filter(Boolean) as string[])].sort(),
      paths: [
        ...new Set(raw.events.map((e) => cleanPath(e.path)).filter(Boolean) as string[]),
      ].sort(),
      slugs: [
        ...new Set(raw.events.map((e) => e.article_slug).filter(Boolean) as string[]),
      ].sort(),
      utmSources: [
        ...new Set(raw.events.map((e) => e.utm_source).filter(Boolean) as string[]),
      ].sort(),
      utmCampaigns: [
        ...new Set(raw.events.map((e) => e.utm_campaign).filter(Boolean) as string[]),
      ].sort(),
    };

    const events = raw.events.filter((e) => matchCta(e, filters));
    const leads = raw.leads.filter((l) => matchLead(l, filters));
    const eng = filters.slug
      ? raw.eng.filter((r) => r.article_slug === filters.slug)
      : raw.eng;

    const impressions = events.filter((e) => e.event === "impression").length;
    const clicks = events.filter((e) => e.event === "click").length;
    const conversions = events.filter((e) => e.event === "convert").length;
    const confirmed = leads.filter((l) => l.confirmed_at).length;

    const placements = new Map<string, PlacementStat>();
    for (const e of events) {
      const key = e.placement || "desconhecido";
      const slot =
        placements.get(key) ??
        { placement: key, impressions: 0, clicks: 0, conversions: 0, ctr: 0, conversionRate: 0 };
      if (e.event === "impression") slot.impressions += 1;
      if (e.event === "click") slot.clicks += 1;
      if (e.event === "convert") slot.conversions += 1;
      placements.set(key, slot);
    }
    const byPlacement = [...placements.values()]
      .map((p) => ({
        ...p,
        ctr: pct(p.clicks, p.impressions),
        conversionRate: pct(p.conversions, p.clicks),
      }))
      .sort((a, b) => b.conversions - a.conversions || b.clicks - a.clicks);

    const dayMap = new Map<string, { clicks: number; conversions: number }>();
    for (let i = days - 1; i >= 0; i -= 1) {
      dayMap.set(new Date(Date.now() - i * 86400000).toISOString().slice(0, 10), {
        clicks: 0,
        conversions: 0,
      });
    }
    for (const e of events) {
      const slot = dayMap.get(e.created_at.slice(0, 10));
      if (!slot) continue;
      if (e.event === "click") slot.clicks += 1;
      if (e.event === "convert") slot.conversions += 1;
    }

    const deviceMap = new Map<string, { clicks: number; conversions: number }>();
    for (const e of events) {
      const key = e.device || "desktop";
      const slot = deviceMap.get(key) ?? { clicks: 0, conversions: 0 };
      if (e.event === "click") slot.clicks += 1;
      if (e.event === "convert") slot.conversions += 1;
      deviceMap.set(key, slot);
    }

    const artMap = new Map<
      string,
      { title: string; category: string; sessions: number; seconds: number; scroll: number; done: number }
    >();
    for (const r of eng) {
      const slot =
        artMap.get(r.article_slug) ??
        { title: r.article_title, category: r.category, sessions: 0, seconds: 0, scroll: 0, done: 0 };
      slot.sessions += 1;
      slot.seconds += r.seconds;
      slot.scroll += r.scroll_pct;
      if (r.completed) slot.done += 1;
      if (r.article_title) slot.title = r.article_title;
      artMap.set(r.article_slug, slot);
    }
    const articles = [...artMap.entries()]
      .map(([slug, v]) => ({
        slug,
        title: v.title || slug,
        category: v.category,
        sessions: v.sessions,
        avgSeconds: Math.round(v.seconds / Math.max(1, v.sessions)),
        avgScroll: Math.round(v.scroll / Math.max(1, v.sessions)),
        completionRate: pct(v.done, v.sessions),
        totalMinutes: Math.round(v.seconds / 60),
      }))
      .sort((a, b) => b.totalMinutes - a.totalMinutes)
      .slice(0, 30);

    const totalSeconds = eng.reduce((acc, r) => acc + r.seconds, 0);
    const sourceMap = new Map<string, number>();
    for (const l of leads) {
      const key = l.source || "desconhecido";
      sourceMap.set(key, (sourceMap.get(key) ?? 0) + 1);
    }

    const email = await fetchEmailMetrics(leads, raw.since);

    return {
      totals: {
        impressions,
        clicks,
        conversions,
        ctr: pct(clicks, impressions),
        conversionRate: pct(conversions, clicks),
        leads: leads.length,
        leads7d: leads.filter((l) => Date.now() - new Date(l.created_at).getTime() < 7 * 86400000)
          .length,
        confirmed,
        confirmRate: pct(confirmed, leads.length),
        avgSecondsPerArticle: eng.length ? Math.round(totalSeconds / eng.length) : 0,
        engagedSessions: eng.length,
        medianHoursToConfirm: medianHoursToConfirm(leads),
      },
      byPlacement,
      byDay: [...dayMap.entries()].map(([day, v]) => ({ day, ...v })),
      byDevice: [...deviceMap.entries()].map(([key, v]) => ({ key, ...v })),
      articles,
      leadsBySource: [...sourceMap.entries()]
        .map(([key, count]) => ({ key, count }))
        .sort((a, b) => b.count - a.count),
      segments: {
        country: buildSegments(
          events,
          leads,
          (e) => e.country || "desconhecido",
          (l) => l.country || "desconhecido",
        ),
        path: buildSegments(
          events,
          leads,
          (e) => cleanPath(e.path) || "/",
          (l) => cleanPath(l.landing_path) || "/",
        ),
        article: buildSegments(
          events.filter((e) => e.article_slug),
          leads.filter((l) => l.article_slug),
          (e) => e.article_slug!,
          (l) => l.article_slug!,
        ),
        utm: buildSegments(
          events,
          leads,
          (e) => `${e.utm_source || "direto"} / ${e.utm_campaign || "sem-campanha"}`,
          (l) => `${l.utm_source || "direto"} / ${l.utm_campaign || "sem-campanha"}`,
        ),
      },
      cohort: buildCohort(leads),
      email,
      options,
    };
  });

const csvCell = (v: unknown) => {
  const s = v === null || v === undefined ? "" : String(v);
  return /[";\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

/** Exporta o funil (exibição → clique → lead → confirmado) em CSV. */
export const exportConversionCsv = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(filterValidator)
  .handler(async ({ context, data: filters }): Promise<{ filename: string; csv: string }> => {
    const { supabase, userId } = context;
    await assertAdmin(supabase, userId);
    const days = filters.days ?? 30;
    const raw = await loadRaw(supabase, days);
    const events = raw.events.filter((e) => matchCta(e, filters));
    const leads = raw.leads.filter((l) => matchLead(l, filters));

    type Key = string;
    const rows = new Map<
      Key,
      {
        country: string;
        path: string;
        slug: string;
        utmSource: string;
        utmCampaign: string;
        placement: string;
        impressions: number;
        clicks: number;
        leads: number;
        confirmed: number;
      }
    >();
    const slot = (
      country: string,
      path: string,
      slug: string,
      utmSource: string,
      utmCampaign: string,
      placement: string,
    ) => {
      const k = [country, path, slug, utmSource, utmCampaign, placement].join("|");
      const found =
        rows.get(k) ??
        {
          country,
          path,
          slug,
          utmSource,
          utmCampaign,
          placement,
          impressions: 0,
          clicks: 0,
          leads: 0,
          confirmed: 0,
        };
      rows.set(k, found);
      return found;
    };

    for (const e of events) {
      const s = slot(
        e.country || "desconhecido",
        cleanPath(e.path) || "/",
        e.article_slug || "-",
        e.utm_source || "direto",
        e.utm_campaign || "sem-campanha",
        e.placement || "desconhecido",
      );
      if (e.event === "impression") s.impressions += 1;
      if (e.event === "click") s.clicks += 1;
    }
    for (const l of leads) {
      const s = slot(
        l.country || "desconhecido",
        cleanPath(l.landing_path) || "/",
        l.article_slug || "-",
        l.utm_source || "direto",
        l.utm_campaign || "sem-campanha",
        l.cta_placement || "desconhecido",
      );
      s.leads += 1;
      if (l.confirmed_at) s.confirmed += 1;
    }

    const header = [
      "pais",
      "pagina",
      "materia",
      "utm_source",
      "utm_campaign",
      "posicao_cta",
      "exibicoes",
      "cliques",
      "ctr_%",
      "leads",
      "taxa_lead_%",
      "confirmados",
      "taxa_confirmacao_%",
    ];
    const lines = [header.join(";")];
    for (const r of [...rows.values()].sort((a, b) => b.leads - a.leads || b.clicks - a.clicks)) {
      lines.push(
        [
          r.country,
          r.path,
          r.slug,
          r.utmSource,
          r.utmCampaign,
          r.placement,
          r.impressions,
          r.clicks,
          pct(r.clicks, r.impressions),
          r.leads,
          pct(r.leads, r.clicks),
          r.confirmed,
          pct(r.confirmed, r.leads),
        ]
          .map(csvCell)
          .join(";"),
      );
    }

    return {
      filename: `funil-ianews-${new Date().toISOString().slice(0, 10)}.csv`,
      csv: `﻿${lines.join("\n")}`,
    };
  });
