import { useEffect } from "react";
import { useRouterState } from "@tanstack/react-router";

/**
 * Toda navegação para uma nova página começa no topo da tela.
 * (Sem isso, abrir uma matéria a partir de uma lista longa mantinha
 * a rolagem anterior e o leitor caía no meio do texto.)
 */
export function ScrollToTop() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const hash = useRouterState({ select: (s) => s.location.hash });

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (hash) return;
    window.scrollTo({ top: 0, left: 0, behavior: "auto" });
    document.documentElement.scrollTop = 0;
    document.body.scrollTop = 0;
  }, [pathname, hash]);

  return null;
}
