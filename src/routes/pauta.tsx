import { createFileRoute, Link } from "@tanstack/react-router";
import { queryOptions, useSuspenseQuery } from "@tanstack/react-query";
import { useEffect, useRef, useState, type FormEvent } from "react";

import { SiteHeader } from "@/components/site/header";
import { SiteFooter } from "@/components/site/footer";
import { ArticleThumb } from "@/components/portal/article-thumb";
import { CATEGORY_SEO } from "@/lib/categories";
import { listPautaExamples } from "@/lib/pauta.functions";
import {
  CONTACT_EMAIL,
  DESC_MAX,
  DESC_MIN,
  maskPhone,
  validatePauta,
  type PautaErrors,
  type PautaInput,
} from "@/lib/pauta-validate";

/* Envie sua pauta: porta de entrada para empresas e fundadores que usam IA.
   Sem preço: o valor aparece só na conversa comercial. */

const PAGE_URL = "https://ianewsbr.com/pauta";
const TITLE = "Envie sua pauta | IA News";
const DESCRIPTION =
  "Sua empresa usa IA? Conte sua história para a IA News. Envie sua pauta e nossa redação avalia e responde em até 2 dias úteis.";

type PautaSearch = { utm_source?: string; utm_medium?: string; utm_campaign?: string; materia?: string };

const examplesOptions = queryOptions({
  queryKey: ["pauta", "examples"],
  queryFn: () => listPautaExamples(),
  staleTime: 5 * 60 * 1000,
});

const short = (v: unknown, max: number) => (typeof v === "string" && v.trim() ? v.trim().slice(0, max) : undefined);

export const Route = createFileRoute("/pauta")({
  validateSearch: (s: Record<string, unknown>): PautaSearch => ({
    utm_source: short(s["utm_source"], 80),
    utm_medium: short(s["utm_medium"], 80),
    utm_campaign: short(s["utm_campaign"], 120),
    materia: short(s["materia"], 200),
  }),
  loader: ({ context }) => context.queryClient.ensureQueryData(examplesOptions),
  head: () => ({
    meta: [
      { title: TITLE },
      { name: "description", content: DESCRIPTION },
      { property: "og:title", content: "Sua empresa usa IA? Conte sua história para a IA News" },
      { property: "og:description", content: DESCRIPTION },
      { property: "og:type", content: "website" },
      { property: "og:url", content: PAGE_URL },
      { name: "twitter:card", content: "summary_large_image" },
    ],
    links: [{ rel: "canonical", href: PAGE_URL }],
  }),
  component: PautaPage,
});

const WHY = [
  {
    title: "Site e Google",
    text: "Matéria permanente em ianewsbr.com, indexada no Google e com link para a sua empresa.",
  },
  {
    title: "Redes sociais",
    text: "Conteúdo no Instagram, Facebook, LinkedIn e Threads da IA News, em colaboração com o perfil da empresa e do fundador.",
  },
  {
    title: "Newsletter",
    text: "As matérias entram na newsletter diária da IA News, que chega às 7h para quem acompanha IA no Brasil.",
  },
];

const FAQ = [
  {
    q: "Toda pauta enviada é publicada?",
    a: "Não. A redação avalia cada pauta e responde a todas.",
  },
  {
    q: "Que tipo de história vocês publicam?",
    a: "Empresas e pessoas que usam IA de forma concreta: produto, resultado, contratação, investimento, pesquisa.",
  },
  { q: "Quanto tempo demora?", a: "A resposta sai em até 2 dias úteis." },
  {
    q: "Posso enviar material de imprensa?",
    a: "Sim. Coloque o link no campo de notícia ou press release.",
  },
];

const EMPTY: PautaInput = {
  nome: "",
  cargo: "",
  empresa: "",
  site: "",
  instagram: "",
  linkedin: "",
  whatsapp: "",
  email: "",
  descricao: "",
  link_noticia: "",
  consentimento: false,
};

const ORDER: (keyof PautaInput)[] = [
  "nome",
  "cargo",
  "empresa",
  "site",
  "instagram",
  "linkedin",
  "whatsapp",
  "email",
  "descricao",
  "link_noticia",
  "consentimento",
];

function scrollToForm() {
  document.getElementById("enviar")?.scrollIntoView({ behavior: "smooth", block: "start" });
  setTimeout(() => document.getElementById("pt-nome")?.focus({ preventScroll: true }), 450);
}

