import { useEffect, useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  ArrowDownUp,
  BarChart3,
  Check,
  ChevronDown,
  ChevronRight,
  Filter,
  LayoutGrid,
  List,
  Plus,
  RefreshCw,
  Search,
} from "lucide-react";
import { z } from "zod";

import { useCrm } from "@/components/crm/context";
import { registrarFunilRecente } from "@/components/crm/shell";
import {
  NegocioCartao,
  NegocioDialog,
  NegocioPainel,
  useMoverEtapa,
} from "@/components/crm/negocio";
import { MembroSelect } from "@/components/crm/pickers";
import { ListaTags } from "@/components/crm/tags";
import {
  Alternador,
  BarraFerramentas,
  BotaoCsv,
  CabecalhoPagina,
  Campo,
  Carregando,
  ChipFiltro,
  Erro,
  FaixaNumeros,
  GrupoBadge,
  Vazio,
} from "@/components/crm/ui";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import type { NegocioCompleto } from "@/lib/crm/carregar";
import { listNegocios } from "@/lib/crm/negocios.functions";
import type { CrmFunilId } from "@/lib/crm/types";
import {
  atrasado,
  contem,
  fmtDia,
  fmtMoeda,
  fmtNum,
  labelDe,
  modalidadeDe,
  ORIGENS,
  PAGAMENTO_LABEL,
  prazoRelativo,
  TIPOS_NEGOCIO,
  type Modalidade,
} from "@/lib/crm/utils";
import { cn } from "@/lib/utils";

const busca = z.object({
  funil: z
    .string()
    .regex(/^[a-z0-9_]{2,40}$/)
    .optional(),
  modalidade: z.enum(["paga", "cortesia"]).optional(),
  tags: z.array(z.string()).max(20).optional(),
  negocio: z.string().optional(),
});

export const Route = createFileRoute("/_crm/negocios")({
  validateSearch: busca,
  component: NegociosPage,
});

const PERDIDOS_VISIVEIS = 20;
/** Cartões por coluna no quadro: funis grandes (como a Ativação) usam a lista ou os filtros para ver o resto. */
const CARTOES_POR_COLUNA = 60;

const ORDEM_VERTICAIS = ["Ativação e base", "Publicidade", "Eventos", "Conselho", "Parcerias"];

