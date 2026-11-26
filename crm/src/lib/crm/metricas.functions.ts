import { createServerFn } from "@tanstack/react-start";

import {
  bool,
  checar,
  dia,
  dinheiro,
  inteiro,
  obrigatorio,
  requireCrmAccess,
  texto,
  todas,
  umDe,
  uuid,
  uuidObrigatorio,
  type CrmDb,
} from "./access";
import { CATEGORIAS, centroDoFunil, diasEntre, hojeBR, somarDias, type Natureza } from "./utils";

/* Métricas estratégicas do CRM (documento "Métricas estratégicas do CRM").
   Métrica-norte: lucro líquido em caixa por mês. Cinco camadas:
   1 Financeiro (vendido ≠ faturado ≠ recebido) · 2 Comercial · 3 Operação · 4 Audiência · 5 Clientes.

   De onde vem cada número:
   - Recebido = negócios com pagamento "pago" (na data do pagamento) + entradas lançadas no
     financeiro. Uma entrada ligada a um negócio substitui o negócio (não conta duas vezes).
   - Saídas = lançamentos do financeiro (impostos, taxas, variáveis, fixos, investimentos).
     Custos marcados como recorrentes se repetem todo mês na projeção.
   - Contas a receber = negócios fechados (etapa ganha) ainda pendentes, com valor.
   Tudo que é dinheiro fica só para administradores (a RLS das tabelas também garante). */

const exigirAdmin = (isAdmin: boolean) => {
  if (!isAdmin) throw new Error("Só administradores veem e alteram o financeiro.");
};

/** Funis de venda (ficam de fora os funis de ativação da base e de lista). */
const FUNIS_FORA = ["ativacao", "nutricao", "lista100"];

const TZ_DIA = new Intl.DateTimeFormat("en-CA", {
  timeZone: "America/Sao_Paulo",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});
const diaBR = (iso?: string | null) => (iso ? TZ_DIA.format(new Date(iso)) : null);

function somarMeses(diaIso: string, n: number): string {
  const [a, m, d] = diaIso.split("-").map(Number);
  const alvo = new Date(Date.UTC(a, m - 1 + n, 1));
  const ultimo = new Date(Date.UTC(alvo.getUTCFullYear(), alvo.getUTCMonth() + 1, 0)).getUTCDate();
  alvo.setUTCDate(Math.min(d, ultimo));
  return alvo.toISOString().slice(0, 10);
}
const mesDe = (d: string) => d.slice(0, 7);
const soma = <T>(l: T[], f: (x: T) => number) => l.reduce((s, x) => s + (f(x) || 0), 0);
const arred = (n: number) => Math.round(n * 100) / 100;
const um = <T>(v: T | T[] | null | undefined): T | null =>
  Array.isArray(v) ? (v[0] ?? null) : (v ?? null);

// ---------- Leitura da base ----------

type Parametros = {
  meta: { valor: number; inicio: string; fim: string };
  caixa: { saldo_inicial: number | null; data: string };
  margem_meta: number;
  impostos: { aliquota: number };
  chances: {
    respondeu: number;
    qualificado: number;
    proposta: number;
    fechado: number;
    depois: number;
    parado14: number;
  };
};

const PARAM_PADRAO: Parametros = {
  meta: { valor: 50000, inicio: "2026-11-12", fim: "2027-02-12" },
  caixa: { saldo_inicial: null, data: "2026-11-01" },
  margem_meta: 40,
  impostos: { aliquota: 6 },
  chances: { respondeu: 10, qualificado: 20, proposta: 40, fechado: 90, depois: 50, parado14: 30 },
};

async function lerParametros(db: CrmDb): Promise<Parametros> {
  const linhas = (checar(await db.from("crm_parametros").select("chave, valor")) ?? []) as {
    chave: keyof Parametros;
    valor: unknown;
  }[];
  const p = structuredClone(PARAM_PADRAO) as Record<string, unknown>;
  for (const l of linhas) {
    const base = p[l.chave];
    p[l.chave] =
      base && typeof base === "object" && l.valor && typeof l.valor === "object"
        ? { ...(base as object), ...(l.valor as object) }
        : (l.valor ?? base);
  }
  return p as unknown as Parametros;
}

type NegocioBase = {
  id: string;
  titulo: string;
  funil_id: string;
  etapa_desde: string | null;
  empresa_id: string | null;
  pessoa_id: string | null;
  tipo: string | null;
  valor: number | null;
  valor_proposto: number | null;
  status_pagamento: string;
  origem: string | null;
  canal_origem: string | null;
  abordagem: string | null;
  produto: string | null;
  chance: number | null;
  pagamento_previsto_em: string | null;
  forma_pagamento: string | null;
  nf_numero: string | null;
  dono_id: string | null;
  proxima_acao_em: string | null;
  motivo_perda: string | null;
  fechado_em: string | null;
  created_at: string;
  updated_at: string;
  respondeu_em: string | null;
  proposta_em: string | null;
  pago_em: string | null;
  publicado_em: string | null;
  etapa: { nome: string; tipo: string; ordem: number } | null;
  empresa: { nome: string } | null;
  pessoa: { nome: string } | null;
};

const CAMPOS_NEGOCIO =
  "id, titulo, funil_id, etapa_desde, empresa_id, pessoa_id, tipo, valor, valor_proposto, status_pagamento, origem, canal_origem, abordagem, produto, chance, pagamento_previsto_em, forma_pagamento, nf_numero, dono_id, proxima_acao_em, motivo_perda, fechado_em, created_at, updated_at, respondeu_em, proposta_em, pago_em, publicado_em, etapa:crm_etapas(nome, tipo, ordem), empresa:crm_empresas(nome), pessoa:crm_pessoas(nome)";

function normalizarNegocio(n: NegocioBase): NegocioBase {
  return {
    ...n,
    valor: n.valor == null ? null : Number(n.valor),
    valor_proposto: n.valor_proposto == null ? null : Number(n.valor_proposto),
    etapa: um(n.etapa),
    empresa: um(n.empresa),
    pessoa: um(n.pessoa),
  };
}

/** Negócios de venda ativos (todos os funis menos os de base). */
async function lerNegociosVenda(db: CrmDb): Promise<NegocioBase[]> {
  const linhas = await todas<NegocioBase>((de, ate) =>
    db
      .from("crm_negocios")
      .select(CAMPOS_NEGOCIO)
      .eq("ativo", true)
      .not("funil_id", "in", `(${FUNIS_FORA.join(",")})`)
      .range(de, ate),
  );
  return linhas.map(normalizarNegocio);
}

/** Todos os negócios pagos (qualquer funil), para o caixa. */
async function lerPagos(db: CrmDb): Promise<NegocioBase[]> {
  const linhas = await todas<NegocioBase>((de, ate) =>
    db
      .from("crm_negocios")
      .select(CAMPOS_NEGOCIO)
      .eq("ativo", true)
      .eq("status_pagamento", "pago")
      .range(de, ate),
  );
  return linhas.map(normalizarNegocio);
}

export type Lancamento = {
  id: string;
  data: string;
  tipo: "entrada" | "saida";
  valor: number;
  descricao: string;
  categoria: string | null;
  natureza: Natureza;
  vertical: string | null;
  forma_pagamento: string | null;
  fornecedor: string | null;
  recorrente: boolean;
  status: "realizado" | "previsto";
  negocio_id: string | null;
  created_at: string;
};

async function lerLancamentos(db: CrmDb): Promise<Lancamento[]> {
  const l = await todas<Lancamento>((de, ate) =>
    db
      .from("crm_lancamentos")
      .select(
        "id, data, tipo, valor, descricao, categoria, natureza, vertical, forma_pagamento, fornecedor, recorrente, status, negocio_id, created_at",
      )
      .order("data", { ascending: false })
      .range(de, ate),
  );
  return l.map((x) => ({ ...x, valor: Number(x.valor) }));
}

// ---------- Regras de negócio ----------

const nomeCliente = (n: NegocioBase) => n.empresa?.nome ?? n.pessoa?.nome ?? n.titulo;
const chaveCliente = (n: NegocioBase) =>
  n.empresa_id ?? n.pessoa_id ?? `t:${n.titulo.toLowerCase().trim()}`;

/** Produto do negócio: o marcado; senão, pelo tipo; senão, pelo valor igual ao preço. */
function produtoDe(n: NegocioBase, precos: Map<number, string>): string | null {
  if (n.produto) return n.produto;
  if (n.tipo?.startsWith("destaque")) return "destaque";
  if (n.tipo?.startsWith("evento")) return "palco";
  const v = n.valor ?? 0;
  return v ? (precos.get(v) ?? null) : null;
}

const valorDe = (n: NegocioBase, precosProduto?: Map<string, number>) =>
  n.valor || n.valor_proposto || (n.produto ? (precosProduto?.get(n.produto) ?? 0) : 0);

/** Etapa do funil canônico (0 = ainda não abordado … 6 = pago). */
function nivel(n: NegocioBase): number {
  const e = n.etapa;
  if (!e) return 0;
  if (e.tipo === "ganha") return n.status_pagamento === "pago" ? 6 : 5;
  let r = 1;
  if (e.tipo === "aberta") {
    const nome = e.nome.toLowerCase();
    if (e.ordem <= 1) r = 0;
    if (/respondeu|conversa/.test(nome)) r = 2;
    if (/briefing|aprovado|workshop|negocia|acordo/.test(nome)) r = 3;
    if (/proposta|follow/.test(nome)) r = 4;
  }
  if (n.respondeu_em) r = Math.max(r, 2);
  if (n.proposta_em) r = Math.max(r, 4);
  if (n.status_pagamento === "pago") r = 6;
  return r;
}

const diasDesde = (iso: string | null | undefined, hoje: string) =>
  iso ? diasEntre(diaBR(iso) ?? hoje, hoje) : 0;

