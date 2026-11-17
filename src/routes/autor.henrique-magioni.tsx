import { createFileRoute, Link } from "@tanstack/react-router";

import { SiteHeader } from "@/components/site/header";
import { SiteFooter } from "@/components/site/footer";
import { NewsGrid } from "@/components/portal/news-card";
import { listRecentArticles, type ArticleRow } from "@/lib/articles.functions";
import { EDITOR } from "@/lib/seo-quality";

/* Página do editor-chefe. Dá ao Google e às IAs uma pessoa responsável pelo conteúdo (E-E-A-T)
   e liga as matérias, que trazem "Edição: Henrique Magioni" na assinatura, a um perfil verificável. */

const DESCRIPTION =
  "Henrique Magioni é fundador, CEO e editor-chefe da IA News, veículo brasileiro de jornalismo sobre inteligência artificial para quem decide, e anfitrião do Palco IA News.";

export const Route = createFileRoute("/autor/henrique-magioni")({
  loader: async () => {
    try {
      const items = await listRecentArticles();
      return { items: items.slice(0, 12) };
    } catch {
      return { items: [] as ArticleRow[] };
    }
  },
  head: () => ({
    meta: [
      { title: "Henrique Magioni, fundador e editor-chefe da IA News" },
      { name: "description", content: DESCRIPTION },
      { property: "og:title", content: "Henrique Magioni, fundador e editor-chefe da IA News" },
      { property: "og:description", content: DESCRIPTION },
      { property: "og:url", content: EDITOR.url },
      { property: "og:type", content: "profile" },
    ],
    links: [{ rel: "canonical", href: EDITOR.url }],
    scripts: [
      {
        type: "application/ld+json",
        children: JSON.stringify({
          "@context": "https://schema.org",
          "@type": "ProfilePage",
          url: EDITOR.url,
          inLanguage: "pt-BR",
          mainEntity: {
            "@type": "Person",
            "@id": EDITOR.id,
            name: EDITOR.name,
            url: EDITOR.url,
            jobTitle: "Fundador, CEO e editor-chefe da IA News",
            worksFor: { "@id": "https://ianewsbr.com/#organization" },
            knowsAbout: [
              "Inteligência artificial",
              "IA para empresas",
              "Agentes de IA",
              "Startups de IA no Brasil",
              "Mídia e jornalismo de tecnologia",
            ],
            sameAs: ["https://www.instagram.com/henriquemagioni/"],
          },
        }),
      },
    ],
  }),
  component: AutorPage,
});

function AutorPage() {
  const { items } = Route.useLoaderData();
  return (
    <>
      <SiteHeader />
      <main id="main" className="autor">
        <section className="wrap autor-head">
          <span className="autor-mono" aria-hidden="true">
            HM
          </span>
          <div>
            <p className="autor-kick">Editor-chefe</p>
            <h1>Henrique Magioni</h1>
            <p className="autor-role">Fundador e CEO da IA News</p>
          </div>
        </section>

        <section className="wrap autor-bio">
          <p>
            <b>Henrique Magioni</b> é fundador, CEO e editor-chefe da IA News, veículo brasileiro que cobre inteligência
            artificial para quem decide: empresários, executivos e fornecedores de IA. A redação publica notícias todos os
            dias, entrevistas com empresários brasileiros que crescem com IA, a newsletter das 7h e o Ranking IA.
          </p>
          <p>
            Henrique conduz a linha editorial da IA News: priorizar histórias de pessoas e empresas reais, com números e
            fontes, em vez de promessas. Também comanda a FGIA Educação, vertical de eventos e aulas da IA News, e é o
            anfitrião do <Link to="/palco">Palco IA News</Link>, onde apresenta o Raio-X da IA nas empresas brasileiras e
            a <Link to="/lista100">Lista IA News 100</Link>.
          </p>
          <p>
            Como a redação trabalha, usa IA e escolhe as pautas: <Link to="/sobre">política editorial</Link>. Para enviar
            uma história: <Link to="/pauta" search={{}}>Envie sua pauta</Link>.
          </p>
          <p className="autor-social">
            <a href="https://www.instagram.com/henriquemagioni/" rel="me noopener" target="_blank">
              Instagram @henriquemagioni
            </a>
          </p>
        </section>

        {items.length ? (
          <section className="wrap autor-list" aria-labelledby="autor-list-h">
            <h2 id="autor-list-h">Últimas matérias da redação</h2>
            <NewsGrid items={items} />
          </section>
        ) : null}
      </main>
      <SiteFooter />
    </>
  );
}
