import { useCallback, useEffect, useRef, useState } from "react";
import { Link } from "@tanstack/react-router";

import { CATEGORY_MAP, type CategoryKey } from "@/components/site/category-chip";
import { coverObjectPosition } from "@/lib/cover-position";
import { coverImg, isResizable } from "@/lib/img";
import { useCtaImpression } from "@/hooks/use-cta-impression";
import { trackCta } from "@/lib/cta-tracking";
import { RankLogo, fmtScore } from "@/components/portal/rank-shared";
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
/** O carrossel de destaques troca sozinho, sempre, a cada 3 segundos. */
const ROTATE_MS = 3000;

export function HomeDestaques({ items, emAlta }: { items: DestaqueRow[]; emAlta: DestaqueRow[] }) {
  const track = useRef<HTMLDivElement>(null);
  const [idx, setIdx] = useState(0);
  const n = items.length;

  const go = useCallback(
    (i: number) => {
      const el = track.current;
      if (!el || n === 0) return;
      const next = ((i % n) + n) % n;
      const calmo = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
      el.scrollTo({ left: next * el.clientWidth, behavior: calmo ? "auto" : "smooth" });
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

  // Passa sozinho o tempo inteiro: cada destaque fica 3 segundos (no celular, também dá para arrastar).
  useEffect(() => {
    if (n < 2) return;
    const id = setTimeout(() => {
      if (document.visibilityState === "visible") go(idx + 1);
    }, ROTATE_MS);
    return () => clearTimeout(id);
  }, [n, idx, go]);

  if (n === 0 && emAlta.length === 0) return null;
  const alta = emAlta.slice(0, 5);

  return (
    <section className="v2-top" aria-labelledby="v2-top-h">
      <h1 className="sr-only">IA News: notícias de inteligência artificial para quem decide</h1>
      <div className="v2-top-grid">
        {n > 0 ? (
          <div className="v2-dq" aria-roledescription="carrossel">
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
                        <span className="kick">{catLabel(a.category)}</span>
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
            </div>
          </div>
        ) : null}

        {alta.length ? (
          <aside className="v2-alta" aria-labelledby="v2-alta-h">
            <div className="v2-head">
              <h2 id="v2-alta-h">Em alta esta semana</h2>
            </div>
            <ol>
              {alta.map((a) => (
                <li key={a.id}>
                  <Link
                    to="/materia/$slug"
                    params={{ slug: a.slug }}
                    onClick={() =>
                      trackCta({ event: "click", placement: "home-em-alta", variant: a.slug })
                    }
                  >
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
      <div className="v2-rk2">
        <p className="v2-rk2-t">
          <b>Os assistentes de IA mais bem avaliados hoje.</b> Nota de 0 a 10, atualizada todo dia.
        </p>
        <ol className="v2-rk2-list">
          {chat.map((t, i) => (
            <li key={t.id}>
              <Link to="/ranking" search={{ cat: "chat" }} className="v2-rk2-row">
                <span className="v2-rk2-pos num">{i + 1}</span>
                <RankLogo m={t} className="v2-rk2-logo" />
                <span className="v2-rk2-nm">
                  <b>{t.name}</b>
                  <small>{t.maker}</small>
                </span>
                <span className="v2-rk2-sc num">{fmtScore(t.weekly_score)}</span>
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
            <img
              src={AMANDA}
              alt=""
              loading="lazy"
              width={480}
              height={300}
              style={{ objectPosition: "50% 14%" }}
            />
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
export function HomeCta({ kind }: { kind: "pauta" | "eventos" | "protagonistas" | "anuncie" }) {
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
  if (kind === "protagonistas")
    return (
      <div className="v2-cta soft" ref={ref}>
        <span className="v2-cta-faces" aria-hidden="true">
          {FACES.map((f) => (
            <img key={f} src={f} alt="" loading="lazy" width={36} height={36} />
          ))}
        </span>
        <p>
          <b>Protagonistas: quem faz a IA acontecer no Brasil.</b> Perfis de fundadores, executivos
          e criadores que estão colocando IA para rodar.
        </p>
        <Link to="/protagonistas" className="btn line s" onClick={onClick}>
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
