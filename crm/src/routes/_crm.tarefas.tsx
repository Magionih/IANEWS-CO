import { useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  Bot,
  CalendarDays,
  Check,
  ChevronLeft,
  ChevronRight,
  Circle,
  List,
  Plus,
  Search,
  X,
} from "lucide-react";

import { useCrm } from "@/components/crm/context";
import { TarefaDialog } from "@/components/crm/dialogs";
import { NegocioPainel } from "@/components/crm/negocio";
import { MembroSelect } from "@/components/crm/pickers";
import { useAcao } from "@/components/crm/queries";
import {
  Alternador,
  Avatar,
  BarraFerramentas,
  BotaoCsv,
  CabecalhoPagina,
  Carregando,
  Erro,
  Vazio,
} from "@/components/crm/ui";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cancelarTarefa, concluirTarefa, listTarefas } from "@/lib/crm/tarefas.functions";
import type { CrmTarefaItem } from "@/lib/crm/types";
import { atrasado, contem, hojeBR, prazoRelativo, somarDias } from "@/lib/crm/utils";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_crm/tarefas")({
  component: TarefasPage,
});

const SEMANA = ["seg", "ter", "qua", "qui", "sex", "sáb", "dom"];
const POR_PAGINA = 150;
const DIA_GRUPO = new Intl.DateTimeFormat("pt-BR", {
  weekday: "short",
  day: "2-digit",
  month: "short",
  timeZone: "UTC",
});
function rotuloDia(d: string) {
  const t = DIA_GRUPO.format(new Date(`${d}T12:00:00Z`)).replace(/\./g, "");
  return t.charAt(0).toUpperCase() + t.slice(1);
}

