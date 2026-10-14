import { useEffect, useMemo, useState } from "react";
import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  ArrowUpRight,
  Check,
  ChevronDown,
  ExternalLink,
  GitCompare,
  Search,
  SlidersHorizontal,
  Star,
  TrendingDown,
  TrendingUp,
  Minus,
  X,
} from "lucide-react";
import { toast } from "sonner";

import { SiteHeader } from "@/components/site/header";
import { SiteFooter } from "@/components/site/footer";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { LeadCta } from "@/components/site/lead-cta";
import { cn } from "@/lib/utils";
import { useAuth } from "@/hooks/use-auth";
import { listAiTools, getMyToolRatings, rateAiTool, type AiTool } from "@/lib/ai-ranking.functions";

type Search = { area?: string; cat?: string; q?: string; all?: boolean; maker?: string };

const AREAS = [
  { key: "semanal", label: "Ranking do dia" },
  { key: "geral", label: "Conhecimento Geral" },
  { key: "contabilidade", label: "Contabilidade" },
  { key: "juridico", label: "Jurídico" },
  { key: "literatura", label: "Literatura Brasileira" },
  { key: "medicina", label: "Medicina" },
  { key: "avaliacao", label: "Nota dos leitores" },
] as const;

const CATEGORIES = [
  { key: "todas", label: "Todas as categorias" },
  { key: "chat", label: "Assistentes / Chat" },
  { key: "codigo", label: "Programação" },
  { key: "imagem", label: "Imagem" },
  { key: "video", label: "Vídeo" },
  { key: "audio", label: "Áudio e voz" },
  { key: "produtividade", label: "Produtividade" },
  { key: "negocios", label: "Negócios" },
  { key: "pesquisa", label: "Pesquisa" },
] as const;

function scoreFor(tool: AiTool, area: string) {
  if (area === "semanal") return tool.weekly_score;
  if (area === "avaliacao") return tool.ratings_avg * 2;
  return tool.scores?.[area] ?? tool.base_score;
}

function logoSources(m: AiTool) {
  const sources: string[] = [];
  if (m.icon) sources.push(`https://cdn.simpleicons.org/${m.icon}`);
  let host = "";
  try {
    host = new URL(m.website).hostname.replace(/^www\./, "");
  } catch {
    host = "";
  }
  if (host) {
    sources.push(`https://logo.clearbit.com/${host}`);
    sources.push(`https://www.google.com/s2/favicons?sz=128&domain=${host}`);
  }
  return sources;
}

function ModelLogo({ m, size = 28 }: { m: AiTool; size?: number }) {
  const sources = useMemo(() => logoSources(m), [m.icon, m.website]);
  const [index, setIndex] = useState(0);

  useEffect(() => {
    setIndex(0);
  }, [m.id]);

  const src = sources[index];

  if (!src) {
    return (
      <span
        className="grid shrink-0 place-items-center rounded-lg text-xs font-extrabold text-white"
        style={{ width: size, height: size, background: m.brand }}
        aria-hidden="true"
      >
        {m.maker.charAt(0)}
      </span>
    );
  }
  return (
    <span
      className="grid shrink-0 place-items-center rounded-lg bg-white ring-1 ring-inset ring-border/60"
      style={{ width: size, height: size }}
    >
      <img
        src={src}
        alt={`Logomarca ${m.maker}`}
        loading="lazy"
        width={Math.round(size * 0.68)}
        height={Math.round(size * 0.68)}
        style={{ width: size * 0.68, height: size * 0.68, objectFit: "contain" }}
        onError={() => setIndex((i) => i + 1)}
      />
    </span>
  );
}

function Stars({
  value,
  onChange,
  size = 20,
}: {
  value: number;
  onChange?: (v: number) => void;
  size?: number;
}) {
  return (
    <span className="inline-flex items-center gap-0.5">
      {[1, 2, 3, 4, 5].map((n) => {
        const filled = n <= Math.round(value);
        const star = (
          <Star
            className={cn(filled ? "fill-current" : "opacity-30")}
            style={{ width: size, height: size, color: "var(--color-gold, #F5A623)" }}
          />
        );
        return onChange ? (
          <button
            key={n}
            type="button"
            aria-label={`Dar nota ${n}`}
            onClick={() => onChange(n)}
            className="transition-transform hover:scale-110"
          >
            {star}
          </button>
        ) : (
          <span key={n}>{star}</span>
        );
      })}
    </span>
  );
}

function TrendBadge({ tool }: { tool: AiTool }) {
  const delta = tool.previous_position > 0 ? tool.previous_position - tool.rank_position : 0;
  if (delta === 0) {
    return (
      <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
        <Minus className="h-3 w-3" /> estável
      </span>
    );
  }
  const up = delta > 0;
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 text-xs font-semibold",
        up ? "text-emerald-500" : "text-rose-500",
      )}
    >
      {up ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
      {up ? "+" : ""}
      {delta}
    </span>
  );
}

