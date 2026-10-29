import { createServerFn } from "@tanstack/react-start";

import {
  checar,
  dia,
  dinheiro,
  obrigatorio,
  requireCrmAccess,
  texto,
  umDe,
  uuid,
  uuidObrigatorio,
} from "./access";
import { carregarNegocios, type NegocioCompleto } from "./carregar";
import type { CrmAtividade, CrmCampanha, CrmFunilId, CrmStatusPagamento, CrmTarefa } from "./types";

/* Negócios: uma oportunidade num funil, ligada a empresa e pessoa, numa etapa.
   Mudar a etapa grava a linha do tempo e cria a tarefa da ação padrão (gatilhos no banco). */

const FUNIS = ["materia", "publicidade", "parcerias"] as const;
const PAGAMENTOS = ["pendente", "pago", "cortesia", "cancelado"] as const;

export const listNegocios = createServerFn({ method: "GET" })
  .middleware([requireCrmAccess])
  .inputValidator((input: { funil_id?: CrmFunilId | "todos" }) => ({
    funil_id:
      input?.funil_id && input.funil_id !== "todos" ? umDe(input.funil_id, FUNIS, "Funil") : null,
  }))
  .handler(async ({ data, context }): Promise<NegocioCompleto[]> => {
    return carregarNegocios(context.db, (q) =>
      data.funil_id ? q.eq("funil_id", data.funil_id) : q,
    );
  });

export type DetalheNegocio = {
  negocio: NegocioCompleto;
  atividades: CrmAtividade[];
  tarefas: CrmTarefa[];
  campanhas: CrmCampanha[];
};

export const getNegocio = createServerFn({ method: "GET" })
  .middleware([requireCrmAccess])
  .inputValidator((input: { id: string }) => ({ id: uuidObrigatorio(input?.id, "o negócio") }))
  .handler(async ({ data, context }): Promise<DetalheNegocio> => {
    const { db } = context;
    const [lista, atv, tar, camp] = await Promise.all([
      carregarNegocios(db, (q) => q.eq("id", data.id), { incluirInativos: true }),
      db
        .from("crm_atividades")
        .select("*")
        .eq("negocio_id", data.id)
        .order("created_at", { ascending: false })
        .limit(300),
      db
        .from("crm_tarefas")
        .select("*")
        .eq("negocio_id", data.id)
        .eq("cancelada", false)
        .order("vence_em")
        .limit(100),
      db
        .from("crm_campanhas")
        .select("*")
        .eq("negocio_id", data.id)
        .order("created_at", { ascending: false }),
    ]);
    if (!lista[0]) throw new Error("Negócio não encontrado.");
    return {
      negocio: lista[0],
      atividades: (checar(atv) ?? []) as CrmAtividade[],
      tarefas: (checar(tar) ?? []) as CrmTarefa[],
      campanhas: (checar(camp) ?? []) as CrmCampanha[],
    };
  });

export type NegocioInput = {
  id?: string;
  titulo?: string;
  funil_id?: CrmFunilId;
  etapa_id?: string | null;
  empresa_id?: string | null;
  pessoa_id?: string | null;
  tipo?: string | null;
  valor?: number | string | null;
  status_pagamento?: CrmStatusPagamento;
  origem?: string | null;
  canal_origem?: string | null;
  article_id?: string | null;
  conteudo_id?: string | null;
  dono_id?: string | null;
  proxima_acao?: string | null;
  proxima_acao_em?: string | null;
  motivo_perda?: string | null;
  ativo?: boolean;
};

export const saveNegocio = createServerFn({ method: "POST" })
  .middleware([requireCrmAccess])
  .inputValidator((input: NegocioInput) => input)
  .handler(async ({ data, context }) => {
    const { db } = context;
    const row: Record<string, unknown> = {};
    const campo = <K extends keyof NegocioInput>(k: K, valor: () => unknown) => {
      if (k in data) row[k] = valor();
    };
    if (!data.id || "titulo" in data)
      row.titulo = obrigatorio(data.titulo, "o título do negócio", 300);
    if (!data.id || "funil_id" in data)
      row.funil_id = umDe(data.funil_id, FUNIS, "Funil") ?? "materia";
    campo("etapa_id", () => uuid(data.etapa_id));
    campo("empresa_id", () => uuid(data.empresa_id));
    campo("pessoa_id", () => uuid(data.pessoa_id));
    campo("tipo", () => texto(data.tipo, 60));
    campo("valor", () => dinheiro(data.valor));
    campo(
      "status_pagamento",
      () => umDe(data.status_pagamento, PAGAMENTOS, "Status de pagamento") ?? "pendente",
    );
    campo("origem", () => texto(data.origem, 40));
    campo("canal_origem", () => texto(data.canal_origem, 40));
    campo("article_id", () => uuid(data.article_id));
    campo("conteudo_id", () => uuid(data.conteudo_id));
    campo("dono_id", () => uuid(data.dono_id));
    campo("proxima_acao", () => texto(data.proxima_acao, 300));
    campo("proxima_acao_em", () => dia(data.proxima_acao_em));
    campo("motivo_perda", () => texto(data.motivo_perda, 500));
    campo("ativo", () => data.ativo !== false);
    if (!data.id && !("dono_id" in data)) row.dono_id = context.userId;

    if (data.id) {
      const id = uuidObrigatorio(data.id, "o negócio");
      checar(await db.from("crm_negocios").update(row).eq("id", id).select("id").single());
      return { id };
    }
    const novo = checar(await db.from("crm_negocios").insert(row).select("id").single()) as {
      id: string;
    };
    return { id: novo.id };
  });

