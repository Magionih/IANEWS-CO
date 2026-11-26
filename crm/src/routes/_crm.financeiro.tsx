import { useEffect, useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  Check,
  ChevronLeft,
  ChevronRight,
  Loader2,
  Pencil,
  Plus,
  Settings2,
  Trash2,
} from "lucide-react";

import { useCrm } from "@/components/crm/context";
import { NegocioPainel } from "@/components/crm/negocio";
import { useAcao } from "@/components/crm/queries";
import {
  Alternador,
  BotaoCsv,
  CabecalhoPagina,
  Campo,
  Carregando,
  Erro,
  Etiqueta,
  FaixaNumeros,
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

type Aba = "resumo" | "receber" | "pagar" | "lancamentos" | "notas";

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
      <div className="space-y-5">
        <CabecalhoPagina titulo="Financeiro" />
        <Vazio>Só administradores veem o financeiro.</Vazio>
      </div>
    );
  if (isLoading) return <Carregando texto="Somando o caixa..." />;
  if (error || !data) return <Erro erro={error} />;

  return (
    <div className="space-y-5">
      <CabecalhoPagina
        titulo="Financeiro"
        descricao="Lucro líquido em caixa por mês. Vendido, faturado e recebido são coisas diferentes: aqui conta o que entrou."
        acoes={
          <>
            <Button variant="outline" size="sm" className="h-9" onClick={() => setParams(true)}>
              <Settings2 className="h-4 w-4" />
              <span className="hidden sm:inline">Saldo e metas</span>
            </Button>
            <Button size="sm" className="h-9" onClick={() => setEditando("novo")}>
              <Plus className="h-4 w-4" /> Lançamento
            </Button>
          </>
        }
      />

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="icon"
            className="h-9 w-9"
            onClick={() => setMes(somarMes(mes, -1))}
            aria-label="Mês anterior"
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <h2
            className={cn(
              "min-w-[160px] text-center text-[15px] font-semibold",
              isFetching && "opacity-60",
            )}
          >
            {nomeMes(mes)}
          </h2>
          <Button
            variant="outline"
            size="icon"
            className="h-9 w-9"
            onClick={() => setMes(somarMes(mes, 1))}
            aria-label="Próximo mês"
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
        <Alternador
          valor={aba}
          onChange={setAba}
          opcoes={[
            { valor: "resumo", rotulo: "Resumo" },
            { valor: "receber", rotulo: `A receber (${data.receber.length})` },
            { valor: "pagar", rotulo: "A pagar" },
            { valor: "lancamentos", rotulo: "Lançamentos" },
            { valor: "notas", rotulo: "Notas fiscais" },
          ]}
        />
      </div>

      {aba === "resumo" ? <Resumo d={data} /> : null}
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

function Resumo({ d }: { d: Financeiro }) {
  const dre = d.dre;
  return (
    <div className="space-y-5">
      <FaixaNumeros
        itens={[
          {
            rotulo: "Recebido no mês",
            valor: fmtMoeda(dre.receitaBruta),
            detalhe: <Variacao atual={dre.receitaBruta} anterior={d.dreAnterior.receitaBruta} />,
            tom: "azul",
          },
          {
            rotulo: "Lucro líquido",
            valor: fmtMoeda(dre.lucro),
            detalhe: `margem ${fmtPct(dre.margemLiquida)} · meta ${d.parametros.margem_meta}%`,
            tom: dre.lucro < 0 ? "alerta" : undefined,
          },
          {
            rotulo: "Saldo de caixa",
            valor: d.saldo == null ? "Informe" : fmtMoeda(d.saldo),
            detalhe: d.saldo == null ? "em Saldo e metas" : `fôlego ${meses(d.folegoMeses)}`,
          },
          {
            rotulo: "Ritmo da meta",
            valor: fmtPct(d.ritmo.pct),
            detalhe: `${fmtMoeda(d.ritmo.ritmoMes)}/mês de ${fmtMoeda(d.ritmo.necessarioMes)}`,
            tom: d.ritmo.pct != null && d.ritmo.pct < 0.8 ? "alerta" : undefined,
          },
          {
            rotulo: "Ponto de equilíbrio",
            valor: d.pontoEquilibrio == null ? "—" : fmtMoeda(d.pontoEquilibrio),
            detalhe: d.custoFixoConfigurado ? "receita mínima por mês" : "lance os custos fixos",
          },
          {
            rotulo: "A receber",
            valor: fmtMoeda(d.receber.reduce((s, c) => s + c.valor, 0)),
            detalhe: `${d.receber.length} cobranças`,
            tom: d.receberIdade.mais30 ? "alerta" : undefined,
          },
        ]}
      />

      <div className="grid gap-5 xl:grid-cols-[1.1fr_1fr]">
        <TabelaDre
          dre={dre}
          anterior={d.dreAnterior}
          metaMargem={d.parametros.margem_meta}
          aliquota={d.parametros.impostos.aliquota}
        />
        <Secao titulo="Indicadores">
          <dl className="grid grid-cols-2 gap-x-5 gap-y-4 text-[13px]">
            <Indicador
              rotulo="Meta de 90 dias"
              valor={fmtMoeda(d.parametros.meta.valor)}
              detalhe={`${fmtMoeda(d.ritmo.recebido)} recebidos em ${d.ritmo.dias} dias`}
            />
            <Indicador
              rotulo="Custo fixo por mês"
              valor={d.custoFixoConfigurado ? fmtMoeda(d.custoFixo) : "não lançado"}
              detalhe={`saída média ${fmtMoeda(d.saidaMensal)}/mês`}
              alerta={!d.custoFixoConfigurado}
            />
            <Indicador
              rotulo="Margem de contribuição"
              valor={fmtPct(dre.margemContribuicaoPct)}
              detalhe="meta acima de 80%"
              alerta={dre.margemContribuicaoPct != null && dre.margemContribuicaoPct < 0.8}
            />
            <Indicador
              rotulo="Inadimplência"
              valor={fmtPct(d.inadimplencia, 1)}
              detalhe="vencido há 30+ dias ÷ vendas de 90 dias"
            />
            <Indicador
              rotulo="A receber há 30+ dias"
              valor={fmtMoeda(d.receberIdade.mais30)}
              detalhe={`0–7 dias ${fmtMoeda(d.receberIdade.ate7)} · 8–30 ${fmtMoeda(d.receberIdade.ate30)}`}
              alerta={d.receberIdade.mais30 > 0}
            />
            <Indicador
              rotulo="Concentração (top 3)"
              valor={fmtPct(d.concentracao.top3Pct)}
              detalhe={
                d.concentracao.clientes
                  .slice(0, 3)
                  .map((c) => c.cliente)
                  .join(", ") || "últimos 90 dias"
              }
              alerta={(d.concentracao.top3Pct ?? 0) > 0.4}
            />
            <Indicador
              rotulo="ROI do mês"
              valor={d.roi == null ? "—" : `${d.roi.toFixed(1).replace(".", ",")}x`}
              detalhe={
                d.roi == null
                  ? "sem investimento lançado"
                  : "(receita − investimento) ÷ investimento"
              }
            />
            <Indicador
              rotulo="Fôlego (runway)"
              valor={meses(d.folegoMeses)}
              detalhe="saldo ÷ saída média"
              alerta={d.folegoMeses != null && d.folegoMeses < 1}
            />
          </dl>
        </Secao>
      </div>

      <Projecao d={d} />

      <div className="grid gap-5 xl:grid-cols-[1.4fr_1fr]">
        <FluxoMes d={d} />
        <Secao titulo="Resultado por centro de custo" colado>
          {d.centros.length ? (
            <table className="w-full text-[13px]">
              <thead className="text-[11.5px] text-muted-foreground">
                <tr className="border-b">
                  <th className="px-4 py-2 text-left font-medium">Centro</th>
                  <th className="px-2 py-2 text-right font-medium">Receita</th>
                  <th className="px-2 py-2 text-right font-medium">Custos</th>
                  <th className="px-4 py-2 text-right font-medium">Resultado</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {d.centros.map((c) => (
                  <tr key={c.centro}>
                    <td className="px-4 py-2 font-medium">
                      {labelDe(CENTROS, c.centro) || "Geral"}
                    </td>
                    <td className="tabular px-2 py-2 text-right">{fmtMoeda(c.receita)}</td>
                    <td className="tabular px-2 py-2 text-right">{fmtMoeda(c.custos)}</td>
                    <td
                      className={cn(
                        "tabular px-4 py-2 text-right font-semibold",
                        c.resultado < 0 && "text-destructive",
                      )}
                    >
                      {fmtMoeda(c.resultado)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <div className="p-4">
              <Vazio>Nada no mês.</Vazio>
            </div>
          )}
        </Secao>
      </div>
    </div>
  );
}

function Indicador({
  rotulo,
  valor,
  detalhe,
  alerta,
}: {
  rotulo: string;
  valor: string;
  detalhe?: string;
  alerta?: boolean;
}) {
  return (
    <div className="min-w-0">
      <dt className="text-[11.5px] font-medium text-muted-foreground">{rotulo}</dt>
      <dd
        className={cn(
          "tabular mt-0.5 truncate text-[15px] font-semibold",
          alerta && "text-destructive",
        )}
      >
        {valor}
      </dd>
      {detalhe ? <dd className="truncate text-[11px] text-muted-foreground">{detalhe}</dd> : null}
    </div>
  );
}

function TabelaDre({
  dre,
  anterior,
  metaMargem,
  aliquota,
}: {
  dre: Dre;
  anterior: Dre;
  metaMargem: number;
  aliquota: number;
}) {
  const linhas: {
    rotulo: string;
    v: number;
    a: number;
    total?: boolean;
    menos?: boolean;
    dica?: string;
  }[] = [
    {
      rotulo: "Receita bruta (recebida)",
      v: dre.receitaBruta,
      a: anterior.receitaBruta,
      total: true,
    },
    {
      rotulo: "Impostos",
      v: dre.impostos,
      a: anterior.impostos,
      menos: true,
      dica: dre.impostosEstimado ? `estimado em ${aliquota}% (Simples)` : undefined,
    },
    { rotulo: "Taxas (Asaas, cartão)", v: dre.taxas, a: anterior.taxas, menos: true },
    { rotulo: "Receita líquida", v: dre.receitaLiquida, a: anterior.receitaLiquida, total: true },
    { rotulo: "Custos variáveis", v: dre.variaveis, a: anterior.variaveis, menos: true },
    {
      rotulo: "Margem de contribuição",
      v: dre.margemContribuicao,
      a: anterior.margemContribuicao,
      total: true,
      dica: fmtPct(dre.margemContribuicaoPct),
    },
    { rotulo: "Custos fixos", v: dre.fixos, a: anterior.fixos, menos: true },
    { rotulo: "EBITDA", v: dre.ebitda, a: anterior.ebitda, total: true },
    { rotulo: "Investimentos", v: dre.investimentos, a: anterior.investimentos, menos: true },
    {
      rotulo: "Lucro líquido",
      v: dre.lucro,
      a: anterior.lucro,
      total: true,
      dica: `${fmtPct(dre.margemLiquida)} · meta ${metaMargem}%`,
    },
  ];
  return (
    <Secao
      titulo="DRE do mês"
      colado
      acoes={<span className="text-xs text-muted-foreground">mês anterior à direita</span>}
    >
      <table className="w-full text-[13px]">
        <tbody className="divide-y">
          {linhas.map((l) => (
            <tr key={l.rotulo} className={cn(l.total && "bg-muted/40")}>
              <td
                className={cn(
                  "px-4 py-2",
                  l.total ? "font-semibold" : "pl-7 text-muted-foreground",
                )}
              >
                {l.rotulo}
                {l.dica ? (
                  <span className="ml-2 text-[11px] font-normal text-muted-foreground">
                    {l.dica}
                  </span>
                ) : null}
              </td>
              <td
                className={cn(
                  "tabular px-2 py-2 text-right",
                  l.total && "font-semibold",
                  l.total && l.v < 0 && "text-destructive",
                )}
              >
                {l.menos && l.v ? "− " : ""}
                {fmtMoeda(l.v)}
              </td>
              <td className="tabular px-4 py-2 text-right text-[12px] text-muted-foreground">
                {fmtMoeda(l.a)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </Secao>
  );
}

function Projecao({ d }: { d: Financeiro }) {
  const p = d.projecao;
  const maior = Math.max(1, ...p.semanas.map((s) => Math.max(s.entradas, s.saidas)));
  return (
    <Secao
      titulo="Caixa projetado · próximos 90 dias"
      colado
      acoes={
        <span className="text-xs text-muted-foreground">
          {d.saldo == null
            ? "Informe o saldo para ver o saldo projetado"
            : `menor saldo ${fmtMoeda(p.minimo)} · em 90 dias ${fmtMoeda(p.final)}`}
        </span>
      }
    >
      <div className="overflow-x-auto">
        <table className="w-full min-w-[560px] text-[12.5px]">
          <thead className="text-[11.5px] text-muted-foreground">
            <tr className="border-b">
              <th className="px-4 py-2 text-left font-medium">Semana de</th>
              <th className="px-2 py-2 text-left font-medium">Entradas previstas</th>
              <th className="px-2 py-2 text-left font-medium">Saídas previstas</th>
              <th className="px-4 py-2 text-right font-medium">Saldo</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {p.semanas.map((s) => (
              <tr key={s.inicio}>
                <td className="whitespace-nowrap px-4 py-1.5 font-medium">{fmtDia(s.inicio)}</td>
                <td className="px-2 py-1.5">
                  <Barra valor={s.entradas} maior={maior} cor="bg-emerald-500" />
                </td>
                <td className="px-2 py-1.5">
                  <Barra valor={s.saidas} maior={maior} cor="bg-destructive/70" />
                </td>
                <td
                  className={cn(
                    "tabular px-4 py-1.5 text-right font-semibold",
                    d.saldo != null && s.saldo < d.custoFixo && "text-destructive",
                  )}
                >
                  {d.saldo == null ? "—" : fmtMoeda(s.saldo)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {p.semData ? (
        <p className="border-t px-4 py-2.5 text-[11.5px] text-muted-foreground">
          {fmtMoeda(p.semData)} a receber sem data prevista não entram na projeção. Coloque a data
          em cada negócio.
        </p>
      ) : null}
    </Secao>
  );
}

function Barra({ valor, maior, cor }: { valor: number; maior: number; cor: string }) {
  return (
    <span className="flex items-center gap-2">
      <span className="h-2 w-28 overflow-hidden rounded-full bg-muted sm:w-40">
        <span
          className={cn("block h-full rounded-full", cor)}
          style={{ width: `${(valor / maior) * 100}%` }}
        />
      </span>
      <span className="tabular text-muted-foreground">{valor ? fmtMoeda(valor) : "—"}</span>
    </span>
  );
}

function FluxoMes({ d }: { d: Financeiro }) {
  const maior = Math.max(1, ...d.fluxoMes.map((x) => Math.max(x.entradas, x.saidas)));
  return (
    <Secao
      titulo="Fluxo realizado no mês"
      acoes={<span className="text-xs text-muted-foreground">verde entra · vermelho sai</span>}
    >
      <div className="flex h-36 items-end gap-[3px]">
        {d.fluxoMes.map((x) => (
          <div
            key={x.dia}
            className="flex h-full min-w-0 flex-1 flex-col justify-end gap-[2px]"
            title={`${fmtDia(x.dia)}: +${fmtMoeda(x.entradas)} / −${fmtMoeda(x.saidas)}`}
          >
            <span
              className="block rounded-t-sm bg-emerald-500"
              style={{ height: `${(x.entradas / maior) * 100}%` }}
            />
            <span
              className="block rounded-b-sm bg-destructive/70"
              style={{ height: `${(x.saidas / maior) * 50}%` }}
            />
          </div>
        ))}
      </div>
      <div className="mt-1.5 flex justify-between text-[10.5px] text-muted-foreground">
        <span>1</span>
        <span>15</span>
        <span>{d.fluxoMes.length}</span>
      </div>
    </Secao>
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
          <Alternador
            valor={filtro}
            onChange={setFiltro}
            opcoes={[
              { valor: "todos", rotulo: "Todas" },
              { valor: "sem_link", rotulo: "Sem link" },
              { valor: "lembrar", rotulo: "Link enviado" },
              { valor: "vencido", rotulo: "Vencidas" },
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
            <li key={c.id} className="flex flex-wrap items-center gap-3 px-4 py-2.5 sm:px-5">
              <button
                type="button"
                onClick={() => c.origem === "negocio" && onAbrir(c.id)}
                className="min-w-0 flex-1 text-left"
              >
                <span className="block truncate text-[13.5px] font-semibold hover:text-primary">
                  {c.cliente}
                </span>
                <span className="block truncate text-[11.5px] text-muted-foreground">
                  {c.origem === "negocio"
                    ? `fechado há ${c.idade} dia${c.idade === 1 ? "" : "s"}`
                    : "lançamento previsto"}
                  {c.previsto ? ` · previsto ${fmtDia(c.previsto)}` : " · sem data prevista"}
                  {c.forma ? ` · ${labelDe(FORMAS_PAGAMENTO, c.forma)}` : ""}
                </span>
              </button>
              <Etiqueta tom={ESTADO[c.estado].tom}>{ESTADO[c.estado].rotulo}</Etiqueta>
              <span className="tabular w-24 text-right text-[13.5px] font-semibold">
                {fmtMoeda(c.valor)}
              </span>
              <Button
                size="sm"
                variant="outline"
                className="h-8"
                onClick={() =>
                  executar(async () => {
                    if (c.origem === "negocio")
                      await salvarNeg({ data: { id: c.id, status_pagamento: "pago" } });
                    else await confirmar({ data: { id: c.id } });
                    return true;
                  }, "Pagamento confirmado.")
                }
              >
                <Check className="h-3.5 w-3.5" /> Recebido
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
          <Select value={nat} onValueChange={(v) => setNat(v as typeof nat)}>
            <SelectTrigger className="h-8 w-44 text-[13px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todas">Todas as naturezas</SelectItem>
              {NATUREZAS.map((n) => (
                <SelectItem key={n.value} value={n.value}>
                  {n.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
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
        <div className="overflow-x-auto">
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