/** Chance de fechar (%): a marcada no negócio; senão, pela etapa (padrões do documento). */
function chanceDe(n: NegocioBase, p: Parametros, hoje: string, tags?: string[]): number {
  if (n.chance != null) return n.chance;
  const r = nivel(n);
  let c =
    r >= 5
      ? p.chances.fechado
      : r === 4
        ? p.chances.proposta
        : r === 3
          ? p.chances.qualificado
          : r === 2
            ? p.chances.respondeu
            : 0;
  if (tags?.some((t) => /depois/i.test(t))) c = p.chances.depois;
  if (r >= 2 && r <= 4 && diasDesde(n.etapa_desde, hoje) > 14) c = Math.min(c, p.chances.parado14);
  return c;
}

type Recebimento = {
  data: string;
  valor: number;
  cliente: string;
  chave: string;
  centro: string;
  produto: string | null;
  negocio_id: string | null;
};

/** Tudo que entrou no caixa: lançamentos de entrada + negócios pagos sem lançamento ligado. */
function recebimentos(
  pagos: NegocioBase[],
  lanc: Lancamento[],
  precos: Map<number, string>,
): Recebimento[] {
  const ligados = new Set(
    lanc.filter((l) => l.tipo === "entrada" && l.negocio_id).map((l) => l.negocio_id),
  );
  const porNegocio = new Map(pagos.map((n) => [n.id, n]));
  const r: Recebimento[] = [];
  for (const n of pagos) {
    if (ligados.has(n.id) || !n.valor) continue;
    r.push({
      data: diaBR(n.pago_em ?? n.fechado_em ?? n.updated_at)!,
      valor: n.valor,
      cliente: nomeCliente(n),
      chave: chaveCliente(n),
      centro: centroDoFunil(n.funil_id),
      produto: produtoDe(n, precos),
      negocio_id: n.id,
    });
  }
  for (const l of lanc) {
    if (l.tipo !== "entrada" || l.status !== "realizado") continue;
    const n = l.negocio_id ? porNegocio.get(l.negocio_id) : undefined;
    r.push({
      data: l.data,
      valor: l.valor,
      cliente: n ? nomeCliente(n) : (l.fornecedor ?? l.descricao),
      chave: n ? chaveCliente(n) : `l:${(l.fornecedor ?? l.descricao).toLowerCase().trim()}`,
      centro: l.vertical ?? (n ? centroDoFunil(n.funil_id) : "midia"),
      produto: n ? produtoDe(n, precos) : null,
      negocio_id: l.negocio_id,
    });
  }
  return r;
}

type Ocorrencia = {
  data: string;
  tipo: "entrada" | "saida";
  valor: number;
  descricao: string;
  natureza: Natureza;
  categoria: string | null;
  recorrente: boolean;
  id: string | null;
};

/** Lançamentos previstos + repetição dos recorrentes nos próximos `dias` (a partir de hoje). */
function previstos(lanc: Lancamento[], hoje: string, dias: number): Ocorrencia[] {
  const ate = somarDias(hoje, dias);
  const out: Ocorrencia[] = lanc
    .filter((l) => l.status === "previsto" && l.data <= ate)
    .map((l) => ({ ...l, id: l.id }));
  // Recorrentes: o lançamento mais recente de cada descrição se repete todo mês.
  const ultimos = new Map<string, Lancamento>();
  for (const l of lanc) {
    if (!l.recorrente) continue;
    const k = `${l.tipo}|${l.descricao.toLowerCase().trim()}`;
    const atual = ultimos.get(k);
    if (!atual || l.data > atual.data) ultimos.set(k, l);
  }
  const jaTem = new Set(
    lanc.map((l) => `${l.tipo}|${l.descricao.toLowerCase().trim()}|${mesDe(l.data)}`),
  );
  for (const [k, l] of ultimos) {
    for (let i = 1; i <= Math.ceil(dias / 28) + 1; i++) {
      const d = somarMeses(l.data, i);
      if (d > ate) break;
      if (d < somarDias(hoje, -31)) continue;
      if (jaTem.has(`${k}|${mesDe(d)}`)) continue;
      out.push({ ...l, data: d, status: "previsto", id: null } as Ocorrencia & { status: string });
    }
  }
  return out.sort((a, b) => a.data.localeCompare(b.data));
}

/** Custo fixo de um mês: os recorrentes fixos (um por descrição) ou, sem eles, o realizado do mês anterior. */
function custoFixoMensal(
  lanc: Lancamento[],
  hoje: string,
): { valor: number; configurado: boolean } {
  const ultimos = new Map<string, Lancamento>();
  for (const l of lanc) {
    if (l.tipo !== "saida" || l.natureza !== "fixo" || !l.recorrente) continue;
    const k = l.descricao.toLowerCase().trim();
    const atual = ultimos.get(k);
    if (!atual || l.data > atual.data) ultimos.set(k, l);
  }
  if (ultimos.size)
    return { valor: soma([...ultimos.values()], (l) => l.valor), configurado: true };
  const mesAnt = mesDe(somarMeses(`${hoje.slice(0, 7)}-01`, -1));
  const v = soma(
    lanc.filter(
      (l) =>
        l.tipo === "saida" &&
        l.natureza === "fixo" &&
        l.status === "realizado" &&
        mesDe(l.data) === mesAnt,
    ),
    (l) => l.valor,
  );
  return { valor: v, configurado: v > 0 };
}

export type Dre = {
  mes: string;
  receitaBruta: number;
  impostos: number;
  impostosEstimado: boolean;
  taxas: number;
  receitaLiquida: number;
  variaveis: number;
  margemContribuicao: number;
  margemContribuicaoPct: number | null;
  fixos: number;
  ebitda: number;
  investimentos: number;
  lucro: number;
  margemLiquida: number | null;
  categorias: { natureza: Natureza; categoria: string; valor: number }[];
};

function dre(mes: string, rec: Recebimento[], lanc: Lancamento[], p: Parametros): Dre {
  const receitaBruta = soma(
    rec.filter((r) => mesDe(r.data) === mes),
    (r) => r.valor,
  );
  const saidas = lanc.filter(
    (l) => l.tipo === "saida" && l.status === "realizado" && mesDe(l.data) === mes,
  );
  const por = (n: Natureza) =>
    soma(
      saidas.filter((l) => l.natureza === n),
      (l) => l.valor,
    );
  const impLanc = por("imposto");
  const impostosEstimado = impLanc === 0 && receitaBruta > 0;
  const impostos = impostosEstimado ? arred((receitaBruta * p.impostos.aliquota) / 100) : impLanc;
  const taxas = por("taxa");
  const receitaLiquida = receitaBruta - impostos - taxas;
  const variaveis = por("variavel");
  const margemContribuicao = receitaLiquida - variaveis;
  const fixos = por("fixo");
  const ebitda = margemContribuicao - fixos;
  const investimentos = por("investimento");
  const lucro = ebitda - investimentos;
  const cat = new Map<string, { natureza: Natureza; categoria: string; valor: number }>();
  for (const l of saidas) {
    const k = `${l.natureza}|${l.categoria ?? "Outros"}`;
    const c = cat.get(k) ?? { natureza: l.natureza, categoria: l.categoria ?? "Outros", valor: 0 };
    c.valor += l.valor;
    cat.set(k, c);
  }
  return {
    mes,
    receitaBruta,
    impostos,
    impostosEstimado,
    taxas,
    receitaLiquida,
    variaveis,
    margemContribuicao,
    margemContribuicaoPct: receitaBruta ? margemContribuicao / receitaBruta : null,
    fixos,
    ebitda,
    investimentos,
    lucro,
    margemLiquida: receitaBruta ? lucro / receitaBruta : null,
    categorias: [...cat.values()].sort((a, b) => b.valor - a.valor),
  };
}

export type ContaReceber = {
  id: string;
  origem: "negocio" | "lancamento";
  cliente: string;
  titulo: string;
  valor: number;
  fechado_em: string | null;
  idade: number;
  previsto: string | null;
  forma: string | null;
  estado: "sem_link" | "link_enviado" | "lembrar" | "vencido" | "nf_sem_pagamento";
};

function contasReceber(vendas: NegocioBase[], lanc: Lancamento[], hoje: string): ContaReceber[] {
  const out: ContaReceber[] = [];
  for (const n of vendas) {
    if (n.etapa?.tipo !== "ganha" || n.status_pagamento !== "pendente" || !n.valor) continue;
    const idade = diasDesde(n.fechado_em ?? n.updated_at, hoje);
    const previsto = n.pagamento_previsto_em;
    const estado: ContaReceber["estado"] = n.nf_numero
      ? "nf_sem_pagamento"
      : previsto && previsto < hoje
        ? "vencido"
        : !n.forma_pagamento && !previsto
          ? "sem_link"
          : idade >= 2
            ? "lembrar"
            : "link_enviado";
    out.push({
      id: n.id,
      origem: "negocio",
      cliente: nomeCliente(n),
      titulo: n.titulo,
      valor: n.valor,
      fechado_em: n.fechado_em,
      idade,
      previsto,
      forma: n.forma_pagamento,
      estado,
    });
  }
  for (const l of lanc) {
    if (l.tipo !== "entrada" || l.status !== "previsto") continue;
    out.push({
      id: l.id,
      origem: "lancamento",
      cliente: l.fornecedor ?? l.descricao,
      titulo: l.descricao,
      valor: l.valor,
      fechado_em: null,
      idade: 0,
      previsto: l.data,
      forma: l.forma_pagamento,
      estado: l.data < hoje ? "vencido" : "link_enviado",
    });
  }
  return out.sort((a, b) => b.idade - a.idade || b.valor - a.valor);
}

