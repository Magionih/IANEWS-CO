import { useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { CalendarDays, ChevronLeft, ChevronRight, ExternalLink, List } from "lucide-react";

import {
  Alternador,
  CabecalhoPagina,
  Carregando,
  Erro,
  Etiqueta,
  Secao,
  Vazio,
} from "@/components/crm/ui";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import { getCalendario, type ConteudoAgenda } from "@/lib/crm/inicio.functions";
import { hojeBR, linkMateria } from "@/lib/crm/utils";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_crm/calendario")({
  component: CalendarioPage,
});

/* Calendário de conteúdo: tudo que sai no site (e o post correspondente), por dia.
   Toque num dia para ver os horários e os links. */

const TZ = "America/Sao_Paulo";
const diaDe = (iso: string) =>
  new Intl.DateTimeFormat("en-CA", {
    timeZone: TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date(iso));
const HORA = new Intl.DateTimeFormat("pt-BR", { hour: "2-digit", minute: "2-digit", timeZone: TZ });
const MES_NOME = new Intl.DateTimeFormat("pt-BR", {
  month: "long",
  year: "numeric",
  timeZone: "UTC",
});
const DIA_LONGO = new Intl.DateTimeFormat("pt-BR", {
  weekday: "long",
  day: "numeric",
  month: "long",
  timeZone: "UTC",
});
const maiuscula = (t: string) => t.charAt(0).toUpperCase() + t.slice(1);
const SEMANA = ["Seg", "Ter", "Qua", "Qui", "Sex", "Sáb", "Dom"];

function somarMes(mes: string, n: number) {
  const [a, m] = mes.split("-").map(Number);
  const d = new Date(Date.UTC(a, m - 1 + n, 1));
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}

/** Dias da grade (semanas de segunda a domingo cobrindo o mês). */
function gradeDoMes(mes: string): string[] {
  const [a, m] = mes.split("-").map(Number);
  const primeiro = new Date(Date.UTC(a, m - 1, 1));
  const desloc = (primeiro.getUTCDay() + 6) % 7; // segunda = 0
  const inicio = new Date(primeiro.getTime() - desloc * 86_400_000);
  const ultimo = new Date(Date.UTC(a, m, 0));
  const total = Math.ceil((desloc + ultimo.getUTCDate()) / 7) * 7;
  return Array.from({ length: total }, (_, i) =>
    new Date(inicio.getTime() + i * 86_400_000).toISOString().slice(0, 10),
  );
}

function situacao(c: ConteudoAgenda): "agendado" | "publicado" | "rascunho" {
  if (c.status === "draft") return "rascunho";
  return new Date(c.published_at).getTime() > Date.now() ? "agendado" : "publicado";
}

function CalendarioPage() {
  const fetchCal = useServerFn(getCalendario);
  const hoje = hojeBR();
  const [mes, setMes] = useState(hoje.slice(0, 7));
  const [modo, setModo] = useState<"mes" | "lista">("mes");
  const [dia, setDia] = useState<string | null>(null);

  const { data, isLoading, error, isFetching } = useQuery({
    queryKey: ["crm", "calendario", mes],
    queryFn: () => fetchCal({ data: { mes } }),
    placeholderData: keepPreviousData,
  });

  const porDia = useMemo(() => {
    const m = new Map<string, ConteudoAgenda[]>();
    for (const c of data ?? []) {
      const d = diaDe(c.published_at);
      m.set(d, [...(m.get(d) ?? []), c]);
    }
    return m;
  }, [data]);

  const doMes = (data ?? []).filter((c) => diaDe(c.published_at).startsWith(mes));
  const agendados = doMes.filter((c) => situacao(c) === "agendado").length;
  const publicados = doMes.filter((c) => situacao(c) === "publicado").length;
  const [ano, m] = mes.split("-").map(Number);
  const tituloMes = maiuscula(MES_NOME.format(new Date(Date.UTC(ano, m - 1, 1))));

  if (isLoading) return <Carregando texto="Montando o calendário..." />;
  if (error) return <Erro erro={error} />;

  const doDia = dia ? (porDia.get(dia) ?? []) : [];

  return (
    <div className="space-y-5">
      <CabecalhoPagina
        titulo="Calendário de conteúdo"
        descricao="O que já saiu e o que está agendado no site (cada post do Instagram tem a sua matéria). Toque num dia para ver os horários."
        acoes={
          <Alternador
            valor={modo}
            onChange={setModo}
            opcoes={[
              { valor: "mes", rotulo: "Mês", icone: CalendarDays },
              { valor: "lista", rotulo: "Lista", icone: List },
            ]}
          />
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
              "min-w-[170px] text-center text-lg font-semibold",
              isFetching && "opacity-60",
            )}
          >
            {tituloMes}
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
          {mes !== hoje.slice(0, 7) ? (
            <Button variant="ghost" size="sm" onClick={() => setMes(hoje.slice(0, 7))}>
              Hoje
            </Button>
          ) : null}
        </div>
        <div className="flex items-center gap-3 text-xs text-muted-foreground">
          <span className="flex items-center gap-1.5">
            <i className="h-2.5 w-2.5 rounded-full bg-primary" /> {agendados} agendados
          </span>
          <span className="flex items-center gap-1.5">
            <i className="h-2.5 w-2.5 rounded-full bg-emerald-500" /> {publicados} publicados
          </span>
        </div>
      </div>

      {modo === "mes" ? (
        <section className="overflow-hidden rounded-xl border bg-card shadow-[var(--shadow-card)]">
          <div className="grid grid-cols-7 border-b bg-muted/40 text-center text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
            {SEMANA.map((s) => (
              <div key={s} className="py-2">
                {s}
              </div>
            ))}
          </div>
          <div className="grid grid-cols-7">
            {gradeDoMes(mes).map((d) => {
              const itens = porDia.get(d) ?? [];
              const fora = !d.startsWith(mes);
              const ehHoje = d === hoje;
              const ag = itens.filter((c) => situacao(c) === "agendado").length;
              const pub = itens.filter((c) => situacao(c) === "publicado").length;
              return (
                <button
                  key={d}
                  type="button"
                  onClick={() => itens.length && setDia(d)}
                  className={cn(
                    "flex min-h-[74px] flex-col items-stretch gap-1 border-b border-r p-1.5 text-left transition sm:min-h-[108px] sm:p-2 [&:nth-child(7n)]:border-r-0",
                    fora && "bg-muted/30 text-muted-foreground/60",
                    itens.length ? "cursor-pointer hover:bg-primary/[0.04]" : "cursor-default",
                  )}
                >
                  <span
                    className={cn(
                      "tabular flex h-6 w-6 items-center justify-center self-start rounded-full text-[12px] font-semibold",
                      ehHoje && "bg-primary text-primary-foreground",
                    )}
                  >
                    {Number(d.slice(8, 10))}
                  </span>
                  {itens.length ? (
                    <>
                      <span className="flex flex-col gap-1">
                        {ag ? (
                          <span className="rounded-md bg-primary/10 px-1.5 py-0.5 text-[11px] font-semibold text-primary">
                            {ag}
                            <span className="hidden sm:inline"> agendado{ag > 1 ? "s" : ""}</span>
                          </span>
                        ) : null}
                        {pub ? (
                          <span className="rounded-md bg-emerald-50 px-1.5 py-0.5 text-[11px] font-semibold text-emerald-700">
                            {pub}
                            <span className="hidden sm:inline"> publicado{pub > 1 ? "s" : ""}</span>
                          </span>
                        ) : null}
                      </span>
                    </>
                  ) : null}
                </button>
              );
            })}
          </div>
        </section>
      ) : (
        <Secao titulo="Conteúdos do mês" contagem={doMes.length} colado>
          {doMes.length ? (
            <ul className="divide-y">
              {[...new Set(doMes.map((c) => diaDe(c.published_at)))].map((d) => (
                <li key={d} className="px-4 py-3 sm:px-5">
                  <p
                    className={cn("mb-1.5 text-[13px] font-semibold", d === hoje && "text-primary")}
                  >
                    {maiuscula(DIA_LONGO.format(new Date(`${d}T12:00:00Z`)))}
                  </p>
                  <ItensDoDia itens={porDia.get(d) ?? []} />
                </li>
              ))}
            </ul>
          ) : (
            <div className="p-5">
              <Vazio>Nada publicado ou agendado neste mês.</Vazio>
            </div>
          )}
        </Secao>
      )}

      <Sheet open={!!dia} onOpenChange={(v) => !v && setDia(null)}>
        <SheetContent className="flex w-full flex-col gap-0 p-0 sm:max-w-[480px]">
          <div className="border-b px-5 py-4 pr-12">
            <SheetTitle className="text-base">
              {dia ? maiuscula(DIA_LONGO.format(new Date(`${dia}T12:00:00Z`))) : ""}
            </SheetTitle>
            <p className="text-xs text-muted-foreground">{doDia.length} conteúdo(s)</p>
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto px-5 py-3">
            <ItensDoDia itens={doDia} />
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}

function ItensDoDia({ itens }: { itens: ConteudoAgenda[] }) {
  return (
    <ul className="space-y-2">
      {itens.map((c) => {
        const s = situacao(c);
        return (
          <li key={c.id} className="flex items-start gap-3">
            <span className="tabular w-12 shrink-0 pt-0.5 text-[12px] font-semibold text-muted-foreground">
              {HORA.format(new Date(c.published_at))}
            </span>
            <span className="min-w-0 flex-1">
              <a
                href={linkMateria(c.slug) ?? undefined}
                target="_blank"
                rel="noreferrer"
                className="line-clamp-2 text-[13px] font-medium leading-snug hover:text-primary"
              >
                {c.title}
              </a>
              <span className="mt-1 flex flex-wrap items-center gap-1.5">
                <Etiqueta tom={s === "agendado" ? "azul" : s === "publicado" ? "ok" : "neutro"}>
                  {s}
                </Etiqueta>
                {c.social_url ? (
                  <a
                    href={c.social_url}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1 text-[11px] font-semibold text-primary hover:underline"
                  >
                    post <ExternalLink className="h-3 w-3" />
                  </a>
                ) : null}
              </span>
            </span>
          </li>
        );
      })}
    </ul>
  );
}
