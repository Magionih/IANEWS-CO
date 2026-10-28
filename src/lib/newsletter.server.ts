import React from "react";
import { render } from "@react-email/render";
import { EmailAPIError, sendEmail, sendEmailBatch } from "@/lib/email.server";

import { supabaseAdmin } from "@/integrations/supabase/client.server";
import {
  DailyNewsletter,
  type NewsletterArticle,
  type NewsletterBrief,
  type NewsletterFeature,
  type NewsletterRankingAnalysis,
  type NewsletterRankItem,
} from "@/lib/newsletter-template";
import { NEWSLETTER_PREVIEW_ARTICLES } from "@/lib/email-templates/daily-newsletter";

export const SITE_URL = process.env.NEWSLETTER_SITE_URL?.trim() || "https://ianewsbr.com";
export const SENDER_DOMAIN = process.env.EMAIL_SENDER_DOMAIN?.trim() || "ianewsbr.com";
export const FROM_ADDRESS = process.env.EMAIL_FROM?.trim() || `IA News <news@${SENDER_DOMAIN}>`;
const REPLY_TO = process.env.EMAIL_REPLY_TO?.trim() || "magionih@gmail.com";

const ARTICLE_FIELDS = "slug, title, dek, category, why_it_matters, read_minutes, cover_image_url, published_at";
const MAX_ARTICLES = 20;

export type NewsletterRunOptions = {
  limit?: number;
  triggeredBy?: string;
  testEmail?: string | null;
};

export type NewsletterRunResult = {
  ok: boolean;
  sendId: string | null;
  subject: string;
  recipients: number;
  delivered: number;
  failed: number;
  message: string;
  skipped?: boolean;
};

/* ---------- datas no fuso de Brasília (UTC-3, sem horário de verão) ---------- */

const BRT_OFFSET_H = 3;

function brtParts(date = new Date()) {
  const d = new Date(date.getTime() - BRT_OFFSET_H * 3600 * 1000);
  return { y: d.getUTCFullYear(), m: d.getUTCMonth(), d: d.getUTCDate() };
}

/** Início do dia (00:00 em Brasília) em UTC. */
function brtDayStart(date = new Date()) {
  const p = brtParts(date);
  return new Date(Date.UTC(p.y, p.m, p.d, BRT_OFFSET_H, 0, 0));
}

export function brtDateISO(date = new Date()) {
  const p = brtParts(date);
  return `${p.y}-${String(p.m + 1).padStart(2, "0")}-${String(p.d).padStart(2, "0")}`;
}

function editionLabel(date = new Date()) {
  const s = date.toLocaleDateString("pt-BR", {
    weekday: "long",
    day: "numeric",
    month: "long",
    timeZone: "America/Sao_Paulo",
  });
  return s.charAt(0).toUpperCase() + s.slice(1);
}

/** Top do Ranking IA para o bloco da newsletter (falha silenciosa: a edição sai sem o bloco). */
async function rankingTop(): Promise<NewsletterRankItem[]> {
  try {
    const { data } = await supabaseAdmin
      .from("ai_tools")
      .select("name, maker, rank_position, previous_position, weekly_score")
      .eq("is_active", true)
      .not("rank_position", "is", null)
      .order("rank_position", { ascending: true })
      .limit(3);
    return ((data ?? []) as { name: string; maker: string | null; rank_position: number; previous_position: number | null; weekly_score: number | null }[]).map((r) => ({
      name: r.name,
      maker: r.maker,
      position: r.rank_position,
      previous: r.previous_position,
      score: r.weekly_score,
    }));
  } catch {
    return [];
  }
}

/* ---------- seleção das matérias ---------- */

/**
 * Matérias publicadas ontem (00:00–23:59 de Brasília). Se ontem não houve matéria,
 * usa as das últimas 72h que ainda não foram em nenhuma edição — nunca repete edição.
 */
