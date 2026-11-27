import { useEffect, useRef, useState, useSyncExternalStore, type ReactNode } from "react";
import { Link, useNavigate, useRouterState } from "@tanstack/react-router";

import { trackCta } from "@/lib/cta-tracking";
import { PerfilStep, PortalSubscribeForm } from "@/components/site/portal-subscribe";

/* Pop-up de newsletter no design do IANews Portal (central no desktop, folha inferior no celular).
   Fecha de todas as formas: X, "Agora não", Esc, toque fora, arrastar para baixo e troca de página.
   Depois de fechar, o próximo pop-up automático só aparece depois de um intervalo; quem fecha
   muitos seguidos fica um tempo sem pop-ups automáticos. */

let open = false;
let placement = "generico";
const listeners = new Set<() => void>();
let goToSubscribePage: ((from: string) => void) | null = null;

const DISMISS_KEY = "ianews_pop_dispensas";
/** Intervalo mínimo depois de fechar um pop-up. */
const COOLDOWN_MS = 90_000;
/** Quem fecha 4 pop-ups em 24 horas fica 12 horas sem pop-up automático. */
const CANSADO_QTD = 4;
const CANSADO_MS = 12 * 3600 * 1000;

function emit() {
  listeners.forEach((l) => l());
}

function lerDispensas(): number[] {
  try {
    const v = JSON.parse(localStorage.getItem(DISMISS_KEY) ?? "[]");
    return Array.isArray(v) ? v.filter((n) => typeof n === "number") : [];
  } catch {
    return [];
  }
}

/** Marca que a pessoa dispensou um pop-up. */
export function markPopupDismissed() {
  try {
    const dia = Date.now() - 24 * 3600 * 1000;
    const lista = [...lerDispensas().filter((t) => t > dia), Date.now()].slice(-10);
    localStorage.setItem(DISMISS_KEY, JSON.stringify(lista));
  } catch {
    /* ignore */
  }
}

/** true quando um pop-up automático deve esperar: logo depois de fechar, ou após muitas recusas. */
export function popupSnoozed(): boolean {
  try {
    const agora = Date.now();
    const lista = lerDispensas();
    const ultima = lista[lista.length - 1] ?? 0;
    if (agora - ultima < COOLDOWN_MS) return true;
    const recentes = lista.filter((t) => agora - t < 24 * 3600 * 1000);
    if (recentes.length >= CANSADO_QTD && agora - ultima < CANSADO_MS) return true;
    return false;
  } catch {
    return true;
  }
}

/** CTA que leva à página de assinatura. */
export function openSubscribe(from?: string) {
  const source = from ?? "generico";
  trackCta({ event: "click", placement: source, variant: "ir-para-assinar" });
  if (goToSubscribePage) goToSubscribePage(source);
  else if (typeof window !== "undefined")
    window.location.assign(`/assinar?from=${encodeURIComponent(source)}`);
}

/** Abre o pop-up de assinatura. */
export function openSubscribeDialog(from?: string) {
  placement = from ?? "generico";
  open = true;
  trackCta({ event: "click", placement, variant: "abrir-popup" });
  emit();
}

