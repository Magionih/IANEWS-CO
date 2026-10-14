import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { ArrowLeft, Clock, ExternalLink } from "lucide-react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

import { SiteHeader } from "@/components/site/header";
import { ReadingTracker } from "@/components/site/reading-tracker";
import { ContentEngagement } from "@/components/site/content-engagement";
import { SiteFooter } from "@/components/site/footer";
import { LeadCta } from "@/components/site/lead-cta";
import { HUB_LIST } from "@/lib/hubs";
import {
  CategoryChip,
  type CategoryKey,
  CATEGORY_MAP,
} from "@/components/site/category-chip";
import { Button } from "@/components/ui/button";
import {
  getArticleBySlug,
  listMostRead,
  type ArticleRow,
} from "@/lib/articles.functions";

const FALLBACK_COVER =
  "https://images.unsplash.com/photo-1677442136019-21780ecad995?w=1600&q=80&auto=format&fit=crop";

/** Banco de imagens editoriais para a segunda foto da matéria. */
const INLINE_IMAGES: Record<string, string[]> = {
  default: [
    "https://images.unsplash.com/photo-1620712943543-bcc4688e7485?w=1600&q=80&auto=format&fit=crop",
    "https://images.unsplash.com/photo-1518770660439-4636190af475?w=1600&q=80&auto=format&fit=crop",
    "https://images.unsplash.com/photo-1526374965328-7f61d4dc18c5?w=1600&q=80&auto=format&fit=crop",
    "https://images.unsplash.com/photo-1451187580459-43490279c0fa?w=1600&q=80&auto=format&fit=crop",
  ],
  negocios: [
    "https://images.unsplash.com/photo-1454165804606-c3d57bc86b40?w=1600&q=80&auto=format&fit=crop",
    "https://images.unsplash.com/photo-1521737604893-d14cc237f11d?w=1600&q=80&auto=format&fit=crop",
    "https://images.unsplash.com/photo-1600880292203-757bb62b4baf?w=1600&q=80&auto=format&fit=crop",
  ],
  brasil: [
    "https://images.unsplash.com/photo-1483729558449-99ef09a8c325?w=1600&q=80&auto=format&fit=crop",
    "https://images.unsplash.com/photo-1543059080-f9b1272213d5?w=1600&q=80&auto=format&fit=crop",
  ],
  regulacao: [
    "https://images.unsplash.com/photo-1589829545856-d10d557cf95f?w=1600&q=80&auto=format&fit=crop",
    "https://images.unsplash.com/photo-1450101499163-c8848c66ca85?w=1600&q=80&auto=format&fit=crop",
  ],
  pesquisa: [
    "https://images.unsplash.com/photo-1507413245164-6160d8298b31?w=1600&q=80&auto=format&fit=crop",
    "https://images.unsplash.com/photo-1516110833967-0b5716ca1387?w=1600&q=80&auto=format&fit=crop",
  ],
};

function hashOf(text: string): number {
  let h = 0;
  for (let i = 0; i < text.length; i += 1) h = (h * 31 + text.charCodeAt(i)) >>> 0;
  return h;
}

/** Escolhe uma segunda imagem estável (sempre a mesma para a mesma matéria). */
function pickInlineImage(article: ArticleRow): string {
  const pool =
    INLINE_IMAGES[article.category ?? "default"] ?? INLINE_IMAGES["default"]!;
  const cover = article.cover_image_url ?? "";
  const candidates = pool.filter((u) => u !== cover);
  const list = candidates.length ? candidates : pool;
  return list[hashOf(article.slug) % list.length]!;
}

/** Divide o markdown em duas partes num limite de parágrafo perto do meio. */
function splitBody(markdown: string): [string, string] {
  const blocks = markdown.split(/\n{2,}/).filter((b) => b.trim().length > 0);
  if (blocks.length < 5) return [markdown, ""];
  let cut = Math.round(blocks.length * 0.45);
  // não cortar logo antes de um título órfão
  while (cut < blocks.length - 1 && blocks[cut]!.trim().startsWith("#")) cut += 1;
  return [blocks.slice(0, cut).join("\n\n"), blocks.slice(cut).join("\n\n")];
}