function FilterMenu({
  label,
  value,
  options,
  active,
  onSelect,
  icon,
}: {
  label: string;
  value: string;
  options: { key: string; label: string }[];
  active: string;
  onSelect: (key: string) => void;
  icon?: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          className="inline-flex h-11 max-w-[15rem] items-center gap-2 rounded-full bg-secondary/50 px-4 text-xs font-semibold text-foreground/80 ring-1 ring-inset ring-border/70 transition-colors hover:text-foreground"
        >
          {icon}
          <span className="text-muted-foreground">{label}:</span>
          <span className="truncate">{value}</span>
          <ChevronDown className={cn("h-3.5 w-3.5 transition-transform", open && "rotate-180")} />
        </button>
      </PopoverTrigger>
      <PopoverContent align="start" className="max-h-72 w-64 overflow-y-auto p-1">
        {options.map((o) => (
          <button
            key={o.key}
            type="button"
            onClick={() => {
              onSelect(o.key);
              setOpen(false);
            }}
            className={cn(
              "flex w-full items-center justify-between gap-2 rounded-lg px-3 py-2 text-left text-sm transition-colors hover:bg-secondary",
              active === o.key && "font-semibold text-primary",
            )}
          >
            <span className="truncate">{o.label}</span>
            {active === o.key ? <Check className="h-4 w-4 shrink-0" /> : null}
          </button>
        ))}
      </PopoverContent>
    </Popover>
  );
}

