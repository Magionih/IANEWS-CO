import { createFileRoute, Link, notFound } from "@tanstack/react-router";

import { SiteHeader } from "@/components/site/header";
import { SiteFooter } from "@/components/site/footer";
import { NewsListing } from "@/components/portal/news-card";
import { COMPANIES, COMPANY_MAP } from "@/lib/companies";
import { SITE_URL } from "@/lib/hubs";
import { listArticlesForHub, type ArticleRow } from "@/lib/articles.functions";

export const Route = createFileRoute("/empresas-de-ia/$empresa")({
  loader: async ({ params }) => {
    const company = COMPANY_MAP[params.empresa];
    if (!company) throw notFound();
    let articles: ArticleRow[] = [];
    try {
      articles = await listArticlesForHub({ data: { terms: company.terms, limit: 30 } });
    } catch (err) {
      console.error("[empresas-de-ia] loader failed", err);
    }
    return { slug: company.slug, articles };
  },
  head: ({ loaderData }) => {
    const c = loaderData ? COMPANY_MAP[loaderData.slug] : undefined;
    if (!c)
      return {
        meta: [
          { title: "Empresa não encontrada | IA News" },
          { name: "robots", content: "noindex" },
        ],
      };
    const url = `${SITE_URL}/empresas-de-ia/${c.slug}`;
    const articles = loaderData?.articles ?? [];
    const cover =
      articles.find((a) => a.cover_image_url)?.cover_image_url ?? `${SITE_URL}/og-ianews.png`;
    return {
      meta: [
        { title: c.title.length > 56 ? c.title : `${c.title} | IA News` },
        { name: "description", content: c.description },
        { property: "og:title", content: c.title },
        { property: "og:description", content: c.description },
        { property: "og:type", content: "website" },
        { property: "og:url", content: url },
        { property: "og:image", content: cover },
        { name: "twitter:card", content: "summary_large_image" },
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
                "@id": `${url}#page`,
                url,
                name: c.title,
                description: c.description,
                inLanguage: "pt-BR",
                isPartOf: { "@id": `${SITE_URL}/#website` },
                publisher: { "@id": `${SITE_URL}/#organization` },
                about: { "@id": `${url}#org` },
                dateModified: articles[0]?.published_at,
                mainEntity: {
                  "@type": "ItemList",
                  numberOfItems: articles.length,
                  itemListElement: articles.slice(0, 20).map((a, i) => ({
                    "@type": "ListItem",
                    position: i + 1,
                    url: `${SITE_URL}/materia/${a.slug}`,
                    name: a.title,
                  })),
                },
              },
              {
                "@type": "Organization",
                "@id": `${url}#org`,
                name: c.name,
                url: c.website,
                sameAs: [c.wikipedia],
                foundingDate: c.foundingDate,
                ...(c.founders.length
                  ? { founder: c.founders.map((name) => ({ "@type": "Person", name })) }
                  : {}),
              },
              {
                "@type": "FAQPage",
                mainEntity: c.faq.map((f) => ({
                  "@type": "Question",
                  name: f.q,
                  acceptedAnswer: { "@type": "Answer", text: f.a },
                })),
              },
              {
                "@type": "BreadcrumbList",
                itemListElement: [
                  { "@type": "ListItem", position: 1, name: "IA News", item: `${SITE_URL}/` },
                  {
                    "@type": "ListItem",
                    position: 2,
                    name: "Empresas de IA",
                    item: `${SITE_URL}/empresas-de-ia`,
                  },
                  { "@type": "ListItem", position: 3, name: c.name, item: url },
                ],
              },
            ],
          }),
        },
      ],
    };
  },
  component: CompanyPage,
});

function CompanyPage() {
  const { slug, articles } = Route.useLoaderData();
  const c = COMPANY_MAP[slug];
  const others = COMPANIES.filter((o) => o.slug !== slug);
  return (
    <>
      <SiteHeader />
      <main id="main" className="page co">
        <div className="wrap">
          <nav aria-label="Trilha" className="crumbs">
            <Link to="/">IA News</Link> <span aria-hidden="true">/</span>{" "}
            <Link to="/empresas-de-ia">Empresas de IA</Link> <span aria-hidden="true">/</span>{" "}
            <span>{c.name}</span>
          </nav>

          <header className="co-head">
            <p className="kick">Empresas de IA</p>
            <h1>{c.h1}</h1>
            {c.intro.map((p) => (
              <p key={p} className="sub">
                {p}
              </p>
            ))}
            <dl className="co-facts">
              {c.facts.map((f) => (
                <div key={f.label}>
                  <dt>{f.label}</dt>
                  <dd>{f.value}</dd>
                </div>
              ))}
              <div>
                <dt>Matérias na IA News</dt>
                <dd>{articles.length}</dd>
              </div>
            </dl>
            <p className="co-products">
              <b>Produtos de IA:</b> {c.products.join(" · ")}
            </p>
          </header>

          <div className="sec-head" style={{ marginTop: 32 }}>
            <h2>Últimas notícias sobre {c.short}</h2>
          </div>
          <NewsListing
            articles={articles}
            placement="empresa-ia-band"
            band={{
              title: `Notícias de ${c.short} e de IA, todo dia às 7h`,
              text: "O resumo da IA para quem decide, grátis no seu e-mail.",
              button: "Assinar grátis",
            }}
            emptyText={
              <>
                Ainda não publicamos matérias sobre {c.name}.{" "}
                <Link className="more" to="/noticias" search={{}}>
                  Ver todas as notícias
                </Link>
              </>
            }
          />

          <section className="sec" style={{ maxWidth: 760 }}>
            <div className="sec-head">
              <h2>Perguntas frequentes sobre {c.short}</h2>
            </div>
            <div className="faq">
              {c.faq.map((f) => (
                <details key={f.q}>
                  <summary>{f.q}</summary>
                  <p>{f.a}</p>
                </details>
              ))}
            </div>
          </section>

          <section className="sec">
            <div className="sec-head">
              <h2>Outras empresas de IA</h2>
            </div>
            <ul className="co-chips">
              {others.map((o) => (
                <li key={o.slug}>
                  <Link to="/empresas-de-ia/$empresa" params={{ empresa: o.slug }}>
                    {o.name}
                  </Link>
                </li>
              ))}
              <li>
                <Link to="/ranking">Ranking IA →</Link>
              </li>
            </ul>
          </section>
        </div>
      </main>
      <SiteFooter />
    </>
  );
}
