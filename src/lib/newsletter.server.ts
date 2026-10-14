import React from "react";
import { render } from "@react-email/render";
import { sendLovableEmail, EmailAPIError } from "@lovable.dev/email-js";

import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { DailyNewsletter, type NewsletterArticle } from "@/lib/newsletter-template";
import { NEWSLETTER_PREVIEW_ARTICLES } from "@/lib/email-templates/daily-newsletter";

export const SITE_URL = process.env.NEWSLETTER_SITE_URL ?? "https://ianews.site";
export const SENDER_DOMAIN = process.env.EMAIL_SENDER_DOMAIN ?? "notify.ianews.site";
export const FROM_ADDRESS = process.env.EMAIL_FROM ?? `IA News <news@${SENDER_DOMAIN}>`;

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
};

function editionLabel(date = new Date()) {
  return date.toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "long",
    year: "numeric",
    timeZone: "America/Sao_Paulo",
  });
}

function plainText(articles: NewsletterArticle[], label: string) {
  return [
    `IA News — edição de ${label}`,
    "",
    ...articles.map(
      (a, i) =>
        `${i + 1}. ${a.title}\n${a.dek ?? ""}\n${SITE_URL}/materia/${a.slug}\n`,
    ),
  ].join("\n");
}

/** Mensagens legíveis para os erros mais comuns do serviço de e-mail. */
function friendlyEmailError(err: unknown): string {
  if (err instanceof EmailAPIError) {
    if (err.code === "domain_not_verified")
      return "O domínio remetente (notify.ianews.site) ainda está em verificação de DNS. Os envios começam automaticamente assim que a verificação concluir.";
    if (err.code === "emails_disabled")
      return "O envio de e-mails está desativado para este projeto. Reative em Cloud → Emails.";
    if (err.status === 429)
      return `Limite de envio atingido. Tente novamente em ${err.retryAfterSeconds ?? 60} segundos.`;
    return `Serviço de e-mail recusou o envio (${err.code ?? err.status}).`;
  }
  return err instanceof Error ? err.message : String(err);
}

/** HTML da newsletter para visualização do layout dentro do painel. */
export async function renderNewsletterPreview(): Promise<{ html: string; subject: string; live: boolean }> {
  const label = editionLabel();
  const { data } = await supabaseAdmin
    .from("articles")
    .select("slug, title, dek, category, why_it_matters, read_minutes")
    .order("published_at", { ascending: false })
    .limit(5);

  const rows = (data ?? []) as NewsletterArticle[];
  const live = rows.length > 0;
  const articles = live ? rows : NEWSLETTER_PREVIEW_ARTICLES;

  const html = await render(
    React.createElement(DailyNewsletter, {
      editionLabel: label,
      siteUrl: SITE_URL,
      articles,
      recipientName: null,
    }),
  );
  return { html, subject: `IA News · ${label} — ${articles[0].title}`, live };
}

