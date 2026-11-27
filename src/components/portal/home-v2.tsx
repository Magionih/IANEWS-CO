import { useCallback, useEffect, useRef, useState } from "react";
import { Link } from "@tanstack/react-router";

import { CATEGORY_MAP, type CategoryKey } from "@/components/site/category-chip";
import { coverObjectPosition } from "@/lib/cover-position";
import { coverImg, isResizable } from "@/lib/img";
import { useCtaImpression } from "@/hooks/use-cta-impression";
import { trackCta } from "@/lib/cta-tracking";
import { PortalSubscribeForm, useSubscribed } from "@/components/site/portal-subscribe";
import { RankLogo, TrendBadge, fmtScore } from "@/components/portal/rank-shared";
import type { AiTool } from "@/lib/ai-ranking.functions";
import type { DestaqueRow } from "@/lib/articles.functions";

/* Home v2: destaques (pessoas e empresas mais relevantes) abrindo o portal, "Em alta",
   Ranking IA dos assistentes, participação e chamadas ao longo da página. */

const MONTHS = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];

function dataCurta(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const parts = new Intl.DateTimeFormat("en-US", {
    day: "numeric",
    month: "numeric",
    timeZone: "America/Sao_Paulo",
  }).formatToParts(d);
  const get = (t: string) => Number(parts.find((p) => p.type === t)?.value ?? 0);
  return `${get("day")} ${MONTHS[get("month") - 1] ?? ""}`;
}

function catLabel(cat: string): string {
  return CATEGORY_MAP[cat as CategoryKey]?.label ?? "IA News";
}

