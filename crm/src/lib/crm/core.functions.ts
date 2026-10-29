import { createServerFn } from "@tanstack/react-start";

import { checar, requireCrmAccess, texto } from "./access";
import type { CrmContexto, CrmEtapa, CrmFunil, CrmMembro } from "./types";

/* Contexto comum das telas do CRM e busca global. */

export const getCrmContexto = createServerFn({ method: "GET" })
  .middleware([requireCrmAccess])
  .handler(async ({ context }): Promise<CrmContexto> => {
    const { db } = context;
    const [equipe, funis, etapas] = await Promise.all([
      db.rpc("crm_equipe"),
      db.from("crm_funis").select("id, nome, ordem, ativo").order("ordem"),
      db
        .from("crm_etapas")
        .select("id, funil_id, nome, ordem, prazo_dias, acao_padrao, criterio_entrada, tipo, ativo")
        .order("funil_id")
        .order("ordem"),
    ]);
    return {
      userId: context.userId,
      papeis: context.papeis,
      isAdmin: context.isAdmin,
      equipe: (checar(equipe) ?? []) as CrmMembro[],
      funis: (checar(funis) ?? []) as CrmFunil[],
      etapas: (checar(etapas) ?? []) as CrmEtapa[],
    };
  });

export type ResultadoBusca = {
  empresas: {
    id: string;
    nome: string;
    instagram: string | null;
    grupo: string | null;
    pontuacao: number;
    e_cliente: boolean;
    mencoes: number;
    ultima_mencao: { titulo: string | null; slug: string | null; em: string | null } | null;
  }[];
  pessoas: {
    id: string;
    nome: string;
    email: string | null;
    instagram: string | null;
    empresas: string[];
    mencoes: number;
    ultima_mencao: { titulo: string | null; slug: string | null; em: string | null } | null;
  }[];
};

/** Busca por empresa, pessoa, e-mail, Instagram ou WhatsApp. Mostra se já apareceu em conteúdo (regra de não repetir). */
export const buscarCrm = createServerFn({ method: "GET" })
  .middleware([requireCrmAccess])
  .inputValidator((input: { q: string }) => ({ q: texto(input?.q, 120) ?? "" }))
  .handler(async ({ data, context }): Promise<ResultadoBusca> => {
    const { db } = context;
    const q = data.q.replace(/[%,()*]/g, " ").trim();
    if (q.length < 2) return { empresas: [], pessoas: [] };
    const like = `%${q.replace(/^@/, "")}%`;
    const digitos = q.replace(/\D/g, "");

    const pessoaFiltros = [
      `nome.ilike.${like}`,
      `email.ilike.${like}`,
      `instagram.ilike.${like}`,
      `linkedin.ilike.${like}`,
    ];
    if (digitos.length >= 6) pessoaFiltros.push(`whatsapp.ilike.%${digitos}%`);

    const [empRes, pesRes] = await Promise.all([
      db
        .from("crm_empresas")
        .select("id, nome, instagram, grupo, pontuacao, e_cliente")
        .or(`nome.ilike.${like},instagram.ilike.${like},site.ilike.${like},dominio.ilike.${like}`)
        .order("pontuacao", { ascending: false })
        .limit(10),
      db
        .from("crm_pessoas")
        .select("id, nome, email, instagram")
        .or(pessoaFiltros.join(","))
        .limit(10),
    ]);
    const empresas = (checar(empRes) ?? []) as Omit<
      ResultadoBusca["empresas"][number],
      "mencoes" | "ultima_mencao"
    >[];
    const pessoas = (checar(pesRes) ?? []) as Omit<
      ResultadoBusca["pessoas"][number],
      "mencoes" | "ultima_mencao" | "empresas"
    >[];

    const empIds = empresas.map((e) => e.id);
    const pesIds = pessoas.map((p) => p.id);
    const filtros = [
      empIds.length ? `empresa_id.in.(${empIds.join(",")})` : null,
      pesIds.length ? `pessoa_id.in.(${pesIds.join(",")})` : null,
    ].filter(Boolean);

    type MencaoBusca = {
      empresa_id: string | null;
      pessoa_id: string | null;
      created_at: string;
      article: { title: string; slug: string; published_at: string } | null;
      conteudo: { titulo: string | null; url: string | null; publicado_em: string | null } | null;
    };
    const [menRes, vinRes] = await Promise.all([
      filtros.length
        ? db
            .from("crm_mencoes")
            .select(
              "empresa_id, pessoa_id, created_at, article:articles(title, slug, published_at), conteudo:crm_conteudos(titulo, url, publicado_em)",
            )
            .eq("ativo", true)
            .or(filtros.join(","))
        : Promise.resolve({ data: [], error: null }),
      pesIds.length
        ? db
            .from("crm_empresa_pessoas")
            .select("pessoa_id, empresa:crm_empresas(nome)")
            .in("pessoa_id", pesIds)
        : Promise.resolve({ data: [], error: null }),
    ]);
    const mencoes = (checar(menRes) ?? []) as unknown as MencaoBusca[];
    const vinculos = (checar(vinRes) ?? []) as unknown as {
      pessoa_id: string;
      empresa: { nome: string } | null;
    }[];

    const resumo = (lista: MencaoBusca[]) => {
      if (!lista.length) return null;
      const ordenada = [...lista].sort((a, b) => {
        const da = a.article?.published_at ?? a.conteudo?.publicado_em ?? a.created_at;
        const dbb = b.article?.published_at ?? b.conteudo?.publicado_em ?? b.created_at;
        return dbb.localeCompare(da);
      });
      const m = ordenada[0];
      return {
        titulo: m.article?.title ?? m.conteudo?.titulo ?? m.conteudo?.url ?? null,
        slug: m.article?.slug ?? null,
        em: m.article?.published_at ?? m.conteudo?.publicado_em ?? m.created_at,
      };
    };

    return {
      empresas: empresas.map((e) => {
        const lista = mencoes.filter((m) => m.empresa_id === e.id);
        return { ...e, mencoes: lista.length, ultima_mencao: resumo(lista) };
      }),
      pessoas: pessoas.map((p) => {
        const lista = mencoes.filter((m) => m.pessoa_id === p.id);
        return {
          ...p,
          empresas: vinculos
            .filter((v) => v.pessoa_id === p.id && v.empresa)
            .map((v) => v.empresa!.nome),
          mencoes: lista.length,
          ultima_mencao: resumo(lista),
        };
      }),
    };
  });