/** Visão de caixa comum ao Início e ao Financeiro. */
function caixa(rec: Recebimento[], lanc: Lancamento[], p: Parametros, hoje: string) {
  const ini = p.caixa.data;
  const entradas = soma(
    rec.filter((r) => r.data >= ini && r.data <= hoje),
    (r) => r.valor,
  );
  const saidasReal = lanc.filter((l) => l.tipo === "saida" && l.status === "realizado");
  const saidas = soma(
    saidasReal.filter((l) => l.data >= ini && l.data <= hoje),
    (l) => l.valor,
  );
  const saldo =
    p.caixa.saldo_inicial == null ? null : Number(p.caixa.saldo_inicial) + entradas - saidas;
  const fixo = custoFixoMensal(lanc, hoje);
  const ult90 =
    soma(
      saidasReal.filter((l) => l.data > somarDias(hoje, -90) && l.data <= hoje),
      (l) => l.valor,
    ) / 3;
  const saidaMensal = Math.max(ult90, fixo.valor);
  return {
    saldo,
    saidaMensal,
    custoFixo: fixo.valor,
    custoFixoConfigurado: fixo.configurado,
    folegoMeses: saldo != null && saidaMensal > 0 ? saldo / saidaMensal : null,
  };
}

function ritmoMeta(rec: Recebimento[], p: Parametros, ate: string) {
  const { inicio, fim, valor } = p.meta;
  const dias = Math.max(1, diasEntre(inicio, ate) + 1);
  const recebido = soma(
    rec.filter((r) => r.data >= inicio && r.data <= ate),
    (r) => r.valor,
  );
  const ritmoMes = (recebido / dias) * 30;
  const total = Math.max(1, diasEntre(inicio, fim));
  const necessarioMes = (valor / total) * 30;
  return {
    recebido,
    ritmoMes,
    necessarioMes,
    pct: necessarioMes ? ritmoMes / necessarioMes : null,
    dias,
  };
}

/** Projeção de 90 dias por semana: saldo de hoje + o que está previsto entrar e sair. */
function projecao(saldo: number | null, receber: ContaReceber[], prev: Ocorrencia[], hoje: string) {
  const semanas = Array.from({ length: 13 }, (_, i) => ({
    inicio: somarDias(hoje, i * 7),
    entradas: 0,
    saidas: 0,
    saldo: 0,
  }));
  const idx = (d: string) => Math.min(12, Math.max(0, Math.floor(diasEntre(hoje, d) / 7)));
  let semData = 0;
  for (const c of receber) {
    if (c.origem === "lancamento") continue; // já vem nos previstos
    if (!c.previsto) {
      semData += c.valor;
      continue;
    }
    semanas[idx(c.previsto < hoje ? hoje : c.previsto)].entradas += c.valor;
  }
  for (const o of prev) {
    if (o.data > somarDias(hoje, 90)) continue;
    const s = semanas[idx(o.data < hoje ? hoje : o.data)];
    if (o.tipo === "entrada") s.entradas += o.valor;
    else s.saidas += o.valor;
  }
  let atual = saldo ?? 0;
  let minimo = atual;
  for (const s of semanas) {
    atual += s.entradas - s.saidas;
    s.saldo = arred(atual);
    minimo = Math.min(minimo, atual);
  }
  return {
    semanas,
    semData,
    minimo: saldo == null ? null : minimo,
    final: saldo == null ? null : atual,
  };
}

async function precosProdutos(db: CrmDb) {
  const produtos = (checar(
    await db
      .from("crm_produtos")
      .select("id, nome, preco, custo_direto, entregas, ordem, ativo")
      .order("ordem"),
  ) ?? []) as Produto[];
  const porPreco = new Map<number, string>();
  const porId = new Map<string, number>();
  for (const p of produtos) {
    if (p.preco != null) {
      porPreco.set(Number(p.preco), p.id);
      porId.set(p.id, Number(p.preco));
    }
  }
  return {
    produtos: produtos.map((p) => ({
      ...p,
      preco: p.preco == null ? null : Number(p.preco),
      custo_direto: p.custo_direto == null ? null : Number(p.custo_direto),
    })),
    porPreco,
    porId,
  };
}

export type Produto = {
  id: string;
  nome: string;
  preco: number | null;
  custo_direto: number | null;
  entregas: string | null;
  ordem: number;
  ativo: boolean;
};

// ---------- Operação (fila de produção) ----------

type Briefing = {
  negocio_id: string | null;
  tipo: string;
  status: string;
  dados: unknown;
  fotos: string[] | null;
  previa_url: string | null;
  aprovado_em: string | null;
  ajuste_pedido: string | null;
  created_at: string;
  updated_at: string;
};

const temMaterial = (b?: Briefing) =>
  !!b &&
  ((b.fotos?.length ?? 0) > 0 ||
    (!!b.dados && typeof b.dados === "object" && Object.keys(b.dados as object).length > 0) ||
    !["aberto", "enviado"].includes(b.status));

export type ItemFila = {
  id: string;
  cliente: string;
  titulo: string;
  etapa: string;
  pago: boolean;
  cortesia: boolean;
  valor: number;
  dias: number;
  material: boolean;
  previa: boolean;
  aprovado: boolean;
  ajuste: boolean;
  atrasado: boolean;
};

async function filaProducao(db: CrmDb, vendas: NegocioBase[], hoje: string) {
  const briefings = (checar(
    await db
      .from("auto_briefings")
      .select(
        "negocio_id, tipo, status, dados, fotos, previa_url, aprovado_em, ajuste_pedido, created_at, updated_at",
      )
      .limit(1000),
  ) ?? []) as Briefing[];
  const porNegocio = new Map(briefings.filter((b) => b.negocio_id).map((b) => [b.negocio_id!, b]));
  const fila: ItemFila[] = [];
  for (const n of vendas) {
    if (n.funil_id !== "materia" || !n.etapa) continue;
    const nome = n.etapa.nome.toLowerCase();
    const naFila =
      (n.etapa.tipo === "ganha" && !/publicado/.test(nome)) ||
      (n.etapa.tipo === "aberta" && /briefing|aprovado/.test(nome)) ||
      (n.status_pagamento === "pago" && n.etapa.tipo === "aberta");
    if (!naFila) continue;
    const b = porNegocio.get(n.id);
    const pago = n.status_pagamento === "pago";
    const dias = diasDesde(n.etapa_desde ?? n.updated_at, hoje);
    const material = temMaterial(b);
    const previa = !!b?.previa_url;
    fila.push({
      id: n.id,
      cliente: nomeCliente(n),
      titulo: n.titulo,
      etapa: n.etapa.nome,
      pago,
      cortesia: n.status_pagamento === "cortesia",
      valor: n.valor ?? 0,
      dias,
      material,
      previa,
      aprovado: !!b?.aprovado_em,
      ajuste: !!b?.ajuste_pedido,
      // Prazo do documento: material → prévia em até 2 dias (pagos: 1).
      atrasado: material && !previa ? dias > (pago ? 1 : 2) : pago && dias > 2,
    });
  }
  fila.sort(
    (a, b) =>
      Number(b.pago) - Number(a.pago) || Number(b.atrasado) - Number(a.atrasado) || b.dias - a.dias,
  );
  const comPrevia = briefings.filter((b) => b.previa_url);
  return {
    fila,
    briefings,
    valorTravado: soma(
      fila.filter((f) => f.pago),
      (f) => f.valor,
    ),
    previasAguardando: briefings.filter((b) => b.previa_url && !b.aprovado_em).length,
    retrabalhoPct: comPrevia.length
      ? comPrevia.filter((b) => b.ajuste_pedido).length / comPrevia.length
      : null,
  };
}

// ---------- Audiência (resumo de 7 dias) ----------

async function audiencia7(db: CrmDb) {
  // Função leve no banco (só contagens dos últimos 7 dias e da semana anterior).
  const { data, error } = await db.rpc("crm_pulso_audiencia");
  if (error || !data) return null;
  const x = data as {
    assinantes: number;
    novos: number;
    descadastros: number;
    descadastros_4sem: number;
    visitas: number;
    visitas_ant: number;
  };
  return {
    visitas: x.visitas,
    visitasAnt: x.visitas_ant,
    assinantes: x.assinantes,
    novos: x.novos,
    descadastros: x.descadastros,
    descMediaSemana: x.descadastros_4sem / 4,
  };
}

// ---------- Início: painel do dono ----------

export type Alerta = {
  id: string;
  nivel: "alto" | "medio";
  titulo: string;
  detalhe: string;
  link: string;
};

export type ItemLista = {
  id: string;
  titulo: string;
  detalhe: string;
  valor?: number;
  alerta?: boolean;
};

export type PainelDono = {
  hoje: string;
  admin: boolean;
  recebidoMes: number | null;
  recebidoMesAnterior: number | null;
  lucroMes: number | null;
  margemMes: number | null;
  margemMeta: number;
  saldo: number | null;
  folegoMeses: number | null;
  ritmo: { pct: number | null; ritmoMes: number; necessarioMes: number; recebido: number } | null;
  receber: { valor: number; qtd: number; vencido: number } | null;
  pipeline: { bruto: number; ponderado: number; qtd: number };
  travado: { valor: number; qtd: number };
  audiencia: {
    assinantes: number;
    novos: number;
    visitas: number;
    visitasAnt: number | null;
  } | null;
  alertas: Alerta[];
  cobrancas: ItemLista[];
  producao: ItemLista[];
  followups: ItemLista[];
  comecar: { id: string; texto: string; feito: boolean; detalhe?: string; link: string }[];
  meta: { valor: number; inicio: string; fim: string; diasRestantes: number };
  recebidoMesQtd: number | null;
  semanas: { rotulo: string; valor: number; parcial: boolean }[] | null;
  funil: { etapa: string; qtd: number }[];
  agenda: { dia: string; rotulo: string; qtd: number }[];
};

const RECEBIDO_NOV_INFORMADO = 8015; // valor do documento (pagamentos de novembro até 25/11)

