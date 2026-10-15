import { useState, type ReactNode } from "react";
import { Link } from "@tanstack/react-router";

import { CATEGORY_MAP, type CategoryKey } from "@/components/site/category-chip";
import { PortalSubscribeForm, useSubscribed } from "@/components/site/portal-subscribe";
import { useCtaImpression } from "@/hooks/use-cta-impression";
import type { ArticleRow } from "@/lib/articles.functions";

/* Peças de listagem de matérias no padrão do IANews Portal
   (card, thumb, kick, destaque e faixa de newsletter) — ver renderNews/card/feature no protótipo. */

const NEWS_PAGE_SIZE = 12;

const MONTHS = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];

/** "8 out 2026", no fuso de São Paulo (igual ao protótipo). */
function newsDate(iso: string): string {
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

function categoryLabel(cat: string): string {
  return CATEGORY_MAP[cat as CategoryKey]?.label ?? "IANews";
}

export function NewsThumb({
  src,
  alt,
  label,
  ratio,
  eager = false,
}: {
  src: string | null | undefined;
  alt: string;
  label: string;
  ratio?: "r43" | "r32";
  eager?: boolean;
}) {
  const [failed, setFailed] = useState(false);
  const none = !src || failed;
  const cls = "thumb" + (ratio ? " " + ratio : "") + (none ? " none" : "");
  return (
    <span className={cls}>
      {none ? (
        <span>{label}</span>
      ) : (
        <img
          src={src}
          alt={alt}
          decoding="async"
          loading={eager ? "eager" : "lazy"}
          onError={() => setFailed(true)}
        />
      )}
    </span>
  );
}

export function NewsKick({ category, children }: { category: string; children?: ReactNode }) {
  return (
    <span className="kick">
      {children}
      <span>{categoryLabel(category)}</span>
    </span>
  );
}

function when(a: ArticleRow) {
  return `${newsDate(a.published_at)} · ${a.read_minutes ?? 4} min de leitura`;
}

/** Card de matéria (kind "full" do protótipo: foto, editoria, título, linha fina e data). */
export function NewsCard({ a, dek = true }: { a: ArticleRow; dek?: boolean }) {
  const label = categoryLabel(a.category);
  return (
    <Link className="card full" to="/materia/$slug" params={{ slug: a.slug }}>
      <NewsThumb src={a.cover_image_url} alt="" label={label} />
      <NewsKick category={a.category} />
      <h3>{a.title}</h3>
      {dek && a.dek ? <p className="dek">{a.dek}</p> : null}
      <span className="when">{when(a)}</span>
    </Link>
  );
}

/** Matéria em destaque (bloco .feature do protótipo). */
export function NewsFeature({ a, cta = "Ler a matéria" }: { a: ArticleRow; cta?: string }) {
  const label = categoryLabel(a.category);
  return (
    <div className="feature">
      <Link
        to="/materia/$slug"
        params={{ slug: a.slug }}
        style={{ textDecoration: "none", color: "inherit", minWidth: 0 }}
        aria-hidden="true"
        tabIndex={-1}
      >
        <NewsThumb src={a.cover_image_url} alt="" label={label} ratio="r32" eager />
      </Link>
      <div className="feature-txt">
        <NewsKick category={a.category} />
        <h3>
          <Link
            to="/materia/$slug"
            params={{ slug: a.slug }}
            style={{ textDecoration: "none", color: "inherit" }}
          >
            {a.title}
          </Link>
        </h3>
        {a.dek ? <p className="dek">{a.dek}</p> : null}
        <span className="when">{when(a)}</span>
        <Link className="btn" to="/materia/$slug" params={{ slug: a.slug }}>
          {cta}
        </Link>
      </div>
    </div>
  );
}

/** Grade de cards (grid-3; vira lista compacta no celular). */
export function NewsGrid({ items }: { items: ArticleRow[] }) {
  if (!items.length) return null;
  return (
    <div className="grid-3 compact-m">
      {items.map((a) => (
        <NewsCard key={a.id} a={a} />
      ))}
    </div>
  );
}

type BandProps = {
  placement: string;
  kick?: string;
  title?: string;
  text?: string;
  button?: string;
  style?: React.CSSProperties;
};

/** Faixa de newsletter no meio da grade. Some para quem já assinou. */
export function NewsBand(props: BandProps) {
  const subscribed = useSubscribed();
  if (subscribed) return null;
  return <NewsBandInner {...props} />;
}

function NewsBandInner({
  placement,
  kick = "Newsletter diária",
  title = "Não dá tempo de ler tudo. A gente resume.",
  text = "As notícias de IA do dia em 5 minutos, com a fonte e o que muda para o seu negócio.",
  button = "Quero receber",
  style,
}: BandProps) {
  const ref = useCtaImpression(placement, "portal");
  return (
    <div ref={ref} style={{ marginBlock: 40, ...style }}>
      <section className="band" aria-label="Newsletter">
        <div className="txt">
          <p className="kick">{kick}</p>
          <h2>{title}</h2>
          <p>{text}</p>
        </div>
        <PortalSubscribeForm placement={placement} button={button} layout="row" />
      </section>
    </div>
  );
}

/** Ícone de busca do protótipo (#i-search). */
export function SearchIcon() {
  return (
    <svg className="ico" viewBox="0 0 24 24" aria-hidden="true">
      <circle cx="11" cy="11" r="7" />
      <path d="m20 20-3.6-3.6" />
    </svg>
  );
}

/**
 * Lista completa do protótipo: destaque (primeira com foto), 6 cards, faixa de
 * newsletter, demais cards e "Mostrar mais matérias".
 */
export function NewsListing({
  articles,
  placement,
  feature = true,
  emptyText = "Nenhuma matéria encontrada. Tente outra palavra ou outra editoria.",
  resetKey,
  band,
}: ListingProps & { resetKey?: string }) {
  return (
    <NewsListingInner
      key={resetKey}
      articles={articles}
      placement={placement}
      feature={feature}
      emptyText={emptyText}
      band={band}
    />
  );
}

type ListingProps = {
  articles: ArticleRow[];
  placement: string;
  feature?: boolean;
  emptyText?: ReactNode;
  /** Textos da faixa de newsletter; false = sem faixa. */
  band?: Omit<BandProps, "placement"> | false;
};

function NewsListingInner({ articles, placement, feature, emptyText, band }: ListingProps) {
  const [shown, setShown] = useState(NEWS_PAGE_SIZE);
  if (!articles.length) {
    return <p className="empty">{emptyText}</p>;
  }
  const fi = feature ? articles.findIndex((a) => a.cover_image_url) : -1;
  const lead = fi >= 0 ? articles[fi] : null;
  const rest = articles.filter((_, i) => i !== fi);
  const visible = rest.slice(0, shown);
  return (
    <>
      {lead ? (
        <div style={{ marginBottom: 40 }}>
          <NewsFeature a={lead} />
        </div>
      ) : null}
      <NewsGrid items={visible.slice(0, 6)} />
      {/* faixa no meio da grade; com poucas matérias, vai logo depois dela */}
      {band === false ? null : <NewsBand placement={placement} {...band} />}
      <NewsGrid items={visible.slice(6)} />
      {rest.length > shown ? (
        <div className="load-more">
          <button
            className="btn line"
            type="button"
            onClick={() => setShown((n) => n + NEWS_PAGE_SIZE)}
          >
            Mostrar mais matérias
          </button>
        </div>
      ) : null}
    </>
  );
}
