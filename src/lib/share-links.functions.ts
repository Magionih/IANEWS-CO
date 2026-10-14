import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type ShareChannel =
  | "instagram_stories"
  | "instagram_bio"
  | "instagram_post"
  | "whatsapp"
  | "linkedin"
  | "newsletter"
  | "outro";

export type ShareLink = {
  id: string;
  code: string;
  article_slug: string;
  article_title: string;
  channel: string;
  campaign: string;
  label: string;
  is_active: boolean;
  clicks_count: number;
  unique_visitors: number;
  last_click_at: string | null;
  created_at: string;
};

export type ShareClick = {
  id: string;
  code: string;
  article_slug: string;
  device: string;
  os: string;
  browser: string;
  country: string | null;
  referrer: string | null;
  is_new_visitor: boolean;
  clicked_at: string;
};

export type ShareStats = {
  totalLinks: number;
  totalClicks: number;
  uniqueVisitors: number;
  clicks7d: number;
  clicks24h: number;
  byDevice: { key: string; count: number }[];
  byChannel: { key: string; count: number }[];
  byDay: { day: string; count: number }[];
};

async function assertAdmin(supabase: any, userId: string) {
  const { data, error } = await supabase.from("user_roles").select("role").eq("user_id", userId);
  if (error) throw new Error(error.message);
  const roles = (data ?? []).map((r: { role: string }) => r.role);
  if (!roles.includes("admin")) throw new Error("Acesso restrito a administradores.");
}

const ALPHABET = "abcdefghijkmnpqrstuvwxyz23456789";
function makeCode(len = 7) {
  let out = "";
  for (let i = 0; i < len; i += 1) out += ALPHABET[Math.floor(Math.random() * ALPHABET.length)];
  return out;
}

function slugifyCampaign(v: string) {
  return v
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 40);
}

export const getShareLinks = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    await assertAdmin(supabase, userId);

    const [linksRes, clicksRes] = await Promise.all([
      supabase
        .from("share_links")
        .select(
          "id, code, article_slug, article_title, channel, campaign, label, is_active, clicks_count, unique_visitors, last_click_at, created_at",
        )
        .order("created_at", { ascending: false })
        .limit(500),
      supabase
        .from("share_link_clicks")
        .select("id, code, article_slug, device, os, browser, country, referrer, is_new_visitor, clicked_at")
        .order("clicked_at", { ascending: false })
        .limit(500),
    ]);

    if (linksRes.error) throw new Error(linksRes.error.message);
    const links = (linksRes.data ?? []) as ShareLink[];
    const clicks = (clicksRes.data ?? []) as ShareClick[];

    const now = Date.now();
    const count = (arr: string[]) => {
      const map = new Map<string, number>();
      arr.forEach((k) => map.set(k, (map.get(k) ?? 0) + 1));
      return [...map.entries()]
        .map(([key, c]) => ({ key, count: c }))
        .sort((a, b) => b.count - a.count);
    };

    const dayMap = new Map<string, number>();
    for (let i = 13; i >= 0; i -= 1) {
      const d = new Date(now - i * 86400000).toISOString().slice(0, 10);
      dayMap.set(d, 0);
    }
    clicks.forEach((c) => {
      const d = c.clicked_at.slice(0, 10);
      if (dayMap.has(d)) dayMap.set(d, (dayMap.get(d) ?? 0) + 1);
    });

    const stats: ShareStats = {
      totalLinks: links.length,
      totalClicks: links.reduce((s, l) => s + l.clicks_count, 0),
      uniqueVisitors: links.reduce((s, l) => s + l.unique_visitors, 0),
      clicks7d: clicks.filter((c) => now - new Date(c.clicked_at).getTime() < 7 * 86400000).length,
      clicks24h: clicks.filter((c) => now - new Date(c.clicked_at).getTime() < 86400000).length,
      byDevice: count(clicks.map((c) => c.device)),
      byChannel: count(
        clicks
          .map((c) => links.find((l) => l.code === c.code)?.channel ?? "outro")
          .filter(Boolean) as string[],
      ),
      byDay: [...dayMap.entries()].map(([day, c]) => ({ day, count: c })),
    };

    return { links, clicks: clicks.slice(0, 120), stats };
  });

export const createShareLink = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { slug: string; channel: string; campaign?: string; label?: string }) => {
    if (!input?.slug) throw new Error("Selecione uma matéria.");
    return input;
  })
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await assertAdmin(supabase, userId);

    const { data: article, error: artErr } = await supabase
      .from("articles")
      .select("id, slug, title")
      .eq("slug", data.slug)
      .maybeSingle();
    if (artErr) throw new Error(artErr.message);
    if (!article) throw new Error("Matéria não encontrada.");

    const campaign = slugifyCampaign(data.campaign ?? "");
    const channel = data.channel || "instagram_stories";

    const { data: existing } = await supabase
      .from("share_links")
      .select("id, code")
      .eq("article_slug", article.slug)
      .eq("channel", channel)
      .eq("campaign", campaign)
      .maybeSingle();
    if (existing) return { code: existing.code as string, reused: true };

    let code = makeCode();
    for (let attempt = 0; attempt < 5; attempt += 1) {
      const { data: clash } = await supabase
        .from("share_links")
        .select("id")
        .eq("code", code)
        .maybeSingle();
      if (!clash) break;
      code = makeCode();
    }

    const { error } = await supabase.from("share_links").insert({
      code,
      article_id: article.id,
      article_slug: article.slug,
      article_title: article.title,
      channel,
      campaign,
      label: (data.label ?? "").slice(0, 120),
      created_by: userId,
    });
    if (error) throw new Error(error.message);

    return { code, reused: false };
  });

export const toggleShareLink = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { id: string; isActive: boolean }) => input)
  .handler(async ({ data, context }) => {
    await assertAdmin(context.supabase, context.userId);
    const { error } = await context.supabase
      .from("share_links")
      .update({ is_active: data.isActive })
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const deleteShareLink = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { id: string }) => input)
  .handler(async ({ data, context }) => {
    await assertAdmin(context.supabase, context.userId);
    const { error } = await context.supabase.from("share_links").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
