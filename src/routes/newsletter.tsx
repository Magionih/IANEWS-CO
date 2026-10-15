import { useEffect, useRef } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { queryOptions, useSuspenseQuery } from "@tanstack/react-query";

import { SiteHeader } from "@/components/site/header";
import { SiteFooter } from "@/components/site/footer";
import { NewsletterForm } from "@/components/site/newsletter-form";
import { listRecentArticles } from "@/lib/articles.functions";
import { CATEGORY_SEO } from "@/lib/categories";
import logoWhite from "@/assets/ianews-logo-white.png";

const articlesOptions = queryOptions({
  queryKey: ["articles", "recent"],
  queryFn: () => listRecentArticles(),
});
const title = "Newsletter IANews — o resumo de IA para quem decide";
const description =
  "Receba a newsletter gratuita da IANews: curadoria das notícias de inteligência artificial que importam para negócios, em 5 minutos, todo dia útil às 7h, e Ranking IA semanal. Sem hype.";
const WHATSAPP_URL = "https://chat.whatsapp.com/Is5edILjICj0D2MMHUmGbL";

export const Route = createFileRoute("/newsletter")({
  ssr: true,
  loader: ({ context }) => context.queryClient.ensureQueryData(articlesOptions),
  head: () => ({
    meta: [
      { title },
      { name: "description", content: description },
      { property: "og:title", content: title },
      { property: "og:description", content: description },
      { property: "og:type", content: "website" },
      { property: "og:url", content: "https://ianewsbr.com/newsletter" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "twitter:title", content: title },
      { name: "twitter:description", content: description },
    ],
    links: [{ rel: "canonical", href: "https://ianewsbr.com/newsletter" }],
  }),
  component: NewsletterPage,
});

const RECEIVE = [
  {
    heading: "Resumo diário",
    text: "As notícias de IA que movem negócios, explicadas em 5 minutos.",
  },
  { heading: "Ranking IA semanal", text: "As ferramentas que mais cresceram na semana." },
  { heading: "Análise para quem decide", text: "Impacto prático para empresas e carreiras." },
];

function editionDate(iso: string | undefined) {
  const time = iso ? Date.parse(iso) : NaN;
  if (!Number.isFinite(time)) return null;
  return new Intl.DateTimeFormat("pt-BR", {
    day: "numeric",
    month: "long",
    timeZone: "America/Sao_Paulo",
  }).format(time);
}

