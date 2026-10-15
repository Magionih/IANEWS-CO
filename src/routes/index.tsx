import { createFileRoute } from "@tanstack/react-router";

import { SiteHeader } from "@/components/site/header";
import { SiteFooter } from "@/components/site/footer";
import {
  HomeBizBand,
  HomeBrasil,
  HomeHero,
  HomeMostRead,
  HomeNews,
  HomeNewsletter,
  HomeRanking,
  HomeSlimBand,
} from "@/components/portal/home-sections";
import {
  listArticlesFiltered,
  listMostRead,
  listRecentArticles,
  type ArticleRow,
} from "@/lib/articles.functions";
import { listAiTools, type AiTool } from "@/lib/ai-ranking.functions";

/* Imagem de compartilhamento usada só quando nenhuma matéria tem capa. */
const FALLBACK_COVERS = [
  "https://images.unsplash.com/photo-1677442136019-21780ecad995?w=1600&q=80&auto=format&fit=crop",
];

export const Route = createFileRoute("/")({
  loader: async () => {
    const [articles, mostRead, tools, brasil] = await Promise.all([
      listRecentArticles().catch((err) => {
        console.error("[home] loader failed", err);
        return [] as ArticleRow[];
      }),
      listMostRead().catch(() => [] as ArticleRow[]),
      listAiTools().catch(() => [] as AiTool[]),
      listArticlesFiltered({ data: { category: "brasil" } }).catch(() => [] as ArticleRow[]),
    ]);
    return { articles, mostRead, tools, brasil };
  },
  head: ({ loaderData }) => {
    const items = (loaderData?.articles ?? []).slice(0, 10);
    const title = "IA News — notícias de inteligência artificial e Ranking IA";
    const description =
      "Notícias diárias de inteligência artificial no Brasil e no mundo, com análise para quem decide, e o Ranking IA das melhores ferramentas — atualizado todos os dias.";
    const cover = items[0]?.cover_image_url ?? FALLBACK_COVERS[0];
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
          children: JSON.stringify({
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
  const { articles, mostRead, tools, brasil } = Route.useLoaderData();
  const used = new Set<string>();
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

  // Hero: a mais recente com foto (senão a mais recente) + 4 "Últimas".
  const lead = articles.find((a) => a.cover_image_url) ?? articles[0] ?? null;
  if (lead) used.add(lead.id);
  const latest = take(articles, 4);
  const news = take(articles, 6);

  // IA no Brasil: editoria "brasil"; sem matérias dela, as recentes que sobraram.
  const brasilItems = take(brasil, 10);
  const isBrasil = brasilItems.length > 0;
  const brItems = isBrasil ? brasilItems : take(articles, 10);

  // Mais lidas (no lugar das Séries do protótipo): evita repetir o que já apareceu.
  const freshMost = mostRead.filter((a) => !used.has(a.id));
  const most = freshMost.length >= 3 ? freshMost : mostRead;

  // "Saiu na IANews esta semana": 3 matérias dos últimos 7 dias (ou as 3 mais recentes).
  const now = Date.now();
  const thisWeek = articles.filter((a) => now - new Date(a.published_at).getTime() <= WEEK_MS);
  const week = (thisWeek.length >= 3 ? thisWeek : articles).slice(0, 3);

  return (
    <>
      <SiteHeader />
      <main id="main">
        <div className="wrap">
          <HomeHero lead={lead} latest={latest} />
          <HomeSlimBand />
          <HomeNews items={news} />
          <HomeRanking tools={tools} />
          <HomeMostRead items={most} />
          <HomeBrasil items={brItems} isBrasil={isBrasil} />
          <HomeNewsletter week={week} />
          <HomeBizBand />
        </div>
      </main>
      <SiteFooter />
    </>
  );
}
