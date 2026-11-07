import { createServerFn } from "@tanstack/react-start";

import { checar, dia, exigirAdmin, requireCrmAccess, texto, umDe, uuidObrigatorio } from "./access";

/* Fila do dia: o banco monta os contatos (auto_montar_fila) dentro do limite de cada canal;
   a equipe abre o perfil, cola a mensagem pronta e marca como enviada. */

export type FilaCanal = "direct" | "email" | "linkedin" | "whatsapp";
export type FilaStatus = "pendente" | "enviado" | "pulado" | "respondeu" | "falhou" | "expirado";

export type FilaItem = {
  id: string;
  dia: string;
  canal: FilaCanal;
  passo: "D0" | "D3" | "D7" | "D15" | "D21" | "previa" | "data" | "publicado" | "resposta";
  negocio_id: string;
  empresa_id: string | null;
  pessoa_id: string | null;
  nota: number | null;
  destino: string | null;
  link: string | null;
  assunto: string | null;
  mensagem: string;
  status: FilaStatus;
  automatico: boolean;
  enviado_em: string | null;
  motivo: string | null;
  pessoa_nome: string | null;
  empresa_nome: string | null;
  negocio_titulo: string | null;
};

export type Painel = {
  hoje: string;
  pausado: boolean;
  limites: Record<string, number>;
  nota_corte: number;
  fila: Record<
    string,
    { total: number; d0: number; pendente: number; enviado: number; pulado: number }
  >;
  ultimos_14: { enviadas: number; recebidas: number; pagamentos: number };
  receita_mes: number;
  pagamentos_pendentes: number;
  briefings: { abertos: number; enviados: number; em_producao: number };
  elegiveis: number;
  alertas: { canal: string; tipo: string; n: number }[];
  quentes_sem_resposta: number;
};

export const listFila = createServerFn({ method: "GET" })
  .middleware([requireCrmAccess])
  .inputValidator((input: { dia?: string | null }) => ({ dia: dia(input?.dia) }))
  .handler(async ({ data, context }): Promise<FilaItem[]> => {
    const { db } = context;
    let q = db
      .from("auto_fila")
      .select(
        "*, pessoa:crm_pessoas(nome), empresa:crm_empresas(nome), negocio:crm_negocios(titulo)",
      )
      .order("canal")
      .order("passo")
      .order("nota", { ascending: false, nullsFirst: false })
      .limit(500);
    q = data.dia ? q.eq("dia", data.dia) : q.eq("status", "pendente");
    const rows = checar(await q) as (FilaItem & {
      pessoa: { nome: string } | null;
      empresa: { nome: string } | null;
      negocio: { titulo: string } | null;
    })[];
    return rows.map(({ pessoa, empresa, negocio, ...r }) => ({
      ...r,
      pessoa_nome: pessoa?.nome ?? null,
      empresa_nome: empresa?.nome ?? null,
      negocio_titulo: negocio?.titulo ?? null,
    }));
  });

export const painelFila = createServerFn({ method: "GET" })
  .middleware([requireCrmAccess])
  .handler(async ({ context }): Promise<Painel> => {
    const { db } = context;
    const painel = checar(await db.rpc("auto_painel")) as Painel;
    const eleg = checar(await db.rpc("auto_elegiveis")) as number;
    return { ...painel, elegiveis: eleg ?? painel.elegiveis };
  });

export const marcarFila = createServerFn({ method: "POST" })
  .middleware([requireCrmAccess])
  .inputValidator((input: { id: string; status: string; motivo?: string | null }) => {
    const status = umDe(
      input?.status,
      ["enviado", "pulado", "respondeu", "falhou", "pendente"] as const,
      "Status",
    );
    if (!status) throw new Error("Informe o status.");
    return {
      id: uuidObrigatorio(input?.id, "o item da fila"),
      status,
      motivo: texto(input?.motivo, 200),
    };
  })
  .handler(async ({ data, context }) => {
    return checar(
      await context.db.rpc("auto_marcar", {
        p_id: data.id,
        p_status: data.status,
        p_motivo: data.motivo,
      }),
    );
  });

export const montarFila = createServerFn({ method: "POST" })
  .middleware([requireCrmAccess])
  .handler(async ({ context }) => {
    return checar(await context.db.rpc("auto_montar_fila", {})) as {
      ok?: boolean;
      primeiros_contatos?: number;
      follow_ups?: number;
      fim_de_semana?: boolean;
      pausado?: boolean;
    };
  });

export const salvarConfigFila = createServerFn({ method: "POST" })
  .middleware([requireCrmAccess])
  .inputValidator(
    (input: { limites?: Record<string, number>; nota_corte?: number; pausado?: boolean }) =>
      input ?? {},
  )
  .handler(async ({ data, context }) => {
    exigirAdmin(context.isAdmin);
    const { db } = context;
    const salvar = async (chave: string, valor: unknown) =>
      checar(
        await db
          .from("auto_config")
          .update({ valor, updated_at: new Date().toISOString() })
          .eq("chave", chave)
          .select("chave")
          .single(),
      );
    if (data.limites) {
      const limpo: Record<string, number> = {};
      for (const k of ["direct", "email", "linkedin"]) {
        const n = Math.round(Number(data.limites[k] ?? 0));
        if (!Number.isFinite(n) || n < 0 || n > 200) throw new Error(`Limite inválido para ${k}.`);
        limpo[k] = n;
      }
      limpo.whatsapp = 0; // WhatsApp frio é sempre zero
      await salvar("limites", limpo);
    }
    if (data.nota_corte != null) {
      const n = Math.round(Number(data.nota_corte));
      if (!Number.isFinite(n) || n < 0 || n > 100) throw new Error("Nota de corte entre 0 e 100.");
      await salvar("nota_corte", n);
    }
    if (typeof data.pausado === "boolean") await salvar("pausado", data.pausado);
    return { ok: true };
  });
