import { useEffect, useState } from "react";
import { createFileRoute, Link, useSearch } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { CheckCircle2, Loader2, XCircle } from "lucide-react";

import { confirmLead } from "@/lib/newsletter.functions";
import { trackCta } from "@/lib/cta-tracking";

export const Route = createFileRoute("/confirmar")({
  validateSearch: (search: Record<string, unknown>) => ({
    t: typeof search["t"] === "string" ? search["t"] : "",
  }),
  head: () => ({
    meta: [
      { title: "Confirmar assinatura | IA News" },
      {
        name: "description",
        content:
          "Confirme sua assinatura do IA News e receba a edição diária com as principais notícias de inteligência artificial.",
      },
      { property: "og:title", content: "Confirmar assinatura | IA News" },
      {
        property: "og:description",
        content: "Um clique para começar a receber a edição diária do IA News.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: ConfirmPage,
});

function ConfirmPage() {
  const { t } = useSearch({ from: "/confirmar" });
  const confirm = useServerFn(confirmLead);
  const [state, setState] = useState<"loading" | "ok" | "already" | "error">("loading");

  useEffect(() => {
    if (!t) {
      setState("error");
      return;
    }
    confirm({ data: { token: t } })
      .then((res) => {
        if (!res.ok) {
          setState("error");
          return;
        }
        setState(res.already ? "already" : "ok");
        if (!res.already) {
          trackCta({ event: "convert", placement: "confirmacao-email", variant: "double-opt-in" });
        }
      })
      .catch(() => setState("error"));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [t]);

  return (
    <main className="mx-auto flex min-h-[60vh] w-full max-w-xl flex-col items-center justify-center px-5 py-16 text-center">
      {state === "loading" ? (
        <>
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <p className="mt-4 text-sm text-muted-foreground">Confirmando sua assinatura...</p>
        </>
      ) : null}

      {state === "ok" || state === "already" ? (
        <>
          <CheckCircle2 className="h-12 w-12 text-primary" />
          <h1 className="mt-4 text-3xl font-extrabold leading-tight">
            {state === "ok" ? "Assinatura confirmada!" : "Você já estava confirmado"}
          </h1>
          <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
            A edição diária do IA News chega no seu e-mail antes das 8h, com análise de impacto
            para quem precisa decidir.
          </p>
        </>
      ) : null}

      {state === "error" ? (
        <>
          <XCircle className="h-12 w-12 text-destructive" />
          <h1 className="mt-4 text-3xl font-extrabold leading-tight">Link inválido</h1>
          <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
            Esse link de confirmação expirou ou não existe. Faça a inscrição novamente na home.
          </p>
        </>
      ) : null}

      {state !== "loading" ? (
        <Link
          to="/"
          className="mt-8 inline-flex items-center justify-center rounded-full bg-[color:var(--color-nav)] px-6 py-3 text-sm font-bold uppercase tracking-wide text-white"
        >
          Ler as notícias de hoje
        </Link>
      ) : null}
    </main>
  );
}
