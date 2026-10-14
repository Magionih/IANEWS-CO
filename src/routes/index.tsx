import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowRight, Clock } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import { SiteHeader } from "@/components/site/header";

import { SiteFooter } from "@/components/site/footer";
import { LeadCta } from "@/components/site/lead-cta";
import { HUB_LIST } from "@/lib/hubs";
import {
  CategoryChip,
  type CategoryKey,
  CATEGORY_MAP,
} from "@/components/site/category-chip";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { openSubscribe } from "@/components/site/subscribe-dialog";

import { listRecentArticles, type ArticleRow } from "@/lib/articles.functions";

type Story = {
  slug: string;
  title: string;
  dek: string;
  category: CategoryKey;
  cover: string;
  credit: string;
  source: string;
  readMin: number;
  publishedAt: string;
  dateLabel: string;
};

const FALLBACK_COVERS = [
  "https://images.unsplash.com/photo-1677442136019-21780ecad995?w=1600&q=80&auto=format&fit=crop",
  "https://images.unsplash.com/photo-1620712943543-bcc4688e7485?w=1200&q=80&auto=format&fit=crop",
  "https://images.unsplash.com/photo-1620321023374-d1a68fbc720d?w=1200&q=80&auto=format&fit=crop",
  "https://images.unsplash.com/photo-1633419461186-7d40a38105ec?w=1200&q=80&auto=format&fit=crop",
  "https://images.unsplash.com/photo-1559526324-4b87b5e36e44?w=1200&q=80&auto=format&fit=crop",
  "https://images.unsplash.com/photo-1556740738-b6a63e27c4df?w=1200&q=80&auto=format&fit=crop",
];

const fallbackStories: Story[] = [
  {
    slug: "openai-agente-autonomo-empresas",
    title: "OpenAI lança agente autônomo para empresas e mira o Brasil em 2026",
    dek: "Novo produto executa tarefas de ponta a ponta em navegadores corporativos, com controle de custo por sessão.",
    category: "bigtech",
    cover: FALLBACK_COVERS[0],
    credit: "Foto: Reprodução",
    source: "IA News",
    readMin: 6,
    publishedAt: "há 2h",
    dateLabel: "29 Jul 2026",
  },
  {
    slug: "nubank-ia-generativa-atendimento",
    title: "Nubank coloca IA generativa no atendimento e reduz custo em 30%",
    dek: "Banco migra fila de dúvidas para agente próprio treinado em português e libera time humano para casos complexos.",
    category: "brasil",
    cover: FALLBACK_COVERS[5],
    credit: "Foto: Reprodução",
    source: "Valor",
    readMin: 4,
    publishedAt: "há 4h",
    dateLabel: "29 Jul 2026",
  },
  {
    slug: "gemini-3-raciocinio",
    title: "Gemini 3 supera concorrentes em raciocínio matemático, mas perde em código",
    dek: "Benchmark independente mostra o Google à frente em provas de olimpíada e atrás em engenharia de software.",
    category: "pesquisa",
    cover: FALLBACK_COVERS[1],
    credit: "Foto: Reprodução",
    source: "IA News",
    readMin: 5,
    publishedAt: "há 6h",
    dateLabel: "29 Jul 2026",
  },
  {
    slug: "diretriz-ia-saude-brasil",
    title: "Brasil publica primeira diretriz para uso de IA em saúde",
    dek: "Regra exige rastreabilidade de dataset e monitoramento contínuo; hospitais têm 12 meses para se adequar.",
    category: "regulacao",
    cover: FALLBACK_COVERS[2],
    credit: "Foto: Reprodução",
    source: "IA News",
    readMin: 3,
    publishedAt: "há 8h",
    dateLabel: "28 Jul 2026",
  },
  {
    slug: "startup-brasileira-agentes-vendas",
    title: "Startup brasileira levanta US$ 40 mi para agentes de IA em vendas B2B",
    dek: "Rodada liderada por fundo americano coloca a companhia paulista no radar global de RevOps.",
    category: "startup",
    cover: FALLBACK_COVERS[4],
    credit: "Foto: Reprodução",
    source: "IA News",
    readMin: 4,
    publishedAt: "há 10h",
    dateLabel: "28 Jul 2026",
  },
  {
    slug: "copilot-office-brasil",
    title: "Copilot chega a todo o Office para clientes corporativos no Brasil",
    dek: "Rollout começa por empresas médias, com preço em reais e cobrança por usuário/mês.",
    category: "mercado",
    cover: FALLBACK_COVERS[3],
    credit: "Foto: Reprodução",
    source: "IA News",
    readMin: 3,
    publishedAt: "há 12h",
    dateLabel: "28 Jul 2026",
  },
  {
    slug: "llama-4-multimodal",
    title: "Meta abre modelo multimodal com licença comercial ampla",
    dek: "Modelo aceita texto, imagem e áudio e mira empresas preocupadas com dado soberano.",
    category: "generativa",
    cover: FALLBACK_COVERS[0],
    credit: "Foto: Reprodução",
    source: "IA News",
    readMin: 5,
    publishedAt: "há 14h",
    dateLabel: "27 Jul 2026",
  },
];

