import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link } from "@tanstack/react-router";

import { CATEGORY_MAP, type CategoryKey } from "@/components/site/category-chip";
import { PortalSubscribeForm, useSubscribed } from "@/components/site/portal-subscribe";
import { openSubscribeDialog } from "@/components/site/subscribe-dialog";
import { useCtaImpression } from "@/hooks/use-cta-impression";
import type { ArticleRow } from "@/lib/articles.functions";
import { RankLogo } from "@/components/portal/rank-shared";
import type { AiTool } from "@/lib/ai-ranking.functions";

/* Peças da página inicial no padrão do IANews Portal (ver renderHome/card/rankRowHome no protótipo). */

const MONTHS = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];

/** "8 out 2026", no fuso de São Paulo. */
function homeDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const parts = new Intl.DateTimeFormat("en-US", {
    day: "numeric",
    month: "numeric",
    year: "numeric",
    timeZone: "America/Sao_Paulo",
  }).formatToParts(d);
  const get = (t: string) => Number(parts.find((p) => p.type === t)?.value ?? 0);
  return `${get("day")} ${MONTHS[get("month") - 1] ?? ""} ${get("year")}`;
}

function catLabel(cat: string): string {
  return CATEGORY_MAP[cat as CategoryKey]?.label ?? "IANews";
}

function readLine(a: ArticleRow): string {
  const date = homeDate(a.published_at);
  return a.read_minutes ? `${date} · ${a.read_minutes} min de leitura` : date;
}

function Thumb({
  src,
  label,
  ratio,
  eager = false,
}: {
  src: string | null | undefined;
  label: string;
  ratio?: "r43" | "r32";
  eager?: boolean;
}) {
  const [failed, setFailed] = useState(false);
  const none = !src || failed;
  return (
    <span className={"thumb" + (ratio ? " " + ratio : "") + (none ? " none" : "")}>
      {none ? (
        <span>{label}</span>
      ) : (
        <img
          src={src}
          alt=""
          decoding="async"
          loading={eager ? "eager" : "lazy"}
          onError={() => setFailed(true)}
        />
      )}
    </span>
  );
}

function Kick({ a }: { a: ArticleRow }) {
  return (
    <span className="kick">
      <span>{catLabel(a.category)}</span>
    </span>
  );
}

function Svg({ d }: { d: string }) {
  return (
    <svg className="ico" viewBox="0 0 24 24" aria-hidden="true">
      <path d={d} />
    </svg>
  );
}

/** card(a, kind) do protótipo: "" (grade), "row" (lista com miniatura), "full" (com linha fina), "sm" (carrossel). */
export function HomeCard({ a, kind }: { a: ArticleRow; kind?: "row" | "full" | "sm" }) {
  const label = catLabel(a.category);
  if (kind === "row") {
    return (
      <Link className="card row" to="/materia/$slug" params={{ slug: a.slug }}>
        <span className="txt">
          <Kick a={a} />
          <h3>{a.title}</h3>
          <span className="when">{homeDate(a.published_at)}</span>
        </span>
        <Thumb src={a.cover_image_url} label={label} ratio="r43" />
      </Link>
    );
  }
  return (
    <Link
      className={"card" + (kind ? " " + kind : "")}
      to="/materia/$slug"
      params={{ slug: a.slug }}
    >
      <Thumb src={a.cover_image_url} label={label} />
      <Kick a={a} />
      <h3>{a.title}</h3>
      {kind === "full" && a.dek ? <p className="dek">{a.dek}</p> : null}
      <span className="when">{readLine(a)}</span>
    </Link>
  );
}

/* ---------- hero ---------- */
export function HomeHero({ lead, latest }: { lead: ArticleRow | null; latest: ArticleRow[] }) {
  if (!lead) return null;
  const by = (lead.author || lead.source_name || "IANews").split(",")[0];
  return (
    <section className="hero">
      <div>
        <Link className="lead" to="/materia/$slug" params={{ slug: lead.slug }}>
          <Thumb src={lead.cover_image_url} label={catLabel(lead.category)} eager />
          <Kick a={lead} />
          <h1>{lead.title}</h1>
          {lead.dek ? <p className="dek">{lead.dek}</p> : null}
          <span className="when">
            {by} · {readLine(lead)}
          </span>
        </Link>
      </div>
      {latest.length > 0 ? (
        <aside className="latest" aria-label="Últimas notícias">
          <h2>Últimas</h2>
          <div>
            {latest.map((a) => (
              <HomeCard key={a.id} a={a} kind="row" />
            ))}
          </div>
          <Link className="more" to="/noticias" search={{ q: "", cat: "all" }}>
            Todas as notícias →
          </Link>
        </aside>
      ) : null}
    </section>
  );
}

