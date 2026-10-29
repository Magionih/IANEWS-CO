import { createServerFn } from "@tanstack/react-start";

import {
  bool,
  checar,
  dia,
  email,
  exigirAdmin,
  inteiro,
  obrigatorio,
  requireCrmAccess,
  texto,
  todas,
  umDe,
  url,
  uuid,
  uuidObrigatorio,
} from "./access";
import { carregarNegocios, type NegocioCompleto } from "./carregar";
import type {
  CrmAtividade,
  CrmConteudo,
  CrmEmpresa,
  CrmGrupo,
  CrmPessoa,
  CrmPorte,
  CrmTarefa,
  CrmVinculo,
} from "./types";

/* Empresas: cadastro único. A ficha junta pessoas, menções, negócios, conversas e tarefas. */

const EMPRESA_COLS =
  "id, nome, slug, site, dominio, instagram, linkedin, setor, cidade, pais, brasileira, porte, seguidores_instagram, descricao, pontuacao, grupo, grupo_manual, motivo_grupo, interagiu, noticia_recente_em, e_cliente, e_anunciante, origem, dono_id, ai_tool_id, ativo, created_at, updated_at";

export type EmpresaLinha = CrmEmpresa & {
  pessoas: number;
  mencoes: number;
  negocios_abertos: number;
};

export const listEmpresas = createServerFn({ method: "GET" })
  .middleware([requireCrmAccess])
  .handler(async ({ context }): Promise<EmpresaLinha[]> => {
    const { db } = context;
    const [empresas, vinculos, mencoes, negocios] = await Promise.all([
      todas<CrmEmpresa>((de, ate) =>
        db
          .from("crm_empresas")
          .select(EMPRESA_COLS)
          .order("pontuacao", { ascending: false })
          .order("nome")
          .range(de, ate),
      ),
      todas<{ empresa_id: string }>((de, ate) =>
        db.from("crm_empresa_pessoas").select("empresa_id").range(de, ate),
      ),
      todas<{ empresa_id: string | null }>((de, ate) =>
        db
          .from("crm_mencoes")
          .select("empresa_id")
          .eq("ativo", true)
          .not("empresa_id", "is", null)
          .range(de, ate),
      ),
      todas<{ empresa_id: string | null; etapa_tipo: string }>((de, ate) =>
        db
          .from("crm_negocios_resumo")
          .select("empresa_id, etapa_tipo")
          .eq("ativo", true)
          .eq("etapa_tipo", "aberta")
          .not("empresa_id", "is", null)
          .range(de, ate),
      ),
    ]);
    const conta = (lista: { empresa_id: string | null }[]) => {
      const m = new Map<string, number>();
      for (const r of lista) if (r.empresa_id) m.set(r.empresa_id, (m.get(r.empresa_id) ?? 0) + 1);
      return m;
    };
    const cp = conta(vinculos);
    const cm = conta(mencoes);
    const cn = conta(negocios);
    return empresas.map((e) => ({
      ...e,
      pessoas: cp.get(e.id) ?? 0,
      mencoes: cm.get(e.id) ?? 0,
      negocios_abertos: cn.get(e.id) ?? 0,
    }));
  });

export type MencaoFicha = {
  id: string;
  papel: string;
  created_at: string;
  pessoa_id: string | null;
  empresa_id: string | null;
  article: { id: string; slug: string; title: string; published_at: string } | null;
  conteudo: Pick<
    CrmConteudo,
    "id" | "canal" | "formato" | "url" | "titulo" | "publicado_em" | "collab_aceito"
  > | null;
};

export type FichaEmpresa = {
  empresa: CrmEmpresa;
  pessoas: (CrmPessoa & { cargo: string | null; decisor: boolean })[];
  mencoes: MencaoFicha[];
  negocios: NegocioCompleto[];
  atividades: CrmAtividade[];
  tarefas: CrmTarefa[];
};

const MENCAO_COLS =
  "id, papel, created_at, pessoa_id, empresa_id, article:articles(id, slug, title, published_at), conteudo:crm_conteudos(id, canal, formato, url, titulo, publicado_em, collab_aceito)";

