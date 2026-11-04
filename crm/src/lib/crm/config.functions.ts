import { createServerFn } from "@tanstack/react-start";

import { CORES_TAG } from "./types";
import {
  checar,
  exigirAdmin,
  inteiro,
  obrigatorio,
  requireCrmAccess,
  texto,
  umDe,
  uuid,
  uuidObrigatorio,
} from "./access";

/* Configuração (só admin): funis, etapas, prazos, modelos de mensagem, usuários e papéis. */

const TIPOS_ETAPA = ["aberta", "ganha", "perdida"] as const;
const FUNIS = ["materia", "publicidade", "parcerias"] as const;
export const PAPEIS_EQUIPE = ["admin", "comercial", "editorial", "reader"] as const;
export type PapelEquipe = (typeof PAPEIS_EQUIPE)[number];

export type EtapaInput = {
  id?: string;
  funil_id?: string;
  nome?: string;
  ordem?: number | string;
  prazo_dias?: number | string | null;
  acao_padrao?: string | null;
  criterio_entrada?: string | null;
  tipo?: string;
  ativo?: boolean;
};

export const saveEtapa = createServerFn({ method: "POST" })
  .middleware([requireCrmAccess])
  .inputValidator((input: EtapaInput) => input)
  .handler(async ({ data, context }) => {
    exigirAdmin(context.isAdmin);
    const row = {
      nome: obrigatorio(data.nome, "o nome da etapa", 80),
      ordem: inteiro(data.ordem, 0, 999) ?? 0,
      prazo_dias: inteiro(data.prazo_dias, 0, 365),
      acao_padrao: texto(data.acao_padrao, 200),
      criterio_entrada: texto(data.criterio_entrada, 300),
      tipo: umDe(data.tipo, TIPOS_ETAPA, "Tipo de etapa") ?? "aberta",
      ativo: data.ativo !== false,
    };
    if (data.id) {
      const id = uuidObrigatorio(data.id, "a etapa");
      checar(await context.db.from("crm_etapas").update(row).eq("id", id).select("id").single());
      return { id };
    }
    const nova = checar(
      await context.db
        .from("crm_etapas")
        .insert({ ...row, funil_id: umDe(data.funil_id, FUNIS, "Funil") ?? "materia" })
        .select("id")
        .single(),
    ) as { id: string };
    return { id: nova.id };
  });

export const saveFunil = createServerFn({ method: "POST" })
  .middleware([requireCrmAccess])
  .inputValidator((input: { id: string; nome: string; ativo?: boolean }) => input)
  .handler(async ({ data, context }) => {
    exigirAdmin(context.isAdmin);
    const id = umDe(data.id, FUNIS, "Funil");
    checar(
      await context.db
        .from("crm_funis")
        .update({
          nome: obrigatorio(data.nome, "o nome do funil", 80),
          ativo: data.ativo !== false,
        })
        .eq("id", id)
        .select("id")
        .single(),
    );
    return { ok: true };
  });

export type ModeloInput = {
  id?: string;
  nome?: string;
  canal?: string | null;
  etapa_id?: string | null;
  texto?: string;
  ordem?: number | string;
  ativo?: boolean;
};

export const saveModelo = createServerFn({ method: "POST" })
  .middleware([requireCrmAccess])
  .inputValidator((input: ModeloInput) => input)
  .handler(async ({ data, context }) => {
    exigirAdmin(context.isAdmin);
    const corpo = obrigatorio(data.texto, "o texto do modelo", 4000);
    // Regra da casa: assinatura sempre no feminino.
    if (/renata,? do ia news/i.test(corpo))
      throw new Error('A assinatura é "Renata, da IA News" (no feminino).');
    const row = {
      nome: obrigatorio(data.nome, "o nome do modelo", 120),
      canal: texto(data.canal, 40),
      etapa_id: uuid(data.etapa_id),
      texto: corpo,
      ordem: inteiro(data.ordem, 0, 9999) ?? 0,
      ativo: data.ativo !== false,
    };
    if (data.id) {
      const id = uuidObrigatorio(data.id, "o modelo");
      checar(await context.db.from("crm_modelos").update(row).eq("id", id).select("id").single());
      return { id };
    }
    const novo = checar(await context.db.from("crm_modelos").insert(row).select("id").single()) as {
      id: string;
    };
    return { id: novo.id };
  });

export type TagInput = {
  id?: string;
  nome?: string;
  cor?: string;
  descricao?: string | null;
  ordem?: number | string;
  ativo?: boolean;
};

/** Catálogo de tags estratégicas (só admin cria e edita; a equipe aplica nos negócios). */
export const saveTag = createServerFn({ method: "POST" })
  .middleware([requireCrmAccess])
  .inputValidator((input: TagInput) => input)
  .handler(async ({ data, context }) => {
    exigirAdmin(context.isAdmin);
    const row = {
      nome: obrigatorio(data.nome, "o nome da tag", 40),
      cor: umDe(data.cor, CORES_TAG, "Cor") ?? "azul",
      descricao: texto(data.descricao, 300),
      ordem: inteiro(data.ordem, 0, 9999) ?? 0,
      ativo: data.ativo !== false,
      updated_at: new Date().toISOString(),
    };
    if (data.id) {
      const id = uuidObrigatorio(data.id, "a tag");
      checar(await context.db.from("crm_tags").update(row).eq("id", id).select("id").single());
      return { id };
    }
    const nova = checar(await context.db.from("crm_tags").insert(row).select("id").single()) as {
      id: string;
    };
    return { id: nova.id };
  });

export type UsuarioPainel = {
  user_id: string;
  nome: string;
  email: string;
  papeis: string[];
  created_at: string;
};

/** Contas com os papéis (para liberar acesso ao CRM). Só admin; a função do banco confere o papel. */
export const listUsuarios = createServerFn({ method: "GET" })
  .middleware([requireCrmAccess])
  .handler(async ({ context }): Promise<UsuarioPainel[]> => {
    exigirAdmin(context.isAdmin);
    return (checar(await context.db.rpc("crm_usuarios")) ?? []) as UsuarioPainel[];
  });

/** Define o papel da conta (um papel por pessoa). "reader" = sem acesso ao CRM. */
export const setPapel = createServerFn({ method: "POST" })
  .middleware([requireCrmAccess])
  .inputValidator((input: { user_id: string; papel: PapelEquipe }) => ({
    user_id: uuidObrigatorio(input?.user_id, "a conta"),
    papel: umDe(input?.papel, PAPEIS_EQUIPE, "Papel") ?? "reader",
  }))
  .handler(async ({ data, context }) => {
    exigirAdmin(context.isAdmin);
    checar(
      await context.db.rpc("crm_definir_papel", { p_user: data.user_id, p_papel: data.papel }),
    );
    return { ok: true };
  });
