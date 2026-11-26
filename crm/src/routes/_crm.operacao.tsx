import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { AlertTriangle } from "lucide-react";

import { NegocioPainel } from "@/components/crm/negocio";
import { CabecalhoPagina, Carregando, Erro } from "@/components/crm/ui";
import { getOperacao, type ItemFila, type Operacao } from "@/lib/crm/metricas.functions";
import { fmtDataHora, linkMateria } from "@/lib/crm/utils";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_crm/operacao")({
  component: OperacaoPage,
});

/* Produção: "o que está pago e parado?". A semana no site e a fila em 4 etapas,
   com os pagos sempre no topo de cada etapa. */

const brl = (n: number) => `R$ ${Math.round(n).toLocaleString("pt-BR")}`;

const ETAPAS: { id: string; nome: string; prazo: string; filtro: (f: ItemFila) => boolean }[] = [
  {
    id: "material",
    nome: "Aguardando material",
    prazo: "Cobrar o cliente · pagos em 1 dia",
    filtro: (f) => !f.material,
  },
  {
    id: "producao",
    nome: "Em produção",
    prazo: "Material → prévia em até 2 dias",
    filtro: (f) => f.material && !f.previa,
  },
  {
    id: "previa",
    nome: "Prévia com o cliente",
    prazo: "Aprovação em até 3 dias",
    filtro: (f) => f.previa && !f.aprovado,
  },
  {
    id: "aprovado",
    nome: "Aprovado · agendar",
    prazo: "Entra no calendário",
    filtro: (f) => f.aprovado,
  },
];

function OperacaoPage() {
  const fetchOp = useServerFn(getOperacao);
  const [aberto, setAberto] = useState<string | null>(null);
  const { data, isLoading, error } = useQuery({
    queryKey: ["crm", "operacao"],
    queryFn: () => fetchOp(),
    refetchInterval: 5 * 60_000,
  });
  if (isLoading) return <Carregando texto="Montando a fila de produção..." />;
  if (error || !data) return <Erro erro={error} />;
  const pagos = data.fila.filter((f) => f.pago);

  return (
    <div className="space-y-6">
      <CabecalhoPagina
        titulo="Produção"
        subtitulo={
          pagos.length ? (
            <>
              <b className="!text-[#C2410C]">{brl(data.valorTravado)} pagos parados</b> ·{" "}
              {pagos.length} pagos na fila · pagos sempre no topo
            </>
          ) : (
            <>Nenhum pago parado · {data.fila.length} na fila</>
          )
        }
      />

      <Semana d={data} />

      <div className="-mx-1 overflow-x-auto px-1 pb-2">
        <div className="grid min-w-[1000px] grid-cols-4 gap-4">
          {ETAPAS.map((e) => (
            <Coluna key={e.id} etapa={e} itens={data.fila.filter(e.filtro)} onAbrir={setAberto} />
          ))}
        </div>
      </div>

      <Avisos d={data} />
      <NegocioPainel id={aberto} onClose={() => setAberto(null)} />
    </div>
  );
}