export const getPainelDono = createServerFn({ method: "GET" })
  .middleware([requireCrmAccess])
  .handler(async ({ context }): Promise<PainelDono> => {
    const { db, isAdmin } = context;
    const hoje = hojeBR();
    const inicioHoje = new Date(`${hoje}T00:00:00-03:00`);
    const [p, vendas, precos, artigos, proximos] = await Promise.all([
      lerParametros(db),
      lerNegociosVenda(db),
      precosProdutos(db),
      db
        .from("articles")
        .select("slug, title, status, published_at, cover_image_url")
        .or(
          `and(status.eq.draft,published_at.lt.${new Date().toISOString()}),and(status.eq.published,published_at.gt.${new Date().toISOString()},published_at.lt.${new Date(Date.now() + 86_400_000).toISOString()})`,
        )
        .limit(50),
      db
        .from("articles")
        .select("published_at")
        .eq("status", "published")
        .gte("published_at", inicioHoje.toISOString())
        .lt("published_at", new Date(inicioHoje.getTime() + 4 * 86_400_000).toISOString())
        .limit(500),
    ]);
    const [pagos, lanc, op, aud] = await Promise.all([
      isAdmin ? lerPagos(db) : Promise.resolve([] as NegocioBase[]),
      isAdmin ? lerLancamentos(db) : Promise.resolve([] as Lancamento[]),
      filaProducao(db, vendas, hoje),
      isAdmin ? audiencia7(db) : Promise.resolve(null),
    ]);

    const alertas: Alerta[] = [];
    // Comercial
    let bruto = 0;
    let ponderado = 0;
    let qtdPipe = 0;
    const followups: ItemLista[] = [];
    for (const n of vendas) {
      if (n.etapa?.tipo !== "aberta" || n.status_pagamento === "cortesia") continue;
      const r = nivel(n);
      if (r < 2) continue;
      const v = valorDe(n, precos.porId);
      bruto += v;
      ponderado += (v * chanceDe(n, p, hoje)) / 100;
      qtdPipe += 1;
      const parado = diasDesde(n.etapa_desde, hoje);
      const semAcao = !n.proxima_acao_em || n.proxima_acao_em < hoje;
      if (parado >= 3 && semAcao)
        followups.push({
          id: n.id,
          titulo: nomeCliente(n),
          detalhe: `${n.etapa?.nome} há ${parado} dias${n.proxima_acao_em ? " · ação vencida" : " · sem próxima ação"}`,
          valor: v,
          alerta: parado > 7,
        });
    }
    followups.sort((a, b) => (b.valor ?? 0) - (a.valor ?? 0));

    let painelFin: Pick<
      PainelDono,
      | "recebidoMes"
      | "recebidoMesAnterior"
      | "lucroMes"
      | "margemMes"
      | "saldo"
      | "folegoMeses"
      | "ritmo"
      | "receber"
    > = {
      recebidoMes: null,
      recebidoMesAnterior: null,
      lucroMes: null,
      margemMes: null,
      saldo: null,
      folegoMeses: null,
      ritmo: null,
      receber: null,
    };
    const cobrancas: ItemLista[] = [];
    const comecar: PainelDono["comecar"] = [];
    let semanasMes: PainelDono["semanas"] = null;
    let qtdMes: number | null = null;

    if (isAdmin) {
      const rec = recebimentos(pagos, lanc, precos.porPreco);
      const mes = hoje.slice(0, 7);
      const d = dre(mes, rec, lanc, p);
      const ant = somarMeses(`${mes}-01`, -1);
      const mesmoDiaAnt = somarMeses(hoje, -1);
      const recAnt = soma(
        rec.filter((r) => r.data >= ant && r.data <= mesmoDiaAnt),
        (r) => r.valor,
      );
      const cx = caixa(rec, lanc, p, hoje);
      const rit = ritmoMeta(rec, p, hoje);
      // Recebido por semana do mês (blocos de 7 dias a partir do dia 1).
      {
        const primeiro = `${hoje.slice(0, 7)}-01`;
        const out: { rotulo: string; valor: number; parcial: boolean }[] = [];
        for (let ini = primeiro; ini <= hoje; ini = somarDias(ini, 7)) {
          const fim = somarDias(ini, 6);
          const ate = fim >= hoje ? hoje : fim;
          const mm = ini.slice(5, 7);
          out.push({
            rotulo:
              fim >= hoje
                ? `${Number(ini.slice(8, 10))}/${mm} até hoje`
                : `${Number(ini.slice(8, 10))} a ${ate.slice(8, 10)}/${mm}`,
            valor: soma(
              rec.filter((r) => r.data >= ini && r.data <= ate),
              (r) => r.valor,
            ),
            parcial: fim > hoje,
          });
        }
        semanasMes = out;
        qtdMes = rec.filter((r) => r.data.startsWith(hoje.slice(0, 7)) && r.data <= hoje).length;
      }
      const rit7 = ritmoMeta(rec, p, somarDias(hoje, -7));
      const receber = contasReceber(vendas, lanc, hoje);
      const prev = previstos(lanc, hoje, 90);
      const proj = projecao(cx.saldo, receber, prev, hoje);
      const vencido = soma(
        receber.filter((c) => c.estado === "vencido" || c.idade > 30),
        (c) => c.valor,
      );

      painelFin = {
        recebidoMes: d.receitaBruta,
        recebidoMesAnterior: recAnt,
        lucroMes: d.lucro,
        margemMes: d.margemLiquida,
        saldo: cx.saldo,
        folegoMeses: cx.folegoMeses,
        ritmo: {
          pct: rit.pct,
          ritmoMes: rit.ritmoMes,
          necessarioMes: rit.necessarioMes,
          recebido: rit.recebido,
        },
        receber: { valor: soma(receber, (c) => c.valor), qtd: receber.length, vencido },
      };

      for (const c of receber.filter((c) => c.origem === "negocio")) {
        const rotulo =
          c.estado === "sem_link"
            ? "fechado sem link de pagamento"
            : c.estado === "vencido"
              ? `venceu ${c.previsto ? `em ${c.previsto.slice(8, 10)}/${c.previsto.slice(5, 7)}` : ""}`
              : c.estado === "nf_sem_pagamento"
                ? "nota emitida sem pagamento"
                : c.estado === "lembrar"
                  ? "link enviado · mandar lembrete"
                  : "link enviado";
        cobrancas.push({
          id: c.id,
          titulo: c.cliente,
          detalhe: `${rotulo} · fechado há ${c.idade} dia${c.idade === 1 ? "" : "s"}`,
          valor: c.valor,
          alerta: c.estado !== "link_enviado",
        });
      }

      const atrasadosCob = receber.filter((c) => c.origem === "negocio" && c.idade > 2);
      if (atrasadosCob.length)
        alertas.push({
          id: "cobranca",
          nivel: "alto",
          titulo: `${atrasadosCob.length} fechados há mais de 2 dias sem pagamento`,
          detalhe: `${fmtBRL(soma(atrasadosCob, (c) => c.valor))} para cobrar hoje`,
          link: "/financeiro",
        });
      const nfSemPag = receber.filter((c) => c.estado === "nf_sem_pagamento");
      if (nfSemPag.length)
        alertas.push({
          id: "nf",
          nivel: "alto",
          titulo: `${nfSemPag.length} nota(s) fiscal(is) sem pagamento confirmado`,
          detalhe: "Nota só depois do comprovante. Confira esses negócios.",
          link: "/financeiro",
        });
      if (proj.minimo != null && cx.custoFixo > 0 && proj.minimo < cx.custoFixo)
        alertas.push({
          id: "caixa",
          nivel: "alto",
          titulo: "Caixa projetado abaixo de 1 mês de custo fixo",
          detalhe: `Menor saldo nos próximos 90 dias: ${fmtBRL(proj.minimo)} (custo fixo ${fmtBRL(cx.custoFixo)})`,
          link: "/financeiro",
        });
      if (rit.pct != null && rit.pct < 0.8 && rit7.pct != null && rit7.pct < 0.8)
        alertas.push({
          id: "meta",
          nivel: "medio",
          titulo: `Ritmo da meta em ${Math.round(rit.pct * 100)}% do necessário`,
          detalhe: `Abaixo de 80% há 7 dias ou mais: ${fmtBRL(rit.ritmoMes)}/mês contra ${fmtBRL(rit.necessarioMes)}/mês necessários`,
          link: "/financeiro",
        });
      if (aud) {
        if (aud.visitasAnt && aud.visitas < aud.visitasAnt * 0.8)
          alertas.push({
            id: "sessoes",
            nivel: "medio",
            titulo: `Visitas no site caíram ${Math.round((1 - aud.visitas / aud.visitasAnt) * 100)}% na semana`,
            detalhe: `${aud.visitas} visitas nos últimos 7 dias contra ${aud.visitasAnt} na semana anterior`,
            link: "/audiencia",
          });
        if (aud.descMediaSemana != null && aud.descadastros > Math.max(2, aud.descMediaSemana * 2))
          alertas.push({
            id: "descadastro",
            nivel: "medio",
            titulo: `${aud.descadastros} descadastros na newsletter em 7 dias`,
            detalhe: "Acima do normal. Veja a última edição enviada.",
            link: "/audiencia",
          });
      }

      // Para começar já (checklist do documento)
      const recNov = soma(
        rec.filter((r) => r.data.startsWith("2026-11") && r.data <= "2026-11-25"),
        (r) => r.valor,
      );
      const semProduto = pagos.filter((n) => n.valor && !n.produto).length;
      comecar.push(
        {
          id: "fixos",
          texto: "Listar os custos fixos do mês",
          feito: cx.custoFixoConfigurado,
          detalhe: cx.custoFixoConfigurado
            ? `${fmtBRL(cx.custoFixo)} por mês`
            : "Lance cada custo fixo como recorrente",
          link: "/financeiro",
        },
        {
          id: "novembro",
          texto: "Registrar os pagamentos de novembro",
          feito: recNov >= RECEBIDO_NOV_INFORMADO,
          detalhe: `${fmtBRL(recNov)} no CRM até 25/11 · informado: ${fmtBRL(RECEBIDO_NOV_INFORMADO)}`,
          link: "/financeiro",
        },
        {
          id: "prolabore",
          texto: "Definir o pró-labore",
          feito: lanc.some((l) => l.categoria === "Pró-labore"),
          link: "/financeiro",
        },
        {
          id: "saldo",
          texto: "Informar o saldo de caixa",
          feito: p.caixa.saldo_inicial != null,
          detalhe: "Sem ele não dá para calcular saldo e fôlego",
          link: "/financeiro",
        },
        {
          id: "produto",
          texto: "Marcar produto, origem e tipo nos negócios pagos",
          feito: semProduto === 0,
          detalhe: semProduto ? `${semProduto} pagos sem produto marcado` : undefined,
          link: "/comercial",
        },
        {
          id: "margem",
          texto: "Escolher a meta de margem",
          feito: p.margem_meta != null,
          detalhe: `Meta atual: ${p.margem_meta}% de margem líquida`,
          link: "/financeiro",
        },
      );
    }

    // Operação
    const producao: ItemLista[] = op.fila.map((f) => ({
      id: f.id,
      titulo: f.cliente,
      detalhe: `${f.pago ? "Pago" : f.cortesia ? "Cortesia" : "A receber"} · ${
        !f.material
          ? "aguardando material"
          : !f.previa
            ? "material recebido, sem prévia"
            : f.aprovado
              ? "aprovado, falta publicar"
              : "prévia com o cliente"
      } há ${f.dias} dia${f.dias === 1 ? "" : "s"}`,
      valor: f.pago ? f.valor : undefined,
      alerta: f.atrasado,
    }));
    const atrasadosProd = op.fila.filter((f) => f.pago && f.atrasado);
    if (atrasadosProd.length)
      alertas.push({
        id: "producao",
        nivel: "alto",
        titulo: `${atrasadosProd.length} pagos parados na produção`,
        detalhe: "Pagos primeiro: material → prévia em até 1 dia.",
        link: "/operacao",
      });
    const lista = (checar(artigos) ?? []) as {
      slug: string;
      title: string;
      status: string;
      published_at: string;
      cover_image_url: string | null;
    }[];
    const rascunhos = lista.filter((a) => a.status === "draft");
    const semCapa = lista.filter((a) => a.status === "published" && !a.cover_image_url);
    if (rascunhos.length)
      alertas.push({
        id: "rascunhos",
        nivel: "medio",
        titulo: `${rascunhos.length} rascunho(s) com data de publicação vencida`,
        detalhe: rascunhos
          .slice(0, 2)
          .map((a) => a.title)
          .join(" · "),
        link: "/operacao",
      });
    if (semCapa.length)
      alertas.push({
        id: "capa",
        nivel: "medio",
        titulo: `${semCapa.length} matéria(s) das próximas 24h sem capa`,
        detalhe: semCapa
          .slice(0, 2)
          .map((a) => a.title)
          .join(" · "),
        link: "/operacao",
      });
    if (followups.length)
      alertas.push({
        id: "followup",
        nivel: followups.some((f) => f.alerta) ? "alto" : "medio",
        titulo: `${followups.length} negócios parados há 3 dias ou mais`,
        detalhe: `${fmtBRL(soma(followups, (f) => f.valor ?? 0))} em jogo. Faça o follow-up.`,
        link: "/comercial",
      });

    alertas.sort((a, b) => (a.nivel === b.nivel ? 0 : a.nivel === "alto" ? -1 : 1));
    return {
      hoje,
      admin: isAdmin,
      ...painelFin,
      margemMeta: p.margem_meta,
      pipeline: { bruto, ponderado, qtd: qtdPipe },
      travado: { valor: op.valorTravado, qtd: op.fila.filter((f) => f.pago).length },
      audiencia: aud
        ? {
            assinantes: aud.assinantes,
            novos: aud.novos,
            visitas: aud.visitas,
            visitasAnt: aud.visitasAnt,
          }
        : null,
      alertas,
      cobrancas,
      producao,
      followups,
      comecar,
      meta: {
        valor: p.meta.valor,
        inicio: p.meta.inicio,
        fim: p.meta.fim,
        diasRestantes: Math.max(0, diasEntre(hoje, p.meta.fim)),
      },
      recebidoMesQtd: qtdMes,
      semanas: semanasMes,
      funil: (() => {
        const desde = somarDias(hoje, -29);
        const coorte = vendas.filter(
          (n) => n.status_pagamento !== "cortesia" && diaBR(n.created_at)! >= desde,
        );
        const niveis = coorte.map(nivel);
        return ["Abordados", "Responderam", "Qualificados", "Proposta", "Fecharam", "Pagaram"].map(
          (etapa, i) => ({ etapa, qtd: niveis.filter((r) => r >= i + 1).length }),
        );
      })(),
      agenda: (() => {
        const lista2 = (checar(proximos) ?? []) as { published_at: string }[];
        const nomes = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];
        return [0, 1, 2, 3].map((i) => {
          const d = somarDias(hoje, i);
          const [ya, ma, da] = d.split("-").map(Number);
          return {
            dia: d,
            rotulo: i === 0 ? "Hoje" : nomes[new Date(Date.UTC(ya, ma - 1, da)).getUTCDay()],
            qtd: lista2.filter((a) => diaBR(a.published_at) === d).length,
          };
        });
      })(),
    };
  });

