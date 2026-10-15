import { useEffect, useState } from "react";
import { createFileRoute, Link, useSearch } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";

import { SiteHeader } from "@/components/site/header";
import { SiteFooter } from "@/components/site/footer";
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

  const mark = (ok: boolean) => (
    <span
      aria-hidden="true"
      style={{
        width: 44,
        height: 44,
        borderRadius: "50%",
        display: "grid",
        placeItems: "center",
        color: "#fff",
        background: ok ? "var(--p-good)" : "var(--p-bad)",
        margin: "0 auto",
      }}
    >
      <svg
        className="ico"
        viewBox="0 0 24 24"
        width="22"
        height="22"
        fill="none"
        stroke="currentColor"
        strokeWidth="3"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        {ok ? <path d="m5 12.5 4.5 4.5L19 7.5" /> : <path d="M6 6l12 12M18 6 6 18" />}
      </svg>
    </span>
  );

  return (
    <>
      <SiteHeader />
      <main id="main">
        <div className="wrap">
          <div className="page-head">
            <p className="kick">Newsletter IA News</p>
            <h1>
              {state === "loading"
                ? "Confirmando sua assinatura"
                : state === "error"
                  ? "Link inválido"
                  : state === "ok"
                    ? "Assinatura confirmada!"
                    : "Você já estava confirmado"}
            </h1>
          </div>
          <section
            className="panel-form"
            style={{
              maxWidth: 520,
              margin: "0 auto 64px",
              padding: 32,
              textAlign: "center",
              justifyItems: "center",
              boxShadow: "var(--p-shadow)",
            }}
            aria-live="polite"
          >
            {state === "loading" ? (
              <p className="msg" role="status">
                Confirmando sua assinatura...
              </p>
            ) : null}

            {state === "ok" || state === "already" ? (
              <>
                {mark(true)}
                <p style={{ color: "var(--p-ink-2)", fontSize: 16, lineHeight: 1.5 }}>
                  A edição diária do IA News chega no seu e-mail antes das 8h, com análise de
                  impacto para quem precisa decidir.
                </p>
              </>
            ) : null}

            {state === "error" ? (
              <>
                {mark(false)}
                <p style={{ color: "var(--p-ink-2)", fontSize: 16, lineHeight: 1.5 }}>
                  Esse link de confirmação expirou ou não existe. Faça a inscrição novamente na
                  home.
                </p>
              </>
            ) : null}

            {state !== "loading" ? (
              <Link to="/" className="btn blue wide">
                Ler as notícias de hoje
              </Link>
            ) : null}
          </section>
        </div>
      </main>
      <SiteFooter />
    </>
  );
}
