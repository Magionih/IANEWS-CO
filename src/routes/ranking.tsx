import { useEffect, useMemo, useState } from "react";
import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Check, GitCompare, Search } from "lucide-react";
import { toast } from "sonner";

import { SiteHeader } from "@/components/site/header";
import { SiteFooter } from "@/components/site/footer";
import { PortalSubscribeForm, useSubscribed } from "@/components/site/portal-subscribe";
import { useAuth } from "@/hooks/use-auth";
import { listAiTools, getMyToolRatings, type AiTool } from "@/lib/ai-ranking.functions";
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

type Search = { area?: string; cat?: string; q?: string; all?: boolean; maker?: string };

/** Quantas plataformas aparecem antes do botão "Ver todas". */
const FIRST_ROWS = 20;
/** Teto da lista completa (mantido do comportamento anterior). */
const MAX_ROWS = 50;

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
        { property: "og:url", content: "https://ianewsbr.com/ranking" },
      ],
      links: [{ rel: "canonical", href: "https://ianewsbr.com/ranking" }],
      scripts: [
        {
          type: "application/ld+json",
          children: JSON.stringify({
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

  const allCount = Math.min(filtered.length, MAX_ROWS);
  const visible = all ? filtered.slice(0, MAX_ROWS) : filtered.slice(0, FIRST_ROWS);

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

  const topFive = useMemo(
    () => [...tools].sort((a, b) => b.weekly_score - a.weekly_score).slice(0, 5),
    [tools],
  );

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

  const total = tools.length;
  const countText =
    filtered.length === total
      ? `${total} plataformas`
      : `${filtered.length === 1 ? "1" : filtered.length} de ${total} plataformas`;

  return (
    <>
      <SiteHeader />
      <main id="main">
        <div className="page" data-page="ranking">
          <div className="wrap">
            <div className="page-head">
              <p className="kick">Ranking IA</p>
              <h1>As melhores plataformas de IA</h1>
              <p className="sub">
                {total ? `${total} plataformas avaliadas` : "Plataformas avaliadas"} com nota de 0 a
                10. A nota combina desempenho técnico, repercussão nas notícias e avaliação dos
                leitores.
              </p>
              {filtered.length >= 3 ? (
                <p className="rk-answer">
                  <b>Resposta direta:</b> as três ferramentas de IA melhor colocadas hoje
                  {activeArea !== "semanal" ? ` em ${activeLabel}` : ""} são{" "}
                  <b>{filtered[0].name}</b> ({filtered[0].maker}), <b>{filtered[1].name}</b> (
                  {filtered[1].maker}) e <b>{filtered[2].name}</b> ({filtered[2].maker}).
                </p>
              ) : null}
              <p className="when" style={{ marginTop: 12 }}>
                Atualizado em {updatedAt}. Recálculo automático todos os dias, às 6h.
              </p>
            </div>

            {highlights.length ? (
              <div className="tiles">
                {highlights.map((h) => (
                  <button
                    key={h.label}
                    type="button"
                    className="tile rk-tile"
                    onClick={() => setSelected(h.tool)}
                  >
                    <span className="lb">{h.label}</span>
                    <span className="who">
                      <RankLogo m={h.tool} />
                      <b>{h.tool.name}</b>
                    </span>
                    <span className="sc">
                      {fmtScore(scoreFor(h.tool, "semanal"))}
                      <small>nota</small>
                    </span>
                  </button>
                ))}
              </div>
            ) : null}

            <div className="sec-head" style={{ marginTop: 44 }}>
              <h2>Classificação</h2>
            </div>
            <div className="toolbar">
              <div className="filter" role="search">
                <label className="filter-q">
                  <Search className="ico" aria-hidden="true" />
                  <input
                    type="search"
                    value={q}
                    onChange={(e) => setSearch({ q: e.target.value })}
                    placeholder="Buscar plataforma ou fabricante"
                    aria-label="Buscar plataforma ou fabricante"
                    autoComplete="off"
                  />
                </label>
                <label className="filter-s">
                  Categoria
                  <select
                    aria-label="Categoria"
                    value={activeCat}
                    onChange={(e) => setSearch({ cat: e.target.value })}
                  >
                    {CATEGORIES.map((c) => (
                      <option key={c.key} value={c.key}>
                        {c.label}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
              <div className="filter-meta">
                <span role="status" aria-live="polite">
                  {countText}
                </span>
                {isFiltered ? (
                  <button
                    className="more"
                    type="button"
                    onClick={() => setSearch({ cat: "todas", maker: "todos", q: "" })}
                  >
                    Limpar
                  </button>
                ) : null}
              </div>
            </div>

            <div className="rk-opts">
              <label>
                Nota
                <select
                  aria-label="Critério da nota"
                  value={activeArea}
                  onChange={(e) => setSearch({ area: e.target.value })}
                >
                  {AREAS.map((a) => (
                    <option key={a.key} value={a.key}>
                      {a.label}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Fabricante
                <select
                  aria-label="Fabricante"
                  value={activeMaker}
                  onChange={(e) => setSearch({ maker: e.target.value })}
                >
                  <option value="todos">Todos</option>
                  {makers.map((m) => (
                    <option key={m} value={m}>
                      {m}
                    </option>
                  ))}
                </select>
              </label>
              <button
                type="button"
                className={"btn s rk-cmp-go" + (compareTools.length >= 2 ? " blue" : " line")}
                onClick={() =>
                  compareTools.length >= 2
                    ? setCompareOpen(true)
                    : toast.info("Marque 2 ou 3 ferramentas na lista para comparar.")
                }
              >
                <GitCompare className="ico" aria-hidden="true" />
                Comparar{compareTools.length ? ` (${compareTools.length})` : ""}
              </button>
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
                    className={"rk-item" + (i < 3 ? " t3" : "")}
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

            {filtered.length > FIRST_ROWS ? (
              <div className="load-more">
                <button className="btn line" type="button" onClick={() => setSearch({ all: !all })}>
                  {all
                    ? `Mostrar só as ${FIRST_ROWS} primeiras`
                    : `Ver todas as ${allCount} plataformas`}
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
        myRating={selected ? (myMap.get(selected.id) ?? null) : null}
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
    </>
  );
}
