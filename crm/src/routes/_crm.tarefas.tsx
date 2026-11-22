import { useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { CalendarDays, ChevronLeft, ChevronRight, List, Plus, Search } from "lucide-react";

import { useCrm } from "@/components/crm/context";
import { TarefaDialog } from "@/components/crm/dialogs";
import { NegocioPainel } from "@/components/crm/negocio";
import { MembroSelect } from "@/components/crm/pickers";
import { useAcao } from "@/components/crm/queries";
import { TarefaLinha } from "@/components/crm/tarefa";
import {
  Alternador,
  BotaoCsv,
  CabecalhoPagina,
  Carregando,
  Erro,
  Vazio,
} from "@/components/crm/ui";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { cancelarTarefa, concluirTarefa, listTarefas } from "@/lib/crm/tarefas.functions";
import type { CrmTarefaItem } from "@/lib/crm/types";
import { atrasado, contem, hojeBR, somarDias } from "@/lib/crm/utils";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_crm/tarefas")({
  component: TarefasPage,
});

const SEMANA = ["seg", "ter", "qua", "qui", "sex", "sáb", "dom"];

function TarefasPage() {
  const { membro, userId } = useCrm();
  const fetchTarefas = useServerFn(listTarefas);
  const concluir = useServerFn(concluirTarefa);
  const cancelar = useServerFn(cancelarTarefa);
  const { executar } = useAcao();
  const [modo, setModo] = useState<"lista" | "calendario">("lista");
  const [responsavel, setResponsavel] = useState<string | null>(userId);
  const [incluirFeitas, setIncluirFeitas] = useState(false);
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
          (!responsavel || t.responsavel_id === responsavel || !t.responsavel_id) &&
          contem([t.titulo, t.descricao, t.empresa_nome, t.pessoa_nome, t.negocio_titulo], q),
      ),
    [data, responsavel, q],
  );
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

  const item = (t: CrmTarefaItem) => (
    <TarefaLinha
      key={t.id}
      t={t}
      hoje={hoje}
      onAbrir={() => setEditar(t)}
      onNegocio={t.negocio_id ? () => setNegocio(t.negocio_id) : undefined}
      onConcluir={() =>
        executar(
          () => concluir({ data: { id: t.id, feita: !t.feita } }),
          t.feita ? "Tarefa reaberta." : "Tarefa concluída.",
        )
      }
      onDescartar={() => executar(() => cancelar({ data: { id: t.id } }), "Tarefa descartada.")}
    />
  );

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

      {/* Filtros numa linha só: busca, responsável, feitas e modo. */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex h-10 min-w-0 flex-[1_1_220px] items-center gap-2 rounded-lg border bg-card px-3 shadow-[0_1px_2px_rgb(16_24_40/0.04)] focus-within:border-primary focus-within:ring-[3px] focus-within:ring-primary/15">
          <Search className="h-4 w-4 shrink-0 text-muted-foreground" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Buscar tarefa, empresa ou pessoa"
            aria-label="Buscar tarefas"
            className="w-full min-w-0 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
          />
        </div>
        <div className="flex flex-[1_1_auto] items-center gap-2 sm:flex-none">
          <MembroSelect
            valor={responsavel}
            onChange={setResponsavel}
            incluirTodos
            className="h-10 min-w-0 flex-1 sm:w-48 sm:flex-none"
          />
          <label
            className="flex h-10 shrink-0 cursor-pointer items-center gap-2 rounded-lg border bg-card px-3 text-[13px] font-medium shadow-[0_1px_2px_rgb(16_24_40/0.04)]"
            title="Mostrar tarefas feitas"
          >
            <Switch checked={incluirFeitas} onCheckedChange={setIncluirFeitas} />
            Feitas
          </label>
          <Alternador
            valor={modo}
            onChange={setModo}
            opcoes={[
              { valor: "lista", icone: List, titulo: "Lista" },
              { valor: "calendario", icone: CalendarDays, titulo: "Calendário" },
            ]}
          />
        </div>
      </div>

      {modo === "lista" && !isLoading && !error ? (
        <div className="grid grid-cols-4 gap-2">
          {(
            [
              ["atrasadas", "Atrasadas", "text-destructive"],
              ["hoje", "Hoje", "text-primary"],
              ["semana", "7 dias", ""],
              ["depois", "Depois", ""],
            ] as const
          ).map(([k, r, cor]) => (
            <a
              key={k}
              href={`#tarefas-${k}`}
              className="rounded-xl border bg-card px-3 py-2.5 shadow-[var(--shadow-card)] transition hover:border-primary/40"
            >
              <span className="block text-[11.5px] font-medium text-muted-foreground">{r}</span>
              <span className={cn("tabular text-xl font-semibold", grupos[k].length && cor)}>
                {grupos[k].length}
              </span>
            </a>
          ))}
        </div>
      ) : null}

      {isLoading ? (
        <Carregando />
      ) : error ? (
        <Erro erro={error} />
      ) : modo === "lista" ? (
        lista.length ? (
          <div className="space-y-4">
            {(
              [
                ["atrasadas", "Atrasadas"],
                ["hoje", "Hoje"],
                ["semana", "Próximos 7 dias"],
                ["depois", "Depois / sem data"],
                ["feitas", "Feitas"],
              ] as const
            ).map(([k, titulo]) =>
              grupos[k].length ? (
                <section
                  key={k}
                  id={`tarefas-${k}`}
                  className="scroll-mt-20 overflow-hidden rounded-xl border bg-card shadow-[var(--shadow-card)]"
                >
                  <h2 className="flex items-center gap-2 border-b bg-[#f8f9fb] px-4 py-2.5 text-[13px] font-semibold sm:px-5">
                    <span
                      className={cn(
                        "h-2 w-2 rounded-full",
                        k === "atrasadas"
                          ? "bg-destructive"
                          : k === "hoje"
                            ? "bg-primary"
                            : k === "feitas"
                              ? "bg-emerald-500"
                              : "bg-slate-300",
                      )}
                    />
                    {titulo}
                    <span className="tabular rounded-full bg-card px-2 py-0.5 text-[11px] font-semibold text-muted-foreground ring-1 ring-border">
                      {grupos[k].length}
                    </span>
                  </h2>
                  <ul className="divide-y">{grupos[k].map(item)}</ul>
                </section>
              ) : null,
            )}
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
