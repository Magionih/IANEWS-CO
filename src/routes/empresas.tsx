import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useRef, useState, type FormEvent } from "react";

import { SiteHeader } from "@/components/site/header";
import { SiteFooter } from "@/components/site/footer";
import { useSubscribed } from "@/components/site/portal-subscribe";
import { openSubscribeDialog } from "@/components/site/subscribe-dialog";
import { submitContactMessage } from "@/lib/contact.functions";
import { NewsletterOptIn, wantsNewsletter } from "@/components/site/newsletter-opt-in";

const PAGE_URL = "https://ianewsbr.com/empresas";
const TITLE = "IA para empresas — implementação, conteúdo e treinamento | IA News";
const DESCRIPTION =
  "O ecossistema IA News implementa, produz e treina: sprints de implementação de IA, produção de conteúdo, relatórios executivos, vídeos com avatar e workshops para equipes.";

export const Route = createFileRoute("/empresas")({
  head: () => ({
    meta: [
      { title: TITLE },
      { name: "description", content: DESCRIPTION },
      { property: "og:title", content: "IA na sua operação — IA News para empresas" },
      { property: "og:description", content: DESCRIPTION },
      { property: "og:type", content: "website" },
      { property: "og:url", content: PAGE_URL },
      { name: "twitter:card", content: "summary_large_image" },
    ],
    links: [{ rel: "canonical", href: PAGE_URL }],
  }),
  component: EmpresasPage,
});

const PICKS = [
  {
    value: "IA Implementation Sprint",
    text: "Implementação de IA na operação, em formato de sprint, com começo, meio e entrega.",
  },
  {
    value: "IA Content Factory",
    text: "Produção de conteúdo com IA em escala para marcas que publicam todo dia.",
  },
  {
    value: "IA Executive Reports",
    text: "Relatórios executivos sobre IA para lideranças que precisam decidir com contexto.",
  },
  { value: "Avatria", text: "Vídeos com apresentador digital gerado por IA." },
  {
    value: "Workshops",
    text: "Turmas ao vivo com mentores do ecossistema para equipes e profissionais.",
  },
  { value: "Ainda não sei", text: "Quero conversar e entender por onde começar." },
];

const SIZES = [
  { value: "1 a 10 pessoas", label: "1 a 10" },
  { value: "11 a 50 pessoas", label: "11 a 50" },
  { value: "51 a 200 pessoas", label: "51 a 200" },
  { value: "Mais de 200 pessoas", label: "Mais de 200" },
];

const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;
const EMPTY = { nome: "", cargo: "", email: "", empresa: "", mensagem: "" };

