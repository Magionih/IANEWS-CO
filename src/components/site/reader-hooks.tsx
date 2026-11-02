import { Link } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";

import { openSubscribeDialog } from "@/components/site/subscribe-dialog";
import { useSubscribed } from "@/components/site/portal-subscribe";
import { trackCta } from "@/lib/cta-tracking";

/* Chamadas discretas que seguram o leitor sem interromper a leitura:
   nenhuma é pop-up, nenhuma cobre o texto, e todas somem com um toque.
   - ReadingProgress: linha fina de progresso no topo da matéria.
   - ReadNextNudge: "Leia a seguir" pequeno no canto quando o leitor chega perto do fim.
   - SelectionShare: ao selecionar um trecho, oferece mandar no WhatsApp com o link.
   - ReadStreak: depois da 2ª matéria do dia, uma linha convidando para a newsletter.
   - SinceLastVisit: na home, quantas matérias saíram desde a última visita. */

const safeGet = (store: Storage | undefined, key: string) => {
  try {
    return store?.getItem(key) ?? null;
  } catch {
    return null;
  }
};
const safeSet = (store: Storage | undefined, key: string, value: string) => {
  try {
    store?.setItem(key, value);
  } catch {
    /* navegação privada */
  }
};
const ls = () => (typeof window === "undefined" ? undefined : window.localStorage);
const ss = () => (typeof window === "undefined" ? undefined : window.sessionStorage);

/** Linha de progresso de leitura (2px, azul) presa ao topo da página. */
export function ReadingProgress({ targetSelector = ".art-main" }: { targetSelector?: string }) {
  const bar = useRef<HTMLDivElement>(null);
  useEffect(() => {
    let raf = 0;
    const update = () => {
      raf = 0;
      const el = document.querySelector(targetSelector) as HTMLElement | null;
      if (!el || !bar.current) return;
      const rect = el.getBoundingClientRect();
      const total = Math.max(1, rect.height - window.innerHeight * 0.6);
      const pct = Math.min(1, Math.max(0, -rect.top / total));
      bar.current.style.transform = `scaleX(${pct})`;
    };
    const onScroll = () => {
      if (!raf) raf = window.requestAnimationFrame(update);
    };
    update();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
      if (raf) window.cancelAnimationFrame(raf);
    };
  }, [targetSelector]);
  return <div className="rd-progress" ref={bar} aria-hidden="true" />;
}

type NextArticle = { slug: string; title: string; category: string; read_minutes: number | null };