export async function articlesForEdition(now = new Date(), limit = MAX_ARTICLES) {
  const todayStart = brtDayStart(now);
  const yesterdayStart = new Date(todayStart.getTime() - 24 * 3600 * 1000);

  const { data, error } = await supabaseAdmin
    .from("articles")
    .select(ARTICLE_FIELDS)
    .eq("status", "published")
    .lte("published_at", new Date().toISOString())
    .gte("published_at", yesterdayStart.toISOString())
    .lt("published_at", todayStart.toISOString())
    .or("origin.is.null,origin.neq.newsletter")
    .order("published_at", { ascending: false })
    .limit(limit);
  if (error) throw new Error(`Falha ao carregar matérias: ${error.message}`);
  if (data && data.length > 0) return { articles: data as NewsletterArticle[], window: "ontem" as const };

  const since = new Date(todayStart.getTime() - 72 * 3600 * 1000);
  const [{ data: recent }, { data: lastSends }] = await Promise.all([
    supabaseAdmin
      .from("articles")
      .select(ARTICLE_FIELDS)
    .eq("status", "published")
    .lte("published_at", new Date().toISOString())
      .gte("published_at", since.toISOString())
      .lt("published_at", todayStart.toISOString())
      .or("origin.is.null,origin.neq.newsletter")
      .order("published_at", { ascending: false })
      .limit(limit * 2),
    supabaseAdmin
      .from("newsletter_sends")
      .select("article_slugs")
      .in("status", ["sent", "partial"])
      .gte("created_at", new Date(since.getTime() - 24 * 3600 * 1000).toISOString()),
  ]);
  const used = new Set(((lastSends ?? []) as { article_slugs: string[] | null }[]).flatMap((r) => r.article_slugs ?? []));
  const fresh = ((recent ?? []) as NewsletterArticle[]).filter((a) => !used.has(a.slug)).slice(0, limit);
  return { articles: fresh, window: "72h" as const };
}

/* ---------- curadoria do dia (tabela newsletter_editions) ---------- */

export type EditionExtras = {
  articlesWindow?: "ontem" | "recentes";
  feature: NewsletterFeature | null;
  briefs: NewsletterBrief[];
  ranking: NewsletterRankItem[];
  rankingAnalysis: NewsletterRankingAnalysis | null;
};

/** Lê a curadoria da data (Destaque, Em 30 segundos, Ranking). Sem curadoria, usa o Ranking do site. */
export async function loadEditionExtras(editionDate: string): Promise<EditionExtras> {
  type EditionRow = { destaque: any; briefs: any; ranking: any };
  let row = null as EditionRow | null;
  try {
    const { data } = await supabaseAdmin
      .from("newsletter_editions" as never)
      .select("destaque, briefs, ranking")
      .eq("edition_date", editionDate)
      .maybeSingle();
    row = (data as EditionRow | null) ?? null;
  } catch {
    row = null;
  }
  const d = row?.destaque;
  const feature: NewsletterFeature | null =
    d && typeof d.title === "string" && typeof d.url === "string"
      ? {
          title: String(d.title).slice(0, 220),
          dek: d.dek ?? null,
          why_it_matters: d.why_it_matters ?? null,
          category: d.category ?? null,
          image_url: typeof d.image_url === "string" && /^https:\/\//.test(d.image_url) ? d.image_url : null,
          image_credit: d.image_credit ?? null,
          url: String(d.url),
          source_name: d.source_name ?? null,
        }
      : null;
  const briefs: NewsletterBrief[] = Array.isArray(row?.briefs)
    ? (row!.briefs as any[])
        .filter((b) => b && typeof b.title === "string")
        .slice(0, 6)
        .map((b) => ({ title: String(b.title), summary: b.summary ?? null, source_name: b.source_name ?? null, url: typeof b.url === "string" ? b.url : null }))
    : [];
  const r = row?.ranking;
  const curatedItems: NewsletterRankItem[] = Array.isArray(r?.items)
    ? (r.items as any[]).slice(0, 3).map((it, i) => ({
        name: String(it.name ?? ""),
        maker: it.maker ?? null,
        position: Number(it.position ?? i + 1),
        previous: it.previous ?? null,
        score: null,
        note: it.note ?? null,
      }))
    : [];
  const rankingAnalysis: NewsletterRankingAnalysis | null =
    r && typeof r.analysis === "string"
      ? { analysis: r.analysis, source_name: r.source_name ?? null, source_url: r.source_url ?? null, as_of: r.as_of ?? null }
      : null;
  return {
    feature,
    briefs,
    ranking: curatedItems.length ? curatedItems : await rankingTop(),
    rankingAnalysis,
  };
}

/* ---------- renderização ---------- */

const NAME_TOKEN = "__IANEWS_NAME__";
const UNSUB_TOKEN = "__IANEWS_UNSUB__";

function escapeHtml(v: string) {
  return v.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
}

