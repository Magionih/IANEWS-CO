import { createFileRoute } from "@tanstack/react-router";
import { SinceLastVisit } from "@/components/site/reader-hooks";

import { SiteHeader } from "@/components/site/header";
import { SiteFooter } from "@/components/site/footer";
import {
  HomeBizBand,
  HomeBrasil,
  HomeHero,
  HomeNews,
  HomeNewsletter,
  HomeSlimBand,
} from "@/components/portal/home-sections";
import {
  HomeCta,
  HomeDestaques,
  HomeParticipeV2,
  HomeRankingV2,
} from "@/components/portal/home-v2";
import {
  listArticlesFiltered,
  listEmAlta,
  listHomeDestaques,
  listRecentArticles,
  type ArticleRow,
  type DestaqueRow,
} from "@/lib/articles.functions";
import { listAiTools, type AiTool } from "@/lib/ai-ranking.functions";
import { FgiaPage, fgiaHead } from "@/components/fgia/fgia-page";
import { isFgiaHost } from "@/lib/fgia";
import { getRequestHostname } from "@/lib/fgia-host";
import { jsonLd } from "@/lib/json-ld";

/* Imagem de compartilhamento usada só quando nenhuma matéria tem capa. */
const FALLBACK_COVERS = [
  "https://images.unsplash.com/photo-1677442136019-21780ecad995?w=1600&q=80&auto=format&fit=crop",
];

export const Route = createFileRoute("/")({
  loader: async () => {
    // O domínio fgiaeducacao.com.br abre a landing da FGIA Educação na raiz.
    const host = await getRequestHostname().catch(() => "");
    if (isFgiaHost(host)) {
      return {
        fgia: true,
        articles: [] as ArticleRow[],
        destaques: [] as DestaqueRow[],
        emAlta: [] as DestaqueRow[],
        tools: [] as AiTool[],
        brasil: [] as ArticleRow[],
      };
    }
    const [articles, destaques, emAlta, tools, brasil] = await Promise.all([
      listRecentArticles().catch((err) => {
        console.error("[home] loader failed", err);
        return [] as ArticleRow[];
      }),
      listHomeDestaques().catch(() => [] as DestaqueRow[]),
      listEmAlta().catch(() => [] as DestaqueRow[]),
      listAiTools().catch(() => [] as AiTool[]),
      listArticlesFiltered({ data: { category: "brasil" } }).catch(() => [] as ArticleRow[]),
    ]);
    return { fgia: false, articles, destaques, emAlta, tools, brasil };
  },
  head: ({ loaderData }) => {
    if (loaderData?.fgia) return fgiaHead("https://fgiaeducacao.com.br/");
    const items = (loaderData?.articles ?? []).slice(0, 10);
    const title = "IA News: notícias de inteligência artificial e IA nas empresas";
    const description =
      "Notícias diárias de inteligência artificial: OpenAI, Google, Meta e empresas brasileiras que crescem com IA, guias e o Ranking IA. Newsletter grátis às 7h.";
    const cover =
      loaderData?.destaques?.[0]?.cover_image_url ??
      items[0]?.cover_image_url ??
      FALLBACK_COVERS[0];
    return {
      meta: [
        { title },
        { name: "description", content: description },
        { property: "og:title", content: title },
        { property: "og:description", content: description },
        { property: "og:type", content: "website" },
        { name: "twitter:card", content: "summary_large_image" },
        { property: "og:image", content: cover },
        { name: "twitter:image", content: cover },
        { property: "og:url", content: "https://ianewsbr.com/" },
      ],
      links: [{ rel: "canonical", href: "https://ianewsbr.com/" }],
      scripts: [
        {
          type: "application/ld+json",
          children: jsonLd({
            "@context": "https://schema.org",
            "@type": "CollectionPage",
            "@id": "https://ianewsbr.com/#homepage",
            url: "https://ianewsbr.com/",
            name: title,
            description,
            inLanguage: "pt-BR",
            isPartOf: { "@id": "https://ianewsbr.com/#website" },
            publisher: { "@id": "https://ianewsbr.com/#organization" },
            dateModified: items[0]?.published_at ?? undefined,
            mainEntity: {
              "@type": "ItemList",
              name: "Últimas notícias de inteligência artificial",
              itemListElement: items.map((a: ArticleRow, i: number) => ({
                "@type": "ListItem",
                position: i + 1,
                url: `https://ianewsbr.com/materia/${a.slug}`,
                name: a.title,
              })),
            },
          }),
        },
      ],
    };
  },

  component: HomePage,
});

const WEEK_MS = 7 * 24 * 3_600_000;

function HomePage() {
  const { fgia } = Route.useLoaderData();
  return fgia ? <FgiaPage /> : <PortalHome />;
}

function PortalHome() {
  const { articles, destaques, emAlta, tools, brasil } = Route.useLoaderData();
  const used = new Set<string>(destaques.map((a) => a.id));
  const take = (list: ArticleRow[], n: number, filter?: (a: ArticleRow) => boolean) => {
    const out: ArticleRow[] = [];
    for (const a of list) {
      if (out.length >= n) break;
      if (used.has(a.id) || (filter && !filter(a))) continue;
      used.add(a.id);
      out.push(a);
    }
    return out;
  };

  // "Em alta" pode repetir um destaque; tira os que já estão no carrossel quando sobra opção.
  const altaFresh = emAlta.filter((a) => !used.has(a.id));
  const alta = altaFresh.length >= 5 ? altaFresh : emAlta;
  alta.slice(0, 5).forEach((a) => used.add(a.id));

  // Últimas: 5 mais recentes e, ao lado, as que acabaram de sair com foto.
  const latest = take(articles, 5);
  const featured = take(articles, 5, (a) => !!a.cover_image_url);
  const news = take(articles, 5);

  const brasilItems = take(brasil, 10);
  const isBrasil = brasilItems.length > 0;
  const brItems = isBrasil ? brasilItems : take(articles, 10);

  const now = Date.now();
  const thisWeek = articles.filter((a) => now - new Date(a.published_at).getTime() <= WEEK_MS);
  const week = (thisWeek.length >= 3 ? thisWeek : articles).slice(0, 3);

  return (
    <>
      <SiteHeader />
      <main id="main">
        <div className="wrap">
          <HomeDestaques items={destaques} emAlta={alta} />
          <SinceLastVisit dates={articles.map((a) => a.published_at)} />
          <HomeSlimBand />
          <HomeParticipeV2 />
          <HomeHero featured={featured} latest={latest} />
          <HomeCta kind="pauta" />
          <HomeNews items={news} />
          <HomeRankingV2 tools={tools} />
          <HomeCta kind="eventos" />
          <HomeBrasil items={brItems} isBrasil={isBrasil} />
          <HomeCta kind="gente" />
          <HomeNewsletter week={week} />
          <HomeCta kind="anuncie" />
          <HomeBizBand />
        </div>
      </main>
      <SiteFooter />
    </>
  );
}
