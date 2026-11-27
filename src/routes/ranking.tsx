import { useEffect, useMemo, useState } from "react";
import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  BookOpen,
  Brain,
  Calculator,
  Check,
  Building2,
  GitCompare,
  Scale,
  Search,
  Stethoscope,
  Trophy,
  Users,
} from "lucide-react";
import { toast } from "sonner";

import { SiteHeader } from "@/components/site/header";
import { SiteFooter } from "@/components/site/footer";
import { PortalSubscribeForm, useSubscribed } from "@/components/site/portal-subscribe";
import { useAuth } from "@/hooks/use-auth";
import {
  listAiTools,
  getLatestBenchLeader,
  type BenchLeader,
  getMyToolRatings,
  type AiTool,
} from "@/lib/ai-ranking.functions";
import {
  AREAS,
  CATEGORIES,
  RankLogo,
  TrendBadge,
  catLabel,
  fmtScore,
  scoreFor,
} from "@/components/portal/rank-shared";
import { CompareDialog, RatingPrompt, ToolDialog } from "@/components/portal/rank-dialogs";
import { jsonLd } from "@/lib/json-ld";

const AREA_META: Record<string, { icon: typeof Trophy; hint: string }> = {
  semanal: {
    icon: Trophy,
    hint: "Nota geral do dia: desempenho técnico, repercussão nas notícias e avaliação dos leitores.",
  },
  geral: { icon: Brain, hint: "Nota em provas de conhecimento geral aplicadas em português." },
  contabilidade: {
    icon: Calculator,
    hint: "Nota em provas de contabilidade aplicadas em português.",
  },
  juridico: { icon: Scale, hint: "Nota em provas da área jurídica aplicadas em português." },
  literatura: { icon: BookOpen, hint: "Nota em provas de literatura brasileira." },
  medicina: { icon: Stethoscope, hint: "Nota em provas de medicina aplicadas em português." },
  avaliacao: {
    icon: Users,
    hint: "Média das notas dos leitores da IA News, convertida para 0 a 10.",
  },
};

const MESES = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];

type Search = { area?: string; cat?: string; q?: string; all?: boolean; maker?: string };

/** Só guarda o que difere do padrão: assim /ranking não redireciona para uma URL cheia de parâmetros. */
const str = (v: unknown, def: string) =>
  typeof v === "string" && v !== "" && v !== def ? v : undefined;

/** Quantas plataformas aparecem antes do botão "Ver todas". */
const FIRST_ROWS = 10;
/** Teto da lista completa (mantido do comportamento anterior). */
const MAX_ROWS = 50;