export const unsubscribeUrlFor = (token: string) => `${SITE_URL}/descadastrar?t=${token}`;
const oneClickUrlFor = (token: string) => `${SITE_URL}/api/public/unsubscribe?t=${token}`;

function plainText(articles: NewsletterArticle[], label: string, unsub: string, extras?: EditionExtras) {
  const lines = [`IANews — ${label}`, ""];
  if (extras?.feature) lines.push("DESTAQUE DA SEMANA", extras.feature.title, extras.feature.dek ?? "", extras.feature.url, "");
  if (extras?.briefs.length) {
    lines.push("EM 30 SEGUNDOS");
    extras.briefs.forEach((b, i) => lines.push(`${i + 1}. ${b.title}${b.summary ? ` ${b.summary}` : ""}${b.url ? ` ${b.url}` : ""}`));
    lines.push("");
  }
  if (articles.length) {
    lines.push("ONTEM NA IANEWS");
    articles.forEach((a, i) => lines.push(`${i + 1}. ${a.title}\n${a.dek ?? ""}\n${SITE_URL}/materia/${a.slug}\n`));
  }
  lines.push("", `Cancelar inscrição: ${unsub}`);
  return lines.join("\n");
}

async function renderVariants(articles: NewsletterArticle[], label: string, extras: EditionExtras) {
  const base = { editionLabel: label, siteUrl: SITE_URL, articles, unsubscribeUrl: UNSUB_TOKEN, ...extras };
  const [withName, noName] = await Promise.all([
    render(React.createElement(DailyNewsletter, { ...base, recipientName: NAME_TOKEN })),
    render(React.createElement(DailyNewsletter, { ...base, recipientName: null })),
  ]);
  return (name: string | null, token: string | null) => {
    const unsub = token ? unsubscribeUrlFor(token) : `${SITE_URL}/newsletter`;
    const html = (name ? withName.split(NAME_TOKEN).join(escapeHtml(name)) : noName).split(UNSUB_TOKEN).join(unsub);
    return { html, text: plainText(articles, label, unsub, extras) };
  };
}

/** Mensagens legíveis para os erros mais comuns do serviço de e-mail. */
function friendlyEmailError(err: unknown): string {
  if (err instanceof EmailAPIError) {
    if (err.code === "domain_not_verified") return "Domínio remetente não verificado no Resend.";
    if (err.code === "missing_api_key") return "RESEND_API_KEY não configurada.";
    if (err.code === "quota_exceeded") return "Cota diária/mensal do Resend esgotada.";
    if (err.status === 401 || err.status === 403) return "Chave do Resend inválida ou sem permissão.";
    if (err.status === 429) return `Limite de envio atingido. Tente em ${err.retryAfterSeconds ?? 60}s.`;
    return `Resend recusou o envio (${err.code ?? err.status}): ${err.message}`.slice(0, 300);
  }
  return err instanceof Error ? err.message : String(err);
}

function isFatal(err: unknown) {
  return (
    err instanceof EmailAPIError &&
    (["domain_not_verified", "missing_api_key", "quota_exceeded"].includes(err.code) ||
      err.status === 401 ||
      err.status === 403)
  );
}

/** HTML da newsletter para visualização no painel (usa as matérias de ontem ou as mais recentes). */
export async function renderNewsletterPreview(
  opts: { latest?: number; date?: string } = {},
): Promise<{ html: string; subject: string; live: boolean }> {
  // Data da edição (YYYY-MM-DD, Brasília). Edição de uma data = matérias do dia anterior + curadoria da data.
  const at = opts.date && /^\d{4}-\d{2}-\d{2}$/.test(opts.date) ? new Date(`${opts.date}T10:00:00Z`) : new Date();
  const label = editionLabel(at);
  const sel = opts.latest ? { articles: [] as NewsletterArticle[], window: "72h" as const } : await articlesForEdition(at);
  let articles = sel.articles;
  if (articles.length === 0) {
    const { data } = await supabaseAdmin
      .from("articles")
      .select(ARTICLE_FIELDS)
    .eq("status", "published")
    .lte("published_at", new Date().toISOString())
      .order("published_at", { ascending: false })
      .limit(Math.min(8, Math.max(1, opts.latest ?? 5)));
    articles = (data ?? []) as NewsletterArticle[];
  }
  const extras = { ...(await loadEditionExtras(brtDateISO(at))), articlesWindow: sel.window === "ontem" ? ("ontem" as const) : ("recentes" as const) };
  const live = articles.length > 0 || Boolean(extras.feature);
  if (!live) articles = NEWSLETTER_PREVIEW_ARTICLES;
  const html = await render(
    React.createElement(DailyNewsletter, {
      ...extras,
      editionLabel: label,
      siteUrl: SITE_URL,
      articles,
      recipientName: null,
      unsubscribeUrl: `${SITE_URL}/newsletter`,
    }),
  );
  return { html, subject: subjectFor(articles, extras.feature), live };
}

