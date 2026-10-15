import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";

import { SiteHeader } from "@/components/site/header";
import { SiteFooter } from "@/components/site/footer";
import { HUB_LIST } from "@/lib/hubs";
import { CATEGORY_SEO_LIST } from "@/lib/categories";
import { CATEGORY_MAP, type CategoryKey } from "@/components/site/category-chip";
import { NewsListing, SearchIcon } from "@/components/portal/news-card";
import { listArticlesFiltered, type ArticleRow } from "@/lib/articles.functions";

type Search = { q: string; cat: string };

export const Route = createFileRoute("/noticias")({
  validateSearch: (search: Partial<Record<keyof Search, unknown>>): Search => ({
    q: typeof search.q === "string" ? search.q : "",
    cat: typeof search.cat === "string" ? search.cat : "all",
  }),
  loaderDeps: ({ search }: { search: Search }) => ({ q: search.q, cat: search.cat }),
  loader: async ({ deps }) => {
    try {
      const articles = await listArticlesFiltered({
        data: { q: deps.q, category: deps.cat },
      });
      return { articles };
    } catch (err) {
      console.error("[noticias] loader failed", err);
      return { articles: [] as ArticleRow[] };
    }
  },
  head: ({ loaderData }) => ({
    meta: [
      { title: "Notícias de IA — busca e filtros por editoria | IA News" },
      {
        name: "description",
        content:
          "Todas as notícias de inteligência artificial do IA News, com busca por palavra-chave e filtro por editoria. Atualizado a cada 8 horas.",
      },
      { property: "og:title", content: "Notícias de IA — busca e filtros por editoria" },
      {
        property: "og:description",
        content:
          "Busque e filtre todas as matérias de inteligência artificial publicadas pelo IA News.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      { property: "og:url", content: "https://ianewsbr.com/noticias" },
    ],
    links: [{ rel: "canonical", href: "https://ianewsbr.com/noticias" }],
    scripts: [
      {
        type: "application/ld+json",
        children: JSON.stringify({
          "@context": "https://schema.org",
          "@type": "CollectionPage",
          name: "Notícias de inteligência artificial",
          description: "Todas as notícias de inteligência artificial publicadas pelo IA News.",
          url: "https://ianewsbr.com/noticias",
          isPartOf: { "@type": "WebSite", name: "IA News", url: "https://ianewsbr.com/" },
          publisher: { "@type": "Organization", name: "IA News", url: "https://ianewsbr.com/" },
        }),
      },
      {
        type: "application/ld+json",
        children: JSON.stringify({
          "@context": "https://schema.org",
          "@type": "BreadcrumbList",
          itemListElement: [
            { "@type": "ListItem", position: 1, name: "IA News", item: "https://ianewsbr.com/" },
            {
              "@type": "ListItem",
              position: 2,
              name: "Notícias",
              item: "https://ianewsbr.com/noticias",
            },
          ],
        }),
      },
      {
        type: "application/ld+json",
        children: JSON.stringify({
          "@context": "https://schema.org",
          "@type": "ItemList",
          name: "Notícias de inteligência artificial",
          numberOfItems: loaderData?.articles.length ?? 0,
          itemListElement: (loaderData?.articles ?? []).slice(0, 20).map((a, i) => ({
            "@type": "ListItem",
            position: i + 1,
            url: `https://ianewsbr.com/materia/${a.slug}`,
            name: a.title,
          })),
        }),
      },
    ],
  }),
  errorComponent: ({ error }) => (
    <div role="alert" className="p-10 text-center text-muted-foreground">
      {error instanceof Error ? error.message : "Não foi possível carregar."}
    </div>
  ),
  notFoundComponent: () => <div className="p-10 text-center">Nada por aqui.</div>,
  component: NoticiasPage,
});

const NEWS_SUB =
  "O noticiário de inteligência artificial que importa para quem trabalha e empreende no Brasil.";

function NoticiasPage() {
  const { articles } = Route.useLoaderData();
  const { q, cat } = Route.useSearch();
  const navigate = useNavigate({ from: "/noticias" });
  const cats = Object.entries(CATEGORY_MAP) as Array<[CategoryKey, { label: string }]>;
  const current = cat !== "all" ? CATEGORY_MAP[cat as CategoryKey] : undefined;
  const catValue = current ? cat : "all";
  const seo = current ? CATEGORY_SEO_LIST.find((c) => c.key === cat) : undefined;
  const term = q.trim();
  const n = articles.length;

  return (
    <>
      <SiteHeader />
      <main id="main" className="page">
        <div className="wrap">
          <div className="page-head">
            <p className="kick">Notícias</p>
            <h1>{current ? current.label : "Notícias de IA"}</h1>
            <p className="sub">{current ? (seo?.description ?? NEWS_SUB) : NEWS_SUB}</p>
          </div>

          <div className="toolbar">
            <form
              className="filter"
              role="search"
              onSubmit={(e) => {
                e.preventDefault();
                const value = new FormData(e.currentTarget).get("q");
                navigate({
                  search: (prev: Search) => ({
                    ...prev,
                    q: typeof value === "string" ? value : "",
                  }),
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
                  placeholder="Buscar nas matérias"
                  aria-label="Buscar nas matérias"
                  autoComplete="off"
                  enterKeyHint="search"
                />
              </label>
              <label className="filter-s">
                Editoria
                <select
                  aria-label="Editoria"
                  value={catValue}
                  onChange={(e) => {
                    const value = e.target.value;
                    if (value.startsWith("guia:")) {
                      navigate({
                        to: "/guias/$hub",
                        params: { hub: value.slice(5) },
                        search: { q: "", tema: "all" },
                      });
                      return;
                    }
                    navigate({ search: (p: Search) => ({ ...p, cat: value }) });
                  }}
                >
                  <option value="all">Todas as editorias</option>
                  <optgroup label="Editorias">
                    {cats.map(([key, value]) => (
                      <option key={key} value={key}>
                        {value.label}
                      </option>
                    ))}
                  </optgroup>
                  <optgroup label="Temas">
                    {HUB_LIST.map((h) => (
                      <option key={h.slug} value={`guia:${h.slug}`}>
                        {h.h1}
                      </option>
                    ))}
                  </optgroup>
                </select>
              </label>
            </form>
            <div className="filter-meta">
              <span role="status" aria-live="polite">
                {n === 1 ? "1 matéria" : `${n} matérias`}
                {term ? ` para “${term}”` : ""}
              </span>
              {catValue !== "all" || term ? (
                <button
                  className="more"
                  type="button"
                  onClick={() => navigate({ search: () => ({ q: "", cat: "all" }) })}
                >
                  Limpar
                </button>
              ) : null}
            </div>
          </div>

          <NewsListing
            articles={articles as ArticleRow[]}
            placement="noticias-band"
            resetKey={`${catValue}|${term}`}
          />

          <section className="sec" aria-label="Editorias e temas">
            <div className="sec-head">
              <h2>Editorias e guias</h2>
            </div>
            <div className="chips">
              {CATEGORY_SEO_LIST.map((c) => (
                <Link key={c.slug} className="chip" to="/categoria/$cat" params={{ cat: c.slug }}>
                  {c.label}
                </Link>
              ))}
              {HUB_LIST.map((h) => (
                <Link
                  key={h.slug}
                  className="chip"
                  to="/guias/$hub"
                  params={{ hub: h.slug }}
                  search={{ q: "", tema: "all" }}
                >
                  {h.h1}
                </Link>
              ))}
              <Link className="chip" to="/artigos/inteligencia-artificial-nas-empresas">
                IA para empresas
              </Link>
            </div>
          </section>
        </div>
      </main>
      <SiteFooter />
    </>
  );
}