/* ---------- faixa slim de newsletter ---------- */
export function HomeSlimBand() {
  const subscribed = useSubscribed();
  const ref = useCtaImpression("home-band", "portal-slim");
  if (subscribed) return null;
  return (
    <div ref={ref} className="band slim" role="region" aria-label="Newsletter">
      <p className="t">
        <b>5 minutos por dia. Zero hype.</b> A newsletter da IANews, grátis, com o que importa em
        inteligência artificial.
      </p>
      <PortalSubscribeForm placement="home-band" button="Assinar grátis" layout="row" />
    </div>
  );
}

/* ---------- notícias (grade com card "Para empresas") ---------- */
function BizCard() {
  return (
    <div className="ad-card home-biz">
      <span className="ad-lb">IANews</span>
      <Link className="ad-in no-img" to="/empresas">
        <span className="ad-txt">
          <b>Coloque IA para rodar na sua operação</b>
          <span>Implementação, conteúdo e formação de equipes com o time da IANews.</span>
          <i>Ver soluções →</i>
        </span>
      </Link>
    </div>
  );
}

export function HomeNews({ items }: { items: ArticleRow[] }) {
  if (items.length === 0) return null;
  return (
    <section className="sec">
      <div className="sec-head">
        <h2>Notícias</h2>
        <Link className="more" to="/noticias" search={{ q: "", cat: "all" }}>
          Ver todas →
        </Link>
      </div>
      <div className="grid-3 compact-m">
        {items.map((a, i) => (
          <HomeNewsItem
            key={a.id}
            a={a}
            withBiz={i === 1 || (i === items.length - 1 && items.length < 2)}
          />
        ))}
      </div>
    </section>
  );
}

function HomeNewsItem({ a, withBiz }: { a: ArticleRow; withBiz: boolean }) {
  return (
    <>
      <HomeCard a={a} />
      {withBiz ? <BizCard /> : null}
    </>
  );
}

/* ---------- Ranking IA (top 5) ---------- */
function LogoTile({ t }: { t: AiTool }) {
  return <RankLogo m={t} />;
}

