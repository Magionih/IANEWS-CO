import { useEffect, useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  AlertTriangle,
  Check,
  ChevronLeft,
  ChevronRight,
  Loader2,
  Pencil,
  Plus,
  TrendingUp,
  Settings2,
  Trash2,
} from "lucide-react";

import { useCrm } from "@/components/crm/context";
import { NegocioPainel } from "@/components/crm/negocio";
import { useAcao } from "@/components/crm/queries";
import {
  Abas,
  AoVivo,
  BotaoCsv,
  CabecalhoPagina,
  Campo,
  Cartao,
  Carregando,
  Erro,
  Etiqueta,
  FaixaNumeros,
  FiltroSelect,
  Secao,
  Vazio,
  Variacao,
} from "@/components/crm/ui";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import {
  confirmarLancamento,
  deleteLancamento,
  deleteNota,
  getFinanceiro,
  saveLancamento,
  saveNota,
  saveParametros,
  type ContaReceber,
  type Dre,
  type Financeiro,
  type Lancamento,
  type LancamentoInput,
} from "@/lib/crm/metricas.functions";
import { saveNegocio } from "@/lib/crm/negocios.functions";
import {
  CATEGORIAS,
  CENTROS,
  FORMAS_PAGAMENTO,
  fmtDia,
  fmtMoeda,
  fmtPct,
  hojeBR,
  labelDe,
  NATUREZAS,
  type Natureza,
} from "@/lib/crm/utils";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_crm/financeiro")({
  component: FinanceiroPage,
});

/* Camada 1 · Financeiro: vendido ≠ faturado ≠ recebido. DRE do mês, caixa (realizado e projetado
   em 90 dias), contas a receber e a pagar, lançamentos e notas fiscais (só com pagamento). */

type Aba = "resumo" | "cartao" | "receber" | "pagar" | "lancamentos" | "notas";

const MES_NOME = new Intl.DateTimeFormat("pt-BR", {
  month: "long",
  year: "numeric",
  timeZone: "UTC",
});
const nomeMes = (m: string) => {
  const t = MES_NOME.format(new Date(`${m}-15T12:00:00Z`));
  return t.charAt(0).toUpperCase() + t.slice(1);
};
function somarMes(mes: string, n: number) {
  const [a, m] = mes.split("-").map(Number);
  const d = new Date(Date.UTC(a, m - 1 + n, 1));
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}
const meses = (n: number | null) =>
  n == null ? "—" : n >= 12 ? "12+ meses" : `${n.toFixed(1).replace(".", ",")} meses`;

const ESTADO: Record<
  ContaReceber["estado"],
  { rotulo: string; tom: "alerta" | "azul" | "neutro" }
> = {
  sem_link: { rotulo: "fechado sem link", tom: "alerta" },
  lembrar: { rotulo: "lembrete D+2", tom: "azul" },
  link_enviado: { rotulo: "link enviado", tom: "neutro" },
  vencido: { rotulo: "vencido", tom: "alerta" },
  nf_sem_pagamento: { rotulo: "NF sem pagamento", tom: "alerta" },
};

function FinanceiroPage() {
  const { isAdmin } = useCrm();
  const fetchFin = useServerFn(getFinanceiro);
  const hoje = hojeBR();
  const [mes, setMes] = useState(hoje.slice(0, 7));
  const [aba, setAba] = useState<Aba>("resumo");
  const [editando, setEditando] = useState<Lancamento | "novo" | null>(null);
  const [params, setParams] = useState(false);
  const [nota, setNota] = useState(false);
  const [negocio, setNegocio] = useState<string | null>(null);

  const { data, isLoading, error, isFetching } = useQuery({
    queryKey: ["crm", "financeiro", mes],
    queryFn: () => fetchFin({ data: { mes } }),
    placeholderData: keepPreviousData,
    enabled: isAdmin,
  });

  if (!isAdmin)
    return (
      <div className="space-y-6">
        <CabecalhoPagina titulo="Financeiro" />
        <Vazio>Só administradores veem o financeiro.</Vazio>
      </div>
    );
  if (isLoading) return <Carregando texto="Somando o caixa..." />;
  if (error || !data) return <Erro erro={error} />;

  return (
    <div className="space-y-4 sm:space-y-5">
      <header className="flex items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <h1 className="font-display truncate text-[22px] font-bold leading-tight tracking-[-0.02em] sm:text-[28px]">
            Financeiro
          </h1>
          <AoVivo className="hidden sm:inline-flex" />
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <Button
            variant="outline"
            className="h-9 w-9 px-0 sm:w-auto sm:px-3"
            onClick={() => setParams(true)}
            aria-label="Saldo e metas"
          >
            <Settings2 className="h-4 w-4" />
            <span className="hidden sm:inline">Saldo e metas</span>
          </Button>
          <Button className="h-9 px-3" onClick={() => setEditando("novo")}>
            <Plus className="h-4 w-4" /> Lançar
          </Button>
        </div>
      </header>

      <div className="flex flex-col gap-2.5 sm:flex-row-reverse sm:items-end sm:justify-between sm:gap-4">
        <div
          className={cn(
            "flex h-10 shrink-0 items-center justify-between rounded-[10px] border border-input bg-card sm:h-9 sm:justify-start",
            isFetching && "opacity-70",
          )}
        >
          <button
            type="button"
            aria-label="Mês anterior"
            onClick={() => setMes(somarMes(mes, -1))}
            className="flex h-full w-10 items-center justify-center text-[#3A4456] hover:text-foreground sm:w-9"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <span className="min-w-[140px] px-1.5 text-center text-[14px] font-semibold sm:text-[13.5px]">
            {nomeMes(mes)}
          </span>
          <button
            type="button"
            aria-label="Próximo mês"
            onClick={() => setMes(somarMes(mes, 1))}
            className="flex h-full w-10 items-center justify-center text-[#3A4456] hover:text-foreground sm:w-9"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
        <div className="min-w-0 sm:flex-1">
          <Abas
            valor={aba}
            onChange={setAba}
            rotulo="Ver"
            opcoes={[
              { valor: "resumo", rotulo: "Resumo" },
              {
                valor: "cartao",
                rotulo: "Cartão parcelado",
                contagem: data.cartao.qtdParcelas ? brl0(data.cartao.liquido) : undefined,
              },
              { valor: "receber", rotulo: "Cobranças", contagem: data.receber.length },
              { valor: "pagar", rotulo: "A pagar", contagem: data.pagar.length || undefined },
              { valor: "lancamentos", rotulo: "Lançamentos" },
              { valor: "notas", rotulo: "Notas fiscais" },
            ]}
          />
        </div>
      </div>

      {aba === "resumo" ? (
        <Resumo
          d={data}
          onParams={() => setParams(true)}
          onLancar={() => setEditando("novo")}
          onAba={setAba}
        />
      ) : null}
      {aba === "cartao" ? <CartaoAba d={data} onAbrir={setNegocio} /> : null}
      {aba === "receber" ? <Receber d={data} onAbrir={setNegocio} /> : null}
      {aba === "pagar" ? <Pagar d={data} /> : null}
      {aba === "lancamentos" ? <Lancamentos d={data} onEditar={setEditando} /> : null}
      {aba === "notas" ? <Notas d={data} onNova={() => setNota(true)} /> : null}

      <LancamentoDialog
        aberto={!!editando}
        lancamento={editando === "novo" ? null : editando}
        onClose={() => setEditando(null)}
      />
      <ParametrosDialog aberto={params} d={data} onClose={() => setParams(false)} />
      <NotaDialog aberto={nota} d={data} onClose={() => setNota(false)} />
      <NegocioPainel id={negocio} onClose={() => setNegocio(null)} />
    </div>
  );
}

