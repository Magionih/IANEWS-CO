import { useEffect, useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Clock,
  ExternalLink,
  Image as ImageIcon,
  X,
} from "lucide-react";

import {
  AoVivo,
  Cartao,
  Carregando,
  Erro,
  Etiqueta,
  FiltroSelect,
  Vazio,
} from "@/components/crm/ui";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetDescription, SheetTitle } from "@/components/ui/sheet";
import { useIsMobile } from "@/hooks/use-mobile";
import { getCalendario, type ConteudoAgenda } from "@/lib/crm/inicio.functions";
import { hojeBR, linkMateria, somarDias, urlSegura } from "@/lib/crm/utils";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_crm/calendario")({
  component: CalendarioPage,
});

/* Calendário de conteúdo: tudo que sai no site (e o post correspondente), por dia.
   No computador a grade mostra o horário e o título; no celular, pontos por dia.
   Ao tocar num dia, abre a agenda do dia (com capa, horário, situação e links)
   e dá para passar para o dia anterior ou o próximo. */

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

const CATEGORIA: Record<string, string> = {
  bigtech: "Big Tech",
  brasil: "Brasil",
  regulacao: "Regulação",
  mercado: "Mercado",
  startup: "Startups",
  pesquisa: "Pesquisa",
  ferramentas: "Ferramentas",
  generativa: "IA generativa",
  global: "Global",
};

type Situacao = "agendado" | "publicado" | "rascunho";

const COR: Record<Situacao, { ponto: string; barra: string; tom: "azul" | "ok" | "neutro" }> = {
  agendado: { ponto: "bg-primary", barra: "border-primary bg-[#EEF3FF]", tom: "azul" },
  publicado: { ponto: "bg-emerald-500", barra: "border-emerald-500 bg-emerald-50", tom: "ok" },
  rascunho: { ponto: "bg-[#B5BCC8]", barra: "border-[#B5BCC8] bg-[#F3F4F7]", tom: "neutro" },
};

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

function situacao(c: ConteudoAgenda): Situacao {
  if (c.status === "draft") return "rascunho";
  return new Date(c.published_at).getTime() > Date.now() ? "agendado" : "publicado";
}