function TarefasPage() {
  const { membro, userId } = useCrm();
  const fetchTarefas = useServerFn(listTarefas);
  const concluir = useServerFn(concluirTarefa);
  const cancelar = useServerFn(cancelarTarefa);
  const { executar } = useAcao();
  const [modo, setModo] = useState<"lista" | "calendario">("lista");
  const [responsavel, setResponsavel] = useState<string | null>(userId);
  const [status, setStatus] = useState<"pendentes" | "atrasadas" | "feitas">("pendentes");
  const incluirFeitas = status === "feitas";
  const [limite, setLimite] = useState(POR_PAGINA);
  const [q, setQ] = useState("");
  const [mes, setMes] = useState(() => hojeBR().slice(0, 7));
  const [editar, setEditar] = useState<CrmTarefaItem | null>(null);
  const [nova, setNova] = useState<string | null>(null);
  const [negocio, setNegocio] = useState<string | null>(null);

  const { data, isLoading, error } = useQuery({
    queryKey: ["crm", "tarefas", incluirFeitas],
    queryFn: () => fetchTarefas({ data: { incluirFeitas } }),
  });

  const hoje = hojeBR();
  const lista = useMemo(
    () =>
      (data ?? []).filter(
        (t) =>
          (status === "feitas" ? t.feita : !t.feita) &&
          (status !== "atrasadas" || (!!t.vence_em && t.vence_em < hojeBR())) &&
          (!responsavel || t.responsavel_id === responsavel || !t.responsavel_id) &&
          contem([t.titulo, t.descricao, t.empresa_nome, t.pessoa_nome, t.negocio_titulo], q),
      ),
    [data, responsavel, q, status],
  );
  // Agrupa por dia de vencimento (como a lista de atividades), sem data no fim.
  const porDiaLista = useMemo(() => {
    const ordenada = [...lista].sort((a, b) =>
      status === "feitas"
        ? (b.feita_em ?? "").localeCompare(a.feita_em ?? "")
        : (a.vence_em ?? "9999").localeCompare(b.vence_em ?? "9999"),
    );
    const visiveis = ordenada.slice(0, limite);
    const m = new Map<string, CrmTarefaItem[]>();
    for (const t of visiveis) {
      const k =
        status === "feitas" ? (t.feita_em ?? "").slice(0, 10) || "sem" : (t.vence_em ?? "sem");
      m.set(k, [...(m.get(k) ?? []), t]);
    }
    return { grupos: [...m.entries()], total: ordenada.length };
  }, [lista, limite, status]);
  const grupos = useMemo(() => {
    const g = {
      atrasadas: [] as CrmTarefaItem[],
      hoje: [] as CrmTarefaItem[],
      semana: [] as CrmTarefaItem[],
      depois: [] as CrmTarefaItem[],
      feitas: [] as CrmTarefaItem[],
    };
    const fimSemana = somarDias(hoje, 7);
    for (const t of lista) {
      if (t.feita) g.feitas.push(t);
      else if (t.vence_em && t.vence_em < hoje) g.atrasadas.push(t);
      else if (t.vence_em === hoje) g.hoje.push(t);
      else if (t.vence_em && t.vence_em <= fimSemana) g.semana.push(t);
      else g.depois.push(t);
    }
    return g;
  }, [lista, hoje]);

  // Calendário do mês (segunda a domingo).
  const dias = useMemo(() => {
    const primeiro = `${mes}-01`;
    const dow = (new Date(`${primeiro}T12:00:00Z`).getUTCDay() + 6) % 7;
    const inicio = somarDias(primeiro, -dow);
    return Array.from({ length: 42 }, (_, i) => somarDias(inicio, i));
  }, [mes]);
  const porDia = useMemo(() => {
    const m = new Map<string, CrmTarefaItem[]>();
    for (const t of lista) if (t.vence_em) m.set(t.vence_em, [...(m.get(t.vence_em) ?? []), t]);
    return m;
  }, [lista]);
  const mudarMes = (n: number) => {
    const d = new Date(`${mes}-15T12:00:00Z`);
    d.setUTCMonth(d.getUTCMonth() + n);
    setMes(d.toISOString().slice(0, 7));
  };

  return (
    <div className="space-y-4">
      <CabecalhoPagina
        titulo="Tarefas"
        descricao="Por responsável, em lista ou calendário. As automáticas (ícone de robô) nascem das cadências de cada etapa."
        acoes={
          <>
            <BotaoCsv
              nome="tarefas"
              linhas={lista}
              colunas={[
                { titulo: "Tarefa", valor: (t) => t.titulo },
                { titulo: "Vence em", valor: (t) => t.vence_em },
                { titulo: "Responsável", valor: (t) => membro(t.responsavel_id) },
                { titulo: "Empresa", valor: (t) => t.empresa_nome },
                { titulo: "Pessoa", valor: (t) => t.pessoa_nome },
                { titulo: "Negócio", valor: (t) => t.negocio_titulo },
                { titulo: "Feita", valor: (t) => t.feita },
                { titulo: "Feita em", valor: (t) => t.feita_em },
                { titulo: "Automática", valor: (t) => t.automatica },
              ]}
            />
            <Button size="sm" className="h-9" onClick={() => setNova(hoje)}>
              <Plus className="h-4 w-4" /> Nova tarefa
            </Button>
          </>
        }
      />

      <BarraFerramentas
        direita={
          <>
            <span className="tabular hidden text-[13px] text-muted-foreground sm:inline">
              {lista.length} tarefas
            </span>
            <Alternador
              valor={modo}
              onChange={setModo}
              opcoes={[
                { valor: "lista", icone: List, titulo: "Lista" },
                { valor: "calendario", icone: CalendarDays, titulo: "Calendário" },
              ]}
            />
          </>
        }
      >
        <div className="flex h-9 w-full min-w-0 items-center gap-2 rounded-lg border bg-card px-3 sm:w-64 focus-within:border-primary focus-within:ring-[3px] focus-within:ring-primary/15">
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Pesquisar…"
            aria-label="Buscar tarefas"
            className="w-full min-w-0 bg-transparent text-[13px] outline-none placeholder:text-muted-foreground"
          />
          <Search className="h-4 w-4 shrink-0 text-muted-foreground" />
        </div>
        <Select
          value={status}
          onValueChange={(v) => {
            setStatus(v as typeof status);
            setLimite(POR_PAGINA);
          }}
        >
          <SelectTrigger className="h-9 w-auto gap-2 bg-card text-[13px] font-medium">
            <Circle className="h-3.5 w-3.5 text-primary" />
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="pendentes">Pendentes</SelectItem>
            <SelectItem value="atrasadas">Só atrasadas</SelectItem>
            <SelectItem value="feitas">Concluídas</SelectItem>
          </SelectContent>
        </Select>
        <MembroSelect
          valor={responsavel}
          onChange={setResponsavel}
          incluirTodos
          className="h-9 w-full bg-card text-[13px] sm:w-48"
        />
      </BarraFerramentas>

      {isLoading ? (
        <Carregando />
      ) : error ? (
        <Erro erro={error} />
      ) : modo === "lista" ? (
        lista.length ? (
          <div className="overflow-hidden rounded-xl border bg-card shadow-[var(--shadow-card)]">
            <div className="hidden grid-cols-[minmax(0,2.2fr)_minmax(0,1.4fr)_minmax(0,1.4fr)_150px] gap-4 border-b bg-[#f8f9fb] px-5 py-2.5 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground md:grid">
              <span className="pl-9">Tarefa</span>
              <span>Contato</span>
              <span>Negócio</span>
              <span>Responsável</span>
            </div>
            {porDiaLista.grupos.map(([dia, itens]) => {
              const atrasadas = itens.filter((t) => !t.feita && atrasado(t.vence_em, hoje)).length;
              const quando =
                dia === "sem" ? null : dia < hoje ? "Passado" : dia === hoje ? "Hoje" : "Próximo";
              return (
                <section key={dia}>
                  <h2 className="flex flex-wrap items-center gap-2 border-b bg-[#fbfbfd] px-5 py-2 text-[12.5px]">
                    <span className="font-semibold">
                      {dia === "sem" ? "Sem data" : rotuloDia(dia)}
                    </span>
                    {quando ? (
                      <span
                        className={cn(
                          "text-[10.5px] font-semibold uppercase tracking-wide",
                          quando === "Hoje" ? "text-primary" : "text-muted-foreground",
                        )}
                      >
                        {quando}
                      </span>
                    ) : null}
                    <span className="text-muted-foreground">{itens.length} tarefas</span>
                    {atrasadas ? (
                      <span className="flex items-center gap-1 text-[11.5px] font-medium text-destructive">
                        <span className="h-1.5 w-1.5 rounded-full bg-destructive" />
                        {atrasadas} atrasada{atrasadas > 1 ? "s" : ""}
                      </span>
                    ) : null}
                  </h2>
                  <ul className="divide-y">
                    {itens.map((t) => (
                      <LinhaTarefa
                        key={t.id}
                        t={t}
                        hoje={hoje}
                        responsavel={membro(t.responsavel_id)}
                        onAbrir={() => setEditar(t)}
                        onNegocio={t.negocio_id ? () => setNegocio(t.negocio_id) : undefined}
                        onConcluir={() =>
                          executar(
                            () => concluir({ data: { id: t.id, feita: !t.feita } }),
                            t.feita ? "Tarefa reaberta." : "Tarefa concluída.",
                          )
                        }
                        onDescartar={() =>
                          executar(() => cancelar({ data: { id: t.id } }), "Tarefa descartada.")
                        }
                      />
                    ))}
                  </ul>
                </section>
              );
            })}
            {porDiaLista.total > limite ? (
              <button
                type="button"
                onClick={() => setLimite((l) => l + POR_PAGINA)}
                className="w-full border-t px-5 py-3 text-[13px] font-semibold text-primary hover:bg-[#f8faff]"
              >
                Carregar mais ({porDiaLista.total - limite} restantes)
              </button>
            ) : null}
          </div>
        ) : (
          <Vazio>Nenhuma tarefa.</Vazio>
        )
      ) : (
        <div className="rounded-xl border bg-card shadow-[var(--shadow-card)] p-3">
          <div className="mb-3 flex items-center justify-between">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => mudarMes(-1)}
              aria-label="Mês anterior"
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <p className="font-bold capitalize">
              {new Date(`${mes}-15T12:00:00Z`).toLocaleDateString("pt-BR", {
                month: "long",
                year: "numeric",
                timeZone: "UTC",
              })}
            </p>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => mudarMes(1)}
              aria-label="Próximo mês"
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
          <div className="grid grid-cols-7 gap-1 text-center text-[11px] font-semibold text-muted-foreground">
            {SEMANA.map((d) => (
              <div key={d}>{d}</div>
            ))}
          </div>
          <div className="mt-1 grid grid-cols-7 gap-1">
            {dias.map((d) => {
              const doDia = porDia.get(d) ?? [];
              const foraDoMes = !d.startsWith(mes);
              return (
                <button
                  type="button"
                  key={d}
                  onClick={() => setNova(d)}
                  className={cn(
                    "flex min-h-[86px] flex-col rounded-md border p-1 text-left align-top hover:border-primary/60",
                    foraDoMes && "opacity-40",
                    d === hoje && "border-primary",
                  )}
                >
                  <span className={cn("text-xs font-semibold", d === hoje && "text-primary")}>
                    {Number(d.slice(8))}
                  </span>
                  <span className="mt-0.5 flex flex-col gap-0.5">
                    {doDia.slice(0, 3).map((t) => (
                      <span
                        key={t.id}
                        onClick={(e) => {
                          e.stopPropagation();
                          setEditar(t);
                        }}
                        className={cn(
                          "truncate rounded px-1 text-[10px] leading-4",
                          t.feita
                            ? "bg-muted text-muted-foreground line-through"
                            : atrasado(t.vence_em, hoje)
                              ? "bg-destructive/10 text-destructive"
                              : "bg-primary/10 text-primary",
                        )}
                        title={`${t.titulo} · ${membro(t.responsavel_id)}`}
                      >
                        {t.titulo}
                      </span>
                    ))}
                    {doDia.length > 3 ? (
                      <span className="text-[10px] text-muted-foreground">+{doDia.length - 3}</span>
                    ) : null}
                  </span>
                </button>
              );
            })}
          </div>
          <p className="mt-2 text-xs text-muted-foreground">
            Clique num dia para criar tarefa; clique na tarefa para editar ou reatribuir.
          </p>
        </div>
      )}

      <TarefaDialog aberto={!!editar} onClose={() => setEditar(null)} tarefa={editar} />
      <TarefaDialog
        aberto={!!nova}
        onClose={() => setNova(null)}
        tarefa={nova ? { vence_em: nova } : null}
      />
      <NegocioPainel id={negocio} onClose={() => setNegocio(null)} />
    </div>
  );
}

