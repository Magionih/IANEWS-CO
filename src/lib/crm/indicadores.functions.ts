import { createServerFn } from "@tanstack/react-start";

import { checar, dia, requireCrmAccess } from "./access";
import { hojeBR, somarDias } from "./utils";

/* Audiência e Relatórios: tudo calculado no banco (funções crm_audiencia e crm_relatorios). */

export type Periodo = { inicio?: string | null; fim?: string | null };

const periodo = (input: Periodo) => {
  const fim = dia(input?.fim) ?? hojeBR();
  const inicio = dia(input?.inicio) ?? somarDias(fim, -29);
  if (inicio > fim) throw new Error("O início do período não pode ser depois do fim.");
  return { inicio, fim };
};

export type Audiencia = {
  assinantes_ativos: number;
  assinantes_confirmados: number;
  novos_periodo: number;
  confirmados_periodo: number;
  descadastros_periodo: number;
  novos_por_dia: { dia: string; novos: number; confirmados: number }[];
  origem_assinantes: { origem: string; total: number }[];
  envios: {
    id: string;
    assunto: string | null;
    tipo: string | null;
    data: string;
    destinatarios: number | null;
    entregues: number | null;
    falhas: number | null;
    status: string;
  }[];
  entregas_periodo: { edicoes: number; destinatarios: number; entregues: number; falhas: number };
  visitas: number;
  visitantes: number;
  visitas_por_dia: { dia: string; visitas: number; visitantes: number }[];
  origem_visitas: { origem: string; total: number }[];
  materias_mais_lidas: {
    slug: string;
    titulo: string;
    visitas: number;
    leituras: number;
    concluidas: number;
    segundos_medios: number;
  }[];
  push_ativos: number;
  push_novos_periodo: number;
};

export const getAudiencia = createServerFn({ method: "GET" })
  .middleware([requireCrmAccess])
  .inputValidator((input: Periodo) => periodo(input))
  .handler(async ({ data, context }) => {
    const res = checar(
      await context.db.rpc("crm_audiencia", { p_inicio: data.inicio, p_fim: data.fim }),
    ) as Audiencia;
    return { ...data, dados: res };
  });

export type Relatorios = {
  novos_por_origem: { origem: string; funil: string; total: number }[];
  passagem_etapas: {
    funil: string;
    etapa: string;
    ordem: number;
    tipo: string;
    chegaram: number;
  }[];
  fechados: {
    quantidade?: number;
    receita?: number;
    receita_prevista?: number;
    ticket_medio?: number;
    cortesias?: number;
    dias_medios_ate_fechar?: number;
  };
  receita_por_funil: { funil: string; quantidade: number; receita: number }[];
  motivos_perda: { motivo: string; total: number }[];
  pautas_que_geraram: {
    slug: string;
    titulo: string;
    leads: number;
    vendas: number;
    receita: number;
  }[];
  collab: { com_resposta: number; aceitos: number };
  equipe: { user_id: string; tarefas_feitas: number; no_prazo: number; mensagens: number }[];
  abertos: { quantidade: number; valor: number; atrasados: number; sem_proxima_acao: number };
};

export const getRelatorios = createServerFn({ method: "GET" })
  .middleware([requireCrmAccess])
  .inputValidator((input: Periodo) => periodo(input))
  .handler(async ({ data, context }) => {
    const res = checar(
      await context.db.rpc("crm_relatorios", { p_inicio: data.inicio, p_fim: data.fim }),
    ) as Relatorios;
    return { ...data, dados: res };
  });