const diaLongo = (d: string) => maiuscula(DIA_LONGO.format(new Date(`${d}T12:00:00Z`)));

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
  const conta = { agendado: 0, publicado: 0, rascunho: 0 } as Record<Situacao, number>;
  for (const c of doMes) conta[situacao(c)] += 1;
  const [ano, m] = mes.split("-").map(Number);
  const tituloMes = maiuscula(MES_NOME.format(new Date(Date.UTC(ano, m - 1, 1))));

  // Ao andar de dia no painel e trocar de mês, a grade acompanha.
  useEffect(() => {
    if (dia && !dia.startsWith(mes)) setMes(dia.slice(0, 7));
  }, [dia, mes]);

  if (isLoading) return <Carregando texto="Montando o calendário..." />;
  if (error) return <Erro erro={error} />;

  return (
    <div className="space-y-4 sm:space-y-5">
      <header className="flex items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <h1 className="font-display truncate text-[22px] font-bold leading-tight tracking-[-0.02em] sm:text-[28px]">
            Calendário
          </h1>
          <AoVivo className="hidden sm:inline-flex" />
        </div>
        <FiltroSelect
          valor={modo}
          onChange={setModo}
          icone={CalendarDays}
          titulo="Visualização"
          opcoes={[
            { valor: "mes", rotulo: "Mês" },
            { valor: "lista", rotulo: "Lista" },
          ]}
        />
      </header>

      <div className="flex flex-col gap-2.5 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-2">
          <div
            className={cn(
              "flex h-10 flex-1 items-center justify-between rounded-[10px] border border-input bg-card sm:h-9 sm:flex-none",
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
            <span className="min-w-[150px] px-1.5 text-center text-[14px] font-semibold sm:text-[13.5px]">
              {tituloMes}
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
          <Button
            variant="outline"
            className="h-10 px-3 sm:h-9"
            onClick={() => {
              setMes(hoje.slice(0, 7));
              setDia(hoje);
            }}
          >
            Hoje
          </Button>
        </div>
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[12.5px] text-muted-foreground">
          {(["agendado", "publicado", "rascunho"] as Situacao[]).map((s) =>
            s === "rascunho" && !conta.rascunho ? null : (
              <span key={s} className="inline-flex items-center gap-1.5">
                <i className={cn("h-2 w-2 rounded-full", COR[s].ponto)} />
                <b className="tabular font-semibold text-foreground">{conta[s]}</b>
                {s === "agendado" ? "agendados" : s === "publicado" ? "publicados" : "rascunhos"}
              </span>
            ),
          )}
        </div>
      </div>

      {modo === "mes" ? (
        <GradeMes mes={mes} hoje={hoje} porDia={porDia} onDia={setDia} />
      ) : (
        <Cartao titulo="Conteúdos do mês" sub={`${doMes.length} no total`} colado>
          {doMes.length ? (
            <ul className="divide-y border-t">
              {[...new Set(doMes.map((c) => diaDe(c.published_at)))].map((d) => (
                <li key={d} className="px-4 py-3 sm:px-5">
                  <p
                    className={cn(
                      "mb-2 text-[12.5px] font-semibold uppercase tracking-[0.03em] text-muted-foreground",
                      d === hoje && "text-primary",
                    )}
                  >
                    {d === hoje ? "Hoje · " : ""}
                    {diaLongo(d)}
                  </p>
                  <ListaDia itens={porDia.get(d) ?? []} />
                </li>
              ))}
            </ul>
          ) : (
            <div className="px-4 pb-4 sm:px-5">
              <Vazio>Nada publicado ou agendado neste mês.</Vazio>
            </div>
          )}
        </Cartao>
      )}

      <PainelDia dia={dia} hoje={hoje} porDia={porDia} onDia={setDia} carregando={isFetching} />
    </div>
  );
}

function GradeMes({
  mes,
  hoje,
  porDia,
  onDia,
}: {
  mes: string;
  hoje: string;
  porDia: Map<string, ConteudoAgenda[]>;
  onDia: (d: string) => void;
}) {
  return (
    <section className="overflow-hidden rounded-xl border bg-card">
      <div className="grid grid-cols-7 border-b bg-[#F7F8FA] text-center text-[11px] font-semibold uppercase tracking-[0.04em] text-muted-foreground">
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
          const passado = d < hoje;
          return (
            <button
              key={d}
              type="button"
              onClick={() => onDia(d)}
              aria-label={`${diaLongo(d)}: ${itens.length} conteúdo${itens.length === 1 ? "" : "s"}`}
              className={cn(
                "group flex min-h-[64px] min-w-0 flex-col items-stretch gap-1 border-b border-r p-1 text-left transition hover:bg-[#F5F8FF] focus-visible:relative focus-visible:z-10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary sm:min-h-[118px] sm:p-1.5 [&:nth-child(7n)]:border-r-0",
                fora && "bg-[#FAFBFC]",
              )}
            >
              <span className="flex items-center justify-center gap-1 sm:justify-between">
                <span
                  className={cn(
                    "tabular flex h-6 w-6 items-center justify-center rounded-full text-[12px] font-semibold",
                    ehHoje && "bg-primary text-primary-foreground",
                    !ehHoje && fora && "text-[#B5BCC8]",
                    !ehHoje && !fora && passado && "text-muted-foreground",
                  )}
                >
                  {Number(d.slice(8, 10))}
                </span>
                {itens.length ? (
                  <span className="tabular hidden pr-1 text-[11px] font-medium text-muted-foreground sm:inline">
                    {itens.length}
                  </span>
                ) : null}
              </span>
              {itens.length ? (
                <>
                  {/* Celular: pontos e a quantidade. */}
                  <span className="flex flex-wrap items-center justify-center gap-[3px] px-0.5 pt-0.5 sm:hidden">
                    {itens.slice(0, 4).map((c) => (
                      <i
                        key={c.id}
                        className={cn("h-1.5 w-1.5 rounded-full", COR[situacao(c)].ponto)}
                      />
                    ))}
                    {itens.length > 4 ? (
                      <span className="text-[10px] font-semibold leading-none text-muted-foreground">
                        +{itens.length - 4}
                      </span>
                    ) : null}
                  </span>
                  {/* Computador: horário e título. */}
                  <span className="hidden flex-col gap-[3px] sm:flex">
                    {itens.slice(0, 3).map((c) => (
                      <span
                        key={c.id}
                        className={cn(
                          "flex min-w-0 items-center gap-1 rounded-[5px] border-l-2 px-1.5 py-[3px] text-[11px] leading-tight",
                          COR[situacao(c)].barra,
                        )}
                        title={`${HORA.format(new Date(c.published_at))} · ${c.title}`}
                      >
                        <span className="tabular shrink-0 font-semibold">
                          {HORA.format(new Date(c.published_at))}
                        </span>
                        <span className="truncate text-[#3A4456]">{c.title}</span>
                      </span>
                    ))}
                    {itens.length > 3 ? (
                      <span className="px-1.5 text-[11px] font-semibold text-primary">
                        +{itens.length - 3} mais
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
  );
}

/** Agenda do dia: lateral no computador, painel de baixo no celular. */
function PainelDia({
  dia,
  hoje,
  porDia,
  onDia,
  carregando,
}: {
  dia: string | null;
  hoje: string;
  porDia: Map<string, ConteudoAgenda[]>;
  onDia: (d: string | null) => void;
  carregando: boolean;
}) {
  const celular = useIsMobile();
  const itens = dia ? (porDia.get(dia) ?? []) : [];
  const conta = { agendado: 0, publicado: 0, rascunho: 0 } as Record<Situacao, number>;
  for (const c of itens) conta[situacao(c)] += 1;
  const resumo = [
    conta.publicado ? `${conta.publicado} publicado${conta.publicado > 1 ? "s" : ""}` : null,
    conta.agendado ? `${conta.agendado} agendado${conta.agendado > 1 ? "s" : ""}` : null,
    conta.rascunho ? `${conta.rascunho} rascunho${conta.rascunho > 1 ? "s" : ""}` : null,
  ].filter(Boolean);

  return (
    <Sheet open={!!dia} onOpenChange={(v) => !v && onDia(null)}>
      <SheetContent
        side={celular ? "bottom" : "right"}
        semFechar
        className={cn(
          "flex flex-col gap-0 p-0",
          celular
            ? "max-h-[88dvh] pb-[env(safe-area-inset-bottom)]"
            : "w-full pt-0 sm:max-w-[460px]",
        )}
      >
        {celular ? (
          <div className="flex justify-center pt-2.5" aria-hidden>
            <span className="h-1 w-10 rounded-full bg-[#D5DAE3]" />
          </div>
        ) : null}
        <div
          className={cn(
            "flex items-start gap-3 border-b px-5 pb-3.5",
            celular ? "pt-2" : "pt-[calc(1.25rem+env(safe-area-inset-top))]",
          )}
        >
          <div className="min-w-0 flex-1">
            <p className="text-[12px] font-semibold uppercase tracking-[0.04em] text-primary">
              {dia === hoje
                ? "Hoje"
                : dia === somarDias(hoje, 1)
                  ? "Amanhã"
                  : dia === somarDias(hoje, -1)
                    ? "Ontem"
                    : "Agenda do dia"}
            </p>
            <SheetTitle className="mt-0.5 text-[17px] font-semibold leading-snug sm:text-[18px]">
              {dia ? diaLongo(dia) : ""}
            </SheetTitle>
            <SheetDescription className="mt-0.5 text-[12.5px] text-muted-foreground">
              {itens.length
                ? `${itens.length} conteúdo${itens.length > 1 ? "s" : ""} · ${resumo.join(" · ")}`
                : carregando
                  ? "Carregando..."
                  : "Nada publicado ou agendado"}
            </SheetDescription>
          </div>
          <div className="flex shrink-0 items-center gap-1">
            <button
              type="button"
              aria-label="Dia anterior"
              onClick={() => dia && onDia(somarDias(dia, -1))}
              className="flex h-9 w-9 items-center justify-center rounded-lg border text-[#3A4456] transition hover:bg-muted"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <button
              type="button"
              aria-label="Próximo dia"
              onClick={() => dia && onDia(somarDias(dia, 1))}
              className="flex h-9 w-9 items-center justify-center rounded-lg border text-[#3A4456] transition hover:bg-muted"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
            <button
              type="button"
              aria-label="Fechar"
              onClick={() => onDia(null)}
              className="ml-1 flex h-9 w-9 items-center justify-center rounded-lg text-muted-foreground transition hover:bg-muted hover:text-foreground"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 py-4 sm:px-5">
          {itens.length ? (
            <ol className="relative space-y-3">
              {itens.map((c) => (
                <CartaoConteudo key={c.id} c={c} />
              ))}
            </ol>
          ) : (
            <div className="flex flex-col items-center gap-2 py-12 text-center">
              <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-[#F1F3F7] text-muted-foreground">
                <CalendarDays className="h-5 w-5" />
              </span>
              <p className="text-[14px] font-semibold">Dia livre</p>
              <p className="max-w-[260px] text-[13px] text-muted-foreground">
                Nenhuma matéria publicada ou agendada. Use as setas para ver outros dias.
              </p>
            </div>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}

function CartaoConteudo({ c }: { c: ConteudoAgenda }) {
  const s = situacao(c);
  const link = linkMateria(c.slug);
  const capa = c.cover_image_url ? urlSegura(c.cover_image_url) : undefined;
  return (
    <li className="overflow-hidden rounded-xl border bg-card">
      <div className="flex gap-3 p-3">
        <Capa src={capa} />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="tabular inline-flex items-center gap-1 text-[12px] font-semibold">
              <Clock className="h-3.5 w-3.5 text-muted-foreground" />
              {HORA.format(new Date(c.published_at))}
            </span>
            <Etiqueta tom={COR[s].tom}>{s}</Etiqueta>
            {c.category ? (
              <span className="text-[11.5px] text-muted-foreground">
                {CATEGORIA[c.category] ?? c.category}
              </span>
            ) : null}
          </div>
          <p className="mt-1 line-clamp-3 text-[13.5px] font-semibold leading-snug">{c.title}</p>
        </div>
      </div>
      <div className="flex divide-x border-t text-[12.5px] font-semibold">
        {link ? (
          <a
            href={link}
            target="_blank"
            rel="noreferrer"
            className="flex flex-1 items-center justify-center gap-1.5 py-2.5 text-primary transition hover:bg-[#F5F8FF]"
          >
            {s === "publicado" ? "Abrir matéria" : "Link da matéria"}{" "}
            <ExternalLink className="h-3.5 w-3.5" />
          </a>
        ) : null}
        {c.social_url ? (
          <a
            href={urlSegura(c.social_url)}
            target="_blank"
            rel="noreferrer"
            className="flex flex-1 items-center justify-center gap-1.5 py-2.5 text-[#3A4456] transition hover:bg-muted"
          >
            Ver post <ExternalLink className="h-3.5 w-3.5" />
          </a>
        ) : (
          <span className="flex flex-1 items-center justify-center py-2.5 font-medium text-muted-foreground">
            sem post vinculado
          </span>
        )}
      </div>
    </li>
  );
}

/** Capa da matéria (só as guardadas no storage do site carregam; as outras mostram o ícone). */
function Capa({ src }: { src?: string }) {
  const [falhou, setFalhou] = useState(false);
  return (
    <div className="relative h-[72px] w-[72px] shrink-0 overflow-hidden rounded-lg bg-[#F1F3F7]">
      {src && !falhou ? (
        <img
          src={src}
          alt=""
          loading="lazy"
          decoding="async"
          referrerPolicy="no-referrer"
          onError={() => setFalhou(true)}
          className="h-full w-full object-cover"
        />
      ) : (
        <span className="flex h-full w-full items-center justify-center text-[#B5BCC8]">
          <ImageIcon className="h-5 w-5" />
        </span>
      )}
    </div>
  );
}

function ListaDia({ itens }: { itens: ConteudoAgenda[] }) {
  return (
    <ul className="space-y-2">
      {itens.map((c) => {
        const s = situacao(c);
        return (
          <li key={c.id} className="flex items-start gap-3">
            <span className="tabular w-11 shrink-0 pt-0.5 text-[12px] font-semibold text-muted-foreground">
              {HORA.format(new Date(c.published_at))}
            </span>
            <i className={cn("mt-1.5 h-2 w-2 shrink-0 rounded-full", COR[s].ponto)} />
            <span className="min-w-0 flex-1">
              <a
                href={linkMateria(c.slug) ?? undefined}
                target="_blank"
                rel="noreferrer"
                className="line-clamp-2 text-[13.5px] font-medium leading-snug hover:text-primary"
              >
                {c.title}
              </a>
              <span className="mt-0.5 flex flex-wrap items-center gap-x-2 text-[11.5px] text-muted-foreground">
                <span>{s}</span>
                {c.category ? <span>· {CATEGORIA[c.category] ?? c.category}</span> : null}
                {c.social_url ? (
                  <a
                    href={urlSegura(c.social_url)}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1 font-semibold text-primary hover:underline"
                  >
                    · post <ExternalLink className="h-3 w-3" />
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
