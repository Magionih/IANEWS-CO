import { createFileRoute, Link } from "@tanstack/react-router";

import { SiteHeader } from "@/components/site/header";
import { SiteFooter } from "@/components/site/footer";
import { COMPANIES } from "@/lib/companies";
import { SITE_URL } from "@/lib/hubs";

const URL = `${SITE_URL}/empresas-de-ia`;
const TITLE = "Empresas de IA: OpenAI, Google, Meta, Anthropic, Nvidia e mais";
const DESCRIPTION =
  "As maiores empresas de IA e o que cada uma faz: OpenAI, Google, Meta, Anthropic, Nvidia, Microsoft, Nubank, Itaú, Magalu e mais, com as notícias da IA News.";

export const Route = createFileRoute("/empresas-de-ia/")({
  head: () => ({
    meta: [
      { title: `${TITLE} | IA News` },
      { name: "description", content: DESCRIPTION },
      { property: "og:title", content: TITLE },
      { property: "og:description", content: DESCRIPTION },
      { property: "og:type", content: "website" },
      { property: "og:url", content: URL },
    ],
    links: [{ rel: "canonical", href: URL }],
    scripts: [
      {
        type: "application/ld+json",
        children: JSON.stringify({
          "@context": "https://schema.org",
          "@type": "CollectionPage",
          url: URL,
          name: TITLE,
          description: DESCRIPTION,
          inLanguage: "pt-BR",
          isPartOf: { "@id": `${SITE_URL}/#website` },
          mainEntity: {
            "@type": "ItemList",
            itemListElement: COMPANIES.map((c, i) => ({
              "@type": "ListItem",
              position: i + 1,
              name: c.name,
              url: `${URL}/${c.slug}`,
            })),
          },
        }),
      },
    ],
  }),
  component: CompaniesIndex,
});

function CompaniesIndex() {
  return (
    <>
      <SiteHeader />
      <main id="main" className="page co">
        <div className="wrap">
          <header className="page-head">
            <p className="kick">Empresas de IA</p>
            <h1>As empresas que movem a inteligência artificial</h1>
            <p className="sub">
              O que cada grande empresa de IA faz, os produtos que importam para negócios e toda a
              cobertura da IA News sobre ela, atualizada todos os dias.
            </p>
          </header>
          <div className="co-grid">
            {COMPANIES.map((c) => (
              <Link
                key={c.slug}
                className="co-card"
                to="/empresas-de-ia/$empresa"
                params={{ empresa: c.slug }}
              >
                <b>{c.name}</b>
                <span>{c.products.slice(0, 3).join(" · ")}</span>
                <i>Ver notícias →</i>
              </Link>
            ))}
          </div>
        </div>
      </main>
      <SiteFooter />
    </>
  );
}
