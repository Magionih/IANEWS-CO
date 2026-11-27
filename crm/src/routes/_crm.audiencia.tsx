import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { ArrowUpRight } from "lucide-react";

import { GraficoCombinado } from "@/components/crm/grafico";
import {
  FiltroPeriodo,
  periodoAnterior,
  preencherDias,
  usePeriodo,
} from "@/components/crm/periodo";
import {
  AoVivo,
  BotaoCsv,
  Cartao,
  Carregando,
  Erro,
  FaixaNumeros,
  FiltroSelect,
  Variacao,
  Vazio,
} from "@/components/crm/ui";
import { getAudiencia, type Audiencia } from "@/lib/crm/indicadores.functions";
import { fmtDataHora, fmtNum, hojeBR, linkMateria } from "@/lib/crm/utils";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_crm/audiencia")({
  component: AudienciaPage,
});

/* Audiência do site: um painel de números com a comparação contra o período anterior,
   visitas x novos assinantes no mesmo gráfico, o extrato da base (entrou, saiu, saldo),
   as matérias que mais trazem leitura, de onde vem o público e os envios da newsletter. */

const pct = (a: number, b: number, casas = 0) =>
  b ? `${((a / b) * 100).toFixed(casas).replace(".", ",")}%` : "—";

const VS = "vs. anterior";

function AudienciaPage() {
  const fetchAud = useServerFn(getAudiencia);
  const [periodo, setPeriodo] = usePeriodo(30);
  const anterior = periodoAnterior(periodo);
  const { data, isLoading, error, isFetching } = useQuery({
    queryKey: ["crm", "audiencia", periodo.inicio, periodo.fim],
    queryFn: () => fetchAud({ data: periodo }),
    placeholderData: keepPreviousData,
  });
  const { data: antes } = useQuery({
    queryKey: ["crm", "audiencia", anterior.inicio, anterior.fim],
    queryFn: () => fetchAud({ data: anterior }),
    placeholderData: keepPreviousData,
  });

  const a = data?.dados;
  const b = antes?.dados;
  const dias = a
    ? preencherDias(
        periodo,
        a.visitas_por_dia.map((v) => ({
          dia: v.dia,
          visitas: v.visitas,
          visitantes: v.visitantes,
        })),
        (dia) => ({ dia, visitas: 0, visitantes: 0 }),
      ).map((v) => {
        const n = a.novos_por_dia.find((x) => x.dia === v.dia);
        return { ...v, novos: n?.novos ?? 0, confirmados: n?.confirmados ?? 0 };
      })
    : [];

  return (
    <div className="space-y-4 sm:space-y-5">
      <header className="flex flex-wrap items-center justify-between gap-x-4 gap-y-3">
        <div className="flex min-w-0 items-center gap-3">
          <h1 className="font-display truncate text-[22px] font-bold leading-tight tracking-[-0.02em] sm:text-[28px]">
            Audiência
          </h1>
          <AoVivo className="hidden sm:inline-flex" />
        </div>
        <div className="flex w-full items-center gap-2 sm:w-auto">
          <div className="min-w-0 flex-1 sm:flex-none">
            <FiltroPeriodo valor={periodo} onChange={setPeriodo} />
          </div>
          {a ? (
            <BotaoCsv
              nome="audiencia-por-dia"
              linhas={dias}
              colunas={[
                { titulo: "Dia", valor: (d) => d.dia },
                { titulo: "Visitas", valor: (d) => d.visitas },
                { titulo: "Visitantes", valor: (d) => d.visitantes },
                { titulo: "Novos assinantes", valor: (d) => d.novos },
                { titulo: "Confirmados", valor: (d) => d.confirmados },
              ]}
            />
          ) : null}
        </div>
      </header>

      {isLoading ? (
        <Carregando texto="Lendo a audiência..." />
      ) : error || !a ? (
        <Erro erro={error} />
      ) : (
        <div
          className={cn("space-y-4 sm:space-y-5", isFetching && "opacity-70 transition-opacity")}
        >
          <Numeros a={a} b={b} />

          <div className="grid gap-4 lg:grid-cols-[3fr_2fr]">
            <Tendencia dias={dias} a={a} />
            <ExtratoBase a={a} fimHoje={periodo.fim === hojeBR()} dias={dias.length} />
          </div>

          <div className="grid gap-4 lg:grid-cols-[3fr_2fr] lg:items-start">
            <MaisLidas a={a} />
            <Origens a={a} />
          </div>

          <Envios a={a} />
        </div>
      )}
    </div>
  );
}