/** Nome curto da pessoa/empresa do destaque: o cadastrado ou o começo do título. */
function quem(a: DestaqueRow): string {
  if (a.destaque_pessoa) return a.destaque_pessoa;
  const head = a.title.split(/[,:"“]| - | – /)[0]?.trim() ?? a.title;
  return head.length > 28 ? head.slice(0, 26).trimEnd() + "…" : head;
}

function Img({
  src,
  position,
  width,
  eager,
  sizes,
  className,
}: {
  src: string | null;
  position?: string | null;
  width: number;
  eager?: boolean;
  sizes?: string;
  className?: string;
}) {
  const [orig, setOrig] = useState(false);
  const [failed, setFailed] = useState(false);
  if (!src || failed) return <span className={(className ?? "") + " v2-noimg"} />;
  const pic = orig ? { src, srcSet: undefined } : coverImg(src, width);
  return (
    <img
      className={className}
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
  );
}

/* ---------- Destaques: carrossel das pessoas/empresas em evidência + Em alta ---------- */
const ROTATE_MS = 7000;

export function HomeDestaques({ items, emAlta }: { items: DestaqueRow[]; emAlta: DestaqueRow[] }) {
  const track = useRef<HTMLDivElement>(null);
  const rail = useRef<HTMLDivElement>(null);
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

  // Mantém o nome ativo visível na faixa de pessoas, sem rolar a página.
  useEffect(() => {
    const r = rail.current;
    const chip = r?.children[idx] as HTMLElement | undefined;
    if (!r || !chip) return;
    const left = chip.offsetLeft - r.clientWidth / 2 + chip.clientWidth / 2;
    r.scrollTo({ left: Math.max(0, left), behavior: "smooth" });
  }, [idx]);

  useEffect(() => {
    if (paused || n < 2) return;
    if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) return;
    const id = setInterval(() => {
      if (document.visibilityState === "visible") go(idx + 1);
    }, ROTATE_MS);
    return () => clearInterval(id);
  }, [paused, n, idx, go]);

  if (n === 0 && emAlta.length === 0) return null;
  const alta = emAlta.slice(0, 5);

  return (
    <section className="v2-top" aria-labelledby="v2-top-h">
      <h1 className="sr-only">IA News: notícias de inteligência artificial para quem decide</h1>
      <div className="v2-top-grid">
        {n > 0 ? (
          <div
            className="v2-dq"
            aria-roledescription="carrossel"
            onMouseEnter={() => setPaused(true)}
            onMouseLeave={() => setPaused(false)}
            onFocusCapture={() => setPaused(true)}
            onBlurCapture={() => setPaused(false)}
            onTouchStart={() => setPaused(true)}
          >
            <div className="v2-head">
              <h2 id="v2-top-h">
                <span className="v2-live" aria-hidden="true" />
                Em destaque
              </h2>
              <span className="v2-count num" aria-hidden="true">
                {String(idx + 1).padStart(2, "0")} / {String(n).padStart(2, "0")}
              </span>
            </div>
            <div className="v2-dq-stage">
              <div className="v2-dq-track" ref={track}>
                {items.map((a, i) => (
                  <div
                    key={a.id}
                    className="v2-dq-slide"
                    role="group"
                    aria-roledescription="slide"
                    aria-label={`${i + 1} de ${n}`}
                    aria-hidden={i !== idx}
                  >
                    <Link
                      to="/materia/$slug"
                      params={{ slug: a.slug }}
                      tabIndex={i === idx ? 0 : -1}
                      className="v2-dq-card"
                      onClick={() =>
                        trackCta({ event: "click", placement: "home-destaques", variant: a.slug })
                      }
                    >
                      <span className="v2-dq-img">
                        <Img
                          src={a.cover_image_url}
                          position={a.cover_position}
                          width={1280}
                          eager={i === 0}
                          sizes="(max-width: 900px) 100vw, 780px"
                        />
                      </span>
                      <span className="v2-dq-txt">
                        <span className="kick">
                          <span>{catLabel(a.category)}</span>
                          {a.destaque_pessoa ? (
                            <span className="v2-who">{a.destaque_pessoa}</span>
                          ) : null}
                        </span>
                        <b className="v2-dq-title">{a.title}</b>
                        {a.dek ? <span className="v2-dq-dek">{a.dek}</span> : null}
                        <span className="when">
                          {dataCurta(a.published_at)}
                          {a.read_minutes ? ` · ${a.read_minutes} min de leitura` : ""}
                        </span>
                      </span>
                    </Link>
                  </div>
                ))}
              </div>
              {n > 1 ? (
                <>
                  <button
                    type="button"
                    className="v2-arrow prev"
                    aria-label="Destaque anterior"
                    onClick={() => go(idx - 1)}
                  >
                    <svg viewBox="0 0 24 24" aria-hidden="true">
                      <path d="m15 6-6 6 6 6" />
                    </svg>
                  </button>
                  <button
                    type="button"
                    className="v2-arrow next"
                    aria-label="Próximo destaque"
                    onClick={() => go(idx + 1)}
                  >
                    <svg viewBox="0 0 24 24" aria-hidden="true">
                      <path d="m9 6 6 6-6 6" />
                    </svg>
                  </button>
                </>
              ) : null}
            </div>
            {n > 1 ? (
              <div className="v2-rail" ref={rail} role="tablist" aria-label="Escolher destaque">
                {items.map((a, i) => (
                  <button
                    key={a.id}
                    type="button"
                    role="tab"
                    aria-selected={i === idx}
                    className={i === idx ? "on" : undefined}
                    onClick={() => go(i)}
                  >
                    <span className="v2-rail-av">
                      <Img src={a.cover_image_url} position={a.cover_position} width={160} />
                    </span>
                    <span className="v2-rail-nm">{quem(a)}</span>
                    <i className="v2-rail-bar" aria-hidden="true" />
                  </button>
                ))}
              </div>
            ) : null}
          </div>
        ) : null}

        {alta.length ? (
          <aside className="v2-alta" aria-labelledby="v2-alta-h">
            <div className="v2-head">
              <h2 id="v2-alta-h">Em alta esta semana</h2>
            </div>
            <ol>
              {alta.map((a, i) => (
                <li key={a.id}>
                  <Link
                    to="/materia/$slug"
                    params={{ slug: a.slug }}
                    onClick={() =>
                      trackCta({ event: "click", placement: "home-em-alta", variant: a.slug })
                    }
                  >
                    <span className="v2-n num">{i + 1}</span>
                    <span className="v2-alta-txt">
                      <span className="v2-alta-k">{catLabel(a.category)}</span>
                      <b>{a.title}</b>
                    </span>
                    <span className="v2-alta-img">
                      <Img src={a.cover_image_url} position={a.cover_position} width={320} />
                    </span>
                  </Link>
                </li>
              ))}
            </ol>
            <Link
              to="/pauta"
              className="v2-alta-cta"
              onClick={() =>
                trackCta({ event: "click", placement: "home-em-alta", variant: "pauta" })
              }
            >
              <span>
                <b>Sua empresa usa IA?</b>
                <span>Conte a sua história para a redação.</span>
              </span>
              <i aria-hidden="true">→</i>
            </Link>
          </aside>
        ) : null}
      </div>
    </section>
  );
}

/* ---------- Ranking IA: os assistentes que todo mundo usa ---------- */
const ATALHOS = [
  { cat: "codigo", label: "Programar" },
  { cat: "imagem", label: "Imagem" },
  { cat: "video", label: "Vídeo" },
  { cat: "audio", label: "Áudio e voz" },
  { cat: "pesquisa", label: "Pesquisa" },
  { cat: "negocios", label: "Negócios" },
] as const;

export function HomeRankingV2({ tools }: { tools: AiTool[] }) {
  const subscribed = useSubscribed();
  const ref = useCtaImpression("home-ranking", "assistentes");
  const chat = [...tools]
    .filter((t) => t.category === "chat")
    .sort((a, b) => b.weekly_score - a.weekly_score)
    .slice(0, 6);
  if (chat.length === 0) return null;
  const lideres = ATALHOS.map((c) => {
    const best = tools
      .filter((t) => t.category === c.cat)
      .sort((a, b) => b.weekly_score - a.weekly_score)[0];
    return best ? { ...c, tool: best } : null;
  }).filter(Boolean) as { cat: string; label: string; tool: AiTool }[];

  return (
    <section className="sec" ref={ref}>
      <div className="sec-head">
        <h2>Ranking IA</h2>
        <Link className="more" to="/ranking">
          Ver as {tools.length} plataformas →
        </Link>
      </div>
      <div className="v2-rk">
        <div className="v2-rk-intro">
          <h3>Qual assistente de IA está melhor hoje?</h3>
          <p>
            Gemini, ChatGPT, Claude, Grok e cia. com nota de 0 a 10, recalculada todo dia com
            desempenho técnico, repercussão e a avaliação dos leitores.
          </p>
        </div>
        <ol className="v2-rk-grid">
          {chat.map((t, i) => (
            <li key={t.id}>
              <Link
                to="/ranking"
                search={{ cat: "chat" }}
                className={"v2-rk-card" + (i === 0 ? " top" : "")}
              >
                <span className="v2-rk-pos num">{i + 1}º</span>
                <RankLogo m={t} className="v2-rk-logo" />
                <b className="v2-rk-nm">{t.name}</b>
                <span className="v2-rk-mk">{t.maker}</span>
                <span className="v2-rk-sc num">
                  {fmtScore(t.weekly_score)}
                  <small>/10</small>
                </span>
                <span className="v2-rk-bar" aria-hidden="true">
                  <i style={{ width: `${Math.max(0, Math.min(100, t.weekly_score * 10))}%` }} />
                </span>
                <TrendBadge tool={t} />
              </Link>
            </li>
          ))}
        </ol>
        {lideres.length ? (
          <div className="v2-rk-cats" aria-label="Melhor por categoria">
            <span className="v2-rk-cats-t">Melhor para</span>
            {lideres.map((l) => (
              <Link key={l.cat} to="/ranking" search={{ cat: l.cat }} className="v2-rk-chip">
                <RankLogo m={l.tool} />
                <span>
                  <small>{l.label}</small>
                  <b>{l.tool.name}</b>
                </span>
              </Link>
            ))}
          </div>
        ) : null}
        {!subscribed ? (
          <div className="v2-rk-nl">
            <p>
              <b>Ranking IA toda segunda no seu e-mail.</b> Quem subiu, quem caiu e o que mudou.
            </p>
            <PortalSubscribeForm placement="home-ranking" button="Quero receber" />
          </div>
        ) : null}
      </div>
    </section>
  );
}

/* ---------- Participe ---------- */
const AMANDA =
  "https://hgydwvuowxxkdgtlqrdy.supabase.co/storage/v1/object/public/covers/amanda-diniz-divos-da-ia-empresa-agentica/2ab712919abf.jpg";
const PALCO_IMG =
  "https://images.pexels.com/photos/9275222/pexels-photo-9275222.jpeg?auto=compress&cs=tinysrgb&w=640";
const FACES = [
  "/gente/tarciana.jpg",
  "/gente/diego.jpg",
  "/gente/monica-retrato.jpg",
  "/gente/luis.jpg",
];

export function HomeParticipeV2() {
  const ref = useCtaImpression("home-participe", "v2");
  const click = (variant: string) => () =>
    trackCta({ event: "click", placement: "home-participe", variant });
  const palcoAberto = Date.now() < new Date("2026-12-16T20:30:00-03:00").getTime();
  return (
    <section className="v2-pq" aria-labelledby="v2-pq-h" ref={ref}>
      <div className="v2-pq-head">
        <p className="kick">Faça parte</p>
        <h2 id="v2-pq-h">Participe da IA News</h2>
        <p>Vire notícia, indique quem faz IA acontecer e encontre a comunidade ao vivo.</p>
      </div>
      <div className="v2-pq-grid">
        <Link to="/pauta" className="v2-pq-card" onClick={click("pauta")}>
          <span className="v2-pq-img">
            <img src={AMANDA} alt="" loading="lazy" width={480} height={300} />
            <em>Gratuito</em>
          </span>
          <span className="v2-pq-body">
            <span className="v2-pq-k">Sua empresa na IA News</span>
            <b>Vire notícia: conte como sua empresa usa IA</b>
            <span className="v2-pq-t">A redação lê todas as pautas e responde em até 2 dias.</span>
            <span className="v2-pq-cta">Enviar minha pauta →</span>
          </span>
        </Link>
        <Link to="/lista100" hash="candidatura" className="v2-pq-card" onClick={click("lista100")}>
          <span className="v2-pq-img v2-pq-faces">
            {FACES.map((f) => (
              <img key={f} src={f} alt="" loading="lazy" width={120} height={120} />
            ))}
            <em>Até 07/12</em>
          </span>
          <span className="v2-pq-body">
            <span className="v2-pq-k">Lista IA News 100</span>
            <b>Indique quem faz a IA acontecer no Brasil</b>
            <span className="v2-pq-t">Os 100 nomes saem ao vivo no Palco de 16/12.</span>
            <span className="v2-pq-cta">Indicar um nome →</span>
          </span>
        </Link>
        <Link
          to={palcoAberto ? "/palco" : "/eventos"}
          className="v2-pq-card"
          onClick={click("palco")}
        >
          <span className="v2-pq-img">
            <img src={PALCO_IMG} alt="" loading="lazy" width={480} height={300} />
            <em className="live">{palcoAberto ? "Ao vivo · 16/12 · 19h" : "Eventos"}</em>
          </span>
          <span className="v2-pq-body">
            <span className="v2-pq-k">Palco IA News Online</span>
            <b>O Raio-X 2026 da IA nas empresas brasileiras</b>
            <span className="v2-pq-t">Casos reais, Playbook IA 2027 e gravação por 30 dias.</span>
            <span className="v2-pq-cta">
              {palcoAberto ? "Garantir vaga · R$ 97 →" : "Ver agenda →"}
            </span>
          </span>
        </Link>
      </div>
    </section>
  );
}

/* ---------- Chamadas entre as seções ---------- */
export function HomeCta({ kind }: { kind: "pauta" | "eventos" | "gente" | "anuncie" }) {
  const ref = useCtaImpression("home-cta", kind);
  const onClick = () => trackCta({ event: "click", placement: "home-cta", variant: kind });
  if (kind === "pauta")
    return (
      <div className="v2-cta" ref={ref}>
        <span className="v2-cta-ic" aria-hidden="true">
          ✦
        </span>
        <p>
          <b>A próxima história pode ser a da sua empresa.</b> Se você usa IA de verdade no negócio,
          a redação quer saber.
        </p>
        <Link to="/pauta" className="btn blue s" onClick={onClick}>
          Enviar pauta
        </Link>
      </div>
    );
  if (kind === "gente")
    return (
      <div className="v2-cta soft" ref={ref}>
        <span className="v2-cta-faces" aria-hidden="true">
          {FACES.map((f) => (
            <img key={f} src={f} alt="" loading="lazy" width={36} height={36} />
          ))}
        </span>
        <p>
          <b>Gente: quem faz a IA no Brasil.</b> Perfis de fundadores, executivos e criadores que
          estão colocando IA para rodar.
        </p>
        <Link to="/gente" className="btn line s" onClick={onClick}>
          Conhecer
        </Link>
      </div>
    );
  if (kind === "anuncie")
    return (
      <div className="v2-cta soft" ref={ref}>
        <span className="v2-cta-big num" aria-hidden="true">
          1 mi+
        </span>
        <p>
          <b>Visualizações em 30 dias.</b> Coloque sua marca na conversa sobre IA com conteúdo em
          collab, aprovado por você.
        </p>
        <Link to="/anuncie" className="btn line s" onClick={onClick}>
          Ver planos
        </Link>
      </div>
    );
  const aberto = Date.now() < new Date("2026-12-16T20:30:00-03:00").getTime();
  return (
    <div className="v2-ev" ref={ref}>
      <div className="v2-ev-date" aria-hidden="true">
        <b>16</b>
        <span>dez</span>
      </div>
      <div className="v2-ev-txt">
        <p className="kick">{aberto ? "Próximo evento · online e ao vivo" : "Eventos IA News"}</p>
        <h3>Palco IA News Online: Raio-X 2026 da IA nas empresas</h3>
        <p>Casos reais, o Playbook IA 2027 e a revelação da Lista IA News 100.</p>
      </div>
      <Link to={aberto ? "/palco" : "/eventos"} className="btn blue" onClick={onClick}>
        {aberto ? "Garantir vaga · R$ 97" : "Ver agenda"}
      </Link>
    </div>
  );
}
