import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useRef, useState, type FormEvent } from "react";

import { SiteHeader } from "@/components/site/header";
import { SiteFooter } from "@/components/site/footer";
import { CONTACT_EMAIL, maskPhone } from "@/lib/pauta-validate";
import {
  DESAFIO_MAX,
  PAPEIS,
  PORTES,
  SETORES,
  validatePalco,
  type PalcoErrors,
  type PalcoInput,
} from "@/lib/palco-validate";

/* Palco IA News · 16/12 · Belo Horizonte. Lista antecipada: sem preço e sem local até a abertura do 1º lote.
   A inscrição vai para /api/public/palco e cai sozinha no CRM. */

const PAGE_URL = "https://ianewsbr.com/palco";
const TITLE = "Palco IA News · 16 de dezembro em Belo Horizonte | IA News";
const DESCRIPTION =
  "Uma tarde em que só sobe ao palco quem já colocou IA para trabalhar numa empresa. 16/12, em Belo Horizonte. Entre na lista antecipada.";

type PalcoSearch = { utm_source?: string; utm_medium?: string; utm_campaign?: string };

const short = (v: unknown, max: number) => (typeof v === "string" && v.trim() ? v.trim().slice(0, max) : undefined);

export const Route = createFileRoute("/palco")({
  validateSearch: (s: Record<string, unknown>): PalcoSearch => ({
    utm_source: short(s["utm_source"], 80),
    utm_medium: short(s["utm_medium"], 80),
    utm_campaign: short(s["utm_campaign"], 120),
  }),
  head: () => ({
    meta: [
      { title: TITLE },
      { name: "description", content: DESCRIPTION },
      { property: "og:title", content: "Palco IA News · Quem faz, ensina" },
      { property: "og:description", content: DESCRIPTION },
      { property: "og:type", content: "website" },
      { property: "og:url", content: PAGE_URL },
      { name: "twitter:card", content: "summary_large_image" },
    ],
    links: [{ rel: "canonical", href: PAGE_URL }],
  }),
  component: PalcoPage,
});

const IMG = (id: number, w: number) =>
  `https://images.pexels.com/photos/${id}/pexels-photo-${id}.jpeg?auto=compress&cs=tinysrgb&w=${w}`;

const EVENT_START = new Date("2026-12-16T14:00:00-03:00").getTime();

const FACTS = [
  { label: "Quando", value: "16 de dezembro · 14h às 20h" },
  { label: "Onde", value: "Belo Horizonte" },
  { label: "Lugares", value: "Limitados" },
];

const PROVAS = [
  { n: "100 mil+", t: "seguidores da IA News no Instagram" },
  { n: "170+", t: "matérias sobre IA nas empresas" },
  { n: "7h", t: "newsletter diária para quem decide" },
];

const LEVA = [
  {
    t: "Cases com números",
    d: "Empresários que viraram destaque na IA News mostram o que funcionou e o que não funcionou.",
    img: 9275222,
  },
  {
    t: "Mesa IANews ao vivo",
    d: "Você leva um desafio da sua empresa e sai com um caminho para resolver com IA.",
    img: 29335353,
  },
  {
    t: "Networking que vira negócio",
    d: "Empresários, fornecedores de IA e marcas na mesma sala, com mesas de expositores.",
    img: 7648057,
  },
];

const AGENDA = [
  { time: "14h", title: "Credenciamento e café", tag: "Chegada" },
  { time: "14h30", title: "Abertura com dados da IA News", tag: "Palco" },
  { time: "15h", title: "Da pauta ao palco", tag: "Palco" },
  { time: "16h", title: "Cases em operação", tag: "Palco" },
  { time: "17h", title: "Rodada de expositores", tag: "Expositores" },
  { time: "17h30", title: "Mesa IANews ao vivo", tag: "Destaque", hi: true },
  { time: "18h45", title: "Networking até as 20h", tag: "Conexões" },
];

const FAQ = [
  {
    q: "Entrar na lista tem custo?",
    a: "Não. A lista antecipada é gratuita e garante o aviso antes de todo mundo, com a condição do 1º lote.",
  },
  { q: "Onde vai ser?", a: "Em Belo Horizonte. O local sai primeiro para quem está na lista." },
  {
    q: "Quero expor ou patrocinar.",
    a: "Escolha \"Empresa ou marca\" ou \"Fornecedor de IA\" no formulário. A equipe da IA News te procura com as opções.",
  },
  { q: "Quem organiza?", a: "A FGIA Educação, o palco da IA News." },
];

