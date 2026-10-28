import { porIds, todas, type CrmDb } from "./access";
import type { CrmGrupo, CrmNegocio, CrmNegocioCard, CrmTarefa, CrmTarefaItem } from "./types";

/* Carrega negócios e tarefas já com empresa, pessoa e matéria (kanban, fichas, Hoje e resumos por e-mail). */

export type NegocioResumo = CrmNegocio & {
  etapa_nome: string;
  etapa_tipo: string;
  etapa_ordem: number;
  ultima_atividade_em: string | null;
  ultima_enviada_em: string | null;
  ultima_recebida_em: string | null;
};

export type NegocioCompleto = CrmNegocioCard &
  Pick<
    NegocioResumo,
    | "etapa_nome"
    | "etapa_tipo"
    | "etapa_ordem"
    | "ultima_atividade_em"
    | "ultima_enviada_em"
    | "ultima_recebida_em"
  >;

// Builder do supabase-js: tipagem solta porque as tabelas crm_* não estão nos tipos gerados.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Filtro = (q: any) => any;

export async function carregarNegocios(
  db: CrmDb,
  filtro: Filtro = (q) => q,
  opts: { incluirInativos?: boolean } = {},
): Promise<NegocioCompleto[]> {
  const linhas = await todas<NegocioResumo>((de, ate) => {
    let q = db.from("crm_negocios_resumo").select("*");
    if (!opts.incluirInativos) q = q.eq("ativo", true);
    return filtro(q).order("updated_at", { ascending: false }).range(de, ate);
  });
  return hidratarNegocios(db, linhas);
}

export async function hidratarNegocios(
  db: CrmDb,
  linhas: NegocioResumo[],
): Promise<NegocioCompleto[]> {
  const [empresas, pessoas, artigos, conteudos] = await Promise.all([
    porIds<{
      id: string;
      nome: string;
      grupo: CrmGrupo | null;
      seguidores_instagram: number | null;
    }>(
      db,
      "crm_empresas",
      "id, nome, grupo, seguidores_instagram",
      linhas.map((l) => l.empresa_id),
    ),
    porIds<{ id: string; nome: string; whatsapp: string | null }>(
      db,
      "crm_pessoas",
      "id, nome, whatsapp",
      linhas.map((l) => l.pessoa_id),
    ),
    porIds<{ id: string; slug: string; title: string }>(
      db,
      "articles",
      "id, slug, title",
      linhas.map((l) => l.article_id),
    ),
    porIds<{ id: string; url: string | null }>(
      db,
      "crm_conteudos",
      "id, url",
      linhas.map((l) => l.conteudo_id),
    ),
  ]);
  return linhas.map((l) => {
    const e = l.empresa_id ? empresas.get(l.empresa_id) : undefined;
    const p = l.pessoa_id ? pessoas.get(l.pessoa_id) : undefined;
    const a = l.article_id ? artigos.get(l.article_id) : undefined;
    return {
      ...l,
      valor: l.valor == null ? null : Number(l.valor),
      empresa_nome: e?.nome ?? null,
      empresa_grupo: e?.grupo ?? null,
      empresa_seguidores: e?.seguidores_instagram ?? null,
      pessoa_nome: p?.nome ?? null,
      pessoa_whatsapp: p?.whatsapp ?? null,
      article_slug: a?.slug ?? null,
      article_title: a?.title ?? null,
      post_url: (l.conteudo_id && conteudos.get(l.conteudo_id)?.url) || null,
    };
  });
}

export async function hidratarTarefas(db: CrmDb, tarefas: CrmTarefa[]): Promise<CrmTarefaItem[]> {
  const [empresas, pessoas, negocios] = await Promise.all([
    porIds<{ id: string; nome: string }>(
      db,
      "crm_empresas",
      "id, nome",
      tarefas.map((t) => t.empresa_id),
    ),
    porIds<{ id: string; nome: string }>(
      db,
      "crm_pessoas",
      "id, nome",
      tarefas.map((t) => t.pessoa_id),
    ),
    porIds<{ id: string; titulo: string }>(
      db,
      "crm_negocios",
      "id, titulo",
      tarefas.map((t) => t.negocio_id),
    ),
  ]);
  return tarefas.map((t) => ({
    ...t,
    empresa_nome: (t.empresa_id && empresas.get(t.empresa_id)?.nome) || null,
    pessoa_nome: (t.pessoa_id && pessoas.get(t.pessoa_id)?.nome) || null,
    negocio_titulo: (t.negocio_id && negocios.get(t.negocio_id)?.titulo) || null,
  }));
}
