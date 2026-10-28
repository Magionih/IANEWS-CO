import { useEffect, useState } from "react";
import { useRouterState } from "@tanstack/react-router";
import { Mail, X } from "lucide-react";

import { openSubscribe } from "@/components/site/subscribe-dialog";
import { useConsent } from "@/components/site/consent-banner";
import { trackCta } from "@/lib/cta-tracking";

const DISMISS_KEY = "ianews_sticky_dismissed";
const HIDDEN_PREFIXES = ["/admin", "/auth", "/cadastro", "/habitos", "/pauta"];

/** Barra fixa de captação que aparece após 35% de rolagem. */
export function StickyCta() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const { consent, ready } = useConsent();
  const [visible, setVisible] = useState(false);

  // Enquanto o aviso de cookies está aberto, a barra fica escondida para não
  // empilhar dois blocos fixos no rodapé.
  const blocked = HIDDEN_PREFIXES.some((p) => pathname.startsWith(p)) || !ready || !consent;

  useEffect(() => {
    if (blocked) return;
    try {
      if (sessionStorage.getItem(DISMISS_KEY)) return;
    } catch {
      /* ignore */
    }
    const onScroll = () => {
      const doc = document.documentElement;
      const total = Math.max(1, doc.scrollHeight - window.innerHeight);
      if (window.scrollY / total > 0.35) setVisible(true);
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    onScroll();
    return () => window.removeEventListener("scroll", onScroll);
  }, [blocked, pathname]);

  useEffect(() => {
    if (visible) trackCta({ event: "impression", placement: "sticky-bar", variant: "scroll-35" });
  }, [visible]);

  if (blocked || !visible) return null;

  return (
    <div className="fixed inset-x-0 bottom-0 z-40 border-t-2 border-black bg-[color:var(--color-nav)] px-4 py-3 text-white shadow-2xl">
      <div className="mx-auto flex max-w-[1400px] items-center gap-3">
        <p className="min-w-0 flex-1 text-xs font-semibold leading-snug sm:text-sm">
          <span className="hidden sm:inline">Receba a análise diária de IA para decisores. </span>
          Grátis, todo dia às 7h.
        </p>
        <button
          type="button"
          onClick={() => openSubscribe("sticky-bar")}
          className="inline-flex shrink-0 items-center gap-2 bg-[color:var(--color-lime)] px-4 py-2 text-[11px] font-bold uppercase tracking-wide text-white sm:text-xs"
        >
          <Mail className="h-3.5 w-3.5" /> Assinar grátis
        </button>
        <button
          type="button"
          aria-label="Fechar"
          onClick={() => {
            setVisible(false);
            try {
              sessionStorage.setItem(DISMISS_KEY, "1");
            } catch {
              /* ignore */
            }
            trackCta({ event: "click", placement: "sticky-bar", variant: "dispensar" });
          }}
          className="shrink-0 p-1 text-white/60 transition-colors hover:text-white"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