function PautaPage() {
  const search = Route.useSearch();
  const { data: examples } = useSuspenseQuery(examplesOptions);
  const [form, setForm] = useState<PautaInput>(EMPTY);
  const [errors, setErrors] = useState<PautaErrors>({});
  const [failMsg, setFailMsg] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const [doneName, setDoneName] = useState<string | null>(null);
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
    if (doneName) doneRef.current?.scrollIntoView({ block: "center", behavior: "smooth" });
  }, [doneName]);

  function set<K extends keyof PautaInput>(key: K, value: PautaInput[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
    if (errors[key]) setErrors((prev) => ({ ...prev, [key]: undefined }));
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (sending) return;
    setFailMsg(null);
    const { errors: found } = validatePauta(form);
    if (Object.keys(found).length) {
      setErrors(found);
      const first = ORDER.find((k) => found[k]);
      if (first) document.getElementById(`pt-${first}`)?.focus();
      return;
    }
    setSending(true);
    try {
      const res = await fetch("/api/public/pauta", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          ...form,
          empresa_site: hp.current?.value ?? "",
          origem_path: origem.current,
          article_slug: search.materia ?? null,
          utm_source: search.utm_source ?? null,
          utm_medium: search.utm_medium ?? null,
          utm_campaign: search.utm_campaign ?? null,
        }),
      });
      const json = (await res.json().catch(() => ({}))) as { ok?: boolean; error?: string; errors?: PautaErrors };
      if (res.ok && json.ok) {
        setDoneName(form.nome.trim().split(/\s+/)[0] ?? "");
        setForm(EMPTY);
        return;
      }
      if (json.errors) setErrors(json.errors);
      setFailMsg(json.error ?? `Não conseguimos enviar agora. Tente de novo ou escreva para ${CONTACT_EMAIL}.`);
    } catch {
      setFailMsg(`Não conseguimos enviar agora. Tente de novo ou escreva para ${CONTACT_EMAIL}.`);
    } finally {
      setSending(false);
    }
  }

  const field = (
    key: Exclude<keyof PautaInput, "consentimento" | "descricao">,
    label: string,
    props: React.InputHTMLAttributes<HTMLInputElement> & { optional?: boolean; full?: boolean },
  ) => {
    const { optional, full, ...rest } = props;
    const err = errors[key];
    return (
      <label className={"f" + (full ? " full" : "")} htmlFor={`pt-${key}`}>
        <span>
          {label} {optional ? <small className="pt-opt">opcional</small> : null}
        </span>
        <input
          className={"field" + (err ? " pt-bad" : "")}
          id={`pt-${key}`}
          value={form[key]}
          aria-invalid={err ? true : undefined}
          aria-describedby={err ? `pt-${key}-err` : undefined}
          onChange={(e) => set(key, key === "whatsapp" ? maskPhone(e.target.value) : e.target.value)}
          {...rest}
        />
        {err ? (
          <span className="pt-err" id={`pt-${key}-err`}>
            {err}
          </span>
        ) : null}
      </label>
    );
  };

  const descLen = form.descricao.trim().length;

  return (
    <>
      <SiteHeader />
      <main id="main" className="page pt">
        {/* 1. Topo */}
        <section className="pt-hero">
          <div className="wrap">
            <p className="kick">Envie sua pauta</p>
            <h1>Sua empresa usa IA? Conte sua história para a IA News.</h1>
            <p className="sub">
              A IA News mostra quem está construindo com inteligência artificial no Brasil e no mundo. Envie sua pauta e
              nossa redação avalia.
            </p>
            <button className="btn blue" type="button" onClick={scrollToForm}>
              Enviar minha pauta
            </button>
          </div>
        </section>

        <div className="wrap">
          {/* 2. Por que aparecer */}
          <section className="pt-sec" aria-labelledby="pt-why">
            <div className="sec-head">
              <h2 id="pt-why">Por que aparecer na IA News</h2>
            </div>
            <div className="pt-cards">
              {WHY.map((w) => (
                <div className="pt-card" key={w.title}>
                  <h3>{w.title}</h3>
                  <p>{w.text}</p>
                </div>
              ))}
            </div>
          </section>

          {/* 3. Como funciona */}
          <section className="pt-sec" aria-labelledby="pt-how">
            <div className="sec-head">
              <h2 id="pt-how">Como funciona</h2>
            </div>
            <ol className="pt-steps">
              <li>
                <b>Você envia a pauta</b>
                <span>Pelo formulário desta página, em poucos minutos.</span>
              </li>
              <li>
                <b>A redação avalia</b>
                <span>E entra em contato em até 2 dias úteis, pelo WhatsApp ou por e-mail.</span>
              </li>
              <li>
                <b>A matéria vai ao ar</b>
                <span>No site e nas redes da IA News.</span>
              </li>
            </ol>
          </section>

          {/* 4. Exemplos */}
          {examples.length ? (
            <section className="pt-sec" aria-labelledby="pt-ex">
              <div className="sec-head">
                <h2 id="pt-ex">Histórias que publicamos</h2>
                <Link to="/noticias" search={{ q: "", cat: "all" }} className="more">
                  Ver todas →
                </Link>
              </div>
              <div className="pt-grid">
                {examples.map((a) => (
                  <Link key={a.slug} to="/materia/$slug" params={{ slug: a.slug }} className="pt-ex">
                    <ArticleThumb
                      src={a.cover_image_url}
                      alt=""
                      label={CATEGORY_SEO[a.category]?.label ?? "IA News"}
                      className="r32"
                    />
                    <small>{CATEGORY_SEO[a.category]?.label ?? a.category}</small>
                    <b>{a.title}</b>
                  </Link>
                ))}
              </div>
            </section>
          ) : null}

          {/* 5. Formulário */}
          <section className="pt-sec pt-form-sec" id="enviar" aria-labelledby="pt-form-t">
            <div className="pt-form-head">
              <p className="kick">Formulário</p>
              <h2 id="pt-form-t">Envie sua pauta</h2>
              <p>Conte quem você é e o que sua empresa faz com IA. A redação lê todas as pautas.</p>
            </div>

            <div className="biz-card pt-card-form">
              {doneName !== null ? (
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
                  <h2>Pauta recebida!</h2>
                  <p>
                    Obrigado{doneName ? `, ${doneName}` : ""}. Nossa redação vai avaliar e responder em até 2 dias úteis
                    pelo WhatsApp ou e-mail. Enquanto isso, veja as últimas matérias da IA News.
                  </p>
                  <div className="actions">
                    <Link className="btn blue" to="/noticias" search={{ q: "", cat: "all" }}>
                      Ver matérias
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
                      {field("cargo", "Cargo", { autoComplete: "organization-title", maxLength: 120, placeholder: "CEO, fundador, marketing..." })}
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

                  <fieldset>
                    <legend className="step-l">
                      <i>2</i>Onde encontrar a empresa
                    </legend>
                    <div className="biz-fields">
                      {field("site", "Site da empresa", { inputMode: "url", maxLength: 300, placeholder: "empresa.com.br", optional: true })}
                      {field("instagram", "Instagram", { maxLength: 300, placeholder: "@perfil", optional: true })}
                      {field("linkedin", "LinkedIn", {
                        inputMode: "url",
                        maxLength: 300,
                        placeholder: "linkedin.com/in/... ou /company/...",
                        optional: true,
                        full: true,
                      })}
                    </div>
                  </fieldset>

                  <fieldset>
                    <legend className="step-l">
                      <i>3</i>A história
                    </legend>
                    <div className="biz-fields">
                      <label className="f full" htmlFor="pt-descricao">
                        <span>O que sua empresa faz com IA?</span>
                        <textarea
                          className={"field" + (errors.descricao ? " pt-bad" : "")}
                          id="pt-descricao"
                          rows={5}
                          maxLength={DESC_MAX}
                          value={form.descricao}
                          aria-invalid={errors.descricao ? true : undefined}
                          aria-describedby="pt-descricao-count"
                          placeholder="O produto, o resultado, o problema que a IA resolve, números que você pode mostrar."
                          onChange={(e) => set("descricao", e.target.value)}
                        />
                        <span className="pt-count" id="pt-descricao-count">
                          {errors.descricao ? <span className="pt-err">{errors.descricao}</span> : <span />}
                          <span className={descLen > 0 && descLen < DESC_MIN ? "pt-low" : undefined}>
                            {descLen}/{DESC_MAX}
                          </span>
                        </span>
                      </label>
                      {field("link_noticia", "Link de notícia ou press release", {
                        inputMode: "url",
                        maxLength: 300,
                        placeholder: "https://...",
                        optional: true,
                        full: true,
                      })}
                    </div>
                  </fieldset>

                  <label className="pt-consent" htmlFor="pt-consentimento">
                    <input
                      id="pt-consentimento"
                      type="checkbox"
                      checked={form.consentimento}
                      onChange={(e) => set("consentimento", e.target.checked)}
                      aria-invalid={errors.consentimento ? true : undefined}
                    />
                    <span>
                      Concordo que a IA News use estes dados para avaliar minha pauta e entrar em contato. Nada é
                      compartilhado com terceiros. <Link to="/termos" hash="pauta">Política de privacidade</Link>.
                      {errors.consentimento ? <span className="pt-err">{errors.consentimento}</span> : null}
                    </span>
                  </label>

                  <div className="biz-submit">
                    <button className="btn blue" type="submit" disabled={sending}>
                      {sending ? "Enviando…" : "Enviar pauta"}
                    </button>
                    <span className="fine">A redação responde em até 2 dias úteis.</span>
                    <p className="msg err" role="status" aria-live="polite">
                      {failMsg ?? ""}
                    </p>
                  </div>
                </form>
              )}
            </div>
          </section>

          {/* 6. Perguntas frequentes */}
          <section className="pt-sec" aria-labelledby="pt-faq">
            <div className="sec-head">
              <h2 id="pt-faq">Perguntas frequentes</h2>
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