/** "Leia a seguir": aparece quando o leitor passa de 75% da matéria. Some ao fechar. */
export function ReadNextNudge({
  next,
  currentSlug,
  label,
}: {
  next: NextArticle | null;
  currentSlug: string;
  label: string;
}) {
  const [show, setShow] = useState(false);
  const shown = useRef(false);

  useEffect(() => {
    setShow(false);
    shown.current = false;
    if (!next) return;
    const key = `ianews_next_closed_${currentSlug}`;
    if (safeGet(ss(), key)) return;
    const onScroll = () => {
      if (shown.current) return;
      const el = document.querySelector(".art-main") as HTMLElement | null;
      if (!el) return;
      const rect = el.getBoundingClientRect();
      const read = (window.innerHeight - rect.top) / Math.max(1, rect.height);
      // Só depois de 75% e antes do fim (lá já existe o bloco "Próxima matéria").
      if (read > 0.75 && rect.bottom > window.innerHeight * 1.3) {
        shown.current = true;
        setShow(true);
        trackCta({ event: "impression", placement: "leia-a-seguir", variant: "canto", articleSlug: currentSlug });
      }
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, [next, currentSlug]);

  if (!next || !show) return null;

  const close = () => {
    setShow(false);
    safeSet(ss(), `ianews_next_closed_${currentSlug}`, "1");
    trackCta({ event: "click", placement: "leia-a-seguir", variant: "fechar", articleSlug: currentSlug });
  };

  return (
    <aside className="rd-next" aria-label="Leia a seguir">
      <button type="button" className="rd-next-x" aria-label="Fechar" onClick={close}>
        ×
      </button>
      <span className="rd-next-k">Leia a seguir · {label}</span>
      <Link
        to="/materia/$slug"
        params={{ slug: next.slug }}
        className="rd-next-t"
        onClick={() =>
          trackCta({ event: "click", placement: "leia-a-seguir", variant: "abrir", articleSlug: currentSlug })
        }
      >
        {next.title}
      </Link>
      <span className="rd-next-m">{next.read_minutes ?? 3} min de leitura</span>
    </aside>
  );
}

/** Ao selecionar um trecho da matéria, um botãozinho oferece mandar o trecho no WhatsApp com o link. */
export function SelectionShare({ url, title, articleSlug }: { url: string; title: string; articleSlug: string }) {
  const [pos, setPos] = useState<{ x: number; y: number; text: string } | null>(null);

  useEffect(() => {
    const onUp = () => {
      window.setTimeout(() => {
        const sel = window.getSelection();
        const text = sel?.toString().trim() ?? "";
        if (!sel || sel.rangeCount === 0 || text.length < 20 || text.length > 600) return setPos(null);
        const node = sel.anchorNode instanceof Element ? sel.anchorNode : sel.anchorNode?.parentElement;
        if (!node?.closest(".prose, .why-box, .dek")) return setPos(null);
        const r = sel.getRangeAt(0).getBoundingClientRect();
        setPos({ x: r.left + r.width / 2, y: r.top + window.scrollY, text });
      }, 10);
    };
    const onDown = (e: MouseEvent | TouchEvent) => {
      if (!(e.target as Element | null)?.closest?.(".rd-sel")) setPos(null);
    };
    document.addEventListener("mouseup", onUp);
    document.addEventListener("touchend", onUp);
    document.addEventListener("mousedown", onDown);
    return () => {
      document.removeEventListener("mouseup", onUp);
      document.removeEventListener("touchend", onUp);
      document.removeEventListener("mousedown", onDown);
    };
  }, []);

  if (!pos) return null;
  const quote = pos.text.length > 280 ? `${pos.text.slice(0, 277)}…` : pos.text;
  const wa = `https://wa.me/?text=${encodeURIComponent(`“${quote}”\n\n${title}\n${url}?utm_source=whatsapp&utm_medium=trecho`)}`;

  return (
    <div className="rd-sel" style={{ left: Math.max(70, Math.min(pos.x, window.innerWidth - 70)), top: pos.y - 46 }}>
      <a
        href={wa}
        target="_blank"
        rel="noopener noreferrer"
        onClick={() => {
          trackCta({ event: "click", placement: "trecho-compartilhar", variant: "whatsapp", articleSlug });
          setPos(null);
        }}
      >
        Enviar trecho no WhatsApp
      </a>
    </div>
  );
}

const STREAK_KEY = "ianews_reads_today";

/** Conta as matérias abertas hoje. A partir da 2ª, mostra uma linha discreta para quem não assina. */
export function ReadStreak({ articleSlug }: { articleSlug: string }) {
  const subscribed = useSubscribed();
  const [count, setCount] = useState(0);

  useEffect(() => {
    const today = new Date().toISOString().slice(0, 10);
    let data: { d: string; s: string[] } = { d: today, s: [] };
    try {
      const raw = JSON.parse(safeGet(ls(), STREAK_KEY) ?? "null");
      if (raw && raw.d === today && Array.isArray(raw.s)) data = raw;
    } catch {
      /* ignora */
    }
    if (!data.s.includes(articleSlug)) data.s = [...data.s, articleSlug].slice(-30);
    safeSet(ls(), STREAK_KEY, JSON.stringify(data));
    setCount(data.s.length);
  }, [articleSlug]);

  useEffect(() => {
    if (count >= 2 && !subscribed) {
      trackCta({ event: "impression", placement: "materias-hoje", variant: `${count}`, articleSlug });
    }
  }, [count, subscribed, articleSlug]);

  if (count < 2 || subscribed) return null;
  return (
    <p className="rd-streak">
      <span className="rd-streak-n">{count}</span>
      Você já leu {count} matérias hoje. Que tal receber as próximas no e-mail, às 7h?{" "}
      <button type="button" className="more" onClick={() => openSubscribeDialog("materias-hoje")}>
        Assinar grátis →
      </button>
    </p>
  );
}

const VISIT_KEY = "ianews_last_visit";

/** Na home: "N matérias novas desde a sua última visita", só para quem já visitou antes. */
export function SinceLastVisit({ dates }: { dates: string[] }) {
  const [n, setN] = useState(0);

  useEffect(() => {
    const prev = Number(safeGet(ls(), VISIT_KEY) || 0);
    // Só atualiza a "última visita" depois de alguns segundos na página.
    const t = window.setTimeout(() => safeSet(ls(), VISIT_KEY, String(Date.now())), 8000);
    if (prev && Date.now() - prev > 30 * 60 * 1000) {
      setN(dates.filter((d) => new Date(d).getTime() > prev).length);
    }
    return () => window.clearTimeout(t);
  }, [dates]);

  if (n < 1) return null;
  return (
    <div className="rd-since">
      <span className="rd-dot" aria-hidden="true" />
      {n === 1 ? "1 matéria nova" : `${n} matérias novas`} desde a sua última visita.{" "}
      <Link to="/noticias" search={{ q: "", cat: "all" }} onClick={() => trackCta({ event: "click", placement: "desde-ultima-visita", variant: String(n) })}>
        Ver todas →
      </Link>
    </div>
  );
}
