import { QueryClient } from "@tanstack/react-query";
import { createRouter } from "@tanstack/react-router";
import { routeTree } from "./routeTree.gen";

export const getRouter = () => {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { staleTime: 60_000, refetchOnWindowFocus: false, retry: 1 } },
  });

  const router = createRouter({
    routeTree,
    context: { queryClient },
    scrollRestoration: true,
    // Pré-carrega a próxima página quando o link recebe hover/foco/toque,
    // e reaproveita o que já foi carregado por 1 minuto ao voltar.
    defaultPreload: "intent",
    defaultPreloadDelay: 50,
    defaultPreloadStaleTime: 30_000,
    defaultStaleTime: 60_000,
    defaultGcTime: 5 * 60_000,
    defaultPendingMs: 300,
    defaultPendingMinMs: 0,
  });

  return router;
};
