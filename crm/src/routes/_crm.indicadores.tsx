import { useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";

import { Alternador, CabecalhoPagina, Carregando, Erro, FaixaNumeros } from "@/components/crm/ui";
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
    <div className="space-y-6">
      <CabecalhoPagina
        titulo="Indicadores"
        subtitulo={
          <>
            <b>{n(d.pessoas)} leads</b> na base · {n(d.empresas)} empresas · {n(d.negocios_abertos)}{" "}
            negócios em aberto
          </>
        }
      />

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
            detalhe: `${n(d.novos_7)} em 7 dias · média ${mediaDia.toFixed(0)}/dia`,
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

      <div className="grid gap-4 lg:grid-cols-3">
        <Barras
          titulo="Negócios por canal"
          linhas={d.por_canal.map((c) => ({
            nome: labelDe(CANAL_LABEL, c.chave) || c.chave,
            total: c.total,
          }))}
        />
        <Barras
          titulo="Negócios por funil"
          linhas={d.por_funil.map((c) => ({ nome: c.chave, total: c.total }))}
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
        <section className="rounded-2xl border bg-card p-6">
          <div className="mb-4 flex items-center justify-between gap-3">
            <h2 className="text-[16px] font-semibold">Audiência · últimos 7 dias</h2>
            <Link
              to="/audiencia"
              className="text-[13px] font-semibold text-primary hover:underline"
            >
              Ver audiência
            </Link>
          </div>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            <Mini rotulo="Assinantes da newsletter" valor={n(d.audiencia.assinantes)} />
            <Mini rotulo="Novos assinantes" valor={`+${n(d.audiencia.novos)}`} />
            <Mini rotulo="Descadastros" valor={n(d.audiencia.descadastros)} />
            <Mini
              rotulo="Visitas no site"
              valor={n(d.audiencia.visitas)}
              detalhe={
                d.audiencia.visitasAnt
                  ? `${d.audiencia.visitas >= d.audiencia.visitasAnt ? "+" : ""}${Math.round(
                      (d.audiencia.visitas / d.audiencia.visitasAnt - 1) * 100,
                    )}% vs semana anterior`
                  : undefined
              }
            />
          </div>
        </section>
      ) : null}

      <Link
        to="/comercial"
        className="flex items-center justify-between rounded-2xl border bg-card px-6 py-5 transition hover:border-[#C9D7FF]"
      >
        <span>
          <span className="block text-[15px] font-semibold">Funil e vendas</span>
          <span className="block text-[13px] text-muted-foreground">
            Conversão por etapa, canal e abordagem, ticket, ciclo, perdas e atividade da equipe
          </span>
        </span>
        <span className="text-[13px] font-semibold text-primary">Abrir</span>
      </Link>
    </div>
  );
}

function NovosPorDia({ d }: { d: Indicadores }) {
  const [serie, setSerie] = useState<"pessoas" | "negocios">("pessoas");
  const dias = d.por_dia;
  const max = Math.max(1, ...dias.map((x) => x[serie]));
  return (
    <section className="rounded-2xl border bg-card p-6">
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-[16px] font-semibold">Novos por dia · 30 dias</h2>
          <p className="mt-1 text-[13px] text-muted-foreground">
            Picos altos costumam ser listas importadas de uma vez.
          </p>
        </div>
        <Alternador
          valor={serie}
          onChange={setSerie}
          opcoes={[
            { valor: "pessoas", rotulo: "Leads" },
            { valor: "negocios", rotulo: "Negócios" },
          ]}
        />
      </div>
      <div className="flex h-[180px] items-end gap-[3px] border-b">
        {dias.map((x) => (
          <div
            key={x.dia}
            title={`${x.dia.slice(8, 10)}/${x.dia.slice(5, 7)}: ${x[serie]}`}
            className="group relative flex h-full min-w-0 flex-1 flex-col justify-end"
          >
            <div
              className={cn(
                "w-full rounded-t-[3px] bg-primary transition group-hover:bg-[#1747C8]",
                !x[serie] && "bg-transparent",
              )}
              style={{ height: `${(x[serie] / max) * 100}%`, minHeight: x[serie] ? 3 : 0 }}
            />
          </div>
        ))}
      </div>
      <div className="mt-2 flex justify-between text-[11.5px] text-muted-foreground">
        <span>
          {dias[0]?.dia.slice(8, 10)}/{dias[0]?.dia.slice(5, 7)}
        </span>
        <span>hoje</span>
      </div>
    </section>
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
  return (
    <section className="min-w-0 rounded-2xl border bg-card p-6">
      <h2 className="text-[16px] font-semibold">{titulo}</h2>
      {sub ? <p className="mt-1 text-[12.5px] text-muted-foreground">{sub}</p> : null}
      <div className="mt-4 flex flex-col gap-3">
        {linhas.slice(0, 8).map((l) => (
          <div
            key={l.nome}
            className="grid grid-cols-[minmax(0,120px)_minmax(0,1fr)_48px] items-center gap-3"
          >
            <span className="truncate text-[13px] text-[#3A4456]" title={l.nome}>
              {l.nome}
            </span>
            <div className="h-[18px] overflow-hidden rounded-md bg-[#F1F3F7]">
              <div
                className="h-full rounded-md bg-primary"
                style={{ width: `${Math.max(2, (l.total / max) * 100)}%` }}
              />
            </div>
            <span className="tabular text-right text-[13px] font-semibold">{n(l.total)}</span>
          </div>
        ))}
      </div>
    </section>
  );
}

function Mini({ rotulo, valor, detalhe }: { rotulo: string; valor: string; detalhe?: string }) {
  return (
    <div className="min-w-0 rounded-xl bg-background p-3.5">
      <span className="block truncate text-[12px] text-muted-foreground">{rotulo}</span>
      <span className="font-display tabular mt-1 block text-[20px] font-bold">{valor}</span>
      {detalhe ? (
        <span className="block truncate text-[11.5px] text-muted-foreground">{detalhe}</span>
      ) : null}
    </div>
  );
}
