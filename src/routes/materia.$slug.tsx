import { isValidElement, type ReactNode } from "react";
import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import ReactMarkdown, { type Components } from "react-markdown";
import remarkGfm from "remark-gfm";

import { SiteHeader } from "@/components/site/header";
import { ReadingTracker } from "@/components/site/reading-tracker";
import { ContentEngagement } from "@/components/site/content-engagement";
import { SiteFooter } from "@/components/site/footer";
import { ArticleThumb } from "@/components/portal/article-thumb";
import { ArticleToc, type TocItem } from "@/components/portal/article-toc";
import {
  ArticleEndBand,
  ArticleInlineCta,
  ArticleSideSubscribe,
} from "@/components/portal/article-cta";
import { ArticleShare } from "@/components/portal/article-share";
import { HUB_LIST } from "@/lib/hubs";
import { CATEGORY_SEO } from "@/lib/categories";
import { type CategoryKey, CATEGORY_MAP } from "@/components/site/category-chip";
import { getArticleBySlug, listMostRead, type ArticleRow } from "@/lib/articles.functions";

/** Usada só nos metadados (og:image / JSON-LD) quando a matéria não tem capa. */
const FALLBACK_COVER =
  "https://images.unsplash.com/photo-1677442136019-21780ecad995?w=1600&q=80&auto=format&fit=crop";

/** Divide o markdown em duas partes num limite de parágrafo perto do meio. */
function splitBody(markdown: string): [string, string] {
  const blocks = markdown.split(/\n{2,}/).filter((b) => b.trim().length > 0);
  if (blocks.length < 5) return [markdown, ""];
  let cut = Math.round(blocks.length * 0.45);
  // não cortar logo antes de um título órfão
  while (cut < blocks.length - 1 && blocks[cut]!.trim().startsWith("#")) cut += 1;
  return [blocks.slice(0, cut).join("\n\n"), blocks.slice(cut).join("\n\n")];
}

/** Âncora estável para os intertítulos (usada no índice "Nesta matéria"). */
function anchorOf(text: string): string {
  const base = text
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
  return "s-" + (base || "secao");
}

function nodeText(node: ReactNode): string {
  if (node == null || typeof node === "boolean") return "";
  if (typeof node === "string" || typeof node === "number") return String(node);
  if (Array.isArray(node)) return node.map(nodeText).join("");
  if (isValidElement<{ children?: ReactNode }>(node)) return nodeText(node.props.children);
  return "";
}

/** Intertítulos "## ..." do corpo, em texto puro, na ordem em que aparecem. */
function headingsOf(markdown: string): TocItem[] {
  const out: TocItem[] = [];
  for (const line of markdown.split("\n")) {
    const m = /^##\s+(.+?)\s*#*\s*$/.exec(line);
    if (!m) continue;
    const label = m[1]!
      .replace(/!?\[([^\]]*)\]\([^)]*\)/g, "$1")
      .replace(/[*_`~]/g, "")
      .trim();
    if (label) out.push({ id: anchorOf(label), label });
  }
  return out;
}

const MD_COMPONENTS: Components = {
  h2: ({ children }) => <h2 id={anchorOf(nodeText(children))}>{children}</h2>,
};

function Markdown({ children }: { children: string }) {
  return (
    <ReactMarkdown remarkPlugins={[remarkGfm]} components={MD_COMPONENTS}>
      {children}
    </ReactMarkdown>
  );
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
        meta: [{ title: "Matéria indisponível — IA News" }, { name: "robots", content: "noindex" }],
      };
    }
    const a = loaderData.article;
    const desc = a.seo_description ?? a.dek ?? "Análise do IA News sobre inteligência artificial.";
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
        ...(a.tags && a.tags.length ? [{ name: "keywords", content: a.tags.join(", ") }] : []),
        ...(img.startsWith("https://")
          ? [
              { property: "og:image", content: img },
              { name: "twitter:image", content: img },
            ]
          : []),
        { property: "og:url", content: `https://ianewsbr.com/materia/${a.slug}` },
      ],
      links: [{ rel: "canonical", href: `https://ianewsbr.com/materia/${a.slug}` }],
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
              {
                "@type": "ListItem",
                position: 2,
                name: "Notícias",
                item: "https://ianewsbr.com/noticias",
              },
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

const MONTHS = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];

/** "8 out 2026", no fuso de São Paulo (como no protótipo). */
function shortDate(iso: string) {
  const parts = new Intl.DateTimeFormat("en-US", {
    day: "numeric",
    month: "numeric",
    year: "numeric",
    timeZone: "America/Sao_Paulo",
  }).formatToParts(new Date(iso));
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? "";
  const month = MONTHS[Number(get("month")) - 1] ?? "";
  return `${get("day")} ${month} ${get("year")}`;
}

function catOf(value: string): CategoryKey {
  return (Object.keys(CATEGORY_MAP).includes(value) ? value : "generativa") as CategoryKey;
}

function labelOf(category: string): string {
  return CATEGORY_MAP[catOf(category)].label;
}