function NegociosPage() {
  const { funis, etapasDo, membro, funilNome, tag, userId } = useCrm();
  const search = Route.useSearch();
  const navigate = Route.useNavigate();
  const funil: CrmFunilId = search.funil ?? "materia";
  const modalidade: Modalidade | undefined = search.modalidade;
  const tagsFiltro = useMemo(() => search.tags ?? [], [search.tags]);
  const setTagsFiltro = (ids: string[]) =>
    navigate({ search: (s) => ({ ...s, tags: ids.length ? ids : undefined }), replace: true });
  const fetchNegocios = useServerFn(listNegocios);
  const { moverPara, dialogo } = useMoverEtapa();
  const [modo, setModo] = useState<"kanban" | "lista">("kanban");
  const [q, setQ] = useState("");
  const [dono, setDono] = useState<string | null>(null);
  const [grupo, setGrupo] = useState("todos");
  const [origem, setOrigem] = useState("todas");
  const [tipo, setTipo] = useState("todos");
  const [soAtrasados, setSoAtrasados] = useState(false);
  const [meus, setMeus] = useState(false);
  const [ordem, setOrdem] = useState<"recentes" | "valor" | "acao" | "parado">("recentes");
  const [verIndicadores, setVerIndicadores] = useState(false);
  const [novo, setNovo] = useState(false);
  const [sobre, setSobre] = useState<string | null>(null);

  useEffect(() => registrarFunilRecente(funil), [funil]);

  const { data, isLoading, error, refetch, isFetching } = useQuery({
    queryKey: ["crm", "negocios", funil],
    queryFn: () => fetchNegocios({ data: { funil_id: funil } }),
  });

  const etapas = etapasDo(funil);
  // Funis agrupados por vertical (Ativação e base, Publicidade, Eventos, Conselho, Parcerias).
  const verticais = useMemo(() => {
    const ativos = funis.filter((f) => f.ativo).sort((a, b) => a.ordem - b.ordem);
    const nomes = [...new Set(ativos.map((f) => f.vertical ?? "Outros funis"))].sort(
      (a, b) => (ORDEM_VERTICAIS.indexOf(a) + 1 || 99) - (ORDEM_VERTICAIS.indexOf(b) + 1 || 99),
    );
    return nomes.map((nome) => ({
      nome,
      funis: ativos.filter((f) => (f.vertical ?? "Outros funis") === nome),
    }));
  }, [funis]);
  const verticalAtual = funis.find((f) => f.id === funil)?.vertical ?? "Outros funis";
  const filtrados = useMemo(
    () =>
      (data ?? []).filter(
        (n) =>
          (!modalidade || modalidadeDe(n) === modalidade) &&
          (!tagsFiltro.length || (n.tags ?? []).some((t) => tagsFiltro.includes(t))) &&
          (!dono || n.dono_id === dono) &&
          (!meus || n.dono_id === userId) &&
          (grupo === "todos" || (n.empresa_grupo ?? "sem") === grupo) &&
          (origem === "todas" || n.origem === origem) &&
          (tipo === "todos" || n.tipo === tipo) &&
          (!soAtrasados ||
            (n.etapa_tipo === "aberta" && (atrasado(n.proxima_acao_em) || !n.proxima_acao_em))) &&
          contem([n.titulo, n.empresa_nome, n.pessoa_nome, n.proxima_acao], q),
      ),
    [data, modalidade, tagsFiltro, dono, meus, userId, grupo, origem, tipo, soAtrasados, q],
  );
  const ordenados = useMemo(() => {
    const l = [...filtrados];
    const t = (d?: string | null) => (d ? new Date(d).getTime() : 0);
    if (ordem === "valor") l.sort((a, b) => Number(b.valor ?? 0) - Number(a.valor ?? 0));
    else if (ordem === "acao")
      l.sort((a, b) => (a.proxima_acao_em ?? "9999").localeCompare(b.proxima_acao_em ?? "9999"));
    else if (ordem === "parado")
      l.sort(
        (a, b) =>
          t(a.ultima_atividade_em ?? a.etapa_desde) - t(b.ultima_atividade_em ?? b.etapa_desde),
      );
    return l;
  }, [filtrados, ordem]);

  // Contagem de pagos e cortesias no funil (para os botões do seletor).
  const porModalidade = useMemo(() => {
    const c = { paga: 0, cortesia: 0 };
    for (const n of data ?? []) c[modalidadeDe(n)] += 1;
    return c;
  }, [data]);

  const qtdFiltros =
    (modalidade ? 1 : 0) +
    tagsFiltro.length +
    (dono ? 1 : 0) +
    (grupo !== "todos" ? 1 : 0) +
    (origem !== "todas" ? 1 : 0) +
    (tipo !== "todos" ? 1 : 0) +
    (soAtrasados ? 1 : 0) +
    (meus ? 1 : 0);
  const filtrosAtivos = qtdFiltros > 0;
  const contagemTags = useMemo(() => {
    const c = new Map<string, number>();
    for (const n of data ?? []) for (const t of n.tags ?? []) c.set(t, (c.get(t) ?? 0) + 1);
    return c;
  }, [data]);
  const limparFiltros = () => {
    setQ("");
    setDono(null);
    setGrupo("todos");
    setOrigem("todas");
    setTipo("todos");
    setSoAtrasados(false);
    setMeus(false);
    navigate({ search: (s) => ({ ...s, modalidade: undefined, tags: undefined }), replace: true });
  };

  const porEtapa = useMemo(() => {
    const m = new Map<string, NegocioCompleto[]>();
    for (const n of ordenados) m.set(n.etapa_id, [...(m.get(n.etapa_id) ?? []), n]);
    return m;
  }, [ordenados]);

  const abrir = (id: string | null) =>
    navigate({ search: (s) => ({ ...s, negocio: id ?? undefined }), replace: true });

  const soltar = (etapaId: string, e: React.DragEvent) => {
    e.preventDefault();
    setSobre(null);
    const id = e.dataTransfer.getData("text/negocio");
    const n = data?.find((x) => x.id === id);
    if (n) void moverPara(n, etapaId);
  };

  return (
    <div className="space-y-4">
      <CabecalhoPagina
        titulo={
          <SeletorFunil
            verticais={verticais}
            funil={funil}
            onEscolher={(id) =>
              navigate({ search: { funil: id, modalidade: search.modalidade, tags: search.tags } })
            }
          />
        }
        descricao="Arraste o cartão para mudar de etapa. Borda vermelha: sem próxima ação ou ação vencida."
        acoes={
          <>
            <BotaoCsv
              nome={`negocios-${funil}${modalidade ? `-${modalidade}` : ""}`}
              linhas={filtrados}
              colunas={[
                { titulo: "Título", valor: (n) => n.titulo },
                { titulo: "Funil", valor: (n) => funilNome(n.funil_id) },
                { titulo: "Etapa", valor: (n) => n.etapa_nome },
                { titulo: "Empresa", valor: (n) => n.empresa_nome },
                { titulo: "Grupo", valor: (n) => n.empresa_grupo },
                { titulo: "Pessoa", valor: (n) => n.pessoa_nome },
                {
                  titulo: "Tags",
                  valor: (n) =>
                    (n.tags ?? [])
                      .map((id) => tag(id)?.nome)
                      .filter(Boolean)
                      .join(", "),
                },
                { titulo: "Tipo", valor: (n) => labelDe(TIPOS_NEGOCIO, n.tipo) },
                {
                  titulo: "Modalidade",
                  valor: (n) => (modalidadeDe(n) === "cortesia" ? "Cortesia" : "Pago"),
                },
                { titulo: "Valor", valor: (n) => n.valor },
                { titulo: "Pagamento", valor: (n) => PAGAMENTO_LABEL[n.status_pagamento] },
                { titulo: "Origem", valor: (n) => labelDe(ORIGENS, n.origem) },
                { titulo: "Canal", valor: (n) => n.canal_origem },
                { titulo: "Dono", valor: (n) => membro(n.dono_id) },
                { titulo: "Próxima ação", valor: (n) => n.proxima_acao },
                { titulo: "Data da ação", valor: (n) => n.proxima_acao_em },
                { titulo: "Matéria", valor: (n) => n.article_title },
                { titulo: "Motivo da perda", valor: (n) => n.motivo_perda },
                { titulo: "Criado em", valor: (n) => n.created_at },
                { titulo: "Fechado em", valor: (n) => n.fechado_em },
              ]}
            />
            <Button size="sm" className="h-9" onClick={() => setNovo(true)}>
              Negócio <Plus className="h-4 w-4" />
            </Button>
          </>
        }
      />

      <BarraFerramentas
        direita={
          <>
            <span className="tabular hidden text-[13px] text-muted-foreground sm:inline">
              {fmtNum(filtrados.length)} negócios
            </span>
            <Select value={ordem} onValueChange={(v) => setOrdem(v as typeof ordem)}>
              <SelectTrigger className="h-9 w-auto gap-1.5 border-0 bg-transparent px-2 text-[13px] font-medium shadow-none hover:bg-muted">
                <ArrowDownUp className="h-3.5 w-3.5" />
                <SelectValue />
              </SelectTrigger>
              <SelectContent align="end">
                <SelectItem value="recentes">Mais recentes</SelectItem>
                <SelectItem value="valor">Maior valor</SelectItem>
                <SelectItem value="acao">Próxima ação</SelectItem>
                <SelectItem value="parado">Mais tempo parado</SelectItem>
              </SelectContent>
            </Select>
            <Button
              variant="ghost"
              size="icon"
              className="h-9 w-9"
              title="Atualizar"
              onClick={() => refetch()}
              disabled={isFetching}
            >
              <RefreshCw className={cn("h-4 w-4", isFetching && "animate-spin")} />
            </Button>
            <Button
              variant={verIndicadores ? "secondary" : "ghost"}
              size="icon"
              className="h-9 w-9"
              title="Indicadores do funil"
              onClick={() => setVerIndicadores((v) => !v)}
            >
              <BarChart3 className="h-4 w-4" />
            </Button>
            <Alternador
              valor={modo}
              onChange={setModo}
              opcoes={[
                { valor: "kanban", icone: LayoutGrid, titulo: "Quadro" },
                { valor: "lista", icone: List, titulo: "Lista" },
              ]}
            />
          </>
        }
      >
        <div className="flex h-9 w-full min-w-0 items-center gap-2 rounded-lg border bg-card px-3 sm:w-64 focus-within:border-primary focus-within:ring-[3px] focus-within:ring-primary/15">
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Pesquisar neste funil…"
            aria-label="Buscar negócios"
            className="w-full min-w-0 bg-transparent text-[13px] outline-none placeholder:text-muted-foreground"
          />
          <Search className="h-4 w-4 shrink-0 text-muted-foreground" />
        </div>
        <Select
          value={meus ? "meus" : soAtrasados ? "atrasados" : (modalidade ?? "todos")}
          onValueChange={(v) => {
            setMeus(v === "meus");
            setSoAtrasados(v === "atrasados");
            navigate({
              search: (s) => ({
                ...s,
                modalidade: v === "paga" || v === "cortesia" ? (v as Modalidade) : undefined,
              }),
              replace: true,
            });
          }}
        >
          <SelectTrigger className="h-9 w-auto gap-2 bg-card text-[13px] font-medium">
            <List className="h-3.5 w-3.5 text-primary" />
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Todos os negócios · {fmtNum((data ?? []).length)}</SelectItem>
            <SelectItem value="meus">Meus negócios</SelectItem>
            <SelectItem value="atrasados">Precisam de ação</SelectItem>
            <SelectItem value="paga">Pagos · {fmtNum(porModalidade.paga)}</SelectItem>
            <SelectItem value="cortesia">Cortesia · {fmtNum(porModalidade.cortesia)}</SelectItem>
          </SelectContent>
        </Select>
        <Popover>
          <PopoverTrigger asChild>
            <Button variant="outline" className="h-9 shrink-0 gap-2 bg-card px-3 text-[13px]">
              <Filter className="h-3.5 w-3.5" />
              Filtros
              {qtdFiltros ? (
                <span className="flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-primary px-1 text-[11px] font-semibold text-white">
                  {qtdFiltros}
                </span>
              ) : null}
            </Button>
          </PopoverTrigger>
          <PopoverContent
            align="start"
            className="max-h-[78vh] w-[min(94vw,380px)] overflow-y-auto p-0"
          >
            <SecaoFiltro titulo="Negócio" aberta>
              <div className="space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <Campo rotulo="Dono">
                    <MembroSelect valor={dono} onChange={setDono} incluirTodos placeholder="Dono" />
                  </Campo>
                  <Campo rotulo="Grupo">
                    <Select value={grupo} onValueChange={setGrupo}>
                      <SelectTrigger className="h-10">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="todos">Todos</SelectItem>
                        <SelectItem value="A">Grupo A</SelectItem>
                        <SelectItem value="B">Grupo B</SelectItem>
                        <SelectItem value="C">Grupo C</SelectItem>
                        <SelectItem value="sem">Sem empresa</SelectItem>
                      </SelectContent>
                    </Select>
                  </Campo>
                  <Campo rotulo="Origem">
                    <Select value={origem} onValueChange={setOrigem}>
                      <SelectTrigger className="h-10">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="todas">Todas</SelectItem>
                        {ORIGENS.map((o) => (
                          <SelectItem key={o.value} value={o.value}>
                            {o.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </Campo>
                  <Campo rotulo="Tipo">
                    <Select value={tipo} onValueChange={setTipo}>
                      <SelectTrigger className="h-10">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="todos">Todos</SelectItem>
                        {TIPOS_NEGOCIO.filter((t) => !t.funil || t.funil === funil).map((t) => (
                          <SelectItem key={t.value} value={t.value}>
                            {t.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </Campo>
                </div>
                <label className="flex items-center justify-between gap-3 rounded-lg border px-3 py-2.5 text-sm">
                  <span>
                    <span className="font-medium">Só atrasados</span>
                    <span className="block text-xs text-muted-foreground">
                      Sem próxima ação ou com a ação vencida
                    </span>
                  </span>
                  <Switch checked={soAtrasados} onCheckedChange={setSoAtrasados} />
                </label>
              </div>
            </SecaoFiltro>
            <SecaoFiltro titulo="Tags" contagem={tagsFiltro.length}>
              <div>
                <ListaTags
                  selecionadas={tagsFiltro}
                  contagem={contagemTags}
                  onAlternar={(id) =>
                    setTagsFiltro(
                      tagsFiltro.includes(id)
                        ? tagsFiltro.filter((x) => x !== id)
                        : [...tagsFiltro, id],
                    )
                  }
                />
              </div>
            </SecaoFiltro>
            <div className="flex items-center justify-between border-t px-4 py-2.5">
              <span className="text-xs text-muted-foreground">
                {qtdFiltros ? `${qtdFiltros} filtro(s) ativo(s)` : "Nenhum filtro"}
              </span>
              <button
                type="button"
                onClick={limparFiltros}
                className="text-xs font-semibold text-primary hover:underline"
              >
                Resetar
              </button>
            </div>
          </PopoverContent>
        </Popover>
      </BarraFerramentas>

      {filtrosAtivos ? (
        <div className="flex flex-wrap items-center gap-1.5">
          {modalidade ? (
            <ChipFiltro
              onTirar={() =>
                navigate({ search: (s) => ({ ...s, modalidade: undefined }), replace: true })
              }
            >
              {modalidade === "paga" ? "Pagos" : "Cortesia"}
            </ChipFiltro>
          ) : null}
          {dono ? (
            <ChipFiltro onTirar={() => setDono(null)}>Dono: {membro(dono)}</ChipFiltro>
          ) : null}
          {grupo !== "todos" ? (
            <ChipFiltro onTirar={() => setGrupo("todos")}>
              {grupo === "sem" ? "Sem empresa" : `Grupo ${grupo}`}
            </ChipFiltro>
          ) : null}
          {origem !== "todas" ? (
            <ChipFiltro onTirar={() => setOrigem("todas")}>{labelDe(ORIGENS, origem)}</ChipFiltro>
          ) : null}
          {tipo !== "todos" ? (
            <ChipFiltro onTirar={() => setTipo("todos")}>{labelDe(TIPOS_NEGOCIO, tipo)}</ChipFiltro>
          ) : null}
          {soAtrasados ? (
            <ChipFiltro onTirar={() => setSoAtrasados(false)}>Precisam de ação</ChipFiltro>
          ) : null}
          {meus ? <ChipFiltro onTirar={() => setMeus(false)}>Meus negócios</ChipFiltro> : null}
          {tagsFiltro.map((id) => (
            <ChipFiltro key={id} onTirar={() => setTagsFiltro(tagsFiltro.filter((x) => x !== id))}>
              {tag(id)?.nome ?? "Tag"}
            </ChipFiltro>
          ))}
          <button
            type="button"
            onClick={limparFiltros}
            className="ml-1 text-xs font-semibold text-primary hover:underline"
          >
            Limpar
          </button>
        </div>
      ) : null}

      {data && verIndicadores ? (
        <IndicadoresFunil lista={filtrados} etapas={etapas} modalidade={modalidade} />
      ) : null}

      {isLoading ? (
        <Carregando />
      ) : error ? (
        <Erro erro={error} />
      ) : modo === "kanban" ? (
        <div className="-mx-4 snap-x snap-mandatory overflow-x-auto scroll-px-4 px-4 pb-4 sm:-mx-6 sm:snap-none sm:px-6">
          <div className="flex min-w-max gap-3">
            {etapas.map((e) => {
              const todos = porEtapa.get(e.id) ?? [];
              const lista = todos.slice(
                0,
                e.tipo === "perdida" ? PERDIDOS_VISIVEIS : CARTOES_POR_COLUNA,
              );
              const total = todos.reduce((s, n) => s + (n.valor ?? 0), 0);
              return (
                <div
                  key={e.id}
                  onDragOver={(ev) => {
                    ev.preventDefault();
                    setSobre(e.id);
                  }}
                  onDragLeave={() => setSobre((s) => (s === e.id ? null : s))}
                  onDrop={(ev) => soltar(e.id, ev)}
                  className={cn(
                    "flex w-[84vw] max-w-[300px] shrink-0 snap-start flex-col rounded-xl bg-[#eef0f4] sm:w-[288px]",
                    sobre === e.id && "bg-primary/[0.07] ring-2 ring-primary/40",
                    e.tipo === "perdida" && "opacity-80",
                  )}
                >
                  <div className="px-3 pb-2 pt-3" title={e.criterio_entrada ?? e.acao_padrao ?? ""}>
                    <div className="flex items-center gap-2">
                      <p className="min-w-0 flex-1 truncate text-[13.5px] font-semibold">
                        {e.nome}
                      </p>
                      <span
                        className={cn(
                          "tabular rounded-md px-1.5 py-0.5 text-[11.5px] font-semibold",
                          e.tipo === "ganha"
                            ? "bg-emerald-100 text-emerald-700"
                            : "bg-primary/10 text-primary",
                        )}
                      >
                        {fmtNum(todos.length)}
                      </span>
                    </div>
                    <p className="tabular mt-0.5 text-[12px] text-muted-foreground">
                      {fmtMoeda(total)}
                    </p>
                    {e.tipo === "ganha" ? (
                      <span className="mt-2 block h-[3px] rounded-full bg-emerald-500" />
                    ) : e.tipo === "perdida" ? (
                      <span className="mt-2 block h-[3px] rounded-full bg-slate-300" />
                    ) : (
                      <span className="mt-2 block h-[3px] rounded-full bg-primary/60" />
                    )}
                  </div>
                  <div className="flex max-h-[calc(100dvh-220px)] flex-col gap-2 overflow-y-auto px-2 pb-2">
                    {lista.length ? (
                      lista.map((n) => (
                        <NegocioCartao key={n.id} n={n} onAbrir={() => abrir(n.id)} arrastavel />
                      ))
                    ) : (
                      <p className="p-3 text-center text-xs text-muted-foreground">Solte aqui</p>
                    )}
                    {todos.length > lista.length ? (
                      <p className="p-2 text-center text-[11px] text-muted-foreground">
                        +{fmtNum(todos.length - lista.length)}{" "}
                        {e.tipo === "perdida" ? "perdidos" : "nesta etapa"} (use os filtros ou a
                        lista)
                      </p>
                    ) : null}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ) : filtrados.length ? (
        <div className="overflow-x-auto rounded-xl border bg-card shadow-[var(--shadow-card)]">
          <table className="w-full min-w-[900px] text-sm">
            <thead className="bg-muted/50 text-left text-xs text-muted-foreground">
              <tr>
                <th className="px-3 py-2">Empresa / título</th>
                <th className="px-3 py-2">Etapa</th>
                <th className="px-3 py-2">Pessoa</th>
                <th className="px-3 py-2">Valor</th>
                <th className="px-3 py-2">Dono</th>
                <th className="px-3 py-2">Próxima ação</th>
                <th className="px-3 py-2">Criado</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {ordenados.map((n) => {
                const vermelho =
                  n.etapa_tipo === "aberta" && (atrasado(n.proxima_acao_em) || !n.proxima_acao_em);
                return (
                  <tr
                    key={n.id}
                    className="cursor-pointer hover:bg-muted/40"
                    onClick={() => abrir(n.id)}
                  >
                    <td className="px-3 py-2">
                      <span className="flex items-center gap-2 font-semibold">
                        {n.empresa_nome ?? n.titulo} <GrupoBadge grupo={n.empresa_grupo} />
                      </span>
                      {n.empresa_nome ? (
                        <span className="text-xs text-muted-foreground">{n.titulo}</span>
                      ) : null}
                    </td>
                    <td className="px-3 py-2">{n.etapa_nome}</td>
                    <td className="px-3 py-2">{n.pessoa_nome ?? "—"}</td>
                    <td className="px-3 py-2">{fmtMoeda(n.valor)}</td>
                    <td className="px-3 py-2">{membro(n.dono_id)}</td>
                    <td className={cn("px-3 py-2", vermelho && "font-semibold text-destructive")}>
                      {n.proxima_acao
                        ? `${n.proxima_acao} · ${prazoRelativo(n.proxima_acao_em)}`
                        : n.etapa_tipo === "aberta"
                          ? "Sem próxima ação"
                          : "—"}
                    </td>
                    <td className="px-3 py-2 text-muted-foreground">{fmtDia(n.created_at)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ) : (
        <Vazio>Nenhum negócio com esses filtros.</Vazio>
      )}

      <NegocioPainel id={search.negocio ?? null} onClose={() => abrir(null)} />
      <NegocioDialog
        aberto={novo}
        onClose={() => setNovo(false)}
        inicial={{ funil_id: funil }}
        onSalvo={(id) => abrir(id)}
      />
      {dialogo}
    </div>
  );
}

/** Indicadores do que está na tela: um painel só, com os números e a distribuição por etapa. */
function IndicadoresFunil({
  lista,
  etapas,
  modalidade,
}: {
  lista: NegocioCompleto[];
  etapas: { id: string; nome: string; tipo: string }[];
  modalidade?: Modalidade;
}) {
  const [foco, setFoco] = useState<string | null>(null);
  const r = useMemo(() => {
    const abertos = lista.filter((n) => n.etapa_tipo === "aberta");
    const ganhos = lista.filter((n) => n.etapa_tipo === "ganha");
    const perdidos = lista.filter((n) => n.etapa_tipo === "perdida");
    const soma = (l: NegocioCompleto[]) => l.reduce((s, n) => s + Number(n.valor ?? 0), 0);
    const fechados = ganhos.length + perdidos.length;
    const porEtapa = new Map<string, number>();
    for (const n of lista) porEtapa.set(n.etapa_id, (porEtapa.get(n.etapa_id) ?? 0) + 1);
    return {
      abertos: abertos.length,
      valorAberto: soma(abertos),
      ganhos: ganhos.length,
      valorGanho: soma(ganhos),
      recebido: soma(lista.filter((n) => n.status_pagamento === "pago")),
      perdidos: perdidos.length,
      conversao: fechados ? Math.round((ganhos.length / fechados) * 100) : null,
      ticket: ganhos.length && soma(ganhos) ? soma(ganhos) / ganhos.length : null,
      empresas: new Set(lista.map((n) => n.empresa_id).filter(Boolean)).size,
      atencao: abertos.filter((n) => !n.proxima_acao_em || atrasado(n.proxima_acao_em)).length,
      porEtapa,
    };
  }, [lista]);

  const cortesia = modalidade === "cortesia";
  const dinheiro = (v: number) => (v ? fmtMoeda(v) : "—");
  const segmentos = etapas
    .map((e) => ({ ...e, qtd: r.porEtapa.get(e.id) ?? 0 }))
    .filter((e) => e.qtd > 0);
  const total = segmentos.reduce((s, e) => s + e.qtd, 0);
  const abertas = etapas.filter((e) => e.tipo === "aberta");
  const tom = (e: { id: string; tipo: string; nome: string }) => {
    if (e.tipo === "ganha") return "bg-emerald-500";
    // Etapas de recuperação ficam com cor própria para não se confundirem com o caminho principal.
    if (e.nome === "Remarketing") return "bg-violet-500";
    if (e.nome === "Sem resposta") return "bg-amber-400";
    if (e.tipo === "perdida") return "bg-slate-300";
    const i = abertas.findIndex((x) => x.id === e.id);
    const opacidades = ["opacity-40", "opacity-55", "opacity-70", "opacity-85", "opacity-100"];
    return `bg-primary ${opacidades[Math.min(opacidades.length - 1, Math.max(0, i))]}`;
  };
  const destaque = segmentos.find((e) => e.id === foco);

  const numeros: { rotulo: string; valor: string; detalhe?: string; alerta?: boolean }[] = [
    {
      rotulo: "Em aberto",
      valor: fmtNum(r.abertos),
      detalhe: cortesia ? "em andamento" : dinheiro(r.valorAberto),
    },
    {
      rotulo: cortesia ? "Publicados" : "Ganhos",
      valor: fmtNum(r.ganhos),
      detalhe: cortesia ? undefined : dinheiro(r.valorGanho),
    },
    { rotulo: "Perdidos", valor: fmtNum(r.perdidos) },
    {
      rotulo: "Conversão",
      valor: r.conversao == null ? "—" : `${r.conversao}%`,
      detalhe: "ganhos ÷ fechados",
    },
    cortesia
      ? { rotulo: "Empresas", valor: fmtNum(r.empresas), detalhe: "em cortesia" }
      : {
          rotulo: "Recebido",
          valor: dinheiro(r.recebido),
          detalhe: r.ticket ? `ticket ${fmtMoeda(r.ticket)}` : undefined,
        },
    {
      rotulo: "Precisam de ação",
      valor: fmtNum(r.atencao),
      detalhe: "sem ação ou atrasados",
      alerta: r.atencao > 0,
    },
  ];

  return (
    <FaixaNumeros
      itens={numeros.map((x) => ({ ...x, tom: x.alerta ? ("alerta" as const) : undefined }))}
    >
      {total ? (
        <figure className="border-t px-3 py-3 sm:px-4" onMouseLeave={() => setFoco(null)}>
          <figcaption className="mb-2 flex justify-between gap-2 text-[11.5px] text-muted-foreground">
            <span>{fmtNum(lista.length)} negócios por etapa</span>
            <span className="truncate font-medium text-foreground">
              {destaque
                ? `${destaque.nome}: ${fmtNum(destaque.qtd)} (${Math.round((destaque.qtd / total) * 100)}%)`
                : null}
            </span>
          </figcaption>
          <div className="flex h-2.5 w-full gap-[2px] overflow-hidden rounded-full">
            {segmentos.map((e) => (
              <div
                key={e.id}
                className={cn(
                  "h-full transition-opacity",
                  tom(e),
                  foco && foco !== e.id && "opacity-30",
                )}
                style={{ width: `${(e.qtd / total) * 100}%` }}
                onMouseEnter={() => setFoco(e.id)}
                title={`${e.nome}: ${e.qtd}`}
              />
            ))}
          </div>
          <ul className="mt-2.5 hidden flex-wrap gap-x-3.5 gap-y-1 text-[11px] text-muted-foreground sm:flex">
            {segmentos.map((e) => (
              <li
                key={e.id}
                className="flex items-center gap-1.5"
                onMouseEnter={() => setFoco(e.id)}
              >
                <span className={cn("h-2 w-2 rounded-full", tom(e))} />
                {e.nome}{" "}
                <span className="tabular font-semibold text-foreground">{fmtNum(e.qtd)}</span>
              </li>
            ))}
          </ul>
        </figure>
      ) : null}
    </FaixaNumeros>
  );
}

/** Seção recolhível do painel de filtros (como "Negócio", "Tags"). */
function SecaoFiltro({
  titulo,
  contagem,
  aberta,
  children,
}: {
  titulo: string;
  contagem?: number;
  aberta?: boolean;
  children: React.ReactNode;
}) {
  const [on, setOn] = useState(!!aberta);
  return (
    <div className="border-b last:border-b-0">
      <button
        type="button"
        onClick={() => setOn((x) => !x)}
        className="flex w-full items-center gap-2 px-4 py-3 text-left text-[13px] font-semibold hover:bg-muted/50"
      >
        <span className="flex-1">{titulo}</span>
        {contagem ? (
          <span className="rounded-full bg-primary/10 px-1.5 text-[11px] font-semibold text-primary">
            {contagem}
          </span>
        ) : null}
        <ChevronDown
          className={cn("h-4 w-4 text-muted-foreground transition", on && "rotate-180")}
        />
      </button>
      {on ? <div className="px-4 pb-4">{children}</div> : null}
    </div>
  );
}

const CORES_VERTICAL = ["#1f5eff", "#12875a", "#c6a15b", "#6c4ae6", "#d6404a", "#0e9791"];
function sigla(nome: string) {
  return nome
    .split(/\s+/)
    .filter((p) => p.length > 2)
    .slice(0, 2)
    .map((p) => p[0])
    .join("")
    .toUpperCase();
}

/** Escolha do funil, no lugar do título: "VERTICAL → Funil", abre a lista por vertical com busca. */
function SeletorFunil({
  verticais,
  funil,
  onEscolher,
}: {
  verticais: {
    nome: string;
    funis: { id: CrmFunilId; nome: string; descricao: string | null }[];
  }[];
  funil: CrmFunilId;
  onEscolher: (id: CrmFunilId) => void;
}) {
  const [aberto, setAberto] = useState(false);
  const [q, setQ] = useState("");
  const todos = verticais.flatMap((v, i) =>
    v.funis.map((f) => ({
      ...f,
      vertical: v.nome,
      cor: CORES_VERTICAL[i % CORES_VERTICAL.length],
    })),
  );
  const f = todos.find((x) => x.id === funil);
  const busca = q.trim().toLowerCase();
  return (
    <Popover open={aberto} onOpenChange={setAberto}>
      <PopoverTrigger asChild>
        <button
          type="button"
          className="flex h-9 min-w-0 max-w-full items-center gap-2 rounded-lg border bg-card px-2.5 text-left transition hover:border-primary/40"
        >
          <span
            className="flex h-5 min-w-5 shrink-0 items-center justify-center rounded px-1 text-[10px] font-bold text-white"
            style={{ background: f?.cor ?? "#1f5eff" }}
          >
            {sigla(f?.vertical ?? "Funil")}
          </span>
          <span className="hidden truncate text-[12.5px] font-semibold uppercase tracking-wide text-muted-foreground sm:inline">
            {f?.vertical ?? "Funil"}
          </span>
          <ChevronRight className="hidden h-3.5 w-3.5 shrink-0 text-muted-foreground sm:inline" />
          <span className="truncate text-[14px] font-semibold">{f?.nome ?? funil}</span>
          <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground" />
        </button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-[min(94vw,420px)] p-0">
        <div className="border-b p-2">
          <div className="flex h-9 items-center gap-2 rounded-md border px-2.5 focus-within:border-primary">
            <Search className="h-4 w-4 text-muted-foreground" />
            <input
              autoFocus
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Buscar funis e verticais…"
              className="w-full bg-transparent text-[13px] outline-none"
            />
          </div>
        </div>
        <div className="max-h-[60vh] overflow-y-auto p-1.5">
          <p className="px-2.5 pb-1 pt-1.5 text-[10.5px] font-semibold uppercase tracking-wide text-muted-foreground">
            Verticais e funis
          </p>
          {verticais.map((v, vi) => {
            const lista = v.funis.filter(
              (x) =>
                !busca ||
                x.nome.toLowerCase().includes(busca) ||
                v.nome.toLowerCase().includes(busca),
            );
            if (!lista.length) return null;
            return (
              <div key={v.nome} className="py-1">
                <p className="flex items-center gap-2 px-2.5 pb-1 pt-1 text-[12px] font-bold uppercase tracking-wide">
                  <span
                    className="flex h-5 min-w-5 items-center justify-center rounded px-1 text-[10px] font-bold text-white"
                    style={{ background: CORES_VERTICAL[vi % CORES_VERTICAL.length] }}
                  >
                    {sigla(v.nome)}
                  </span>
                  <span className="flex-1">{v.nome}</span>
                  <span className="text-[11px] font-normal normal-case text-muted-foreground">
                    {v.funis.length} funis
                  </span>
                </p>
                {lista.map((x) => (
                  <button
                    key={x.id}
                    type="button"
                    onClick={() => {
                      setAberto(false);
                      setQ("");
                      onEscolher(x.id);
                    }}
                    className={cn(
                      "flex w-full items-center gap-2 rounded-md py-1.5 pl-9 pr-2.5 text-left hover:bg-muted",
                      x.id === funil && "bg-primary/[0.07]",
                    )}
                  >
                    <span className="min-w-0 flex-1">
                      <span
                        className={cn(
                          "block truncate text-[13px]",
                          x.id === funil && "font-semibold text-primary",
                        )}
                      >
                        {x.nome}
                      </span>
                    </span>
                    {x.id === funil ? <Check className="h-4 w-4 text-primary" /> : null}
                  </button>
                ))}
              </div>
            );
          })}
        </div>
      </PopoverContent>
    </Popover>
  );
}
