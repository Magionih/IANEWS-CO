import { useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { AlertTriangle, ChevronRight } from "lucide-react";

import { NegocioPainel } from "@/components/crm/negocio";
import { AoVivo, Cartao, Carregando, Erro, FaixaNumeros, FiltroSelect } from "@/components/crm/ui";
import { getOperacao, type ItemFila, type Operacao } from "@/lib/crm/metricas.functions";
import { fmtDataHora, linkMateria } from "@/lib/crm/utils";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_crm/operacao")({
  component: OperacaoPage,
});

/* Produção: "o que está pago e parado?". A fila anda sozinha pelas etapas conforme o
   status do negócio (etiquetas "Status · ..."), o briefing (material, prévia, aprovação)
   e a matéria no site (agendada → some da fila quando entra no ar). Pagos sempre no topo. */

const brl = (n: number) => `R$ ${Math.round(n).toLocaleString("pt-BR")}`;

type Etapa = {
  id: string;
  nome: string;
  prazo: string;
  fase: ItemFila["fase"];
  cor: string;
};

const ETAPAS: Etapa[] = [
  {
    id: "material",
    nome: "Aguardando material",
    prazo: "Cobrar o cliente · pagos em 1 dia",
    fase: 0,
    cor: "bg-[#B5BCC8]",
  },
  {
    id: "producao",
    nome: "Em produção",
    prazo: "Material → prévia em até 2 dias",
    fase: 1,
    cor: "bg-[#F59E5B]",
  },
  {
    id: "previa",
    nome: "Prévia com o cliente",
    prazo: "Aprovação em até 3 dias",
    fase: 2,
    cor: "bg-[#9DB6FF]",
  },
  {
    id: "aprovado",
    nome: "Aprovado · agendar",
    prazo: "Agendar no site em até 2 dias",
    fase: 3,
    cor: "bg-primary",
  },
  {
    id: "agendada",
    nome: "Agendada",
    prazo: "Sai da fila quando entra no ar",
    fase: 4,
    cor: "bg-[#0E8A5F]",
  },
];

function OperacaoPage() {
  const fetchOp = useServerFn(getOperacao);
  const [aberto, setAberto] = useState<string | null>(null);
  const [etapaCel, setEtapaCel] = useState<string>("");
  const { data, isLoading, error } = useQuery({
    queryKey: ["crm", "operacao"],
    queryFn: () => fetchOp(),
    refetchInterval: 5 * 60_000,
  });
  if (isLoading) return <Carregando texto="Montando a fila de produção..." />;
  if (error || !data) return <Erro erro={error} />;

  const porFase = (f: ItemFila["fase"]) => data.fila.filter((x) => x.fase === f);
  const pagosParados = data.fila.filter((f) => f.pago && f.fase < 4);
  const atrasados = data.fila.filter((f) => f.atrasado);
  // No celular: abre na primeira etapa que tem gente parada (ou na de produção).
  const etapaInicial =
    ETAPAS.find((e) => porFase(e.fase).some((x) => x.pago || x.atrasado))?.id ??
    ETAPAS.find((e) => porFase(e.fase).length)?.id ??
    "producao";
  const etapaAtual = ETAPAS.find((e) => e.id === (etapaCel || etapaInicial)) ?? ETAPAS[1];

  return (
    <div className="space-y-4 sm:space-y-5">
      <header className="min-w-0">
        <div className="flex items-center gap-3">
          <h1 className="font-display truncate text-[22px] font-bold leading-tight tracking-[-0.02em] sm:text-[28px]">
            Produção
          </h1>
          <AoVivo className="hidden sm:inline-flex" />
        </div>
        <p className="mt-0.5 text-[13px] text-muted-foreground sm:text-[14px]">
          A fila anda sozinha pelo status do negócio, pelo briefing e pela matéria no site.
        </p>
      </header>

      <FaixaNumeros
        itens={[
          {
            rotulo: "Pagos parados",
            valor: brl(data.valorTravado),
            detalhe: pagosParados.length
              ? `${pagosParados.length} pago${pagosParados.length > 1 ? "s" : ""} na fila`
              : "nenhum pago parado",
            tom: pagosParados.length ? "alerta" : "ok",
          },
          {
            rotulo: "Na fila",
            valor: String(data.fila.filter((f) => f.fase < 4).length),
            detalhe: atrasados.length ? `${atrasados.length} fora do prazo` : "todos no prazo",
            tom: atrasados.length ? "alerta" : undefined,
          },
          {
            rotulo: "Prévias com o cliente",
            valor: String(porFase(2).length),
            detalhe:
              data.retrabalhoPct == null
                ? "aguardando aprovação"
                : `${Math.round(data.retrabalhoPct * 100)}% pedem ajuste`,
          },
          {
            rotulo: "Agendadas",
            valor: String(porFase(4).length),
            detalhe: `${data.semana.agendadas7} matérias nos próximos 7 dias`,
            tom: "azul",
            link: "/calendario",
          },
          {
            rotulo: "Fechado → no ar",
            valor:
              data.fechadoAtePublicar == null
                ? "—"
                : `${data.fechadoAtePublicar.toFixed(1).replace(".", ",")} dias`,
            detalhe: "tempo médio de entrega",
          },
        ]}
      />

      {/* Celular: uma etapa por vez, escolhida no filtro. */}
      <div className="space-y-3 sm:hidden">
        <FiltroSelect
          valor={etapaAtual.id}
          onChange={setEtapaCel}
          rotulo="Etapa"
          className="w-full"
          opcoes={ETAPAS.map((e) => ({
            valor: e.id,
            rotulo: `${e.nome} · ${porFase(e.fase).length}`,
          }))}
        />
        <Coluna etapa={etapaAtual} itens={porFase(etapaAtual.fase)} onAbrir={setAberto} celular />
      </div>

      {/* Computador: o quadro com as 5 etapas. */}
      <div className="-mx-1 hidden overflow-x-auto px-1 pb-2 sm:block">
        <div className="grid min-w-[1080px] grid-cols-5 gap-3">
          {ETAPAS.map((e) => (
            <Coluna key={e.id} etapa={e} itens={porFase(e.fase)} onAbrir={setAberto} />
          ))}
        </div>
      </div>

      <Semana d={data} />
      <Avisos d={data} />
      <NegocioPainel id={aberto} onClose={() => setAberto(null)} />
    </div>
  );
}

