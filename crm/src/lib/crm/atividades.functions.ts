import { createServerFn } from "@tanstack/react-start";

import { checar, requireCrmAccess, texto, umDe, uuid } from "./access";
import type { CrmAtividadeTipo, CrmModelo } from "./types";

/* Conversas e atividades (linha do tempo) e modelos de mensagem da Renata. */

const TIPOS_MANUAIS = [
  "mensagem_enviada",
  "mensagem_recebida",
  "ligacao",
  "reuniao",
  "nota",
  "email",
  "proposta",
  "pagamento",
] as const satisfies readonly CrmAtividadeTipo[];

export type AtividadeInput = {
  tipo: (typeof TIPOS_MANUAIS)[number];
  canal?: string | null;
  texto?: string | null;
  empresa_id?: string | null;
  pessoa_id?: string | null;
  negocio_id?: string | null;
  modelo_id?: string | null;
  /** Ao registrar envio: conclui esta tarefa junto. */
  tarefa_id?: string | null;
};

/**
 * Registra uma atividade. Regras do funil Matéria:
 *  - 1ª mensagem enviada com o negócio em "Novo" leva para "Contatado";
 *  - mensagem recebida com o negócio em "Contatado" ou "Sem resposta" leva para "Respondeu".
 */
export const registrarAtividade = createServerFn({ method: "POST" })
  .middleware([requireCrmAccess])
  .inputValidator((input: AtividadeInput) => ({
    tipo: umDe(input?.tipo, TIPOS_MANUAIS, "Tipo de atividade") ?? "nota",
    canal: texto(input?.canal, 40),
    texto: texto(input?.texto, 8000),
    empresa_id: uuid(input?.empresa_id),
    pessoa_id: uuid(input?.pessoa_id),
    negocio_id: uuid(input?.negocio_id),
    modelo_id: uuid(input?.modelo_id),
    tarefa_id: uuid(input?.tarefa_id),
  }))
  .handler(async ({ data, context }) => {
    const { db } = context;
    let { empresa_id, pessoa_id } = data;
    type NegocioEtapa = {
      id: string;
      funil_id: string;
      etapa_nome: string;
      empresa_id: string | null;
      pessoa_id: string | null;
    };
    let negocio: NegocioEtapa | null = null;
    if (data.negocio_id) {
      const n = checar(
        await db
          .from("crm_negocios_resumo")
          .select("id, funil_id, etapa_nome, empresa_id, pessoa_id")
          .eq("id", data.negocio_id)
          .single(),
      ) as NegocioEtapa;
      negocio = n;
      empresa_id = empresa_id ?? n.empresa_id;
      pessoa_id = pessoa_id ?? n.pessoa_id;
    }
    if (!empresa_id && !pessoa_id && !data.negocio_id)
      throw new Error("Informe a empresa, a pessoa ou o negócio.");
    if (data.tipo === "nota" && !data.texto) throw new Error("Escreva a nota.");

    checar(
      await db.from("crm_atividades").insert({
        tipo: data.tipo,
        canal: data.canal,
        texto: data.texto,
        empresa_id,
        pessoa_id,
        negocio_id: data.negocio_id,
        modelo_id: data.modelo_id,
      }),
    );

    let movidoPara: string | null = null;
    if (negocio && negocio.funil_id === "materia") {
      const destino =
        data.tipo === "mensagem_enviada" && negocio.etapa_nome === "Novo"
          ? "Contatado"
          : data.tipo === "mensagem_recebida" &&
              ["Contatado", "Sem resposta"].includes(negocio.etapa_nome)
            ? "Respondeu"
            : null;
      if (destino) {
        const etapa = checar(
          await db
            .from("crm_etapas")
            .select("id")
            .eq("funil_id", "materia")
            .eq("nome", destino)
            .single(),
        ) as { id: string };
        checar(
          await db
            .from("crm_negocios")
            .update({ etapa_id: etapa.id })
            .eq("id", negocio.id)
            .select("id")
            .single(),
        );
        movidoPara = destino;
      }
    }

    if (data.tarefa_id) {
      checar(await db.from("crm_tarefas").update({ feita: true }).eq("id", data.tarefa_id));
    }
    return { ok: true, movidoPara };
  });

export const listModelos = createServerFn({ method: "GET" })
  .middleware([requireCrmAccess])
  .handler(async ({ context }): Promise<CrmModelo[]> => {
    return (checar(
      await context.db
        .from("crm_modelos")
        .select("id, nome, canal, etapa_id, texto, ordem, ativo")
        .order("ordem")
        .order("nome"),
    ) ?? []) as CrmModelo[];
  });