function setOpen(next: boolean) {
  open = next;
  emit();
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/** Moldura comum dos pop-ups do site: fundo, X, Esc, toque fora, arrastar para baixo, troca de página. */
export function PopShell({
  onClose,
  labelledBy,
  wide,
  children,
}: {
  onClose: () => void;
  labelledBy: string;
  wide?: boolean;
  children: ReactNode;
}) {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const firstPath = useRef(pathname);
  const sheet = useRef<HTMLDivElement>(null);
  const drag = useRef<{ y: number; dy: number } | null>(null);
  const closeRef = useRef(onClose);
  closeRef.current = onClose;

  useEffect(() => {
    if (pathname !== firstPath.current) closeRef.current();
  }, [pathname]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") closeRef.current();
    };
    window.addEventListener("keydown", onKey);
    const html = document.documentElement;
    const prev = html.style.overflow;
    html.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      html.style.overflow = prev === "hidden" ? "" : prev;
      document.body.style.overflow = "";
    };
  }, []);

  return (
    <div
      className="pop-bg"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        ref={sheet}
        className={"pop" + (wide ? " wide" : "")}
        role="dialog"
        aria-modal="true"
        aria-labelledby={labelledBy}
        onTouchStart={(e) => {
          if ((sheet.current?.scrollTop ?? 0) > 0) return;
          drag.current = { y: e.touches[0].clientY, dy: 0 };
        }}
        onTouchMove={(e) => {
          if (!drag.current || !sheet.current) return;
          const dy = Math.max(0, e.touches[0].clientY - drag.current.y);
          drag.current.dy = dy;
          sheet.current.style.transform = dy ? `translateY(${dy}px)` : "";
        }}
        onTouchEnd={() => {
          const d = drag.current;
          drag.current = null;
          if (sheet.current) sheet.current.style.transform = "";
          if (d && d.dy > 90) onClose();
        }}
      >
        <span className="pop-grab" aria-hidden="true" />
        <button className="pop-x" type="button" aria-label="Fechar" onClick={onClose}>
          <svg className="ico" viewBox="0 0 24 24" aria-hidden="true">
            <path d="M6 6l12 12M18 6 6 18" />
          </svg>
        </button>
        {children}
        <button type="button" className="pop-later" onClick={onClose}>
          Agora não
        </button>
      </div>
    </div>
  );
}

export function SubscribeDialog() {
  const isOpen = useSyncExternalStore(
    subscribe,
    () => open,
    () => false,
  );
  const [done, setDone] = useState<null | { already: boolean; email: string }>(null);
  const navigate = useNavigate();

  useEffect(() => {
    goToSubscribePage = (from: string) => {
      open = false;
      emit();
      navigate({ to: "/assinar", search: { from } });
    };
    return () => {
      goToSubscribePage = null;
    };
  }, [navigate]);

  useEffect(() => {
    if (!isOpen) setDone(null);
  }, [isOpen]);

  if (!isOpen) return null;

  const close = () => {
    if (!done) {
      markPopupDismissed();
      trackCta({ event: "click", placement, variant: "fechar-popup" });
    }
    setOpen(false);
  };

  return (
    <PopShell onClose={close} labelledBy="pop-title">
      {done ? (
        <div>
          <span className="ok-mark">
            <svg className="ico" viewBox="0 0 24 24" aria-hidden="true">
              <path d="m5 12.5 4.5 4.5L19 7.5" />
            </svg>
          </span>
          <h2 id="pop-title">
            {done.already ? "Você já está na lista" : "Pronto, inscrição feita!"}
          </h2>
          {done.already ? (
            <p className="lead-p">A próxima edição chega no seu e-mail.</p>
          ) : (
            <PerfilStep email={done.email} />
          )}
          <a
            className="wa-link"
            href="https://chat.whatsapp.com/Is5edILjICj0D2MMHUmGbL"
            target="_blank"
            rel="noopener noreferrer"
          >
            Quer os destaques no celular? Entre no grupo do WhatsApp →
          </a>
        </div>
      ) : (
        <div>
          <p className="kick">Newsletter IANews</p>
          <h2 id="pop-title">5 minutos por dia. Zero hype.</h2>
          <p className="lead-p">A IA muda todo dia. Receba só o que importa para o seu negócio.</p>
          <ul className="ticks small">
            <li>Todo dia às 7h da manhã</li>
            <li>Ranking IA toda segunda</li>
            <li>Grátis, cancele quando quiser</li>
          </ul>
          <PortalSubscribeForm
            placement={placement || "popup"}
            layout="stack"
            wideButton
            onDone={(r) => setDone({ already: r.alreadySubscribed, email: r.email })}
          />
          <p className="fine">
            Ao assinar, você aceita a{" "}
            <Link to="/termos" onClick={() => setOpen(false)}>
              política de privacidade
            </Link>
            .
          </p>
        </div>
      )}
    </PopShell>
  );
}
