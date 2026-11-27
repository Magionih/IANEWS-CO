import { createFileRoute, Link } from "@tanstack/react-router";
import { queryOptions, useSuspenseQuery } from "@tanstack/react-query";

import { SiteHeader } from "@/components/site/header";
import { SiteFooter } from "@/components/site/footer";
import { PortalSubscribeForm } from "@/components/site/portal-subscribe";
import { BadgeCheck, Clock, Lightbulb, Newspaper, Timer, Trophy } from "lucide-react";
import { listRecentArticles } from "@/lib/articles.functions";
import { CATEGORY_SEO } from "@/lib/categories";
import logoWhite from "@/assets/ianews-logo-white.png";

const articlesOptions = queryOptions({
  queryKey: ["articles", "recent"],
  queryFn: () => listRecentArticles(),
});
const title = "Newsletter de IA grátis: inteligência artificial em 5 minutos | IA News";
const description =
  "Newsletter gratuita da IA News: as notícias de inteligência artificial que importam para negócios, em 5 minutos, todo dia às 7h. Sem hype.";
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

const SEMANA = [
  { d: "Seg", extra: "Ranking IA" },
  { d: "Ter" },
  { d: "Qua" },
  { d: "Qui" },
  { d: "Sex" },
  { d: "Sáb" },
  { d: "Dom" },
];

function NewsletterPage() {
  const { data: articles } = useSuspenseQuery(articlesOptions);
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
          <section className="nlh nl2">
            <div className="nlh-txt">
              <p className="kick">Newsletter gratuita</p>
              <h1>5 minutos por dia. Zero hype.</h1>
              <p className="sub">As notícias de IA que importam para negócios, todo dia às 7h.</p>
              <div className="nl2-form">
                <PortalSubscribeForm placement="newsletter-hero" button="Assinar grátis" />
              </div>
              <ul className="nl2-chips" aria-label="Como funciona">
                <li>
                  <Clock aria-hidden="true" /> Chega às 7h
                </li>
                <li>
                  <Timer aria-hidden="true" /> 5 min de leitura
                </li>
                <li>
                  <BadgeCheck aria-hidden="true" /> Grátis, sem spam
                </li>
              </ul>
              <p className="fine">
                Cancele com 1 clique. Ao assinar, você aceita a{" "}
                <Link to="/termos">política de privacidade</Link>.
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
                          <span className="nl2-cat">
                            {CATEGORY_SEO[article.category]?.label ?? article.category}
                          </span>
                        </span>
                      </li>
                    ))}
                  </ol>
                ) : null}
              </article>
            </div>
          </section>

          <section className="nl2-sec" aria-labelledby="nl2-wk">
            <div className="sec-head">
              <h2 id="nl2-wk">Sua semana com a IA News</h2>
            </div>
            <ol className="nl2-week">
              {SEMANA.map((d) => (
                <li key={d.d} className={d.extra ? "x" : undefined}>
                  <b>{d.d}</b>
                  <span>7h</span>
                  <em>{d.extra ?? "Edição do dia"}</em>
                </li>
              ))}
            </ol>
            <div className="nl2-get">
              {RECEIVE.map(({ heading, text }, i) => {
                const Icon = [Newspaper, Trophy, Lightbulb][i] ?? Newspaper;
                return (
                  <div key={heading}>
                    <span aria-hidden="true">
                      <Icon />
                    </span>
                    <b>{heading}</b>
                    <p>{text}</p>
                  </div>
                );
              })}
            </div>
          </section>

          <section className="wa-band nl2-wa">
            <div>
              <p className="kick">Prefere o WhatsApp?</p>
              <h3>Os destaques do dia no celular</h3>
              <p>Entre na comunidade IA News no WhatsApp.</p>
            </div>
            <a className="btn line" href={WHATSAPP_URL} target="_blank" rel="noopener noreferrer">
              Entrar na comunidade
            </a>
          </section>

          <div className="sec-head" style={{ marginTop: 48 }}>
            <h2>Perguntas frequentes</h2>
          </div>
          <div className="faq">
            <details>
              <summary>É gratuito?</summary>
              <p>Sim. A newsletter IANews é gratuita.</p>
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

          <section className="nl2-final" aria-labelledby="final-title">
            <h3 id="final-title">Comece amanhã às 7h</h3>
            <div>
              <PortalSubscribeForm placement="newsletter-footer" button="Quero receber" />
            </div>
          </section>
        </div>
      </main>
      <SiteFooter />
    </>
  );
}
