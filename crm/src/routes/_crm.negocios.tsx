import { useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { LayoutGrid, List, Plus } from "lucide-react";
import { z } from "zod";

import { useCrm } from "@/components/crm/context";
import {
  NegocioCartao,
  NegocioDialog,
  NegocioPainel,
  useMoverEtapa,
} from "@/components/crm/negocio";
import { MembroSelect } from "@/components/crm/pickers";
import { FiltroTags, TagChip } from "@/components/crm/tags";
import {
  BotaoCsv,
  CabecalhoPagina,
  Carregando,
  Erro,
  GrupoBadge,
  Numero,
  Vazio,
} from "@/components/crm/ui";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
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
  funil: z.enum(["materia", "publicidade", "parcerias"]).optional(),
  modalidade: z.enum(["paga", "cortesia"]).optional(),
  tags: z.array(z.string()).max(20).optional(),
  negocio: z.string().optional(),
});

export const Route = createFileRoute("/_crm/negocios")({
  validateSearch: busca,
  component: NegociosPage,
});

const PERDIDOS_VISIVEIS = 20;

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

  const filtrosAtivos =
    !!modalidade ||
    tagsFiltro.length > 0 ||
    !!dono ||
    grupo !== "todos" ||
    origem !== "todas" ||
    tipo !== "todos" ||
    soAtrasados ||
    !!q.trim();
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
        descricao="Arraste o cartão para mudar a etapa: o CRM registra a mudança e cria a tarefa da etapa. Cartão vermelho = sem ação ou ação vencida."
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
              <Plus className="mr-1.5 h-4 w-4" /> Novo negócio
            </Button>
          </>
        }
      />

      <div className="flex flex-wrap items-center gap-3">
        <Tabs
          value={funil}
          onValueChange={(v) =>
            navigate({
              search: { funil: v as CrmFunilId, modalidade: search.modalidade, tags: search.tags },
            })
          }
        >
          <TabsList className="h-10 w-full justify-start overflow-x-auto sm:w-auto">
            {funis
              .filter((f) => f.ativo)
              .map((f) => (
                <TabsTrigger key={f.id} value={f.id}>
                  {f.nome}
                </TabsTrigger>
              ))}
          </TabsList>
        </Tabs>
        <Tabs
          value={modalidade ?? "todos"}
          onValueChange={(v) =>
            navigate({
              search: (s) => ({ ...s, modalidade: v === "todos" ? undefined : (v as Modalidade) }),
              replace: true,
            })
          }
        >
          <TabsList className="h-10" aria-label="Pagos ou cortesia">
            <TabsTrigger value="todos">Todos ({fmtNum((data ?? []).length)})</TabsTrigger>
            <TabsTrigger value="paga">Pagos ({fmtNum(porModalidade.paga)})</TabsTrigger>
            <TabsTrigger value="cortesia">Cortesia ({fmtNum(porModalidade.cortesia)})</TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-[1.5fr_1fr_0.7fr_1fr_1fr_auto_auto_auto]">
        <Input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Filtrar por empresa, pessoa ou título"
          className="h-10"
        />
        <MembroSelect valor={dono} onChange={setDono} incluirTodos placeholder="Dono" />
        <Select value={grupo} onValueChange={setGrupo}>
          <SelectTrigger className="h-10">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Todos os grupos</SelectItem>
            <SelectItem value="A">Grupo A</SelectItem>
            <SelectItem value="B">Grupo B</SelectItem>
            <SelectItem value="C">Grupo C</SelectItem>
            <SelectItem value="sem">Sem empresa</SelectItem>
          </SelectContent>
        </Select>
        <Select value={origem} onValueChange={setOrigem}>
          <SelectTrigger className="h-10">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="todas">Todas as origens</SelectItem>
            {ORIGENS.map((o) => (
              <SelectItem key={o.value} value={o.value}>
                {o.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={tipo} onValueChange={setTipo}>
          <SelectTrigger className="h-10">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Todos os tipos</SelectItem>
            {TIPOS_NEGOCIO.filter((t) => !t.funil || t.funil === funil).map((t) => (
              <SelectItem key={t.value} value={t.value}>
                {t.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <FiltroTags selecionadas={tagsFiltro} onChange={setTagsFiltro} />
        <Button
          variant={soAtrasados ? "default" : "outline"}
          className="h-10"
          onClick={() => setSoAtrasados((v) => !v)}
        >
          Atrasados
        </Button>
        <div className="flex rounded-md border">
          <Button
            variant={modo === "kanban" ? "secondary" : "ghost"}
            className="h-10 rounded-r-none"
            onClick={() => setModo("kanban")}
            aria-label="Kanban"
          >
            <LayoutGrid className="h-4 w-4" />
          </Button>
          <Button
            variant={modo === "lista" ? "secondary" : "ghost"}
            className="h-10 rounded-l-none"
            onClick={() => setModo("lista")}
            aria-label="Lista"
          >
            <List className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {data ? (
        <IndicadoresFunil
          lista={filtrados}
          etapas={etapas}
          modalidade={modalidade}
          filtrosAtivos={filtrosAtivos}
          onLimpar={limparFiltros}
          tagsFiltro={tagsFiltro}
          onTag={(id) =>
            setTagsFiltro(
              tagsFiltro.includes(id) ? tagsFiltro.filter((x) => x !== id) : [...tagsFiltro, id],
            )
          }
        />
      ) : null}

      {isLoading ? (
        <Carregando />
      ) : error ? (
        <Erro erro={error} />
      ) : modo === "kanban" ? (
        <div className="-mx-4 overflow-x-auto px-4 pb-4 sm:mx-0 sm:px-0">
          <div className="flex min-w-max gap-3">
            {etapas.map((e) => {
              const todos = porEtapa.get(e.id) ?? [];
              const lista = e.tipo === "perdida" ? todos.slice(0, PERDIDOS_VISIVEIS) : todos;
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
                    "flex w-[272px] shrink-0 flex-col rounded-[var(--radius)] border bg-muted/40",
                    sobre === e.id && "border-primary bg-primary/5",
                    e.tipo === "ganha" && "bg-emerald-50/60 dark:bg-emerald-950/20",
                    e.tipo === "perdida" && "opacity-80",
                  )}
                >
                  <div className="border-b px-3 py-2.5">
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-sm font-bold">
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
                        +{todos.length - lista.length} perdidos (veja na lista)
                      </p>
                    ) : null}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ) : filtrados.length ? (
        <div className="overflow-x-auto rounded-[var(--radius)] border bg-card">
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

/** Indicadores do que está na tela: mudam junto com o funil, o seletor Pagos/Cortesia e os filtros. */
function IndicadoresFunil({
  lista,
  etapas,
  modalidade,
  filtrosAtivos,
  onLimpar,
  tagsFiltro,
  onTag,
}: {
  tagsFiltro: string[];
  onTag: (id: string) => void;
  lista: NegocioCompleto[];
  etapas: { id: string; nome: string; tipo: string }[];
  modalidade?: Modalidade;
  filtrosAtivos: boolean;
  onLimpar: () => void;
}) {
  const [foco, setFoco] = useState<string | null>(null);
  const { tagsAtivas } = useCrm();
  const contagemTags = useMemo(() => {
    const c = new Map<string, number>();
    for (const n of lista) for (const t of n.tags ?? []) c.set(t, (c.get(t) ?? 0) + 1);
    return c;
  }, [lista]);
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
    if (e.tipo === "perdida") return "bg-muted-foreground/40";
    const i = abertas.findIndex((x) => x.id === e.id);
    const opacidades = ["opacity-40", "opacity-55", "opacity-70", "opacity-85", "opacity-100"];
    return `bg-primary ${opacidades[Math.min(opacidades.length - 1, Math.max(0, i))]}`;
  };
  const destaque = segmentos.find((e) => e.id === foco);

  return (
    <section className="space-y-3" aria-label="Indicadores do funil">
      <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
        <span>
          {fmtNum(lista.length)} negócio(s){" "}
          {modalidade ? (cortesia ? "de cortesia" : "pagos") : "pagos e cortesia"}
          {filtrosAtivos ? " com os filtros aplicados" : ""}
        </span>
        {filtrosAtivos ? (
          <button
            type="button"
            className="font-semibold text-primary hover:underline"
            onClick={onLimpar}
          >
            Limpar filtros
          </button>
        ) : null}
      </div>
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
        <Numero
          rotulo="Em aberto"
          valor={fmtNum(r.abertos)}
          detalhe={cortesia ? "em andamento" : `${dinheiro(r.valorAberto)} em negociação`}
          destaque="azul"
        />
        <Numero
          rotulo={cortesia ? "Publicados / fechados" : "Ganhos"}
          valor={fmtNum(r.ganhos)}
          detalhe={cortesia ? undefined : dinheiro(r.valorGanho)}
        />
        <Numero rotulo="Perdidos" valor={fmtNum(r.perdidos)} />
        <Numero
          rotulo="Conversão"
          valor={r.conversao == null ? "—" : `${r.conversao}%`}
          detalhe="ganhos ÷ fechados"
        />
        {cortesia ? (
          <Numero rotulo="Empresas" valor={fmtNum(r.empresas)} detalhe="atendidas em cortesia" />
        ) : (
          <Numero
            rotulo="Recebido"
            valor={dinheiro(r.recebido)}
            detalhe={r.ticket ? `ticket médio ${fmtMoeda(r.ticket)}` : undefined}
          />
        )}
        <Numero
          rotulo="Precisam de ação"
          valor={fmtNum(r.atencao)}
          detalhe="sem próxima ação ou atrasados"
          destaque={r.atencao ? "alerta" : undefined}
        />
      </div>
      {total ? (
        <figure
          className="rounded-[var(--radius)] border bg-card p-3"
          onMouseLeave={() => setFoco(null)}
        >
          <figcaption className="mb-2 flex justify-between text-xs text-muted-foreground">
            <span>Distribuição por etapa</span>
            <span className="font-medium text-foreground">
              {destaque
                ? `${destaque.nome}: ${fmtNum(destaque.qtd)} (${Math.round((destaque.qtd / total) * 100)}%)`
                : "passe o mouse para ver cada etapa"}
            </span>
          </figcaption>
          <div className="flex h-3 w-full gap-[2px] overflow-hidden rounded-full">
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
          <ul className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-muted-foreground">
            {segmentos.map((e) => (
              <li
                key={e.id}
                className="flex items-center gap-1.5"
                onMouseEnter={() => setFoco(e.id)}
              >
                <span className={cn("h-2 w-2 rounded-full", tom(e))} />
                {e.nome} <span className="font-semibold text-foreground">{fmtNum(e.qtd)}</span>
              </li>
            ))}
          </ul>
        </figure>
      ) : null}
      {tagsAtivas.length ? (
        <div className="flex flex-wrap items-center gap-1.5 rounded-[var(--radius)] border bg-card p-3">
          <span className="mr-1 text-xs text-muted-foreground">Tags neste recorte:</span>
          {tagsAtivas.map((t) => (
            <TagChip
              key={t.id}
              tag={t}
              ativa={tagsFiltro.includes(t.id) || (contagemTags.get(t.id) ?? 0) > 0}
              selecionada={tagsFiltro.includes(t.id)}
              sufixo={` ${fmtNum(contagemTags.get(t.id) ?? 0)}`}
              onClick={() => onTag(t.id)}
            />
          ))}
        </div>
      ) : null}
    </section>
  );
}
