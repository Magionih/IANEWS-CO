import { createServerFn } from "@tanstack/react-start";
import { createClient } from "@supabase/supabase-js";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/* Página "Envie sua pauta" (/pauta): exemplos de matérias e painel de pautas no admin.
   O envio do formulário vai pela rota /api/public/pauta (validação e limite no servidor). */

export type PautaExample = {
  slug: string;
  title: string;
  category: string;
  cover_image_url: string | null;
};

export type PautaStatus = "novo" | "em_contato" | "proposta" | "fechado" | "descartado";
export type PautaGrupo = "A" | "B" | "C";

export type PautaLead = {
  id: string;
  created_at: string;
  nome: string;
  cargo: string;
  empresa: string;
  site: string | null;
  instagram: string | null;
  linkedin: string | null;
  whatsapp: string;
  email: string;
  descricao: string;
  link_noticia: string | null;
  origem_path: string | null;
  article_slug: string | null;
  utm_source: string | null;
  utm_medium: string | null;
  utm_campaign: string | null;
  device: string | null;
  status: PautaStatus;
  grupo: PautaGrupo | null;
  admin_notes: string | null;
};

/** Matérias recentes de empresas (startup e Brasil), com capa, para mostrar o tipo de conteúdo. */
export const listPautaExamples = createServerFn({ method: "GET" }).handler(
  async (): Promise<PautaExample[]> => {
    const supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_PUBLISHABLE_KEY!, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { data, error } = await supabase
      .from("articles")
      .select("slug, title, category, cover_image_url")
      .in("category", ["startup", "brasil"])
      .not("cover_image_url", "is", null)
      .lte("published_at", new Date().toISOString())
      .order("published_at", { ascending: false })
      .limit(6);
    if (error) {
      console.error("[pauta] examples error", error.message);
      return [];
    }
    return (data ?? []) as PautaExample[];
  },
);

async function assertAdmin(supabase: any, userId: string) {
  const { data, error } = await supabase.from("user_roles").select("role").eq("user_id", userId);
  if (error) throw new Error(error.message);
  const roles = ((data ?? []) as { role: string }[]).map((r) => r.role);
  if (!roles.includes("admin")) throw new Error("Acesso restrito a administradores.");
}

export const getPautaLeads = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context.supabase, context.userId);
    const { data, error } = await (context.supabase as any)
      .from("pauta_leads")
      .select(
        "id, created_at, nome, cargo, empresa, site, instagram, linkedin, whatsapp, email, descricao, link_noticia, origem_path, article_slug, utm_source, utm_medium, utm_campaign, device, status, grupo, admin_notes",
      )
      .order("created_at", { ascending: false })
      .limit(500);
    if (error) throw new Error(error.message);
    return { leads: (data ?? []) as PautaLead[] };
  });

const STATUSES = new Set(["novo", "em_contato", "proposta", "fechado", "descartado"]);

export const updatePautaLead = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (input: { id: string; status?: PautaStatus; grupo?: PautaGrupo | ""; admin_notes?: string }) => input,
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context.supabase, context.userId);
    const payload: Record<string, unknown> = {};
    if (data.status) {
      if (!STATUSES.has(data.status)) throw new Error("Situação inválida.");
      payload.status = data.status;
    }
    if (data.grupo !== undefined) {
      if (data.grupo && !["A", "B", "C"].includes(data.grupo)) throw new Error("Grupo inválido.");
      payload.grupo = data.grupo || null;
    }
    if (data.admin_notes !== undefined) payload.admin_notes = data.admin_notes.slice(0, 4000) || null;
    const { error } = await (context.supabase as any).from("pauta_leads").update(payload).eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