function Numeros({ a, b }: { a: Audiencia; b?: Audiencia }) {
  const conv = a.visitantes ? a.novos_periodo / a.visitantes : null;
  const convAntes = b?.visitantes ? b.novos_periodo / b.visitantes : null;
  const saldo = a.novos_periodo - a.descadastros_periodo;
  const ent = a.entregas_periodo;
  return (
    <FaixaNumeros
      itens={[
        {
          rotulo: "Visitas",
          valor: fmtNum(a.visitas),
          detalhe: b ? (
            <Variacao atual={a.visitas} anterior={b.visitas} rotulo={VS} />
          ) : (
            `${fmtNum(a.visitantes)} visitantes`
          ),
        },
        {
          rotulo: "Novos assinantes",
          valor: fmtNum(a.novos_periodo),
          detalhe: b ? (
            <Variacao atual={a.novos_periodo} anterior={b.novos_periodo} rotulo={VS} />
          ) : (
            `${fmtNum(a.confirmados_periodo)} confirmaram`
          ),
        },
        {
          rotulo: "Conversão do site",
          valor: conv == null ? "—" : pct(a.novos_periodo, a.visitantes, 1),
          detalhe:
            convAntes == null
              ? "visitante que vira assinante"
              : `antes ${(convAntes * 100).toFixed(1).replace(".", ",")}%`,
          tom:
            conv != null && convAntes != null ? (conv >= convAntes ? "ok" : "alerta") : undefined,
        },
        {
          rotulo: "Base ativa",
          valor: fmtNum(a.assinantes_ativos),
          detalhe: `${saldo >= 0 ? "+" : "−"}${fmtNum(Math.abs(saldo))} no período`,
          tom: saldo > 0 ? "ok" : saldo < 0 ? "alerta" : undefined,
        },
        {
          rotulo: "Newsletter entregue",
          valor: fmtNum(ent.entregues),
          detalhe: ent.destinatarios
            ? `${pct(ent.entregues, ent.destinatarios, 1)} de entrega`
            : `${fmtNum(ent.edicoes)} envios`,
          tom:
            ent.falhas && ent.destinatarios && ent.falhas / ent.destinatarios > 0.03
              ? "alerta"
              : undefined,
        },
        {
          rotulo: "Push ativos",
          valor: fmtNum(a.push_ativos),
          detalhe: `+${fmtNum(a.push_novos_periodo)} no período`,
        },
      ]}
    />
  );
}

function Tendencia({
  dias,
  a,
}: {
  dias: { dia: string; visitas: number; visitantes: number; novos: number }[];
  a: Audiencia;
}) {
  const melhor = dias.reduce<(typeof dias)[number] | null>(
    (m, d) => (!m || d.visitas > m.visitas ? d : m),
    null,
  );
  const media = dias.length ? Math.round(a.visitas / dias.length) : 0;
  const melhorNovos = dias.reduce<(typeof dias)[number] | null>(
    (m, d) => (!m || d.novos > m.novos ? d : m),
    null,
  );
  return (
    <Cartao
      titulo="Visitas e novos assinantes"
      sub="Cada barra é um dia; a linha mostra quem assinou."
    >
      <GraficoCombinado
        dados={dias.map((d) => ({ dia: d.dia, barras: d.visitas, linha: d.novos }))}
        barras="Visitas"
        linha="Novos assinantes"
      />
      <dl className="mt-4 grid grid-cols-3 divide-x rounded-lg border text-center">
        <div className="px-2 py-2.5">
          <dt className="text-[11.5px] text-muted-foreground">Média por dia</dt>
          <dd className="tabular text-[15px] font-semibold">{fmtNum(media)}</dd>
        </div>
        <div className="px-2 py-2.5">
          <dt className="text-[11.5px] text-muted-foreground">Melhor dia</dt>
          <dd className="tabular truncate text-[15px] font-semibold">
            {melhor && melhor.visitas
              ? `${melhor.dia.slice(8, 10)}/${melhor.dia.slice(5, 7)}`
              : "—"}
            {melhor && melhor.visitas ? (
              <span className="ml-1 text-[12px] font-normal text-muted-foreground">
                {fmtNum(melhor.visitas)}
              </span>
            ) : null}
          </dd>
        </div>
        <div className="px-2 py-2.5">
          <dt className="text-[11.5px] text-muted-foreground">Mais assinaturas</dt>
          <dd className="tabular truncate text-[15px] font-semibold">
            {melhorNovos && melhorNovos.novos
              ? `${melhorNovos.dia.slice(8, 10)}/${melhorNovos.dia.slice(5, 7)}`
              : "—"}
            {melhorNovos && melhorNovos.novos ? (
              <span className="ml-1 text-[12px] font-normal text-muted-foreground">
                {fmtNum(melhorNovos.novos)}
              </span>
            ) : null}
          </dd>
        </div>
      </dl>
    </Cartao>
  );
}