function Semana({ d }: { d: Operacao }) {
  return (
    <Cartao
      titulo="Esta semana no site"
      sub={`${d.semana.publicadas} publicadas nos últimos 7 dias · ${d.semana.agendadas7} agendadas`}
      extra={
        <Link to="/calendario" className="text-[12.5px] font-semibold text-primary hover:underline">
          Calendário
        </Link>
      }
    >
      <ol className="grid grid-cols-7 overflow-hidden rounded-lg border">
        {d.dias.map((x) => (
          <li
            key={x.dia}
            className={cn(
              "min-w-0 border-l px-1 py-2.5 text-center first:border-l-0",
              x.hoje && "bg-[#F5F8FF]",
            )}
          >
            <span
              className={cn(
                "block truncate text-[11px] font-medium sm:text-[11.5px]",
                x.hoje ? "text-primary" : "text-muted-foreground",
              )}
            >
              <span className="sm:hidden">{x.rotulo.split(" ")[0]}</span>
              <span className="hidden sm:inline">{x.rotulo}</span>
            </span>
            <span
              className={cn(
                "font-display tabular mt-0.5 block text-[17px] font-semibold leading-tight",
                !x.total && "text-[#B5BCC8]",
              )}
            >
              {x.total}
            </span>
            <span className="mx-auto mt-1.5 flex h-1 max-w-[44px] gap-[2px]">
              {x.comPost ? (
                <span className="rounded-full bg-[#0E8A5F]" style={{ flex: x.comPost }} />
              ) : null}
              {x.total - x.comPost ? (
                <span className="rounded-full bg-[#C9D7FF]" style={{ flex: x.total - x.comPost }} />
              ) : null}
            </span>
          </li>
        ))}
      </ol>
      <div className="mt-2.5 flex flex-wrap gap-x-4 gap-y-1 text-[12px] text-muted-foreground">
        <span className="inline-flex items-center gap-1.5">
          <i className="h-2 w-2 rounded-full bg-[#0E8A5F]" /> com post ligado
        </span>
        <span className="inline-flex items-center gap-1.5">
          <i className="h-2 w-2 rounded-full bg-[#C9D7FF]" /> só no site
        </span>
      </div>
    </Cartao>
  );
}