export const Route = createFileRoute("/")({
  loader: async () => {
    try {
      const articles = await listRecentArticles();
      return { articles };
    } catch (err) {
      console.error("[home] loader failed", err);
      return { articles: [] as ArticleRow[] };
    }
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

function HomePage() {
  const { articles } = Route.useLoaderData();
  const live: Story[] = articles.map((a: ArticleRow, i: number) => articleToStory(a, i));
  const all: Story[] = live.length > 0 ? live : fallbackStories;
  const lead = all[0];
  const secondary = all.slice(1, 3);
  const latest = all.slice(3, 9);
  const grid = all.slice(9, 15);
  const headlines = all.slice(15, 21);
  const mostRead = all.slice(0, 8);

  return (
    <div className="min-h-screen bg-background">
      <SiteHeader />
      <main className="mx-auto max-w-[1400px] px-4 py-6 sm:px-6 sm:py-8 lg:px-8">
        <CategoryBar />
        <AutoScrollRail stories={all.slice(0, 10)} />
        <LeadStory story={lead} />

        {secondary.length > 0 ? (
          <div className="mt-8 grid gap-6 border-t border-border pt-8 sm:grid-cols-2 sm:gap-8">
            {secondary.map((s) => (
              <StoryCard key={s.slug} story={s} />
            ))}
          </div>
        ) : null}

        {latest.length > 0 ? (
          <section className="mt-10">
            <SectionHeader label="Últimas notícias" />
            <ul className="divide-y divide-border">
              {latest.map((s) => (
                <li key={s.slug}>
                  <CompactRow story={s} />
                </li>
              ))}
            </ul>
          </section>
        ) : null}


        <SectionHeader className="mt-10" label="IA News Tech" />
        <div className="grid gap-8 sm:grid-cols-2">
          {grid.map((s) => (
            <StoryCard key={s.slug} story={s} />
          ))}
        </div>

        {headlines.length > 0 ? (
          <section className="mt-10">
            <SectionHeader label="Só as manchetes" />
            <ul className="divide-y divide-border border-y border-border">
              {headlines.map((s) => (
                <li key={s.slug} className="py-4">
                  <Link
                    to="/materia/$slug"
                    params={{ slug: s.slug }}
                    className="block hover:text-primary"
                  >
                    <span className="font-mono-eyebrow text-primary">
                      {CATEGORY_MAP[s.category].label}
                    </span>
                    <h3 className="mt-1.5 text-lg font-bold leading-snug sm:text-xl">
                      {s.title}
                    </h3>
                    <p className="mt-1.5 line-clamp-2 text-sm leading-relaxed text-muted-foreground">
                      {s.dek}
                    </p>
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        ) : null}

        <section className="mt-10 border border-border bg-secondary/40 p-5 sm:p-6">
          <p className="font-mono-eyebrow text-[color:var(--color-lime)]">Guia IA News</p>
          <h2 className="mt-2 text-xl font-extrabold leading-snug tracking-tight sm:text-2xl">
            IA para empresas: onde começar, quanto custa e como medir o retorno
          </h2>
          <p className="mt-2 text-sm leading-relaxed text-muted-foreground sm:text-base">
            Casos de uso por área, roteiro de 90 dias, governança e LGPD — o guia prático do IA
            News para quem decide.
          </p>
          <Link
            to="/artigos/inteligencia-artificial-nas-empresas"
            className="mt-4 inline-flex items-center gap-1 text-sm font-bold text-[color:var(--color-lime)] hover:underline"
          >
            Ler o guia completo <ArrowRight className="h-4 w-4" />
          </Link>
        </section>

        <section className="mt-8 border border-border p-5 sm:p-6">
          <p className="font-mono-eyebrow text-[color:var(--color-lime)]">Hubs temáticos</p>
          <h2 className="mt-2 text-xl font-extrabold leading-snug tracking-tight sm:text-2xl">
            Aprofunde por tema
          </h2>
          <ul className="mt-4 grid gap-3 sm:grid-cols-3">
            {HUB_LIST.map((h) => (
              <li key={h.slug} className="border border-border/70 p-4">
                <Link
                  to="/guias/$hub"
                  params={{ hub: h.slug }}
                  search={{ q: "", tema: "all" }}
                  className="text-sm font-extrabold leading-snug hover:text-[color:var(--color-lime)]"
                >
                  {h.h1}
                </Link>
                <p className="mt-2 line-clamp-3 text-xs leading-relaxed text-muted-foreground">
                  {h.description}
                </p>
              </li>
            ))}
          </ul>
        </section>


        <LeadCta
          className="mt-10"
          eyebrow="Boletim IA News"
          title="A IA muda todo dia. Receba só o que importa para o seu negócio."
          description="Uma edição diária com as decisões, lançamentos e riscos que afetam empresas brasileiras — mais o Ranking IA atualizado."
          action="Receber grátis"
            placement="home-band"
          />
        <div className="mt-10 flex justify-center">
          <Button asChild variant="outline" className="h-11 rounded-none px-6 font-semibold">
            <Link to="/noticias" search={{ q: "", cat: "all" }}>
              Ver todas as notícias <ArrowRight className="ml-1 h-4 w-4" />
            </Link>
          </Button>
        </div>
      </main>
      <MostReadRail stories={mostRead} />
      <NewsletterBlock />
      <SiteFooter />
    </div>
  );
}

function SectionHeader({ label, className }: { label: string; className?: string }) {
  return (
    <div className={`mb-5 flex items-center justify-between gap-4 ${className ?? ""}`}>
      <h2 className="bg-foreground px-3 py-1.5 text-sm font-bold uppercase tracking-wide text-background">
        {label}
      </h2>

      <Link
        to="/noticias"
        search={{ q: "", cat: "all" }}
        className="shrink-0 text-sm font-semibold text-muted-foreground hover:text-primary"
      >
        Ver tudo <ArrowRight className="ml-0.5 inline h-3.5 w-3.5" />
      </Link>
    </div>
  );
}

function CategoryBar() {
  const cats = Object.entries(CATEGORY_MAP) as Array<[CategoryKey, { label: string }]>;
  return (
    <nav className="-mt-1 mb-4 border-y border-border">
      <ul className="flex gap-5 overflow-x-auto py-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden sm:gap-7">
        {cats.map(([key, c]) => (
          <li key={key} className="shrink-0">
            <Link
              to="/categoria/$cat"
              params={{ cat: key }}

              className="text-[13px] font-medium uppercase tracking-wide text-muted-foreground transition-colors hover:text-primary sm:text-sm"
            >
              {c.label}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}

function AutoScrollRail({ stories }: { stories: Story[] }) {
  const ref = useRef<HTMLDivElement>(null);
  const [paused, setPaused] = useState(false);

  useEffect(() => {
    if (paused) return;
    const el = ref.current;
    if (!el) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    // rolagem contínua e lenta (~14px/s)
    let raf = 0;
    let last = performance.now();
    let acc = 0;
    const step = (now: number) => {
      const dt = now - last;
      last = now;
      acc += (dt / 1000) * 14;
      if (acc >= 1) {
        const move = Math.floor(acc);
        acc -= move;
        if (el.scrollLeft + el.clientWidth >= el.scrollWidth - 2) {
          el.scrollLeft = 0;
        } else {
          el.scrollLeft += move;
        }
      }
      raf = window.requestAnimationFrame(step);
    };
    raf = window.requestAnimationFrame(step);
    return () => window.cancelAnimationFrame(raf);
  }, [paused]);

  if (stories.length === 0) return null;

  return (
    <div
      ref={ref}
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onTouchStart={() => setPaused(true)}
      onTouchEnd={() => setPaused(false)}
      className="mb-6 flex gap-3 overflow-x-auto pb-3 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
    >
      {stories.map((s) => (
        <Link
          key={s.slug}
          to="/materia/$slug"
          params={{ slug: s.slug }}
          className="group flex w-[230px] shrink-0 gap-3 border border-border bg-card p-2 transition-colors hover:border-foreground sm:w-[260px]"
        >
          <img
            src={s.cover}
            alt={s.title}
            loading="lazy"
            className="h-14 w-16 shrink-0 object-cover"
          />
          <div className="min-w-0">
            <span className="font-mono-eyebrow text-primary">
              {CATEGORY_MAP[s.category].label}
            </span>
            <span className="mt-1 line-clamp-3 block text-[12px] font-semibold leading-snug group-hover:text-primary">
              {s.title}
            </span>

          </div>
        </Link>
      ))}
    </div>
  );
}

function CompactRow({ story }: { story: Story }) {
  return (
    <Link
      to="/materia/$slug"
      params={{ slug: story.slug }}
      className="group grid grid-cols-[112px_minmax(0,1fr)] items-start gap-4 py-4 sm:grid-cols-[180px_minmax(0,1fr)]"
    >
      <img
        src={story.cover}
        alt={story.title}
        loading="lazy"
        className="aspect-[4/3] w-full object-cover"
      />
      <div className="min-w-0">
        <span className="font-mono-eyebrow text-primary">
          {CATEGORY_MAP[story.category].label}
        </span>
        <h3 className="mt-1 text-base font-bold leading-snug group-hover:text-primary sm:text-lg">
          {story.title}
        </h3>
        <p className="mt-1.5 hidden line-clamp-2 text-sm text-muted-foreground sm:block">
          {story.dek}
        </p>
        <p className="mt-1.5 text-xs text-muted-foreground">
          {story.source} • {story.publishedAt}
        </p>
      </div>
    </Link>
  );
}

function MostReadRail({ stories }: { stories: Story[] }) {
  if (stories.length === 0) return null;
  return (
    <section className="border-t border-border bg-background py-10 text-foreground sm:py-12">
      <div className="mx-auto max-w-[1400px] px-4 sm:px-6 lg:px-8">
        <h2 className="text-center text-2xl font-extrabold text-foreground sm:text-4xl">
          As Mais Lidas agora
        </h2>
        <div className="mt-6 flex snap-x snap-mandatory gap-5 overflow-x-auto pb-4 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {stories.map((s, i) => (
            <article
              key={s.slug}
              className="w-[72vw] shrink-0 snap-start sm:w-[320px]"
            >
              <Link to="/materia/$slug" params={{ slug: s.slug }} className="group block">
                <img
                  src={s.cover}
                  alt={s.title}
                  loading="lazy"
                  className="aspect-[16/10] w-full object-cover"
                />
                <p className="mt-3 flex items-center gap-2 text-xs text-muted-foreground">
                  <span className="bg-[color:var(--color-lime)] px-2 py-0.5 font-bold text-white">
                    {i + 1}
                  </span>
                  {CATEGORY_MAP[s.category].label}
                </p>
                <h3 className="mt-2 text-lg font-bold leading-snug text-foreground group-hover:text-primary">
                  {s.title}
                </h3>
              </Link>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}

const VALID_CATS = new Set(Object.keys(CATEGORY_MAP));

function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const h = Math.max(1, Math.round(diff / 3_600_000));
  if (h < 24) return `há ${h}h`;
  return `há ${Math.round(h / 24)}d`;
}

function dateLabel(iso: string): string {
  return new Date(iso).toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    timeZone: "America/Sao_Paulo",
  });
}


function articleToStory(a: ArticleRow, i = 0): Story {
  const category = (VALID_CATS.has(a.category) ? a.category : "generativa") as CategoryKey;
  return {
    slug: a.slug,
    title: a.title,
    dek: a.dek ?? "",
    category,
    cover: a.cover_image_url ?? FALLBACK_COVERS[i % FALLBACK_COVERS.length],
    credit: a.source_name ? `Foto: ${a.source_name}` : "Foto: Reprodução",
    source: a.source_name ?? "IA News",
    readMin: a.read_minutes ?? 4,
    publishedAt: relativeTime(a.published_at),
    dateLabel: dateLabel(a.published_at),
  };
}


function LeadStory({ story }: { story: Story }) {
  return (
    <article className="group">
      <Link to="/materia/$slug" params={{ slug: story.slug }} className="relative block overflow-hidden">
        <img
          src={story.cover}
          alt={story.title}
          loading="eager"
          className="aspect-[16/9] w-full object-cover transition-transform duration-500 group-hover:scale-[1.02]"
        />
        <span className="absolute left-4 top-4">
          <CategoryChip category={story.category} variant="solid" />
        </span>
      </Link>
      <div className="mt-6">
        <h1 className="text-[1.7rem] font-extrabold leading-[1.15] tracking-tight text-foreground sm:text-3xl sm:leading-[1.1] md:text-5xl">
          <Link to="/materia/$slug" params={{ slug: story.slug }} className="hover:text-primary">
            {story.title}
          </Link>
        </h1>
        <p className="mt-3 max-w-3xl text-base leading-relaxed text-muted-foreground sm:mt-4 sm:text-lg">
          {story.dek}
        </p>
        <p className="mt-4 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted-foreground sm:mt-5">
          <span>Por {story.source}</span>
          <span className="text-border">•</span>
          <span>{story.dateLabel}</span>
          <span className="text-border">•</span>
          <span>
            <Clock className="mr-1 inline h-3.5 w-3.5" />
            {story.readMin} min
          </span>
        </p>
      </div>
    </article>
  );
}

function StoryCard({ story }: { story: Story }) {
  return (
    <article className="group flex flex-col">
      <Link to="/materia/$slug" params={{ slug: story.slug }} className="relative block overflow-hidden">
        <img
          src={story.cover}
          alt={story.title}
          loading="lazy"
          className="aspect-[16/10] w-full object-cover transition-transform duration-500 group-hover:scale-[1.04]"
        />
        <span className="absolute left-3 top-3">
          <CategoryChip category={story.category} variant="solid" />
        </span>
      </Link>
      <h3 className="mt-4 text-lg font-bold leading-snug text-foreground sm:text-xl">
        <Link to="/materia/$slug" params={{ slug: story.slug }} className="hover:text-primary">
          {story.title}
        </Link>
      </h3>

      <p className="mt-2 line-clamp-3 text-[15px] leading-relaxed text-muted-foreground">
        {story.dek}
      </p>
      <p className="mt-3 text-xs text-muted-foreground">
        {story.source} • {story.dateLabel}
      </p>
    </article>
  );
}

function NewsletterBlock() {
  return (
    <section className="mx-auto max-w-[1400px] px-4 py-10 sm:px-6 sm:py-12 lg:px-8">
      <div className="grid gap-6 bg-[color:var(--color-nav)] p-5 text-white sm:gap-8 sm:p-8 md:grid-cols-2 md:items-center md:p-12">
        <div>
          <p className="font-mono-eyebrow text-[color:var(--color-lime)]">
            Newsletter diária
          </p>
          <h2 className="mt-3 text-[1.6rem] font-extrabold leading-tight sm:text-3xl md:text-4xl">
            5 minutos por dia. Zero hype.
          </h2>
          <p className="mt-3 text-sm leading-relaxed text-white/70 sm:text-base">
            Grátis: o resumo do que muda na inteligência artificial, todo dia útil antes
            das 8h.
          </p>
        </div>
        <form
          className="flex w-full min-w-0 flex-col gap-3 sm:flex-row"
          onSubmit={(e) => {
            e.preventDefault();
            openSubscribe("home-newsletter-band");
          }}
        >
          <Input
            type="email"
            required
            placeholder="voce@empresa.com"
            className="h-12 w-full min-w-0 rounded-lg border-white/15 bg-white/10 px-4 text-base text-white placeholder:text-white/50"
          />
          <Button
            size="lg"
            className="h-12 w-full shrink-0 rounded-lg bg-[color:var(--color-lime)] px-6 font-bold text-white hover:bg-[color:var(--color-lime)]/90 sm:w-auto"
          >
            Assinar grátis
          </Button>
        </form>
      </div>
    </section>
  );
}