export const Route = createFileRoute("/materia/$slug")({
  loader: async ({ params }) => {
    const [article, mostRead] = await Promise.all([
      getArticleBySlug({ data: { slug: params.slug } }),
      listMostRead().catch(() => [] as ArticleRow[]),
    ]);
    if (!article) throw notFound();
    return { article, mostRead };
  },
  head: ({ loaderData }) => {
    if (!loaderData) {
      return {
        meta: [
          { title: "Matéria indisponível — IA News" },
          { name: "robots", content: "noindex" },
        ],
      };
    }
    const a = loaderData.article;
    const desc =
      a.seo_description ?? a.dek ?? "Análise do IA News sobre inteligência artificial.";
    const seoTitle = a.seo_title ?? a.title;
    const img = a.cover_image_url ?? FALLBACK_COVER;
    return {
      meta: [
        { title: `${seoTitle} — IA News` },
        { name: "description", content: desc.slice(0, 155) },
        { property: "og:title", content: seoTitle },
        { property: "og:description", content: desc.slice(0, 155) },
        { property: "og:type", content: "article" },
        { name: "twitter:card", content: "summary_large_image" },
        ...(a.tags && a.tags.length
          ? [{ name: "keywords", content: a.tags.join(", ") }]
          : []),
        ...(img.startsWith("https://")
          ? [
              { property: "og:image", content: img },
              { name: "twitter:image", content: img },
            ]
          : []),
        { property: "og:url", content: `https://ianewsbr.com/materia/${a.slug}` },
      ],
      links: [
        { rel: "canonical", href: `https://ianewsbr.com/materia/${a.slug}` },
      ],
      scripts: [
        {
          type: "application/ld+json",
          children: JSON.stringify({
            "@context": "https://schema.org",
            "@type": "NewsArticle",
            headline: a.title,
            description: desc.slice(0, 300),
            image: [img],
            datePublished: a.published_at,
            dateModified: a.published_at,
            author: {
              "@type": a.author ? "Person" : "Organization",
              name: a.author ?? "Redação IA News",
            },
            publisher: {
              "@type": "Organization",
              name: "IA News",
              logo: {
                "@type": "ImageObject",
                url: "https://ianewsbr.com/og-brand.png",
              },
            },
            mainEntityOfPage: {
              "@type": "WebPage",
              "@id": `https://ianewsbr.com/materia/${a.slug}`,
            },
            ...(a.tags && a.tags.length ? { keywords: a.tags.join(", ") } : {}),
            inLanguage: "pt-BR",
          }),
        },
        {
          type: "application/ld+json",
          children: JSON.stringify({
            "@context": "https://schema.org",
            "@type": "BreadcrumbList",
            itemListElement: [
              { "@type": "ListItem", position: 1, name: "Home", item: "https://ianewsbr.com/" },
              { "@type": "ListItem", position: 2, name: "Notícias", item: "https://ianewsbr.com/noticias" },
              {
                "@type": "ListItem",
                position: 3,
                name: a.title,
                item: `https://ianewsbr.com/materia/${a.slug}`,
              },
            ],
          }),
        },
      ],
    };
  },
  errorComponent: () => <ArticleFallback title="Não foi possível carregar a matéria" />,
  notFoundComponent: () => <ArticleFallback title="Matéria não encontrada" />,
  component: ArticlePage,
});

function fullDate(iso: string) {
  return new Date(iso).toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "long",
    year: "numeric",
    timeZone: "America/Sao_Paulo",
  });
}

function shortDate(iso: string) {
  return new Date(iso).toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    timeZone: "America/Sao_Paulo",
  });
}

function catOf(value: string): CategoryKey {
  return (Object.keys(CATEGORY_MAP).includes(value) ? value : "generativa") as CategoryKey;
}

