import { createServerFn } from "@tanstack/react-start";

import {
  bool,
  checar,
  email,
  inteiro,
  obrigatorio,
  requireCrmAccess,
  texto,
  todas,
  uuid,
  uuidObrigatorio,
} from "./access";
import type { MencaoFicha } from "./empresas.functions";
import { carregarNegocios, type NegocioCompleto } from "./carregar";
import type { CrmAtividade, CrmEmpresa, CrmPessoa, CrmTarefa } from "./types";

/* Pessoas: fundadores, executivos e contatos. Uma pessoa pode estar em mais de uma empresa. */

const PESSOA_COLS =
  "id, nome, instagram, linkedin, whatsapp, email, seguidores_instagram, consentimento, consentimento_em, origem, newsletter_lead_id, aquecido_em, notas, dono_id, ativo, created_at, updated_at";

export type PessoaLinha = CrmPessoa & {
  empresas: { id: string; nome: string; cargo: string | null; decisor: boolean }[];
  mencoes: number;
  assinante: boolean;
};

export const listPessoas = createServerFn({ method: "GET" })
  .middleware([requireCrmAccess])
  .handler(async ({ context }): Promise<PessoaLinha[]> => {
    const { db } = context;
    const [pessoas, vinculos, mencoes] = await Promise.all([
      todas<CrmPessoa>((de, ate) =>
        db.from("crm_pessoas").select(PESSOA_COLS).order("nome").range(de, ate),
      ),
      todas<{
        pessoa_id: string;
        cargo: string | null;
        decisor: boolean;
        empresa: { id: string; nome: string } | null;
      }>((de, ate) =>
        db
          .from("crm_empresa_pessoas")
          .select("pessoa_id, cargo, decisor, empresa:crm_empresas(id, nome)")
          .range(de, ate),
      ),
      todas<{ pessoa_id: string | null }>((de, ate) =>
        db
          .from("crm_mencoes")
          .select("pessoa_id")
          .eq("ativo", true)
          .not("pessoa_id", "is", null)
          .range(de, ate),
      ),
    ]);
    const porPessoa = new Map<string, PessoaLinha["empresas"]>();
    for (const v of vinculos) {
      if (!v.empresa) continue;
      const lista = porPessoa.get(v.pessoa_id) ?? [];
      lista.push({ id: v.empresa.id, nome: v.empresa.nome, cargo: v.cargo, decisor: v.decisor });
      porPessoa.set(v.pessoa_id, lista);
    }
    const cm = new Map<string, number>();
    for (const m of mencoes) if (m.pessoa_id) cm.set(m.pessoa_id, (cm.get(m.pessoa_id) ?? 0) + 1);
    return pessoas.map((p) => ({
      ...p,
      empresas: porPessoa.get(p.id) ?? [],
      mencoes: cm.get(p.id) ?? 0,
      assinante: !!p.newsletter_lead_id,
    }));
  });

export type FichaPessoa = {
  pessoa: CrmPessoa;
  empresas: (Pick<CrmEmpresa, "id" | "nome" | "grupo" | "pontuacao"> & {
    cargo: string | null;
    decisor: boolean;
  })[];
  mencoes: MencaoFicha[];
  negocios: NegocioCompleto[];
  atividades: CrmAtividade[];
  tarefas: CrmTarefa[];
  newsletter: {
    email: string;
    is_active: boolean;
    confirmed_at: string | null;
    source: string | null;
    created_at: string;
  } | null;
};

