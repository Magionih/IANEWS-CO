import { createServerFn } from "@tanstack/react-start";

import { checar, requireCrmAccess, todas, type CrmDb } from "./access";
import { carregarNegocios, hidratarTarefas, type NegocioCompleto } from "./carregar";
import type { CrmGrupo, CrmTarefa, CrmTarefaItem } from "./types";
import { hojeBR } from "./utils";

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

  const [abertos, tarefasRaw, fila, aquecidos, novos7, msgs7, fechados7, feitas7] =
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

export const getHoje = createServerFn({ method: "GET" })
  .middleware([requireCrmAccess])
  .handler(async ({ context }) => montarPainelHoje(context.db));
