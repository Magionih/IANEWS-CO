import { createServerFn } from "@tanstack/react-start";

import { checar, porIds, requireCrmAccess, todas } from "./access";

/* Visão das verticais: quantos negócios há em cada etapa de cada funil, o que se moveu nos
   últimos 7 dias e as movimentações mais recentes. Os números vêm da view crm_visao_etapas
   (agregada no banco, com a RLS de quem consulta), então a tela não carrega milhares de cartões. */

export type EtapaResumo = {
  funil_id: string;
  etapa_id: string;
  qtd: number;
  valor: number;
  pagos: number;
  atencao: number;
  entraram_7d: number;
  novos_7d: number;
  hoje: number;
};

export type Movimento = {
  id: string;
  tipo: string;
  texto: string | null;
  created_at: string;
  negocio_id: string | null;
  funil_id: string | null;
  titulo: string | null;
};

export type VisaoVerticais = {
  etapas: EtapaResumo[];
  /** Por funil, últimos 7 dias: mudanças de etapa, mensagens enviadas e recebidas. */
  atividade7d: Record<string, { movidos: number; enviadas: number; recebidas: number }>;
  recentes: Movimento[];
};

const TIPOS = ["mudanca_etapa", "mensagem_enviada", "mensagem_recebida"] as const;

export const getVerticais = createServerFn({ method: "GET" })
  .middleware([requireCrmAccess])
  .handler(async ({ context }): Promise<VisaoVerticais> => {
    const { db } = context;
    const desde = new Date(Date.now() - 7 * 864e5).toISOString();
    const [etapasRes, atividades] = await Promise.all([
      db.from("crm_visao_etapas").select("*"),
      todas<Omit<Movimento, "funil_id" | "titulo">>(
        (de, ate) =>
          db
            .from("crm_atividades")
            .select("id, tipo, texto, created_at, negocio_id")
            .in("tipo", TIPOS as unknown as string[])
            .gte("created_at", desde)
            .order("created_at", { ascending: false })
            .range(de, ate),
        10_000,
      ),
    ]);
    const negocios = await porIds<{ id: string; funil_id: string; titulo: string }>(
      db,
      "crm_negocios",
      "id, funil_id, titulo",
      atividades.map((a) => a.negocio_id),
    );

    const atividade7d: VisaoVerticais["atividade7d"] = {};
    for (const a of atividades) {
      const f = a.negocio_id ? negocios.get(a.negocio_id)?.funil_id : undefined;
      if (!f) continue;
      const c = (atividade7d[f] ??= { movidos: 0, enviadas: 0, recebidas: 0 });
      if (a.tipo === "mudanca_etapa") c.movidos += 1;
      else if (a.tipo === "mensagem_enviada") c.enviadas += 1;
      else c.recebidas += 1;
    }

    const recentes = atividades.slice(0, 40).map((a) => {
      const n = a.negocio_id ? negocios.get(a.negocio_id) : undefined;
      return { ...a, funil_id: n?.funil_id ?? null, titulo: n?.titulo ?? null };
    });

    return {
      etapas: ((checar(etapasRes) ?? []) as EtapaResumo[]).map((e) => ({
        ...e,
        valor: Number(e.valor ?? 0),
      })),
      atividade7d,
      recentes,
    };
  });
