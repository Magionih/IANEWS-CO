import { createFileRoute, Link, notFound, useNavigate } from "@tanstack/react-router";

import { SiteHeader } from "@/components/site/header";
import { SiteFooter } from "@/components/site/footer";
import { NewsListing, SearchIcon } from "@/components/portal/news-card";
import { HUBS, SITE_URL, type HubConfig, type HubTheme } from "@/lib/hubs";
import { listArticlesForHub, type ArticleRow } from "@/lib/articles.functions";

type HubSearch = { q: string; tema: string };

export const Route = createFileRoute("/guias/$hub")({
  validateSearch: (search: Partial<Record<keyof HubSearch, unknown>>): HubSearch => ({
    q: typeof search.q === "string" ? search.q : "",
    tema: typeof search.tema === "string" ? search.tema : "all",
  }),
  loader: async ({ params }) => {
    const hub = HUBS[params.hub];
    if (!hub) throw notFound();
    let articles: ArticleRow[] = [];
    try {
      articles = await listArticlesForHub({
        data: { terms: hub.themes.flatMap((t) => t.terms), limit: 36 },
      });
    } catch (err) {
      console.error("[guias] loader failed", err);
    }
    return { hub, articles };
  },
  head: ({ loaderData }) => {
    if (!loaderData) {
      return {
        meta: [{ title: "Guia indisponível — IA News" }, { name: "robots", content: "noindex" }],
      };
    }
    const { hub, articles } = loaderData;
    const url = `${SITE_URL}/guias/${hub.slug}`;
    return {
      meta: [
        { title: `${hub.title} | IA News` },
        { name: "description", content: hub.description },
        { property: "og:title", content: hub.title },
        { property: "og:description", content: hub.description },
        { property: "og:type", content: "website" },
        { property: "og:url", content: url },
        { name: "twitter:card", content: "summary_large_image" },
      ],
      links: [{ rel: "canonical", href: url }],
      scripts: [
        {
          type: "application/ld+json",
          children: JSON.stringify({
            "@context": "https://schema.org",
            "@type": "CollectionPage",
            name: hub.title,
            description: hub.description,
            url,
            isPartOf: { "@type": "WebSite", name: "IA News", url: `${SITE_URL}/` },
            publisher: { "@type": "Organization", name: "IA News", url: `${SITE_URL}/` },
          }),
        },
        {
          type: "application/ld+json",
          children: JSON.stringify({
            "@context": "https://schema.org",
            "@type": "BreadcrumbList",
            itemListElement: [
              { "@type": "ListItem", position: 1, name: "IA News", item: `${SITE_URL}/` },
              {
                "@type": "ListItem",
                position: 2,
                name: "Guias",
                item: `${SITE_URL}/guias/${hub.slug}`,
              },
              { "@type": "ListItem", position: 3, name: hub.h1, item: url },
            ],
          }),
        },
        {
          type: "application/ld+json",
          children: JSON.stringify({
            "@context": "https://schema.org",
            "@type": "ItemList",
            name: hub.title,
            numberOfItems: articles.length,
            itemListElement: articles.slice(0, 20).map((a, i) => ({
              "@type": "ListItem",
              position: i + 1,
              url: `${SITE_URL}/materia/${a.slug}`,
              name: a.title,
            })),
          }),
        },
        ...(hub.faq.length
          ? [
              {
                type: "application/ld+json",
                children: JSON.stringify({
                  "@context": "https://schema.org",
                  "@type": "FAQPage",
                  mainEntity: hub.faq.map((f) => ({
                    "@type": "Question",
                    name: f.q,
                    acceptedAnswer: { "@type": "Answer", text: f.a },
                  })),
                }),
              },
            ]
          : []),
      ],
    };
  },
  errorComponent: ({ error }) => (
    <div role="alert" className="p-10 text-center text-muted-foreground">
      {error instanceof Error ? error.message : "Não foi possível carregar."}
    </div>
  ),
  notFoundComponent: HubNotFound,
  component: HubPage,
});

function HubNotFound() {
  return (
    <>
      <SiteHeader />
      <main id="main" className="page">
        <div className="wrap">
          <div className="page-head">
            <p className="kick">Guias</p>
            <h1>Guia não encontrado</h1>
            <p className="sub">Este hub não existe ou foi movido. Veja todas as nossas matérias.</p>
          </div>
          <Link className="btn" to="/noticias" search={{ q: "", cat: "all" }}>
            Ir para Notícias
          </Link>
        </div>
      </main>
      <SiteFooter />
    </>
  );
}

function matchesTheme(article: ArticleRow, theme: HubTheme): boolean {
  const haystack =
    `${article.title} ${article.dek ?? ""} ${article.why_it_matters ?? ""} ${article.category}`.toLowerCase();
  return theme.terms.some((t) => haystack.includes(t.toLowerCase()));
}