function LinhaTarefa({
  t,
  hoje,
  responsavel,
  onAbrir,
  onNegocio,
  onConcluir,
  onDescartar,
}: {
  t: CrmTarefaItem;
  hoje: string;
  responsavel: string;
  onAbrir: () => void;
  onNegocio?: () => void;
  onConcluir: () => void;
  onDescartar: () => void;
}) {
  const late = !t.feita && atrasado(t.vence_em, hoje);
  return (
    <li className="group grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-x-3 gap-y-1 px-5 py-2.5 transition hover:bg-[#f8faff] md:grid-cols-[auto_minmax(0,2.2fr)_minmax(0,1.4fr)_minmax(0,1.4fr)_150px] md:gap-4">
      <button
        type="button"
        onClick={onConcluir}
        aria-label={t.feita ? "Reabrir tarefa" : "Concluir tarefa"}
        className={cn(
          "flex h-5 w-5 items-center justify-center rounded-full border-2 transition",
          t.feita
            ? "border-emerald-500 bg-emerald-500 text-white"
            : "border-muted-foreground/40 text-transparent hover:border-primary hover:text-primary",
        )}
      >
        <Check className="h-3 w-3" />
      </button>
      <button type="button" onClick={onAbrir} className="min-w-0 text-left">
        <span
          className={cn(
            "flex items-center gap-1.5 truncate text-[13.5px] font-medium",
            t.feita && "text-muted-foreground line-through",
          )}
        >
          {t.automatica ? <Bot className="h-3.5 w-3.5 shrink-0 text-muted-foreground" /> : null}
          <span className="truncate">{t.titulo}</span>
        </span>
        <span className="flex items-center gap-1.5 text-[11.5px]">
          {late ? (
            <span className="flex items-center gap-1 font-medium text-destructive">
              <span className="h-1.5 w-1.5 rounded-full bg-destructive" />{" "}
              {prazoRelativo(t.vence_em)}
            </span>
          ) : (
            <span className="text-muted-foreground">
              {t.vence_em ? prazoRelativo(t.vence_em) : "sem data"}
            </span>
          )}
        </span>
      </button>
      <span className="col-start-2 min-w-0 truncate text-[12.5px] text-muted-foreground md:col-start-auto">
        {[t.pessoa_nome, t.empresa_nome].filter(Boolean).join(" · ") || "—"}
      </span>
      <span className="hidden min-w-0 md:block">
        {t.negocio_titulo && onNegocio ? (
          <button
            type="button"
            onClick={onNegocio}
            className="max-w-full truncate rounded-md bg-primary/[0.07] px-2 py-0.5 text-[12px] font-medium text-primary hover:bg-primary/[0.12]"
          >
            {t.negocio_titulo}
          </button>
        ) : (
          <span className="text-[12.5px] text-muted-foreground">—</span>
        )}
      </span>
      <span className="row-start-1 flex items-center justify-end gap-2 md:row-start-auto md:justify-start">
        <Avatar nome={responsavel} />
        <span className="hidden truncate text-[12.5px] md:inline">{responsavel}</span>
        {!t.feita ? (
          <button
            type="button"
            onClick={onDescartar}
            title="Descartar tarefa"
            aria-label="Descartar tarefa"
            className="ml-auto rounded p-1 text-muted-foreground opacity-0 transition hover:bg-muted hover:text-destructive group-hover:opacity-100"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        ) : null}
      </span>
    </li>
  );
}
