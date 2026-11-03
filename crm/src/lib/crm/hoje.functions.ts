import { createServerFn } from "@tanstack/react-start";

import { checar, requireCrmAccess, todas, type CrmDb } from "./access";
import { carregarNegocios, hidratarTarefas, type NegocioCompleto } from "./carregar";
import type { CrmGrupo, CrmTarefa, CrmTarefaItem } from "./types";
import { hojeBR, ORIGENS, somarDias } from "./utils";

/* Tela "Hoje": o que fazer agora. Também usada pelo e-mail diário das 8h. */

export type FilaViraramPauta = {
  empresa_id: string;
  nome: string;
  grupo: CrmGrupo | null;
  pontuacao: number;
  dono_id: string | null;
  instagram: string | null;
  brasileira: boolean | null;
  mencoes: number;
  ultima_mencao_em: string | null;
  article_id: string | null;
  article_slug: string | null;
  article_title: string | null;
  post_url: string | null;
};

export type PainelHoje = {
  hoje: string;
  tarefas: CrmTarefaItem[];
  novos: NegocioCompleto[];
  atrasados: NegocioCompleto[];
  semResposta: NegocioCompleto[];
  parados: NegocioCompleto[];
  semAcao: NegocioCompleto[];
  viraramPauta: FilaViraramPauta[];
  aquecidos: { id: string; nome: string; email: string | null; aquecido_em: string }[];
  /** Painel visual: funil aberto por etapa, entrada de leads por dia e por origem (30 dias). */
  visao: {
    funis: {
      funil_id: string;
      qtd: number;
      valor: number;
      etapas: { nome: string; ordem: number; qtd: number; valor: number }[];
    }[];
    leadsPorDia: { dia: string; valor: number }[];
    origens: { rotulo: string; valor: number }[];
    leads30: number;
    pipeline: number;
  };
  semana: {
    novosLeads: number;
    mensagensEnviadas: number;
    fechados: number;
    receita: number;
    tarefasFeitas: number;
  };
};

const DIA_MS = 86_400_000;

export async function montarPainelHoje(db: CrmDb): Promise<PainelHoje> {
  const hoje = hojeBR();
  const agora = Date.now();
  const ha = (dias: number) => new Date(agora - dias * DIA_MS).toISOString();

  const [abertos, tarefasRaw, fila, aquecidos, novos7, msgs7, fechados7, feitas7, entradas30] =
    await Promise.all([
      carregarNegocios(db, (q) => q.eq("etapa_tipo", "aberta")),
      todas<CrmTarefa>((de, ate) =>
        db
          .from("crm_tarefas")
          .select("*")
          .eq("feita", false)
          .eq("cancelada", false)
          .lte("vence_em", hoje)
          .order("vence_em")
          .range(de, ate),
      ),
      db.from("crm_viraram_pauta").select("*").order("pontuacao", { ascending: false }).limit(40),
      db
        .from("crm_pessoas")
        .select("id, nome, email, aquecido_em")
        .gte("aquecido_em", ha(7))
        .order("aquecido_em", { ascending: false })
        .limit(30),
      db.from("crm_negocios").select("id", { count: "exact", head: true }).gte("created_at", ha(7)),
      db
        .from("crm_atividades")
        .select("id", { count: "exact", head: true })
        .in("tipo", ["mensagem_enviada", "email"])
        .gte("created_at", ha(7)),
      db
        .from("crm_negocios_resumo")
        .select("valor, status_pagamento")
        .eq("etapa_tipo", "ganha")
        .gte("fechado_em", ha(7))
        .limit(1000),
      db
        .from("crm_tarefas")
        .select("id", { count: "exact", head: true })
        .eq("feita", true)
        .gte("feita_em", ha(7)),
      todas<{ created_at: string; origem: string | null }>((de, ate) =>
        db
          .from("crm_negocios")
          .select("created_at, origem")
          .gte("created_at", `${somarDias(hoje, -29)}T03:00:00Z`)
          .order("created_at")
          .range(de, ate),
      ),
    ]);

  const recentes = (checar(fechados7) ?? []) as {
    valor: number | null;
    status_pagamento: string;
  }[];
  const filaRows = ((checar(fila) ?? []) as FilaViraramPauta[]).sort(
    (a, b) => (a.grupo ?? "C").localeCompare(b.grupo ?? "C") || b.pontuacao - a.pontuacao,
  );

  const naoSemResposta = abertos.filter((n) => n.etapa_nome !== "Sem resposta");
  const tempo = (v: string | null) => (v ? new Date(v).getTime() : 0);

  return {
    hoje,
    visao: montarVisao(hoje, abertos, entradas30),
    tarefas: await hidratarTarefas(db, tarefasRaw),
    novos: abertos
      .filter((n) => tempo(n.created_at) >= agora - DIA_MS)
      .sort((a, b) => b.created_at.localeCompare(a.created_at)),
    atrasados: abertos
      .filter((n) => n.proxima_acao_em && n.proxima_acao_em < hoje)
      .sort((a, b) => (a.proxima_acao_em ?? "").localeCompare(b.proxima_acao_em ?? "")),
    // Mandamos mensagem há mais de 3 dias e não houve resposta depois.
    semResposta: naoSemResposta.filter(
      (n) =>
        n.ultima_enviada_em &&
        tempo(n.ultima_enviada_em) < agora - 3 * DIA_MS &&
        tempo(n.ultima_recebida_em) < tempo(n.ultima_enviada_em),
    ),
    // Nenhuma atividade há mais de 7 dias.
    parados: naoSemResposta.filter(
      (n) => Math.max(tempo(n.ultima_atividade_em), tempo(n.etapa_desde)) < agora - 7 * DIA_MS,
    ),
    semAcao: abertos.filter((n) => !n.proxima_acao_em),
    viraramPauta: filaRows,
    aquecidos: (checar(aquecidos) ?? []) as PainelHoje["aquecidos"],
    semana: {
      novosLeads: novos7.count ?? 0,
      mensagensEnviadas: msgs7.count ?? 0,
      fechados: recentes.length,
      receita: recentes
        .filter((r) => r.status_pagamento === "pago")
        .reduce((s, r) => s + Number(r.valor ?? 0), 0),
      tarefasFeitas: feitas7.count ?? 0,
    },
  };
}