function Coluna({
  etapa,
  itens,
  onAbrir,
  celular,
}: {
  etapa: Etapa;
  itens: ItemFila[];
  onAbrir: (id: string) => void;
  celular?: boolean;
}) {
  const [todos, setTodos] = useState(false);
  const limite = celular ? 12 : 6;
  const visiveis = todos ? itens : itens.slice(0, limite);
  const resto = itens.slice(limite);
  const restoPagos = resto.filter((i) => i.pago).length;
  return (
    <section className="flex min-w-0 flex-col gap-2 rounded-xl bg-[#ECEEF2] p-2.5">
      <div className="flex flex-col gap-0.5 px-1 pb-0.5 pt-1">
        <span className="flex items-center gap-2">
          <i className={cn("h-2 w-2 shrink-0 rounded-full", etapa.cor)} />
          <h2 className="truncate text-[13.5px] font-semibold">{etapa.nome}</h2>
          <span className="tabular ml-auto shrink-0 rounded-full bg-white px-1.5 py-px text-[11.5px] font-semibold text-muted-foreground">
            {itens.length}
          </span>
        </span>
        <span className="truncate text-[11.5px] text-muted-foreground">{etapa.prazo}</span>
      </div>
      {visiveis.map((j) => (
        <button
          key={j.id}
          type="button"
          onClick={() => onAbrir(j.id)}
          className={cn(
            "flex flex-col gap-2 rounded-lg border bg-card p-3 text-left transition hover:border-[#C9D7FF]",
            j.atrasado && "border-[#F7C9A6]",
          )}
        >
          <span className="flex items-start justify-between gap-2">
            <span className="min-w-0 truncate text-[13.5px] font-semibold">{j.cliente}</span>
            {j.valor ? (
              <span className="tabular shrink-0 text-[12.5px] font-bold">{brl(j.valor)}</span>
            ) : null}
          </span>
          <span className="flex flex-wrap gap-1.5">
            <Selo tom={j.pago ? "pago" : "neutro"}>
              {j.pago ? "Pago" : j.cortesia ? "Cortesia" : "A receber"}
            </Selo>
            <Selo tom={j.atrasado ? "atraso" : "neutro"}>
              {j.dias === 0 ? "hoje" : `há ${j.dias} dia${j.dias === 1 ? "" : "s"}`}
            </Selo>
            {j.ajuste ? <Selo tom="atraso">ajuste pedido</Selo> : null}
          </span>
        </button>
      ))}
      {!itens.length ? (
        <div className="rounded-lg border border-dashed border-[#C7CCD6] p-4 text-center text-[12.5px] text-muted-foreground">
          Nada nesta etapa
        </div>
      ) : null}
      {resto.length ? (
        <button
          type="button"
          onClick={() => setTodos((v) => !v)}
          className="h-9 rounded-lg border border-dashed border-[#C7CCD6] text-[12.5px] font-medium text-muted-foreground transition hover:bg-white/60"
        >
          {todos
            ? "Mostrar menos"
            : `+ ${resto.length}${restoPagos ? ` (${restoPagos} pago${restoPagos > 1 ? "s" : ""})` : ""}`}
        </button>
      ) : null}
    </section>
  );
}

function Selo({ tom, children }: { tom: "pago" | "atraso" | "neutro"; children: React.ReactNode }) {
  return (
    <span
      className={cn(
        "rounded-md px-1.5 py-[2px] text-[11px] font-semibold",
        tom === "pago" && "bg-[#E7F6EF] text-[#0B6B49]",
        tom === "atraso" && "bg-[#FFF1E6] text-[#A3400A]",
        tom === "neutro" && "bg-[#F1F3F7] text-[#3A4456]",
      )}
    >
      {children}
    </span>
  );
}

function Avisos({ d }: { d: Operacao }) {
  const r = d.rascunhosVencidos.length;
  const c = d.semCapa24h.length;
  const grupos = [
    {
      chave: "rascunhos",
      texto:
        r === 1
          ? "1 rascunho passou da data de publicação"
          : `${r} rascunhos passaram da data de publicação`,
      lista: d.rascunhosVencidos,
    },
    {
      chave: "capa",
      texto:
        c === 1
          ? "1 matéria das próximas 24h está sem capa"
          : `${c} matérias das próximas 24h estão sem capa`,
      lista: d.semCapa24h,
    },
  ].filter((g) => g.lista.length);
  if (!grupos.length) return null;
  return (
    <div className="space-y-3">
      {grupos.map((g) => (
        <section key={g.chave} className="rounded-xl border border-[#F7D9C2] bg-card">
          <header className="flex items-center gap-3 px-4 pt-3.5 sm:px-5">
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[#FFF6ED] text-[#C2410C]">
              <AlertTriangle className="h-4 w-4" />
            </span>
            <p className="text-[13.5px] font-semibold">{g.texto}</p>
          </header>
          <ul className="mt-2 divide-y border-t">
            {g.lista.slice(0, 5).map((a) => (
              <li key={a.slug}>
                <a
                  href={linkMateria(a.slug) ?? undefined}
                  target="_blank"
                  rel="noreferrer"
                  className="group flex items-center gap-3 px-4 py-2.5 text-[13px] transition hover:bg-[#F8FAFF] sm:px-5"
                >
                  <span className="tabular w-[104px] shrink-0 text-muted-foreground">
                    {fmtDataHora(a.published_at)}
                  </span>
                  <span className="min-w-0 flex-1 truncate group-hover:text-primary">
                    {a.title}
                  </span>
                  <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
                </a>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}
