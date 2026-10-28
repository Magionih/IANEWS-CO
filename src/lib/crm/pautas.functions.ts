import { createServerFn } from "@tanstack/react-start";

import {
  bool,
  checar,
  inteiro,
  instante,
  requireCrmAccess,
  texto,
  todas,
  umDe,
  url,
  uuid,
  uuidObrigatorio,
  type CrmDb,
} from "./access";
import { candidatosDoTitulo, encontrarCitados } from "./mencoes";
import type { CrmCanalConteudo, CrmConteudo, CrmPapelMencao } from "./types";

/* Pautas e conteúdo: matérias e posts com as empresas e pessoas citadas (menções). */

const CANAIS = ["instagram", "facebook", "linkedin", "threads", "newsletter", "site"] as const;
const PAPEIS = ["protagonista", "citada", "colaboradora"] as const;

export type ArtigoPauta = {
  id: string;
  slug: string;
  title: string;
  category: string;
  tags: string[] | null;
  published_at: string;
  status: string;
  origin: string | null;
  social_url: string | null;
};

export type MencaoPauta = {
  id: string;
  article_id: string | null;
  conteudo_id: string | null;
  empresa_id: string | null;
  pessoa_id: string | null;
  papel: CrmPapelMencao;
  empresa: { id: string; nome: string; grupo: string | null } | null;
  pessoa: { id: string; nome: string } | null;
};

export type DadosPautas = {
  artigos: ArtigoPauta[];
  conteudos: CrmConteudo[];
  mencoes: MencaoPauta[];
  /** Quantas vezes cada empresa/pessoa já apareceu (para o aviso de repetição). */
  aparicoes: { empresas: Record<string, number>; pessoas: Record<string, number> };
};

export const listPautas = createServerFn({ method: "GET" })
  .middleware([requireCrmAccess])
  .inputValidator((input: { dias?: number }) => ({ dias: inteiro(input?.dias, 1, 3650) ?? 90 }))
  .handler(async ({ data, context }): Promise<DadosPautas> => {
    const { db } = context;
    const desde = new Date(Date.now() - data.dias * 86_400_000).toISOString();
    const artigos = (checar(
      await db
        .from("articles")
        .select("id, slug, title, category, tags, published_at, status, origin, social_url")
        .gte("published_at", desde)
        .order("published_at", { ascending: false })
        .limit(500),
    ) ?? []) as ArtigoPauta[];
    const [conteudos, mencoes] = await Promise.all([
      todas<CrmConteudo>((de, ate) =>
        db
          .from("crm_conteudos")
          .select("*")
          .eq("ativo", true)
          .order("publicado_em", { ascending: false })
          .range(de, ate),
      ),
      todas<MencaoPauta>((de, ate) =>
        db
          .from("crm_mencoes")
          .select(
            "id, article_id, conteudo_id, empresa_id, pessoa_id, papel, empresa:crm_empresas(id, nome, grupo), pessoa:crm_pessoas(id, nome)",
          )
          .eq("ativo", true)
          .range(de, ate),
      ),
    ]);
    const empresas: Record<string, number> = {};
    const pessoas: Record<string, number> = {};
    for (const m of mencoes) {
      if (m.empresa_id) empresas[m.empresa_id] = (empresas[m.empresa_id] ?? 0) + 1;
      if (m.pessoa_id) pessoas[m.pessoa_id] = (pessoas[m.pessoa_id] ?? 0) + 1;
    }
    return { artigos, conteudos, mencoes, aparicoes: { empresas, pessoas } };
  });

export type ConteudoInput = {
  id?: string;
  article_id?: string | null;
  canal: CrmCanalConteudo;
  formato?: string | null;
  titulo?: string | null;
  url?: string | null;
  publicado_em?: string | null;
  collab_aceito?: boolean | null;
  ativo?: boolean;
};

/** Post/carrossel/reels nas redes, ligado (ou não) a uma matéria do site. */
export const saveConteudo = createServerFn({ method: "POST" })
  .middleware([requireCrmAccess])
  .inputValidator((input: ConteudoInput) => input)
  .handler(async ({ data, context }) => {
    const row = {
      article_id: uuid(data.article_id),
      canal: umDe(data.canal, CANAIS, "Canal") ?? "instagram",
      formato: texto(data.formato, 40),
      titulo: texto(data.titulo, 300),
      url: url(data.url),
      publicado_em: instante(data.publicado_em),
      collab_aceito: data.collab_aceito == null ? null : bool(data.collab_aceito),
      ativo: data.ativo !== false,
    };
    if (data.id) {
      const id = uuidObrigatorio(data.id, "o conteúdo");
      checar(await context.db.from("crm_conteudos").update(row).eq("id", id).select("id").single());
      return { id };
    }
    const novo = checar(
      await context.db.from("crm_conteudos").insert(row).select("id").single(),
    ) as { id: string };
    return { id: novo.id };
  });

