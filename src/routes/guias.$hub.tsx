import { createFileRoute, Link, notFound, useNavigate } from "@tanstack/react-router";
import { ArrowRight, Clock, Search, X } from "lucide-react";

import { SiteHeader } from "@/components/site/header";
import { SiteFooter } from "@/components/site/footer";
import { Breadcrumbs } from "@/components/site/breadcrumbs";
import { LeadCta } from "@/components/site/lead-cta";
import { CATEGORY_MAP, CategoryChip, type CategoryKey } from "@/components/site/category-chip";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { HUBS, SITE_URL, type HubConfig, type HubTheme } from "@/lib/hubs";
import { listArticlesForHub, type ArticleRow } from "@/lib/articles.functions";

const FALLBACK_COVER =
  "https://images.unsplash.com/photo-1677442136019-21780ecad995?w=1200&q=80&auto=format&fit=crop";

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
              { "@type": "ListItem", position: 2, name: "Guias", item: `${SITE_URL}/guias/${hub.slug}` },
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
      {error.message}
    </div>
  ),
  notFoundComponent: HubNotFound,
  component: HubPage,
});

function HubNotFound() {
  return (
    <div className="min-h-screen bg-background">
      <SiteHeader />
      <main className="mx-auto max-w-3xl px-4 py-24 text-center">
        <h1 className="text-3xl font-extrabold">Guia não encontrado</h1>
        <p className="mt-3 text-muted-foreground">
          Este hub não existe ou foi movido. Veja todas as nossas matérias.
        </p>
        <Button asChild className="mt-6 h-11 rounded-none px-6 font-semibold">
          <Link to="/noticias" search={{ q: "", cat: "all" }}>
            Ir para Notícias
          </Link>
        </Button>
      </main>
      <SiteFooter />
    </div>
  );
}

function dateLabel(iso: string): string {
  return new Date(iso).toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    timeZone: "America/Sao_Paulo",
  });
}

function matchesTheme(article: ArticleRow, theme: HubTheme): boolean {
  const haystack = `${article.title} ${article.dek ?? ""} ${article.why_it_matters ?? ""} ${article.category}`.toLowerCase();
  return theme.terms.some((t) => haystack.includes(t.toLowerCase()));
}

