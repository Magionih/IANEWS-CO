import { createServerFn } from "@tanstack/react-start";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type ContactKind = "contato" | "anuncie";
export type ContactStatus = "nova" | "andamento" | "respondida" | "arquivada";

export type ContactMessage = {
  id: string;
  kind: string;
  full_name: string;
  email: string;
  phone: string | null;
  company: string | null;
  budget: string | null;
  subject: string | null;
  message: string;
  status: string;
  admin_notes: string | null;
  created_at: string;
};

const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

export const submitContactMessage = createServerFn({ method: "POST" })
  .inputValidator(
    (input: {
      kind: ContactKind;
      full_name: string;
      email: string;
      phone?: string;
      company?: string;
      budget?: string;
      subject?: string;
      message: string;
      newsletter?: boolean;
      website?: string;
    }) => input,
  )
  .handler(async ({ data }) => {
    const full_name = data.full_name.trim();
    const email = data.email.trim().toLowerCase();
    const message = data.message.trim();
    const kind: ContactKind = data.kind === "anuncie" ? "anuncie" : "contato";

    if (full_name.length < 2 || full_name.length > 160) throw new Error("Informe seu nome completo.");
    if (!EMAIL_RE.test(email) || email.length > 255) throw new Error("Informe um e-mail válido.");
    if (message.length < 5 || message.length > 4000) throw new Error("Escreva uma mensagem com mais detalhes.");

    // Campo-armadilha para robôs: se vier preenchido, finge sucesso e não grava.
    if (data.website && data.website.trim()) return { ok: true };

    const { supabaseAdmin: supabase } = await import("@/integrations/supabase/client.server");
    const row = {
      kind,
      full_name,
      email,
      phone: data.phone?.trim().slice(0, 40) || null,
      company: data.company?.trim().slice(0, 160) || null,
      budget: data.budget?.trim().slice(0, 80) || null,
      subject: data.subject?.trim().slice(0, 200) || null,
      message,
    };
    const { error } = await supabase.from("contact_messages").insert(row as never);
    if (error) {
      console.error("[contact] insert error", error.message);
      throw new Error("Não foi possível enviar sua mensagem agora. Tente novamente.");
    }

    // Registra o contato na base de leads. Só entra na newsletter quem marcou a opção.
    const { data: existing } = await supabase.from("leads").select("id").eq("email", email).maybeSingle();
    if (!existing) {
      await supabase.from("leads").insert({
        email,
        full_name,
        phone: row.phone,
        source: kind,
        cta_placement: `form-${kind}`,
        is_active: data.newsletter === true,
      } as never);
    }

    // Aviso para o administrador (não bloqueia o envio do formulário).
    try {
      const { sendTemplateEmail } = await import("@/lib/email-templates/send-email");
      await sendTemplateEmail("contact-notification", "magionih@gmail.com", { templateData: row, replyTo: email });
    } catch (err) {
      console.error("[contact] notify failed", err instanceof Error ? err.message : err);
    }

    return { ok: true };
  });

async function assertAdmin(supabase: any, userId: string) {
  const { data, error } = await supabase.from("user_roles").select("role").eq("user_id", userId);
  if (error) throw new Error(error.message);
  const roles = ((data ?? []) as { role: string }[]).map((r) => r.role);
  if (!roles.includes("admin")) throw new Error("Acesso restrito a administradores.");
}

export const getContactMessages = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context.supabase, context.userId);
    const { data, error } = await context.supabase
      .from("contact_messages")
      .select(
        "id, kind, full_name, email, phone, company, budget, subject, message, status, admin_notes, created_at",
      )
      .order("created_at", { ascending: false })
      .limit(500);
    if (error) throw new Error(error.message);
    const messages = (data ?? []) as ContactMessage[];
    return {
      messages,
      stats: {
        total: messages.length,
        novas: messages.filter((m) => m.status === "nova").length,
        anuncie: messages.filter((m) => m.kind === "anuncie").length,
        contato: messages.filter((m) => m.kind === "contato").length,
      },
    };
  });

export const updateContactMessage = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { id: string; status?: ContactStatus; admin_notes?: string }) => input)
  .handler(async ({ data, context }) => {
    await assertAdmin(context.supabase, context.userId);
    const payload: Record<string, unknown> = {};
    if (data.status) payload.status = data.status;
    if (data.admin_notes !== undefined) payload.admin_notes = data.admin_notes.slice(0, 4000) || null;
    const { error } = await context.supabase
      .from("contact_messages")
      .update(payload as never)
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const deleteContactMessage = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { id: string }) => input)
  .handler(async ({ data, context }) => {
    await assertAdmin(context.supabase, context.userId);
    const { error } = await context.supabase.from("contact_messages").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });