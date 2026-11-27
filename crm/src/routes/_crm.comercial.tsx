import { useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { CalendarRange, KanbanSquare } from "lucide-react";

import { useCrm } from "@/components/crm/context";
import { NegocioPainel } from "@/components/crm/negocio";
import {
  CabecalhoPagina,
  Carregando,
  Erro,
  FaixaNumeros,
  FiltroSelect,
  Secao,
  Vazio,
} from "@/components/crm/ui";
import { Button } from "@/components/ui/button";
import { getComercial, type Comercial } from "@/lib/crm/metricas.functions";
import { CANAIS, fmtMoeda, fmtNum, fmtPct, labelDe, ORIGENS, PRODUTOS } from "@/lib/crm/utils";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_crm/comercial")({
  component: ComercialPage,
});

/* Camada 2 · Comercial: funil em 6 etapas (abordado → pago), conversão por canal, origem e
   abordagem, pipeline bruto e ponderado, ticket, ciclo, parados, perdas, produtos e equipe. */

const FUNIS_FORA = ["ativacao", "nutricao", "lista100"];
const CANAL_LABEL = [{ value: "instagram", label: "Instagram" }, ...CANAIS];

function ComercialPage() {
  const { funis } = useCrm();
  const fetchCom = useServerFn(getComercial);
  const [dias, setDias] = useState<"7" | "30" | "90" | "365">("30");
  const [funil, setFunil] = useState("todos");
  const [aberto, setAberto] = useState<string | null>(null);
  const { data, isLoading, error, isFetching } = useQuery({
    queryKey: ["crm", "comercial", dias, funil],
    queryFn: () => fetchCom({ data: { dias: Number(dias), funil } }),
    placeholderData: keepPreviousData,
  });

  if (isLoading) return <Carregando texto="Calculando o funil..." />;
  if (error || !data) return <Erro erro={error} />;
  const totalCanal = data.pagosQtd + data.cortesiasQtd;

  return (
    <div className={cn("space-y-5", isFetching && "opacity-80")}>
      <CabecalhoPagina
        titulo="Comercial"
        descricao="Funil de 6 etapas dos negócios criados no período. Pipeline e parados olham o que está aberto hoje."
        acoes={
          <Button asChild variant="outline" size="sm" className="h-9">
            <Link to="/negocios">
              <KanbanSquare className="h-4 w-4" />{" "}
              <span className="hidden sm:inline">Quadro de negócios</span>
            </Link>
          </Button>
        }
      />
      <div className="flex flex-wrap items-center gap-2">
        <FiltroSelect
          valor={dias}
          onChange={setDias}
          icone={CalendarRange}
          titulo="Período"
          opcoes={[
            { valor: "7", rotulo: "Últimos 7 dias" },
            { valor: "30", rotulo: "Últimos 30 dias" },
            { valor: "90", rotulo: "Últimos 90 dias" },
            { valor: "365", rotulo: "Últimos 12 meses" },
          ]}
        />
        <FiltroSelect
          valor={funil}
          onChange={setFunil}
          rotulo="Funil"
          opcoes={[
            { valor: "todos", rotulo: "Todos de venda" },
            ...funis
              .filter((f) => f.ativo && !FUNIS_FORA.includes(f.id))
              .map((f) => ({ valor: f.id, rotulo: f.nome })),
          ]}
        />
      </div>

      <FaixaNumeros
        itens={[
          {
            rotulo: "Pipeline ponderado",
            valor: fmtMoeda(data.pipeline.ponderado),
            detalhe: "valor × chance",
            tom: "azul",
          },
          {
            rotulo: "Pipeline bruto",
            valor: fmtMoeda(data.pipeline.bruto),
            detalhe: `${data.pipeline.qtd} negócios abertos`,
          },
          {
            rotulo: "Ticket médio",
            valor: fmtMoeda(data.ticketMedio),
            detalhe: `${data.pagosQtd} pagos no período`,
          },
          {
            rotulo: "Ciclo de venda",
            valor: data.cicloDias == null ? "—" : `${Math.round(data.cicloDias)} dias`,
            detalhe:
              data.respostaAteFechar == null
                ? "criado → pago"
                : `resposta → pago: ${Math.round(data.respostaAteFechar)} dias`,
          },
          {
            rotulo: "Pago × cortesia",
            valor: `${data.pagosQtd} × ${data.cortesiasQtd}`,
            detalhe: totalCanal ? `${fmtPct(data.pagosQtd / totalCanal)} pagos` : "no período",
          },
          {
            rotulo: "Parados 3+ dias",
            valor: fmtNum(data.parados.length),
            detalhe: "precisam de follow-up",
            tom: data.parados.length ? "alerta" : undefined,
          },
        ]}
      />

      <Funil etapas={data.etapas} />

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <Conversoes d={data} />
        <Secao titulo="Pipeline por etapa" colado>
          {data.pipeline.porEtapa.length ? (
            <table className="w-full text-[13px]">
              <thead className="text-[11.5px] text-muted-foreground">
                <tr className="border-b">
                  <th className="px-4 py-2 text-left font-medium">Etapa</th>
                  <th className="px-2 py-2 text-right font-medium">Negócios</th>
                  <th className="px-2 py-2 text-right font-medium">Bruto</th>
                  <th className="px-4 py-2 text-right font-medium">Ponderado</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {data.pipeline.porEtapa.map((e) => (
                  <tr key={e.etapa}>
                    <td className="px-4 py-2 font-medium">{e.etapa}</td>
                    <td className="tabular px-2 py-2 text-right">{fmtNum(e.qtd)}</td>
                    <td className="tabular px-2 py-2 text-right">{fmtMoeda(e.valor)}</td>
                    <td className="tabular px-4 py-2 text-right font-semibold">
                      {fmtMoeda(e.ponderado)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <div className="p-4">
              <Vazio>Nenhum negócio em negociação.</Vazio>
            </div>
          )}
        </Secao>
      </div>

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <Parados lista={data.parados} onAbrir={setAberto} />
        <div className="space-y-5">
          <Secao
            titulo="Vendas por produto"
            colado
            acoes={
              data.semProduto ? (
                <span className="text-xs text-destructive">
                  {data.semProduto} pagos sem produto
                </span>
              ) : undefined
            }
          >
            <Lista
              linhas={data.produtos.map((p) => ({
                k: labelDe(PRODUTOS, p.produto) || p.produto,
                a: `${p.qtd}`,
                b: fmtMoeda(p.receita),
              }))}
              vazio="Nenhuma venda paga no período."
            />
          </Secao>
          <Secao titulo="Perdas e motivos" colado>
            <Lista
              linhas={data.perdas.slice(0, 8).map((p) => ({
                k: p.motivo,
                a: `${p.qtd}`,
                b: fmtMoeda(p.valor),
              }))}
              vazio="Nenhuma perda no período."
            />
          </Secao>
        </div>
      </div>

      <Equipe d={data} />
      <NegocioPainel id={aberto} onClose={() => setAberto(null)} />
    </div>
  );
}

function Funil({ etapas }: { etapas: Comercial["etapas"] }) {
  const max = Math.max(1, etapas[0]?.qtd ?? 1);
  return (
    <Secao
      titulo="Funil do período"
      acoes={
        <span className="text-xs text-muted-foreground">
          conversão de uma etapa para a seguinte
        </span>
      }
    >
      <ol className="grid gap-2 sm:grid-cols-3 xl:grid-cols-6">
        {etapas.map((e, i) => (
          <li key={e.rotulo} className="rounded-lg border bg-muted/30 p-3">
            <p className="text-[11.5px] font-semibold uppercase tracking-wide text-muted-foreground">
              {i + 1}. {e.rotulo}
            </p>
            <p className="tabular mt-1 text-[22px] font-semibold leading-none">{fmtNum(e.qtd)}</p>
            <span className="mt-2 block h-1.5 overflow-hidden rounded-full bg-muted">
              <span
                className="block h-full rounded-full bg-primary"
                style={{ width: `${(e.qtd / max) * 100}%` }}
              />
            </span>
            <p className="mt-1.5 text-[11.5px] text-muted-foreground">
              {e.conversao == null
                ? "base do funil"
                : `${fmtPct(e.conversao, 1)} da etapa anterior`}
            </p>
          </li>
        ))}
      </ol>
    </Secao>
  );
}

function Conversoes({ d }: { d: Comercial }) {
  const [por, setPor] = useState<"canal" | "origem" | "abordagem">("canal");
  const grupos = por === "canal" ? d.porCanal : por === "origem" ? d.porOrigem : d.porAbordagem;
  const nome = (k: string) =>
    por === "canal"
      ? labelDe(CANAL_LABEL, k) || k
      : por === "origem"
        ? labelDe(ORIGENS, k) || k
        : k;
  return (
    <Secao
      titulo="Conversão"
      colado
      acoes={
        <FiltroSelect
          valor={por}
          onChange={setPor}
          rotulo="Por"
          opcoes={[
            { valor: "canal", rotulo: "Canal" },
            { valor: "origem", rotulo: "Origem" },
            { valor: "abordagem", rotulo: "Abordagem / teste" },
          ]}
        />
      }
    >
      {grupos.length ? (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[520px] text-[13px]">
            <thead className="text-[11.5px] text-muted-foreground">
              <tr className="border-b">
                <th className="px-4 py-2 text-left font-medium">
                  {por === "canal" ? "Canal" : por === "origem" ? "Origem" : "Abordagem"}
                </th>
                <th className="px-2 py-2 text-right font-medium">Abordados</th>
                <th className="px-2 py-2 text-right font-medium">Resposta</th>
                <th className="px-2 py-2 text-right font-medium">Proposta</th>
                <th className="px-2 py-2 text-right font-medium">Pagos</th>
                <th className="px-4 py-2 text-right font-medium">Receita</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {grupos.slice(0, 12).map((g) => (
                <tr key={g.chave}>
                  <td className="max-w-[160px] truncate px-4 py-2 font-medium">{nome(g.chave)}</td>
                  <td className="tabular px-2 py-2 text-right">{fmtNum(g.abordados)}</td>
                  <td className="tabular px-2 py-2 text-right">
                    {fmtPct(g.abordados ? g.responderam / g.abordados : null)}
                  </td>
                  <td className="tabular px-2 py-2 text-right">{fmtNum(g.propostas)}</td>
                  <td className="tabular px-2 py-2 text-right">
                    {fmtNum(g.pagos)}{" "}
                    <span className="text-[11px] text-muted-foreground">
                      {g.abordados ? fmtPct(g.pagos / g.abordados, 1) : ""}
                    </span>
                  </td>
                  <td className="tabular px-4 py-2 text-right font-semibold">
                    {fmtMoeda(g.receita)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="p-4">
          <Vazio>
            {por === "abordagem"
              ? "Marque a abordagem / teste nos negócios para comparar."
              : "Sem negócios abordados no período."}
          </Vazio>
        </div>
      )}
    </Secao>
  );
}

function Parados({
  lista,
  onAbrir,
}: {
  lista: Comercial["parados"];
  onAbrir: (id: string) => void;
}) {
  const { membro } = useCrm();
  const [todos, setTodos] = useState(false);
  const visiveis = todos ? lista : lista.slice(0, 12);
  return (
    <Secao titulo="Parados há 3 dias ou mais (follow-up)" contagem={lista.length} colado>
      {lista.length ? (
        <ul className="divide-y">
          {visiveis.map((p) => (
            <li key={p.id}>
              <button
                type="button"
                onClick={() => onAbrir(p.id)}
                className="flex w-full items-center gap-3 px-4 py-2.5 text-left hover:bg-[#f8faff] sm:px-5"
              >
                <span
                  className={cn(
                    "h-2 w-2 shrink-0 rounded-full",
                    p.dias > 14 ? "bg-destructive" : p.dias > 7 ? "bg-amber-500" : "bg-primary/50",
                  )}
                />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[13.5px] font-semibold">{p.cliente}</span>
                  <span className="block truncate text-[11.5px] text-muted-foreground">
                    {p.etapa} há {p.dias} dias · {membro(p.dono_id)}
                  </span>
                </span>
                <span className="tabular text-[13px] font-semibold">
                  {p.valor ? fmtMoeda(p.valor) : "—"}
                </span>
              </button>
            </li>
          ))}
          {lista.length > 12 ? (
            <li>
              <button
                type="button"
                onClick={() => setTodos((v) => !v)}
                className="w-full px-4 py-2 text-center text-xs font-semibold text-primary hover:bg-[#f8faff]"
              >
                {todos ? "Mostrar menos" : `Ver todos (${lista.length})`}
              </button>
            </li>
          ) : null}
        </ul>
      ) : (
        <div className="p-4">
          <Vazio>Nenhum negócio parado.</Vazio>
        </div>
      )}
    </Secao>
  );
}

function Lista({
  linhas,
  vazio,
}: {
  linhas: { k: string; a: string; b: string }[];
  vazio: string;
}) {
  if (!linhas.length)
    return (
      <div className="p-4">
        <Vazio>{vazio}</Vazio>
      </div>
    );
  return (
    <ul className="divide-y">
      {linhas.map((l) => (
        <li key={l.k} className="flex items-center gap-3 px-4 py-2 text-[13px] sm:px-5">
          <span className="min-w-0 flex-1 truncate font-medium" title={l.k}>
            {l.k}
          </span>
          <span className="tabular w-10 text-right text-muted-foreground">{l.a}</span>
          <span className="tabular w-24 text-right font-semibold">{l.b}</span>
        </li>
      ))}
    </ul>
  );
}

function Equipe({ d }: { d: Comercial }) {
  const { membro } = useCrm();
  return (
    <Secao titulo={`Atividade da equipe · ${d.dias} dias`} colado>
      {d.equipe.length ? (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[520px] text-[13px]">
            <thead className="text-[11.5px] text-muted-foreground">
              <tr className="border-b">
                <th className="px-4 py-2 text-left font-medium">Pessoa</th>
                <th className="px-2 py-2 text-right font-medium">Mensagens enviadas</th>
                <th className="px-2 py-2 text-right font-medium">Respostas registradas</th>
                <th className="px-2 py-2 text-right font-medium">Propostas</th>
                <th className="px-2 py-2 text-right font-medium">Etapas movidas</th>
                <th className="px-4 py-2 text-right font-medium">Outras</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {d.equipe.map((e) => (
                <tr key={e.autor_id ?? "x"}>
                  <td className="px-4 py-2 font-medium">{membro(e.autor_id)}</td>
                  <td className="tabular px-2 py-2 text-right font-semibold">
                    {fmtNum(e.enviadas)}
                  </td>
                  <td className="tabular px-2 py-2 text-right">{fmtNum(e.recebidas)}</td>
                  <td className="tabular px-2 py-2 text-right">{fmtNum(e.propostas)}</td>
                  <td className="tabular px-2 py-2 text-right">{fmtNum(e.etapas)}</td>
                  <td className="tabular px-4 py-2 text-right">{fmtNum(e.outras)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="p-4">
          <Vazio>Nenhuma atividade registrada no período.</Vazio>
        </div>
      )}
    </Secao>
  );
}
