import { createFileRoute, Link } from "@tanstack/react-router";
import { queryOptions, useSuspenseQuery } from "@tanstack/react-query";

import logoWhite from "@/assets/ianews-logo-white.png";
import { ArticleThumb } from "@/components/portal/article-thumb";
import { PortalSubscribeForm, useSubscribed } from "@/components/site/portal-subscribe";
import { listRecentArticles } from "@/lib/articles.functions";
import { CATEGORY_SEO } from "@/lib/categories";
import { trackCta } from "@/lib/cta-tracking";

/* Página do link da bio do Instagram (@ianews.co).
   Ordem pensada para quem chega do Instagram: assinar, ler a matéria que viu no post,
   participar, e só no fim o espaço comercial, separado do editorial. */

const WHATSAPP_URL = "https://chat.whatsapp.com/Is5edILjICj0D2MMHUmGbL";

const articlesOptions = queryOptions({
  queryKey: ["articles", "recent"],
  queryFn: () => listRecentArticles(),
});

export const Route = createFileRoute("/links")({
  ssr: true,
  loader: ({ context }) => context.queryClient.ensureQueryData(articlesOptions),
  head: () => ({
    meta: [
      { title: "IANews · links" },
      { name: "description", content: "Newsletter, matérias, Ranking IA e como participar da IANews." },
      { property: "og:title", content: "IANews · A corrida da IA, explicada para quem decide" },
      { property: "og:description", content: "Newsletter diária, matérias e Ranking IA." },
      { name: "robots", content: "noindex" },
    ],
    links: [{ rel: "canonical", href: "https://ianewsbr.com/links" }],
  }),
  component: LinksPage,
});

const click = (variant: string, articleSlug: string | null = null) => () =>
  trackCta({ event: "click", placement: "links-bio", variant, articleSlug });

function Arrow() {
  return (
    <svg className="lk-arrow" viewBox="0 0 24 24" aria-hidden="true">
      <path d="M9 6l6 6-6 6" />
    </svg>
  );
}

function LinksPage() {
  const { data } = useSuspenseQuery(articlesOptions);
  const subscribed = useSubscribed();
  const latest = data.slice(0, 4);

  return (
    <main id="main" className="lk">
      <header className="lk-top">
        <img src={logoWhite} alt="IANews" width={795} height={160} className="lk-logo" />
        <p>A corrida da IA, explicada para quem decide.</p>
        <Link to="/" className="lk-site" onClick={click("site")}>
          Acessar o site
        </Link>
      </header>

      <div className="lk-body">
        {/* 1. Newsletter */}
        <section className="lk-card lk-news" aria-labelledby="lk-news-t">
          <p className="kick">Newsletter diária · grátis</p>
          <h1 id="lk-news-t">As notícias de IA de ontem, todo dia às 7h no seu e-mail.</h1>
          {subscribed ? (
            <p className="lk-ok">Você já assina. Até amanhã às 7h.</p>
          ) : (
            <PortalSubscribeForm placement="links-bio" button="Assinar grátis" layout="stack" wideButton />
          )}
        </section>

        {/* 2. Matérias recentes: quem viu o post quer ler a história completa */}
        {latest.length ? (
          <section aria-labelledby="lk-read-t">
            <h2 id="lk-read-t" className="lk-h">Viu no Instagram? Leia completo</h2>
            <div className="lk-list">
              {latest.map((a) => (
                <Link
                  key={a.slug}
                  to="/materia/$slug"
                  params={{ slug: a.slug }}
                 
                  className="lk-art"
                  onClick={click("materia", a.slug)}
                >
                  <ArticleThumb src={a.cover_image_url} alt="" label={CATEGORY_SEO[a.category]?.label ?? "IANews"} className="r43" />
                  <span>
                    <small>{CATEGORY_SEO[a.category]?.label ?? a.category}</small>
                    <b>{a.title}</b>
                  </span>
                </Link>
              ))}
            </div>
            <Link to="/noticias" search={{ q: "", cat: "all" }} className="lk-more" onClick={click("noticias")}>
              Todas as notícias <Arrow />
            </Link>
          </section>
        ) : null}

        {/* 3. Ranking IA */}
        <Link to="/ranking" className="lk-card lk-row lk-rank" onClick={click("ranking")}>
          <span>
            <p className="kick">Ranking IA</p>
            <b>Qual inteligência artificial lidera hoje?</b>
            <small>As principais plataformas comparadas e atualizadas todo dia.</small>
          </span>
          <Arrow />
        </Link>

        {/* 4. Participe: interação com quem acompanha, com curadoria da redação */}
        <section aria-labelledby="lk-part-t">
          <h2 id="lk-part-t" className="lk-h">Participe da IANews</h2>
          <Link to="/gente" hash="indicar" className="lk-card lk-row" onClick={click("indicar-gente")}>
            <span>
              <b>Indique quem faz a IA acontecer no Brasil</b>
              <small>Conhece alguém que deveria ser a próxima capa? Pode ser do seu time, da sua cidade ou você.</small>
            </span>
            <Arrow />
          </Link>
          <Link to="/contato" search={{ assunto: "pauta" }} className="lk-card lk-row" onClick={click("pauta")}>
            <span>
              <b>Sugira uma pauta à redação</b>
              <small>Uma notícia, um caso real ou uma dúvida sobre IA. A redação avalia cada sugestão e decide o que vira matéria.</small>
            </span>
            <Arrow />
          </Link>
          <a href={WHATSAPP_URL} target="_blank" rel="noopener noreferrer" className="lk-card lk-row" onClick={click("whatsapp")}>
            <span>
              <b>Comunidade IANews no WhatsApp</b>
              <small>As notícias do dia direto no seu celular.</small>
            </span>
            <Arrow />
          </a>
        </section>

        {/* 5. Espaço comercial, separado e discreto */}
        <section className="lk-biz" aria-labelledby="lk-biz-t">
          <h2 id="lk-biz-t">Para empresas e marcas</h2>
          <Link to="/anuncie" onClick={click("anuncie")}>
            Parcerias e projetos de conteúdo <Arrow />
          </Link>
          <Link to="/empresas" onClick={click("empresas")}>
            IA na sua empresa <Arrow />
          </Link>
        </section>

        <footer className="lk-foot">
          <a href="https://www.instagram.com/ianews.co/" target="_blank" rel="noopener noreferrer">
            @ianews.co
          </a>{" "}
          · <Link to="/sobre">Como fazemos</Link> · <Link to="/termos">Privacidade</Link>
        </footer>
      </div>
    </main>
  );
}