/** Extrato da base de assinantes (padrão banco): entrou, confirmou, saiu e o saldo. */
function ExtratoBase({ a, fimHoje, dias }: { a: Audiencia; fimHoje: boolean; dias: number }) {
  const saldo = a.novos_periodo - a.descadastros_periodo;
  const inicio = a.assinantes_ativos - saldo;
  const linhas: { nome: string; valor: string; detalhe?: string; tom?: "ok" | "alerta" }[] = [
    ...(fimHoje
      ? [{ nome: "Base no início do período", valor: fmtNum(inicio), detalhe: "estimada" }]
      : []),
    {
      nome: "Entraram",
      valor: `+ ${fmtNum(a.novos_periodo)}`,
      detalhe: `${pct(a.confirmados_periodo, a.novos_periodo)} confirmaram o e-mail`,
      tom: "ok",
    },
    {
      nome: "Saíram",
      valor: `− ${fmtNum(a.descadastros_periodo)}`,
      detalhe: a.novos_periodo
        ? `${pct(a.descadastros_periodo, a.novos_periodo)} do que entrou`
        : undefined,
      tom: a.descadastros_periodo ? "alerta" : undefined,
    },
  ];
  const confirmados = pct(a.assinantes_confirmados, a.assinantes_ativos);
  return (
    <Cartao titulo="Extrato da base" sub="Quem entrou e saiu da newsletter no período" colado>
      <dl className="divide-y border-t">
        {linhas.map((l) => (
          <div key={l.nome} className="flex items-center justify-between gap-4 px-4 py-3 sm:px-5">
            <div className="min-w-0">
              <dt className="text-[13.5px] font-medium">{l.nome}</dt>
              {l.detalhe ? (
                <dd className="truncate text-[12px] text-muted-foreground">{l.detalhe}</dd>
              ) : null}
            </div>
            <dd
              className={cn(
                "font-display tabular shrink-0 text-[16px] font-semibold",
                l.tom === "ok" && "text-[#0E7A55]",
                l.tom === "alerta" && "text-[#B4530A]",
              )}
            >
              {l.valor}
            </dd>
          </div>
        ))}
        <div className="flex items-center justify-between gap-4 bg-[#F7F9FF] px-4 py-3.5 sm:px-5">
          <div className="min-w-0">
            <dt className="text-[13.5px] font-semibold">Base ativa hoje</dt>
            <dd className="truncate text-[12px] text-muted-foreground">
              {confirmados} com e-mail confirmado · {fmtNum(a.push_ativos)} no push
            </dd>
          </div>
          <dd className="font-display tabular shrink-0 text-[20px] font-bold">
            {fmtNum(a.assinantes_ativos)}
          </dd>
        </div>
      </dl>
      <dl className="mt-auto grid grid-cols-2 divide-x border-t text-center">
        <div className="px-3 py-3">
          <dt className="text-[11.5px] text-muted-foreground">Crescimento no período</dt>
          <dd
            className={cn(
              "tabular text-[15px] font-semibold",
              saldo > 0 && "text-[#0E7A55]",
              saldo < 0 && "text-[#B4530A]",
            )}
          >
            {inicio > 0 ? `${saldo >= 0 ? "+" : "−"}${pct(Math.abs(saldo), inicio, 1)}` : "—"}
          </dd>
        </div>
        <div className="px-3 py-3">
          <dt className="text-[11.5px] text-muted-foreground">Ritmo por dia</dt>
          <dd className="tabular text-[15px] font-semibold">
            {dias
              ? `${saldo >= 0 ? "+" : "−"}${(Math.abs(saldo) / dias).toFixed(1).replace(".", ",")}`
              : "—"}
          </dd>
        </div>
      </dl>
    </Cartao>
  );
}

