import { useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";

import { ChevronRight } from "lucide-react";

import {
  AoVivo,
  Cartao,
  Carregando,
  Erro,
  FaixaNumeros,
  FiltroSelect,
  Numero,
  PainelNumeros,
} from "@/components/crm/ui";
import { getIndicadores, type Indicadores } from "@/lib/crm/metricas.functions";
import { CANAIS, labelDe } from "@/lib/crm/utils";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_crm/indicadores")({
  component: IndicadoresPage,
});

/* Indicadores: os números gerais da base (leads, novos por dia, canais, funis,
   audiência). O funil de vendas detalhado fica na aba "Funil e vendas". */

const n = (x: number) => x.toLocaleString("pt-BR");
const CANAL_LABEL = [{ value: "instagram", label: "Instagram" }, ...CANAIS];
const FUNIL: Record<string, string> = {
  materia: "Matéria",
  ativacao: "Ativação",
  publicidade: "Publicidade",
  evento: "Evento",
  implementacao: "Implementação",
  palco: "Palco",
};

function IndicadoresPage() {
  const fetchInd = useServerFn(getIndicadores);
  const { data, isLoading, error } = useQuery({
    queryKey: ["crm", "indicadores"],
    queryFn: () => fetchInd(),
    refetchInterval: 5 * 60_000,
  });
  if (isLoading) return <Carregando texto="Somando os indicadores..." />;
  if (error || !data) return <Erro erro={error} />;
  const d = data;
  const mediaDia = d.novos_30 / 30;
  const taxaResp = d.enviadas_7 ? d.respostas_7 / d.enviadas_7 : null;

  return (
    <div className="space-y-4 sm:space-y-5">
      <header className="min-w-0">
        <div className="flex items-center gap-3">
          <h1 className="font-display truncate text-[22px] font-bold leading-tight tracking-[-0.02em] sm:text-[28px]">
            Visão geral
          </h1>
          <AoVivo className="hidden sm:inline-flex" />
        </div>
        <p className="mt-0.5 text-[13px] text-muted-foreground sm:text-[14px]">
          <b className="font-semibold text-foreground">{n(d.pessoas)} leads</b> na base ·{" "}
          {n(d.empresas)} empresas · {n(d.negocios_abertos)} negócios em aberto
        </p>
      </header>

      <FaixaNumeros
        itens={[
          {
            rotulo: "Leads no CRM",
            valor: n(d.pessoas),
            detalhe: `${n(d.empresas)} empresas`,
          },
          {
            rotulo: "Novos leads hoje",
            valor: n(d.novos_hoje),
            detalhe: `${n(d.novos_7)} em 7 dias · ${mediaDia.toFixed(0)}/dia`,
            tom: "ok",
          },
          {
            rotulo: "Negócios em aberto",
            valor: n(d.negocios_abertos),
            detalhe: `${n(d.negocios_7)} criados em 7 dias`,
          },
          {
            rotulo: "Respostas em 7 dias",
            valor: n(d.respostas_7),
            detalhe:
              taxaResp == null
                ? "nenhuma mensagem enviada"
                : `${Math.round(taxaResp * 100)}% de ${n(d.enviadas_7)} mensagens`,
            tom: "azul",
          },
        ]}
      />

      <NovosPorDia d={d} />

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        <Barras
          titulo="Negócios por canal"
          linhas={d.por_canal.map((c) => ({
            nome: labelDe(CANAL_LABEL, c.chave) || c.chave,
            total: c.total,
          }))}
        />
        <Barras
          titulo="Negócios por funil"
          linhas={d.por_funil.map((c) => ({ nome: FUNIL[c.chave] ?? c.chave, total: c.total }))}
        />
        <Barras
          titulo="Empresas por prioridade"
          sub="A = prioridade máxima"
          linhas={d.por_grupo.map((c) => ({
            nome: c.chave === "—" ? "Sem grupo" : `Grupo ${c.chave}`,
            total: c.total,
          }))}
        />
      </div>

      {d.audiencia ? (
        <Cartao
          titulo="Audiência · últimos 7 dias"
          extra={
            <Link
              to="/audiencia"
              className="text-[12.5px] font-semibold text-primary hover:underline"
            >
              Ver audiência
            </Link>
          }
        >
          <PainelNumeros quantidade={4}>
            <Numero rotulo="Assinantes" valor={n(d.audiencia.assinantes)} link="/newsletter" />
            <Numero
              rotulo="Novos assinantes"
              valor={`+${n(d.audiencia.novos)}`}
              detalhe={`${n(d.audiencia.descadastros)} saíram`}
              destaque={d.audiencia.novos > d.audiencia.descadastros ? "ok" : undefined}
            />
            <Numero
              rotulo="Visitas no site"
              valor={n(d.audiencia.visitas)}
              detalhe={
                d.audiencia.visitasAnt
                  ? `${d.audiencia.visitas >= d.audiencia.visitasAnt ? "+" : ""}${Math.round(
                      (d.audiencia.visitas / d.audiencia.visitasAnt - 1) * 100,
                    )}% vs. semana anterior`
                  : undefined
              }
              destaque={
                d.audiencia.visitasAnt
                  ? d.audiencia.visitas >= d.audiencia.visitasAnt
                    ? "ok"
                    : "alerta"
                  : undefined
              }
              link="/audiencia"
            />
            <Numero
              rotulo="Conversão do site"
              valor={
                d.audiencia.visitas
                  ? `${((d.audiencia.novos / d.audiencia.visitas) * 100).toFixed(1).replace(".", ",")}%`
                  : "—"
              }
              detalhe="visita que vira assinante"
            />
          </PainelNumeros>
        </Cartao>
      ) : null}

      <Link
        to="/comercial"
        className="group flex items-center justify-between gap-4 rounded-xl border bg-card px-4 py-4 transition hover:border-[#C9D7FF] sm:px-5"
      >
        <span className="min-w-0">
          <span className="block text-[14.5px] font-semibold">Funil e vendas</span>
          <span className="block text-[12.5px] text-muted-foreground">
            Conversão por etapa, canal e abordagem, ticket, ciclo, perdas e atividade da equipe
          </span>
        </span>
        <ChevronRight className="h-5 w-5 shrink-0 text-muted-foreground transition group-hover:translate-x-0.5 group-hover:text-primary" />
      </Link>
    </div>
  );
}