const fmtBRL = (n: number) =>
  n.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });

// ---------- Financeiro ----------

export type Financeiro = {
  hoje: string;
  mes: string;
  parametros: Parametros;
  dre: Dre;
  dreAnterior: Dre;
  saldo: number | null;
  folegoMeses: number | null;
  saidaMensal: number;
  custoFixo: number;
  custoFixoConfigurado: boolean;
  pontoEquilibrio: number | null;
  ritmo: ReturnType<typeof ritmoMeta>;
  receber: ContaReceber[];
  receberIdade: { ate7: number; ate30: number; mais30: number };
  inadimplencia: number | null;
  pagar: Ocorrencia[];
  projecao: ReturnType<typeof projecao>;
  fluxoMes: { dia: string; entradas: number; saidas: number }[];
  concentracao: { top3Pct: number | null; clientes: { cliente: string; valor: number }[] };
  roi: number | null;
  centros: { centro: string; receita: number; custos: number; resultado: number }[];
  lancamentos: Lancamento[];
  notas: NotaFiscal[];
  negociosPagos: { id: string; titulo: string; valor: number; nf: string | null }[];
};

export type NotaFiscal = {
  id: string;
  numero: string;
  negocio_id: string | null;
  cliente: string | null;
  valor: number;
  data: string;
  pagamento_confirmado: boolean;
};

export const getFinanceiro = createServerFn({ method: "GET" })
  .middleware([requireCrmAccess])
  .inputValidator((input: { mes?: string }) => {
    const m = String(input?.mes ?? "");
    return { mes: /^\d{4}-\d{2}$/.test(m) ? m : hojeBR().slice(0, 7) };
  })
  .handler(async ({ data, context }): Promise<Financeiro> => {
    exigirAdmin(context.isAdmin);
    const { db } = context;
    const hoje = hojeBR();
    const [p, vendas, pagos, lanc, precos, notas] = await Promise.all([
      lerParametros(db),
      lerNegociosVenda(db),
      lerPagos(db),
      lerLancamentos(db),
      precosProdutos(db),
      db
        .from("crm_notas_fiscais")
        .select("id, numero, negocio_id, cliente, valor, data, pagamento_confirmado")
        .order("data", { ascending: false })
        .limit(500),
    ]);
    const rec = recebimentos(pagos, lanc, precos.porPreco);
    const d = dre(data.mes, rec, lanc, p);
    const dAnt = dre(somarMeses(`${data.mes}-01`, -1).slice(0, 7), rec, lanc, p);
    const cx = caixa(rec, lanc, p, hoje);
    const receber = contasReceber(vendas, lanc, hoje);
    const prev = previstos(lanc, hoje, 90);
    const proj = projecao(cx.saldo, receber, prev, hoje);

    const mcPct = d.margemContribuicaoPct ?? 1 - p.impostos.aliquota / 100;
    const de90 = somarDias(hoje, -89);
    const rec90 = rec.filter((r) => r.data >= de90 && r.data <= hoje);
    const total90 = soma(rec90, (r) => r.valor);
    const porCliente = new Map<string, { cliente: string; valor: number }>();
    for (const r of rec90) {
      const c = porCliente.get(r.chave) ?? { cliente: r.cliente, valor: 0 };
      c.valor += r.valor;
      porCliente.set(r.chave, c);
    }
    const clientes = [...porCliente.values()].sort((a, b) => b.valor - a.valor);
    const totalReceber = soma(receber, (c) => c.valor);
    const mais30 = soma(
      receber.filter((c) => c.idade > 30),
      (c) => c.valor,
    );

    // Fluxo realizado do mês, dia a dia.
    const [a, m] = data.mes.split("-").map(Number);
    const ultimo = new Date(Date.UTC(a, m, 0)).getUTCDate();
    const fluxoMes = Array.from({ length: ultimo }, (_, i) => {
      const diaIso = `${data.mes}-${String(i + 1).padStart(2, "0")}`;
      return {
        dia: diaIso,
        entradas: soma(
          rec.filter((r) => r.data === diaIso),
          (r) => r.valor,
        ),
        saidas: soma(
          lanc.filter((l) => l.tipo === "saida" && l.status === "realizado" && l.data === diaIso),
          (l) => l.valor,
        ),
      };
    });

    // Resultado por centro de custo no mês (inclui o DRE de eventos).
    const centros = new Map<
      string,
      { centro: string; receita: number; custos: number; resultado: number }
    >();
    const centro = (k: string) => {
      const c = centros.get(k) ?? { centro: k, receita: 0, custos: 0, resultado: 0 };
      centros.set(k, c);
      return c;
    };
    for (const r of rec.filter((r) => mesDe(r.data) === data.mes))
      centro(r.centro).receita += r.valor;
    for (const l of lanc.filter(
      (l) => l.tipo === "saida" && l.status === "realizado" && mesDe(l.data) === data.mes,
    ))
      centro(l.vertical ?? "geral").custos += l.valor;
    for (const c of centros.values()) c.resultado = c.receita - c.custos;

    const pagar = prev.filter((o) => o.tipo === "saida" && o.data <= somarDias(hoje, 45));
    const notasLista = ((checar(notas) ?? []) as NotaFiscal[]).map((n) => ({
      ...n,
      valor: Number(n.valor),
    }));
    return {
      hoje,
      mes: data.mes,
      parametros: p,
      dre: d,
      dreAnterior: dAnt,
      saldo: cx.saldo,
      folegoMeses: cx.folegoMeses,
      saidaMensal: cx.saidaMensal,
      custoFixo: cx.custoFixo,
      custoFixoConfigurado: cx.custoFixoConfigurado,
      pontoEquilibrio: cx.custoFixo > 0 && mcPct > 0 ? cx.custoFixo / mcPct : null,
      ritmo: ritmoMeta(rec, p, hoje),
      receber,
      receberIdade: {
        ate7: soma(
          receber.filter((c) => c.idade <= 7),
          (c) => c.valor,
        ),
        ate30: soma(
          receber.filter((c) => c.idade > 7 && c.idade <= 30),
          (c) => c.valor,
        ),
        mais30,
      },
      inadimplencia: total90 + totalReceber ? mais30 / (total90 + totalReceber) : null,
      pagar,
      projecao: proj,
      fluxoMes,
      concentracao: {
        top3Pct: total90 ? soma(clientes.slice(0, 3), (c) => c.valor) / total90 : null,
        clientes: clientes.slice(0, 10),
      },
      roi: d.investimentos > 0 ? (d.receitaBruta - d.investimentos) / d.investimentos : null,
      centros: [...centros.values()].sort((a, b) => b.receita - a.receita),
      lancamentos: lanc.slice(0, 400),
      notas: notasLista,
      negociosPagos: pagos
        .filter((n) => n.valor)
        .sort((a, b) => (b.pago_em ?? "").localeCompare(a.pago_em ?? ""))
        .slice(0, 200)
        .map((n) => ({ id: n.id, titulo: nomeCliente(n), valor: n.valor ?? 0, nf: n.nf_numero })),
    };
  });