function MaisLidas({ a }: { a: Audiencia }) {
  const lista = a.materias_mais_lidas;
  const leituras = lista.reduce((s, m) => s + m.leituras, 0);
  const completas = lista.reduce((s, m) => s + m.concluidas, 0);
  const segundos = leituras
    ? lista.reduce((s, m) => s + m.segundos_medios * m.leituras, 0) / leituras
    : 0;
  const maior = Math.max(1, ...lista.map((m) => m.visitas));
  return (
    <Cartao
      titulo="Matérias mais lidas"
      sub={
        leituras
          ? `${pct(completas, leituras)} leem até o fim · ${minutos(segundos)} de leitura em média`
          : "Ranking por visitas no período"
      }
      extra={
        lista.length ? (
          <BotaoCsv
            nome="audiencia-materias"
            linhas={lista}
            colunas={[
              { titulo: "Matéria", valor: (m) => m.titulo },
              { titulo: "Link", valor: (m) => linkMateria(m.slug) },
              { titulo: "Visitas", valor: (m) => m.visitas },
              { titulo: "Leituras", valor: (m) => m.leituras },
              { titulo: "Leituras completas", valor: (m) => m.concluidas },
              { titulo: "Segundos médios", valor: (m) => m.segundos_medios },
            ]}
          />
        ) : null
      }
      colado
    >
      {lista.length ? (
        <ol className="divide-y border-t">
          {lista.slice(0, 10).map((m, i) => (
            <li key={m.slug}>
              <a
                href={linkMateria(m.slug)!}
                target="_blank"
                rel="noreferrer"
                className="group flex items-center gap-3 px-4 py-3 transition hover:bg-[#F8FAFF] sm:px-5"
              >
                <span
                  className={cn(
                    "tabular flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-[12px] font-bold",
                    i < 3 ? "bg-[#0F1729] text-white" : "bg-[#F1F3F7] text-[#3A4456]",
                  )}
                >
                  {i + 1}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="line-clamp-2 text-[13.5px] font-semibold leading-snug group-hover:text-primary">
                    {m.titulo}
                  </span>
                  <span className="mt-1.5 flex items-center gap-2">
                    <span className="hidden h-1 max-w-[180px] flex-1 overflow-hidden rounded-full bg-[#EEF1F5] sm:block">
                      <span
                        className="block h-full rounded-full bg-primary"
                        style={{ width: `${(m.visitas / maior) * 100}%` }}
                      />
                    </span>
                    <span className="truncate text-[11.5px] text-muted-foreground">
                      {pct(m.concluidas, m.leituras)} até o fim
                      {m.segundos_medios ? ` · ${minutos(m.segundos_medios)}` : ""}
                    </span>
                  </span>
                </span>
                <span className="shrink-0 text-right">
                  <span className="tabular block text-[14px] font-semibold">
                    {fmtNum(m.visitas)}
                  </span>
                  <span className="block text-[11px] text-muted-foreground">visitas</span>
                </span>
                <ArrowUpRight className="hidden h-4 w-4 shrink-0 text-muted-foreground group-hover:text-primary sm:block" />
              </a>
            </li>
          ))}
        </ol>
      ) : (
        <div className="px-4 pb-4 sm:px-5">
          <Vazio>Sem leituras no período.</Vazio>
        </div>
      )}
    </Cartao>
  );
}

const minutos = (seg: number) =>
  seg < 60 ? `${Math.round(seg)} s` : `${(seg / 60).toFixed(1).replace(".", ",")} min`;

const NOME_ORIGEM: Record<string, string> = {
  direto: "Direto",
  direct: "Direto",
  google: "Google",
  instagram: "Instagram",
  linkedin: "LinkedIn",
  facebook: "Facebook",
  whatsapp: "WhatsApp",
  newsletter: "Newsletter",
  links: "Link da bio",
  popup: "Pop-up do site",
  site: "Site",
};
const nomeOrigem = (o: string) =>
  NOME_ORIGEM[o?.toLowerCase?.() ?? ""] ?? (o ? o.charAt(0).toUpperCase() + o.slice(1) : "Outros");

