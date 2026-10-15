import { useEffect, useState, useSyncExternalStore } from "react";
import { Link, useNavigate } from "@tanstack/react-router";

import { trackCta } from "@/lib/cta-tracking";
import { PortalSubscribeForm } from "@/components/site/portal-subscribe";

/* Pop-up de newsletter no design do IANews Portal (limpo, central no desktop,
   folha inferior no celular). Mesmas funções públicas de antes. */

let open = false;
let placement = "generico";
const listeners = new Set<() => void>();
let goToSubscribePage: ((from: string) => void) | null = null;

function emit() {
  listeners.forEach((l) => l());
}

/** CTA que leva à página de assinatura. */
export function openSubscribe(from?: string) {
  const source = from ?? "generico";
  trackCta({ event: "click", placement: source, variant: "ir-para-assinar" });
  if (goToSubscribePage) goToSubscribePage(source);
  else if (typeof window !== "undefined") window.location.assign(`/assinar?from=${encodeURIComponent(source)}`);
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

export function SubscribeDialog() {
  const isOpen = useSyncExternalStore(subscribe, () => open, () => false);
  const [done, setDone] = useState<null | { already: boolean }>(null);
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
    if (!isOpen) {
      setDone(null);
      return;
    }
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    window.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div
      className="pop-bg"
      role="dialog"
      aria-modal="true"
      aria-labelledby="pop-title"
      onMouseDown={(e) => e.target === e.currentTarget && setOpen(false)}
    >
      <div className="pop">
        <button className="pop-x" type="button" aria-label="Fechar" onClick={() => setOpen(false)}>
          <svg className="ico" viewBox="0 0 24 24" aria-hidden="true">
            <path d="M6 6l12 12M18 6 6 18" />
          </svg>
        </button>
        {done ? (
          <div>
            <span className="ok-mark">
              <svg className="ico" viewBox="0 0 24 24" aria-hidden="true">
                <path d="m5 12.5 4.5 4.5L19 7.5" />
              </svg>
            </span>
            <h2 id="pop-title">{done.already ? "Você já está na lista" : "Quase lá!"}</h2>
            <p className="lead-p">
              {done.already
                ? "A próxima edição chega no seu e-mail."
                : "Enviamos um e-mail para confirmar a sua inscrição. Confira a caixa de entrada e o spam."}
            </p>
            <a
              className="wa-link"
              href="https://chat.whatsapp.com/Is5edILjICj0D2MMHUmGbL"
              target="_blank"
              rel="noopener noreferrer"
            >
              Quer os destaques no celular? Entre no grupo do WhatsApp →
            </a>
            <div className="actions" style={{ marginTop: 18 }}>
              <button className="btn blue wide" type="button" onClick={() => setOpen(false)}>
                Voltar à leitura
              </button>
            </div>
          </div>
        ) : (
          <div>
            <p className="kick">Newsletter IANews</p>
            <h2 id="pop-title">5 minutos por dia. Zero hype.</h2>
            <p className="lead-p">A IA muda todo dia. Receba só o que importa para o seu negócio.</p>
            <ul className="ticks small">
              <li>Todo dia útil, antes das 8h</li>
              <li>Ranking IA toda segunda</li>
              <li>Grátis, cancele quando quiser</li>
            </ul>
            <PortalSubscribeForm
              placement={placement || "popup"}
              layout="stack"
              wideButton
              onDone={(r) => setDone({ already: r.alreadySubscribed })}
            />
            <p className="fine">
              Gratuita. Você cancela quando quiser. Ao assinar, você aceita a{" "}
              <Link to="/termos" onClick={() => setOpen(false)}>
                política de privacidade
              </Link>
              .
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
