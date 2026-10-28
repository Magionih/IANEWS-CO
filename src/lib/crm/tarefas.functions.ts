import { createServerFn } from "@tanstack/react-start";

import {
  bool,
  checar,
  dia,
  obrigatorio,
  requireCrmAccess,
  texto,
  todas,
  uuid,
  uuidObrigatorio,
} from "./access";
import { hidratarTarefas } from "./carregar";
import type { CrmTarefa, CrmTarefaItem } from "./types";

/* Tarefas por pessoa da equipe, ligadas a lead, empresa ou negócio. As automáticas vêm das cadências. */

export const listTarefas = createServerFn({ method: "GET" })
  .middleware([requireCrmAccess])
  .inputValidator(
    (input: { de?: string | null; ate?: string | null; incluirFeitas?: boolean }) => ({
      de: dia(input?.de),
      ate: dia(input?.ate),
      incluirFeitas: bool(input?.incluirFeitas),
    }),
  )
  .handler(async ({ data, context }): Promise<CrmTarefaItem[]> => {
    const { db } = context;
    const tarefas = await todas<CrmTarefa>((de, ate) => {
      let q = db.from("crm_tarefas").select("*").eq("cancelada", false);
      if (!data.incluirFeitas) q = q.eq("feita", false);
      if (data.de) q = q.gte("vence_em", data.de);
      if (data.ate) q = q.lte("vence_em", data.ate);
      return q
        .order("vence_em", { ascending: true, nullsFirst: false })
        .order("created_at")
        .range(de, ate);
    }, 5000);
    return hidratarTarefas(db, tarefas);
  });

export type TarefaInput = {
  id?: string;
  titulo?: string;
  descricao?: string | null;
  vence_em?: string | null;
  responsavel_id?: string | null;
  empresa_id?: string | null;
  pessoa_id?: string | null;
  negocio_id?: string | null;
};

export const saveTarefa = createServerFn({ method: "POST" })
  .middleware([requireCrmAccess])
  .inputValidator((input: TarefaInput) => input)
  .handler(async ({ data, context }) => {
    const { db } = context;
    const row: Record<string, unknown> = {};
    const campo = <K extends keyof TarefaInput>(k: K, valor: () => unknown) => {
      if (k in data) row[k] = valor();
    };
    if (!data.id || "titulo" in data)
      row.titulo = obrigatorio(data.titulo, "o título da tarefa", 300);
    campo("descricao", () => texto(data.descricao, 4000));
    campo("vence_em", () => dia(data.vence_em));
    campo("responsavel_id", () => uuid(data.responsavel_id));
    campo("empresa_id", () => uuid(data.empresa_id));
    campo("pessoa_id", () => uuid(data.pessoa_id));
    campo("negocio_id", () => uuid(data.negocio_id));
    if (!data.id && !("responsavel_id" in data)) row.responsavel_id = context.userId;

    if (data.id) {
      const id = uuidObrigatorio(data.id, "a tarefa");
      checar(await db.from("crm_tarefas").update(row).eq("id", id).select("id").single());
      return { id };
    }
    const nova = checar(await db.from("crm_tarefas").insert(row).select("id").single()) as {
      id: string;
    };
    return { id: nova.id };
  });

export const concluirTarefa = createServerFn({ method: "POST" })
  .middleware([requireCrmAccess])
  .inputValidator((input: { id: string; feita: boolean }) => ({
    id: uuidObrigatorio(input?.id, "a tarefa"),
    feita: bool(input?.feita),
  }))
  .handler(async ({ data, context }) => {
    checar(
      await context.db
        .from("crm_tarefas")
        .update({ feita: data.feita })
        .eq("id", data.id)
        .select("id")
        .single(),
    );
    return { ok: true };
  });

/** Tarefa que não faz mais sentido sai das listas (sem apagar). */
export const cancelarTarefa = createServerFn({ method: "POST" })
  .middleware([requireCrmAccess])
  .inputValidator((input: { id: string }) => ({ id: uuidObrigatorio(input?.id, "a tarefa") }))
  .handler(async ({ data, context }) => {
    checar(
      await context.db
        .from("crm_tarefas")
        .update({ cancelada: true })
        .eq("id", data.id)
        .select("id")
        .single(),
    );
    return { ok: true };
  });