// ---------- Resumo ----------

const brl0 = (n: number | null | undefined) =>
  n == null ? "—" : `${n < 0 ? "− " : ""}R$ ${Math.abs(Math.round(n)).toLocaleString("pt-BR")}`;

function Resumo({
  d,
  onParams,
  onLancar,
  onAba,
}: {
  d: Financeiro;
  onParams: () => void;
  onLancar: () => void;
  onAba: (a: Aba) => void;
}) {
  const dre = d.dre;
  const totalReceber = d.receber.reduce((s, c) => s + c.valor, 0);
  return (
    <div className="space-y-4 sm:space-y-5">
      <FaixaNumeros
        itens={[
          {
            rotulo: "Vendido no mês",
            valor: brl0(dre.receitaBruta),
            detalhe: (
              <Variacao
                atual={dre.receitaBruta}
                anterior={d.dreAnterior.receitaBruta}
                rotulo="vs. mês passado"
              />
            ),
          },
          {
            rotulo: "Sobrou (lucro líquido)",
            valor: brl0(dre.lucro),
            detalhe: d.custoFixoConfigurado
              ? `margem ${fmtPct(dre.margemLiquida)} · meta ${d.parametros.margem_meta}%`
              : "Custos ainda não lançados",
            tom: d.custoFixoConfigurado ? undefined : "alerta",
          },
          {
            rotulo: "Saldo em conta",
            valor: d.saldo == null ? "—" : brl0(d.saldo),
            detalhe:
              d.saldo == null ? "Informe em Saldo e metas" : `fôlego de ${meses(d.folegoMeses)}`,
            tom: d.saldo == null ? "azul" : undefined,
          },
          {
            rotulo: "Cartão a receber",
            valor: brl0(d.cartao.liquido),
            detalhe: d.cartao.qtdParcelas
              ? `${brl0(d.cartao.proximos30)} nos próximos 30 dias`
              : "Nenhuma parcela",
            tom: d.cartao.qtdParcelas ? "azul" : undefined,
          },
          {
            rotulo: "Cobranças",
            valor: brl0(totalReceber),
            detalhe: `${d.receber.length} abertas`,
            tom: d.receberIdade.mais30 ? "alerta" : undefined,
          },
        ]}
      />

      <div className="grid gap-4 lg:grid-cols-[3fr_2fr]">
        <Cascata d={d} onLancar={onLancar} />
        <IndicadoresMes d={d} />
      </div>

      <div className="grid gap-4 lg:grid-cols-[3fr_2fr] lg:items-start">
        <ReceberResumo d={d} onVer={() => onAba("receber")} />
        <div className="flex min-w-0 flex-col gap-4">
          <Projecao d={d} onParams={onParams} />
          <CartaoResumo d={d} onVer={() => onAba("cartao")} />
        </div>
      </div>
    </div>
  );
}

function Cascata({ d, onLancar }: { d: Financeiro; onLancar: () => void }) {
  const dre = d.dre;
  const total = Math.max(1, dre.receitaBruta);
  const linhas: { nome: string; valor: number; texto?: string; tipo: "total" | "menos" | "fim" }[] =
    [
      { nome: "Vendido no mês", valor: dre.receitaBruta, tipo: "total" },
      {
        nome: dre.impostosEstimado
          ? `Impostos (${d.parametros.impostos.aliquota}% estimado)`
          : "Impostos",
        valor: dre.impostos,
        tipo: "menos",
      },
      { nome: "Taxas Asaas e cartão", valor: dre.taxas, tipo: "menos" },
      { nome: "Custos variáveis", valor: dre.variaveis, tipo: "menos" },
      {
        nome: "Custos fixos",
        valor: dre.fixos,
        texto: !dre.fixos && !d.custoFixoConfigurado ? "não lançados" : undefined,
        tipo: "menos",
      },
      { nome: "Investimentos", valor: dre.investimentos, tipo: "menos" },
      { nome: "Lucro do mês", valor: dre.lucro, tipo: "fim" },
    ];
  let corrido = dre.receitaBruta;
  return (
    <Cartao
      titulo="Do que vendeu ao que sobrou"
      sub="Vendas do mês (Pix e cartão, mesmo o parcelado). Cada linha tira um pedaço; a taxa do cartão já entra em Taxas."
      extra={
        <span className="text-[12px] text-muted-foreground">
          {fmtPct(dre.margemLiquida)} de margem
        </span>
      }
    >
      <div className="flex flex-col gap-3 sm:gap-3.5">
        {linhas.map((l) => {
          let left = 0;
          let width = 0;
          if (l.tipo === "total") width = l.valor;
          else if (l.tipo === "fim") width = Math.max(0, l.valor);
          else {
            corrido -= l.valor;
            left = Math.max(0, corrido);
            width = l.valor;
          }
          return (
            <div
              key={l.nome}
              className={cn(
                "grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-3 gap-y-1.5 sm:grid-cols-[minmax(0,170px)_minmax(0,1fr)_110px] sm:gap-x-3.5",
                l.tipo === "fim" && "border-t pt-3 sm:pt-3.5",
              )}
            >
              <span
                className={cn(
                  "truncate text-[13.5px] sm:text-[14px]",
                  l.tipo === "menos" ? "text-[#3A4456]" : "font-semibold",
                )}
              >
                {l.nome}
              </span>
              <div className="relative col-span-2 h-1.5 overflow-hidden rounded-full bg-[#EEF1F5] sm:order-none sm:col-span-1 sm:h-[22px] sm:rounded-md max-sm:order-last">
                <div
                  className={cn(
                    "absolute inset-y-0 rounded-full sm:rounded-md",
                    l.tipo === "total" && "bg-primary",
                    l.tipo === "menos" && "bg-[#F59E5B]",
                    l.tipo === "fim" && (l.valor < 0 ? "bg-[#C2410C]" : "bg-[#0E8A5F]"),
                  )}
                  style={{
                    left: `${(left / total) * 100}%`,
                    width: `${width ? Math.max(0.6, (width / total) * 100) : 0}%`,
                  }}
                />
              </div>
              <span
                className={cn(
                  "tabular text-right text-[13.5px] sm:text-[14px]",
                  l.tipo === "menos"
                    ? l.valor
                      ? "font-semibold text-[#B4530A]"
                      : "text-[#8A93A5]"
                    : "font-bold",
                )}
              >
                {l.texto ?? (l.tipo === "menos" && l.valor ? `− ${brl0(l.valor)}` : brl0(l.valor))}
              </span>
            </div>
          );
        })}
      </div>
      <ComparaMes d={d} />
      {!d.custoFixoConfigurado ? (
        <div className="mt-4 flex flex-wrap items-center gap-2.5 rounded-lg bg-[#FFF6ED] px-3.5 py-3 text-[13px] text-[#8A3A07]">
          <AlertTriangle className="h-[18px] w-[18px] shrink-0" />
          <span className="min-w-0 flex-1">
            Equipe, ferramentas, contador e pró-labore ainda não foram lançados. Sem eles a margem
            aparece em {fmtPct(dre.margemLiquida)}.
          </span>
          <button type="button" onClick={onLancar} className="font-semibold hover:underline">
            Lançar custos
          </button>
        </div>
      ) : null}
    </Cartao>
  );
}

