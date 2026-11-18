import { createFileRoute } from "@tanstack/react-router";

import { FgiaPage, fgiaHead } from "@/components/fgia/fgia-page";

/* Landing da FGIA Educação. No domínio fgiaeducacao.com.br ela abre na raiz (ver src/routes/index.tsx);
   aqui fica o endereço alternativo ianewsbr.com/fgia, com canonical para o domínio próprio. */
export const Route = createFileRoute("/fgia")({
  head: () => fgiaHead("https://fgiaeducacao.com.br/"),
  component: FgiaPage,
});