function NovosPorDia({ d }: { d: Indicadores }) {
  const [serie, setSerie] = useState<"pessoas" | "negocios">("pessoas");
  const [foco, setFoco] = useState<number | null>(null);
  const dias = d.por_dia;
  const max = Math.max(1, ...dias.map((x) => x[serie]));
  const total = dias.reduce((s, x) => s + x[serie], 0);
  const pico = dias.reduce<(typeof dias)[number] | null>(
    (m, x) => (!m || x[serie] > m[serie] ? x : m),
    null,
  );
  const atual = foco != null ? dias[foco] : null;
  const curto = (dia: string) => `${dia.slice(8, 10)}/${dia.slice(5, 7)}`;
  return (
    <Cartao
      titulo="Novos por dia · 30 dias"
      sub="Picos altos costumam ser listas importadas de uma vez."
      extra={
        <FiltroSelect
          valor={serie}
          onChange={setSerie}
          titulo="Série"
          opcoes={[
            { valor: "pessoas", rotulo: "Leads" },
            { valor: "negocios", rotulo: "Negócios" },
          ]}
        />
      }
    >
      <p className="tabular mb-2 min-h-[18px] text-[12px] text-muted-foreground">
        {atual ? (
          <>
            {curto(atual.dia)}: <b className="font-semibold text-foreground">{n(atual[serie])}</b>{" "}
            {serie === "pessoas" ? "leads" : "negócios"}
          </>
        ) : (
          <>
            <b className="font-semibold text-foreground">{n(total)}</b> em 30 dias · média{" "}
            {(total / Math.max(1, dias.length)).toFixed(1).replace(".", ",")} por dia
            {pico && pico[serie] ? ` · pico ${curto(pico.dia)} (${n(pico[serie])})` : ""}
          </>
        )}
      </p>
      <div
        className="flex h-[168px] items-end gap-[3px] border-b"
        onMouseLeave={() => setFoco(null)}
      >
        {dias.map((x, i) => (
          <button
            key={x.dia}
            type="button"
            aria-label={`${curto(x.dia)}: ${x[serie]}`}
            onMouseEnter={() => setFoco(i)}
            onFocus={() => setFoco(i)}
            onClick={() => setFoco(foco === i ? null : i)}
            className="flex h-full min-w-0 flex-1 flex-col justify-end outline-none"
          >
            <span
              className={cn(
                "block w-full rounded-t-[3px] transition-colors",
                foco === i ? "bg-[#1747C8]" : "bg-primary",
                !x[serie] && "bg-transparent",
              )}
              style={{ height: `${(x[serie] / max) * 100}%`, minHeight: x[serie] ? 3 : 0 }}
            />
          </button>
        ))}
      </div>
      <div className="mt-1.5 flex justify-between text-[11px] text-muted-foreground">
        <span>{dias[0] ? curto(dias[0].dia) : ""}</span>
        <span>hoje</span>
      </div>
    </Cartao>
  );
}

function Barras({
  titulo,
  sub,
  linhas,
}: {
  titulo: string;
  sub?: string;
  linhas: { nome: string; total: number }[];
}) {
  const max = Math.max(1, ...linhas.map((l) => l.total));
  const soma = linhas.reduce((s, l) => s + l.total, 0);
  return (
    <Cartao titulo={titulo} sub={sub ?? `${n(soma)} no total`}>
      {linhas.length ? (
        <ul className="space-y-3">
          {linhas.slice(0, 8).map((l) => (
            <li key={l.nome}>
              <div className="flex items-baseline justify-between gap-3 text-[13px]">
                <span className="truncate text-[#3A4456]" title={l.nome}>
                  {l.nome}
                </span>
                <span className="tabular shrink-0">
                  <b className="font-semibold">{n(l.total)}</b>
                  <span className="ml-1.5 text-[11.5px] text-muted-foreground">
                    {soma ? `${Math.round((l.total / soma) * 100)}%` : ""}
                  </span>
                </span>
              </div>
              <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-[#EEF1F5]">
                <div
                  className="h-full rounded-full bg-primary"
                  style={{ width: `${Math.max(2, (l.total / max) * 100)}%` }}
                />
              </div>
            </li>
          ))}
        </ul>
      ) : (
        <p className="py-6 text-center text-[13px] text-muted-foreground">Sem dados.</p>
      )}
    </Cartao>
  );
}