export async function runDailyNewsletter(
  options: NewsletterRunOptions = {},
): Promise<NewsletterRunResult> {
  const limit = Math.max(1, Math.min(10, options.limit ?? 5));
  const triggeredBy = options.triggeredBy ?? "cron";
  const label = editionLabel();

  const { data: articleRows, error: articlesError } = await supabaseAdmin
    .from("articles")
    .select("slug, title, dek, category, why_it_matters, read_minutes")
    .order("published_at", { ascending: false })
    .limit(limit);

  if (articlesError) {
    return {
      ok: false,
      sendId: null,
      subject: "",
      recipients: 0,
      delivered: 0,
      failed: 0,
      message: `Falha ao carregar matérias: ${articlesError.message}`,
    };
  }

  const articles = (articleRows ?? []) as NewsletterArticle[];
  if (articles.length === 0) {
    return {
      ok: false,
      sendId: null,
      subject: "",
      recipients: 0,
      delivered: 0,
      failed: 0,
      message: "Nenhuma matéria disponível para montar a edição.",
    };
  }

  const subject = `IA News · ${label} — ${articles[0].title}`;

  let recipients: { id: string | null; email: string; full_name: string | null }[] = [];
  if (options.testEmail) {
    recipients = [{ id: null, email: options.testEmail, full_name: null }];
  } else {
    const { data: leads, error: leadsError } = await supabaseAdmin
      .from("leads")
      .select("id, email, full_name")
      .eq("is_active", true)
      .is("unsubscribed_at", null)
      .limit(5000);
    if (leadsError) {
      return {
        ok: false,
        sendId: null,
        subject,
        recipients: 0,
        delivered: 0,
        failed: 0,
        message: `Falha ao carregar assinantes: ${leadsError.message}`,
      };
    }
    recipients = (leads ?? []) as typeof recipients;
  }

  const { data: sendRow, error: sendError } = await supabaseAdmin
    .from("newsletter_sends")
    .insert({
      subject,
      status: "running",
      recipients_count: recipients.length,
      article_slugs: articles.map((a) => a.slug),
      triggered_by: triggeredBy,
    })
    .select("id")
    .single();

  if (sendError || !sendRow) {
    return {
      ok: false,
      sendId: null,
      subject,
      recipients: recipients.length,
      delivered: 0,
      failed: 0,
      message: `Falha ao registrar o envio: ${sendError?.message ?? "desconhecido"}`,
    };
  }

  const sendId = (sendRow as { id: string }).id;
  const apiKey = process.env.LOVABLE_API_KEY;

  if (!apiKey) {
    await supabaseAdmin
      .from("newsletter_sends")
      .update({ status: "failed", error: "LOVABLE_API_KEY ausente.", finished_at: new Date().toISOString() })
      .eq("id", sendId);
    return {
      ok: false,
      sendId,
      subject,
      recipients: recipients.length,
      delivered: 0,
      failed: recipients.length,
      message: "Serviço de e-mail indisponível (chave ausente).",
    };
  }

  const text = plainText(articles, label);
  let delivered = 0;
  let failed = 0;
  let fatal: string | null = null;
  const log: { send_id: string; lead_id: string | null; email: string; status: string; reason: string | null }[] = [];

  for (const recipient of recipients) {
    if (fatal) {
      failed += 1;
      log.push({
        send_id: sendId,
        lead_id: recipient.id,
        email: recipient.email,
        status: "failed",
        reason: fatal,
      });
      continue;
    }
    try {
      const html = await render(
        React.createElement(DailyNewsletter, {
          editionLabel: label,
          siteUrl: SITE_URL,
          articles,
          recipientName: recipient.full_name?.split(" ")[0] ?? null,
        }),
      );
      await sendLovableEmail(
        {
          to: recipient.email,
          from: FROM_ADDRESS,
          sender_domain: SENDER_DOMAIN,
          subject,
          html,
          text,
          purpose: "newsletter",
          label: "daily-newsletter",
          idempotency_key: `newsletter-${sendId}-${recipient.email}`,
        },
        { apiKey },
      );
      delivered += 1;
      log.push({ send_id: sendId, lead_id: recipient.id, email: recipient.email, status: "sent", reason: null });
    } catch (err) {
      failed += 1;
      const reason = friendlyEmailError(err);
      if (err instanceof EmailAPIError) {
        if (err.code === "domain_not_verified" || err.code === "emails_disabled" || err.status === 429) {
          fatal = reason;
        }
      }
      log.push({
        send_id: sendId,
        lead_id: recipient.id,
        email: recipient.email,
        status: "failed",
        reason: reason.slice(0, 500),
      });
    }
  }

  if (log.length) {
    await supabaseAdmin.from("newsletter_recipients").insert(log as never);
  }

  const status = fatal ? "failed" : failed === 0 ? "sent" : "partial";
  await supabaseAdmin
    .from("newsletter_sends")
    .update({
      status,
      delivered_count: delivered,
      failed_count: failed,
      error: fatal,
      finished_at: new Date().toISOString(),
    })
    .eq("id", sendId);

  return {
    ok: !fatal,
    sendId,
    subject,
    recipients: recipients.length,
    delivered,
    failed,
    message: fatal
      ? fatal
      : recipients.length === 0
        ? "Nenhum assinante ativo na base."
        : `${delivered} e-mails enviados, ${failed} falhas.`,
  };
}