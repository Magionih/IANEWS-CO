import { createServerFn } from "@tanstack/react-start";

import { checar, requireCrmAccess, todas } from "./access";
import { hojeBR } from "./utils";

/* Início do CRM (painel do dono), leads da newsletter e calendário de conteúdo. */

/** Etapas que contam como "em negociação": a pessoa já respondeu e a conversa está andando. */
const ETAPA_QUENTE = /respondeu|briefing|proposta|follow|conversa|negocia/i;

export type ResumoInicio = {
  faturadoMes: number;
  faturadoMesQtd: number;
  faturadoTotal: number;
  faturadoMesAnterior: number;
  fechadosMesAnterior: number;
  aReceber: number;
  aReceberQtd: number;
  negociacaoQtd: number;
  negociacaoValor: number;
  fechadosMes: number;
  newsletterAtivos: number | null;
  newsletterNovos7: number | null;
  proximos: ConteudoAgenda[];
};

export type ConteudoAgenda = {
  id: string;
  slug: string;
  title: string;
  published_at: string;
  status: string;
  origin: string | null;
  social_url: string | null;
  category: string | null;
};

type NegocioMin = {
  valor: number | null;
  status_pagamento: string | null;
  fechado_em: string | null;
  etapa: { tipo: string; nome: string } | null;
};

/** Primeiro dia do mês corrente (horário de Brasília) em ISO. */
function inicioDoMes(): string {
  const hoje = hojeBR();
  return new Date(`${hoje.slice(0, 7)}-01T00:00:00-03:00`).toISOString();
}

/** Início do mês anterior e o mesmo dia do mês anterior (para comparar períodos iguais). */
function mesAnterior(): { ini: string; ate: string } {
  const hoje = hojeBR();
  const [a, m, d] = hoje.split("-").map(Number);
  const am = m === 1 ? 12 : m - 1;
  const aa = m === 1 ? a - 1 : a;
  const ultimo = new Date(Date.UTC(aa, am, 0)).getUTCDate();
  const mm = String(am).padStart(2, "0");
  const dd = String(Math.min(d, ultimo)).padStart(2, "0");
  return {
    ini: new Date(`${aa}-${mm}-01T00:00:00-03:00`).toISOString(),
    ate: new Date(`${aa}-${mm}-${dd}T23:59:59-03:00`).toISOString(),
  };
}

export const getResumoInicio = createServerFn({ method: "GET" })
  .middleware([requireCrmAccess])
  .handler(async ({ context }): Promise<ResumoInicio> => {
    const { db, isAdmin } = context;
    const mes = inicioDoMes();
    const ant = mesAnterior();
    const agora = new Date().toISOString();
    const ha7 = new Date(Date.now() - 7 * 86_400_000).toISOString();

    const [negocios, proximos, ativos, novos7] = await Promise.all([
      todas<NegocioMin>((de, ate) =>
        db
          .from("crm_negocios")
          .select("valor, status_pagamento, fechado_em, etapa:crm_etapas(tipo, nome)")
          .eq("ativo", true)
          .range(de, ate),
      ),
      db
        .from("articles")
        .select("id, slug, title, published_at, status, origin, social_url, category")
        .eq("status", "published")
        .gt("published_at", agora)
        .order("published_at", { ascending: true })
        .limit(8),
      // Leads da newsletter: só administradores leem a tabela (RLS).
      isAdmin
        ? db.from("leads").select("id", { count: "exact", head: true }).eq("is_active", true)
        : Promise.resolve({ count: null }),
      isAdmin
        ? db.from("leads").select("id", { count: "exact", head: true }).gte("created_at", ha7)
        : Promise.resolve({ count: null }),
    ]);

    const r: ResumoInicio = {
      faturadoMes: 0,
      faturadoMesQtd: 0,
      faturadoTotal: 0,
      faturadoMesAnterior: 0,
      fechadosMesAnterior: 0,
      aReceber: 0,
      aReceberQtd: 0,
      negociacaoQtd: 0,
      negociacaoValor: 0,
      fechadosMes: 0,
      newsletterAtivos: (ativos as { count: number | null }).count ?? null,
      newsletterNovos7: (novos7 as { count: number | null }).count ?? null,
      proximos: (checar(proximos) ?? []) as ConteudoAgenda[],
    };

    for (const n of negocios) {
      const etapa = Array.isArray(n.etapa) ? n.etapa[0] : n.etapa;
      if (!etapa) continue;
      const valor = Number(n.valor ?? 0);
      if (etapa.tipo === "ganha") {
        const doMes = !!n.fechado_em && n.fechado_em >= mes;
        const doAnterior = !!n.fechado_em && n.fechado_em >= ant.ini && n.fechado_em <= ant.ate;
        if (doMes) r.fechadosMes += 1;
        if (doAnterior) r.fechadosMesAnterior += 1;
        if (doAnterior && n.status_pagamento === "pago") r.faturadoMesAnterior += valor;
        if (n.status_pagamento === "pago") {
          r.faturadoTotal += valor;
          if (doMes) {
            r.faturadoMes += valor;
            r.faturadoMesQtd += 1;
          }
        } else if (n.status_pagamento === "pendente") {
          r.aReceber += valor;
          if (valor > 0) r.aReceberQtd += 1;
        }
      } else if (etapa.tipo === "aberta" && ETAPA_QUENTE.test(etapa.nome)) {
        r.negociacaoQtd += 1;
        r.negociacaoValor += valor;
      }
    }
    return r;
  });