export type LancamentoInput = {
  id?: string;
  data?: string;
  tipo?: "entrada" | "saida";
  valor?: number | string;
  descricao?: string;
  categoria?: string | null;
  natureza?: Natureza;
  vertical?: string | null;
  forma_pagamento?: string | null;
  fornecedor?: string | null;
  recorrente?: boolean;
  status?: "realizado" | "previsto";
  negocio_id?: string | null;
  parcelas?: number | string;
};

const NATUREZAS_OK = ["receita", "imposto", "taxa", "variavel", "fixo", "investimento"] as const;

export const saveLancamento = createServerFn({ method: "POST" })
  .middleware([requireCrmAccess])
  .inputValidator((input: LancamentoInput) => {
    const natureza = umDe(input?.natureza, NATUREZAS_OK, "Natureza") ?? "receita";
    const tipo = natureza === "receita" ? "entrada" : "saida";
    const valor = dinheiro(input?.valor);
    if (!valor) throw new Error("Informe o valor.");
    const categoria = texto(input?.categoria, 80);
    if (categoria && !CATEGORIAS[natureza].includes(categoria))
      throw new Error("Categoria inválida.");
    return {
      id: uuid(input?.id),
      data: dia(input?.data) ?? hojeBR(),
      tipo,
      valor,
      descricao: obrigatorio(input?.descricao, "a descrição", 200),
      categoria,
      natureza,
      vertical: umDe(
        input?.vertical,
        ["midia", "fgia", "eventos", "conselho"] as const,
        "Centro de custo",
      ),
      forma_pagamento: texto(input?.forma_pagamento, 40),
      fornecedor: texto(input?.fornecedor, 160),
      recorrente: bool(input?.recorrente),
      status: umDe(input?.status, ["realizado", "previsto"] as const, "Situação") ?? "realizado",
      negocio_id: uuid(input?.negocio_id),
      parcelas: inteiro(input?.parcelas, 1, 36) ?? 1,
    };
  })
  .handler(async ({ data, context }) => {
    exigirAdmin(context.isAdmin);
    const { id, parcelas, ...row } = data;
    if (id) {
      checar(
        await context.db.from("crm_lancamentos").update(row).eq("id", id).select("id").single(),
      );
      return { ok: true, criados: 0 };
    }
    // Parcelado (ex.: cartão): divide o total e lança cada parcela na data real dela.
    const linhas = Array.from({ length: parcelas }, (_, i) => {
      const base = Math.floor((row.valor / parcelas) * 100) / 100;
      const valor = i === parcelas - 1 ? arred(row.valor - base * (parcelas - 1)) : base;
      const dataP = somarMeses(row.data, i);
      return {
        ...row,
        valor,
        data: dataP,
        descricao: parcelas > 1 ? `${row.descricao} (${i + 1}/${parcelas})` : row.descricao,
        status: i === 0 ? row.status : dataP <= hojeBR() ? row.status : "previsto",
        recorrente: parcelas > 1 ? false : row.recorrente,
        created_by: context.userId,
      };
    });
    checar(await context.db.from("crm_lancamentos").insert(linhas).select("id"));
    return { ok: true, criados: linhas.length };
  });

export const deleteLancamento = createServerFn({ method: "POST" })
  .middleware([requireCrmAccess])
  .inputValidator((input: { id: string }) => ({ id: uuidObrigatorio(input?.id, "o lançamento") }))
  .handler(async ({ data, context }) => {
    exigirAdmin(context.isAdmin);
    checar(await context.db.from("crm_lancamentos").delete().eq("id", data.id).select("id"));
    return { ok: true };
  });

/** Confirma um recebimento previsto (vira realizado na data de hoje, se não tiver data passada). */
export const confirmarLancamento = createServerFn({ method: "POST" })
  .middleware([requireCrmAccess])
  .inputValidator((input: { id: string }) => ({ id: uuidObrigatorio(input?.id, "o lançamento") }))
  .handler(async ({ data, context }) => {
    exigirAdmin(context.isAdmin);
    checar(
      await context.db
        .from("crm_lancamentos")
        .update({ status: "realizado" })
        .eq("id", data.id)
        .select("id")
        .single(),
    );
    return { ok: true };
  });

/** Nota fiscal: só com pagamento confirmado (negócio pago ou entrada lançada). */
export const saveNota = createServerFn({ method: "POST" })
  .middleware([requireCrmAccess])
  .inputValidator(
    (input: {
      numero?: string;
      negocio_id?: string | null;
      cliente?: string;
      valor?: number | string;
      data?: string;
      chave?: string;
    }) => ({
      numero: obrigatorio(input?.numero, "o número da nota", 60),
      negocio_id: uuid(input?.negocio_id),
      cliente: texto(input?.cliente, 160),
      valor: dinheiro(input?.valor) ?? 0,
      data: dia(input?.data) ?? hojeBR(),
      chave: texto(input?.chave, 80),
    }),
  )
  .handler(async ({ data, context }) => {
    exigirAdmin(context.isAdmin);
    const { db } = context;
    if (!data.negocio_id)
      throw new Error(
        "Escolha o negócio pago desta nota. Nota fiscal só depois do pagamento confirmado.",
      );
    const neg = checar(
      await db
        .from("crm_negocios")
        .select("id, status_pagamento, empresa_id, valor")
        .eq("id", data.negocio_id)
        .single(),
    ) as { id: string; status_pagamento: string; empresa_id: string | null; valor: number | null };
    const entrada = checar(
      await db
        .from("crm_lancamentos")
        .select("id")
        .eq("negocio_id", data.negocio_id)
        .eq("tipo", "entrada")
        .eq("status", "realizado")
        .limit(1),
    ) as { id: string }[];
    if (neg.status_pagamento !== "pago" && !entrada.length)
      throw new Error(
        "Bloqueado: este negócio ainda não tem pagamento confirmado. Confirme o pagamento antes de emitir a nota.",
      );
    checar(
      await db
        .from("crm_notas_fiscais")
        .insert({
          ...data,
          valor: data.valor || Number(neg.valor ?? 0),
          empresa_id: neg.empresa_id,
          pagamento_confirmado: true,
          created_by: context.userId,
        })
        .select("id")
        .single(),
    );
    checar(
      await db
        .from("crm_negocios")
        .update({ nf_numero: data.numero })
        .eq("id", data.negocio_id)
        .select("id"),
    );
    return { ok: true };
  });

export const deleteNota = createServerFn({ method: "POST" })
  .middleware([requireCrmAccess])
  .inputValidator((input: { id: string }) => ({ id: uuidObrigatorio(input?.id, "a nota") }))
  .handler(async ({ data, context }) => {
    exigirAdmin(context.isAdmin);
    checar(await context.db.from("crm_notas_fiscais").delete().eq("id", data.id).select("id"));
    return { ok: true };
  });

/** Parâmetros do financeiro (saldo inicial, meta, margem, alíquota, chances). */
export const saveParametros = createServerFn({ method: "POST" })
  .middleware([requireCrmAccess])
  .inputValidator(
    (input: {
      saldo_inicial?: number | string | null;
      saldo_data?: string;
      meta_valor?: number | string;
      meta_inicio?: string;
      meta_fim?: string;
      margem_meta?: number | string;
      aliquota?: number | string;
    }) => {
      const saldo =
        input?.saldo_inicial === "" || input?.saldo_inicial == null
          ? null
          : Number(String(input.saldo_inicial).replace(/\./g, "").replace(",", "."));
      if (saldo != null && !Number.isFinite(saldo)) throw new Error("Saldo inválido.");
      const inicio = dia(input?.meta_inicio) ?? PARAM_PADRAO.meta.inicio;
      const fim = dia(input?.meta_fim) ?? PARAM_PADRAO.meta.fim;
      if (fim <= inicio) throw new Error("O fim da meta precisa ser depois do início.");
      return {
        caixa: { saldo_inicial: saldo, data: dia(input?.saldo_data) ?? hojeBR() },
        meta: { valor: dinheiro(input?.meta_valor) ?? PARAM_PADRAO.meta.valor, inicio, fim },
        margem_meta: inteiro(input?.margem_meta, 0, 100) ?? 40,
        impostos: {
          aliquota: Math.min(
            30,
            Math.max(0, Number(String(input?.aliquota ?? 6).replace(",", ".")) || 0),
          ),
        },
      };
    },
  )
  .handler(async ({ data, context }) => {
    exigirAdmin(context.isAdmin);
    const linhas = Object.entries(data).map(([chave, valor]) => ({
      chave,
      valor,
      updated_at: new Date().toISOString(),
    }));
    checar(
      await context.db
        .from("crm_parametros")
        .upsert(linhas, { onConflict: "chave" })
        .select("chave"),
    );
    return { ok: true };
  });