function ArticleFallback({ title }: { title: string }) {
  return (
    <div className="min-h-screen bg-background">
      <SiteHeader />
      <main className="mx-auto max-w-2xl px-4 py-24 text-center">
        <h1 className="text-3xl font-extrabold">{title}</h1>
        <p className="mt-3 text-muted-foreground">
          Talvez ela tenha sido removida ou o endereço esteja incorreto.
        </p>
        <Button asChild className="mt-8 h-11 rounded-lg px-6 font-semibold">
          <Link to="/">Voltar para a home</Link>
        </Button>
      </main>
      <SiteFooter />
    </div>
  );
}

function ArticlePage() {
  const { article, mostRead } = Route.useLoaderData();
  const cover = article.cover_image_url ?? FALLBACK_COVER;
  const category = catOf(article.category);
  const inlineImage = pickInlineImage(article);
  const [bodyTop, bodyBottom] = splitBody(article.body_markdown);
  const others: ArticleRow[] = mostRead
    .filter((a: ArticleRow) => a.slug !== article.slug)
    .slice(0, 5);

  return (
    <div className="min-h-screen bg-background">
      <SiteHeader />
      <main className="mx-auto grid max-w-[1400px] gap-10 px-4 py-8 sm:px-6 lg:grid-cols-[minmax(0,1fr)_360px] lg:px-8">
        <article>
          <Link
            to="/"
            className="inline-flex items-center gap-2 text-sm font-medium text-muted-foreground hover:text-primary"
          >
            <ArrowLeft className="h-4 w-4" /> Todas as notícias
          </Link>

          <div className="mt-5">
            <CategoryChip category={category} variant="solid" />
          </div>
          <h1 className="mt-4 text-3xl font-extrabold leading-[1.12] tracking-tight text-foreground md:text-5xl">
            {article.title}
          </h1>
          {article.dek ? (
            <p className="mt-4 max-w-3xl text-lg leading-relaxed text-muted-foreground">
              {article.dek}
            </p>
          ) : null}

          <div className="mt-6 flex flex-wrap items-center gap-3 border-y border-border py-4 text-sm text-muted-foreground">
            <span className="font-semibold text-foreground">
              Por {article.author ?? "Análise IA News"}
            </span>
            <span className="text-border">•</span>
            <span className="rounded-full bg-secondary px-2.5 py-1 text-xs font-semibold text-foreground/80">
              Análise própria IA News
            </span>
            <span className="text-border">•</span>
            <span>{fullDate(article.published_at)}</span>
            <span className="text-border">•</span>
            <span>
              <Clock className="mr-1 inline h-3.5 w-3.5" />
              {article.read_minutes ?? 4} min de leitura
            </span>
          </div>

          <figure className="mt-8">
            <img
              src={cover}
              alt={article.title}
              loading="eager"
              className="aspect-[16/9] w-full rounded-xl object-cover"
            />
            <figcaption className="mt-2 text-xs text-muted-foreground">
              Foto: {article.source_name ?? "Reprodução"}
            </figcaption>
          </figure>


          <ContentEngagement
            slug={article.slug}
            title={article.title}
            category={article.category}
          />

          <ReadingTracker
            slug={article.slug}
            title={article.title}
            category={article.category}
            minutes={article.read_minutes ?? 4}
          />

          <div className="prose-ianews prose-lead mt-10 max-w-3xl text-foreground">
            <ReactMarkdown remarkPlugins={[remarkGfm]}>{bodyTop}</ReactMarkdown>
          </div>

          <LeadCta
            variant="inline"
            className="mt-10 max-w-3xl"
            title="Gostou desta análise? Receba a próxima primeiro."
            description="Edição diária da IA News com impacto real para empresas — grátis no seu e-mail."
            action="Assinar grátis"
            placement="materia-meio"
            articleSlug={article.slug}
          />

          <figure className="mt-10 max-w-3xl">
            <img
              src={inlineImage}
              alt={`Contexto visual da matéria: ${article.title}`}
              loading="lazy"
              className="aspect-[16/9] w-full rounded-xl object-cover"
            />
            <figcaption className="mt-2 border-l-2 pl-3 text-xs leading-relaxed text-muted-foreground" style={{ borderColor: "var(--color-lime)" }}>
              {article.dek ?? article.title} · Imagem ilustrativa — IA News
            </figcaption>
          </figure>

          {bodyBottom ? (
            <div className="prose-ianews mt-10 max-w-3xl text-foreground">
              <ReactMarkdown remarkPlugins={[remarkGfm]}>{bodyBottom}</ReactMarkdown>
            </div>
          ) : null}


          {article.why_it_matters ? (
            <aside className="mt-10 max-w-3xl rounded-xl border-l-4 bg-secondary/60 p-6" style={{ borderColor: "var(--color-lime)" }}>
              <p className="font-mono-eyebrow text-muted-foreground">
                Por que isso importa
              </p>
              <p className="mt-2 text-[17px] leading-relaxed text-foreground">
                {article.why_it_matters}
              </p>
            </aside>
          ) : null}

          {article.analysis_markdown ? (
            <section className="mt-10 max-w-3xl rounded-xl border border-border bg-secondary/30 p-6 sm:p-8">
              <p className="font-mono-eyebrow text-[color:var(--color-lime)]">
                Análise IA News
              </p>
              <h2 className="mt-2 text-2xl font-extrabold tracking-tight">
                A leitura da nossa redação
              </h2>
              <div className="prose-ianews mt-4 text-[17px] leading-[1.75] text-foreground">
                <ReactMarkdown remarkPlugins={[remarkGfm]}>
                  {article.analysis_markdown}
                </ReactMarkdown>
              </div>
            </section>
          ) : null}

          {article.business_context ? (
            <section className="mt-8 max-w-3xl">
              <p className="font-mono-eyebrow text-muted-foreground">
                Contexto para empresários e decisores
              </p>
              <p className="mt-3 text-[17px] leading-[1.75] text-foreground">
                {article.business_context}
              </p>
            </section>
          ) : null}

          {article.business_impacts && article.business_impacts.length ? (
            <section className="mt-8 max-w-3xl">
              <p className="font-mono-eyebrow text-muted-foreground">Impactos para empresas</p>
              <ul className="mt-4 space-y-3">
                {(article.business_impacts as string[]).map((impact: string, i: number) => (
                  <li key={i} className="flex gap-3 rounded-xl border border-border/70 p-4">
                    <span
                      className="mt-0.5 grid h-6 w-6 shrink-0 place-items-center rounded-full text-xs font-bold text-white"
                      style={{ background: "var(--color-lime)" }}
                    >
                      {i + 1}
                    </span>
                    <span className="text-[15px] leading-relaxed text-foreground">{impact}</span>
                  </li>
                ))}
              </ul>
            </section>
          ) : null}

          {article.editorial_conclusion ? (
            <section
              className="mt-8 max-w-3xl rounded-xl p-6 text-white sm:p-8"
              style={{ background: "var(--color-nav)" }}
            >
              <p className="font-mono-eyebrow text-[color:var(--color-lime)]">
                Conclusão editorial
              </p>
              <p className="mt-3 text-[17px] leading-relaxed text-white/90">
                {article.editorial_conclusion}
              </p>
              <p className="mt-4 text-sm font-semibold text-white/70">
                — Redação IA News
              </p>
            </section>
          ) : null}

          <section className="mt-8 max-w-3xl rounded-xl border border-border p-6">
            <p className="font-mono-eyebrow text-muted-foreground">Fontes utilizadas</p>
            <ul className="mt-3 space-y-2 text-sm">
              {(article.sources && article.sources.length
                ? article.sources
                : article.source_url
                  ? [{ name: article.source_name ?? "Fonte original", url: article.source_url }]
                  : []
              ).map((s: { name?: string | null; url?: string | null }, i: number) => (
                <li key={i}>
                  {s.url ? (
                    <a
                      href={s.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 font-medium text-primary hover:underline"
                    >
                      {s.name ?? s.url}
                      <ExternalLink className="h-3.5 w-3.5" />
                    </a>
                  ) : (
                    <span className="text-foreground">{s.name}</span>
                  )}
                </li>
              ))}
            </ul>
            <p className="mt-4 text-xs leading-relaxed text-muted-foreground">
              Apuração, análise e conclusão editorial produzidas pela redação do IA News a
              partir das fontes acima. O conteúdo não reproduz o texto original.
            </p>
          </section>

          {article.source_url ? (
            <div className="mt-8">
              <Button asChild variant="outline" className="h-11 rounded-lg px-6 font-semibold">
                <a href={article.source_url} target="_blank" rel="noopener noreferrer">
                  Ler na fonte {article.source_name ? `(${article.source_name})` : ""}
                  <ExternalLink className="ml-2 h-4 w-4" />
                </a>
              </Button>
            </div>
          ) : null}
        </article>

        <aside className="flex flex-col gap-6">
          <section className="rounded-xl bg-secondary/60 p-6">
            <h2 className="text-xl font-bold">Mais Lidas</h2>
            <ol className="mt-4 divide-y divide-border/70">
              {others.map((s: ArticleRow, i: number) => (
                <li key={s.slug} className="flex gap-3 py-3.5 first:pt-0 last:pb-0">
                  <span
                    className="mt-0.5 grid h-7 w-7 shrink-0 place-items-center rounded-full text-xs font-bold text-white"
                    style={{ background: "var(--color-lime)" }}
                  >
                    {i + 1}
                  </span>
                  <div>
                    <Link
                      to="/materia/$slug"
                      params={{ slug: s.slug }}
                      className="text-[15px] font-semibold leading-snug hover:text-primary"
                    >
                      {s.title}
                    </Link>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {shortDate(s.published_at)}
                    </p>
                  </div>
                </li>
              ))}
              {others.length === 0 ? (
                <li className="py-2 text-sm text-muted-foreground">
                  Nenhuma outra matéria por enquanto.
                </li>
              ) : null}
            </ol>
          </section>

          <section className="relative overflow-hidden rounded-xl bg-[color:var(--color-nav)] p-6 text-white">
            <p className="font-mono-eyebrow text-[color:var(--color-lime)]">
              Newsletter diária
            </p>
            <h2 className="mt-3 text-2xl font-bold">5 minutos por dia</h2>
            <p className="mt-2 text-sm text-white/70">
              O que muda na IA, todo dia útil antes das 8h — sem hype.
            </p>
            <Button
              asChild
              className="mt-5 h-11 w-full rounded-lg bg-[color:var(--color-lime)] font-bold text-white hover:bg-[color:var(--color-lime)]/90"
            >
              <Link to="/">Assinar grátis</Link>
            </Button>
          </section>

          <section className="border border-border bg-secondary/40 p-5">
            <p className="font-mono-eyebrow text-[color:var(--color-lime)]">Leia também</p>
            <h2 className="mt-2 text-lg font-extrabold leading-snug tracking-tight">
              IA para empresas: guia prático de implementação
            </h2>
            <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
              Casos de uso por área, custos, governança, LGPD e um roteiro de 90 dias.
            </p>
            <Link
              to="/artigos/inteligencia-artificial-nas-empresas"
              className="mt-3 inline-block text-sm font-bold text-[color:var(--color-lime)] hover:underline"
            >
              Ler o guia completo
            </Link>
          </section>

          <section className="border border-border p-5">
            <p className="font-mono-eyebrow text-[color:var(--color-lime)]">Hubs temáticos</p>
            <ul className="mt-3 space-y-2">
              {HUB_LIST.map((h) => (
                <li key={h.slug}>
                  <Link
                    to="/guias/$hub"
                    params={{ hub: h.slug }}
                    search={{ q: "", tema: "all" }}
                    className="text-sm font-semibold leading-snug hover:text-[color:var(--color-lime)]"
                  >
                    {h.h1}
                  </Link>
                </li>
              ))}
            </ul>
          </section>

          <LeadCta
            variant="card"
            eyebrow="Continue informado"
            title="Análises de IA aplicadas ao seu negócio"
            description="Receba a edição diária da IA News e o Ranking IA atualizado, direto no e-mail."
            action="Quero receber"
            placement="materia-sidebar"
            articleSlug={article.slug}
          />
        </aside>
      </main>
      <SiteFooter />
    </div>
  );
}