export const Route = createFileRoute("/ranking")({
  validateSearch: (search: Record<string, unknown>): Search => ({
    area: str(search.area, "semanal"),
    cat: str(search.cat, "todas"),
    q: str(search.q, ""),
    all: search.all === true || search.all === "true" ? true : undefined,
    maker: str(search.maker, "todos"),
  }),
  loader: async () => {
    try {
      const [tools, bench] = await Promise.all([
        listAiTools(),
        getLatestBenchLeader().catch(() => null),
      ]);
      return { tools, bench };
    } catch (err) {
      console.error("[ranking] loader failed", err);
      return { tools: [] as AiTool[], bench: null as BenchLeader };
    }
  },
  head: ({ loaderData }) => {
    const tools = (loaderData?.tools ?? []).slice(0, 20);
    const top = tools.slice(0, 3).map((t) => t.name);
    const total = loaderData?.tools?.length || 50;
    const title = "Ranking IA 2026: as melhores ferramentas de inteligência artificial";
    const bench = loaderData?.bench;
    const benchTxt = bench
      ? ` Em inteligência, lidera o ${bench.name}, da ${bench.maker} (${bench.asOf}).`
      : "";
    const description = top.length
      ? `Ranking das melhores IAs, atualizado todo dia: ${top.join(", ")} lideram.${benchTxt} Compare ${total} IAs.`
      : "Ranking atualizado das melhores ferramentas de inteligência artificial, por categoria, fabricante e nota dos leitores brasileiros.";
    return {
      meta: [
        { title },
        { name: "description", content: description },
        { property: "og:title", content: title },
        { property: "og:description", content: description },
        { property: "og:type", content: "website" },
        { name: "twitter:card", content: "summary_large_image" },
        { property: "og:url", content: "https://ianewsbr.com/ranking" },
      ],
      links: [{ rel: "canonical", href: "https://ianewsbr.com/ranking" }],
      scripts: [
        {
          type: "application/ld+json",
          children: jsonLd({
            "@context": "https://schema.org",
            "@graph": [
              {
                "@type": "WebPage",
                "@id": "https://ianewsbr.com/ranking#webpage",
                url: "https://ianewsbr.com/ranking",
                name: title,
                description,
                inLanguage: "pt-BR",
                isPartOf: { "@id": "https://ianewsbr.com/#website" },
                publisher: { "@id": "https://ianewsbr.com/#organization" },
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
                    url: `https://ianewsbr.com/ranking#${t.slug ?? t.id}`,
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
                  {
                    "@type": "ListItem",
                    position: 1,
                    name: "IA News",
                    item: "https://ianewsbr.com/",
                  },
                  {
                    "@type": "ListItem",
                    position: 2,
                    name: "Ranking IA",
                    item: "https://ianewsbr.com/ranking",
                  },
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
  const subscribed = useSubscribed();

  const [selected, setSelected] = useState<AiTool | null>(null);
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
  const myMap = useMemo(() => new Map(myRatings.map((r) => [r.tool_id, r])), [myRatings]);

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

  // Começa com 10; "Ver mais" mostra de 10 em 10.
  const [shown, setShown] = useState(FIRST_ROWS);
  useEffect(() => setShown(FIRST_ROWS), [activeArea, activeCat, activeMaker, q]);
  const limit = all ? MAX_ROWS : Math.min(shown, MAX_ROWS);
  const visible = filtered.slice(0, limit);
  const restantes = Math.min(filtered.length, MAX_ROWS) - visible.length;

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

  const isFiltered = activeCat !== "todas" || activeMaker !== "todos" || q.trim() !== "";

  const podium = filtered.slice(0, 3);
  // Ordem visual do pódio: 2º, 1º, 3º.
  const podiumOrder = [
    podium[1] && { tool: podium[1], pos: 2 },
    podium[0] && { tool: podium[0], pos: 1 },
    podium[2] && { tool: podium[2], pos: 3 },
  ].filter(Boolean) as { tool: AiTool; pos: number }[];

  const leaders = useMemo(
    () =>
      CATEGORIES.filter((c) => c.key !== "todas")
        .map((c) => {
          const pool = tools.filter((t) => t.category === c.key);
          const sorted = [...pool].sort(
            (a, b) => scoreFor(b, activeArea) - scoreFor(a, activeArea),
          );
          const tool = sorted[0];
          return tool
            ? { key: c.key, label: c.label, tool, count: pool.length, next: sorted.slice(1, 3) }
            : null;
        })
        .filter(Boolean) as {
        key: string;
        label: string;
        tool: AiTool;
        count: number;
        next: AiTool[];
      }[],
    [tools, activeArea],
  );

  const movers = useMemo(
    () =>
      tools
        .map((t) => ({
          tool: t,
          delta: t.previous_position > 0 ? t.previous_position - t.rank_position : 0,
        }))
        .filter((m) => m.delta > 0)
        .sort((a, b) => b.delta - a.delta)
        .slice(0, 4),
    [tools],
  );

  const topFive = useMemo(
    () => [...tools].sort((a, b) => b.weekly_score - a.weekly_score).slice(0, 5),
    [tools],
  );

  const updatedAt = (() => {
    const iso = tools[0]?.last_ranked_at;
    if (!iso) return "—";
    const parts = new Intl.DateTimeFormat("en-US", {
      day: "numeric",
      month: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
      timeZone: "America/Sao_Paulo",
    }).formatToParts(new Date(iso));
    const get = (t: string) => parts.find((p) => p.type === t)?.value ?? "";
    return `${get("day")} ${MESES[Number(get("month")) - 1] ?? ""}, ${get("hour")}h${get("minute")}`;
  })();

  const catCounts = useMemo(() => {
    const m: Record<string, number> = { todas: tools.length };
    for (const t of tools) m[t.category] = (m[t.category] ?? 0) + 1;
    return m;
  }, [tools]);

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
    navigate({
      search: (prev: Search) => ({ ...prev, ...patch }),
      replace: true,
      resetScroll: false,
    });

  const total = tools.length;
  const countText =
    filtered.length === total
      ? `${total} plataformas`
      : `${filtered.length === 1 ? "1" : filtered.length} de ${total} plataformas`;

  return (
    <>
      <SiteHeader />
      <main id="main">
        <div className="page rkx" data-page="ranking">
          <section className="rkx-hero" aria-labelledby="rkx-h1">
            <div className="wrap">
              <p className="rkx-kick">
                <span className="rkx-live" aria-hidden="true" /> Ranking IA
                <span className="rkx-upd">Atualizado {updatedAt}</span>
              </p>
              <h1 id="rkx-h1">As melhores plataformas de IA, hoje</h1>
              <p className="rkx-sub">
                {total ? `${total} plataformas` : "Plataformas"} com nota de 0 a 10, que combina
                desempenho técnico, repercussão nas notícias e avaliação dos leitores. Recalculado
                todo dia, às 6h.
              </p>

              <div className="rkx-areabox">
                <span className="rkx-areabox-t">Ver a nota em</span>
                <div className="rkx-tabs" role="tablist" aria-label="Critério da nota">
                  {AREAS.map((a) => {
                    const Icon = AREA_META[a.key]?.icon ?? Trophy;
                    return (
                      <button
                        key={a.key}
                        type="button"
                        role="tab"
                        aria-selected={a.key === activeArea}
                        className={a.key === activeArea ? "on" : undefined}
                        onClick={() => setSearch({ area: a.key })}
                      >
                        <Icon aria-hidden="true" />
                        <span>{a.key === "semanal" ? "Geral do dia" : a.label}</span>
                      </button>
                    );
                  })}
                </div>
                <p className="rkx-areahint">{AREA_META[activeArea]?.hint}</p>
              </div>

              {podium.length ? (
                <ol className="rkx-podium" aria-label={`Pódio: ${activeLabel}`}>
                  {podiumOrder.map(({ tool, pos }) => (
                    <li key={tool.id} className={"p" + pos}>
                      <button type="button" onClick={() => setSelected(tool)}>
                        <span className="rkx-medal" aria-hidden="true">
                          {pos}º
                        </span>
                        <RankLogo m={tool} className="rkx-plogo" />
                        <b className="rkx-pname">{tool.name}</b>
                        <span className="rkx-pmk">
                          {tool.maker === tool.name ? catLabel(tool.category) : tool.maker}
                        </span>
                        <span className="rkx-pscore">
                          {fmtScore(scoreFor(tool, activeArea))}
                          <small>/10</small>
                        </span>
                        <span className="rkx-step" aria-hidden="true" />
                      </button>
                    </li>
                  ))}
                </ol>
              ) : null}

              {filtered.length >= 3 ? (
                <p className="rkx-answer">
                  <b>Resposta direta:</b> as três ferramentas de IA melhor colocadas hoje
                  {activeArea !== "semanal" ? ` em ${activeLabel}` : ""}
                  {activeCat !== "todas" ? ` (${catLabel(activeCat)})` : ""} são{" "}
                  <b>{filtered[0].name}</b> ({filtered[0].maker}), <b>{filtered[1].name}</b> (
                  {filtered[1].maker}) e <b>{filtered[2].name}</b> ({filtered[2].maker}).
                </p>
              ) : null}
            </div>
          </section>

          <div className="wrap">
            {leaders.length ? (
              <section className="rkx-sec" aria-labelledby="rkx-lead-h">
                <div className="sec-head">
                  <h2 id="rkx-lead-h">Os melhores por categoria</h2>
                  <p className="lede">{activeLabel}</p>
                </div>
                <div className="rkx-best2">
                  {leaders.map(({ key, label, tool, count }) => (
                    <button
                      key={key}
                      type="button"
                      className={"rkx-bc" + (activeCat === key ? " on" : "")}
                      aria-pressed={activeCat === key}
                      title={`Ver as ${count} plataformas de ${label}`}
                      onClick={() => {
                        setSearch({ cat: activeCat === key ? "todas" : key });
                        document
                          .getElementById("classificacao")
                          ?.scrollIntoView({ behavior: "smooth", block: "start" });
                      }}
                    >
                      <span className="rkx-bc-cat">{label}</span>
                      <span className="rkx-bc-row">
                        <RankLogo m={tool} />
                        <b>{tool.name}</b>
                        <span className="rkx-bc-sc num">
                          {fmtScore(scoreFor(tool, activeArea))}
                        </span>
                      </span>
                    </button>
                  ))}
                </div>
              </section>
            ) : null}

            {movers.length ? (
              <section className="rkx-mv2" aria-label="Quem mais subiu desde ontem">
                <span className="rkx-mv2-t">Subiram desde ontem</span>
                <ul>
                  {movers.map(({ tool, delta }) => (
                    <li key={tool.id}>
                      <button type="button" onClick={() => setSelected(tool)}>
                        <RankLogo m={tool} />
                        <span>{tool.name}</span>
                        <i className="num">▲ {delta}</i>
                      </button>
                    </li>
                  ))}
                </ul>
              </section>
            ) : null}

            <div
              className="sec-head"
              id="classificacao"
              style={{ marginTop: 44, scrollMarginTop: 80 }}
            >
              <h2>Classificação completa</h2>
              <p className="lede">{activeLabel}</p>
            </div>

            <div className="rkx-filter">
              <div className="rkx-ftabs" role="tablist" aria-label="Categoria">
                {CATEGORIES.map((c) => (
                  <button
                    key={c.key}
                    type="button"
                    role="tab"
                    aria-selected={c.key === activeCat}
                    className={c.key === activeCat ? "on" : undefined}
                    onClick={() => setSearch({ cat: c.key })}
                  >
                    {c.key === "todas" ? "Todas" : c.label}
                    <i className="num">{catCounts[c.key] ?? 0}</i>
                  </button>
                ))}
              </div>
              <div className="rkx-bar2">
                <label className="rkx-q2">
                  <Search aria-hidden="true" />
                  <input
                    type="search"
                    value={q}
                    onChange={(e) => setSearch({ q: e.target.value })}
                    placeholder="Buscar plataforma"
                    aria-label="Buscar plataforma ou empresa"
                    autoComplete="off"
                  />
                </label>
                <label className="rkx-sel2">
                  <Building2 aria-hidden="true" />
                  <select
                    aria-label="Empresa que criou a plataforma"
                    value={activeMaker}
                    onChange={(e) => setSearch({ maker: e.target.value })}
                  >
                    <option value="todos">Todas as empresas</option>
                    {makers.map((m) => (
                      <option key={m} value={m}>
                        {m}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
            </div>
            <div className="rkx-meta">
              <span role="status" aria-live="polite">
                {countText}
              </span>
              {isFiltered ? (
                <button
                  className="more"
                  type="button"
                  onClick={() => setSearch({ cat: "todas", maker: "todos", q: "" })}
                >
                  Limpar filtros
                </button>
              ) : null}
              <span className="rkx-tip">
                <GitCompare className="ico" aria-hidden="true" /> marque até 3 para comparar
              </span>
            </div>

            <div
              className="rk"
              role="list"
              aria-label={`Ranking de ferramentas de IA em ${activeLabel}`}
            >
              {visible.map((m, i) => {
                const score = scoreFor(m, activeArea);
                const on = compareIds.includes(m.id);
                return (
                  <div
                    key={m.id}
                    id={m.slug ?? m.id}
                    role="listitem"
                    className={"rk-item" + (i < 3 ? " t3 m" + (i + 1) : "") + (on ? " sel" : "")}
                  >
                    <div className="rk-row rk-x" onClick={() => setSelected(m)}>
                      <span className="rk-pos">{String(i + 1).padStart(2, "0")}</span>
                      <RankLogo m={m} />
                      <span className="rk-name">
                        <b>
                          <button
                            type="button"
                            className="rk-open"
                            onClick={(e) => {
                              e.stopPropagation();
                              setSelected(m);
                            }}
                          >
                            {m.name}
                          </button>
                        </b>
                        <span className="mk">
                          {m.maker === m.name
                            ? catLabel(m.category)
                            : `${m.maker} · ${catLabel(m.category)}`}
                          <TrendBadge tool={m} />
                          {m.ratings_count > 0 ? (
                            <span className="rk-readers" title="Média das avaliações dos leitores">
                              ★ {m.ratings_avg.toFixed(1).replace(".", ",")} ({m.ratings_count})
                            </span>
                          ) : null}
                        </span>
                      </span>
                      <span className="rk-bar" aria-hidden="true">
                        <i
                          style={{
                            ["--v" as string]: `${Math.max(0, Math.min(100, score * 10))}%`,
                          }}
                        />
                      </span>
                      <span className="rk-score">{fmtScore(score)}</span>
                      <button
                        type="button"
                        className="rk-cmp-btn"
                        aria-pressed={on}
                        aria-label={`${on ? "Remover" : "Adicionar"} ${m.name} ${on ? "da" : "à"} comparação`}
                        title="Comparar"
                        onClick={(e) => {
                          e.stopPropagation();
                          toggleCompare(m.id);
                        }}
                      >
                        {on ? (
                          <Check className="ico" aria-hidden="true" />
                        ) : (
                          <GitCompare className="ico" aria-hidden="true" />
                        )}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
            {visible.length === 0 ? (
              <p className="empty">
                Nenhuma plataforma encontrada. Tente outro nome ou outra categoria.
              </p>
            ) : null}

            {restantes > 0 ? (
              <div className="load-more">
                <button
                  className="btn line"
                  type="button"
                  onClick={() => setShown((n) => n + FIRST_ROWS)}
                >
                  Ver mais {Math.min(FIRST_ROWS, restantes)} plataformas
                  <span className="rkx-rest"> · faltam {restantes}</span>
                </button>
              </div>
            ) : visible.length > FIRST_ROWS ? (
              <div className="load-more">
                <button
                  className="btn line"
                  type="button"
                  onClick={() => {
                    setShown(FIRST_ROWS);
                    if (all) setSearch({ all: undefined });
                    document
                      .getElementById("classificacao")
                      ?.scrollIntoView({ behavior: "smooth", block: "start" });
                  }}
                >
                  Mostrar só as {FIRST_ROWS} primeiras
                </button>
              </div>
            ) : null}

            {!subscribed ? (
              <div className="band gate">
                <div className="txt">
                  {topFive.length ? (
                    <div className="gate-logos" aria-hidden="true">
                      {topFive.map((t) => (
                        <RankLogo key={t.id} m={t} />
                      ))}
                      {total > topFive.length ? (
                        <span className="plus">e outras {total - topFive.length}</span>
                      ) : null}
                    </div>
                  ) : null}
                  <h3>O ranking completo, toda segunda-feira no seu e-mail</h3>
                  <p>
                    Quem sobe, quem cai e o que mudou nas plataformas de IA, junto com a newsletter
                    diária da IANews.
                  </p>
                </div>
                <div className="rk-band-form">
                  <PortalSubscribeForm placement="ranking-rodape" button="Quero receber" />
                  <p className="fine">
                    Gratuito. Você cancela quando quiser. Ao assinar, você aceita a{" "}
                    <Link to="/termos">política de privacidade</Link>.
                  </p>
                </div>
              </div>
            ) : null}

            <div className="sec-head" style={{ marginTop: 56 }}>
              <h2>Metodologia</h2>
              <p className="lede">Como a nota é calculada</p>
            </div>
            <div className="cols3">
              <div>
                <h3>Desempenho técnico</h3>
                <p>Resultados em benchmarks públicos e em provas aplicadas em português.</p>
              </div>
              <div>
                <h3>Repercussão nas notícias</h3>
                <p>
                  O quanto a plataforma apareceu no noticiário nas últimas 24 horas e nos últimos 7
                  dias.
                </p>
              </div>
              <div>
                <h3>Avaliação dos leitores</h3>
                <p>
                  A média das notas dadas pelos leitores da IA News que usam a ferramenta no dia a
                  dia.
                </p>
              </div>
            </div>
            <p className="fine rk-method-note">
              A nota vai de 0 a 10 e é recalculada automaticamente todos os dias, às 6h. Dá para
              filtrar por categoria, por fabricante e por área de uso (conhecimento geral,
              contabilidade, jurídico, literatura brasileira, medicina ou nota dos leitores). Clique
              em uma plataforma para ver a avaliação completa, ou marque de 2 a 3 para comparar lado
              a lado.
            </p>

            <div className="sec-head" style={{ marginTop: 56 }}>
              <h2>Voto do leitor</h2>
              <p className="lede">Qual IA você mais usa no trabalho?</p>
            </div>
            <div className="ask">
              <p>
                Dê a sua nota de 1 a 5
                <span>Leva 10 segundos e a sua nota entra no cálculo do ranking de amanhã.</span>
              </p>
              <button
                type="button"
                className="btn blue s"
                onClick={() => {
                  setPromptDone(false);
                  setPromptOpen(true);
                }}
              >
                Avaliar uma plataforma
              </button>
            </div>
          </div>
        </div>
      </main>

      {compareTools.length && !compareOpen && !selected ? (
        <div className="rkx-cmpbar" role="region" aria-label="Comparação">
          <div className="rkx-cmp-logos">
            {compareTools.map((t) => (
              <button
                key={t.id}
                type="button"
                title={`Remover ${t.name}`}
                onClick={() => toggleCompare(t.id)}
              >
                <RankLogo m={t} />
                <span>{t.name}</span>
              </button>
            ))}
          </div>
          <button
            type="button"
            className="btn s blue"
            disabled={compareTools.length < 2}
            onClick={() => setCompareOpen(true)}
          >
            <GitCompare className="ico" aria-hidden="true" />
            {compareTools.length < 2 ? "Marque mais 1" : `Comparar ${compareTools.length}`}
          </button>
          <button type="button" className="more" onClick={() => setCompareIds([])}>
            Limpar
          </button>
        </div>
      ) : null}

      <CompareDialog
        tools={compareTools}
        open={compareOpen && compareTools.length >= 2}
        onClose={() => setCompareOpen(false)}
        onClear={() => {
          setCompareIds([]);
          setCompareOpen(false);
        }}
        onOpenTool={(t) => {
          setCompareOpen(false);
          setSelected(t);
        }}
      />

      <ToolDialog
        tool={selected}
        activeArea={activeArea === "semanal" || activeArea === "avaliacao" ? "geral" : activeArea}
        activeLabel={activeLabel}
        myRating={selected ? (myMap.get(selected.id) ?? null) : null}
        isAuthenticated={isAuthenticated}
        inCompare={selected ? compareIds.includes(selected.id) : false}
        onCompare={(t) => {
          if (!compareIds.includes(t.id)) toggleCompare(t.id);
          const n = compareIds.includes(t.id) ? compareIds.length : compareIds.length + 1;
          setSelected(null);
          if (n >= 2) setCompareOpen(true);
          else toast.info("Escolha mais uma plataforma na lista para comparar.");
        }}
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
    </>
  );
}