export const getPessoa = createServerFn({ method: "GET" })
  .middleware([requireCrmAccess])
  .inputValidator((input: { id: string }) => ({ id: uuidObrigatorio(input?.id, "a pessoa") }))
  .handler(async ({ data, context }): Promise<FichaPessoa> => {
    const { db } = context;
    const [pesRes, vinRes, menRes, atvRes, tarRes] = await Promise.all([
      db.from("crm_pessoas").select(PESSOA_COLS).eq("id", data.id).maybeSingle(),
      db
        .from("crm_empresa_pessoas")
        .select("cargo, decisor, empresa:crm_empresas(id, nome, grupo, pontuacao)")
        .eq("pessoa_id", data.id),
      db
        .from("crm_mencoes")
        .select(
          "id, papel, created_at, pessoa_id, empresa_id, article:articles(id, slug, title, published_at), conteudo:crm_conteudos(id, canal, formato, url, titulo, publicado_em, collab_aceito)",
        )
        .eq("pessoa_id", data.id)
        .eq("ativo", true)
        .order("created_at", { ascending: false }),
      db
        .from("crm_atividades")
        .select("*")
        .eq("pessoa_id", data.id)
        .order("created_at", { ascending: false })
        .limit(300),
      db
        .from("crm_tarefas")
        .select("*")
        .eq("pessoa_id", data.id)
        .eq("cancelada", false)
        .order("vence_em")
        .limit(200),
    ]);
    const pessoa = checar(pesRes) as CrmPessoa | null;
    if (!pessoa) throw new Error("Pessoa não encontrada.");
    const vinculos = (checar(vinRes) ?? []) as unknown as {
      cargo: string | null;
      decisor: boolean;
      empresa: Pick<CrmEmpresa, "id" | "nome" | "grupo" | "pontuacao"> | null;
    }[];

    // Dados da newsletter (tabela leads) só são lidos pelo servidor, depois da checagem de acesso.
    let newsletter: FichaPessoa["newsletter"] = null;
    if (pessoa.newsletter_lead_id) {
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
      const { data: lead } = await supabaseAdmin
        .from("leads")
        .select("email, is_active, confirmed_at, source, created_at")
        .eq("id", pessoa.newsletter_lead_id)
        .maybeSingle();
      newsletter = (lead as FichaPessoa["newsletter"]) ?? null;
    }

    return {
      pessoa,
      empresas: vinculos
        .filter((v) => v.empresa)
        .map((v) => ({ ...v.empresa!, cargo: v.cargo, decisor: v.decisor })),
      mencoes: (checar(menRes) ?? []) as unknown as MencaoFicha[],
      negocios: await carregarNegocios(db, (q) => q.eq("pessoa_id", data.id), {
        incluirInativos: true,
      }),
      atividades: (checar(atvRes) ?? []) as CrmAtividade[],
      tarefas: (checar(tarRes) ?? []) as CrmTarefa[],
      newsletter,
    };
  });

export type PessoaInput = {
  id?: string;
  nome?: string;
  email?: string | null;
  whatsapp?: string | null;
  instagram?: string | null;
  linkedin?: string | null;
  seguidores_instagram?: number | string | null;
  consentimento?: boolean;
  origem?: string | null;
  notas?: string | null;
  dono_id?: string | null;
  ativo?: boolean;
  /** Ligação opcional com uma empresa ao criar. */
  empresa_id?: string | null;
  cargo?: string | null;
  decisor?: boolean;
};

export const savePessoa = createServerFn({ method: "POST" })
  .middleware([requireCrmAccess])
  .inputValidator((input: PessoaInput) => input)
  .handler(async ({ data, context }) => {
    const { db } = context;
    const row: Record<string, unknown> = {};
    const campo = <K extends keyof PessoaInput>(k: K, valor: () => unknown) => {
      if (k in data) row[k] = valor();
    };
    if (!data.id || "nome" in data) row.nome = obrigatorio(data.nome, "o nome da pessoa", 200);
    campo("email", () => email(data.email));
    campo("whatsapp", () => texto(data.whatsapp, 40));
    campo("instagram", () => texto(data.instagram, 120));
    campo("linkedin", () => texto(data.linkedin, 300));
    campo("seguidores_instagram", () => inteiro(data.seguidores_instagram));
    campo("consentimento", () => bool(data.consentimento));
    campo("origem", () => texto(data.origem, 40));
    campo("notas", () => texto(data.notas, 4000));
    campo("dono_id", () => uuid(data.dono_id));
    campo("ativo", () => data.ativo !== false);

    let id = uuid(data.id);
    if (id) {
      checar(await db.from("crm_pessoas").update(row).eq("id", id).select("id").single());
    } else {
      const nova = checar(await db.from("crm_pessoas").insert(row).select("id").single()) as {
        id: string;
      };
      id = nova.id;
    }
    const empresaId = uuid(data.empresa_id);
    if (empresaId) {
      checar(
        await db.from("crm_empresa_pessoas").upsert(
          {
            empresa_id: empresaId,
            pessoa_id: id,
            cargo: texto(data.cargo, 160),
            decisor: bool(data.decisor),
          },
          { onConflict: "empresa_id,pessoa_id" },
        ),
      );
    }
    return { id };
  });