export const getEmpresa = createServerFn({ method: "GET" })
  .middleware([requireCrmAccess])
  .inputValidator((input: { id: string }) => ({ id: uuidObrigatorio(input?.id, "a empresa") }))
  .handler(async ({ data, context }): Promise<FichaEmpresa> => {
    const { db } = context;
    const [empRes, vinRes, menRes, atvRes, tarRes] = await Promise.all([
      db.from("crm_empresas").select(EMPRESA_COLS).eq("id", data.id).maybeSingle(),
      db
        .from("crm_empresa_pessoas")
        .select("cargo, decisor, pessoa:crm_pessoas(*)")
        .eq("empresa_id", data.id),
      db
        .from("crm_mencoes")
        .select(MENCAO_COLS)
        .eq("empresa_id", data.id)
        .eq("ativo", true)
        .order("created_at", { ascending: false }),
      db
        .from("crm_atividades")
        .select("*")
        .eq("empresa_id", data.id)
        .order("created_at", { ascending: false })
        .limit(300),
      db
        .from("crm_tarefas")
        .select("*")
        .eq("empresa_id", data.id)
        .eq("cancelada", false)
        .order("vence_em", { ascending: true })
        .limit(200),
    ]);
    const empresa = checar(empRes) as CrmEmpresa | null;
    if (!empresa) throw new Error("Empresa não encontrada.");
    const vinculos = (checar(vinRes) ?? []) as unknown as {
      cargo: string | null;
      decisor: boolean;
      pessoa: CrmPessoa;
    }[];
    const negocios = await carregarNegocios(db, (q) => q.eq("empresa_id", data.id), {
      incluirInativos: true,
    });
    return {
      empresa,
      pessoas: vinculos
        .filter((v) => v.pessoa)
        .map((v) => ({ ...v.pessoa, cargo: v.cargo, decisor: v.decisor })),
      mencoes: (checar(menRes) ?? []) as unknown as MencaoFicha[],
      negocios,
      atividades: (checar(atvRes) ?? []) as CrmAtividade[],
      tarefas: (checar(tarRes) ?? []) as CrmTarefa[],
    };
  });

export type EmpresaInput = {
  id?: string;
  nome?: string;
  site?: string | null;
  instagram?: string | null;
  linkedin?: string | null;
  setor?: string | null;
  cidade?: string | null;
  pais?: string | null;
  brasileira?: boolean;
  porte?: CrmPorte | "" | null;
  seguidores_instagram?: number | string | null;
  descricao?: string | null;
  interagiu?: boolean;
  noticia_recente_em?: string | null;
  e_cliente?: boolean;
  e_anunciante?: boolean;
  origem?: string | null;
  dono_id?: string | null;
  ativo?: boolean;
  /** Só admin: grupo escolhido à mão (com motivo) ou volta ao calculado. */
  grupo_manual?: boolean;
  grupo?: CrmGrupo | "" | null;
  motivo_grupo?: string | null;
};

