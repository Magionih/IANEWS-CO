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

const FACTS = [
  { label: "Data", value: "Quarta, 16 de dezembro" },
  { label: "Horário", value: "Das 14h às 20h" },
  { label: "Cidade", value: "Belo Horizonte · local a confirmar" },
];

const PARA_QUEM = [
  {
    title: "Empresários",
    text: "Que querem colocar IA no atendimento, nas vendas e na operação, e preferem aprender com quem já fez.",
  },
  {
    title: "Fornecedores de IA",
    text: "Que querem conhecer empresários com problemas reais e mostrar o que fazem, com mesa de expositor.",
  },
  {
    title: "Empresas e marcas",
    text: "Que querem estar no palco e na cobertura da IA News, com cotas de patrocínio.",
  },
];

const AGENDA = [
  { time: "14h", title: "Credenciamento e café", text: "Com as mesas dos expositores abertas." },
  {
    time: "14h30",
    title: "Abertura",
    text: "O que os empresários brasileiros estão fazendo com IA, com os dados da IA News.",
  },
  {
    time: "15h",
    title: "Da pauta ao palco",
    text: "Empresários que viraram destaque na IA News contam o que a IA mudou no negócio.",
  },
  { time: "16h", title: "Cases em operação", text: "IA no atendimento, nas vendas e na operação, com números." },
  { time: "17h", title: "Intervalo e rodada de expositores", text: "" },
  { time: "17h30", title: "Mesa IANews ao vivo", text: "Você leva um desafio da sua empresa e sai com um caminho." },
  { time: "18h30", title: "Encerramento", text: "" },
  { time: "18h45", title: "Networking", text: "Até as 20h." },
];