// ---------- Comercial ----------

type Grupo = {
  chave: string;
  abordados: number;
  responderam: number;
  propostas: number;
  fechados: number;
  pagos: number;
  receita: number;
};

export type Comercial = {
  dias: number;
  funil: string;
  etapas: { rotulo: string; qtd: number; conversao: number | null }[];
  porCanal: Grupo[];
  porOrigem: Grupo[];
  porAbordagem: Grupo[];
  pipeline: {
    bruto: number;
    ponderado: number;
    qtd: number;
    porEtapa: { etapa: string; qtd: number; valor: number; ponderado: number }[];
  };
  ticketMedio: number | null;
  cicloDias: number | null;
  respostaAteFechar: number | null;
  parados: {
    id: string;
    cliente: string;
    etapa: string;
    dias: number;
    valor: number;
    dono_id: string | null;
  }[];
  perdas: { motivo: string; qtd: number; valor: number }[];
  produtos: { produto: string; qtd: number; receita: number }[];
  pagosQtd: number;
  cortesiasQtd: number;
  equipe: {
    autor_id: string | null;
    enviadas: number;
    recebidas: number;
    propostas: number;
    etapas: number;
    outras: number;
  }[];
  semProduto: number;
};

const ETAPAS_FUNIL = [
  "Abordado",
  "Respondeu",
  "Qualificado",
  "Proposta / prévia",
  "Fechado",
  "Pago",
];

export const getComercial = createServerFn({ method: "GET" })
  .middleware([requireCrmAccess])
  .inputValidator((input: { dias?: number; funil?: string }) => ({
    dias: [7, 30, 90, 365].includes(Number(input?.dias)) ? Number(input.dias) : 30,
    funil: /^[a-z0-9_]{2,40}$/.test(String(input?.funil ?? "")) ? String(input.funil) : "todos",
  }))
  .handler(async ({ data, context }): Promise<Comercial> => {
    const { db } = context;
    const hoje = hojeBR();
    const desde = somarDias(hoje, -(data.dias - 1));
    const desdeIso = new Date(`${desde}T00:00:00-03:00`).toISOString();
    const [p, todasVendas, precos, ativ] = await Promise.all([
      lerParametros(db),
      lerNegociosVenda(db),
      precosProdutos(db),
      todas<{ autor_id: string | null; tipo: string }>((de, ate) =>
        db
          .from("crm_atividades")
          .select("autor_id, tipo")
          .gte("created_at", desdeIso)
          .range(de, ate),
      ),
    ]);
    const vendas =
      data.funil === "todos" ? todasVendas : todasVendas.filter((n) => n.funil_id === data.funil);
    const coorte = vendas.filter(
      (n) => n.status_pagamento !== "cortesia" && diaBR(n.created_at)! >= desde,
    );
    const nv = new Map(coorte.map((n) => [n.id, nivel(n)]));
    const conta = (k: number) => coorte.filter((n) => (nv.get(n.id) ?? 0) >= k).length;
    const qtds = ETAPAS_FUNIL.map((_, i) => conta(i + 1));
    const etapas = ETAPAS_FUNIL.map((rotulo, i) => ({
      rotulo,
      qtd: qtds[i],
      conversao: i === 0 ? null : qtds[i - 1] ? qtds[i] / qtds[i - 1] : null,
    }));

    const agrupar = (f: (n: NegocioBase) => string | null): Grupo[] => {
      const g = new Map<string, Grupo>();
      for (const n of coorte) {
        const r = nv.get(n.id) ?? 0;
        if (r < 1) continue;
        const k = f(n) || "não informado";
        const x = g.get(k) ?? {
          chave: k,
          abordados: 0,
          responderam: 0,
          propostas: 0,
          fechados: 0,
          pagos: 0,
          receita: 0,
        };
        x.abordados += 1;
        if (r >= 2) x.responderam += 1;
        if (r >= 4) x.propostas += 1;
        if (r >= 5) x.fechados += 1;
        if (r >= 6) {
          x.pagos += 1;
          x.receita += n.valor ?? 0;
        }
        g.set(k, x);
      }
      return [...g.values()].sort((a, b) => b.receita - a.receita || b.abordados - a.abordados);
    };

    // Pipeline (aberto agora, sem corte de data)
    const porEtapa = new Map<
      string,
      { etapa: string; qtd: number; valor: number; ponderado: number }
    >();
    let bruto = 0;
    let ponderado = 0;
    let qtd = 0;
    const parados: Comercial["parados"] = [];
    for (const n of vendas) {
      if (n.etapa?.tipo !== "aberta" || n.status_pagamento === "cortesia") continue;
      if (nivel(n) < 2) continue;
      const v = valorDe(n, precos.porId);
      const pond = (v * chanceDe(n, p, hoje)) / 100;
      bruto += v;
      ponderado += pond;
      qtd += 1;
      const e = porEtapa.get(n.etapa.nome) ?? {
        etapa: n.etapa.nome,
        qtd: 0,
        valor: 0,
        ponderado: 0,
      };
      e.qtd += 1;
      e.valor += v;
      e.ponderado += pond;
      porEtapa.set(n.etapa.nome, e);
      const d = diasDesde(n.etapa_desde, hoje);
      if (d >= 3)
        parados.push({
          id: n.id,
          cliente: nomeCliente(n),
          etapa: n.etapa.nome,
          dias: d,
          valor: v,
          dono_id: n.dono_id,
        });
    }
    parados.sort((a, b) => b.valor - a.valor || b.dias - a.dias);

    const pagosPeriodo = vendas.filter(
      (n) => n.status_pagamento === "pago" && n.pago_em && diaBR(n.pago_em)! >= desde,
    );
    const comValor = pagosPeriodo.filter((n) => n.valor);
    const ciclos = pagosPeriodo
      .map((n) => diasEntre(diaBR(n.created_at)!, diaBR(n.pago_em)!))
      .filter((x) => x >= 0);
    const respAte = pagosPeriodo
      .filter((n) => n.respondeu_em)
      .map((n) => diasEntre(diaBR(n.respondeu_em)!, diaBR(n.pago_em)!))
      .filter((x) => x >= 0);
    const media = (l: number[]) => (l.length ? l.reduce((s, x) => s + x, 0) / l.length : null);

    const perdas = new Map<string, { motivo: string; qtd: number; valor: number }>();
    for (const n of vendas) {
      if (n.etapa?.tipo !== "perdida" || diaBR(n.updated_at)! < desde) continue;
      const k = n.motivo_perda?.trim() || "sem motivo informado";
      const x = perdas.get(k) ?? { motivo: k, qtd: 0, valor: 0 };
      x.qtd += 1;
      x.valor += valorDe(n, precos.porId);
      perdas.set(k, x);
    }

    const prods = new Map<string, { produto: string; qtd: number; receita: number }>();
    for (const n of comValor) {
      const k = produtoDe(n, precos.porPreco) ?? "sem produto";
      const x = prods.get(k) ?? { produto: k, qtd: 0, receita: 0 };
      x.qtd += 1;
      x.receita += n.valor ?? 0;
      prods.set(k, x);
    }

    const cortesias = vendas.filter(
      (n) =>
        n.status_pagamento === "cortesia" &&
        n.etapa?.tipo === "ganha" &&
        diaBR(n.fechado_em ?? n.updated_at)! >= desde,
    ).length;

    const eq = new Map<string, Comercial["equipe"][number]>();
    for (const a of ativ) {
      const k = a.autor_id ?? "sistema";
      const x = eq.get(k) ?? {
        autor_id: a.autor_id,
        enviadas: 0,
        recebidas: 0,
        propostas: 0,
        etapas: 0,
        outras: 0,
      };
      if (a.tipo === "mensagem_enviada" || a.tipo === "email") x.enviadas += 1;
      else if (a.tipo === "mensagem_recebida") x.recebidas += 1;
      else if (a.tipo === "proposta") x.propostas += 1;
      else if (a.tipo === "mudanca_etapa") x.etapas += 1;
      else x.outras += 1;
      eq.set(k, x);
    }

    return {
      dias: data.dias,
      funil: data.funil,
      etapas,
      porCanal: agrupar((n) => n.canal_origem),
      porOrigem: agrupar((n) => n.origem),
      porAbordagem: agrupar((n) => n.abordagem),
      pipeline: {
        bruto,
        ponderado,
        qtd,
        porEtapa: [...porEtapa.values()].sort((a, b) => b.valor - a.valor),
      },
      ticketMedio: comValor.length ? soma(comValor, (n) => n.valor ?? 0) / comValor.length : null,
      cicloDias: media(ciclos),
      respostaAteFechar: media(respAte),
      parados: parados.slice(0, 50),
      perdas: [...perdas.values()].sort((a, b) => b.qtd - a.qtd),
      produtos: [...prods.values()].sort((a, b) => b.receita - a.receita),
      pagosQtd: pagosPeriodo.length,
      cortesiasQtd: cortesias,
      equipe: [...eq.values()].filter((x) => x.autor_id).sort((a, b) => b.enviadas - a.enviadas),
      semProduto: todasVendas.filter((n) => n.status_pagamento === "pago" && n.valor && !n.produto)
        .length,
    };
  });

// ---------- Operação ----------

