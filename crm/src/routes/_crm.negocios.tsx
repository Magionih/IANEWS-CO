import { useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  Check,
  ChevronsUpDown,
  KanbanSquare,
  LayoutGrid,
  List,
  Plus,
  Search,
  SlidersHorizontal,
} from "lucide-react";
import { z } from "zod";

import { useCrm } from "@/components/crm/context";
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
  const { funis, etapasDo, membro, funilNome, tag } = useCrm();
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
  const [novo, setNovo] = useState(false);
  const [sobre, setSobre] = useState<string | null>(null);

  const { data, isLoading, error } = useQuery({
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
          (grupo === "todos" || (n.empresa_grupo ?? "sem") === grupo) &&
          (origem === "todas" || n.origem === origem) &&
          (tipo === "todos" || n.tipo === tipo) &&
          (!soAtrasados ||
            (n.etapa_tipo === "aberta" && (atrasado(n.proxima_acao_em) || !n.proxima_acao_em))) &&
          contem([n.titulo, n.empresa_nome, n.pessoa_nome, n.proxima_acao], q),
      ),
    [data, modalidade, tagsFiltro, dono, grupo, origem, tipo, soAtrasados, q],
  );

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
    (soAtrasados ? 1 : 0);
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
    navigate({ search: (s) => ({ ...s, modalidade: undefined, tags: undefined }), replace: true });
  };

  const porEtapa = useMemo(() => {
    const m = new Map<string, NegocioCompleto[]>();
    for (const n of filtrados) m.set(n.etapa_id, [...(m.get(n.etapa_id) ?? []), n]);
    return m;
  }, [filtrados]);

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
        titulo="Negócios"
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
              <Plus className="h-4 w-4" /> Novo negócio
            </Button>
          </>
        }
      />

      {/* Barra única: funil, busca, filtros e modo de visualização. */}
      <div className="flex flex-col gap-2 lg:flex-row lg:items-center">
        <SeletorFunil
          verticais={verticais}
          funil={funil}
          onEscolher={(id) =>
            navigate({ search: { funil: id, modalidade: search.modalidade, tags: search.tags } })
          }
        />
        <div className="flex min-w-0 flex-1 items-center gap-2">
          <div className="flex h-10 min-w-0 flex-1 items-center gap-2 rounded-lg border bg-card px-3 shadow-[0_1px_2px_rgb(16_24_40/0.04)] focus-within:border-primary focus-within:ring-[3px] focus-within:ring-primary/15">
            <Search className="h-4 w-4 shrink-0 text-muted-foreground" />
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Buscar empresa, pessoa ou título"
              aria-label="Buscar negócios"
              className="w-full min-w-0 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
            />
          </div>
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" className="h-10 shrink-0 px-3">
                <SlidersHorizontal className="h-4 w-4" />
                <span className="hidden sm:inline">Filtros</span>
                {qtdFiltros ? (
                  <span className="rounded-full bg-primary px-1.5 text-[11px] font-semibold text-white">
                    {qtdFiltros}
                  </span>
                ) : null}
              </Button>
            </PopoverTrigger>
            <PopoverContent
              align="end"
              className="max-h-[78vh] w-[min(94vw,380px)] overflow-y-auto p-4"
            >
              <div className="space-y-3">
                <Campo rotulo="Modalidade">
                  <Alternador
                    className="w-full [&>button]:flex-1 [&>button]:justify-center"
                    valor={modalidade ?? "todos"}
                    onChange={(v) =>
                      navigate({
                        search: (s) => ({
                          ...s,
                          modalidade: v === "todos" ? undefined : (v as Modalidade),
                        }),
                        replace: true,
                      })
                    }
                    opcoes={[
                      { valor: "todos", rotulo: `Todos ${fmtNum((data ?? []).length)}` },
                      { valor: "paga", rotulo: `Pagos ${fmtNum(porModalidade.paga)}` },
                      { valor: "cortesia", rotulo: `Cortesia ${fmtNum(porModalidade.cortesia)}` },
                    ]}
                  />
                </Campo>
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
                <div>
                  <p className="mb-1.5 text-xs font-semibold">Tags</p>
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
                {filtrosAtivos ? (
                  <Button variant="ghost" className="w-full text-primary" onClick={limparFiltros}>
                    Limpar todos os filtros
                  </Button>
                ) : null}
              </div>
            </PopoverContent>
          </Popover>
          <Alternador
            valor={modo}
            onChange={setModo}
            opcoes={[
              { valor: "kanban", icone: LayoutGrid, titulo: "Quadro" },
              { valor: "lista", icone: List, titulo: "Lista" },
            ]}
          />
        </div>
      </div>

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
            <ChipFiltro onTirar={() => setSoAtrasados(false)}>Só atrasados</ChipFiltro>
          ) : null}
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

      {data ? <IndicadoresFunil lista={filtrados} etapas={etapas} modalidade={modalidade} /> : null}

      {isLoading ? (
        <Carregando />
      ) : error ? (
        <Erro erro={error} />
      ) : modo === "kanban" ? (
        <div className="-mx-4 snap-x snap-mandatory overflow-x-auto scroll-px-4 px-4 pb-4 sm:mx-0 sm:snap-none sm:px-0">
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
                    "flex w-[84vw] max-w-[300px] shrink-0 snap-start flex-col rounded-xl border bg-[#eef1f5]/70 sm:w-[280px]",
                    sobre === e.id && "border-primary bg-primary/5",
                    e.tipo === "ganha" && "bg-emerald-50/60 dark:bg-emerald-950/20",
                    e.tipo === "perdida" && "opacity-80",
                  )}
                >
                  <div className="border-b px-3 py-2.5">
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-[13px] font-semibold">
                        {e.ordem < 90 ? `${e.ordem}. ` : ""}
                        {e.nome}
                      </p>
                      <span className="rounded-full bg-card px-2 py-0.5 text-xs font-semibold">
                        {todos.length}
                      </span>
                    </div>
                    <p
                      className="mt-0.5 line-clamp-1 text-[11px] text-muted-foreground"
                      title={e.criterio_entrada ?? ""}
                    >
                      {e.acao_padrao
                        ? `${e.acao_padrao}${e.prazo_dias != null ? ` · ${e.prazo_dias}d` : ""}`
                        : (e.criterio_entrada ?? "")}
                    </p>
                    {total ? (
                      <p className="text-[11px] font-semibold text-primary">{fmtMoeda(total)}</p>
                    ) : null}
                  </div>
                  <div className="flex max-h-[68vh] flex-col gap-2 overflow-y-auto p-2">
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
              {filtrados.map((n) => {
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

/** Escolha do funil: um botão com o funil atual que abre a lista por vertical. */
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
  const atual = verticais.flatMap((v) => v.funis.map((f) => ({ ...f, vertical: v.nome })));
  const f = atual.find((x) => x.id === funil);
  return (
    <Popover open={aberto} onOpenChange={setAberto}>
      <PopoverTrigger asChild>
        <button
          type="button"
          className="flex h-10 min-w-0 items-center gap-2.5 rounded-lg border bg-card px-3 text-left shadow-[0_1px_2px_rgb(16_24_40/0.04)] transition hover:border-primary/40 lg:w-72"
        >
          <KanbanSquare className="h-4 w-4 shrink-0 text-primary" />
          <span className="min-w-0 flex-1 leading-tight">
            <span className="block truncate text-[11px] text-muted-foreground">
              {f?.vertical ?? "Funil"}
            </span>
            <span className="block truncate text-[13px] font-semibold">{f?.nome ?? funil}</span>
          </span>
          <ChevronsUpDown className="h-4 w-4 shrink-0 text-muted-foreground" />
        </button>
      </PopoverTrigger>
      <PopoverContent
        align="start"
        className="max-h-[70vh] w-[min(94vw,340px)] overflow-y-auto p-1.5"
      >
        {verticais.map((v) => (
          <div key={v.nome} className="py-1">
            <p className="px-2.5 pb-1 pt-1.5 text-[11px] font-semibold text-muted-foreground">
              {v.nome}
            </p>
            {v.funis.map((x) => (
              <button
                key={x.id}
                type="button"
                onClick={() => {
                  setAberto(false);
                  onEscolher(x.id);
                }}
                className={cn(
                  "flex w-full items-start gap-2 rounded-md px-2.5 py-2 text-left hover:bg-muted",
                  x.id === funil && "bg-primary/[0.07]",
                )}
              >
                <span className="min-w-0 flex-1">
                  <span
                    className={cn(
                      "block text-[13px] font-medium",
                      x.id === funil && "text-primary",
                    )}
                  >
                    {x.nome}
                  </span>
                  {x.descricao ? (
                    <span className="block truncate text-[11px] text-muted-foreground">
                      {x.descricao}
                    </span>
                  ) : null}
                </span>
                {x.id === funil ? <Check className="mt-0.5 h-4 w-4 text-primary" /> : null}
              </button>
            ))}
          </div>
        ))}
      </PopoverContent>
    </Popover>
  );
}