function subjectFor(articles: NewsletterArticle[], feature?: NewsletterFeature | null) {
  const first = feature?.title ?? articles[0]?.title ?? "As notícias de IA de ontem";
  const others = feature ? articles.length : articles.length - 1;
  const more = others > 0 ? ` (+${others})` : "";
  return `${first}${more}`.slice(0, 180);
}

/* ---------- envio ---------- */

export async function runDailyNewsletter(options: NewsletterRunOptions = {}): Promise<NewsletterRunResult> {
  const limit = Math.max(1, Math.min(25, options.limit ?? MAX_ARTICLES));
  const triggeredBy = options.triggeredBy ?? "cron";
  const now = new Date();
  const label = editionLabel(now);
  const editionDate = brtDateISO(now);
  const empty = (message: string, extra: Partial<NewsletterRunResult> = {}): NewsletterRunResult => ({
    ok: false,
    sendId: null,
    subject: "",
    recipients: 0,
    delivered: 0,
    failed: 0,
    message,
    ...extra,
  });

  let articles: NewsletterArticle[];
  let windowKind: "ontem" | "recentes" = "ontem";
  try {
    const sel = await articlesForEdition(now, limit);
    articles = sel.articles;
    windowKind = sel.window === "ontem" ? "ontem" : "recentes";
  } catch (err) {
    return empty(err instanceof Error ? err.message : String(err));
  }
  if (articles.length === 0 && options.testEmail) {
    const { data } = await supabaseAdmin.from("articles").select(ARTICLE_FIELDS)
    .eq("status", "published")
    .lte("published_at", new Date().toISOString()).order("published_at", { ascending: false }).limit(limit);
    articles = (data ?? []) as NewsletterArticle[];
  }
  const extras = { ...(await loadEditionExtras(editionDate)), articlesWindow: windowKind };
  if (articles.length === 0 && !extras.feature) {
    return empty("Nenhuma matéria nova desde a última edição e sem curadoria do dia. Edição não enviada.", { ok: true, skipped: true });
  }

  const subject = subjectFor(articles, extras.feature);
  const apiKey = process.env.RESEND_API_KEY;
  const build = await renderVariants(articles, label, extras);

  // Envio de teste: um único e-mail, sem registro de edição.
  if (options.testEmail) {
    if (!apiKey) return empty("RESEND_API_KEY não configurada.", { subject });
    try {
      const { html, text } = build(null, null);
      await sendEmail({ to: options.testEmail, from: FROM_ADDRESS, subject: `[Teste] ${subject}`, html, text, reply_to: REPLY_TO, label: "daily-newsletter-test" }, { apiKey });
      return { ok: true, sendId: null, subject, recipients: 1, delivered: 1, failed: 0, message: `Teste enviado para ${options.testEmail}.` };
    } catch (err) {
      return empty(friendlyEmailError(err), { subject, recipients: 1, failed: 1 });
    }
  }

  const { data: leads, error: leadsError } = await supabaseAdmin
    .from("leads")
    .select("id, email, full_name, confirm_token")
    .eq("is_active", true)
    .is("unsubscribed_at", null)
    .order("created_at", { ascending: true })
    .limit(20000);
  if (leadsError) return empty(`Falha ao carregar assinantes: ${leadsError.message}`, { subject });
  const recipients = (leads ?? []) as { id: string; email: string; full_name: string | null; confirm_token: string | null }[];

  // Registra a edição. Para o envio automático, o índice único garante uma edição por dia.
  const { data: sendRow, error: sendError } = await supabaseAdmin
    .from("newsletter_sends")
    .insert({
      subject,
      status: "running",
      kind: "daily",
      edition_date: editionDate,
      recipients_count: recipients.length,
      article_slugs: articles.map((a) => a.slug),
      triggered_by: triggeredBy,
    } as never)
    .select("id")
    .single();
  if (sendError || !sendRow) {
    if (sendError?.code === "23505") {
      return empty(`A edição de ${label} já foi enviada.`, { ok: true, skipped: true, subject });
    }
    return empty(`Falha ao registrar o envio: ${sendError?.message ?? "desconhecido"}`, { subject });
  }
  const sendId = (sendRow as { id: string }).id;

  const finish = async (status: string, delivered: number, failed: number, error: string | null) => {
    await supabaseAdmin
      .from("newsletter_sends")
      .update({ status, delivered_count: delivered, failed_count: failed, error, finished_at: new Date().toISOString() })
      .eq("id", sendId);
  };

  if (!apiKey) {
    await finish("failed", 0, recipients.length, "RESEND_API_KEY não configurada.");
    return { ok: false, sendId, subject, recipients: recipients.length, delivered: 0, failed: recipients.length, message: "RESEND_API_KEY não configurada." };
  }
  if (recipients.length === 0) {
    await finish("sent", 0, 0, null);
    return { ok: true, sendId, subject, recipients: 0, delivered: 0, failed: 0, message: "Nenhum assinante ativo na base." };
  }

  let delivered = 0;
  let failed = 0;
  let fatal: string | null = null;

  for (let i = 0; i < recipients.length; i += 100) {
    const chunk = recipients.slice(i, i + 100);
    const log: { send_id: string; lead_id: string | null; email: string; status: string; reason: string | null }[] = [];
    if (fatal) {
      failed += chunk.length;
      for (const r of chunk) log.push({ send_id: sendId, lead_id: r.id, email: r.email, status: "failed", reason: fatal });
    } else {
      const emails = chunk.map((r) => {
        const { html, text } = build(r.full_name?.trim().split(/\s+/)[0] ?? null, r.confirm_token);
        const headers: Record<string, string> = {};
        if (r.confirm_token) {
          headers["List-Unsubscribe"] = `<${oneClickUrlFor(r.confirm_token)}>`;
          headers["List-Unsubscribe-Post"] = "List-Unsubscribe=One-Click";
        }
        return { to: r.email, from: FROM_ADDRESS, subject, html, text, reply_to: REPLY_TO, headers, label: "daily-newsletter" };
      });
      let attempt = 0;
      for (;;) {
        try {
          await sendEmailBatch(emails, { apiKey, idempotencyKey: `newsletter-${sendId}-${i}` });
          delivered += chunk.length;
          for (const r of chunk) log.push({ send_id: sendId, lead_id: r.id, email: r.email, status: "sent", reason: null });
          break;
        } catch (err) {
          const retryable = err instanceof EmailAPIError && (err.code === "rate_limited" || err.code === "network_error" || err.status >= 500);
          if (retryable && attempt < 3) {
            attempt += 1;
            const wait = err instanceof EmailAPIError && err.retryAfterSeconds ? err.retryAfterSeconds * 1000 : 1500 * attempt;
            await new Promise((r) => setTimeout(r, Math.min(wait, 10000)));
            continue;
          }
          const reason = friendlyEmailError(err);
          if (isFatal(err)) fatal = reason;
          failed += chunk.length;
          for (const r of chunk) log.push({ send_id: sendId, lead_id: r.id, email: r.email, status: "failed", reason: reason.slice(0, 500) });
          break;
        }
      }
    }
    if (log.length) await supabaseAdmin.from("newsletter_recipients").insert(log as never);
  }

  const status = delivered === 0 ? "failed" : failed === 0 ? "sent" : "partial";
  await finish(status, delivered, failed, fatal);
  return {
    ok: delivered > 0,
    sendId,
    subject,
    recipients: recipients.length,
    delivered,
    failed,
    message: fatal ? fatal : `${delivered} e-mails enviados, ${failed} falhas.`,
  };
}

/** Descadastra pelo token do e-mail. */
export async function unsubscribeByToken(token: string) {
  if (!/^[0-9a-f-]{36}$/i.test(token)) return { ok: false as const };
  const { data } = await supabaseAdmin.from("leads").select("id, unsubscribed_at").eq("confirm_token", token).maybeSingle();
  if (!data) return { ok: false as const };
  const row = data as { id: string; unsubscribed_at: string | null };
  if (!row.unsubscribed_at) {
    await supabaseAdmin
      .from("leads")
      .update({ is_active: false, unsubscribed_at: new Date().toISOString() } as never)
      .eq("id", row.id);
  }
  return { ok: true as const };
}