function EmpresasPage() {
  const subscribed = useSubscribed();
  const [picks, setPicks] = useState<string[]>([]);
  const [size, setSize] = useState("");
  const [form, setForm] = useState(EMPTY);
  const [msg, setMsg] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const [doneEmail, setDoneEmail] = useState<string | null>(null);
  const hp = useRef<HTMLInputElement>(null);
  const loadedAt = useRef(0);
  const doneRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    loadedAt.current = Date.now();
  }, []);

  useEffect(() => {
    if (doneEmail) doneRef.current?.scrollIntoView({ block: "center", behavior: "smooth" });
  }, [doneEmail]);

  function set(key: keyof typeof form, value: string) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  function togglePick(value: string, on: boolean) {
    setPicks((prev) => (on ? [...prev, value] : prev.filter((p) => p !== value)));
  }

  function fail(text: string, focusId?: string) {
    setMsg(text);
    if (focusId) document.getElementById(focusId)?.focus();
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    const newsletter = wantsNewsletter(e);
    if (sending) return;
    const email = form.email.trim();
    const empresa = form.empresa.trim();
    if (hp.current?.value) {
      setDoneEmail(email || "seu e-mail");
      return;
    }
    if (!picks.length) return fail("Marque pelo menos uma opção no passo 1.", "bp-1");
    if (form.nome.trim().length < 2) return fail("Informe o seu nome.", "biz-nome");
    if (!EMAIL_RE.test(email))
      return fail("Digite um e-mail válido para o time responder.", "biz-email");
    if (!empresa) return fail("Informe o nome da empresa.", "biz-company");
    if (Date.now() - loadedAt.current < 1500) return;

    setSending(true);
    setMsg(null);
    const ordered = PICKS.map((p) => p.value).filter((v) => picks.includes(v));
    const cargo = form.cargo.trim();
    const texto = form.mensagem.trim();
    const message = [
      "Pedido pela página Para empresas",
      "",
      `Interesse: ${ordered.join(", ")}`,
      `Tamanho do time: ${size || "Não informado"}`,
      `Empresa: ${empresa}`,
      cargo ? `Cargo: ${cargo}` : null,
      "",
      `O que quer resolver: ${texto || "Não informado"}`,
    ]
      .filter((l) => l !== null)
      .join("\n");

    try {
      await submitContactMessage({
        data: {
          newsletter,
          kind: "contato",
          full_name: form.nome,
          email,
          company: empresa,
          subject: `Para empresas: ${ordered.join(", ")}`.slice(0, 200),
          message,
        },
      });
      setPicks([]);
      setSize("");
      setForm(EMPTY);
      setDoneEmail(email);
    } catch (err) {
      fail(
        err instanceof Error && err.message
          ? err.message
          : "Não foi possível enviar agora. Tente de novo.",
      );
    } finally {
      setSending(false);
    }
  }

  return (
    <>
      <SiteHeader />
      <main id="main" className="page">
        <div className="wrap">
          <div className="biz">
            <div className="biz-head">
              <p className="kick">Para empresas</p>
              <h1>IA na sua operação</h1>
              <p className="sub">
                Além de informar, o ecossistema IANews implementa, produz e treina. Conte o que você
                precisa e o time retorna.
              </p>
            </div>

            <div className="biz-card">
              {doneEmail ? (
                <div className="biz-done" ref={doneRef}>
                  <span className="ok-mark" aria-hidden="true">
                    <svg
                      width="20"
                      height="20"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="3"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <path d="m5 12.5 4.5 4.5L19 7.5" />
                    </svg>
                  </span>
                  <h2>Pedido registrado</h2>
                  <p>O time da IANews vai responder em {doneEmail}.</p>
                  <div className="actions">
                    {!subscribed ? (
                      <button
                        className="btn blue"
                        type="button"
                        onClick={() => openSubscribeDialog("empresas-pos-envio")}
                      >
                        Receber também a newsletter diária
                      </button>
                    ) : null}
                    <Link className="btn line" to="/noticias" search={{ q: "", cat: "all" }}>
                      Ler as notícias
                    </Link>
                  </div>
                </div>
              ) : (
                <form className="biz-form" onSubmit={onSubmit} noValidate>
                  <input
                    ref={hp}
                    className="hp"
                    type="text"
                    name="site"
                    tabIndex={-1}
                    autoComplete="off"
                    aria-hidden="true"
                  />
                  <fieldset>
                    <legend className="step-l">
                      <i>Passo 1</i>O que você procura? <small>Marque uma ou mais opções</small>
                    </legend>
                    <div className="picks">
                      {PICKS.map((p, i) => (
                        <label className="pick" key={p.value}>
                          <input
                            type="checkbox"
                            name="interesse"
                            id={`bp-${i + 1}`}
                            value={p.value}
                            checked={picks.includes(p.value)}
                            onChange={(e) => togglePick(p.value, e.target.checked)}
                          />
                          <span>
                            <b>{p.value}</b>
                            <small>{p.text}</small>
                          </span>
                        </label>
                      ))}
                    </div>
                  </fieldset>

                  <fieldset>
                    <legend className="step-l">
                      <i>Passo 2</i>Tamanho do time
                    </legend>
                    <div className="seg">
                      {SIZES.map((s, i) => (
                        <label key={s.value}>
                          <input
                            type="radio"
                            name="tamanho"
                            id={`bs-${i + 1}`}
                            value={s.value}
                            checked={size === s.value}
                            onChange={() => setSize(s.value)}
                          />
                          <span>{s.label}</span>
                        </label>
                      ))}
                    </div>
                  </fieldset>

                  <fieldset>
                    <legend className="step-l">
                      <i>Passo 3</i>Seus dados
                    </legend>
                    <div className="biz-fields">
                      <label className="f">
                        Nome
                        <input
                          className="field"
                          id="biz-nome"
                          type="text"
                          autoComplete="name"
                          placeholder="Seu nome"
                          maxLength={120}
                          value={form.nome}
                          onChange={(e) => set("nome", e.target.value)}
                        />
                      </label>
                      <label className="f">
                        Cargo
                        <input
                          className="field"
                          id="biz-cargo"
                          type="text"
                          autoComplete="organization-title"
                          placeholder="Opcional"
                          maxLength={120}
                          value={form.cargo}
                          onChange={(e) => set("cargo", e.target.value)}
                        />
                      </label>
                      <label className="f">
                        E-mail de trabalho
                        <input
                          className="field"
                          id="biz-email"
                          type="email"
                          inputMode="email"
                          autoComplete="email"
                          placeholder="voce@empresa.com.br"
                          maxLength={254}
                          value={form.email}
                          onChange={(e) => set("email", e.target.value)}
                        />
                      </label>
                      <label className="f">
                        Empresa
                        <input
                          className="field"
                          id="biz-company"
                          type="text"
                          autoComplete="organization"
                          placeholder="Nome da empresa"
                          maxLength={120}
                          value={form.empresa}
                          onChange={(e) => set("empresa", e.target.value)}
                        />
                      </label>
                      <label className="f full">
                        O que você quer resolver?
                        <textarea
                          className="field"
                          id="biz-msg"
                          rows={3}
                          placeholder="Em uma ou duas frases"
                          maxLength={1000}
                          value={form.mensagem}
                          onChange={(e) => set("mensagem", e.target.value)}
                        />
                      </label>
                    </div>
                  </fieldset>

                  <NewsletterOptIn />
                  <div className="biz-submit">
                    <button className="btn blue" type="submit" disabled={sending}>
                      {sending ? "Enviando..." : "Enviar pedido"}
                    </button>
                    <span className="fine">
                      O time responde pelo e-mail informado. Seus dados seguem a{" "}
                      <Link to="/termos">política de privacidade</Link>.
                    </span>
                    <p className="msg err" role="status" aria-live="polite">
                      {msg ?? ""}
                    </p>
                  </div>
                </form>
              )}
            </div>

            <div className="biz-info">
              <ol className="biz-steps">
                <li>
                  <b>Você conta o que precisa</b>
                  <span>Três passos no formulário, sem compromisso.</span>
                </li>
                <li>
                  <b>O time da IANews responde</b>
                  <span>Pelo e-mail de trabalho que você informar.</span>
                </li>
                <li>
                  <b>Vocês combinam o próximo passo</b>
                  <span>
                    Do diagnóstico à entrega, no formato que fizer sentido para a empresa.
                  </span>
                </li>
              </ol>
              {!subscribed ? (
                <p className="fine">
                  Ainda pesquisando?{" "}
                  <button
                    className="more"
                    type="button"
                    onClick={() => openSubscribeDialog("empresas-guia")}
                  >
                    Receba a newsletter diária de IA →
                  </button>
                </p>
              ) : null}
            </div>
          </div>
        </div>
      </main>
      <SiteFooter />
    </>
  );
}