/** Arrastar no kanban: muda a etapa (o banco registra a mudança e cria a tarefa da etapa). */
export const moverNegocio = createServerFn({ method: "POST" })
  .middleware([requireCrmAccess])
  .inputValidator((input: { id: string; etapa_id: string; motivo_perda?: string | null }) => ({
    id: uuidObrigatorio(input?.id, "o negócio"),
    etapa_id: uuidObrigatorio(input?.etapa_id, "a etapa"),
    motivo_perda: texto(input?.motivo_perda, 500),
  }))
  .handler(async ({ data, context }) => {
    const row: Record<string, unknown> = { etapa_id: data.etapa_id };
    if (data.motivo_perda) row.motivo_perda = data.motivo_perda;
    checar(
      await context.db.from("crm_negocios").update(row).eq("id", data.id).select("id").single(),
    );
    return { ok: true };
  });

/** "Criar lead": empresa citada em matéria/post vira negócio no funil Matéria, já com o link da matéria. */
export const criarLeadDeEmpresa = createServerFn({ method: "POST" })
  .middleware([requireCrmAccess])
  .inputValidator(
    (input: {
      empresa_id: string;
      article_id?: string | null;
      conteudo_id?: string | null;
      origem?: string;
    }) => ({
      empresa_id: uuidObrigatorio(input?.empresa_id, "a empresa"),
      article_id: uuid(input?.article_id),
      conteudo_id: uuid(input?.conteudo_id),
      origem: texto(input?.origem, 40) ?? "virou_pauta",
    }),
  )
  .handler(async ({ data, context }) => {
    const { db } = context;
    const empresa = checar(
      await db.from("crm_empresas").select("id, nome, dono_id").eq("id", data.empresa_id).single(),
    ) as { id: string; nome: string; dono_id: string | null };

    // Já tem negócio aberto? Não duplica.
    const abertos = checar(
      await db
        .from("crm_negocios_resumo")
        .select("id")
        .eq("empresa_id", data.empresa_id)
        .eq("ativo", true)
        .eq("etapa_tipo", "aberta")
        .limit(1),
    ) as { id: string }[];
    if (abertos[0]) return { id: abertos[0].id, existente: true };

    // Pessoa principal: o decisor (ou o primeiro contato ligado à empresa).
    const vinculos = checar(
      await db
        .from("crm_empresa_pessoas")
        .select("pessoa_id, decisor")
        .eq("empresa_id", data.empresa_id),
    ) as { pessoa_id: string; decisor: boolean }[];
    const pessoaId = (vinculos.find((v) => v.decisor) ?? vinculos[0])?.pessoa_id ?? null;

    // Sem matéria informada: usa a menção mais recente.
    let articleId = data.article_id;
    let conteudoId = data.conteudo_id;
    if (!articleId && !conteudoId) {
      const fila = checar(
        await db
          .from("crm_viraram_pauta")
          .select("article_id")
          .eq("empresa_id", data.empresa_id)
          .maybeSingle(),
      ) as { article_id: string | null } | null;
      articleId = fila?.article_id ?? null;
    }
    if (articleId && !conteudoId) {
      const post = checar(
        await db
          .from("crm_conteudos")
          .select("id")
          .eq("article_id", articleId)
          .eq("ativo", true)
          .not("url", "is", null)
          .order("publicado_em", { ascending: false })
          .limit(1),
      ) as { id: string }[];
      conteudoId = post[0]?.id ?? null;
    }

    const novo = checar(
      await db
        .from("crm_negocios")
        .insert({
          titulo: `Virou pauta · ${empresa.nome}`,
          funil_id: "materia",
          empresa_id: empresa.id,
          pessoa_id: pessoaId,
          origem: data.origem,
          canal_origem: "instagram",
          article_id: articleId,
          conteudo_id: conteudoId,
          dono_id: empresa.dono_id ?? context.userId,
        })
        .select("id")
        .single(),
    ) as { id: string };
    return { id: novo.id, existente: false };
  });