const FAQ = [
  {
    q: "Onde vai ser?",
    a: "Em Belo Horizonte. O local sai na abertura das inscrições, primeiro para quem está na lista.",
  },
  {
    q: "Quanto custa?",
    a: "O valor do ingresso sai na abertura do 1º lote. Quem está na lista recebe o aviso antes e garante a condição do 1º lote.",
  },
  {
    q: "Quero expor ou patrocinar. Como faço?",
    a: "Marque \"Fornecedor de IA\" ou \"Empresa ou marca\" no formulário. A equipe da IA News te procura com as opções de mesa e de cotas.",
  },
  {
    q: "Quem organiza?",
    a: "A FGIA Educação, o palco da IA News, portal e newsletter sobre inteligência artificial no Brasil.",
  },
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
  document.getElementById("lista")?.scrollIntoView({ behavior: "smooth", block: "start" });
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
      if (first) document.getElementById(first === "papel" ? "pc-papel-1" : `pc-${first}`)?.focus();
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
      <main id="main" className="page pt pc">
        {/* 1. Topo */}
        <section className="pt-hero">
          <div className="wrap">
            <p className="kick">Palco IA News · FGIA Educação</p>
            <h1>Quem faz, ensina.</h1>
            <p className="sub">
              No dia 16 de dezembro, em Belo Horizonte, empresários que já colocaram IA para trabalhar sobem ao palco
              para contar como fizeram. Você sai com um plano para a sua empresa.
            </p>
            <ul className="pc-facts">
              {FACTS.map((f) => (
                <li key={f.label}>
                  <small>{f.label}</small>
                  <b>{f.value}</b>
                </li>
              ))}
            </ul>
            <button className="btn blue" type="button" onClick={scrollToForm}>
              Quero meu lugar na lista
            </button>
          </div>
        </section>

        <div className="wrap">
          {/* 2. Para quem é */}
          <section className="pt-sec" aria-labelledby="pc-para">
            <div className="sec-head">
              <h2 id="pc-para">Para quem é</h2>
            </div>
            <div className="pt-cards">
              {PARA_QUEM.map((w) => (
                <div className="pt-card" key={w.title}>
                  <h3>{w.title}</h3>
                  <p>{w.text}</p>
                </div>
              ))}
            </div>
          </section>

          {/* 3. Programação */}
          <section className="pt-sec" aria-labelledby="pc-prog">
            <div className="sec-head">
              <h2 id="pc-prog">Programação</h2>
            </div>
            <ol className="pc-agenda">
              {AGENDA.map((a) => (
                <li key={a.time}>
                  <time>{a.time}</time>
                  <div>
                    <b>{a.title}</b>
                    {a.text ? <span>{a.text}</span> : null}
                  </div>
                </li>
              ))}
            </ol>
            <p className="pc-note">Programação proposta. Os nomes do palco saem em breve, primeiro para quem está na lista.</p>
          </section>

          {/* 4. Como funciona a lista */}
          <section className="pt-sec" aria-labelledby="pc-how">
            <div className="sec-head">
              <h2 id="pc-how">Como funciona a lista antecipada</h2>
            </div>
            <ol className="pt-steps">
              <li>
                <b>Você entra na lista</b>
                <span>Leva um minuto, pelo formulário abaixo. Entrar na lista não custa nada.</span>
              </li>
              <li>
                <b>Recebe o 1º lote antes</b>
                <span>Quando as inscrições abrirem, você recebe o aviso antes de todo mundo, pelo WhatsApp e por e-mail.</span>
              </li>
              <li>
                <b>Dia 16/12, você no Palco</b>
                <span>Uma tarde de cases, Mesa IANews e networking em Belo Horizonte.</span>
              </li>
            </ol>
          </section>

          {/* 5. Formulário */}
          <section className="pt-sec pt-form-sec" id="lista" aria-labelledby="pc-form-t">
            <div className="pt-form-head">
              <p className="kick">Lista antecipada</p>
              <h2 id="pc-form-t">Garanta seu lugar na lista</h2>
              <p>O local, a programação completa e o 1º lote saem primeiro para quem está aqui.</p>
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
                    <legend className="step-l">
                      <i>1</i>Quem é você
                    </legend>
                    <div className="biz-fields">
                      {field("nome", "Nome completo", { autoComplete: "name", maxLength: 160, placeholder: "Seu nome", full: true })}
                      {field("empresa", "Empresa", { autoComplete: "organization", maxLength: 160, placeholder: "Nome da empresa" })}
                      {field("cargo", "Cargo", {
                        autoComplete: "organization-title",
                        maxLength: 120,
                        placeholder: "Sócio, CEO, gerente...",
                        optional: true,
                      })}
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
                    <legend className="step-l">
                      <i>2</i>Você vem como
                    </legend>
                    <div className="picks">
                      {PAPEIS.map((p, i) => (
                        <label className="pick" key={p.value}>
                          <input
                            type="radio"
                            name="papel"
                            id={`pc-papel-${i + 1}`}
                            value={p.value}
                            checked={form.papel === p.value}
                            onChange={() => set("papel", p.value)}
                          />
                          <span>
                            <b>{p.label}</b>
                            <small>{p.hint}</small>
                          </span>
                        </label>
                      ))}
                    </div>
                    {errors.papel ? (
                      <span className="pt-err" id="pc-papel-err">
                        {errors.papel}
                      </span>
                    ) : null}
                  </fieldset>

                  <fieldset>
                    <legend className="step-l">
                      <i>3</i>Sobre a empresa <small>opcional, ajuda a preparar a Mesa IANews</small>
                    </legend>
                    <div className="biz-fields">
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
                  </fieldset>

                  <label className="pt-consent" htmlFor="pc-consentimento">
                    <input
                      id="pc-consentimento"
                      type="checkbox"
                      checked={form.consentimento}
                      onChange={(e) => set("consentimento", e.target.checked)}
                      aria-invalid={errors.consentimento ? true : undefined}
                    />
                    <span>
                      Concordo que a IA News use estes dados para a minha inscrição no Palco IA News e para me mandar
                      mensagens sobre o evento pelo WhatsApp e por e-mail. Nada é compartilhado com terceiros.{" "}
                      <Link to="/termos">Política de privacidade</Link>.
                      {errors.consentimento ? <span className="pt-err">{errors.consentimento}</span> : null}
                    </span>
                  </label>

                  <div className="biz-submit">
                    <button className="btn blue" type="submit" disabled={sending}>
                      {sending ? "Enviando…" : "Entrar na lista"}
                    </button>
                    <span className="fine">Você recebe a confirmação por e-mail.</span>
                    <p className="msg err" role="status" aria-live="polite">
                      {failMsg ?? ""}
                    </p>
                  </div>
                </form>
              )}
            </div>
          </section>

          {/* 6. Perguntas frequentes */}
          <section className="pt-sec" aria-labelledby="pc-faq">
            <div className="sec-head">
              <h2 id="pc-faq">Perguntas frequentes</h2>
            </div>
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
      </main>
      <SiteFooter />
    </>
  );
}
