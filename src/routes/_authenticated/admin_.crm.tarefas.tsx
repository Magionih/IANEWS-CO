import { useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  CalendarDays,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Circle,
  List,
  Plus,
  XCircle,
} from "lucide-react";

import { useCrm } from "@/components/crm/context";
import { TarefaDialog } from "@/components/crm/dialogs";
import { NegocioPainel } from "@/components/crm/negocio";
import { MembroSelect } from "@/components/crm/pickers";
import { useAcao } from "@/components/crm/queries";
import { BotaoCsv, CabecalhoPagina, Carregando, Erro, Etiqueta, Vazio } from "@/components/crm/ui";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { cancelarTarefa, concluirTarefa, listTarefas } from "@/lib/crm/tarefas.functions";
import type { CrmTarefaItem } from "@/lib/crm/types";
import { atrasado, contem, fmtDia, hojeBR, prazoRelativo, somarDias } from "@/lib/crm/utils";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/admin_/crm/tarefas")({
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
    <li key={t.id} className="flex items-start gap-3 py-2.5">
      <button
        type="button"
        aria-label={t.feita ? "Reabrir" : "Concluir"}
        className="mt-0.5 text-muted-foreground hover:text-primary"
        onClick={() =>
          executar(
            () => concluir({ data: { id: t.id, feita: !t.feita } }),
            t.feita ? "Tarefa reaberta." : "Tarefa concluída.",
          )
        }
      >
        {t.feita ? (
          <CheckCircle2 className="h-5 w-5 text-primary" />
        ) : (
          <Circle className="h-5 w-5" />
        )}
      </button>
      <div className="min-w-0 flex-1">
        <button
          type="button"
          className={cn(
            "text-left text-sm font-semibold hover:text-primary",
            t.feita && "text-muted-foreground line-through",
          )}
          onClick={() => setEditar(t)}
        >
          {t.titulo}
        </button>
        <p className="text-xs text-muted-foreground">
          <span
            className={cn(
              !t.feita && atrasado(t.vence_em, hoje) && "font-semibold text-destructive",
            )}
          >
            {t.vence_em ? `${fmtDia(t.vence_em)} (${prazoRelativo(t.vence_em, hoje)})` : "sem data"}
          </span>
          {" · "}
          {membro(t.responsavel_id)}
          {t.empresa_nome ? ` · ${t.empresa_nome}` : ""}
          {t.pessoa_nome ? ` · ${t.pessoa_nome}` : ""}
        </p>
        {t.negocio_titulo ? (
          <button
            type="button"
            className="text-xs text-primary hover:underline"
            onClick={() => setNegocio(t.negocio_id)}
          >
            {t.negocio_titulo}
          </button>
        ) : null}
      </div>
      <div className="flex shrink-0 items-center gap-1">
        {t.automatica ? <Etiqueta>automática</Etiqueta> : null}
        {!t.feita ? (
          <Button
            size="icon"
            variant="ghost"
            className="h-8 w-8"
            title="Descartar tarefa (não apaga, só tira da lista)"
            onClick={() => executar(() => cancelar({ data: { id: t.id } }), "Tarefa descartada.")}
          >
            <XCircle className="h-4 w-4" />
          </Button>
        ) : null}
      </div>
    </li>
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
        descricao="Lista e calendário por responsável. As automáticas nascem das cadências (mudança de etapa, pós-venda, renovação, lead aquecido)."
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
              <Plus className="mr-1.5 h-4 w-4" /> Nova tarefa
            </Button>
          </>
        }
      />

      <div className="grid gap-2 sm:grid-cols-[2fr_1fr_auto_auto]">
        <Input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Filtrar tarefas"
          className="h-10"
        />
        <MembroSelect valor={responsavel} onChange={setResponsavel} incluirTodos />
        <label className="flex items-center gap-2 text-sm">
          <Switch checked={incluirFeitas} onCheckedChange={setIncluirFeitas} /> Mostrar feitas
        </label>
        <div className="flex rounded-md border">
          <Button
            variant={modo === "lista" ? "secondary" : "ghost"}
            className="h-10 rounded-r-none"
            onClick={() => setModo("lista")}
            aria-label="Lista"
          >
            <List className="h-4 w-4" />
          </Button>
          <Button
            variant={modo === "calendario" ? "secondary" : "ghost"}
            className="h-10 rounded-l-none"
            onClick={() => setModo("calendario")}
            aria-label="Calendário"
          >
            <CalendarDays className="h-4 w-4" />
          </Button>
        </div>
      </div>

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
                  className={cn(
                    "rounded-[var(--radius)] border bg-card px-4",
                    k === "atrasadas" && "border-destructive/40",
                  )}
                >
                  <h2
                    className={cn(
                      "border-b py-2.5 text-sm font-bold",
                      k === "atrasadas" && "text-destructive",
                    )}
                  >
                    {titulo} <span className="text-primary">({grupos[k].length})</span>
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
        <div className="rounded-[var(--radius)] border bg-card p-3">
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