function fmtScore(n: number) {
  return n.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export function HomeRanking({ tools }: { tools: AiTool[] }) {
  const subscribed = useSubscribed();
  const top = tools.slice(0, 5);
  if (top.length === 0) return null;
  const updated = tools[0]?.last_ranked_at
    ? new Date(tools[0].last_ranked_at).toLocaleDateString("pt-BR", {
        day: "numeric",
        month: "short",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
        timeZone: "America/Sao_Paulo",
      })
    : null;
  return (
    <section className="sec">
      <div className="sec-head">
        <h2>Ranking IA</h2>
        <Link className="more" to="/ranking">
          Ver as 50 plataformas →
        </Link>
      </div>
      <div className="rk-home">
        <div>
          <div className="rk">
            {top.map((t, idx) => {
              const pos = t.rank_position || idx + 1;
              const score = Math.max(0, Math.min(10, t.weekly_score));
              return (
                <div key={t.id} className={"rk-item" + (pos <= 3 ? " t3" : "")}>
                  <Link className="rk-row" to="/ranking">
                    <span className="rk-pos">{String(pos).padStart(2, "0")}</span>
                    <LogoTile t={t} />
                    <span className="rk-name">
                      <b>{t.name}</b>
                      <span className="mk">
                        {t.maker && t.maker !== t.name ? `${t.maker} · ${t.category}` : t.category}
                      </span>
                    </span>
                    <span className="rk-bar">
                      <i style={{ ["--v" as string]: `${score * 10}%` }} />
                    </span>
                    <span className="rk-score">{fmtScore(t.weekly_score)}</span>
                  </Link>
                </div>
              );
            })}
          </div>
          <p className="fine" style={{ marginTop: 12 }}>
            {updated ? `Atualizado em ${updated}. ` : ""}Nota de 0 a 10.
          </p>
        </div>
        <div className="note-box">
          <p className="kick">Ranking IA semanal</p>
          <h3>O ranking das plataformas de IA, toda segunda-feira no seu e-mail</h3>
          <p>
            A nota combina desempenho técnico, repercussão nas notícias e a avaliação dos leitores.
          </p>
          {!subscribed ? (
            <div>
              <button
                className="btn blue"
                type="button"
                onClick={() => openSubscribeDialog("ranking-semanal")}
              >
                Quero receber
              </button>
            </div>
          ) : null}
          <Link className="more" to="/ranking">
            Como a nota é calculada →
          </Link>
        </div>
      </div>
    </section>
  );
}

/* ---------- Mais lidas (no lugar de "Séries IANews") ---------- */
export function HomeMostRead({ items }: { items: ArticleRow[] }) {
  if (items.length === 0) return null;
  const [capa, ...rest] = items;
  return (
    <section className="sec">
      <div className="sec-head">
        <h2>Mais lidas</h2>
        <Link className="more" to="/gente">
          Gente: quem faz a IA no Brasil →
        </Link>
      </div>
      <div className="split">
        <div className="home-capa">
          <HomeCard a={capa} kind="full" />
        </div>
        {rest.length > 0 ? (
          <div>
            {rest.slice(0, 4).map((a) => (
              <HomeCard key={a.id} a={a} kind="row" />
            ))}
          </div>
        ) : null}
      </div>
    </section>
  );
}

/* ---------- IA no Brasil (carrossel com setas) ---------- */
export function HomeBrasil({ items, isBrasil }: { items: ArticleRow[]; isBrasil: boolean }) {
  const track = useRef<HTMLDivElement>(null);
  const [nav, setNav] = useState({ prev: true, next: false, hidden: true });

  const paint = useCallback(() => {
    const t = track.current;
    if (!t) return;
    const max = t.scrollWidth - t.clientWidth - 2;
    setNav({ prev: t.scrollLeft <= 2, next: t.scrollLeft >= max, hidden: max <= 4 });
  }, []);

  useEffect(() => {
    paint();
    window.addEventListener("resize", paint);
    return () => window.removeEventListener("resize", paint);
  }, [paint, items.length]);

  const scrollBy = (dir: 1 | -1) => {
    const t = track.current;
    if (!t) return;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    t.scrollBy({
      left: dir * Math.max(240, t.clientWidth * 0.8),
      behavior: reduced ? "auto" : "smooth",
    });
  };

  if (items.length === 0) return null;
  return (
    <section className="sec">
      <div className="sec-head">
        <h2>IA no Brasil</h2>
        <div className="car-nav">
          {isBrasil ? (
            <Link className="more" to="/categoria/$cat" params={{ cat: "brasil" }}>
              Mais de Brasil →
            </Link>
          ) : (
            <Link className="more" to="/noticias" search={{ q: "", cat: "all" }}>
              Mais notícias →
            </Link>
          )}
          <button
            className="car-btn"
            type="button"
            aria-label="Anteriores"
            disabled={nav.prev}
            hidden={nav.hidden}
            onClick={() => scrollBy(-1)}
          >
            <Svg d="m15 6-6 6 6 6" />
          </button>
          <button
            className="car-btn"
            type="button"
            aria-label="Próximas"
            disabled={nav.next}
            hidden={nav.hidden}
            onClick={() => scrollBy(1)}
          >
            <Svg d="m9 6 6 6-6 6" />
          </button>
        </div>
      </div>
      <div
        ref={track}
        className="car"
        tabIndex={0}
        aria-label="Notícias de IA no Brasil, role para o lado"
        onScroll={paint}
      >
        {items.map((a) => (
          <HomeCard key={a.id} a={a} kind="sm" />
        ))}
      </div>
    </section>
  );
}

/* ---------- bloco azul "Saiu na IANews esta semana" ---------- */
export function HomeNewsletter({ week }: { week: ArticleRow[] }) {
  const subscribed = useSubscribed();
  const ref = useCtaImpression("home-newsletter-band", "portal");
  if (subscribed) return null;
  return (
    <section className="sec">
      <div ref={ref} className="nl">
        <div className="nl-story">
          <p className="kick">Newsletter IANews</p>
          <h2>Saiu na IANews esta semana</h2>
          {week.length > 0 ? (
            <ol>
              {week.map((a, i) => (
                <li key={a.id}>
                  <b>{i + 1}</b>
                  <Link to="/materia/$slug" params={{ slug: a.slug }}>
                    {a.title}
                  </Link>
                </li>
              ))}
            </ol>
          ) : null}
        </div>
        <div className="nl-form">
          <h3>Receba a próxima edição no seu e-mail</h3>
          <p>IA, negócios e as pessoas por trás. Em português, sem jargão.</p>
          <PortalSubscribeForm
            placement="home-newsletter-band"
            button="Assinar grátis"
            layout="row"
          />
          <p className="fine">
            Gratuita. Você cancela quando quiser. Ao assinar, você aceita a{" "}
            <Link to="/termos">política de privacidade</Link>.
          </p>
        </div>
      </div>
    </section>
  );
}

/* ---------- faixa Para empresas ---------- */
export function HomeBizBand() {
  return (
    <section className="sec">
      <div className="biz-band">
        <div>
          <p className="kick" style={{ marginBottom: 8 }}>
            Para empresas
          </p>
          <h3>A IANews também coloca IA para rodar na sua operação</h3>
          <p>Implementação, conteúdo, relatórios para a liderança e formação de equipes.</p>
        </div>
        <Link className="btn" to="/empresas">
          Ver soluções
        </Link>
      </div>
    </section>
  );
}
