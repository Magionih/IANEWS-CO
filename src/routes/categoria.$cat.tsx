import { createFileRoute, Link, notFound } from "@tanstack/react-router";

import { SiteHeader } from "@/components/site/header";
import { SiteFooter } from "@/components/site/footer";
import { CATEGORY_SEO, CATEGORY_SEO_LIST } from "@/lib/categories";
import { NewsListing } from "@/components/portal/news-card";
import { listArticlesFiltered, type ArticleRow } from "@/lib/articles.functions";

const SITE = "https://ianewsbr.com";

export const Route = createFileRoute("/categoria/$cat")({
  loader: async ({ params }) => {
    const seo = CATEGORY_SEO[params.cat];
    if (!seo) throw notFound();
    let articles: ArticleRow[] = [];
    try {
      articles = await listArticlesFiltered({ data: { category: seo.key } });
    } catch (err) {
      console.error("[categoria] loader failed", err);
    }
    return { seo, articles };
  },
  head: ({ params, loaderData }) => {
    const seo = loaderData?.seo ?? CATEGORY_SEO[params.cat];
    if (!seo) return { meta: [{ title: "Editoria não encontrada — IA News" }] };
    const url = `${SITE}/categoria/${seo.slug}`;
    const items = (loaderData?.articles ?? []).slice(0, 20);
    const cover = items[0]?.cover_image_url ?? undefined;
    return {
      meta: [
        { title: seo.title },
        { name: "description", content: seo.description },
        { name: "keywords", content: seo.keywords.join(", ") },
        { property: "og:title", content: seo.title },
        { property: "og:description", content: seo.description },
        { property: "og:type", content: "website" },
        { property: "og:url", content: url },
        { name: "twitter:card", content: "summary_large_image" },
        ...(cover
          ? [
              { property: "og:image", content: cover },
              { name: "twitter:image", content: cover },
            ]
          : []),
      ],
      links: [{ rel: "canonical", href: url }],
      scripts: [
        {
          type: "application/ld+json",
          children: JSON.stringify({
            "@context": "https://schema.org",
            "@graph": [
              {
                "@type": "CollectionPage",
                "@id": `${url}#webpage`,
                url,
                name: seo.title,
                headline: seo.h1,
                description: seo.description,
                inLanguage: "pt-BR",
                isPartOf: { "@id": `${SITE}/#website` },
                publisher: { "@id": `${SITE}/#organization` },
                about: seo.keywords.map((k) => ({ "@type": "Thing", name: k })),
                dateModified: items[0]?.published_at ?? undefined,
                mainEntity: {
                  "@type": "ItemList",
                  name: seo.h1,
                  numberOfItems: items.length,
                  itemListElement: items.map((a, i) => ({
                    "@type": "ListItem",
                    position: i + 1,
                    url: `${SITE}/materia/${a.slug}`,
                    name: a.title,
                  })),
                },
              },
              {
                "@type": "BreadcrumbList",
                itemListElement: [
                  { "@type": "ListItem", position: 1, name: "IA News", item: `${SITE}/` },
                  { "@type": "ListItem", position: 2, name: "Notícias", item: `${SITE}/noticias` },
                  { "@type": "ListItem", position: 3, name: seo.label, item: url },
                ],
              },
            ],
          }),
        },
      ],
    };
  },
  notFoundComponent: () => (
    <>
      <SiteHeader />
      <main id="main" className="page">
        <div className="wrap">
          <div className="page-head">
            <p className="kick">Editoria</p>
            <h1>Editoria não encontrada</h1>
          </div>
          <Link className="btn" to="/noticias" search={{ q: "", cat: "all" }}>
            Ver todas as notícias
          </Link>
        </div>
      </main>
      <SiteFooter />
    </>
  ),
  component: CategoriaPage,
});

function CategoriaPage() {
  const { seo, articles } = Route.useLoaderData();
  const others = CATEGORY_SEO_LIST.filter((c) => c.slug !== seo.slug);
  const n = articles.length;

  return (
    <>
      <SiteHeader />
      <main id="main" className="page">
        <div className="wrap">
          <nav aria-label="Trilha" className="crumbs">
            <Link to="/">IA News</Link>
            <span aria-hidden="true">/</span>
            <Link to="/noticias" search={{ q: "", cat: "all" }}>
              Notícias
            </Link>
            <span aria-hidden="true">/</span>
            <span>{seo.label}</span>
          </nav>

          <div className="page-head">
            <p className="kick">Editoria · {seo.label}</p>
            <h1>{seo.h1}</h1>
            <p className="sub">{seo.intro}</p>
            {seo.related.length ? (
              <div className="chips" style={{ marginTop: 16 }}>
                {seo.related.map((r) => (
                  <a key={r.href} className="chip" href={r.href}>
                    {r.label}
                  </a>
                ))}
              </div>
            ) : null}
          </div>

          {n > 0 ? (
            <div className="toolbar">
              <div className="filter-meta" style={{ marginLeft: 0 }}>
                <span role="status">
                  {n === 1 ? "1 matéria" : `${n} matérias`} em {seo.label}
                </span>
                <Link className="more" to="/noticias" search={{ q: "", cat: seo.key }}>
                  Buscar nesta editoria
                </Link>
              </div>
            </div>
          ) : null}

          <NewsListing
            articles={articles as ArticleRow[]}
            placement="categoria"
            band={{
              title: `Receba as notícias de ${seo.label} antes das 8h`,
              text: "A newsletter diária do IA News resume o que importa para quem decide. Grátis.",
            }}
            emptyText={
              <>
                Ainda não há matérias publicadas nesta editoria.{" "}
                <Link className="more" to="/noticias" search={{ q: "", cat: "all" }}>
                  Ver todas as notícias
                </Link>
              </>
            }
          />

          <section className="sec" aria-label="Outras editorias">
            <div className="sec-head">
              <h2>Outras editorias</h2>
            </div>
            <div className="grid-4">
              {others.map((c) => (
                <Link
                  key={c.slug}
                  className="card"
                  to="/categoria/$cat"
                  params={{ cat: c.slug }}
                  style={{ borderTop: "1px solid var(--p-rule)", paddingTop: 14 }}
                >
                  <span className="kick">Editoria</span>
                  <h3 style={{ fontSize: 17 }}>{c.label}</h3>
                  <p className="dek" style={{ fontSize: 14 }}>
                    {c.description}
                  </p>
                </Link>
              ))}
            </div>
          </section>
        </div>
      </main>
      <SiteFooter />
    </>
  );
}