function HubPage() {
  const { hub, articles } = Route.useLoaderData() as { hub: HubConfig; articles: ArticleRow[] };
  const { q, tema } = Route.useSearch();
  const navigate = useNavigate({ from: "/guias/$hub" });

  const term = q.trim().toLowerCase();
  const filtered = articles.filter((a) => {
    const byTheme =
      tema === "all" ||
      (() => {
        const theme = hub.themes.find((t) => t.id === tema);
        return theme ? matchesTheme(a, theme) : true;
      })();
    const byTerm =
      !term || `${a.title} ${a.dek ?? ""}`.toLowerCase().includes(term);
    return byTheme && byTerm;
  });

  const validCats = new Set(Object.keys(CATEGORY_MAP));

  return (
    <div className="min-h-screen bg-background">
      <SiteHeader />
      <main className="mx-auto max-w-[1400px] px-4 py-8 sm:px-6 sm:py-12 lg:px-8">
        <Breadcrumbs
          items={[
            { label: "Início", to: "/" },
            { label: "Notícias", to: "/noticias" },
            { label: hub.h1 },
          ]}
        />

        <header className="mt-5 max-w-3xl">
          <p className="font-mono-eyebrow text-[color:var(--color-lime)]">{hub.eyebrow}</p>
          <h1 className="mt-2 text-3xl font-extrabold leading-tight tracking-tight sm:text-4xl md:text-5xl">
            {hub.h1}
          </h1>
          {hub.intro.map((p) => (
            <p key={p} className="mt-3 text-[15px] leading-relaxed text-muted-foreground sm:text-base">
              {p}
            </p>
          ))}
        </header>

        {/* Temas do hub */}
        <section aria-label="Temas" className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {hub.themes.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => navigate({ search: (p: HubSearch) => ({ ...p, tema: t.id }) })}
              className={cn(
                "border p-4 text-left transition-colors",
                tema === t.id
                  ? "border-[color:var(--color-lime)] bg-secondary/50"
                  : "border-border hover:border-foreground/40",
              )}
            >
              <h2 className="text-sm font-extrabold leading-snug">{t.title}</h2>
              <p className="mt-2 text-xs leading-relaxed text-muted-foreground">{t.description}</p>
            </button>
          ))}
        </section>

        {/* Filtros simples */}
        <div className="mt-8 flex flex-col gap-3 border-b border-border pb-6 sm:flex-row sm:items-center">
          <form
            className="relative flex-1"
            onSubmit={(e) => {
              e.preventDefault();
              const value = new FormData(e.currentTarget).get("q");
              navigate({
                search: (p: HubSearch) => ({ ...p, q: typeof value === "string" ? value : "" }),
              });
            }}
          >
            <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              name="q"
              defaultValue={q}
              key={q}
              placeholder={`Buscar em ${hub.h1.toLowerCase()}...`}
              aria-label="Buscar neste hub"
              className="h-11 rounded-none pl-11"
            />
          </form>
          <div className="flex flex-wrap gap-2">
            <FilterPill
              active={tema === "all"}
              onClick={() => navigate({ search: (p: HubSearch) => ({ ...p, tema: "all" }) })}
            >
              Todos os temas
            </FilterPill>
            {hub.themes.map((t) => (
              <FilterPill
                key={t.id}
                active={tema === t.id}
                onClick={() => navigate({ search: (p: HubSearch) => ({ ...p, tema: t.id }) })}
              >
                {t.title}
              </FilterPill>
            ))}
            {q || tema !== "all" ? (
              <Button
                type="button"
                variant="ghost"
                className="h-9 rounded-none px-3 text-xs"
                onClick={() => navigate({ search: () => ({ q: "", tema: "all" }) })}
              >
                <X className="mr-1 h-3.5 w-3.5" /> Limpar
              </Button>
            ) : null}
          </div>
        </div>

        <p className="mt-5 text-sm text-muted-foreground">
          {filtered.length} {filtered.length === 1 ? "matéria" : "matérias"} nesta seleção
        </p>

        {filtered.length === 0 ? (
          <div className="mt-8 border border-border bg-secondary/40 p-10 text-center">
            <h2 className="text-lg font-extrabold">Ainda não temos matérias nesta seleção</h2>
            <p className="mt-2 text-sm text-muted-foreground">
              Publicamos novas matérias todos os dias às 7h. Assine a newsletter para receber assim
              que sair.
            </p>
            <Button asChild className="mt-6 h-11 rounded-none px-6 font-semibold">
              <Link to="/noticias" search={{ q: "", cat: "all" }}>
                Ver todas as notícias
              </Link>
            </Button>
          </div>
        ) : (
          <div className="mt-6 grid gap-x-8 gap-y-10 sm:grid-cols-2 lg:grid-cols-3">
            {filtered.map((a) => {
              const category = (validCats.has(a.category) ? a.category : "generativa") as CategoryKey;
              return (
                <article key={a.id} className="group flex flex-col">
                  <Link
                    to="/materia/$slug"
                    params={{ slug: a.slug }}
                    className="relative block overflow-hidden"
                  >
                    <img
                      src={a.cover_image_url ?? FALLBACK_COVER}
                      alt={a.title}
                      loading="lazy"
                      className="aspect-[16/10] w-full object-cover transition-transform duration-500 group-hover:scale-[1.04]"
                    />
                    <span className="absolute left-3 top-3">
                      <CategoryChip category={category} variant="solid" />
                    </span>
                  </Link>
                  <h3 className="mt-4 text-lg font-bold leading-snug">
                    <Link to="/materia/$slug" params={{ slug: a.slug }} className="hover:text-primary">
                      {a.title}
                    </Link>
                  </h3>
                  <p className="mt-2 line-clamp-3 text-[15px] leading-relaxed text-muted-foreground">
                    {a.dek}
                  </p>
                  <p className="mt-3 flex items-center gap-2 text-xs text-muted-foreground">
                    <span>{a.source_name ?? "IA News"}</span>
                    <span className="text-border">•</span>
                    <span>{dateLabel(a.published_at)}</span>
                    <span className="text-border">•</span>
                    <span>
                      <Clock className="mr-1 inline h-3 w-3" />
                      {a.read_minutes ?? 4} min
                    </span>
                  </p>
                </article>
              );
            })}
          </div>
        )}


        {/* Perguntas frequentes */}
        <section className="mt-12 max-w-3xl">
          <h2 className="text-xl font-extrabold tracking-tight sm:text-2xl">Perguntas frequentes</h2>
          <div className="mt-4 divide-y divide-border border-y border-border">
            {hub.faq.map((f) => (
              <div key={f.q} className="py-4">
                <h3 className="text-sm font-extrabold">{f.q}</h3>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{f.a}</p>
              </div>
            ))}
          </div>
        </section>

        {/* CTA principal */}
        {hub.cta === "newsletter" ? (
          <LeadCta
            className="mt-12"
            eyebrow="Newsletter diária"
            title={hub.ctaTitle}
            description={hub.ctaDescription}
            action={hub.ctaAction}
            placement="guia-band"
          />
        ) : (
          <section className="mt-12 border border-border bg-secondary/40 p-6 sm:p-8">
            <p className="font-mono-eyebrow text-[color:var(--color-lime)]">Fale com a gente</p>
            <h2 className="mt-2 text-xl font-extrabold tracking-tight sm:text-2xl">
              {hub.ctaTitle}
            </h2>
            <p className="mt-2 max-w-2xl text-sm leading-relaxed text-muted-foreground">
              {hub.ctaDescription}
            </p>
            <div className="mt-5 flex flex-col gap-3 sm:flex-row">
              <Button asChild className="h-11 rounded-none px-6 font-semibold">
                <Link to="/contato">
                  {hub.ctaAction} <ArrowRight className="ml-1 h-4 w-4" />
                </Link>
              </Button>
              <Button asChild variant="outline" className="h-11 rounded-none px-6 font-semibold">
                <Link to="/anuncie">Anunciar no IA News</Link>
              </Button>
            </div>
          </section>
        )}

        {/* Links internos */}
        <section className="mt-12 border-t border-border pt-8">
          <h2 className="text-xl font-extrabold tracking-tight sm:text-2xl">Continue pelo IA News</h2>
          <ul className="mt-3 grid gap-2 sm:grid-cols-2">
            <li>
              <Link
                to="/artigos/inteligencia-artificial-nas-empresas"
                className="font-semibold text-[color:var(--color-lime)] hover:underline"
              >
                Guia: IA para empresas — implementação em 90 dias
              </Link>
            </li>
            {Object.values(HUBS)
              .filter((h) => h.slug !== hub.slug)
              .map((h) => (
                <li key={h.slug}>
                  <Link
                    to="/guias/$hub"
                    params={{ hub: h.slug }}
                    search={{ q: "", tema: "all" }}
                    className="font-semibold text-[color:var(--color-lime)] hover:underline"
                  >
                    Hub: {h.h1}
                  </Link>
                </li>
              ))}
            <li>
              <Link
                to="/ranking"
                className="font-semibold text-[color:var(--color-lime)] hover:underline"
              >
                Ranking IA — comparação das principais ferramentas
              </Link>
            </li>
            <li>
              <Link
                to="/noticias"
                search={{ q: "", cat: "all" }}
                className="font-semibold text-[color:var(--color-lime)] hover:underline"
              >
                Todas as notícias de inteligência artificial
              </Link>
            </li>
          </ul>
        </section>
      </main>
      <SiteFooter />
    </div>
  );
}

function FilterPill({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "border px-3 py-2 text-xs font-semibold uppercase tracking-wide transition-colors",
        active
          ? "border-[color:var(--color-nav)] bg-[color:var(--color-nav)] text-white"
          : "border-border text-muted-foreground hover:border-foreground/40 hover:text-foreground",
      )}
    >
      {children}
    </button>
  );
}
