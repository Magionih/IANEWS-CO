import React from "react";
import { render } from "@react-email/render";
import { sendLovableEmail, EmailAPIError } from "@lovable.dev/email-js";

import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { WeeklyRankingEmail, type RankingEmailTool } from "@/lib/ranking-email-template";
import { RANKING_PREVIEW_TOOLS } from "@/lib/email-templates/weekly-ranking";

export const SITE_URL = process.env.NEWSLETTER_SITE_URL ?? "https://ianews.site";
export const SENDER_DOMAIN = process.env.EMAIL_SENDER_DOMAIN ?? "notify.ianews.site";
export const FROM_ADDRESS = process.env.EMAIL_FROM ?? `IA News <news@${SENDER_DOMAIN}>`;

const TOOL_COLS =
  "slug, name, maker, category, website, about, weekly_score, previous_score, rank_position, previous_position, ratings_avg";

export type RankingRunOptions = {
  limit?: number;
  triggeredBy?: string;
  testEmail?: string | null;
};

export type RankingRunResult = {
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

function normalizeTool(row: Record<string, unknown>): RankingEmailTool {
  return {
    slug: String(row.slug ?? ""),
    name: String(row.name ?? ""),
    maker: String(row.maker ?? ""),
    category: String(row.category ?? ""),
    website: String(row.website ?? ""),
    about: String(row.about ?? ""),
    weekly_score: Number(row.weekly_score ?? 0),
    previous_score: Number(row.previous_score ?? 0),
    rank_position: Number(row.rank_position ?? 0),
    previous_position: Number(row.previous_position ?? 0),
    ratings_avg: Number(row.ratings_avg ?? 0),
  };
}

function plainText(tools: RankingEmailTool[], label: string) {
  return [
    `IA News — Ranking IA semanal (${label})`,
    "",
    ...tools.map(
      (t, i) =>
        `${t.rank_position || i + 1}. ${t.name} (${t.maker}) — nota ${t.weekly_score.toFixed(1)}`,
    ),
    "",
    `Ranking completo: ${SITE_URL}/ranking`,
  ].join("\n");
}

function friendlyEmailError(err: unknown): string {
  if (err instanceof EmailAPIError) {
    if (err.code === "domain_not_verified")
      return "O domínio remetente ainda está em verificação de DNS. Os envios começam automaticamente após a verificação.";
    if (err.code === "emails_disabled")
      return "O envio de e-mails está desativado para este projeto.";
    if (err.status === 429)
      return `Limite de envio atingido. Tente novamente em ${err.retryAfterSeconds ?? 60} segundos.`;
    return `Serviço de e-mail recusou o envio (${err.code ?? err.status}).`;
  }
  return err instanceof Error ? err.message : String(err);
}

async function loadTools(limit: number): Promise<RankingEmailTool[]> {
  const { data } = await supabaseAdmin
    .from("ai_tools")
    .select(TOOL_COLS)
    .eq("is_active", true)
    .order("rank_position", { ascending: true })
    .limit(limit);
  return ((data ?? []) as Record<string, unknown>[]).map(normalizeTool).filter((t) => t.name);
}

/** HTML do ranking semanal para visualização no painel. */
export async function renderWeeklyRankingPreview(): Promise<{
  html: string;
  subject: string;
  live: boolean;
}> {
  const label = editionLabel();
  const rows = await loadTools(8);
  const live = rows.length > 0;
  const tools = live ? rows : RANKING_PREVIEW_TOOLS;
  const html = await render(
    React.createElement(WeeklyRankingEmail, {
      editionLabel: label,
      siteUrl: SITE_URL,
      tools,
      recipientName: null,
    }),
  );
  return { html, subject: `Ranking IA · semana de ${label}`, live };
}

/**
 * Envia o ranking semanal das melhores ferramentas de IA para os leads que
 * pediram o comparativo (CTAs da página de Ranking IA).
 */
export async function runWeeklyRanking(
  options: RankingRunOptions = {},
): Promise<RankingRunResult> {
  const limit = Math.max(3, Math.min(12, options.limit ?? 8));
  const triggeredBy = options.triggeredBy ?? "cron-ranking";
  const label = editionLabel();
  const subject = `Ranking IA · semana de ${label}`;

  const tools = await loadTools(limit);
  if (tools.length === 0) {
    return {
      ok: false,
      sendId: null,
      subject,
      recipients: 0,
      delivered: 0,
      failed: 0,
      message: "Nenhuma ferramenta ativa no ranking para montar a edição.",
    };
  }

  let recipients: { id: string | null; email: string; full_name: string | null }[] = [];
  if (options.testEmail) {
    recipients = [{ id: null, email: options.testEmail, full_name: null }];
  } else {
    const { data: leads, error: leadsError } = await supabaseAdmin
      .from("leads")
      .select("id, email, full_name")
      .eq("is_active", true)
      .is("unsubscribed_at", null)
      .or("cta_placement.ilike.ranking%,source.ilike.%ranking%")
      .limit(5000);
    if (leadsError) {
      return {
        ok: false,
        sendId: null,
        subject,
        recipients: 0,
        delivered: 0,
        failed: 0,
        message: `Falha ao carregar assinantes do ranking: ${leadsError.message}`,
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
      article_slugs: tools.map((t) => t.slug),
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
      .update({
        status: "failed",
        error: "LOVABLE_API_KEY ausente.",
        finished_at: new Date().toISOString(),
      })
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

  const text = plainText(tools, label);
  let delivered = 0;
  let failed = 0;
  let fatal: string | null = null;
  const log: {
    send_id: string;
    lead_id: string | null;
    email: string;
    status: string;
    reason: string | null;
  }[] = [];

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
        React.createElement(WeeklyRankingEmail, {
          editionLabel: label,
          siteUrl: SITE_URL,
          tools,
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
          label: "weekly-ranking",
          idempotency_key: `ranking-${sendId}-${recipient.email}`,
        },
        { apiKey },
      );
      delivered += 1;
      log.push({
        send_id: sendId,
        lead_id: recipient.id,
        email: recipient.email,
        status: "sent",
        reason: null,
      });
    } catch (err) {
      failed += 1;
      const reason = friendlyEmailError(err);
      if (err instanceof EmailAPIError) {
        if (
          err.code === "domain_not_verified" ||
          err.code === "emails_disabled" ||
          err.status === 429
        ) {
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
        ? "Nenhum assinante do ranking na base ainda."
        : `${delivered} e-mails enviados, ${failed} falhas.`,
  };
}