const EMPTY: PalcoInput = {
  nome: "",
  empresa: "",
  cargo: "",
  whatsapp: "",
  email: "",
  papel: "",
  setor: "",
  funcionarios: "",
  desafio: "",
  consentimento: false,
};

const ORDER: (keyof PalcoInput)[] = ["nome", "empresa", "cargo", "whatsapp", "email", "papel", "consentimento"];

function scrollToForm() {
  document.getElementById("lista")?.scrollIntoView({ behavior: "smooth", block: "center" });
  setTimeout(() => document.getElementById("pc-nome")?.focus({ preventScroll: true }), 450);
}

function PalcoPage() {
  const search = Route.useSearch();
  const [form, setForm] = useState<PalcoInput>(EMPTY);
  const [errors, setErrors] = useState<PalcoErrors>({});
  const [failMsg, setFailMsg] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const [done, setDone] = useState<{ name: string; already: boolean } | null>(null);
  const hp = useRef<HTMLInputElement>(null);
  const origem = useRef<string | null>(null);
  const doneRef = useRef<HTMLDivElement>(null);
  const formRef = useRef<HTMLDivElement>(null);
  const [left, setLeft] = useState<{ d: number; h: number; m: number } | null>(null);
  const [showBar, setShowBar] = useState(false);

  useEffect(() => {
    // Contagem regressiva até 16/12, 14h (só no navegador, para não divergir do HTML do servidor).
    const tick = () => {
      const ms = Math.max(0, EVENT_START - Date.now());
      setLeft({ d: Math.floor(ms / 864e5), h: Math.floor((ms % 864e5) / 36e5), m: Math.floor((ms % 36e5) / 6e4) });
    };
    tick();
    const t = window.setInterval(tick, 30000);
    return () => window.clearInterval(t);
  }, []);

  useEffect(() => {
    // Barra fixa "Entrar na lista": aparece depois do topo e some quando o formulário está na tela.
    const el = formRef.current;
    if (!el || typeof IntersectionObserver === "undefined") return;
    let formVisible = true;
    const io = new IntersectionObserver(([e]) => {
      formVisible = e.isIntersecting;
      setShowBar(!formVisible && window.scrollY > 500);
    });
    io.observe(el);
    const onScroll = () => setShowBar(!formVisible && window.scrollY > 500);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      io.disconnect();
      window.removeEventListener("scroll", onScroll);
    };
  }, [done]);

  useEffect(() => {
    // Página de origem: de onde a pessoa veio (outra página do site ou site externo).
    try {
      if (document.referrer) {
        const r = new URL(document.referrer);
        origem.current = r.host === window.location.host ? r.pathname : r.host;
      }
    } catch {
      origem.current = null;
    }
  }, []);

  useEffect(() => {
    if (done) doneRef.current?.scrollIntoView({ block: "center", behavior: "smooth" });
  }, [done]);

  function set<K extends keyof PalcoInput>(key: K, value: PalcoInput[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
    if (errors[key]) setErrors((prev) => ({ ...prev, [key]: undefined }));
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (sending) return;
    setFailMsg(null);
    const { errors: found } = validatePalco(form);
    if (Object.keys(found).length) {
      setErrors(found);
      const first = ORDER.find((k) => found[k]);
      if (first) {
        const sel = document.getElementById("pc-papel-sel");
        const papelEl = sel && sel.offsetParent !== null ? sel : document.getElementById("pc-papel-1");
        (first === "papel" ? papelEl : document.getElementById(`pc-${first}`))?.focus();
      }
      return;
    }
    setSending(true);
    try {
      const res = await fetch("/api/public/palco", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          ...form,
          empresa_site: hp.current?.value ?? "",
          origem_path: origem.current,
          utm_source: search.utm_source ?? null,
          utm_medium: search.utm_medium ?? null,
          utm_campaign: search.utm_campaign ?? null,
        }),
      });
      const json = (await res.json().catch(() => ({}))) as {
        ok?: boolean;
        already?: boolean;
        error?: string;
        errors?: PalcoErrors;
      };
      if (res.ok && json.ok) {
        setDone({ name: form.nome.trim().split(/\s+/)[0] ?? "", already: json.already === true });
        setForm(EMPTY);
        return;
      }
      if (json.errors) setErrors(json.errors);
      setFailMsg(json.error ?? `Não conseguimos guardar sua inscrição agora. Tente de novo ou escreva para ${CONTACT_EMAIL}.`);
    } catch {
      setFailMsg(`Não conseguimos guardar sua inscrição agora. Tente de novo ou escreva para ${CONTACT_EMAIL}.`);
    } finally {
      setSending(false);
    }
  }

  const field = (
    key: "nome" | "empresa" | "cargo" | "whatsapp" | "email",
    label: string,
    props: React.InputHTMLAttributes<HTMLInputElement> & { optional?: boolean; full?: boolean },
  ) => {
    const { optional, full, ...rest } = props;
    const err = errors[key];
    return (
      <label className={"f" + (full ? " full" : "")} htmlFor={`pc-${key}`}>
        <span>
          {label} {optional ? <small className="pt-opt">opcional</small> : null}
        </span>
        <input
          className={"field" + (err ? " pt-bad" : "")}
          id={`pc-${key}`}
          value={form[key]}
          aria-invalid={err ? true : undefined}
          aria-describedby={err ? `pc-${key}-err` : undefined}
          onChange={(e) => set(key, key === "whatsapp" ? maskPhone(e.target.value) : e.target.value)}
          {...rest}
        />
        {err ? (
          <span className="pt-err" id={`pc-${key}-err`}>
            {err}
          </span>
        ) : null}
      </label>
    );
  };

  return (
    <>
      <SiteHeader />
      <main id="main" className="pc2">
        {/* 1. Topo com o formulário à mão */}
        <section className="pc2-hero" style={{ backgroundImage: `url(${IMG(9275222, 1600)})` }}>
          <div className="pc2-shade" aria-hidden="true" />
          <div className="wrap pc2-hero-grid">
            <div className="pc2-hero-copy">
              <p className="pc2-kick">IA News apresenta · FGIA Educação</p>
              <h1>
                Palco IA News
                <span>Quem faz, ensina.</span>
              </h1>
              <p className="pc2-sub">
                Uma tarde em Belo Horizonte com empresários que já colocaram IA para trabalhar. Você sai com um plano
                para a sua empresa.
              </p>
              <ul className="pc2-facts">
                {FACTS.map((f) => (
                  <li key={f.label}>
                    <small>{f.label}</small>
                    <b>{f.value}</b>
                  </li>
                ))}
              </ul>
              {left ? (
                <div className="pc2-count" aria-label="Contagem regressiva para o evento">
                  <span>
                    <b>{left.d}</b>dias
                  </span>
                  <span>
                    <b>{String(left.h).padStart(2, "0")}</b>horas
                  </span>
                  <span>
                    <b>{String(left.m).padStart(2, "0")}</b>min
                  </span>
                </div>
              ) : null}
              <a className="pc2-link" href="#programacao">
                Ver a programação ↓
              </a>
            </div>

            <div className="pc2-form" id="lista" ref={formRef}>
              <div className="pc2-form-head">
                <span className="pc2-badge">Lista antecipada · gratuita</span>
                <h2>Garanta seu lugar</h2>
                <p>Quem está na lista recebe o local e o 1º lote antes de todo mundo.</p>
              </div>
              <div className="biz-card pt-card-form">
              {done ? (
                <div className="biz-done" ref={doneRef} role="status">
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
                  <h2>{done.already ? "Você já está na lista" : "Seu nome está na lista!"}</h2>
                  <p>
                    {done.already
                      ? "Este e-mail já estava inscrito. Quando o 1º lote abrir, você recebe o aviso antes de todo mundo."
                      : `Pronto${done.name ? `, ${done.name}` : ""}. Quando o 1º lote abrir, você recebe o aviso antes de todo mundo, pelo WhatsApp e por e-mail.`}
                  </p>
                  <div className="actions">
                    <Link className="btn blue" to="/noticias" search={{ q: "", cat: "all" }}>
                      Ler a IA News
                    </Link>
                    <a className="btn line" href="https://www.instagram.com/ianews.co/" target="_blank" rel="noopener noreferrer">
                      Instagram @ianews.co
                    </a>
                  </div>
                </div>
              ) : (
                <form className="biz-form" onSubmit={onSubmit} noValidate>
                  <input
                    ref={hp}
                    className="hp"
                    type="text"
                    name="empresa_site"
                    tabIndex={-1}
                    autoComplete="off"
                    aria-hidden="true"
                  />
                  <fieldset>
                    <legend className="pc2-sr">Seus dados</legend>
                    <div className="biz-fields">
                      {field("nome", "Nome completo", { autoComplete: "name", maxLength: 160, placeholder: "Seu nome", full: true })}
                      {field("empresa", "Empresa", { autoComplete: "organization", maxLength: 160, placeholder: "Nome da empresa" })}
                      {field("whatsapp", "WhatsApp", {
                        type: "tel",
                        inputMode: "tel",
                        autoComplete: "tel-national",
                        maxLength: 16,
                        placeholder: "(00) 00000-0000",
                      })}
                      {field("email", "E-mail", {
                        type: "email",
                        inputMode: "email",
                        autoComplete: "email",
                        maxLength: 254,
                        placeholder: "voce@empresa.com.br",
                      })}
                    </div>
                  </fieldset>

                  <fieldset aria-describedby={errors.papel ? "pc-papel-err" : undefined}>
                    <legend className="pc2-legend">Você vem como</legend>
                    <label className="pc2-select-wrap" htmlFor="pc-papel-sel">
                      <span className="pc2-sr">Você vem como</span>
                      <select
                        id="pc-papel-sel"
                        className={"field pc2-select" + (errors.papel ? " pt-bad" : "")}
                        value={form.papel}
                        onChange={(e) => set("papel", e.target.value as PalcoInput["papel"])}
                      >
                        <option value="">Selecione</option>
                        {PAPEIS.map((p) => (
                          <option key={p.value} value={p.value}>
                            {p.label}
                          </option>
                        ))}
                      </select>
                    </label>
                    <div className="pc2-pills">
                      {PAPEIS.map((p, i) => (
                        <label className="pc2-pill" key={p.value} title={p.hint}>
                          <input
                            type="radio"
                            name="papel"
                            id={`pc-papel-${i + 1}`}
                            value={p.value}
                            checked={form.papel === p.value}
                            onChange={() => set("papel", p.value)}
                          />
                          <span>{p.label}</span>
                        </label>
                      ))}
                    </div>
                    {errors.papel ? (
                      <span className="pt-err" id="pc-papel-err">
                        {errors.papel}
                      </span>
                    ) : null}
                  </fieldset>

                  <details className="pc2-more">
                    <summary>Quer levar um desafio para a Mesa IANews? <small>opcional</small></summary>
                    <div className="biz-fields">
                      {field("cargo", "Cargo", {
                        autoComplete: "organization-title",
                        maxLength: 120,
                        placeholder: "Sócio, CEO, gerente...",
                        optional: true,
                      })}
                      <label className="f" htmlFor="pc-setor">
                        <span>Setor</span>
                        <select
                          className="field"
                          id="pc-setor"
                          value={form.setor}
                          onChange={(e) => set("setor", e.target.value)}
                        >
                          <option value="">Escolha</option>
                          {SETORES.map((s) => (
                            <option key={s} value={s}>
                              {s}
                            </option>
                          ))}
                        </select>
                      </label>
                      <label className="f" htmlFor="pc-funcionarios">
                        <span>Pessoas na empresa</span>
                        <select
                          className="field"
                          id="pc-funcionarios"
                          value={form.funcionarios}
                          onChange={(e) => set("funcionarios", e.target.value)}
                        >
                          <option value="">Escolha</option>
                          {PORTES.map((s) => (
                            <option key={s} value={s}>
                              {s}
                            </option>
                          ))}
                        </select>
                      </label>
                      <label className="f full" htmlFor="pc-desafio">
                        <span>O que você quer resolver com IA?</span>
                        <textarea
                          className="field"
                          id="pc-desafio"
                          rows={3}
                          maxLength={DESAFIO_MAX}
                          value={form.desafio}
                          placeholder="Ex.: responder clientes no WhatsApp fora do horário, organizar as vendas, reduzir trabalho manual."
                          onChange={(e) => set("desafio", e.target.value)}
                        />
                      </label>
                    </div>
                  </details>

                  <label className="pt-consent" htmlFor="pc-consentimento">
                    <input
                      id="pc-consentimento"
                      type="checkbox"
                      checked={form.consentimento}
                      onChange={(e) => set("consentimento", e.target.checked)}
                      aria-invalid={errors.consentimento ? true : undefined}
                    />
                    <span>
                      Aceito receber as novidades do Palco IA News por WhatsApp e e-mail. Nada é compartilhado com
                      terceiros.{" "}
                      <Link to="/termos">Política de privacidade</Link>.
                      {errors.consentimento ? <span className="pt-err">{errors.consentimento}</span> : null}
                    </span>
                  </label>

                  <div className="biz-submit">
                    <button className="btn blue pc2-submit" type="submit" disabled={sending}>
                      {sending ? "Enviando…" : "Garantir meu lugar na lista"}
                    </button>
                    <span className="fine">Gratuito. Leva 30 segundos.</span>
                    <p className="msg err" role="status" aria-live="polite">
                      {failMsg ?? ""}
                    </p>
                  </div>
                </form>
              )}
              </div>
            </div>
          </div>
        </section>

        {/* 2. Prova */}
        <section className="pc2-proof" aria-label="A IA News em números">
          <div className="wrap pc2-proof-row">
            {PROVAS.map((p) => (
              <div key={p.t}>
                <b>{p.n}</b>
                <span>{p.t}</span>
              </div>
            ))}
          </div>
        </section>

        <div className="wrap">
          {/* 3. O que você leva */}
          <section className="pc2-sec" aria-labelledby="pc2-leva">
            <p className="pc2-eyebrow">O que você leva</p>
            <h2 id="pc2-leva" className="pc2-h2">
              Uma tarde. Cases reais. Um plano para a sua empresa.
            </h2>
            <div className="pc2-cards">
              {LEVA.map((c) => (
                <article className="pc2-card" key={c.t}>
                  <img src={IMG(c.img, 800)} alt="" loading="lazy" width={800} height={533} />
                  <div>
                    <h3>{c.t}</h3>
                    <p>{c.d}</p>
                  </div>
                </article>
              ))}
            </div>
          </section>

          {/* 4. Programação */}
          <section className="pc2-sec" id="programacao" aria-labelledby="pc2-prog">
            <p className="pc2-eyebrow">Programação · 16/12</p>
            <h2 id="pc2-prog" className="pc2-h2">
              Das 14h às 20h, sem enrolação.
            </h2>
            <ol className="pc2-tl">
              {AGENDA.map((a) => (
                <li key={a.time} className={a.hi ? "hi" : undefined}>
                  <time>{a.time}</time>
                  <span className="pc2-tl-dot" aria-hidden="true" />
                  <div>
                    <small>{a.tag}</small>
                    <b>{a.title}</b>
                  </div>
                </li>
              ))}
            </ol>
            <p className="pc2-note">Os nomes do palco saem em 23/11, primeiro para quem está na lista.</p>
          </section>

          {/* 5. Para quem é */}
          <section className="pc2-sec pc2-who" aria-labelledby="pc2-quem">
            <img src={IMG(3143850, 1000)} alt="" loading="lazy" width={1000} height={1500} />
            <div>
              <p className="pc2-eyebrow">Para quem é</p>
              <h2 id="pc2-quem" className="pc2-h2">
                Para quem decide e quer ver a IA funcionando.
              </h2>
              <ul className="pc2-list">
                <li>
                  <b>Empresários</b> que querem IA no atendimento, nas vendas e na operação.
                </li>
                <li>
                  <b>Fornecedores de IA</b> que querem conhecer quem tem o problema.
                </li>
                <li>
                  <b>Marcas</b> que querem estar no palco e na cobertura da IA News.
                </li>
              </ul>
              <button className="btn blue" type="button" onClick={scrollToForm}>
                Quero meu lugar na lista
              </button>
            </div>
          </section>

          {/* 6. Perguntas frequentes */}
          <section className="pc2-sec" aria-labelledby="pc-faq">
            <p className="pc2-eyebrow">Dúvidas</p>
            <h2 id="pc-faq" className="pc2-h2">
              Perguntas frequentes
            </h2>
            <div className="faq">
              {FAQ.map((f) => (
                <details key={f.q}>
                  <summary>{f.q}</summary>
                  <p>{f.a}</p>
                </details>
              ))}
              <details>
                <summary>Outro assunto?</summary>
                <p>
                  Escreva para <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>.
                </p>
              </details>
            </div>
          </section>
        </div>

        {/* 7. Chamada final */}
        <section className="pc2-final" style={{ backgroundImage: `url(${IMG(20733081, 1600)})` }}>
          <div className="pc2-shade" aria-hidden="true" />
          <div className="wrap pc2-final-in">
            <h2>Os lugares são limitados. A lista é gratuita.</h2>
            <p>16 de dezembro · Belo Horizonte · 14h às 20h</p>
            <button className="btn blue pc2-submit" type="button" onClick={scrollToForm}>
              Garantir meu lugar na lista
            </button>
          </div>
        </section>

        {/* Barra fixa */}
        {!done ? (
          <div className={"pc2-bar" + (showBar ? " on" : "")} aria-hidden={!showBar}>
            <span>
              <b>Palco IA News</b> · 16/12 · BH
            </span>
            <button className="btn blue" type="button" onClick={scrollToForm} tabIndex={showBar ? 0 : -1}>
              Entrar na lista
            </button>
          </div>
        ) : null}
      </main>
      <SiteFooter />
    </>
  );
}