export type Operacao = {
  fila: ItemFila[];
  valorTravado: number;
  previasAguardando: number;
  retrabalhoPct: number | null;
  fechadoAtePublicar: number | null;
  rascunhosVencidos: { slug: string; title: string; published_at: string }[];
  semCapa24h: { slug: string; title: string; published_at: string }[];
  semana: { publicadas: number; agendadas7: number; comPost: number };
  dias: { dia: string; rotulo: string; hoje: boolean; total: number; comPost: number }[];
};

export const getOperacao = createServerFn({ method: "GET" })
  .middleware([requireCrmAccess])
  .handler(async ({ context }): Promise<Operacao> => {
    const { db } = context;
    const hoje = hojeBR();
    const agora = new Date();
    const [vendas, artigos, publicados] = await Promise.all([
      lerNegociosVenda(db),
      db
        .from("articles")
        .select("slug, title, status, published_at, cover_image_url")
        .or(
          `and(status.eq.draft,published_at.lt.${agora.toISOString()}),and(status.eq.published,published_at.gt.${agora.toISOString()},published_at.lt.${new Date(agora.getTime() + 86_400_000).toISOString()})`,
        )
        .order("published_at")
        .limit(100),
      db
        .from("articles")
        .select("published_at, social_url")
        .eq("status", "published")
        .gte("published_at", new Date(agora.getTime() - 8 * 86_400_000).toISOString())
        .lte("published_at", new Date(agora.getTime() + 7 * 86_400_000).toISOString())
        .limit(1000),
    ]);
    const op = await filaProducao(db, vendas, hoje);
    const lista = (checar(artigos) ?? []) as {
      slug: string;
      title: string;
      status: string;
      published_at: string;
      cover_image_url: string | null;
    }[];
    const pubs = (checar(publicados) ?? []) as {
      published_at: string;
      social_url: string | null;
    }[];
    const passadas = pubs.filter((a) => new Date(a.published_at) <= agora);
    const tempos = vendas
      .filter((n) => n.fechado_em && n.publicado_em)
      .map((n) => diasEntre(diaBR(n.fechado_em)!, diaBR(n.publicado_em)!))
      .filter((x) => x >= 0);
    return {
      fila: op.fila,
      valorTravado: op.valorTravado,
      previasAguardando: op.previasAguardando,
      retrabalhoPct: op.retrabalhoPct,
      fechadoAtePublicar: tempos.length ? tempos.reduce((s, x) => s + x, 0) / tempos.length : null,
      rascunhosVencidos: lista.filter((a) => a.status === "draft"),
      semCapa24h: lista.filter((a) => a.status === "published" && !a.cover_image_url),
      dias: (() => {
        const [ya, ma, da] = hoje.split("-").map(Number);
        const dSem = (new Date(Date.UTC(ya, ma - 1, da)).getUTCDay() + 6) % 7;
        const seg = somarDias(hoje, -dSem);
        const nomes = ["Seg", "Ter", "Qua", "Qui", "Sex", "Sáb", "Dom"];
        return nomes.map((n, i) => {
          const d = somarDias(seg, i);
          const doDia = pubs.filter((a) => diaBR(a.published_at) === d);
          return {
            dia: d,
            rotulo: `${n} ${d.slice(8, 10)}`,
            hoje: d === hoje,
            total: doDia.length,
            comPost: doDia.filter((a) => a.social_url).length,
          };
        });
      })(),
      semana: {
        publicadas: passadas.filter(
          (a) => new Date(a.published_at).getTime() >= agora.getTime() - 7 * 86_400_000,
        ).length,
        agendadas7: pubs.length - passadas.length,
        comPost: passadas.filter(
          (a) =>
            a.social_url && new Date(a.published_at).getTime() >= agora.getTime() - 7 * 86_400_000,
        ).length,
      },
    };
  });

// ---------- Clientes e produtos ----------

export type Clientes = {
  clientes: {
    chave: string;
    cliente: string;
    compras: number;
    total: number;
    primeira: string;
    ultima: string;
    produtos: string[];
  }[];
  totalClientes: number;
  ltv: number | null;
  recompraPct: number | null;
  ticket: number | null;
  novos90: number;
  cac: number | null;
  ltvCac: number | null;
  indicacoes: { leads: number; pagos: number };
  upsell: number;
  produtos: (Produto & { vendas: number; receita: number; margemPct: number | null })[];
  aliquota: number;
};

export const getClientes = createServerFn({ method: "GET" })
  .middleware([requireCrmAccess])
  .handler(async ({ context }): Promise<Clientes> => {
    exigirAdmin(context.isAdmin);
    const { db } = context;
    const hoje = hojeBR();
    const [p, pagos, lanc, precos, vendas] = await Promise.all([
      lerParametros(db),
      lerPagos(db),
      lerLancamentos(db),
      precosProdutos(db),
      lerNegociosVenda(db),
    ]);
    const rec = recebimentos(pagos, lanc, precos.porPreco);
    const g = new Map<string, Clientes["clientes"][number] & { valores: number[] }>();
    for (const r of [...rec].sort((a, b) => a.data.localeCompare(b.data))) {
      const x = g.get(r.chave) ?? {
        chave: r.chave,
        cliente: r.cliente,
        compras: 0,
        total: 0,
        primeira: r.data,
        ultima: r.data,
        produtos: [],
        valores: [],
      };
      x.compras += 1;
      x.total += r.valor;
      x.ultima = r.data;
      x.valores.push(r.valor);
      if (r.produto && !x.produtos.includes(r.produto)) x.produtos.push(r.produto);
      g.set(r.chave, x);
    }
    const lista = [...g.values()];
    const de90 = somarDias(hoje, -89);
    const novos90 = lista.filter((c) => c.primeira >= de90).length;
    const invest90 = soma(
      lanc.filter(
        (l) =>
          l.tipo === "saida" &&
          l.status === "realizado" &&
          l.data >= de90 &&
          (l.natureza === "investimento" || l.categoria === "Comissão"),
      ),
      (l) => l.valor,
    );
    const ltv = lista.length ? soma(lista, (c) => c.total) / lista.length : null;
    const cac = novos90 && invest90 ? invest90 / novos90 : null;
    const vendasProd = new Map<string, { vendas: number; receita: number }>();
    for (const r of rec) {
      if (!r.produto) continue;
      const x = vendasProd.get(r.produto) ?? { vendas: 0, receita: 0 };
      x.vendas += 1;
      x.receita += r.valor;
      vendasProd.set(r.produto, x);
    }
    const ind = vendas.filter((n) => n.origem === "indicacao");
    return {
      clientes: lista
        .sort((a, b) => b.total - a.total)
        .slice(0, 200)
        .map(({ valores: _v, ...c }) => c),
      totalClientes: lista.length,
      ltv,
      recompraPct: lista.length ? lista.filter((c) => c.compras >= 2).length / lista.length : null,
      ticket: rec.length ? soma(rec, (r) => r.valor) / rec.length : null,
      novos90,
      cac,
      ltvCac: ltv && cac ? ltv / cac : null,
      indicacoes: {
        leads: ind.length,
        pagos: ind.filter((n) => n.status_pagamento === "pago").length,
      },
      upsell: lista.filter(
        (c) => c.valores.length >= 2 && Math.max(...c.valores.slice(1)) > c.valores[0],
      ).length,
      produtos: precos.produtos.map((pr) => {
        const v = vendasProd.get(pr.id) ?? { vendas: 0, receita: 0 };
        const preco = pr.preco ?? 0;
        return {
          ...pr,
          ...v,
          margemPct: preco
            ? (preco - (preco * p.impostos.aliquota) / 100 - (pr.custo_direto ?? 0)) / preco
            : null,
        };
      }),
      aliquota: p.impostos.aliquota,
    };
  });

export const saveProduto = createServerFn({ method: "POST" })
  .middleware([requireCrmAccess])
  .inputValidator(
    (input: {
      id: string;
      preco?: number | string | null;
      custo_direto?: number | string | null;
      entregas?: string | null;
    }) => {
      const id = String(input?.id ?? "");
      if (!/^[a-z0-9_]{2,40}$/.test(id)) throw new Error("Produto inválido.");
      return {
        id,
        preco: dinheiro(input?.preco),
        custo_direto: dinheiro(input?.custo_direto),
        entregas: texto(input?.entregas, 500),
      };
    },
  )
  .handler(async ({ data, context }) => {
    exigirAdmin(context.isAdmin);
    const { id, ...row } = data;
    checar(await context.db.from("crm_produtos").update(row).eq("id", id).select("id").single());
    return { ok: true };
  });

// ---------- Indicadores gerais ----------

export type Indicadores = {
  pessoas: number;
  empresas: number;
  negocios: number;
  negocios_abertos: number;
  novos_hoje: number;
  novos_7: number;
  novos_30: number;
  negocios_hoje: number;
  negocios_7: number;
  respostas_7: number;
  enviadas_7: number;
  por_dia: { dia: string; pessoas: number; negocios: number }[];
  por_canal: { chave: string; total: number }[];
  por_funil: { chave: string; total: number }[];
  por_grupo: { chave: string; total: number }[];
  audiencia: {
    assinantes: number;
    novos: number;
    descadastros: number;
    visitas: number;
    visitasAnt: number | null;
  } | null;
};

export const getIndicadores = createServerFn({ method: "GET" })
  .middleware([requireCrmAccess])
  .handler(async ({ context }): Promise<Indicadores> => {
    const { db, isAdmin } = context;
    const [r, aud] = await Promise.all([
      db.rpc("crm_indicadores_leads"),
      isAdmin ? audiencia7(db) : Promise.resolve(null),
    ]);
    if (r.error) throw new Error(r.error.message);
    const base = r.data as Omit<Indicadores, "audiencia">;
    return {
      ...base,
      audiencia: aud
        ? {
            assinantes: aud.assinantes,
            novos: aud.novos,
            descadastros: aud.descadastros,
            visitas: aud.visitas,
            visitasAnt: aud.visitasAnt,
          }
        : null,
    };
  });