function Semana({ d }: { d: Operacao }) {
  return (
    <section aria-label="Esta semana" className="rounded-2xl border bg-card px-5 py-[18px]">
      <div className="mb-3.5 flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-[15px] font-semibold">Esta semana no site e no Instagram</h2>
        <span className="flex gap-4 text-[12px] text-[#3A4456]">
          <span className="inline-flex items-center gap-1.5">
            <i className="h-2 w-2 rounded-sm bg-[#C9D7FF]" /> Matérias
          </span>
          <span className="inline-flex items-center gap-1.5">
            <i className="h-2 w-2 rounded-sm bg-[#0E8A5F]" /> Com post ligado
          </span>
        </span>
      </div>
      <div className="grid grid-cols-4 gap-2.5 sm:grid-cols-7">
        {d.dias.map((x) => (
          <div
            key={x.dia}
            className={cn(
              "flex flex-col gap-2 rounded-xl p-3",
              x.hoje ? "bg-[#EEF3FF]" : "bg-background",
            )}
          >
            <span
              className={cn(
                "text-[12px] font-semibold",
                x.hoje ? "text-primary" : "text-muted-foreground",
              )}
            >
              {x.rotulo}
              {x.hoje ? " · hoje" : ""}
            </span>
            <span className="font-display tabular text-[22px] font-bold">{x.total}</span>
            <div className="flex h-1.5 gap-[3px]">
              {x.comPost ? (
                <div className="rounded-sm bg-[#0E8A5F]" style={{ flex: x.comPost }} />
              ) : null}
              {x.total - x.comPost ? (
                <div className="rounded-sm bg-[#C9D7FF]" style={{ flex: x.total - x.comPost }} />
              ) : null}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

function Coluna({
  etapa,
  itens,
  onAbrir,
}: {
  etapa: (typeof ETAPAS)[number];
  itens: ItemFila[];
  onAbrir: (id: string) => void;
}) {
  const [todos, setTodos] = useState(false);
  const visiveis = todos ? itens : itens.slice(0, 6);
  const resto = itens.slice(6);
  const restoPagos = resto.filter((i) => i.pago).length;
  return (
    <section className="flex min-w-0 flex-col gap-2.5 rounded-2xl bg-[#ECEEF2] p-3">
      <div className="flex flex-col gap-0.5 px-1 pb-0.5 pt-1">
        <span className="flex items-center gap-2">
          <h2 className="text-[14px] font-semibold">{etapa.nome}</h2>
          <span className="tabular text-[12px] font-semibold text-muted-foreground">
            {itens.length}
          </span>
        </span>
        <span className="text-[12px] text-muted-foreground">{etapa.prazo}</span>
      </div>
      {visiveis.map((j) => (
        <button
          key={j.id}
          type="button"
          onClick={() => onAbrir(j.id)}
          className="flex flex-col gap-2 rounded-xl border bg-card p-3.5 text-left transition hover:border-[#C9D7FF]"
        >
          <span className="flex justify-between gap-2">
            <span className="min-w-0 truncate text-[14px] font-semibold">{j.cliente}</span>
            {j.valor ? (
              <span className="tabular shrink-0 text-[13px] font-bold">{brl(j.valor)}</span>
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
        <div className="rounded-xl border border-dashed border-[#C7CCD6] p-[18px] text-center text-[13px] text-muted-foreground">
          Nada nesta etapa
        </div>
      ) : null}
      {resto.length ? (
        <button
          type="button"
          onClick={() => setTodos((v) => !v)}
          className="h-[34px] rounded-[10px] border border-dashed border-[#C7CCD6] text-[13px] font-medium text-muted-foreground transition hover:bg-white/60"
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
        "rounded-md px-2 py-[3px] text-[11.5px] font-semibold",
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
  const grupos = [
    { titulo: "passaram da data de publicação", lista: d.rascunhosVencidos, nome: "rascunho" },
    { titulo: "das próximas 24h estão sem capa", lista: d.semCapa24h, nome: "matéria" },
  ].filter((g) => g.lista.length);
  if (!grupos.length) return null;
  return (
    <div className="space-y-3">
      {grupos.map((g) => (
        <section
          key={g.titulo}
          className="flex flex-wrap items-start gap-4 rounded-2xl border bg-card px-6 py-5"
        >
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[10px] bg-[#FFF6ED] text-[#C2410C]">
            <AlertTriangle className="h-[18px] w-[18px]" />
          </span>
          <div className="min-w-0 flex-[1_1_320px]">
            <p className="text-[14px] font-semibold">
              {g.lista.length} {g.nome}
              {g.lista.length > 1 ? "s" : ""} {g.titulo}
            </p>
            <ul className="mt-1.5 space-y-1">
              {g.lista.slice(0, 5).map((a) => (
                <li key={a.slug} className="flex gap-3 text-[13px] text-muted-foreground">
                  <span className="w-28 shrink-0">{fmtDataHora(a.published_at)}</span>
                  <a
                    href={linkMateria(a.slug) ?? undefined}
                    target="_blank"
                    rel="noreferrer"
                    className="min-w-0 truncate hover:text-primary"
                  >
                    {a.title}
                  </a>
                </li>
              ))}
            </ul>
          </div>
        </section>
      ))}
    </div>
  );
}