async function acharOuCriar(
  db: CrmDb,
  tabela: "crm_empresas" | "crm_pessoas",
  nome: string,
  extra: Record<string, unknown>,
): Promise<string> {
  const existente = checar(
    await db.from(tabela).select("id, nome").ilike("nome", nome.replace(/[%_]/g, "\\$&")).limit(5),
  ) as { id: string; nome: string }[];
  const igual = existente.find((e) => e.nome.trim().toLowerCase() === nome.trim().toLowerCase());
  if (igual) return igual.id;
  const novo = checar(
    await db
      .from(tabela)
      .insert({ nome, ...extra })
      .select("id")
      .single(),
  ) as { id: string };
  return novo.id;
}

export type MencaoInput = {
  article_id?: string | null;
  conteudo_id?: string | null;
  empresa_id?: string | null;
  empresa_nome?: string | null;
  empresa_brasileira?: boolean;
  pessoa_id?: string | null;
  pessoa_nome?: string | null;
  cargo?: string | null;
  papel?: CrmPapelMencao;
};

/** Marca empresa e/ou pessoa citada. Cria o cadastro se ainda não existir (empresa pelo nome, sem diferença de maiúsculas). */
export const marcarMencao = createServerFn({ method: "POST" })
  .middleware([requireCrmAccess])
  .inputValidator((input: MencaoInput) => input)
  .handler(async ({ data, context }) => {
    const { db } = context;
    const articleId = uuid(data.article_id);
    const conteudoId = uuid(data.conteudo_id);
    if (!articleId && !conteudoId) throw new Error("Escolha a matéria ou o post.");
    const papel = umDe(data.papel, PAPEIS, "Papel") ?? "citada";

    let empresaId = uuid(data.empresa_id);
    const empresaNome = texto(data.empresa_nome, 200);
    if (!empresaId && empresaNome) {
      empresaId = await acharOuCriar(db, "crm_empresas", empresaNome, {
        origem: "materia",
        brasileira: data.empresa_brasileira !== false,
      });
    }
    let pessoaId = uuid(data.pessoa_id);
    const pessoaNome = texto(data.pessoa_nome, 200);
    if (!pessoaId && pessoaNome)
      pessoaId = await acharOuCriar(db, "crm_pessoas", pessoaNome, { origem: "materia" });
    if (!empresaId && !pessoaId) throw new Error("Informe a empresa ou a pessoa citada.");

    // Pessoa e empresa citadas juntas ficam ligadas (cargo opcional).
    if (empresaId && pessoaId) {
      const cargo = texto(data.cargo, 160);
      const atual = checar(
        await db
          .from("crm_empresa_pessoas")
          .select("cargo")
          .eq("empresa_id", empresaId)
          .eq("pessoa_id", pessoaId)
          .maybeSingle(),
      ) as { cargo: string | null } | null;
      if (!atual) {
        checar(
          await db.from("crm_empresa_pessoas").insert({
            empresa_id: empresaId,
            pessoa_id: pessoaId,
            cargo,
            decisor:
              /(fundador|founder|ceo|s[oó]ci|diretor|presidente|head|dono)/i.test(cargo ?? "") ||
              papel === "protagonista",
          }),
        );
      } else if (cargo && !atual.cargo) {
        checar(
          await db
            .from("crm_empresa_pessoas")
            .update({ cargo })
            .eq("empresa_id", empresaId)
            .eq("pessoa_id", pessoaId),
        );
      }
    }

    // Repetição: quantas vezes já apareceram antes desta marcação.
    const [antesEmp, antesPes] = await Promise.all([
      empresaId
        ? db
            .from("crm_mencoes")
            .select("id", { count: "exact", head: true })
            .eq("empresa_id", empresaId)
            .eq("ativo", true)
        : Promise.resolve({ count: 0 }),
      pessoaId
        ? db
            .from("crm_mencoes")
            .select("id", { count: "exact", head: true })
            .eq("pessoa_id", pessoaId)
            .eq("ativo", true)
        : Promise.resolve({ count: 0 }),
    ]);

    let q = db.from("crm_mencoes").select("id").limit(1);
    q = articleId ? q.eq("article_id", articleId) : q.is("article_id", null);
    q = conteudoId ? q.eq("conteudo_id", conteudoId) : q.is("conteudo_id", null);
    q = empresaId ? q.eq("empresa_id", empresaId) : q.is("empresa_id", null);
    q = pessoaId ? q.eq("pessoa_id", pessoaId) : q.is("pessoa_id", null);
    const existente = (checar(await q) as { id: string }[])[0];
    if (existente) {
      checar(await db.from("crm_mencoes").update({ ativo: true, papel }).eq("id", existente.id));
    } else {
      checar(
        await db.from("crm_mencoes").insert({
          article_id: articleId,
          conteudo_id: conteudoId,
          empresa_id: empresaId,
          pessoa_id: pessoaId,
          papel,
        }),
      );
    }
    return {
      empresa_id: empresaId,
      pessoa_id: pessoaId,
      repeticao: { empresa: antesEmp.count ?? 0, pessoa: antesPes.count ?? 0 },
    };
  });

