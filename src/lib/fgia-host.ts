import { createIsomorphicFn } from "@tanstack/react-start";

/* Nome do host da requisição: no servidor vem do cabeçalho, no navegador da barra de endereço.
   Serve para o domínio fgiaeducacao.com.br mostrar a landing da FGIA na raiz. */
export const getRequestHostname = createIsomorphicFn()
  .server(async () => {
    const { getRequestHeader } = await import("@tanstack/react-start/server");
    return getRequestHeader("x-forwarded-host") ?? getRequestHeader("host") ?? "";
  })
  .client(async () => window.location.hostname);