function CompareDialog({
  tools,
  open,
  onClose,
  onClear,
}: {
  tools: AiTool[];
  open: boolean;
  onClose: () => void;
  onClear: () => void;
}) {
  const rows: { label: string; get: (t: AiTool) => string }[] = [
    { label: "Fabricante", get: (t) => t.maker },
    { label: "Posição no ranking", get: (t) => `#${t.rank_position}` },
    { label: "Nota do dia", get: (t) => t.weekly_score.toFixed(2) },
    { label: "Nota técnica", get: (t) => t.base_score.toFixed(2) },
    { label: "Repercussão", get: (t) => t.buzz_score.toFixed(2) },
    {
      label: "Leitores",
      get: (t) => (t.ratings_count > 0 ? `${t.ratings_avg.toFixed(1)}/5 (${t.ratings_count})` : "sem notas"),
    },
    { label: "Contexto", get: (t) => t.context_window || "—" },
    { label: "Preço", get: (t) => t.pricing || "—" },
    { label: "Desde", get: (t) => t.released || "—" },
    { label: "Ponto forte", get: (t) => t.pros[0] ?? "—" },
    { label: "Atenção", get: (t) => t.cons[0] ?? "—" },
  ];

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle>Comparar ferramentas</DialogTitle>
          <DialogDescription>
            Comparativo lado a lado com desempenho técnico, repercussão do dia e nota dos leitores.
          </DialogDescription>
        </DialogHeader>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[520px] text-left text-sm">
            <thead>
              <tr>
                <th className="w-36 py-3 pr-3 text-xs uppercase tracking-wide text-muted-foreground">
                  Critério
                </th>
                {tools.map((t) => (
                  <th key={t.id} className="py-3 pr-3">
                    <span className="flex items-center gap-2">
                      <ModelLogo m={t} size={30} />
                      <span className="font-bold leading-tight">{t.name}</span>
                    </span>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.label} className="border-t border-border/50">
                  <th scope="row" className="py-3 pr-3 text-xs font-semibold text-muted-foreground">
                    {r.label}
                  </th>
                  {tools.map((t) => (
                    <td key={t.id} className="py-3 pr-3 align-top text-foreground/85">
                      {r.get(t)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <LeadCta
          variant="inline"
          title="Receba o comparativo completo toda semana"
          description="Toda segunda-feira enviamos o ranking das melhores ferramentas de IA, o que subiu na semana e como aplicar no seu negócio."
          action="Receber grátis"
            placement="ranking-band"
          />

        <button
          type="button"
          onClick={onClear}
          className="text-xs font-semibold text-muted-foreground underline-offset-4 hover:underline"
        >
          Limpar seleção
        </button>
      </DialogContent>
    </Dialog>
  );
}

export const Route = createFileRoute("/ranking")({
  validateSearch: (search: Record<string, unknown>): Search => ({
    area: typeof search.area === "string" ? search.area : "semanal",
    cat: typeof search.cat === "string" ? search.cat : "todas",
    q: typeof search.q === "string" ? search.q : "",
    all: search.all === true || search.all === "true",
    maker: typeof search.maker === "string" ? search.maker : "todos",
  }),
  loader: async () => {
    try {
      const tools = await listAiTools();
      return { tools };
    } catch (err) {
      console.error("[ranking] loader failed", err);
      return { tools: [] as AiTool[] };
    }
  },
  head: ({ loaderData }) => {
    const tools = (loaderData?.tools ?? []).slice(0, 20);
    const top = tools.slice(0, 3).map((t) => t.name);
    const title = "Ranking IA 2026: as melhores ferramentas de inteligência artificial";
    const description = top.length
      ? `Ranking atualizado das melhores IAs: ${top.join(", ")} lideram hoje. Compare 50 ferramentas de inteligência artificial por categoria, fabricante e nota dos leitores brasileiros.`
      : "Ranking atualizado das 50 melhores ferramentas de inteligência artificial, por categoria, fabricante e nota dos leitores brasileiros.";
    return {
      meta: [
        { title },
        { name: "description", content: description },
        { property: "og:title", content: title },
        { property: "og:description", content: description },
        { property: "og:type", content: "website" },
        { name: "twitter:card", content: "summary_large_image" },
        { property: "og:url", content: "https://ianews.site/ranking" },
      ],
      links: [{ rel: "canonical", href: "https://ianews.site/ranking" }],
      scripts: [
        {
          type: "application/ld+json",
          children: JSON.stringify({
            "@context": "https://schema.org",
            "@graph": [
              {
                "@type": "WebPage",
                "@id": "https://ianews.site/ranking#webpage",
                url: "https://ianews.site/ranking",
                name: title,
                description,
                inLanguage: "pt-BR",
                isPartOf: { "@id": "https://ianews.site/#website" },
                publisher: { "@id": "https://ianews.site/#organization" },
                dateModified: tools[0]?.last_ranked_at ?? undefined,
                mainEntity: {
                  "@type": "ItemList",
                  name: "Melhores ferramentas de inteligência artificial",
                  numberOfItems: tools.length,
                  itemListOrder: "https://schema.org/ItemListOrderDescending",
                  itemListElement: tools.map((t, i) => ({
                    "@type": "ListItem",
                    position: i + 1,
                    name: t.name,
                    url: `https://ianews.site/ranking#${t.slug ?? t.id}`,
                    item: {
                      "@type": "SoftwareApplication",
                      name: t.name,
                      applicationCategory: "ArtificialIntelligenceApplication",
                      operatingSystem: "Web",
                      description: t.about,
                      author: { "@type": "Organization", name: t.maker },
                    },
                  })),
                },
              },
              {
                "@type": "BreadcrumbList",
                itemListElement: [
                  { "@type": "ListItem", position: 1, name: "IA News", item: "https://ianews.site/" },
                  { "@type": "ListItem", position: 2, name: "Ranking IA", item: "https://ianews.site/ranking" },
                ],
              },
            ],
          }),
        },
      ],
    };
  },

  component: RankingPage,
});

function RankingPage() {
  const search = Route.useSearch();
  const area = search.area ?? "semanal";
  const cat = search.cat ?? "todas";
  const q = search.q ?? "";
  const all = search.all ?? false;
  const maker = search.maker ?? "todos";
  const navigate = useNavigate({ from: "/ranking" });
  const { isAuthenticated } = useAuth();
  const queryClient = useQueryClient();

  const [selected, setSelected] = useState<AiTool | null>(null);
  const [searchOpen, setSearchOpen] = useState<boolean>(Boolean(search.q));
  const [promptOpen, setPromptOpen] = useState(false);
  const [promptDone, setPromptDone] = useState(false);

  const { tools: initialTools } = Route.useLoaderData();
  const fetchTools = useServerFn(listAiTools);
  const { data: tools = [] } = useQuery({
    queryKey: ["ai-tools"],
    queryFn: () => fetchTools(),
    initialData: initialTools,
    staleTime: 5 * 60_000,
  });


  const fetchMine = useServerFn(getMyToolRatings);
  const { data: myRatings = [] } = useQuery({
    queryKey: ["ai-tool-ratings", "mine"],
    queryFn: () => fetchMine(),
    enabled: isAuthenticated,
    staleTime: 60_000,
  });
  const myMap = useMemo(
    () => new Map(myRatings.map((r) => [r.tool_id, r])),
    [myRatings],
  );

  const activeArea = AREAS.some((a) => a.key === area) ? area : "semanal";
  const activeCat = CATEGORIES.some((c) => c.key === cat) ? cat : "todas";
  const activeLabel = AREAS.find((a) => a.key === activeArea)?.label ?? "Ranking do dia";

  const makers = useMemo(
    () => Array.from(new Set(tools.map((t) => t.maker))).sort((a, b) => a.localeCompare(b)),
    [tools],
  );
  const activeMaker = makers.includes(maker) ? maker : "todos";

  const filtered = useMemo(() => {
    const term = q.trim().toLowerCase();
    return tools
      .filter((t) => (activeCat === "todas" ? true : t.category === activeCat))
      .filter((t) => (activeMaker === "todos" ? true : t.maker === activeMaker))
      .filter((t) =>
        term
          ? t.name.toLowerCase().includes(term) ||
            t.maker.toLowerCase().includes(term) ||
            t.about.toLowerCase().includes(term)
          : true,
      )
      .sort((a, b) => scoreFor(b, activeArea) - scoreFor(a, activeArea));
  }, [tools, activeArea, activeCat, activeMaker, q]);

  const visible = all ? filtered.slice(0, 50) : filtered.slice(0, 10);

  const [compareIds, setCompareIds] = useState<string[]>([]);
  const [compareOpen, setCompareOpen] = useState(false);
  const compareTools = useMemo(
    () => compareIds.map((id) => tools.find((t) => t.id === id)).filter(Boolean) as AiTool[],
    [compareIds, tools],
  );
  const toggleCompare = (id: string) =>
    setCompareIds((prev) => {
      if (prev.includes(id)) return prev.filter((x) => x !== id);
      if (prev.length >= 3) {
        toast.info("Você pode comparar até 3 ferramentas por vez.");
        return prev;
      }
      return [...prev, id];
    });

  const activeFilters = [
    activeCat !== "todas"
      ? { label: CATEGORIES.find((c) => c.key === activeCat)?.label ?? activeCat, clear: () => setSearch({ cat: "todas" }) }
      : null,
    activeMaker !== "todos" ? { label: activeMaker, clear: () => setSearch({ maker: "todos" }) } : null,
    q.trim() ? { label: `“${q.trim()}”`, clear: () => setSearch({ q: "" }) } : null,
  ].filter(Boolean) as { label: string; clear: () => void }[];

  const highlights = useMemo(() => {
    const bestOf = (label: string, pool: AiTool[], key: string) => {
      const best = [...pool].sort((a, b) => scoreFor(b, key) - scoreFor(a, key))[0];
      return best ? { label, tool: best } : null;
    };
    const inCat = (c: string) => tools.filter((t) => t.category === c);
    return [
      bestOf("Líder do dia", tools, "semanal"),
      bestOf("Programação", inCat("codigo"), "semanal"),
      bestOf("Imagem e vídeo", [...inCat("imagem"), ...inCat("video")], "semanal"),
      bestOf("Jurídico", tools, "juridico"),
    ].filter(Boolean) as { label: string; tool: AiTool }[];
  }, [tools]);

  const updatedAt = tools[0]?.last_ranked_at
    ? new Date(tools[0].last_ranked_at).toLocaleDateString("pt-BR", {
        day: "2-digit",
        month: "short",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
        timeZone: "America/Sao_Paulo",
      })
    : "—";


  // Pop-up de avaliação após 1 minuto na página
  useEffect(() => {
    if (typeof window === "undefined") return;
    const KEY = "ianews:rating-prompt";
    const last = Number(window.localStorage.getItem(KEY) ?? 0);
    if (Date.now() - last < 7 * 24 * 3600 * 1000) return;
    const timer = window.setTimeout(() => {
      setPromptOpen(true);
      window.localStorage.setItem(KEY, String(Date.now()));
    }, 60_000);
    return () => window.clearTimeout(timer);
  }, []);

  const setSearch = (patch: Partial<Search>) =>
    navigate({ search: (prev: Search) => ({ ...prev, ...patch }) });

  return (
    <div className="min-h-screen bg-background">
      <SiteHeader />


      {/* Placar — direto no topo */}
      <section id="placar" className="scroll-mt-24 bg-background pt-5 pb-10 sm:pt-7 sm:pb-14">
        <div className="mx-auto max-w-[1400px] px-4 sm:px-6 lg:px-8">
          <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
            <h1 className="text-xl font-extrabold tracking-tight sm:text-2xl">
              Ranking IA: as melhores ferramentas de inteligência artificial
            </h1>
            <p className="text-xs text-muted-foreground sm:text-sm">
              Atualizado em {updatedAt}
            </p>
          </div>

          {/* Resposta direta — otimizado para busca e para respostas de IA */}
          <div className="mt-3 max-w-4xl space-y-2 text-sm leading-relaxed text-muted-foreground">
            <p>
              <strong className="text-foreground">Resposta direta:</strong>{" "}
              {filtered.length >= 3 ? (
                <>
                  as três ferramentas de IA melhor colocadas hoje são{" "}
                  <strong className="text-foreground">{filtered[0].name}</strong> ({filtered[0].maker}),{" "}
                  <strong className="text-foreground">{filtered[1].name}</strong> ({filtered[1].maker}) e{" "}
                  <strong className="text-foreground">{filtered[2].name}</strong> ({filtered[2].maker}).
                </>
              ) : (
                <>
                  o Ranking IA compara as 50 principais ferramentas de inteligência artificial usadas
                  por empresas brasileiras.
                </>
              )}{" "}
              O placar é do IA News e reúne {tools.length || 50} plataformas.
            </p>
            <p>
              <strong className="text-foreground">Como calculamos:</strong> cada ferramenta recebe uma
              nota de 0 a 100 que combina desempenho técnico em benchmarks públicos, repercussão nas
              notícias das últimas semanas e a média das avaliações dos leitores do IA News. A
              atualização é diária e é possível filtrar por categoria (texto, código, imagem, vídeo,
              jurídico), por fabricante e por área de uso.
            </p>
          </div>



          {/* Barra minimalista de filtros e busca */}
          <div className="mt-4 flex flex-wrap items-center gap-2 border-y border-border py-2.5">
            <FilterMenu
              icon={<SlidersHorizontal className="h-3.5 w-3.5" />}
              label="Avaliação"
              value={activeLabel}
              options={AREAS.map((a) => ({ key: a.key, label: a.label }))}
              active={activeArea}
              onSelect={(key) => setSearch({ area: key })}
            />
            <FilterMenu
              label="Categoria"
              value={CATEGORIES.find((c) => c.key === activeCat)?.label ?? "Todas"}
              options={CATEGORIES.map((c) => ({ key: c.key, label: c.label }))}
              active={activeCat}
              onSelect={(key) => setSearch({ cat: key })}
            />
            <FilterMenu
              label="Fabricante"
              value={activeMaker === "todos" ? "Todos" : activeMaker}
              options={[{ key: "todos", label: "Todos os fabricantes" }, ...makers.map((m) => ({ key: m, label: m }))]}
              active={activeMaker}
              onSelect={(key) => setSearch({ maker: key })}
            />

            <div className="ml-auto flex items-center gap-2">
              {searchOpen ? (
                <div className="relative">
                  <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    autoFocus
                    value={q}
                    onChange={(e) => setSearch({ q: e.target.value })}
                    placeholder="Buscar ferramenta"
                    className="h-9 w-[190px] rounded-none pl-9 text-sm"
                    aria-label="Buscar ferramentas de IA"
                  />
                </div>
              ) : null}
              <button
                type="button"
                aria-label={searchOpen ? "Fechar busca" : "Buscar ferramenta"}
                onClick={() => {
                  if (searchOpen) setSearch({ q: "" });
                  setSearchOpen((v) => !v);
                }}
                className="grid h-9 w-9 shrink-0 place-items-center border border-border text-foreground/70 hover:text-foreground"
              >
                {searchOpen ? <X className="h-4 w-4" /> : <Search className="h-4 w-4" />}
              </button>
              <button
                type="button"
                onClick={() => (compareTools.length >= 2 ? setCompareOpen(true) : toast.info("Marque 2 ou 3 ferramentas na tabela para comparar."))}
                className={cn(
                  "inline-flex h-9 items-center gap-2 px-3 text-[11px] font-bold uppercase tracking-wide transition-colors",
                  compareTools.length >= 2
                    ? "bg-[color:var(--color-lime)] text-white"
                    : "border border-border text-muted-foreground hover:text-foreground",
                )}
              >
                <GitCompare className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">Comparar</span>
                {compareTools.length ? ` (${compareTools.length})` : ""}
              </button>
            </div>

            {activeFilters.length ? (
              <div className="flex w-full flex-wrap items-center gap-2 pt-1">
                {activeFilters.map((f) => (
                  <button
                    key={f.label}
                    type="button"
                    onClick={f.clear}
                    className="inline-flex items-center gap-1.5 bg-secondary px-2.5 py-1 text-xs font-medium text-foreground/80 hover:text-foreground"
                  >
                    {f.label} <X className="h-3 w-3" />
                  </button>
                ))}
                <button
                  type="button"
                  onClick={() => setSearch({ cat: "todas", maker: "todos", q: "" })}
                  className="text-xs font-semibold text-primary underline-offset-4 hover:underline"
                >
                  Limpar tudo
                </button>
              </div>
            ) : null}
          </div>


          <div className="mt-6 overflow-x-auto rounded-2xl border border-border/60 bg-background shadow-[var(--shadow-mui-sm)]">
            <table className="w-full text-left">
              <caption className="sr-only">Ranking de ferramentas de IA em {activeLabel}</caption>
              <thead>
                <tr className="border-b border-border/70 text-xs uppercase tracking-wide text-muted-foreground">
                  <th scope="col" className="px-3 py-4 font-semibold sm:px-5">#</th>
                  <th scope="col" className="px-3 py-4 font-semibold sm:px-5">Ferramenta</th>
                  <th scope="col" className="hidden px-5 py-4 font-semibold sm:table-cell">Fabricante</th>
                  <th scope="col" className="hidden px-5 py-4 font-semibold lg:table-cell">Leitores</th>
                  <th scope="col" className="hidden px-5 py-4 font-semibold md:table-cell">Hoje</th>
                  <th scope="col" className="px-3 py-4 text-right font-semibold sm:px-5">Nota</th>
                  <th scope="col" className="px-3 py-4 text-right font-semibold sm:px-5">Comparar</th>
                </tr>
              </thead>
              <tbody>
                {visible.map((m, i) => (
                  <tr
                    key={m.id}
                    onClick={() => setSelected(m)}
                    tabIndex={0}
                    role="button"
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        setSelected(m);
                      }
                    }}
                    className="cursor-pointer border-b border-border/50 last:border-0 transition-colors hover:bg-secondary/50 focus:bg-secondary/60 focus:outline-none"
                  >
                    <td className="px-3 py-4 text-sm font-bold text-muted-foreground sm:px-5">
                      {String(i + 1).padStart(2, "0")}
                    </td>
                    <td className="px-3 py-4 sm:px-5">
                      <span className="flex items-center gap-3">
                        <ModelLogo m={m} />
                        <span>
                          <span className="block font-semibold">{m.name}</span>
                          <span className="block text-xs text-muted-foreground sm:hidden">
                            {m.maker}
                          </span>
                        </span>
                      </span>
                    </td>
                    <td className="hidden px-5 py-4 text-sm text-muted-foreground sm:table-cell">
                      {m.maker}
                    </td>
                    <td className="hidden px-5 py-4 text-sm text-muted-foreground lg:table-cell">
                      {m.ratings_count > 0 ? (
                        <span className="inline-flex items-center gap-2">
                          <Stars value={m.ratings_avg} size={14} />
                          <span className="text-xs">({m.ratings_count})</span>
                        </span>
                      ) : (
                        <span className="text-xs">sem avaliações</span>
                      )}
                    </td>
                    <td className="hidden px-5 py-4 md:table-cell">
                      <TrendBadge tool={m} />
                    </td>
                    <td className="px-3 py-4 text-right sm:px-5">
                      <span
                        className="inline-flex min-w-[3.5rem] justify-center rounded-full px-2.5 py-1.5 text-sm font-extrabold text-white sm:min-w-[4rem] sm:px-3"
                        style={{
                          background:
                            i === 0
                              ? "var(--color-lime)"
                              : "color-mix(in oklab, var(--color-lime) 30%, transparent)",
                        }}
                      >
                        {scoreFor(m, activeArea).toFixed(2)}
                      </span>
                    </td>
                    <td
                      className="px-3 py-4 text-right sm:px-5"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <button
                        type="button"
                        aria-label={`Adicionar ${m.name} à comparação`}
                        onClick={(e) => {
                          e.stopPropagation();
                          toggleCompare(m.id);
                        }}
                        className={cn(
                          "grid h-8 w-8 place-items-center rounded-full ring-1 ring-inset transition-colors",
                          compareIds.includes(m.id)
                            ? "bg-[color:var(--color-lime)] text-white ring-transparent"
                            : "text-muted-foreground ring-border/70 hover:text-foreground",
                        )}
                      >
                        {compareIds.includes(m.id) ? (
                          <Check className="h-4 w-4" />
                        ) : (
                          <GitCompare className="h-4 w-4" />
                        )}
                      </button>
                    </td>
                  </tr>
                ))}
                {visible.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-5 py-10 text-center text-sm text-muted-foreground">
                      Nenhuma ferramenta encontrada com esses filtros.
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>

          {filtered.length > 10 ? (
            <div className="mt-6 flex justify-center">
              <button
                type="button"
                onClick={() => setSearch({ all: !all })}
                className="rounded-full bg-[color:var(--color-nav)] px-6 py-3 text-sm font-bold uppercase tracking-wide text-white transition-opacity hover:opacity-90"
              >
                {all ? "Ver apenas o top 10" : `Ver todas (${Math.min(filtered.length, 50)})`}
              </button>
            </div>
          ) : null}

          <p className="mt-6 text-xs text-muted-foreground">
            A nota combina o desempenho técnico em provas aplicadas em português, a
            repercussão real da ferramenta nas notícias das últimas 24 horas (e dos últimos 7
            dias) e a média das avaliações dos leitores da IA News. O recálculo é automático,
            todos os dias às 6h.
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            Clique em uma ferramenta para ver a avaliação completa, ou marque de 2 a 3 para
            comparar lado a lado.
          </p>

          <section className="mt-10">
            <h2 className="text-lg font-bold tracking-tight sm:text-xl">Destaques de hoje</h2>
            <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {highlights.map((h) => (
                <button
                  key={h.label}
                  type="button"
                  onClick={() => setSelected(h.tool)}
                  className="group relative overflow-hidden border border-border p-5 text-left transition-colors hover:border-foreground/40"
                >
                  <span className="font-mono-eyebrow text-[color:var(--color-lime)]">
                    {h.label}
                  </span>
                  <h3 className="mt-3 text-lg font-extrabold leading-tight">{h.tool.name}</h3>
                  <p className="mt-1.5 pr-8 text-sm leading-relaxed text-muted-foreground">
                    {h.tool.maker} · nota {scoreFor(h.tool, "semanal").toFixed(2)}
                  </p>
                  <span className="absolute bottom-4 right-4 text-muted-foreground transition-transform group-hover:-translate-y-0.5">
                    <ArrowUpRight className="h-4 w-4" />
                  </span>
                </button>
              ))}
            </div>
            <div className="mt-8 border border-border bg-secondary/40 p-5">
              <p className="font-mono-eyebrow text-[color:var(--color-lime)]">Sobre o placar</p>
              <p className="mt-2 max-w-3xl text-sm leading-relaxed text-muted-foreground">
                Um ranking recalculado automaticamente todos os dias, combinando desempenho
                técnico em provas aplicadas em português, repercussão real nas notícias das
                últimas 24 horas e a avaliação de quem usa as ferramentas no dia a dia.
              </p>
            </div>
          </section>

          <LeadCta
            className="mt-10"
            eyebrow="Ranking IA semanal"
            title="Receba toda semana o ranking das melhores ferramentas de IA"
            description="As ferramentas que mais subiram, o que mudou no mercado e como aplicar no seu negócio — em 3 minutos de leitura, toda segunda-feira."
            action="Quero o ranking semanal"
            placement="ranking-rodape"
          />
        </div>
      </section>

      <CompareDialog
        tools={compareTools}
        open={compareOpen && compareTools.length >= 2}
        onClose={() => setCompareOpen(false)}
        onClear={() => {
          setCompareIds([]);
          setCompareOpen(false);
        }}
      />

      <ToolDialog
        tool={selected}
        activeArea={activeArea === "semanal" || activeArea === "avaliacao" ? "geral" : activeArea}
        activeLabel={activeLabel}
        myRating={selected ? myMap.get(selected.id) ?? null : null}
        isAuthenticated={isAuthenticated}
        onClose={() => setSelected(null)}
        onSaved={() => {
          queryClient.invalidateQueries({ queryKey: ["ai-tools"] });
          queryClient.invalidateQueries({ queryKey: ["ai-tool-ratings", "mine"] });
        }}
      />

      <RatingPrompt
        open={promptOpen && !promptDone}
        tools={tools}
        isAuthenticated={isAuthenticated}
        onClose={() => setPromptOpen(false)}
        onDone={() => {
          setPromptDone(true);
          setPromptOpen(false);
          queryClient.invalidateQueries({ queryKey: ["ai-tools"] });
          queryClient.invalidateQueries({ queryKey: ["ai-tool-ratings", "mine"] });
        }}
      />


      <SiteFooter />
    </div>
  );
}

function RatingForm({
  tool,
  initial,
  isAuthenticated,
  onSaved,
}: {
  tool: AiTool;
  initial: { rating: number; use_case: string | null; comment: string | null } | null;
  isAuthenticated: boolean;
  onSaved: () => void;
}) {
  const [rating, setRating] = useState(initial?.rating ?? 0);
  const [useCase, setUseCase] = useState(initial?.use_case ?? "");
  const [comment, setComment] = useState(initial?.comment ?? "");

  useEffect(() => {
    setRating(initial?.rating ?? 0);
    setUseCase(initial?.use_case ?? "");
    setComment(initial?.comment ?? "");
  }, [initial, tool.id]);

  const rate = useServerFn(rateAiTool);
  const mutation = useMutation({
    mutationFn: (vars: { toolId: string; rating: number; useCase: string; comment: string }) =>
      rate({ data: vars }),
    onSuccess: () => {
      toast.success("Avaliação registrada. Obrigado!");
      onSaved();
    },
    onError: (err) => toast.error(err instanceof Error ? err.message : "Erro ao avaliar."),
  });

  if (!isAuthenticated) {
    return (
      <div className="rounded-xl border border-border/60 bg-secondary/40 p-4">
        <p className="text-sm font-semibold">Avalie esta ferramenta</p>
        <p className="mt-1 text-xs text-muted-foreground">
          Entre na sua conta IA News para dar sua nota e influenciar o ranking de amanhã.
        </p>
        <Link
          to="/auth"
          className="mt-3 inline-flex rounded-full bg-[color:var(--color-nav)] px-4 py-2 text-xs font-semibold text-white"
        >
          Entrar ou criar conta
        </Link>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-border/60 bg-secondary/40 p-4">
      <p className="text-sm font-semibold">Sua avaliação</p>
      <div className="mt-2">
        <Stars value={rating} onChange={setRating} />
      </div>
      <Input
        value={useCase}
        onChange={(e) => setUseCase(e.target.value)}
        placeholder="Para que você usa? (ex.: atendimento, contabilidade)"
        maxLength={120}
        className="mt-3 bg-background"
      />
      <Textarea
        value={comment}
        onChange={(e) => setComment(e.target.value)}
        placeholder="Conte sua experiência (opcional)"
        maxLength={800}
        rows={3}
        className="mt-2 bg-background"
      />
      <button
        type="button"
        disabled={rating < 1 || mutation.isPending}
        onClick={() =>
          mutation.mutate({ toolId: tool.id, rating, useCase, comment })
        }
        className="mt-3 w-full rounded-full bg-[color:var(--color-lime)] px-4 py-2.5 text-sm font-bold text-white transition-opacity hover:opacity-90 disabled:opacity-50"
      >
        {mutation.isPending ? "Enviando..." : initial ? "Atualizar avaliação" : "Enviar avaliação"}
      </button>
    </div>
  );
}

function ToolDialog({
  tool,
  activeArea,
  activeLabel,
  myRating,
  isAuthenticated,
  onClose,
  onSaved,
}: {
  tool: AiTool | null;
  activeArea: string;
  activeLabel: string;
  myRating: { rating: number; use_case: string | null; comment: string | null } | null;
  isAuthenticated: boolean;
  onClose: () => void;
  onSaved: () => void;
}) {
  return (
    <Dialog open={!!tool} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-lg">
        {tool ? (
          <>
            <DialogHeader>
              <div className="flex items-center gap-3">
                <ModelLogo m={tool} size={44} />
                <div className="text-left">
                  <DialogTitle className="text-xl leading-tight">{tool.name}</DialogTitle>
                  <DialogDescription className="text-xs">
                    {tool.maker}
                    {tool.released ? ` · desde ${tool.released}` : ""}
                  </DialogDescription>
                </div>
              </div>
            </DialogHeader>

            <p className="text-sm leading-relaxed text-foreground/80">{tool.about}</p>

            <div className="grid gap-3 sm:grid-cols-3">
              <div className="rounded-xl border border-border/60 p-3">
                <p className="text-xs text-muted-foreground">Nota do dia</p>
                <p className="text-2xl font-extrabold">{tool.weekly_score.toFixed(2)}</p>
              </div>
              <div className="rounded-xl border border-border/60 p-3">
                <p className="text-xs text-muted-foreground">Posição</p>
                <p className="text-2xl font-extrabold">#{tool.rank_position}</p>
              </div>
              <div className="rounded-xl border border-border/60 p-3">
                <p className="text-xs text-muted-foreground">Leitores</p>
                <p className="text-sm font-semibold">
                  {tool.ratings_count > 0
                    ? `${tool.ratings_avg.toFixed(1)} / 5 (${tool.ratings_count})`
                    : "Seja o primeiro"}
                </p>
              </div>
            </div>

            {tool.context_window ? (
              <p className="text-xs text-muted-foreground">Contexto: {tool.context_window}</p>
            ) : null}

            <div className="space-y-2">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Notas por área
              </p>
              {AREAS.filter((a) => a.key !== "semanal" && a.key !== "avaliacao").map((a) => (
                <div key={a.key} className="flex items-center gap-3">
                  <span className="w-40 shrink-0 text-xs text-muted-foreground">{a.label}</span>
                  <span className="h-2 flex-1 overflow-hidden rounded-full bg-secondary">
                    <span
                      className="block h-full rounded-full"
                      style={{
                        width: `${(scoreFor(tool, a.key) / 10) * 100}%`,
                        background:
                          a.key === activeArea ? "var(--color-lime)" : "var(--color-nav)",
                      }}
                    />
                  </span>
                  <span className="w-10 text-right text-xs font-bold">
                    {scoreFor(tool, a.key).toFixed(2)}
                  </span>
                </div>
              ))}
              <p className="sr-only">Área em destaque: {activeLabel}</p>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Pontos fortes
                </p>
                <ul className="mt-2 space-y-1 text-sm text-foreground/80">
                  {tool.pros.map((p) => (
                    <li key={p}>• {p}</li>
                  ))}
                </ul>
              </div>
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Pontos de atenção
                </p>
                <ul className="mt-2 space-y-1 text-sm text-foreground/80">
                  {tool.cons.map((c) => (
                    <li key={c}>• {c}</li>
                  ))}
                </ul>
              </div>
            </div>

            {tool.pricing ? (
              <p className="text-xs text-muted-foreground">{tool.pricing}</p>
            ) : null}

            <RatingForm
              tool={tool}
              initial={myRating}
              isAuthenticated={isAuthenticated}
              onSaved={onSaved}
            />

            {tool.website ? (
              <a
                href={tool.website}
                target="_blank"
                rel="noreferrer noopener"
                className="inline-flex w-full items-center justify-center gap-2 rounded-full bg-[color:var(--color-nav)] px-4 py-2.5 text-sm font-semibold text-white transition-opacity hover:opacity-90"
              >
                Visitar plataforma <ExternalLink className="h-4 w-4" />
              </a>
            ) : null}
          </>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}

function RatingPrompt({
  open,
  tools,
  isAuthenticated,
  onClose,
  onDone,
}: {
  open: boolean;
  tools: AiTool[];
  isAuthenticated: boolean;
  onClose: () => void;
  onDone: () => void;
}) {
  const [toolId, setToolId] = useState("");
  const [rating, setRating] = useState(0);
  const rate = useServerFn(rateAiTool);
  const mutation = useMutation({
    mutationFn: (vars: { toolId: string; rating: number }) => rate({ data: vars }),
    onSuccess: () => {
      toast.success("Obrigado! Sua nota já conta para o ranking de amanhã.");
      onDone();
    },
    onError: (err) => toast.error(err instanceof Error ? err.message : "Erro ao avaliar."),
  });

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Qual IA você mais usa?</DialogTitle>
          <DialogDescription>
            Leva 10 segundos. Sua nota entra no cálculo do ranking de amanhã.
          </DialogDescription>
        </DialogHeader>

        {isAuthenticated ? (
          <>
            <select
              value={toolId}
              onChange={(e) => setToolId(e.target.value)}
              className="h-11 w-full rounded-xl border border-border/70 bg-background px-3 text-sm"
              aria-label="Escolha a ferramenta que mais usa"
            >
              <option value="">Selecione a ferramenta…</option>
              {[...tools]
                .sort((a, b) => a.name.localeCompare(b.name))
                .map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name} — {t.maker}
                  </option>
                ))}
            </select>

            <div className="flex justify-center py-2">
              <Stars value={rating} onChange={setRating} size={30} />
            </div>

            <button
              type="button"
              disabled={!toolId || rating < 1 || mutation.isPending}
              onClick={() => mutation.mutate({ toolId, rating })}
              className="w-full rounded-full bg-[color:var(--color-lime)] px-4 py-2.5 text-sm font-bold text-white transition-opacity hover:opacity-90 disabled:opacity-50"
            >
              {mutation.isPending ? "Enviando..." : "Enviar avaliação"}
            </button>
            <button
              type="button"
              onClick={onClose}
              className="text-xs text-muted-foreground underline-offset-2 hover:underline"
            >
              Agora não
            </button>
          </>
        ) : (
          <>
            <p className="text-sm text-muted-foreground">
              Entre na sua conta IA News para avaliar as ferramentas que você usa.
            </p>
            <Link
              to="/auth"
              className="w-full rounded-full bg-[color:var(--color-nav)] px-4 py-2.5 text-center text-sm font-bold text-white"
            >
              Entrar ou criar conta
            </Link>
            <button
              type="button"
              onClick={onClose}
              className="text-xs text-muted-foreground underline-offset-2 hover:underline"
            >
              Agora não
            </button>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
