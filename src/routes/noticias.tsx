import { Fragment, useState } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { Clock, Search, X } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

import { SiteHeader } from "@/components/site/header";
import { SiteFooter } from "@/components/site/footer";
import { HUB_LIST } from "@/lib/hubs";
import { CATEGORY_SEO_LIST } from "@/lib/categories";
import { LeadCta } from "@/components/site/lead-cta";
import { CATEGORY_MAP, CategoryChip, type CategoryKey } from "@/components/site/category-chip";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { listArticlesFiltered, type ArticleRow } from "@/lib/articles.functions";

const FALLBACK_COVER =
  "https://images.unsplash.com/photo-1677442136019-21780ecad995?w=1200&q=80&auto=format&fit=crop";

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
          description:
            "Todas as notícias de inteligência artificial publicadas pelo IA News.",
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
      {error.message}
    </div>
  ),
  notFoundComponent: () => <div className="p-10 text-center">Nada por aqui.</div>,
  component: NoticiasPage,
});

function dateLabel(iso: string): string {
  return new Date(iso).toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    timeZone: "America/Sao_Paulo",
  });
}

function NoticiasPage() {
  const { articles } = Route.useLoaderData();
  const { q, cat } = Route.useSearch();
  const navigate = useNavigate({ from: "/noticias" });
  const cats = Object.entries(CATEGORY_MAP) as Array<[CategoryKey, { label: string }]>;
  const validCats = new Set(Object.keys(CATEGORY_MAP));
  const [searchOpen, setSearchOpen] = useState(Boolean(q));
  const catLabel = cat === "all" ? "Todas as editorias" : (CATEGORY_MAP[cat as CategoryKey]?.label ?? "Todas as editorias");
  const mostRead = articles.slice(0, 8);

  return (
    <div className="min-h-screen bg-background">
      <SiteHeader />

      {/* Barra compacta: título + filtro em menu + busca só na lupa */}
      <div className="sticky top-[72px] z-30 border-b border-border bg-background/95 backdrop-blur">
        <div className="mx-auto flex max-w-[1400px] items-center gap-3 px-4 py-3 sm:px-6 lg:px-8">
          <h1 className="min-w-0 truncate text-lg font-extrabold tracking-tight sm:text-xl">
            Notícias <span className="text-muted-foreground">· {catLabel}</span>
          </h1>
          <div className="ml-auto flex shrink-0 items-center gap-2">
            <Select
              value={cat}
              onValueChange={(value) => navigate({ search: (p: Search) => ({ ...p, cat: value }) })}
            >
              <SelectTrigger className="h-9 w-[150px] rounded-none text-sm sm:w-[190px]">
                <SelectValue placeholder="Editoria" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas as editorias</SelectItem>
                {cats.map(([key, value]) => (
                  <SelectItem key={key} value={key}>
                    {value.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <button
              type="button"
              aria-label={searchOpen ? "Fechar busca" : "Buscar notícias"}
              onClick={() => setSearchOpen((v) => !v)}
              className="grid h-9 w-9 shrink-0 place-items-center border border-border text-foreground/70 hover:text-foreground"
            >
              {searchOpen ? <X className="h-4 w-4" /> : <Search className="h-4 w-4" />}
            </button>
          </div>
        </div>

        {searchOpen ? (
          <form
            className="mx-auto flex max-w-[1400px] items-center gap-2 px-4 pb-3 sm:px-6 lg:px-8"
            onSubmit={(e) => {
              e.preventDefault();
              const value = new FormData(e.currentTarget).get("q");
              navigate({
                search: (prev: Search) => ({ ...prev, q: typeof value === "string" ? value : "" }),
              });
            }}
          >
            <Input
              name="q"
              defaultValue={q}
              key={q}
              autoFocus
              placeholder="Buscar por título ou resumo..."
              aria-label="Buscar notícias"
              className="h-10 rounded-none text-base"
            />
            <Button type="submit" className="h-10 shrink-0 rounded-none px-5 font-semibold">
              Buscar
            </Button>
          </form>
        ) : null}
      </div>

      <main className="mx-auto max-w-[1400px] px-4 py-6 sm:px-6 lg:px-8">
        {mostRead.length > 0 ? (
          <section className="mb-8">
            <div className="mb-3 flex items-center justify-between gap-4">
              <span className="bg-foreground px-3 py-1.5 text-xs font-bold uppercase tracking-wide text-background">
                Mais lidas {cat === "all" ? "agora" : `em ${catLabel}`}
              </span>
            </div>
            <div className="flex snap-x snap-mandatory gap-4 overflow-x-auto pb-3 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
              {mostRead.map((a: ArticleRow, i: number) => (
                <Link
                  key={a.id}
                  to="/materia/$slug"
                  params={{ slug: a.slug }}
                  className="group w-[68vw] shrink-0 snap-start sm:w-[260px]"
                >
                  <img
                    src={a.cover_image_url ?? FALLBACK_COVER}
                    alt={a.title}
                    loading="lazy"
                    className="aspect-[16/10] w-full object-cover"
                  />
                  <p className="mt-2 flex items-center gap-2 text-xs text-muted-foreground">
                    <span className="bg-[color:var(--color-lime)] px-2 py-0.5 font-bold text-white">
                      {i + 1}
                    </span>
                    {dateLabel(a.published_at)}
                  </p>
                  <h2 className="mt-1.5 line-clamp-3 text-sm font-bold leading-snug group-hover:text-primary">
                    {a.title}
                  </h2>
                </Link>
              ))}
            </div>
          </section>
        ) : null}

        <nav aria-label="Editorias" className="mb-8 border-y border-border py-4">
          <h2 className="text-xs font-bold uppercase tracking-wide text-muted-foreground">
            Editorias do IA News
          </h2>
          <ul className="mt-3 flex flex-wrap gap-2">
            {CATEGORY_SEO_LIST.map((c) => (
              <li key={c.slug}>
                <Link
                  to="/categoria/$cat"
                  params={{ cat: c.slug }}
                  className="inline-block border border-border px-3 py-1.5 text-sm font-semibold hover:bg-secondary"
                >
                  {c.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>

        <p className="text-sm text-muted-foreground">
          {articles.length} {articles.length === 1 ? "matéria encontrada" : "matérias encontradas"}
        </p>

        {articles.length === 0 ? (
          <div className="mt-10 rounded-xl bg-secondary/60 p-12 text-center">
            <h2 className="text-xl font-bold">Nenhuma matéria encontrada</h2>
            <p className="mt-2 text-muted-foreground">
              Tente outra palavra-chave ou volte para todas as editorias.
            </p>
            <Button
              className="mt-6 h-11 rounded-lg font-semibold"
              onClick={() => navigate({ search: () => ({ q: "", cat: "all" }) })}
            >
              Ver todas
            </Button>
          </div>
        ) : (
          <div className="mt-8 grid gap-x-8 gap-y-10 sm:grid-cols-2 lg:grid-cols-3">
            {articles.map((a: ArticleRow) => {
              const category = (validCats.has(a.category) ? a.category : "generativa") as CategoryKey;
              return (
                <Fragment key={a.id}>
                <article className="group flex flex-col">
                  <Link
                    to="/materia/$slug"
                    params={{ slug: a.slug }}
                    className="relative block overflow-hidden rounded-xl"
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
                  <h2 className="mt-4 text-lg font-bold leading-snug">
                    <Link
                      to="/materia/$slug"
                      params={{ slug: a.slug }}
                      className="hover:text-primary"
                    >
                      {a.title}
                    </Link>
                  </h2>
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
                </Fragment>
              );
            })}
          </div>
        )}
      </main>
      <div className="mx-auto max-w-[1400px] px-4 pb-10 sm:px-6 lg:px-8">
        <nav aria-label="Hubs temáticos" className="mb-8 flex flex-wrap items-center gap-2 border-t border-border pt-6">
          <span className="font-mono-eyebrow text-muted-foreground">Guias:</span>
          {HUB_LIST.map((h) => (
            <Link
              key={h.slug}
              to="/guias/$hub"
              params={{ hub: h.slug }}
              search={{ q: "", tema: "all" }}
              className="border border-border px-3 py-1.5 text-xs font-semibold hover:border-foreground/40 hover:text-[color:var(--color-lime)]"
            >
              {h.h1}
            </Link>
          ))}
          <Link
            to="/artigos/inteligencia-artificial-nas-empresas"
            className="border border-border px-3 py-1.5 text-xs font-semibold hover:border-foreground/40 hover:text-[color:var(--color-lime)]"
          >
            IA para empresas
          </Link>
        </nav>
        <LeadCta
          className="mb-8"
          eyebrow="Cobertura diária"
          title="Não perca nenhuma notícia relevante de IA"
          description="Assine grátis e receba a curadoria da redação IA News todos os dias, antes das 8h."
          action="Assinar grátis"
            placement="noticias-band"
          />
      </div>
      <SiteFooter />
    </div>
  );
}
