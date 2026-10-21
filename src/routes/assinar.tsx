import { useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";

import { SiteHeader } from "@/components/site/header";
import { SiteFooter } from "@/components/site/footer";
import { subscribeLead } from "@/lib/newsletter.functions";
import { getLeadContext, trackCta } from "@/lib/cta-tracking";
import { emailSuggestions, formatPhoneBR } from "@/lib/form-format";

const WHATSAPP_URL = "https://chat.whatsapp.com/Is5edILjICj0D2MMHUmGbL";

const PERKS = [
  "Edição diária no e-mail todo dia às 7h",
  "Alertas de mercado em tempo real no WhatsApp",
  "Ranking IA completo, atualizado a cada edição",
  "Análises de impacto para o seu negócio",
];

type Search = { from: string };

export const Route = createFileRoute("/assinar")({
  validateSearch: (search: Partial<Record<string, unknown>>): Search => ({
    from: typeof search.from === "string" ? search.from : "pagina-assinar",
  }),
  head: () => ({
    meta: [
      { title: "Assine a newsletter do IA News — grátis, todo dia às 7h" },
      {
        name: "description",
        content:
          "Receba a edição diária do IA News todo dia às 7h: notícias, análises e o Ranking IA com impacto real para o seu negócio. Grátis.",
      },
      { property: "og:title", content: "Assine a newsletter do IA News" },
      {
        property: "og:description",
        content:
          "Uma edição diária com o que muda na inteligência artificial e o impacto para empresas brasileiras.",
      },
      { property: "og:type", content: "website" },
      { property: "og:url", content: "https://ianewsbr.com/assinar" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
    links: [{ rel: "canonical", href: "https://ianewsbr.com/assinar" }],
  }),
  component: AssinarPage,
});

function EmailField({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const [focused, setFocused] = useState(false);
  const suggestions = focused ? emailSuggestions(value) : [];
  return (
    <div style={{ position: "relative" }}>
      <input
        id="assinar-email"
        className="field"
        type="email"
        inputMode="email"
        required
        maxLength={255}
        autoComplete="email"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onFocus={() => setFocused(true)}
        onBlur={() => window.setTimeout(() => setFocused(false), 120)}
        placeholder="voce@empresa.com"
      />
      {suggestions.length > 0 && (
        <ul
          style={{
            position: "absolute",
            left: 0,
            right: 0,
            top: "100%",
            zIndex: 50,
            marginTop: 4,
            padding: 4,
            listStyle: "none",
            background: "#fff",
            border: "1px solid var(--p-rule)",
            borderRadius: 6,
            boxShadow: "var(--p-shadow)",
            fontSize: 14,
            fontWeight: 400,
          }}
        >
          {suggestions.map((s) => (
            <li key={s}>
              <button
                type="button"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => {
                  onChange(s);
                  setFocused(false);
                }}
                style={{
                  display: "block",
                  width: "100%",
                  textAlign: "left",
                  padding: "8px 10px",
                  border: 0,
                  background: "none",
                  borderRadius: 4,
                  cursor: "pointer",
                  color: "var(--p-ink)",
                }}
              >
                {s}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function AssinarPage() {
  const { from } = Route.useSearch();
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [sending, setSending] = useState(false);
  const [done, setDone] = useState<string | null>(null);
  const [error, setError] = useState("");
  const subscribeFn = useServerFn(subscribeLead);

  return (
    <>
      <SiteHeader />
      <main id="main">
        <div className="wrap">
          <div className="page-head">
            <p className="kick">Assinatura IA News</p>
            <h1>5 minutos por dia. Zero hype.</h1>
            <p className="sub">
              Tudo o que muda na inteligência artificial, com a análise de impacto para quem precisa
              decidir. Grátis, todo dia às 7h.
            </p>
          </div>

          <div className="two-col" style={{ paddingBottom: 64 }}>
            <section style={{ display: "grid", gap: 22, alignContent: "start" }}>
              <h2 className="h-big">O que você recebe</h2>
              <ul className="ticks">
                {PERKS.map((p) => (
                  <li key={p}>{p}</li>
                ))}
              </ul>
              <div className="wa-band">
                <div>
                  <p className="kick">Prefere o WhatsApp?</p>
                  <h3>Entre no grupo gratuito</h3>
                  <p>Os destaques do dia, direto no celular.</p>
                </div>
                <a
                  className="btn line"
                  href={WHATSAPP_URL}
                  target="_blank"
                  rel="noreferrer noopener"
                  onClick={() =>
                    trackCta({ event: "click", placement: "pagina-assinar", variant: "whatsapp" })
                  }
                >
                  Entrar no grupo do WhatsApp
                </a>
              </div>
            </section>

            <section
              className="panel-form"
              style={{ padding: 28, boxShadow: "var(--p-shadow)" }}
              aria-labelledby="assinar-title"
            >
              {done ? (
                <div style={{ display: "grid", gap: 12 }}>
                  <span
                    aria-hidden="true"
                    style={{
                      width: 36,
                      height: 36,
                      borderRadius: "50%",
                      background: "var(--p-good)",
                      display: "grid",
                      placeItems: "center",
                      color: "#fff",
                      fontWeight: 900,
                    }}
                  >
                    ✓
                  </span>
                  <h2 id="assinar-title" style={{ fontSize: 24, fontWeight: 900 }}>
                    Quase lá!
                  </h2>
                  <p className="msg ok" role="status">
                    {done}
                  </p>
                  <Link className="btn blue wide" to="/noticias" search={{ q: "", cat: "all" }}>
                    Ler as notícias de hoje
                  </Link>
                </div>
              ) : (
                <>
                  <div>
                    <h2
                      id="assinar-title"
                      style={{ fontSize: 22, fontWeight: 900, letterSpacing: "-.015em" }}
                    >
                      Criar minha assinatura gratuita
                    </h2>
                    <p className="fine" style={{ marginTop: 6 }}>
                      Cancele quando quiser. Sem spam, sem cobrança.
                    </p>
                  </div>
                  <form
                    noValidate
                    style={{ display: "grid", gap: 14 }}
                    onSubmit={(e) => {
                      e.preventDefault();
                      const value = email.trim();
                      if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(value) || value.length > 255) {
                        setError("Informe um e-mail válido.");
                        return;
                      }
                      setError("");
                      setSending(true);
                      const ctx = getLeadContext();
                      subscribeFn({
                        data: {
                          email: value,
                          full_name: name.trim() || undefined,
                          phone: phone.trim() || undefined,
                          source: from,
                          placement: from,
                          variant: "pagina-assinar",
                          path: ctx.path,
                          utmSource: ctx.utmSource,
                          utmMedium: ctx.utmMedium,
                          utmCampaign: ctx.utmCampaign,
                        },
                      })
                        .then((res) => {
                          trackCta({
                            event: "convert",
                            placement: from,
                            variant: "pagina-assinar",
                            leadEmail: value,
                          });
                          setDone(
                            res.alreadySubscribed
                              ? `${value} já está na lista — a próxima edição chega amanhã cedo.`
                              : `Enviamos um e-mail para ${value}. Confirme para ativar a assinatura.`,
                          );
                        })
                        .catch((err: unknown) =>
                          setError(
                            err instanceof Error
                              ? err.message
                              : "Não foi possível concluir a inscrição.",
                          ),
                        )
                        .finally(() => setSending(false));
                    }}
                  >
                    <label className="f">
                      Nome
                      <input
                        className="field"
                        maxLength={120}
                        autoComplete="name"
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        placeholder="Seu nome"
                      />
                    </label>
                    <label className="f">
                      Telefone (WhatsApp)
                      <input
                        className="field"
                        type="tel"
                        inputMode="numeric"
                        autoComplete="tel"
                        maxLength={16}
                        value={phone}
                        onChange={(e) => setPhone(formatPhoneBR(e.target.value))}
                        placeholder="(11) 99999-0000"
                      />
                    </label>
                    <div
                      className="f"
                      style={{
                        display: "grid",
                        gap: 6,
                        fontSize: 13,
                        fontWeight: 700,
                        color: "var(--p-ink-2)",
                      }}
                    >
                      <label htmlFor="assinar-email">E-mail</label>
                      <EmailField
                        value={email}
                        onChange={(v) => {
                          setEmail(v);
                          setError("");
                        }}
                      />
                    </div>
                    <button className="btn blue wide" type="submit" disabled={sending}>
                      {sending ? "Enviando..." : "Assinar grátis"}
                    </button>
                    <p className={"msg" + (error ? " err" : "")} role="status" aria-live="polite">
                      {error}
                    </p>
                  </form>
                  <p className="fine">
                    Já tem conta? <Link to="/auth">Entrar</Link>
                  </p>
                </>
              )}
            </section>
          </div>
        </div>
      </main>
      <SiteFooter />
    </>
  );
}
