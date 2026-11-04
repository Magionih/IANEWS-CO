import { sendTemplateEmail } from "@/lib/email-templates/send-email";

const SITE_URL = "https://ianewsbr.com";

export const confirmUrlFor = (token: string) => `${SITE_URL}/confirmar?t=${token}`;

type LeadRow = {
  id: string;
  email: string;
  full_name: string | null;
  source: string | null;
  confirm_token: string;
  created_at: string;
};

/** Envia o e-mail de boas-vindas (sem pedir confirmação) e marca a data de envio.
 *  Desde 04/11/2026 não há confirmação: quem se inscreve já recebe a próxima edição. */
export async function sendWelcomeEmail(lead: LeadRow) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  try {
    const result = await sendTemplateEmail("lead-welcome", lead.email, {
      idempotencyKey: `lead-welcome-${lead.id}`,
      templateData: {
        name: lead.full_name?.split(" ")[0] ?? undefined,
        origin: lead.source ?? undefined,
      },
    });
    await supabaseAdmin
      .from("leads")
      .update({ welcome_sent_at: new Date().toISOString() } as never)
      .eq("id", lead.id);
    return result.sent;
  } catch (err) {
    console.error("[lead-funnel] welcome failed", err instanceof Error ? err.message : err);
    return false;
  }
}

/**
 * Automação de follow-up:
 *  - envia boas-vindas para leads que ainda não receberam;
 *  - envia lembrete para quem não confirmou após `reminderAfterHours`.
 */
export async function runLeadFollowUp(options: { reminderAfterHours?: number } = {}) {
  const reminderAfterHours = options.reminderAfterHours ?? 24;
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

  const { data: pendingWelcome } = await supabaseAdmin
    .from("leads")
    .select("id, email, full_name, source, confirm_token, created_at")
    .is("welcome_sent_at", null)
    .is("unsubscribed_at", null)
    .order("created_at", { ascending: true })
    .limit(100);

  let welcomes = 0;
  for (const lead of (pendingWelcome ?? []) as LeadRow[]) {
    if (await sendWelcomeEmail(lead)) welcomes += 1;
  }

  // Lembrete de confirmação desligado: a inscrição vale sem confirmar (decisão de 04/11/2026).
  const reminders = 0;
  void reminderAfterHours;

  return { ok: true, welcomes, reminders };
}

/** Confirma a assinatura a partir do token do e-mail. */
export async function confirmLeadByToken(token: string) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data, error } = await supabaseAdmin
    .from("leads")
    .select("id, email, confirmed_at")
    .eq("confirm_token", token)
    .maybeSingle();
  if (error || !data) return { ok: false as const, email: null, already: false };

  const row = data as { id: string; email: string; confirmed_at: string | null };
  if (row.confirmed_at) return { ok: true as const, email: row.email, already: true };

  await supabaseAdmin
    .from("leads")
    .update({ confirmed_at: new Date().toISOString(), is_active: true } as never)
    .eq("id", row.id);
  return { ok: true as const, email: row.email, already: false };
}