function Origens({ a }: { a: Audiencia }) {
  const [tipo, setTipo] = useState<"visitas" | "assinantes">("visitas");
  const itens = tipo === "visitas" ? a.origem_visitas : a.origem_assinantes;
  const total = itens.reduce((s, x) => s + x.total, 0);
  const maior = Math.max(1, ...itens.map((x) => x.total));
  return (
    <Cartao
      titulo="De onde vem o público"
      sub={`${fmtNum(total)} ${tipo === "visitas" ? "visitas" : "assinaturas"} no período`}
      extra={
        <FiltroSelect
          valor={tipo}
          onChange={setTipo}
          titulo="Ver origem de"
          opcoes={[
            { valor: "visitas", rotulo: "Visitas" },
            { valor: "assinantes", rotulo: "Assinaturas" },
          ]}
        />
      }
    >
      {itens.length ? (
        <ul className="space-y-3">
          {itens.slice(0, 8).map((o) => (
            <li key={o.origem}>
              <div className="flex items-baseline justify-between gap-3 text-[13.5px]">
                <span className="truncate">{nomeOrigem(o.origem)}</span>
                <span className="tabular shrink-0">
                  <b className="font-semibold">{fmtNum(o.total)}</b>
                  <span className="ml-1.5 text-[12px] text-muted-foreground">
                    {pct(o.total, total)}
                  </span>
                </span>
              </div>
              <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-[#EEF1F5]">
                <div
                  className="h-full rounded-full bg-primary"
                  style={{ width: `${(o.total / maior) * 100}%` }}
                />
              </div>
            </li>
          ))}
        </ul>
      ) : (
        <Vazio>Sem dados de origem no período.</Vazio>
      )}
    </Cartao>
  );
}

function Envios({ a }: { a: Audiencia }) {
  const lista = a.envios;
  return (
    <Cartao
      titulo="Envios da newsletter"
      sub={
        lista.length
          ? `${fmtNum(lista.length)} envios · ${pct(a.entregas_periodo.entregues, a.entregas_periodo.destinatarios, 1)} entregues`
          : undefined
      }
      colado
    >
      {lista.length ? (
        <>
          <ul className="divide-y border-t sm:hidden">
            {lista.map((e) => (
              <li key={e.id} className="flex items-center gap-3 px-4 py-3">
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[13.5px] font-semibold">
                    {e.assunto ?? "Sem assunto"}
                  </span>
                  <span className="block truncate text-[11.5px] text-muted-foreground">
                    {fmtDataHora(e.data)} · {e.tipo === "ranking" ? "ranking" : "diária"}
                    {e.falhas ? ` · ${fmtNum(e.falhas)} falhas` : ""}
                  </span>
                </span>
                <span className="shrink-0 text-right">
                  <span className="tabular block text-[14px] font-semibold">
                    {fmtNum(e.entregues)}
                  </span>
                  <span className="block text-[11px] text-muted-foreground">
                    {pct(e.entregues ?? 0, e.destinatarios ?? 0)}
                  </span>
                </span>
              </li>
            ))}
          </ul>
          <div className="hidden overflow-x-auto border-t sm:block">
            <table className="w-full min-w-[640px] text-[13px]">
              <thead className="bg-[#F7F8FA] text-[11.5px] text-muted-foreground">
                <tr>
                  <th className="px-5 py-2 text-left font-medium">Data</th>
                  <th className="px-2 py-2 text-left font-medium">Assunto</th>
                  <th className="px-2 py-2 text-right font-medium">Destinatários</th>
                  <th className="px-2 py-2 text-right font-medium">Entregues</th>
                  <th className="px-2 py-2 text-right font-medium">Entrega</th>
                  <th className="px-5 py-2 text-right font-medium">Falhas</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {lista.map((e) => (
                  <tr key={e.id} className="hover:bg-[#F8FAFF]">
                    <td className="tabular whitespace-nowrap px-5 py-2.5 text-muted-foreground">
                      {fmtDataHora(e.data)}
                    </td>
                    <td className="max-w-[360px] px-2 py-2.5">
                      <span className="block truncate font-medium">{e.assunto ?? "—"}</span>
                      <span className="text-[11.5px] text-muted-foreground">
                        {e.tipo === "ranking" ? "ranking" : "diária"}
                      </span>
                    </td>
                    <td className="tabular px-2 py-2.5 text-right">{fmtNum(e.destinatarios)}</td>
                    <td className="tabular px-2 py-2.5 text-right font-semibold">
                      {fmtNum(e.entregues)}
                    </td>
                    <td className="tabular px-2 py-2.5 text-right">
                      {pct(e.entregues ?? 0, e.destinatarios ?? 0, 1)}
                    </td>
                    <td
                      className={cn(
                        "tabular px-5 py-2.5 text-right",
                        e.falhas ? "font-semibold text-[#B4530A]" : "text-muted-foreground",
                      )}
                    >
                      {fmtNum(e.falhas)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      ) : (
        <div className="px-4 pb-4 sm:px-5">
          <Vazio>Nenhum envio no período.</Vazio>
        </div>
      )}
    </Cartao>
  );
}
