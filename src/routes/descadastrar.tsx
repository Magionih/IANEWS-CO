import { useState } from "react";
import { createFileRoute, Link, useSearch } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";

import { SiteHeader } from "@/components/site/header";
import { SiteFooter } from "@/components/site/footer";
import { unsubscribeLead } from "@/lib/newsletter.functions";

export const Route = createFileRoute("/descadastrar")({
  validateSearch: (search: Record<string, unknown>) => ({
    t: typeof search["t"] === "string" ? search["t"] : "",
  }),
  head: () => ({
    meta: [
      { title: "Cancelar inscrição | IA News" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: UnsubscribePage,
});

function UnsubscribePage() {
  const { t } = useSearch({ from: "/descadastrar" });
  const unsubscribe = useServerFn(unsubscribeLead);
  const [state, setState] = useState<"idle" | "loading" | "done" | "error">(t ? "idle" : "error");

  async function onConfirm() {
    setState("loading");
    try {
      const res = await unsubscribe({ data: { token: t } });
      setState(res.ok ? "done" : "error");
    } catch {
      setState("error");
    }
  }

  return (
    <>
      <SiteHeader />
      <main id="main">
        <div className="wrap">
          <div className="page-head">
            <p className="kick">Newsletter IA News</p>
            <h1>{state === "done" ? "Inscrição cancelada" : state === "error" ? "Link inválido" : "Cancelar inscrição"}</h1>
          </div>
          <section
            className="panel-form"
            style={{ maxWidth: 520, margin: "0 auto 64px", padding: 32, textAlign: "center", justifyItems: "center", boxShadow: "var(--p-shadow)" }}
            aria-live="polite"
          >
            {state === "idle" || state === "loading" ? (
              <>
                <p style={{ color: "var(--p-ink-2)", fontSize: 16, lineHeight: 1.5 }}>
                  Você deixará de receber a newsletter diária da IANews neste e-mail.
                </p>
                <button className="btn blue wide" type="button" onClick={onConfirm} disabled={state === "loading"}>
                  {state === "loading" ? "Cancelando..." : "Confirmar cancelamento"}
                </button>
                <Link to="/" style={{ fontSize: 14 }}>
                  Quero continuar recebendo
                </Link>
              </>
            ) : null}
            {state === "done" ? (
              <>
                <p style={{ color: "var(--p-ink-2)", fontSize: 16, lineHeight: 1.5 }}>
                  Pronto. Você não vai mais receber a newsletter. Se mudar de ideia, é só assinar de novo.
                </p>
                <Link to="/newsletter" className="btn blue wide">
                  Assinar novamente
                </Link>
              </>
            ) : null}
            {state === "error" ? (
              <>
                <p style={{ color: "var(--p-ink-2)", fontSize: 16, lineHeight: 1.5 }}>
                  Não encontramos essa inscrição. Se continuar recebendo e-mails, responda a qualquer edição pedindo o cancelamento.
                </p>
                <Link to="/" className="btn blue wide">
                  Ir para a IANews
                </Link>
              </>
            ) : null}
          </section>
        </div>
      </main>
      <SiteFooter />
    </>
  );
}