function montarVisao(
  hoje: string,
  abertos: NegocioCompleto[],
  entradas: { created_at: string; origem: string | null }[],
): PainelHoje["visao"] {
  const funis = new Map<string, PainelHoje["visao"]["funis"][number]>();
  for (const n of abertos) {
    const valor = Number(n.valor ?? 0);
    let f = funis.get(n.funil_id);
    if (!f) {
      f = { funil_id: n.funil_id, qtd: 0, valor: 0, etapas: [] };
      funis.set(n.funil_id, f);
    }
    f.qtd += 1;
    f.valor += valor;
    let e = f.etapas.find((x) => x.nome === n.etapa_nome);
    if (!e) {
      e = { nome: n.etapa_nome, ordem: n.etapa_ordem, qtd: 0, valor: 0 };
      f.etapas.push(e);
    }
    e.qtd += 1;
    e.valor += valor;
  }
  for (const f of funis.values()) f.etapas.sort((a, b) => a.ordem - b.ordem);

  const porDia = new Map<string, number>();
  for (let i = 29; i >= 0; i--) porDia.set(somarDias(hoje, -i), 0);
  const porOrigem = new Map<string, number>();
  for (const e of entradas) {
    const dia = hojeBR(new Date(e.created_at));
    if (porDia.has(dia)) porDia.set(dia, (porDia.get(dia) ?? 0) + 1);
    const rotulo = ORIGENS.find((o) => o.value === e.origem)?.label ?? "Sem origem";
    porOrigem.set(rotulo, (porOrigem.get(rotulo) ?? 0) + 1);
  }

  return {
    funis: [...funis.values()].sort((a, b) => b.qtd - a.qtd),
    leadsPorDia: [...porDia].map(([dia, valor]) => ({ dia, valor })),
    origens: [...porOrigem]
      .map(([rotulo, valor]) => ({ rotulo, valor }))
      .sort((a, b) => b.valor - a.valor),
    leads30: entradas.length,
    pipeline: abertos.reduce((s, n) => s + Number(n.valor ?? 0), 0),
  };
}

export const getHoje = createServerFn({ method: "GET" })
  .middleware([requireCrmAccess])
  .handler(async ({ context }) => montarPainelHoje(context.db));
