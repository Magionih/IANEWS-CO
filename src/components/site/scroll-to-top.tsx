import { useEffect, useRef } from "react";
import { useRouterState } from "@tanstack/react-router";

/**
 * Página nova começa no topo; ao voltar/avançar pelo navegador, a rolagem anterior
 * é restaurada pelo roteador (scrollRestoration), então aqui não mexemos.
 */
export function ScrollToTop() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const hash = useRouterState({ select: (s) => s.location.hash });
  const popped = useRef(false);

  useEffect(() => {
    const onPop = () => {
      popped.current = true;
    };
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (popped.current) {
      popped.current = false;
      return;
    }
    if (hash) return;
    window.scrollTo({ top: 0, left: 0, behavior: "auto" });
  }, [pathname, hash]);

  return null;
}

/** Barra fina no topo enquanto a próxima página carrega (só aparece se demorar). */
export function RouteProgress() {
  const pending = useRouterState({ select: (s) => s.status === "pending" });
  return <div className={"route-progress" + (pending ? " on" : "")} aria-hidden="true" />;
}