export type LeadNewsletter = {
  id: string;
  email: string;
  full_name: string | null;
  phone: string | null;
  source: string | null;
  is_active: boolean;
  confirmed_at: string | null;
  unsubscribed_at: string | null;
  created_at: string;
  cta_placement: string | null;
  article_slug: string | null;
  landing_path: string | null;
  utm_source: string | null;
  utm_campaign: string | null;
};

export const getLeadsNewsletter = createServerFn({ method: "GET" })
  .middleware([requireCrmAccess])
  .handler(async ({ context }): Promise<{ permitido: boolean; leads: LeadNewsletter[] }> => {
    if (!context.isAdmin) return { permitido: false, leads: [] };
    const leads = await todas<LeadNewsletter>((de, ate) =>
      context.db
        .from("leads")
        .select(
          "id, email, full_name, phone, source, is_active, confirmed_at, unsubscribed_at, created_at, cta_placement, article_slug, landing_path, utm_source, utm_campaign",
        )
        .order("created_at", { ascending: false })
        .range(de, ate),
    );
    return { permitido: true, leads };
  });

export const getCalendario = createServerFn({ method: "GET" })
  .middleware([requireCrmAccess])
  .inputValidator((input: { mes?: string }) => {
    const m = String(input?.mes ?? "");
    return { mes: /^\d{4}-\d{2}$/.test(m) ? m : hojeBR().slice(0, 7) };
  })
  .handler(async ({ data, context }): Promise<ConteudoAgenda[]> => {
    const [ano, mes] = data.mes.split("-").map(Number);
    const ini = new Date(`${data.mes}-01T00:00:00-03:00`);
    const prox = new Date(Date.UTC(mes === 12 ? ano + 1 : ano, mes === 12 ? 0 : mes, 1, 3));
    // Uma semana a mais de cada lado para preencher a grade do mês.
    const de = new Date(ini.getTime() - 7 * 86_400_000).toISOString();
    const ate = new Date(prox.getTime() + 7 * 86_400_000).toISOString();
    return todas<ConteudoAgenda>((a, b) =>
      context.db
        .from("articles")
        .select("id, slug, title, published_at, status, origin, social_url, category")
        .in("status", ["published", "draft"])
        .gte("published_at", de)
        .lt("published_at", ate)
        .order("published_at", { ascending: true })
        .range(a, b),
    );
  });
