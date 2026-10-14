import { createServerFn } from "@tanstack/react-start";
import { createClient } from "@supabase/supabase-js";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { Database } from "@/integrations/supabase/types";

export type Lead = {
  id: string;
  email: string;
  full_name: string | null;
  phone: string | null;
  source: string;
  is_active: boolean;
  unsubscribed_at: string | null;
  created_at: string;
};

export type NewsletterSend = {
  id: string;
  subject: string;
  edition_date: string;
  status: string;
  recipients_count: number;
  delivered_count: number;
  failed_count: number;
  article_slugs: string[];
  triggered_by: string;
  error: string | null;
  started_at: string;
  finished_at: string | null;
};

const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

export type LeadContextInput = {
  email: string;
  full_name?: string;
  phone?: string;
  source?: string;
  placement?: string;
  variant?: string;
  articleSlug?: string | null;
  path?: string;
  utmSource?: string | null;
  utmMedium?: string | null;
  utmCampaign?: string | null;
};

export const subscribeLead = createServerFn({ method: "POST" })
  .inputValidator((input: LeadContextInput) => input)
  .handler(async ({ data }) => {
    const email = data.email.trim().toLowerCase();
    if (!EMAIL_RE.test(email) || email.length > 255) {
      throw new Error("Informe um e-mail válido.");
    }

    let country: string | null = null;
    try {
      const { getRequestHeader } = await import("@tanstack/react-start/server");
      country = getRequestHeader("cf-ipcountry") ?? null;
    } catch {
      country = null;
    }

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: existing } = await supabaseAdmin
      .from("leads")
      .select("id, email, full_name, source, confirm_token, created_at, confirmed_at")
      .eq("email", email)
      .maybeSingle();

    if (existing) {
      return {
        ok: true,
        alreadySubscribed: true,
        confirmed: !!(existing as { confirmed_at: string | null }).confirmed_at,
      };
    }

    const { data: inserted, error } = await supabaseAdmin
      .from("leads")
      .insert({
        email,
        full_name: data.full_name?.trim().slice(0, 160) || null,
        phone: data.phone?.trim().slice(0, 40) || null,
        source: (data.source ?? "site").slice(0, 40),
        cta_placement: data.placement?.slice(0, 80) ?? null,
        cta_variant: data.variant?.slice(0, 60) ?? null,
        article_slug: data.articleSlug?.slice(0, 200) ?? null,
        landing_path: data.path?.split("?")[0]?.slice(0, 300) ?? null,
        utm_source: data.utmSource?.slice(0, 120) ?? null,
        utm_medium: data.utmMedium?.slice(0, 120) ?? null,
        utm_campaign: data.utmCampaign?.slice(0, 120) ?? null,
        country: country && country !== "XX" ? country.slice(0, 4) : null,
      } as never)
      .select("id, email, full_name, source, confirm_token, created_at")
      .maybeSingle();

    if (error || !inserted) {
      console.error("[leads] insert error", error?.message);
      throw new Error("Não foi possível concluir a inscrição agora.");
    }

    const { sendWelcomeEmail } = await import("@/lib/lead-funnel.server");
    await sendWelcomeEmail(inserted as never);

    return { ok: true, alreadySubscribed: false, confirmed: false };
  });

export const confirmLead = createServerFn({ method: "POST" })
  .inputValidator((input: { token: string }) => input)
  .handler(async ({ data }) => {
    const token = data.token.trim();
    if (!/^[0-9a-f-]{36}$/i.test(token)) return { ok: false, email: null, already: false };
    const { confirmLeadByToken } = await import("@/lib/lead-funnel.server");
    return confirmLeadByToken(token);
  });

export const runLeadFollowUpNow = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context.supabase, context.userId);
    const { runLeadFollowUp } = await import("@/lib/lead-funnel.server");
    return runLeadFollowUp({});
  });


async function assertAdmin(supabase: any, userId: string) {
  const { data, error } = await supabase.from("user_roles").select("role").eq("user_id", userId);
  if (error) throw new Error(error.message);
  const roles = ((data ?? []) as { role: string }[]).map((r) => r.role);
  if (!roles.includes("admin")) throw new Error("Acesso restrito a administradores.");
}

export const getNewsletterData = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context.supabase, context.userId);
    const [leadsRes, sendsRes] = await Promise.all([
      context.supabase
        .from("leads")
        .select("id, email, full_name, phone, source, is_active, unsubscribed_at, created_at")
        .order("created_at", { ascending: false })
        .limit(1000),
      context.supabase
        .from("newsletter_sends")
        .select(
          "id, subject, edition_date, status, recipients_count, delivered_count, failed_count, article_slugs, triggered_by, error, started_at, finished_at",
        )
        .order("started_at", { ascending: false })
        .limit(50),
    ]);
    const leads = (leadsRes.data ?? []) as Lead[];
    const sends = (sendsRes.data ?? []) as NewsletterSend[];
    const weekAgo = Date.now() - 7 * 24 * 3600 * 1000;
    return {
      leads,
      sends,
      stats: {
        totalLeads: leads.length,
        activeLeads: leads.filter((l) => l.is_active && !l.unsubscribed_at).length,
        newThisWeek: leads.filter((l) => new Date(l.created_at).getTime() >= weekAgo).length,
        totalSends: sends.length,
        delivered: sends.reduce((s, x) => s + x.delivered_count, 0),
        failed: sends.reduce((s, x) => s + x.failed_count, 0),
      },
    };
  });

export const setLeadActive = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { id: string; is_active: boolean }) => input)
  .handler(async ({ data, context }) => {
    await assertAdmin(context.supabase, context.userId);
    const { error } = await context.supabase
      .from("leads")
      .update({
        is_active: data.is_active,
        unsubscribed_at: data.is_active ? null : new Date().toISOString(),
      } as never)
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const deleteLead = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { id: string }) => input)
  .handler(async ({ data, context }) => {
    await assertAdmin(context.supabase, context.userId);
    const { error } = await context.supabase.from("leads").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const sendNewsletterNow = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { limit?: number; testEmail?: string } | undefined) => input ?? {})
  .handler(async ({ data, context }) => {
    await assertAdmin(context.supabase, context.userId);
    const { runDailyNewsletter } = await import("@/lib/newsletter.server");
    return runDailyNewsletter({
      limit: data.limit ?? 5,
      testEmail: data.testEmail?.trim() || null,
      triggeredBy: data.testEmail ? "admin-test" : "admin",
    });
  });

export const previewNewsletter = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context.supabase, context.userId);
    const { renderNewsletterPreview } = await import("@/lib/newsletter.server");
    return renderNewsletterPreview();
  });
export const sendRankingNewsletterNow = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { limit?: number; testEmail?: string } | undefined) => input ?? {})
  .handler(async ({ data, context }) => {
    await assertAdmin(context.supabase, context.userId);
    const { runWeeklyRanking } = await import("@/lib/ranking-newsletter.server");
    return runWeeklyRanking({
      limit: data.limit ?? 8,
      testEmail: data.testEmail?.trim() || null,
      triggeredBy: data.testEmail ? "admin-ranking-test" : "admin-ranking",
    });
  });