function HubPage() {
  const { hub, articles } = Route.useLoaderData() as { hub: HubConfig; articles: ArticleRow[] };
  const { q, tema } = Route.useSearch();
  const navigate = useNavigate({ from: "/guias/$hub" });

  const term = q.trim().toLowerCase();
  const activeTheme = hub.themes.find((t) => t.id === tema);
  const filtered = articles.filter((a) => {
    const byTheme = tema === "all" || (activeTheme ? matchesTheme(a, activeTheme) : true);
    const byTerm = !term || `${a.title} ${a.dek ?? ""}`.toLowerCase().includes(term);
    return byTheme && byTerm;
  });
  const n = filtered.length;
  const setTema = (id: string) => navigate({ search: (p: HubSearch) => ({ ...p, tema: id }) });

  return (
    <>
      <SiteHeader />
      <main id="main" className="page">
        <div className="wrap">
          <nav aria-label="Trilha" className="crumbs">
            <Link to="/">Início</Link>
            <span aria-hidden="true">/</span>
            <Link to="/noticias" search={{ q: "", cat: "all" }}>
              Notícias
            </Link>
            <span aria-hidden="true">/</span>
            <span>{hub.h1}</span>
          </nav>

          <div className="page-head">
            <p className="kick">{hub.eyebrow}</p>
            <h1>{hub.h1}</h1>
            {hub.intro.map((p) => (
              <p key={p} className="sub">
                {p}
              </p>
            ))}
          </div>

          {/* Temas do hub */}
          <section aria-label="Temas" className="tiles themes" style={{ marginBottom: 28 }}>
            {hub.themes.map((t) => (
              <button
                key={t.id}
                type="button"
                className="tile"
                aria-pressed={tema === t.id}
                onClick={() => setTema(t.id)}
              >
                <h2>{t.title}</h2>
                <p>{t.description}</p>
              </button>
            ))}
          </section>

          {/* Busca + tema (uma barra só, como no protótipo) */}
          <div className="toolbar">
            <form
              className="filter"
              role="search"
              onSubmit={(e) => {
                e.preventDefault();
                const value = new FormData(e.currentTarget).get("q");
                navigate({
                  search: (p: HubSearch) => ({ ...p, q: typeof value === "string" ? value : "" }),
                });
              }}
            >
              <label className="filter-q">
                <SearchIcon />
                <input
                  name="q"
                  type="search"
                  defaultValue={q}
                  key={q}
                  placeholder={`Buscar em ${hub.h1.toLowerCase()}`}
                  aria-label="Buscar neste hub"
                  autoComplete="off"
                  enterKeyHint="search"
                />
              </label>
              <label className="filter-s">
                Tema
                <select
                  aria-label="Tema"
                  value={activeTheme ? tema : "all"}
                  onChange={(e) => setTema(e.target.value)}
                >
                  <option value="all">Todos os temas</option>
                  {hub.themes.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.title}
                    </option>
                  ))}
                </select>
              </label>
            </form>
            <div className="filter-meta">
              <span role="status" aria-live="polite">
                {n === 1 ? "1 matéria" : `${n} matérias`} nesta seleção
              </span>
              {q || tema !== "all" ? (
                <button
                  className="more"
                  type="button"
                  onClick={() => navigate({ search: () => ({ q: "", tema: "all" }) })}
                >
                  Limpar
                </button>
              ) : null}
            </div>
          </div>

          <NewsListing
            articles={filtered}
            placement="guia-band"
            resetKey={`${tema}|${term}`}
            band={
              hub.cta === "newsletter"
                ? {
                    title: hub.ctaTitle,
                    text: hub.ctaDescription,
                    button: hub.ctaAction,
                  }
                : false
            }
            emptyText={
              <>
                <b style={{ color: "var(--p-ink)" }}>Ainda não temos matérias nesta seleção.</b>{" "}
                Publicamos novas matérias todos os dias às 7h. Assine a newsletter para receber
                assim que sair.{" "}
                <Link className="more" to="/noticias" search={{ q: "", cat: "all" }}>
                  Ver todas as notícias
                </Link>
              </>
            }
          />

          {/* CTA de contato (hubs B2B) */}
          {hub.cta === "contato" ? (
            <section className="ask" style={{ marginTop: 40 }}>
              <div style={{ flex: "1 1 320px", minWidth: 0 }}>
                <p className="kick" style={{ marginBottom: 6 }}>
                  Fale com a gente
                </p>
                <h2 style={{ fontSize: 20 }}>{hub.ctaTitle}</h2>
                <p style={{ fontWeight: 400, color: "var(--p-ink-2)", marginTop: 6 }}>
                  {hub.ctaDescription}
                </p>
              </div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                <Link className="btn blue" to="/contato">
                  {hub.ctaAction} →
                </Link>
                <Link className="btn line" to="/anuncie">
                  Anunciar no IA News
                </Link>
              </div>
            </section>
          ) : null}

          {/* Perguntas frequentes */}
          {hub.faq.length ? (
            <section className="sec" style={{ maxWidth: 760 }}>
              <div className="sec-head">
                <h2>Perguntas frequentes</h2>
              </div>
              <div className="faq">
                {hub.faq.map((f) => (
                  <details key={f.q}>
                    <summary>{f.q}</summary>
                    <p>{f.a}</p>
                  </details>
                ))}
              </div>
            </section>
          ) : null}

          {/* Links internos */}
          <section className="sec">
            <div className="sec-head">
              <h2>Continue pelo IA News</h2>
            </div>
            <ul className="plain links-list">
              <li>
                <Link to="/artigos/inteligencia-artificial-nas-empresas">
                  Guia: IA para empresas — implementação em 90 dias
                </Link>
              </li>
              {Object.values(HUBS)
                .filter((h) => h.slug !== hub.slug)
                .map((h) => (
                  <li key={h.slug}>
                    <Link to="/guias/$hub" params={{ hub: h.slug }} search={{ q: "", tema: "all" }}>
                      Hub: {h.h1}
                    </Link>
                  </li>
                ))}
              <li>
                <Link to="/ranking">Ranking IA — comparação das principais ferramentas</Link>
              </li>
              <li>
                <Link to="/noticias" search={{ q: "", cat: "all" }}>
                  Todas as notícias de inteligência artificial
                </Link>
              </li>
            </ul>
          </section>
        </div>
      </main>
      <SiteFooter />
    </>
  );
}