function NewsletterPage() {
  const { data: articles } = useSuspenseQuery(articlesOptions);
  const loadedAt = useRef<number | null>(null);
  useEffect(() => {
    loadedAt.current = Date.now();
  }, []);
  const latest = articles
    .filter((article) => {
      const published = Date.parse(article.published_at);
      return Number.isFinite(published) && published <= Date.now();
    })
    .slice(0, 5);
  const date = editionDate(latest[0]?.published_at);

  return (
    <>
      <SiteHeader />
      <main id="main">
        <div className="wrap">
          <section className="nlh">
            <div className="nlh-txt">
              <p className="kick">Newsletter gratuita · todo dia útil, 7h</p>
              <h1>5 minutos por dia. Zero hype.</h1>
              <p className="sub">
                A curadoria da IANews com as notícias de inteligência artificial que importam para
                negócios. Contexto para decidir melhor, sem hype.
              </p>
              <NewsletterForm placement="newsletter-hero" loadedAt={loadedAt} />
              <ul className="ticks">
                <li>Edição diária às 7h, em 5 minutos de leitura</li>
                <li>Ranking IA semanal</li>
                <li>Análise de impacto para quem decide</li>
              </ul>
              <div className="proof">
                <span>
                  <b>Grátis</b>
                </span>
                <span>Cancele com 1 clique</span>
                <span>Sem spam</span>
              </div>
              <p className="fine">
                Ao assinar, você aceita a <Link to="/termos">política de privacidade</Link>.
              </p>
            </div>

            <div className="nlh-edicao" aria-labelledby="edition-title">
              <h2 id="edition-title" className="kick" style={{ marginBottom: 12 }}>
                Assim chega no seu e-mail
              </h2>
              <article className="edicao" aria-label="Amostra da edição da newsletter">
                <div className="edicao-top">
                  <img src={logoWhite} alt="IANews" width={795} height={160} />
                  <span>{date ? `Edição de ${date}` : "Sua dose de IA"}</span>
                </div>
                <p className="edicao-k">Em 5 minutos</p>
                {latest.length ? (
                  <ol className="edicao-list">
                    {latest.map((article, index) => (
                      <li key={article.id}>
                        <b>{index + 1}</b>
                        <span>
                          <Link
                            to="/materia/$slug"
                            params={{ slug: article.slug }}
                            style={{ pointerEvents: "auto" }}
                          >
                            {article.title}
                          </Link>
                          <span
                            style={{
                              display: "block",
                              fontSize: 12,
                              color: "var(--p-ink-3)",
                              marginTop: 2,
                            }}
                          >
                            {CATEGORY_SEO[article.category]?.label ?? article.category}
                          </span>
                        </span>
                      </li>
                    ))}
                  </ol>
                ) : (
                  <p className="edicao-foot">
                    As matérias da edição aparecerão aqui assim que estiverem disponíveis.
                  </p>
                )}
                <p className="edicao-foot">
                  Uma amostra com as matérias mais recentes da redação. Assim chega a sua edição,
                  todo dia útil às 7h.
                </p>
              </article>
            </div>
          </section>

          <section className="wa-band">
            <div>
              <p className="kick">Prefere o WhatsApp?</p>
              <h3>Entre na comunidade IANews</h3>
              <p>Os destaques do dia, direto no celular.</p>
            </div>
            <a className="btn line" href={WHATSAPP_URL} target="_blank" rel="noopener noreferrer">
              Entrar na comunidade
            </a>
          </section>

          <div className="sec-head" style={{ marginTop: 56 }}>
            <h2>O que você recebe</h2>
            <p className="lede">Três coisas em toda edição</p>
          </div>
          <div className="cols3">
            {RECEIVE.map(({ heading, text }) => (
              <div key={heading}>
                <h3>{heading}</h3>
                <p>{text}</p>
              </div>
            ))}
          </div>

          <div className="sec-head" style={{ marginTop: 56 }}>
            <h2>Perguntas frequentes</h2>
          </div>
          <div className="faq">
            <details open>
              <summary>É gratuito?</summary>
              <p>Sim. A newsletter IANews é gratuita.</p>
            </details>
            <details>
              <summary>Com que frequência?</summary>
              <p>Todo dia útil, às 7h, mais o Ranking IA semanal.</p>
            </details>
            <details>
              <summary>Posso cancelar?</summary>
              <p>Sim. Há um link para cancelar a inscrição em todo e-mail.</p>
            </details>
            <details>
              <summary>O que fazem com meu e-mail?</summary>
              <p>
                Usamos só para enviar a newsletter, sem venda a terceiros. Leia nossos{" "}
                <Link to="/termos">termos e política de privacidade</Link>.
              </p>
            </details>
          </div>

          <section
            className="biz-band"
            style={{ marginBlock: "56px 64px" }}
            aria-labelledby="final-title"
          >
            <div>
              <p className="kick" style={{ marginBottom: 8 }}>
                Newsletter IANews
              </p>
              <h3 id="final-title">Comece amanhã às 7h</h3>
              <p>Seu próximo dia útil começa com as notícias que ajudam a decidir.</p>
            </div>
            <div style={{ width: "min(440px, 100%)" }}>
              <NewsletterForm
                placement="newsletter-footer"
                loadedAt={loadedAt}
                button="Quero receber"
              />
            </div>
          </section>
        </div>
      </main>
      <SiteFooter />
    </>
  );
}
