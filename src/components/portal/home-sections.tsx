import { coverObjectPosition } from "@/lib/cover-position";
import { coverImg, isResizable } from "@/lib/img";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link } from "@tanstack/react-router";

import { CATEGORY_MAP, type CategoryKey } from "@/components/site/category-chip";
import { PortalSubscribeForm, useSubscribed } from "@/components/site/portal-subscribe";
import { useCtaImpression } from "@/hooks/use-cta-impression";
import type { ArticleRow } from "@/lib/articles.functions";

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
  position,
}: {
  src: string | null | undefined;
  label: string;
  ratio?: "r43" | "r32";
  eager?: boolean;
  position?: string | null;
}) {
  const [failed, setFailed] = useState(false);
  const [orig, setOrig] = useState(false);
  const none = !src || failed;
  const pic = orig ? { src: src ?? undefined } : coverImg(src, ratio === "r43" ? 640 : 1280);
  const sizes =
    ratio === "r43" ? "(max-width: 640px) 120px, 180px" : "(max-width: 900px) 100vw, 700px";
  return (
    <span className={"thumb" + (ratio ? " " + ratio : "") + (none ? " none" : "")}>
      {none ? (
        <span>{label}</span>
      ) : (
        <img
          style={position ? { objectPosition: coverObjectPosition(position) } : undefined}
          src={pic.src}
          srcSet={pic.srcSet}
          sizes={pic.srcSet ? sizes : undefined}
          alt=""
          decoding="async"
          loading={eager ? "eager" : "lazy"}
          fetchPriority={eager ? "high" : undefined}
          onError={() => (!orig && isResizable(src) ? setOrig(true) : setFailed(true))}
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
        <Thumb src={a.cover_image_url} label={label} ratio="r43" position={a.cover_position} />
      </Link>
    );
  }
  return (
    <Link
      className={"card" + (kind ? " " + kind : "")}
      to="/materia/$slug"
      params={{ slug: a.slug }}
    >
      <Thumb src={a.cover_image_url} label={label} position={a.cover_position} />
      <Kick a={a} />
      <h3>{a.title}</h3>
      {kind === "full" && a.dek ? <p className="dek">{a.dek}</p> : null}
      <span className="when">{readLine(a)}</span>
    </Link>
  );
}

/* ---------- topo: "Últimas" + carrossel de destaques ---------- */
const ROTATE_MS = 6000;

function HeroCarousel({ items }: { items: ArticleRow[] }) {
  const track = useRef<HTMLDivElement>(null);
  const [idx, setIdx] = useState(0);
  const [paused, setPaused] = useState(false);
  const n = items.length;

  const go = useCallback(
    (i: number) => {
      const el = track.current;
      if (!el || n === 0) return;
      const next = ((i % n) + n) % n;
      el.scrollTo({ left: next * el.clientWidth, behavior: "smooth" });
      setIdx(next);
    },
    [n],
  );

  // Atualiza o ponto ativo quando a pessoa arrasta com o dedo.
  useEffect(() => {
    const el = track.current;
    if (!el) return;
    let t: ReturnType<typeof setTimeout> | undefined;
    const onScroll = () => {
      clearTimeout(t);
      t = setTimeout(() => setIdx(Math.round(el.scrollLeft / Math.max(1, el.clientWidth))), 80);
    };
    el.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      clearTimeout(t);
      el.removeEventListener("scroll", onScroll);
    };
  }, []);

  // Gira sozinho; para em hover, foco, toque, aba oculta ou "reduzir movimento".
  useEffect(() => {
    if (paused || n < 2) return;
    if (
      typeof window !== "undefined" &&
      window.matchMedia?.("(prefers-reduced-motion: reduce)").matches
    )
      return;
    const id = setInterval(() => {
      if (document.visibilityState === "visible") go(idx + 1);
    }, ROTATE_MS);
    return () => clearInterval(id);
  }, [paused, n, idx, go]);

  if (n === 0) return null;
  return (
    <section
      className="hc"
      aria-roledescription="carrossel"
      aria-label="Acabou de sair"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocusCapture={() => setPaused(true)}
      onBlurCapture={() => setPaused(false)}
      onTouchStart={() => setPaused(true)}
    >
      <div className="hc-head">
        <h2>Acabou de sair</h2>
        {n > 1 ? (
          <div className="hc-nav">
            <button type="button" aria-label="Destaque anterior" onClick={() => go(idx - 1)}>
              ‹
            </button>
            <button type="button" aria-label="Próximo destaque" onClick={() => go(idx + 1)}>
              ›
            </button>
          </div>
        ) : null}
      </div>
      <div className="hc-track" ref={track}>
        {items.map((a, i) => (
          <div
            key={a.id}
            className="hc-slide home-capa"
            role="group"
            aria-roledescription="slide"
            aria-label={`${i + 1} de ${n}`}
            aria-hidden={i !== idx}
          >
            <Link
              className="card full"
              to="/materia/$slug"
              params={{ slug: a.slug }}
              tabIndex={i === idx ? 0 : -1}
            >
              <Thumb
                src={a.cover_image_url}
                label={catLabel(a.category)}
                eager={i === 0}
                position={a.cover_position}
              />
              <Kick a={a} />
              <h3>{a.title}</h3>
              {a.dek ? <p className="dek">{a.dek}</p> : null}
              <span className="when">{readLine(a)}</span>
            </Link>
          </div>
        ))}
      </div>
      {n > 1 ? (
        <div className="hc-dots" role="tablist" aria-label="Escolher destaque">
          {items.map((a, i) => (
            <button
              key={a.id}
              type="button"
              role="tab"
              aria-selected={i === idx}
              aria-label={`Destaque ${i + 1}`}
              className={i === idx ? "on" : undefined}
              onClick={() => go(i)}
            />
          ))}
        </div>
      ) : null}
    </section>
  );
}

export function HomeHero({ featured, latest }: { featured: ArticleRow[]; latest: ArticleRow[] }) {
  if (featured.length === 0 && latest.length === 0) return null;
  return (
    <div className="hero top2 v2-latest">
      {latest.length > 0 ? (
        <aside className="latest" aria-label="Últimas notícias">
          <h2>Últimas</h2>
          <div>
            {latest.map((a) => (
              <HomeCard key={a.id} a={a} kind="row" />
            ))}
          </div>
          <Link className="more" to="/noticias" search={{}}>
            Todas as notícias →
          </Link>
        </aside>
      ) : null}
      <HeroCarousel items={featured} />
    </div>
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

/* ---------- notícias (grade só de matérias) ---------- */
export function HomeNews({ items }: { items: ArticleRow[] }) {
  if (items.length === 0) return null;
  return (
    <section className="sec">
      <div className="sec-head">
        <h2>Notícias</h2>
        <Link className="more" to="/noticias" search={{}}>
          Ver todas →
        </Link>
      </div>
      <div className="grid-3 compact-m">
        {items.map((a) => (
          <HomeCard key={a.id} a={a} />
        ))}
      </div>
    </section>
  );
}

/* ---------- mais notícias (lista compacta no fim da página) ---------- */
export function HomeMaisNoticias({ items }: { items: ArticleRow[] }) {
  if (items.length === 0) return null;
  return (
    <section className="sec">
      <div className="sec-head">
        <h2>Mais notícias</h2>
        <Link className="more" to="/noticias" search={{}}>
          Todas as notícias →
        </Link>
      </div>
      <div className="v2-mais">
        {items.map((a) => (
          <HomeCard key={a.id} a={a} kind="row" />
        ))}
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
            <Link className="more" to="/noticias" search={{}}>
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
              {week.map((a) => (
                <li key={a.id}>
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