/** Desmarca uma menção (fica inativa, sem apagar). */
export const desmarcarMencao = createServerFn({ method: "POST" })
  .middleware([requireCrmAccess])
  .inputValidator((input: { id: string }) => ({ id: uuidObrigatorio(input?.id, "a menção") }))
  .handler(async ({ data, context }) => {
    checar(await context.db.from("crm_mencoes").update({ ativo: false }).eq("id", data.id));
    return { ok: true };
  });

export type Sugestao = {
  tipo: "empresa" | "pessoa";
  nome: string;
  /** Já cadastrada? */
  id: string | null;
  motivo: string;
  empresa?: string | null;
  cargo?: string | null;
  brasileira?: boolean | null;
};

/** Sugestão automática de menções a partir do título, texto e tags (e da IA, quando configurada). */
export const sugerirMencoes = createServerFn({ method: "POST" })
  .middleware([requireCrmAccess])
  .inputValidator((input: { article_id: string }) => ({
    article_id: uuidObrigatorio(input?.article_id, "a matéria"),
  }))
  .handler(async ({ data, context }): Promise<{ sugestoes: Sugestao[]; ia: boolean }> => {
    const { db } = context;
    const artigo = checar(
      await db
        .from("articles")
        .select("id, title, dek, tags, body_markdown")
        .eq("id", data.article_id)
        .single(),
    ) as {
      id: string;
      title: string;
      dek: string | null;
      tags: string[] | null;
      body_markdown: string | null;
    };

    const [empresas, pessoas, jaMarcadas] = await Promise.all([
      todas<{ id: string; nome: string }>((de, ate) =>
        db.from("crm_empresas").select("id, nome").eq("ativo", true).range(de, ate),
      ),
      todas<{ id: string; nome: string }>((de, ate) =>
        db.from("crm_pessoas").select("id, nome").eq("ativo", true).range(de, ate),
      ),
      todas<{ empresa_id: string | null; pessoa_id: string | null }>((de, ate) =>
        db
          .from("crm_mencoes")
          .select("empresa_id, pessoa_id")
          .eq("article_id", data.article_id)
          .eq("ativo", true)
          .range(de, ate),
      ),
    ]);
    const marcadas = new Set(
      jaMarcadas.flatMap((m) => [m.empresa_id, m.pessoa_id]).filter(Boolean) as string[],
    );

    const textoCompleto = [
      artigo.title,
      artigo.dek,
      (artigo.tags ?? []).join(" · "),
      artigo.body_markdown,
    ]
      .filter(Boolean)
      .join("\n");
    const sugestoes: Sugestao[] = [];
    const add = (s: Sugestao) => {
      if (s.id && marcadas.has(s.id)) return;
      const chave = `${s.tipo}:${s.nome.toLowerCase()}`;
      if (sugestoes.some((x) => `${x.tipo}:${x.nome.toLowerCase()}` === chave)) return;
      sugestoes.push(s);
    };

    // 1. Cadastros que aparecem no texto.
    for (const e of encontrarCitados(textoCompleto, empresas))
      add({ tipo: "empresa", nome: e.nome, id: e.id, motivo: "citada no texto" });
    for (const p of encontrarCitados(textoCompleto, pessoas))
      add({ tipo: "pessoa", nome: p.nome, id: p.id, motivo: "citada no texto" });

    // 2. Padrão dos títulos da IANews ("Pessoa, da Empresa, ..." / "Empresa, de Pessoa, ...").
    const acha = (lista: { id: string; nome: string }[], nome: string) =>
      lista.find((i) => i.nome.trim().toLowerCase() === nome.trim().toLowerCase())?.id ?? null;
    for (const c of candidatosDoTitulo(artigo.title)) {
      add({
        tipo: c.tipo,
        nome: c.nome,
        id: acha(c.tipo === "empresa" ? empresas : pessoas, c.nome),
        motivo: "título",
        empresa: c.empresa,
      });
    }

    // 3. IA (quando AI_API_KEY está configurada): empresas e pessoas citadas no texto.
    let ia = false;
    try {
      const { sugerirComIa } = await import("./mencoes-ia.server");
      const r = await sugerirComIa(artigo);
      if (r) {
        ia = true;
        for (const e of r.empresas)
          add({
            tipo: "empresa",
            nome: e.nome,
            id: acha(empresas, e.nome),
            motivo: "IA",
            brasileira: e.brasileira,
          });
        for (const p of r.pessoas)
          add({
            tipo: "pessoa",
            nome: p.nome,
            id: acha(pessoas, p.nome),
            motivo: "IA",
            empresa: p.empresa,
            cargo: p.cargo,
          });
      }
    } catch (err) {
      console.error("[crm] sugestão por IA falhou", err instanceof Error ? err.message : err);
    }
    return { sugestoes, ia };
  });
