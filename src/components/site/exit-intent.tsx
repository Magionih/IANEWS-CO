import { useEffect, useRef } from "react";
import { useRouterState } from "@tanstack/react-router";

import { openSubscribeDialog } from "@/components/site/subscribe-dialog";
import { trackCta } from "@/lib/cta-tracking";

const KEY = "ianews_exit_shown";
const HIDDEN_PREFIXES = ["/admin", "/auth", "/cadastro", "/habitos"];

/** Abre o pop-up de assinatura na intenção de saída (desktop) ou após 60s de leitura. */
export function ExitIntent() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const fired = useRef(false);

  useEffect(() => {
    if (HIDDEN_PREFIXES.some((p) => pathname.startsWith(p))) return;
    try {
      if (sessionStorage.getItem(KEY)) return;
    } catch {
      return;
    }

    const fire = (variant: string) => {
      if (fired.current) return;
      fired.current = true;
      try {
        sessionStorage.setItem(KEY, "1");
      } catch {
        /* ignore */
      }
      trackCta({ event: "impression", placement: "exit-intent", variant });
      openSubscribeDialog(`exit-intent-${variant}`);
    };

    const onLeave = (e: MouseEvent) => {
      if (e.clientY <= 0) fire("saida");
    };

    const timer = window.setTimeout(() => fire("tempo-90s"), 90000);
    document.addEventListener("mouseout", onLeave);
    return () => {
      window.clearTimeout(timer);
      document.removeEventListener("mouseout", onLeave);
    };
  }, [pathname]);

  return null;
}