export const saveEmpresa = createServerFn({ method: "POST" })
  .middleware([requireCrmAccess])
  .inputValidator((input: EmpresaInput) => input)
  .handler(async ({ data, context }) => {
    const { db } = context;
    // Só os campos enviados são gravados (permite atualizar uma parte da ficha).
    const row: Record<string, unknown> = {};
    const campo = <K extends keyof EmpresaInput>(k: K, valor: () => unknown) => {
      if (k in data) row[k] = valor();
    };
    if (!data.id || "nome" in data) row.nome = obrigatorio(data.nome, "o nome da empresa", 200);
    campo("site", () => url(data.site));
    campo("instagram", () => texto(data.instagram, 120)?.replace(/^@/, "") ?? null);
    campo("linkedin", () => texto(data.linkedin, 300));
    campo("setor", () => texto(data.setor, 120));
    campo("cidade", () => texto(data.cidade, 120));
    campo("pais", () => texto(data.pais, 80) ?? "Brasil");
    campo("brasileira", () => data.brasileira !== false);
    campo("porte", () =>
      umDe(data.porte, ["startup", "pme", "grande", "global"] as const, "Porte"),
    );
    campo("seguidores_instagram", () => inteiro(data.seguidores_instagram));
    campo("descricao", () => texto(data.descricao, 4000));
    campo("interagiu", () => bool(data.interagiu));
    campo("noticia_recente_em", () => dia(data.noticia_recente_em));
    campo("e_cliente", () => bool(data.e_cliente));
    campo("e_anunciante", () => bool(data.e_anunciante));
    campo("origem", () => texto(data.origem, 40));
    campo("dono_id", () => uuid(data.dono_id));
    campo("ativo", () => data.ativo !== false);
    // Novo site: o banco recalcula o domínio (liga assinantes da newsletter à empresa).
    if ("site" in data) row.dominio = null;

    if (data.grupo_manual !== undefined) {
      if (data.id) {
        const atual = checar(
          await db.from("crm_empresas").select("grupo_manual, grupo").eq("id", data.id).single(),
        ) as {
          grupo_manual: boolean;
          grupo: string | null;
        };
        const mudou =
          atual.grupo_manual !== !!data.grupo_manual ||
          (data.grupo_manual && atual.grupo !== data.grupo);
        if (mudou) exigirAdmin(context.isAdmin);
      } else if (data.grupo_manual) exigirAdmin(context.isAdmin);
      row.grupo_manual = !!data.grupo_manual;
      if (data.grupo_manual) {
        row.grupo = umDe(data.grupo, ["A", "B", "C"] as const, "Grupo");
        row.motivo_grupo = obrigatorio(data.motivo_grupo, "o motivo da troca de grupo", 500);
      } else {
        row.motivo_grupo = null;
      }
    }

    if (data.id) {
      const id = uuidObrigatorio(data.id, "a empresa");
      checar(await db.from("crm_empresas").update(row).eq("id", id).select("id").single());
      return { id };
    }
    const novo = checar(await db.from("crm_empresas").insert(row).select("id").single()) as {
      id: string;
    };
    return { id: novo.id };
  });

export type PessoaNaEmpresaInput = {
  empresa_id: string;
  pessoa_id?: string | null;
  /** Nova pessoa (quando pessoa_id não vem). */
  nome?: string;
  email?: string | null;
  whatsapp?: string | null;
  instagram?: string | null;
  linkedin?: string | null;
  cargo?: string | null;
  decisor?: boolean;
};

/** Liga uma pessoa (existente ou nova) à empresa, com cargo. */
export const vincularPessoa = createServerFn({ method: "POST" })
  .middleware([requireCrmAccess])
  .inputValidator((input: PessoaNaEmpresaInput) => input)
  .handler(async ({ data, context }) => {
    const { db } = context;
    const empresaId = uuidObrigatorio(data.empresa_id, "a empresa");
    let pessoaId = uuid(data.pessoa_id);
    if (!pessoaId) {
      const mail = email(data.email);
      if (mail) {
        const existente = checar(
          await db.from("crm_pessoas").select("id").eq("email", mail).maybeSingle(),
        ) as { id: string } | null;
        pessoaId = existente?.id ?? null;
      }
      if (!pessoaId) {
        const nova = checar(
          await db
            .from("crm_pessoas")
            .insert({
              nome: obrigatorio(data.nome, "o nome da pessoa", 200),
              email: mail,
              whatsapp: texto(data.whatsapp, 40),
              instagram: texto(data.instagram, 120),
              linkedin: texto(data.linkedin, 300),
              origem: "cadastro",
            })
            .select("id")
            .single(),
        ) as { id: string };
        pessoaId = nova.id;
      }
    }
    checar(
      await db.from("crm_empresa_pessoas").upsert(
        {
          empresa_id: empresaId,
          pessoa_id: pessoaId,
          cargo: texto(data.cargo, 160),
          decisor: bool(data.decisor),
        } satisfies Omit<CrmVinculo, never>,
        { onConflict: "empresa_id,pessoa_id" },
      ),
    );
    return { pessoa_id: pessoaId };
  });