/** Este mês x mês passado, lado a lado (padrão extrato). */
function ComparaMes({ d }: { d: Financeiro }) {
  const a = d.dre;
  const b = d.dreAnterior;
  const saidas = (x: Dre) => x.impostos + x.taxas + x.variaveis + x.fixos + x.investimentos;
  const linhas: { nome: string; atual: string; antes: string; sobe?: boolean | null }[] = [
    {
      nome: "Vendido",
      atual: brl0(a.receitaBruta),
      antes: brl0(b.receitaBruta),
      sobe: b.receitaBruta ? a.receitaBruta >= b.receitaBruta : null,
    },
    {
      nome: "Saídas",
      atual: brl0(saidas(a)),
      antes: brl0(saidas(b)),
      sobe: saidas(b) ? saidas(a) <= saidas(b) : null,
    },
    {
      nome: "Lucro",
      atual: brl0(a.lucro),
      antes: brl0(b.lucro),
      sobe: b.lucro ? a.lucro >= b.lucro : null,
    },
    { nome: "Margem", atual: fmtPct(a.margemLiquida), antes: fmtPct(b.margemLiquida) },
  ];
  return (
    <div className="mt-5 overflow-hidden rounded-lg border lg:mt-auto">
      <table className="w-full text-[12.5px]">
        <thead className="bg-[#F7F8FA] text-[11.5px] text-muted-foreground">
          <tr>
            <th className="px-3 py-2 text-left font-medium">Comparação</th>
            <th className="px-3 py-2 text-right font-medium">{nomeMes(a.mes).split(" ")[0]}</th>
            <th className="px-3 py-2 text-right font-medium">{nomeMes(b.mes).split(" ")[0]}</th>
          </tr>
        </thead>
        <tbody className="divide-y">
          {linhas.map((l) => (
            <tr key={l.nome}>
              <td className="px-3 py-2 text-[#3A4456]">{l.nome}</td>
              <td
                className={cn(
                  "tabular px-3 py-2 text-right font-semibold",
                  l.sobe === true && "text-[#0E7A55]",
                  l.sobe === false && "text-[#B4530A]",
                )}
              >
                {l.atual}
              </td>
              <td className="tabular px-3 py-2 text-right text-muted-foreground">{l.antes}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function Projecao({ d, onParams }: { d: Financeiro; onParams: () => void }) {
  const p = d.projecao;
  if (d.saldo == null)
    return (
      <Cartao
        titulo="Caixa nos próximos 90 dias"
        sub="Saldo de hoje + o que vai entrar − o que vai sair."
      >
        <div className="flex min-h-[220px] flex-1 flex-col items-center justify-center gap-3 rounded-xl border border-dashed border-[#D5DAE3] bg-[repeating-linear-gradient(0deg,#fff,#fff_43px,#F3F5F8_43px,#F3F5F8_44px)] p-6 text-center">
          <TrendingUp className="h-7 w-7 text-[#8A93A5]" />
          <span className="text-[14px] font-semibold">Falta o saldo em conta</span>
          <span className="max-w-[260px] text-[13px] text-muted-foreground">
            Informe quanto há hoje na conta e a linha do caixa aparece aqui, semana a semana.
          </span>
          <Button variant="outline" size="sm" onClick={onParams}>
            Informar saldo
          </Button>
        </div>
      </Cartao>
    );
  const vals = p.semanas.map((s) => s.saldo);
  const max = Math.max(1, ...vals, d.custoFixo);
  const min = Math.min(0, ...vals);
  const alt = 160;
  const y = (v: number) => alt - ((v - min) / (max - min || 1)) * alt;
  const w = 100 / Math.max(1, vals.length - 1);
  const pontos = vals.map((v, i) => `${i * w},${y(v)}`).join(" ");
  return (
    <Cartao
      titulo="Caixa nos próximos 90 dias"
      sub={`Menor saldo ${brl0(p.minimo)} · em 90 dias ${brl0(p.final)}`}
    >
      <svg
        viewBox={`0 0 100 ${alt}`}
        preserveAspectRatio="none"
        className="h-[180px] w-full overflow-visible"
        role="img"
        aria-label="Saldo projetado por semana"
      >
        {d.custoFixo > 0 ? (
          <line
            x1="0"
            x2="100"
            y1={y(d.custoFixo)}
            y2={y(d.custoFixo)}
            stroke="#F59E5B"
            strokeDasharray="2 2"
            strokeWidth="0.6"
            vectorEffect="non-scaling-stroke"
          />
        ) : null}
        <polyline points={`0,${alt} ${pontos} 100,${alt}`} fill="#EEF3FF" stroke="none" />
        <polyline
          points={pontos}
          fill="none"
          stroke="#1F5EFF"
          strokeWidth="2"
          vectorEffect="non-scaling-stroke"
        />
      </svg>
      <div className="mt-2 flex justify-between text-[11.5px] text-muted-foreground">
        <span>hoje</span>
        <span>45 dias</span>
        <span>90 dias</span>
      </div>
      {d.custoFixo > 0 ? (
        <p className="mt-2 text-[12px] text-muted-foreground">
          Linha laranja: 1 mês de custo fixo ({brl0(d.custoFixo)}).
        </p>
      ) : null}
      {p.semData ? (
        <p className="mt-1 text-[12px] text-muted-foreground">
          {brl0(p.semData)} a receber sem data prevista ficam de fora.
        </p>
      ) : null}
    </Cartao>
  );
}

function ReceberResumo({ d, onVer }: { d: Financeiro; onVer: () => void }) {
  const salvarNeg = useServerFn(saveNegocio);
  const { executar } = useAcao();
  const total = d.receber.reduce((s, c) => s + c.valor, 0);
  const faixas = [
    { nome: "Até 7 dias", v: d.receberIdade.ate7, cor: "bg-primary" },
    { nome: "8 a 30 dias", v: d.receberIdade.ate30, cor: "bg-[#F59E5B]" },
    { nome: "Mais de 30 dias", v: d.receberIdade.mais30, cor: "bg-[#C2410C]" },
  ];
  const lista = d.receber.filter((c) => c.origem === "negocio").slice(0, 5);
  return (
    <Cartao
      titulo="Cobranças"
      extra={
        <button
          type="button"
          onClick={onVer}
          className="text-[13px] font-semibold text-primary hover:underline"
        >
          Ver todas ({d.receber.length})
        </button>
      }
    >
      {total ? (
        <div className="mb-2.5 flex h-3 gap-[3px] overflow-hidden rounded-full">
          {faixas
            .filter((f) => f.v)
            .map((f) => (
              <div key={f.nome} className={f.cor} style={{ flex: f.v }} />
            ))}
        </div>
      ) : null}
      <div className="mb-2 flex flex-wrap gap-x-5 gap-y-1 text-[12.5px] text-[#3A4456]">
        {faixas.map((f) => (
          <span key={f.nome} className="inline-flex items-center gap-1.5">
            <i className={cn("h-2 w-2 rounded-sm", f.cor)} />
            {f.nome} · {brl0(f.v)}
          </span>
        ))}
      </div>
      {lista.length ? (
        <ul>
          {lista.map((c) => (
            <li key={c.id} className="flex items-center gap-3.5 border-t border-[#EEF0F4] py-3">
              <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                <span className="truncate text-[14px] font-semibold">{c.cliente}</span>
                <span className="truncate text-[12.5px] text-muted-foreground">
                  {ESTADO[c.estado].rotulo} · há {c.idade} dia{c.idade === 1 ? "" : "s"}
                </span>
              </span>
              <span className="font-display tabular text-[14px] font-bold">{brl0(c.valor)}</span>
              <Button
                variant="outline"
                size="sm"
                className="h-[34px]"
                onClick={() =>
                  executar(async () => {
                    await salvarNeg({ data: { id: c.id, status_pagamento: "pago" } });
                    return true;
                  }, "Pagamento confirmado.")
                }
              >
                Recebido
              </Button>
            </li>
          ))}
        </ul>
      ) : (
        <p className="py-8 text-center text-[13px] text-muted-foreground">Nada a receber.</p>
      )}
    </Cartao>
  );
}

function IndicadoresMes({ d }: { d: Financeiro }) {
  const dre = d.dre;
  const itens: { rotulo: string; valor: string; detalhe?: string; alerta?: boolean }[] = [
    {
      rotulo: "Margem de contribuição",
      valor: fmtPct(dre.margemContribuicaoPct),
      detalhe: "meta acima de 80%",
      alerta: dre.margemContribuicaoPct != null && dre.margemContribuicaoPct < 0.8,
    },
    {
      rotulo: "Ponto de equilíbrio",
      valor: d.pontoEquilibrio == null ? "—" : brl0(d.pontoEquilibrio),
      detalhe: d.custoFixoConfigurado ? "receita mínima por mês" : "lance os custos fixos",
    },
    {
      rotulo: "3 maiores clientes",
      valor: fmtPct(d.concentracao.top3Pct),
      detalhe: "da receita em 90 dias",
      alerta: (d.concentracao.top3Pct ?? 0) > 0.4,
    },
    {
      rotulo: "Inadimplência",
      valor: fmtPct(d.inadimplencia, 1),
      detalhe: "vencido há mais de 30 dias",
    },
    {
      rotulo: "Fôlego do caixa",
      valor: meses(d.folegoMeses),
      detalhe: "saldo ÷ saída média",
      alerta: d.folegoMeses != null && d.folegoMeses < 1,
    },
    {
      rotulo: "Retorno do investimento",
      valor: d.roi == null ? "—" : `${d.roi.toFixed(1).replace(".", ",")}x`,
      detalhe: d.roi == null ? "sem investimento no mês" : "receita ÷ investimento",
    },
  ];
  return (
    <Cartao titulo="Indicadores do mês" sub="Saúde do negócio em números" colado>
      <dl className="divide-y border-t">
        {itens.map((i) => (
          <div
            key={i.rotulo}
            className="flex items-center justify-between gap-4 px-4 py-2.5 sm:px-5"
          >
            <div className="min-w-0">
              <dt className="truncate text-[13.5px] font-medium">{i.rotulo}</dt>
              {i.detalhe ? (
                <dd
                  className={cn(
                    "truncate text-[12px]",
                    i.alerta ? "font-semibold text-[#B4530A]" : "text-muted-foreground",
                  )}
                >
                  {i.detalhe}
                </dd>
              ) : null}
            </div>
            <dd
              className={cn(
                "font-display tabular shrink-0 text-[16px] font-semibold",
                i.valor === "—" && "text-[#8A93A5]",
                i.alerta && "text-[#B4530A]",
              )}
            >
              {i.valor}
            </dd>
          </div>
        ))}
      </dl>
      {d.centros.length ? (
        <div className="border-t px-4 pb-3 pt-3 sm:px-5">
          <p className="mb-1 text-[11.5px] font-semibold uppercase tracking-[0.04em] text-muted-foreground">
            Resultado por área
          </p>
          {d.centros.map((c) => (
            <div key={c.centro} className="flex items-center justify-between py-1 text-[13px]">
              <span>{labelDe(CENTROS, c.centro) || "Geral"}</span>
              <span className={cn("tabular font-semibold", c.resultado < 0 && "text-[#C2410C]")}>
                {brl0(c.resultado)}
              </span>
            </div>
          ))}
        </div>
      ) : null}
    </Cartao>
  );
}

// ---------- Cartão parcelado ----------

const MES_CURTO = new Intl.DateTimeFormat("pt-BR", {
  month: "short",
  year: "2-digit",
  timeZone: "UTC",
});
const mesCurto = (m: string) =>
  MES_CURTO.format(new Date(`${m}-15T12:00:00Z`))
    .replace(". de ", "/")
    .replace(".", "");

function CartaoResumo({ d, onVer }: { d: Financeiro; onVer?: () => void }) {
  const c = d.cartao;
  const maior = Math.max(1, ...c.meses.map((m) => m.valor));
  return (
    <Cartao
      titulo="Cartão parcelado a receber"
      sub={
        c.qtdParcelas
          ? `Já vendido e pago pelo cliente. ${brl0(c.liquido)} líquidos vão cair na conta em ${c.qtdParcelas} parcelas (bruto ${brl0(c.bruto)}).`
          : "Nenhuma venda no cartão aguardando repasse."
      }
      extra={
        c.qtdParcelas && onVer ? (
          <button
            type="button"
            onClick={onVer}
            className="text-[13px] font-semibold text-primary hover:underline"
          >
            Ver parcelas
          </button>
        ) : null
      }
    >
      {c.meses.length ? (
        <ul className="flex flex-col gap-2.5">
          {c.meses.map((m) => (
            <li
              key={m.mes}
              className="grid grid-cols-[64px_minmax(0,1fr)_92px] items-center gap-3 text-[13px]"
            >
              <span className="font-semibold capitalize text-[#3A4456]">{mesCurto(m.mes)}</span>
              <div className="h-[18px] overflow-hidden rounded-md bg-background">
                <div
                  className="h-full rounded-md bg-primary"
                  style={{ width: `${Math.max(2, (m.valor / maior) * 100)}%` }}
                />
              </div>
              <span className="tabular text-right font-semibold">
                {brl0(m.valor)}
                <span className="ml-1 text-[11px] font-normal text-muted-foreground">·{m.qtd}</span>
              </span>
            </li>
          ))}
        </ul>
      ) : (
        <p className="py-8 text-center text-[13px] text-muted-foreground">Nada no cartão.</p>
      )}
    </Cartao>
  );
}

function CartaoAba({ d, onAbrir }: { d: Financeiro; onAbrir: (id: string) => void }) {
  const confirmar = useServerFn(confirmarLancamento);
  const { executar } = useAcao();
  const c = d.cartao;
  const [aberto, setAberto] = useState<string | null>(null);
  return (
    <div className="space-y-4 sm:space-y-5">
      <FaixaNumeros
        itens={[
          {
            rotulo: "Líquido a receber",
            valor: brl0(c.liquido),
            detalhe: `${c.qtdParcelas} parcelas`,
            tom: "azul",
          },
          {
            rotulo: "Bruto dessas vendas",
            valor: brl0(c.bruto),
            detalhe: `taxas ${brl0(c.bruto - c.liquido)}`,
          },
          { rotulo: "Próximos 30 dias", valor: brl0(c.proximos30) },
          {
            rotulo: "Última parcela",
            valor: c.meses.length ? mesCurto(c.meses[c.meses.length - 1].mes) : "—",
            detalhe: `${c.vendas.length} vendas`,
          },
        ]}
      />
      <div className="grid gap-4 lg:grid-cols-[2fr_3fr]">
        <CartaoResumo d={d} />
        <Secao
          titulo="Vendas no cartão"
          contagem={c.vendas.length}
          colado
          acoes={
            <BotaoCsv
              nome="cartao-parcelado"
              linhas={c.vendas.flatMap((v) => v.parcelas.map((p) => ({ v, p })))}
              colunas={[
                { titulo: "Cliente", valor: (x) => x.v.cliente },
                { titulo: "Parcela", valor: (x) => x.p.rotulo },
                { titulo: "Cai em", valor: (x) => x.p.data },
                { titulo: "Líquido", valor: (x) => x.p.valor },
              ]}
            />
          }
        >
          {c.vendas.length ? (
            <ul className="divide-y">
              {c.vendas.map((v) => (
                <li key={v.chave} className="px-4 py-2.5 sm:px-5">
                  <div className="flex flex-wrap items-center gap-3">
                    <button
                      type="button"
                      onClick={() => setAberto(aberto === v.chave ? null : v.chave)}
                      className="min-w-0 flex-1 text-left"
                    >
                      <span className="block truncate text-[13.5px] font-semibold hover:text-primary">
                        {v.cliente}
                      </span>
                      <span className="block truncate text-[11.5px] text-muted-foreground">
                        {v.vendido_em ? `vendido ${fmtDia(v.vendido_em)} · ` : ""}
                        {v.restantes} de {v.total} parcela{v.total === 1 ? "" : "s"} a cair ·
                        próxima {fmtDia(v.proxima)} · última {fmtDia(v.ultima)}
                      </span>
                    </button>
                    <span className="tabular text-right text-[12px] text-muted-foreground">
                      bruto {brl0(v.bruto)}
                    </span>
                    <span className="tabular w-24 text-right text-[13.5px] font-semibold">
                      {fmtMoeda(v.liquido)}
                    </span>
                    {v.negocio_id ? (
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-8"
                        onClick={() => onAbrir(v.negocio_id!)}
                      >
                        Negócio
                      </Button>
                    ) : null}
                  </div>
                  {aberto === v.chave ? (
                    <ul className="mt-2 space-y-1 rounded-lg bg-background p-2">
                      {v.parcelas.map((p) => (
                        <li key={p.id} className="flex items-center gap-3 text-[12.5px]">
                          <span className="w-10 font-semibold">{p.rotulo || "—"}</span>
                          <span className="flex-1 text-muted-foreground">
                            cai em {fmtDia(p.data)}
                          </span>
                          <span className="tabular w-20 text-right">{fmtMoeda(p.valor)}</span>
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-7"
                            onClick={() =>
                              executar(async () => {
                                await confirmar({ data: { id: p.id } });
                                return true;
                              }, "Parcela marcada como recebida.")
                            }
                          >
                            <Check className="h-3.5 w-3.5" /> Caiu na conta
                          </Button>
                        </li>
                      ))}
                    </ul>
                  ) : null}
                </li>
              ))}
            </ul>
          ) : (
            <div className="p-5">
              <Vazio>Nenhuma venda no cartão aguardando repasse.</Vazio>
            </div>
          )}
        </Secao>
      </div>
    </div>
  );
}

// ---------- A receber / A pagar ----------

function Receber({ d, onAbrir }: { d: Financeiro; onAbrir: (id: string) => void }) {
  const salvarNeg = useServerFn(saveNegocio);
  const confirmar = useServerFn(confirmarLancamento);
  const { executar } = useAcao();
  const [filtro, setFiltro] = useState<"todos" | ContaReceber["estado"]>("todos");
  const lista = d.receber.filter(
    (c) =>
      filtro === "todos" ||
      c.estado === filtro ||
      (filtro === "lembrar" && c.estado === "link_enviado"),
  );
  return (
    <Secao
      titulo="Contas a receber"
      contagem={lista.length}
      colado
      acoes={
        <div className="flex flex-wrap items-center gap-2">
          <FiltroSelect
            valor={filtro}
            onChange={setFiltro}
            rotulo="Situação"
            opcoes={[
              { valor: "todos", rotulo: "Todas" },
              { valor: "sem_link", rotulo: "Sem link" },
              { valor: "lembrar", rotulo: "Link enviado" },
              { valor: "vencido", rotulo: "Vencidas" },
              { valor: "nf_sem_pagamento", rotulo: "NF sem pagamento" },
            ]}
          />
          <BotaoCsv
            nome="contas-a-receber"
            linhas={lista}
            colunas={[
              { titulo: "Cliente", valor: (c) => c.cliente },
              { titulo: "Valor", valor: (c) => c.valor },
              { titulo: "Dias", valor: (c) => c.idade },
              { titulo: "Situação", valor: (c) => ESTADO[c.estado].rotulo },
              { titulo: "Previsto", valor: (c) => c.previsto ?? "" },
            ]}
          />
        </div>
      }
    >
      {lista.length ? (
        <ul className="divide-y">
          {lista.map((c) => (
            <li key={c.id} className="flex items-center gap-3 px-4 py-3 sm:px-5 sm:py-2.5">
              <button
                type="button"
                onClick={() => c.origem === "negocio" && onAbrir(c.id)}
                className="min-w-0 flex-1 text-left"
              >
                <span className="block truncate text-[13.5px] font-semibold hover:text-primary">
                  {c.cliente}
                </span>
                <span className="block truncate text-[11.5px] text-muted-foreground">
                  <span
                    className={cn(
                      "sm:hidden",
                      ESTADO[c.estado].tom === "alerta" && "font-semibold text-[#B4530A]",
                    )}
                  >
                    {ESTADO[c.estado].rotulo} ·{" "}
                  </span>
                  {c.origem === "negocio"
                    ? `fechado há ${c.idade} dia${c.idade === 1 ? "" : "s"}`
                    : "lançamento previsto"}
                  {c.previsto ? ` · previsto ${fmtDia(c.previsto)}` : " · sem data prevista"}
                  {c.forma ? ` · ${labelDe(FORMAS_PAGAMENTO, c.forma)}` : ""}
                </span>
              </button>
              <span className="hidden sm:inline-flex">
                <Etiqueta tom={ESTADO[c.estado].tom}>{ESTADO[c.estado].rotulo}</Etiqueta>
              </span>
              <span className="tabular shrink-0 text-right text-[13.5px] font-semibold sm:w-24">
                {fmtMoeda(c.valor)}
              </span>
              <Button
                size="sm"
                variant="outline"
                className="h-8 shrink-0 px-2.5"
                onClick={() =>
                  executar(async () => {
                    if (c.origem === "negocio")
                      await salvarNeg({ data: { id: c.id, status_pagamento: "pago" } });
                    else await confirmar({ data: { id: c.id } });
                    return true;
                  }, "Pagamento confirmado.")
                }
              >
                <Check className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">Recebido</span>
              </Button>
            </li>
          ))}
        </ul>
      ) : (
        <div className="p-5">
          <Vazio>Nada a receber.</Vazio>
        </div>
      )}
    </Secao>
  );
}

function Pagar({ d }: { d: Financeiro }) {
  const confirmar = useServerFn(confirmarLancamento);
  const { executar } = useAcao();
  return (
    <Secao
      titulo="Contas a pagar · próximos 45 dias"
      contagem={d.pagar.length}
      colado
      acoes={
        <span className="text-xs text-muted-foreground">
          {fmtMoeda(d.pagar.reduce((s, x) => s + x.valor, 0))}
        </span>
      }
    >
      {d.pagar.length ? (
        <ul className="divide-y">
          {d.pagar.map((o, i) => (
            <li
              key={`${o.id ?? o.descricao}-${o.data}-${i}`}
              className="flex items-center gap-3 px-4 py-2.5 sm:px-5"
            >
              <span
                className={cn(
                  "tabular w-20 shrink-0 text-[12px] font-semibold",
                  o.data < d.hoje && "text-destructive",
                )}
              >
                {fmtDia(o.data)}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[13.5px] font-semibold">{o.descricao}</span>
                <span className="block truncate text-[11.5px] text-muted-foreground">
                  {labelDe(NATUREZAS, o.natureza)}
                  {o.categoria ? ` · ${o.categoria}` : ""}
                  {o.id ? "" : " · repetição do recorrente"}
                </span>
              </span>
              <span className="tabular text-[13.5px] font-semibold">{fmtMoeda(o.valor)}</span>
              {o.id ? (
                <Button
                  size="sm"
                  variant="outline"
                  className="h-8"
                  onClick={() =>
                    executar(() => confirmar({ data: { id: o.id! } }), "Marcado como pago.")
                  }
                >
                  <Check className="h-3.5 w-3.5" /> Pago
                </Button>
              ) : (
                <span className="w-[74px]" />
              )}
            </li>
          ))}
        </ul>
      ) : (
        <div className="p-5">
          <Vazio>
            Nenhuma conta prevista. Lance os custos fixos como recorrentes para eles aparecerem aqui
            todo mês.
          </Vazio>
        </div>
      )}
    </Secao>
  );
}

// ---------- Lançamentos ----------

function Lancamentos({ d, onEditar }: { d: Financeiro; onEditar: (l: Lancamento) => void }) {
  const apagar = useServerFn(deleteLancamento);
  const { executar } = useAcao();
  const [nat, setNat] = useState<"todas" | Natureza>("todas");
  const lista = d.lancamentos.filter((l) => nat === "todas" || l.natureza === nat);
  return (
    <Secao
      titulo="Lançamentos"
      contagem={lista.length}
      colado
      acoes={
        <div className="flex items-center gap-2">
          <FiltroSelect
            valor={nat}
            onChange={setNat}
            rotulo="Natureza"
            opcoes={[
              { valor: "todas" as const, rotulo: "Todas" },
              ...NATUREZAS.map((n) => ({ valor: n.value as Natureza, rotulo: n.label })),
            ]}
          />
          <BotaoCsv
            nome="lancamentos"
            linhas={lista}
            colunas={[
              { titulo: "Data", valor: (l) => l.data },
              { titulo: "Tipo", valor: (l) => l.tipo },
              { titulo: "Natureza", valor: (l) => l.natureza },
              { titulo: "Categoria", valor: (l) => l.categoria ?? "" },
              { titulo: "Descrição", valor: (l) => l.descricao },
              { titulo: "Valor", valor: (l) => l.valor },
              { titulo: "Centro", valor: (l) => l.vertical ?? "" },
              { titulo: "Situação", valor: (l) => l.status },
            ]}
          />
        </div>
      }
    >
      {lista.length ? (
        <>
          <ul className="divide-y border-t sm:hidden">
            {lista.map((l) => (
              <li key={l.id}>
                <button
                  type="button"
                  onClick={() => onEditar(l)}
                  className="flex w-full items-center gap-3 px-4 py-3 text-left active:bg-[#F8FAFF]"
                >
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[13.5px] font-semibold">
                      {l.descricao}
                    </span>
                    <span className="block truncate text-[11.5px] text-muted-foreground">
                      {fmtDia(l.data)} · {labelDe(NATUREZAS, l.natureza)}
                      {l.categoria ? ` · ${l.categoria}` : ""}
                      {l.recorrente ? " · recorrente" : ""}
                      {l.status === "previsto" ? " · previsto" : ""}
                    </span>
                  </span>
                  <span
                    className={cn(
                      "tabular shrink-0 text-[13.5px] font-semibold",
                      l.tipo === "entrada" ? "text-emerald-700" : "",
                    )}
                  >
                    {l.tipo === "entrada" ? "+ " : "− "}
                    {fmtMoeda(l.valor)}
                  </span>
                </button>
              </li>
            ))}
          </ul>
          <div className="hidden overflow-x-auto sm:block">
            <table className="w-full min-w-[640px] text-[13px]">
              <thead className="text-[11.5px] text-muted-foreground">
                <tr className="border-b">
                  <th className="px-4 py-2 text-left font-medium">Data</th>
                  <th className="px-2 py-2 text-left font-medium">Descrição</th>
                  <th className="px-2 py-2 text-left font-medium">Natureza</th>
                  <th className="px-2 py-2 text-left font-medium">Centro</th>
                  <th className="px-2 py-2 text-right font-medium">Valor</th>
                  <th className="px-4 py-2" />
                </tr>
              </thead>
              <tbody className="divide-y">
                {lista.map((l) => (
                  <tr key={l.id} className="hover:bg-[#f8faff]">
                    <td className="tabular whitespace-nowrap px-4 py-2">{fmtDia(l.data)}</td>
                    <td className="max-w-[260px] px-2 py-2">
                      <span className="block truncate font-medium">{l.descricao}</span>
                      <span className="flex gap-1.5 text-[11px] text-muted-foreground">
                        {l.categoria}
                        {l.recorrente ? <Etiqueta tom="azul">recorrente</Etiqueta> : null}
                        {l.status === "previsto" ? <Etiqueta>previsto</Etiqueta> : null}
                      </span>
                    </td>
                    <td className="px-2 py-2 text-muted-foreground">
                      {labelDe(NATUREZAS, l.natureza)}
                    </td>
                    <td className="px-2 py-2 text-muted-foreground">
                      {labelDe(CENTROS, l.vertical) || "—"}
                    </td>
                    <td
                      className={cn(
                        "tabular whitespace-nowrap px-2 py-2 text-right font-semibold",
                        l.tipo === "entrada" ? "text-emerald-700" : "",
                      )}
                    >
                      {l.tipo === "entrada" ? "+ " : "− "}
                      {fmtMoeda(l.valor)}
                    </td>
                    <td className="whitespace-nowrap px-4 py-2 text-right">
                      <button
                        type="button"
                        aria-label="Editar"
                        onClick={() => onEditar(l)}
                        className="rounded p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground"
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </button>
                      <button
                        type="button"
                        aria-label="Apagar"
                        onClick={() => {
                          if (window.confirm(`Apagar "${l.descricao}"?`))
                            void executar(
                              () => apagar({ data: { id: l.id } }),
                              "Lançamento apagado.",
                            );
                        }}
                        className="rounded p-1.5 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      ) : (
        <div className="p-5">
          <Vazio>
            Nenhum lançamento. Comece pelos custos fixos (marque como recorrente) e pelos pagamentos
            recebidos fora do CRM.
          </Vazio>
        </div>
      )}
    </Secao>
  );
}

function LancamentoDialog({
  aberto,
  lancamento,
  onClose,
}: {
  aberto: boolean;
  lancamento: Lancamento | null;
  onClose: () => void;
}) {
  const salvar = useServerFn(saveLancamento);
  const { executar, ocupado } = useAcao();
  const [f, setF] = useState<LancamentoInput>({});
  useEffect(() => {
    if (!aberto) return;
    setF(
      lancamento
        ? { ...lancamento, valor: String(lancamento.valor).replace(".", ",") }
        : {
            natureza: "fixo",
            categoria: "Ferramentas",
            status: "realizado",
            data: hojeBR(),
            recorrente: true,
            parcelas: 1,
          },
    );
  }, [aberto, lancamento]);
  const set = <K extends keyof LancamentoInput>(k: K, v: LancamentoInput[K]) =>
    setF((x) => ({ ...x, [k]: v }));
  const natureza = (f.natureza ?? "fixo") as Natureza;

  async function enviar() {
    const r = await executar(
      () => salvar({ data: f }),
      (x) => (x.criados > 1 ? `${x.criados} parcelas lançadas.` : "Lançamento salvo."),
    );
    if (r) onClose();
  }

  return (
    <Dialog open={aberto} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>{lancamento ? "Editar lançamento" : "Novo lançamento"}</DialogTitle>
          <DialogDescription>
            Cada lançamento: data, valor, natureza, categoria e centro de custo.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-3 sm:grid-cols-2">
          <Campo rotulo="Natureza">
            <Select
              value={natureza}
              onValueChange={(v) =>
                setF((x) => ({
                  ...x,
                  natureza: v as Natureza,
                  categoria: CATEGORIAS[v as Natureza][0],
                  recorrente: v === "fixo",
                }))
              }
            >
              <SelectTrigger className="h-10">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {NATUREZAS.map((n) => (
                  <SelectItem key={n.value} value={n.value}>
                    {n.label} · {n.dica}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Campo>
          <Campo rotulo="Categoria">
            <Select value={f.categoria ?? undefined} onValueChange={(v) => set("categoria", v)}>
              <SelectTrigger className="h-10">
                <SelectValue placeholder="Escolha" />
              </SelectTrigger>
              <SelectContent>
                {CATEGORIAS[natureza].map((c) => (
                  <SelectItem key={c} value={c}>
                    {c}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Campo>
          <Campo rotulo="Descrição" className="sm:col-span-2">
            <Input
              value={f.descricao ?? ""}
              onChange={(e) => set("descricao", e.target.value)}
              placeholder={
                natureza === "receita" ? "Destaque · Empresa X" : "Ex.: Canva, contador, Meta Ads"
              }
            />
          </Campo>
          <Campo
            rotulo="Valor (R$)"
            dica={
              !lancamento && Number(f.parcelas) > 1
                ? "Valor total; cada parcela entra na data dela."
                : undefined
            }
          >
            <Input
              inputMode="decimal"
              value={f.valor ?? ""}
              onChange={(e) => set("valor", e.target.value)}
              placeholder="0,00"
            />
          </Campo>
          <Campo rotulo="Data">
            <Input type="date" value={f.data ?? ""} onChange={(e) => set("data", e.target.value)} />
          </Campo>
          <Campo rotulo="Situação">
            <Select
              value={f.status ?? "realizado"}
              onValueChange={(v) => set("status", v as "realizado" | "previsto")}
            >
              <SelectTrigger className="h-10">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="realizado">
                  {natureza === "receita" ? "Recebido" : "Pago"}
                </SelectItem>
                <SelectItem value="previsto">Previsto</SelectItem>
              </SelectContent>
            </Select>
          </Campo>
          <Campo rotulo="Centro de custo">
            <Select
              value={f.vertical ?? "nenhum"}
              onValueChange={(v) => set("vertical", v === "nenhum" ? null : v)}
            >
              <SelectTrigger className="h-10">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="nenhum">Geral</SelectItem>
                {CENTROS.map((c) => (
                  <SelectItem key={c.value} value={c.value}>
                    {c.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Campo>
          <Campo rotulo="Forma de pagamento">
            <Select
              value={f.forma_pagamento ?? "nenhum"}
              onValueChange={(v) => set("forma_pagamento", v === "nenhum" ? null : v)}
            >
              <SelectTrigger className="h-10">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="nenhum">—</SelectItem>
                {FORMAS_PAGAMENTO.map((c) => (
                  <SelectItem key={c.value} value={c.value}>
                    {c.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Campo>
          <Campo rotulo={natureza === "receita" ? "Cliente" : "Fornecedor"}>
            <Input value={f.fornecedor ?? ""} onChange={(e) => set("fornecedor", e.target.value)} />
          </Campo>
          {!lancamento ? (
            <Campo rotulo="Parcelas" dica="Cartão parcelado: cada parcela na data real.">
              <Input
                inputMode="numeric"
                value={f.parcelas ?? 1}
                onChange={(e) => set("parcelas", e.target.value)}
              />
            </Campo>
          ) : null}
          <label className="flex items-center gap-2 text-[13px] sm:col-span-2">
            <Switch
              checked={!!f.recorrente}
              onCheckedChange={(v) => set("recorrente", v)}
              disabled={Number(f.parcelas) > 1}
            />
            Recorrente (repete todo mês na projeção e nas contas a pagar)
          </label>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancelar
          </Button>
          <Button onClick={enviar} disabled={ocupado || !f.descricao?.trim() || !f.valor}>
            {ocupado ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null} Salvar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function ParametrosDialog({
  aberto,
  d,
  onClose,
}: {
  aberto: boolean;
  d: Financeiro;
  onClose: () => void;
}) {
  const salvar = useServerFn(saveParametros);
  const { executar, ocupado } = useAcao();
  const p = d.parametros;
  const [f, setF] = useState<Record<string, string>>({});
  useEffect(() => {
    if (!aberto) return;
    setF({
      saldo_inicial:
        p.caixa.saldo_inicial == null ? "" : String(p.caixa.saldo_inicial).replace(".", ","),
      saldo_data: p.caixa.data,
      meta_valor: String(p.meta.valor),
      meta_inicio: p.meta.inicio,
      meta_fim: p.meta.fim,
      margem_meta: String(p.margem_meta),
      aliquota: String(p.impostos.aliquota),
    });
  }, [aberto, p]);
  const set = (k: string, v: string) => setF((x) => ({ ...x, [k]: v }));
  return (
    <Dialog open={aberto} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Saldo e metas</DialogTitle>
          <DialogDescription>
            O saldo é o que havia na conta na data informada; o CRM soma e subtrai o que entrou e
            saiu depois.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-3 sm:grid-cols-2">
          <Campo rotulo="Saldo em conta (R$)">
            <Input
              inputMode="decimal"
              value={f.saldo_inicial ?? ""}
              onChange={(e) => set("saldo_inicial", e.target.value)}
              placeholder="0,00"
            />
          </Campo>
          <Campo rotulo="Na data">
            <Input
              type="date"
              value={f.saldo_data ?? ""}
              onChange={(e) => set("saldo_data", e.target.value)}
            />
          </Campo>
          <Campo rotulo="Meta (R$)">
            <Input
              inputMode="decimal"
              value={f.meta_valor ?? ""}
              onChange={(e) => set("meta_valor", e.target.value)}
            />
          </Campo>
          <Campo rotulo="Meta de margem líquida (%)">
            <Input
              inputMode="numeric"
              value={f.margem_meta ?? ""}
              onChange={(e) => set("margem_meta", e.target.value)}
            />
          </Campo>
          <Campo rotulo="Início da meta">
            <Input
              type="date"
              value={f.meta_inicio ?? ""}
              onChange={(e) => set("meta_inicio", e.target.value)}
            />
          </Campo>
          <Campo rotulo="Fim da meta">
            <Input
              type="date"
              value={f.meta_fim ?? ""}
              onChange={(e) => set("meta_fim", e.target.value)}
            />
          </Campo>
          <Campo
            rotulo="Alíquota de imposto (%)"
            dica="Usada quando o imposto do mês ainda não foi lançado."
          >
            <Input
              inputMode="decimal"
              value={f.aliquota ?? ""}
              onChange={(e) => set("aliquota", e.target.value)}
            />
          </Campo>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancelar
          </Button>
          <Button
            disabled={ocupado}
            onClick={async () => {
              const r = await executar(() => salvar({ data: f }), "Parâmetros salvos.");
              if (r) onClose();
            }}
          >
            {ocupado ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null} Salvar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ---------- Notas fiscais ----------

function Notas({ d, onNova }: { d: Financeiro; onNova: () => void }) {
  const apagar = useServerFn(deleteNota);
  const { executar } = useAcao();
  const semNota = d.negociosPagos.filter((n) => !n.nf);
  return (
    <div className="space-y-5">
      <Secao
        titulo="Notas fiscais"
        contagem={d.notas.length}
        colado
        acoes={
          <Button size="sm" className="h-8" onClick={onNova}>
            <Plus className="h-4 w-4" /> Registrar nota
          </Button>
        }
      >
        {d.notas.length ? (
          <ul className="divide-y">
            {d.notas.map((n) => (
              <li key={n.id} className="flex items-center gap-3 px-4 py-2.5 sm:px-5">
                <span className="tabular w-20 text-[12px] font-semibold">{fmtDia(n.data)}</span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[13.5px] font-semibold">NF {n.numero}</span>
                  <span className="block truncate text-[11.5px] text-muted-foreground">
                    {n.cliente}
                  </span>
                </span>
                <Etiqueta tom="ok">pagamento confirmado</Etiqueta>
                <span className="tabular w-24 text-right font-semibold">{fmtMoeda(n.valor)}</span>
                <button
                  type="button"
                  aria-label="Apagar"
                  onClick={() => {
                    if (window.confirm(`Apagar o registro da NF ${n.numero}?`))
                      void executar(() => apagar({ data: { id: n.id } }), "Registro apagado.");
                  }}
                  className="rounded p-1.5 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </li>
            ))}
          </ul>
        ) : (
          <div className="p-5">
            <Vazio>
              Nenhuma nota registrada. A nota só pode ser registrada para um negócio já pago.
            </Vazio>
          </div>
        )}
      </Secao>
      <Secao titulo="Pagos sem nota registrada" contagem={semNota.length} colado>
        {semNota.length ? (
          <ul className="divide-y">
            {semNota.slice(0, 50).map((n) => (
              <li key={n.id} className="flex items-center gap-3 px-4 py-2 text-[13px] sm:px-5">
                <span className="min-w-0 flex-1 truncate font-medium">{n.titulo}</span>
                <span className="tabular font-semibold">{fmtMoeda(n.valor)}</span>
              </li>
            ))}
          </ul>
        ) : (
          <div className="p-4">
            <Vazio>Todos os pagos têm nota.</Vazio>
          </div>
        )}
      </Secao>
    </div>
  );
}

function NotaDialog({
  aberto,
  d,
  onClose,
}: {
  aberto: boolean;
  d: Financeiro;
  onClose: () => void;
}) {
  const salvar = useServerFn(saveNota);
  const { executar, ocupado } = useAcao();
  const [f, setF] = useState<{ numero: string; negocio_id: string; valor: string; data: string }>({
    numero: "",
    negocio_id: "",
    valor: "",
    data: hojeBR(),
  });
  const opcoes = useMemo(() => d.negociosPagos.filter((n) => !n.nf), [d.negociosPagos]);
  useEffect(() => {
    if (aberto) setF({ numero: "", negocio_id: "", valor: "", data: hojeBR() });
  }, [aberto]);
  const escolhido = opcoes.find((n) => n.id === f.negocio_id);
  return (
    <Dialog open={aberto} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Registrar nota fiscal</DialogTitle>
          <DialogDescription>
            Só aparecem negócios com pagamento confirmado. Sem pagamento, a nota fica bloqueada.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-3 sm:grid-cols-2">
          <Campo rotulo="Negócio pago" className="sm:col-span-2">
            <Select
              value={f.negocio_id || undefined}
              onValueChange={(v) => setF((x) => ({ ...x, negocio_id: v }))}
            >
              <SelectTrigger className="h-10">
                <SelectValue placeholder="Escolha o negócio" />
              </SelectTrigger>
              <SelectContent>
                {opcoes.map((n) => (
                  <SelectItem key={n.id} value={n.id}>
                    {n.titulo} · {fmtMoeda(n.valor)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Campo>
          <Campo rotulo="Número da nota">
            <Input
              value={f.numero}
              onChange={(e) => setF((x) => ({ ...x, numero: e.target.value }))}
            />
          </Campo>
          <Campo rotulo="Data de emissão">
            <Input
              type="date"
              value={f.data}
              onChange={(e) => setF((x) => ({ ...x, data: e.target.value }))}
            />
          </Campo>
          <Campo
            rotulo="Valor (R$)"
            dica={escolhido ? `Vazio = ${fmtMoeda(escolhido.valor)}` : undefined}
          >
            <Input
              inputMode="decimal"
              value={f.valor}
              onChange={(e) => setF((x) => ({ ...x, valor: e.target.value }))}
            />
          </Campo>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancelar
          </Button>
          <Button
            disabled={ocupado || !f.numero.trim() || !f.negocio_id}
            onClick={async () => {
              const r = await executar(
                () => salvar({ data: { ...f, cliente: escolhido?.titulo } }),
                "Nota registrada.",
              );
              if (r) onClose();
            }}
          >
            {ocupado ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null} Registrar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