function ArticleFallback({ title }: { title: string }) {
  return (
    <>
      <SiteHeader />
      <main id="main">
        <div className="wrap art-fallback">
          <p className="kick">IANews</p>
          <h1>{title}</h1>
          <p>Talvez ela tenha sido removida ou o endereço esteja incorreto.</p>
          <div className="art-fallback-actions">
            <Link to="/" className="btn blue">
              Voltar para o início
            </Link>
            <Link to="/noticias" search={{ q: "", cat: "all" }} className="btn line">
              Ver todas as notícias
            </Link>
          </div>
        </div>
      </main>
      <SiteFooter />
    </>
  );
}

function ArticleCard({ a }: { a: ArticleRow }) {
  const label = labelOf(a.category);
  return (
    <Link to="/materia/$slug" params={{ slug: a.slug }} className="card sm">
      <ArticleThumb src={a.cover_image_url} alt={a.title} label={label} />
      <span className="kick">
        <span>{label}</span>
      </span>
      <h3>{a.title}</h3>
      <span className="when">
        {shortDate(a.published_at)} · {a.read_minutes ?? 4} min de leitura
      </span>
    </Link>
  );
}

function ArticlePage() {
  const { article, mostRead } = Route.useLoaderData();
  const categoryLabel = labelOf(article.category);
  const categorySeo = CATEGORY_SEO[article.category];
  const minutes = article.read_minutes ?? 4;
  const [bodyTop, bodyBottom] = splitBody(article.body_markdown);
  const url = `https://ianewsbr.com/materia/${article.slug}`;

  const sources: { name?: string | null; url?: string | null }[] =
    article.sources && article.sources.length
      ? article.sources
      : article.source_url
        ? [{ name: article.source_name ?? "Fonte original", url: article.source_url }]
        : [];
  const impacts = (article.business_impacts ?? []) as string[];

  const others: ArticleRow[] = mostRead.filter((a: ArticleRow) => a.slug !== article.slug);
  const next = others.find((a) => a.category === article.category) ?? others[0] ?? null;
  const readAlso = others.filter((a) => a.slug !== next?.slug).slice(0, 3);
  const topRead = others.slice(0, 5);

  // Índice "Nesta matéria": intertítulos do corpo + blocos editoriais que existirem.
  const toc: TocItem[] = [];
  const seen = new Set<string>();
  const addToc = (item: TocItem) => {
    if (seen.has(item.id)) return;
    seen.add(item.id);
    toc.push(item);
  };
  headingsOf(article.body_markdown).forEach(addToc);
  if (article.why_it_matters) addToc({ id: "s-porque", label: "Por que isso importa" });
  if (article.analysis_markdown) addToc({ id: "s-analise", label: "Análise IA News" });
  if (article.business_context) addToc({ id: "s-contexto", label: "Contexto para empresas" });
  if (impacts.length) addToc({ id: "s-impactos", label: "Impactos para empresas" });
  if (article.editorial_conclusion) addToc({ id: "s-conclusao", label: "Conclusão editorial" });
  if (sources.length) addToc({ id: "s-fontes", label: "Fontes" });

  return (
    <>
      <SiteHeader />
      <main id="main">
        <div className="wrap">
          <nav className="crumbs" aria-label="Você está em">
            <Link to="/">Início</Link>
            <span>/</span>
            <Link to="/noticias" search={{ q: "", cat: "all" }}>
              Notícias
            </Link>
            <span>/</span>
            {categorySeo ? (
              <Link to="/categoria/$cat" params={{ cat: categorySeo.slug }}>
                {categoryLabel}
              </Link>
            ) : (
              <span>{categoryLabel}</span>
            )}
          </nav>

          <div className="art">
            <article className="art-main">
              <span className="kick">
                <span>{categoryLabel}</span>
              </span>
              <h1>{article.title}</h1>
              {article.dek ? <p className="dek">{article.dek}</p> : null}

              <div className="byline">
                <span>
                  Por <b>{article.author ?? "Redação IA News"}</b>
                </span>
                <time dateTime={article.published_at}>{shortDate(article.published_at)}</time>
                <span>{minutes} min de leitura</span>
                {sources.length ? (
                  <span>{sources.length === 1 ? "1 fonte" : `${sources.length} fontes`}</span>
                ) : null}
                <span>Análise própria IA News</span>
              </div>

              <figure className="cover">
                <ArticleThumb
                  src={article.cover_image_url}
                  alt={article.title}
                  label={categoryLabel}
                  eager
                />
                {article.cover_image_url ? (
                  <figcaption className="cap">
                    Foto: {article.source_name ?? "Reprodução"}
                  </figcaption>
                ) : null}
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
                minutes={minutes}
              />

              <div className="prose">
                <Markdown>{bodyTop}</Markdown>
                <ArticleInlineCta articleSlug={article.slug} />
                {bodyBottom ? <Markdown>{bodyBottom}</Markdown> : null}
              </div>

              {article.why_it_matters ? (
                <section className="why-box">
                  <h2 id="s-porque">Por que isso importa</h2>
                  <p className="by">Análise IA News · a leitura da nossa redação</p>
                  <p className="t">{article.why_it_matters}</p>
                </section>
              ) : null}

              {article.analysis_markdown ? (
                <section className="art-block">
                  <h2 className="h-sm" id="s-analise">
                    Análise IA News
                  </h2>
                  <p className="art-block-sub">A leitura da nossa redação</p>
                  <div className="prose">
                    <Markdown>{article.analysis_markdown}</Markdown>
                  </div>
                </section>
              ) : null}

              {article.business_context ? (
                <section className="art-block">
                  <h2 className="h-sm" id="s-contexto">
                    Contexto para empresários e decisores
                  </h2>
                  <div className="prose">
                    <p>{article.business_context}</p>
                  </div>
                </section>
              ) : null}

              {impacts.length ? (
                <section className="art-block">
                  <h2 className="h-sm" id="s-impactos">
                    Impactos para empresas
                  </h2>
                  <ol className="art-impacts">
                    {impacts.map((impact, i) => (
                      <li key={i}>{impact}</li>
                    ))}
                  </ol>
                </section>
              ) : null}

              {article.editorial_conclusion ? (
                <section className="art-concl">
                  <h2 className="h-sm" id="s-conclusao">
                    Conclusão editorial
                  </h2>
                  <p className="t">{article.editorial_conclusion}</p>
                  <p className="by">Redação IA News</p>
                </section>
              ) : null}

              {sources.length ? (
                <>
                  <h2 className="h-sm" id="s-fontes">
                    Fontes
                  </h2>
                  <ul className="srcs">
                    {sources.map((s, i) => (
                      <li key={i}>
                        {s.url ? (
                          <a href={s.url} target="_blank" rel="noopener noreferrer">
                            {s.name ?? s.url}
                          </a>
                        ) : (
                          <span>{s.name}</span>
                        )}
                      </li>
                    ))}
                  </ul>
                </>
              ) : null}

              {article.source_url ? (
                <a
                  className="btn line s art-src-btn"
                  href={article.source_url}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  Ler na fonte{article.source_name ? ` (${article.source_name})` : ""} ↗
                </a>
              ) : null}

              {article.tags && article.tags.length ? (
                <div className="tags">
                  {article.tags.map((t: string) => (
                    <span key={t} className="tag l">
                      {t}
                    </span>
                  ))}
                </div>
              ) : null}

              <p className="fine art-note">
                Apuração, análise e conclusão editorial produzidas pela redação do IA News a partir
                das fontes acima. O conteúdo não reproduz o texto original.
              </p>

              <ArticleEndBand articleSlug={article.slug} categoryLabel={categoryLabel} />

              {next ? (
                <Link to="/materia/$slug" params={{ slug: next.slug }} className="next-art">
                  <span className="next-txt">
                    <span className="kick">Próxima matéria</span>
                    <b>{next.title}</b>
                    <span className="when">
                      {labelOf(next.category)} · {next.read_minutes ?? 4} min de leitura
                    </span>
                  </span>
                  <ArticleThumb
                    src={next.cover_image_url}
                    alt={next.title}
                    label={labelOf(next.category)}
                    className="r43"
                  />
                </Link>
              ) : null}

              {readAlso.length ? (
                <>
                  <h2 className="h-sm">Leia também</h2>
                  <div className="grid-3 compact-m">
                    {readAlso.map((a) => (
                      <ArticleCard key={a.slug} a={a} />
                    ))}
                  </div>
                </>
              ) : null}
            </article>

            <aside className="art-side art-side-flow" aria-label="Mais da IANews">
              <ArticleToc items={toc} />
              <ArticleSideSubscribe articleSlug={article.slug} />
              <ArticleShare url={url} title={article.title} />

              <div className="box">
                <h3>Mais lidas</h3>
                {topRead.length ? (
                  <ol className="art-rank">
                    {topRead.map((s, i) => (
                      <li key={s.slug}>
                        <Link to="/materia/$slug" params={{ slug: s.slug }}>
                          <span className="n">{i + 1}</span>
                          <span>
                            <b>{s.title}</b>
                            <span className="when">{shortDate(s.published_at)}</span>
                          </span>
                        </Link>
                      </li>
                    ))}
                  </ol>
                ) : (
                  <p className="fine">Nenhuma outra matéria por enquanto.</p>
                )}
              </div>

              <div className="box">
                <h3>Guias da IANews</h3>
                <ul className="art-links">
                  <li>
                    <Link to="/artigos/inteligencia-artificial-nas-empresas">
                      IA para empresas: guia prático de implementação
                    </Link>
                  </li>
                  {HUB_LIST.map((h) => (
                    <li key={h.slug}>
                      <Link
                        to="/guias/$hub"
                        params={{ hub: h.slug }}
                        search={{ q: "", tema: "all" }}
                      >
                        {h.h1}
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            </aside>
          </div>
        </div>
      </main>
      <SiteFooter />
    </>
  );
}
