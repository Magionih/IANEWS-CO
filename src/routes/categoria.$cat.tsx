import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { Clock } from "lucide-react";

import { SiteHeader } from "@/components/site/header";
import { SiteFooter } from "@/components/site/footer";
import { LeadCta } from "@/components/site/lead-cta";
import { CATEGORY_SEO, CATEGORY_SEO_LIST } from "@/lib/categories";
import { CategoryChip, type CategoryKey } from "@/components/site/category-chip";
import { listArticlesFiltered, type ArticleRow } from "@/lib/articles.functions";

const FALLBACK_COVER =
  "https://images.unsplash.com/photo-1677442136019-21780ecad995?w=1200&q=80&auto=format&fit=crop";

const SITE = "https://ianews.site";

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
    <div className="min-h-screen bg-background">
      <SiteHeader />
      <main className="mx-auto max-w-3xl px-4 py-20 text-center">
        <h1 className="text-2xl font-extrabold">Editoria não encontrada</h1>
        <Link to="/noticias" search={{ q: "", cat: "all" }} className="mt-6 inline-block font-semibold text-primary underline">
          Ver todas as notícias
        </Link>
      </main>
      <SiteFooter />
    </div>
  ),
  component: CategoriaPage,
});

function dateLabel(iso: string): string {
  return new Date(iso).toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    timeZone: "America/Sao_Paulo",
  });
}

function CategoriaPage() {
  const { seo, articles } = Route.useLoaderData();
  const others = CATEGORY_SEO_LIST.filter((c) => c.slug !== seo.slug);
  const lead = articles[0];
  const rest = articles.slice(1);

  return (
    <div className="min-h-screen bg-background">
      <SiteHeader />

      <main className="mx-auto max-w-[1400px] px-4 py-8 sm:px-6 lg:px-8">
        <nav aria-label="Trilha" className="text-xs text-muted-foreground">
          <Link to="/" className="hover:text-foreground">
            IA News
          </Link>{" "}
          ·{" "}
          <Link to="/noticias" search={{ q: "", cat: "all" }} className="hover:text-foreground">
            Notícias
          </Link>{" "}
          · <span className="text-foreground">{seo.label}</span>
        </nav>

        <header className="mt-4 max-w-3xl">
          <p className="font-mono-eyebrow text-xs uppercase tracking-wide text-primary">Editoria</p>
          <h1 className="mt-2 text-3xl font-extrabold leading-tight tracking-tight sm:text-4xl">
            {seo.h1}
          </h1>
          <p className="mt-3 text-base leading-relaxed text-muted-foreground">{seo.intro}</p>
          <div className="mt-4 flex flex-wrap gap-2 text-xs">
            {seo.related.map((r) => (
              <a
                key={r.href}
                href={r.href}
                className="border border-border px-3 py-1.5 font-semibold hover:bg-secondary"
              >
                {r.label}
              </a>
            ))}
          </div>
        </header>

        {articles.length === 0 ? (
          <p className="mt-10 text-muted-foreground">
            Ainda não há matérias publicadas nesta editoria.{" "}
            <Link to="/noticias" search={{ q: "", cat: "all" }} className="font-semibold text-primary underline">
              Ver todas as notícias
            </Link>
            .
          </p>
        ) : (
          <>
            {lead ? (
              <section className="mt-8 grid gap-6 border-b border-border pb-8 lg:grid-cols-[1.4fr_1fr]">
                <Link to="/materia/$slug" params={{ slug: lead.slug }} className="group block">
                  <img
                    src={lead.cover_image_url ?? FALLBACK_COVER}
                    alt={lead.title}
                    className="aspect-[16/9] w-full object-cover"
                  />
                </Link>
                <div>
                  <CategoryChip category={seo.key as CategoryKey} variant="solid" />
                  <h2 className="mt-3 text-2xl font-extrabold leading-tight">
                    <Link
                      to="/materia/$slug"
                      params={{ slug: lead.slug }}
                      className="hover:text-primary"
                    >
                      {lead.title}
                    </Link>
                  </h2>
                  <p className="mt-3 text-muted-foreground">{lead.dek}</p>
                  <p className="mt-3 flex items-center gap-2 text-xs text-muted-foreground">
                    <Clock className="h-3.5 w-3.5" />
                    {dateLabel(lead.published_at)} · {lead.read_minutes ?? 5} min de leitura
                  </p>
                </div>
              </section>
            ) : null}

            <h2 className="mt-10 text-lg font-extrabold uppercase tracking-wide">
              Últimas em {seo.label}
            </h2>
            <div className="mt-5 grid gap-x-8 gap-y-10 sm:grid-cols-2 lg:grid-cols-3">
              {rest.map((a) => (
                <article key={a.id} className="group flex flex-col">
                  <Link to="/materia/$slug" params={{ slug: a.slug }} className="block">
                    <img
                      src={a.cover_image_url ?? FALLBACK_COVER}
                      alt={a.title}
                      loading="lazy"
                      className="aspect-[16/10] w-full object-cover"
                    />
                  </Link>
                  <h3 className="mt-3 text-lg font-bold leading-snug">
                    <Link
                      to="/materia/$slug"
                      params={{ slug: a.slug }}
                      className="hover:text-primary"
                    >
                      {a.title}
                    </Link>
                  </h3>
                  <p className="mt-2 line-clamp-3 text-sm text-muted-foreground">{a.dek}</p>
                  <p className="mt-2 text-xs text-muted-foreground">{dateLabel(a.published_at)}</p>
                </article>
              ))}
            </div>
          </>
        )}

        <section className="mt-14 border-t border-border pt-8">
          <h2 className="text-lg font-extrabold uppercase tracking-wide">Outras editorias</h2>
          <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {others.map((c) => (
              <Link
                key={c.slug}
                to="/categoria/$cat"
                params={{ cat: c.slug }}
                className="border border-border p-4 hover:bg-secondary"
              >
                <p className="font-bold">{c.label}</p>
                <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">{c.description}</p>
              </Link>
            ))}
          </div>
        </section>

        <div className="mt-12">
          <LeadCta
            variant="inline"
            placement="categoria"
            title={`Receba as notícias de ${seo.label} antes das 8h`}
            description="A newsletter diária do IA News resume o que importa para quem decide. Grátis."
          />
        </div>
      </main>

      <SiteFooter />
    </div>
  );
}
