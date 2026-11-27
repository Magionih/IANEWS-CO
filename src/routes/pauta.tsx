import { createFileRoute, Link } from "@tanstack/react-router";
import { queryOptions, useSuspenseQuery } from "@tanstack/react-query";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { Globe, Mail, Share2 } from "lucide-react";

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
import { jsonLd } from "@/lib/json-ld";
import { markConverted } from "@/components/site/smart-popup";
import { trackCta } from "@/lib/cta-tracking";

/* Envie sua pauta: porta de entrada para empresas e fundadores que usam IA.
   Sem preço: o valor aparece só na conversa comercial. */

const PAGE_URL = "https://ianewsbr.com/pauta";
const TITLE = "Envie sua pauta: divulgue sua empresa de IA na imprensa | IA News";
const DESCRIPTION =
  "Sua empresa usa inteligência artificial? Envie sua pauta e conte sua história para a redação da IA News. O envio é gratuito e respondemos em até 2 dias úteis.";

type PautaSearch = {
  utm_source?: string;
  utm_medium?: string;
  utm_campaign?: string;
  materia?: string;
};

const examplesOptions = queryOptions({
  queryKey: ["pauta", "examples"],
  queryFn: () => listPautaExamples(),
  staleTime: 5 * 60 * 1000,
});

const short = (v: unknown, max: number) =>
  typeof v === "string" && v.trim() ? v.trim().slice(0, max) : undefined;

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
    scripts: [
      {
        type: "application/ld+json",
        children: jsonLd({
          "@context": "https://schema.org",
          "@type": "FAQPage",
          mainEntity: FAQ.map((f) => ({
            "@type": "Question",
            name: f.q,
            acceptedAnswer: { "@type": "Answer", text: f.a },
          })),
        }),
      },
    ],
  }),
  component: PautaPage,
});

const WHY = [
  {
    icon: Globe,
    title: "Portal e Google",
    text: "Matéria permanente em ianewsbr.com, indexada e com link para a sua empresa.",
  },
  {
    icon: Share2,
    title: "Redes sociais",
    text: "Post em collab com o perfil da empresa e do fundador no Instagram, LinkedIn e Threads.",
  },
  {
    icon: Mail,
    title: "Newsletter das 7h",
    text: "A matéria chega a quem acompanha IA no Brasil todas as manhãs.",
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

const STEP_KEYS: Record<number, (keyof PautaInput)[]> = {
  1: ["empresa", "descricao", "site", "instagram"],
  2: ["nome", "cargo", "whatsapp", "email"],
  3: ["linkedin", "link_noticia", "consentimento"],
};
const STEP_NAMES = ["Sua empresa", "Seus dados", "Enviar"];

function scrollToForm() {
  document.getElementById("enviar")?.scrollIntoView({ behavior: "smooth", block: "start" });
  setTimeout(() => document.getElementById("pt-empresa")?.focus({ preventScroll: true }), 450);
}

function PautaPage() {
  const search = Route.useSearch();
  const { data: examples } = useSuspenseQuery(examplesOptions);
  const [form, setForm] = useState<PautaInput>(EMPTY);
  const [errors, setErrors] = useState<PautaErrors>({});
  const [failMsg, setFailMsg] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const [doneName, setDoneName] = useState<string | null>(null);
  const [step, setStep] = useState(1);
  const hp = useRef<HTMLInputElement>(null);
  const cardRef = useRef<HTMLDivElement>(null);
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

  function goStep(n: number) {
    setStep(n);
    trackCta({ event: "click", placement: "pauta-form", variant: `passo-${n}` });
    window.setTimeout(() => {
      const card = cardRef.current;
      if (card && card.getBoundingClientRect().top < 60)
        card.scrollIntoView({ behavior: "smooth", block: "start" });
      const first = STEP_KEYS[n]?.[0];
      if (first) document.getElementById(`pt-${first}`)?.focus({ preventScroll: true });
    }, 60);
  }

  function next() {
    const { errors: found } = validatePauta(form);
    const keys = STEP_KEYS[step] ?? [];
    const stepErrors: PautaErrors = {};
    for (const k of keys) if (found[k]) stepErrors[k] = found[k];
    if (Object.keys(stepErrors).length) {
      setErrors((prev) => ({ ...prev, ...stepErrors }));
      const first = keys.find((k) => stepErrors[k]);
      if (first) document.getElementById(`pt-${first}`)?.focus();
      return;
    }
    goStep(step + 1);
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (sending) return;
    if (step < 3) return next();
    setFailMsg(null);
    const { errors: found } = validatePauta(form);
    if (Object.keys(found).length) {
      setErrors(found);
      const first = ORDER.find((k) => found[k]);
      if (first) {
        const target = Number(
          Object.keys(STEP_KEYS).find((n) => STEP_KEYS[Number(n)].includes(first)),
        );
        if (target && target !== step) setStep(target);
        window.setTimeout(() => document.getElementById(`pt-${first}`)?.focus(), 60);
      }
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
      const json = (await res.json().catch(() => ({}))) as {
        ok?: boolean;
        error?: string;
        errors?: PautaErrors;
      };
      if (res.ok && json.ok) {
        setDoneName(form.nome.trim().split(/\s+/)[0] ?? "");
        setForm(EMPTY);
        setStep(1);
        markConverted("pauta");
        trackCta({ event: "convert", placement: "pauta-form", variant: "enviada" });
        return;
      }
      if (json.errors) setErrors(json.errors);
      setFailMsg(
        json.error ??
          `Não conseguimos enviar agora. Tente de novo ou escreva para ${CONTACT_EMAIL}.`,
      );
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
          onChange={(e) =>
            set(key, key === "whatsapp" ? maskPhone(e.target.value) : e.target.value)
          }
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
  const faces = examples.slice(0, 5);

  return (
    <>
      <SiteHeader />
      <main id="main" className="page pt pt2">
        <section className="pt2-hero">
          <div className="wrap pt2-grid">
            <div className="pt2-copy">
              <p className="kick">Envie sua pauta · gratuito</p>
              <h1>Sua empresa usa IA? Vire notícia na IA News.</h1>
              <p className="sub">
                A IA News conta quem está construindo com inteligência artificial no Brasil. Conte a
                sua história: a redação lê todas as pautas e responde em até 2 dias úteis.
              </p>
              <ul className="pt2-ben">
                {WHY.map((w) => (
                  <li key={w.title}>
                    <span className="pt2-ic" aria-hidden="true">
                      <w.icon />
                    </span>
                    <span>
                      <b>{w.title}</b>
                      {w.text}
                    </span>
                  </li>
                ))}
              </ul>
              {faces.length ? (
                <div className="pt2-proof">
                  <span className="pt2-faces" aria-hidden="true">
                    {faces.map((a) => (
                      <img key={a.slug} src={a.cover_image_url ?? ""} alt="" loading="lazy" />
                    ))}
                  </span>
                  <span>
                    <b>1 milhão+</b> de visualizações em 30 dias nos canais da IA News
                  </span>
                </div>
              ) : null}
            </div>

            <div className="biz-card pt2-card" id="enviar" ref={cardRef}>
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
                    Obrigado{doneName ? `, ${doneName}` : ""}. Nossa redação vai avaliar e responder
                    em até 2 dias úteis pelo WhatsApp ou e-mail.
                  </p>
                  <div className="actions">
                    <Link className="btn blue" to="/noticias" search={{}}>
                      Ver matérias
                    </Link>
                    <a
                      className="btn line"
                      href="https://www.instagram.com/ianews.co/"
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      Instagram @ianews.co
                    </a>
                  </div>
                </div>
              ) : (
                <form className="biz-form pt2-form" onSubmit={onSubmit} noValidate>
                  <input
                    ref={hp}
                    className="hp"
                    type="text"
                    name="empresa_site"
                    tabIndex={-1}
                    autoComplete="off"
                    aria-hidden="true"
                  />
                  <div className="pt2-steps" aria-label={`Passo ${step} de 3`}>
                    {STEP_NAMES.map((n, i) => (
                      <button
                        key={n}
                        type="button"
                        className={step === i + 1 ? "on" : step > i + 1 ? "done" : undefined}
                        disabled={i + 1 > step}
                        onClick={() => i + 1 < step && goStep(i + 1)}
                      >
                        <i>{step > i + 1 ? "✓" : i + 1}</i>
                        <span>{n}</span>
                      </button>
                    ))}
                  </div>

                  {step === 1 ? (
                    <fieldset>
                      <legend className="step-l">Conte sobre a empresa</legend>
                      <div className="biz-fields">
                        {field("empresa", "Empresa", {
                          autoComplete: "organization",
                          maxLength: 160,
                          placeholder: "Nome da empresa",
                          full: true,
                        })}
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
                            placeholder="O produto, o resultado, o problema que a IA resolve e números que você pode mostrar."
                            onChange={(e) => set("descricao", e.target.value)}
                          />
                          <span className="pt-count" id="pt-descricao-count">
                            {errors.descricao ? (
                              <span className="pt-err">{errors.descricao}</span>
                            ) : (
                              <span className="pt-tip">
                                Ex.: “Nosso agente atende 3 mil clientes por mês”
                              </span>
                            )}
                            <span
                              className={descLen > 0 && descLen < DESC_MIN ? "pt-low" : undefined}
                            >
                              {descLen}/{DESC_MAX}
                            </span>
                          </span>
                        </label>
                        {field("site", "Site", {
                          inputMode: "url",
                          maxLength: 300,
                          placeholder: "empresa.com.br",
                          optional: true,
                        })}
                        {field("instagram", "Instagram", {
                          maxLength: 300,
                          placeholder: "@perfil",
                          optional: true,
                        })}
                      </div>
                    </fieldset>
                  ) : null}

                  {step === 2 ? (
                    <fieldset>
                      <legend className="step-l">Como a redação fala com você</legend>
                      <div className="biz-fields">
                        {field("nome", "Nome completo", {
                          autoComplete: "name",
                          maxLength: 160,
                          placeholder: "Seu nome",
                          full: true,
                        })}
                        {field("cargo", "Cargo", {
                          autoComplete: "organization-title",
                          maxLength: 120,
                          placeholder: "CEO, fundador, marketing...",
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
                          full: true,
                        })}
                      </div>
                    </fieldset>
                  ) : null}

                  {step === 3 ? (
                    <fieldset>
                      <legend className="step-l">
                        Quase lá <small>Os links ajudam a redação, mas são opcionais</small>
                      </legend>
                      <div className="biz-fields">
                        {field("linkedin", "LinkedIn", {
                          inputMode: "url",
                          maxLength: 300,
                          placeholder: "linkedin.com/in/... ou /company/...",
                          optional: true,
                          full: true,
                        })}
                        {field("link_noticia", "Notícia ou press release", {
                          inputMode: "url",
                          maxLength: 300,
                          placeholder: "https://...",
                          optional: true,
                          full: true,
                        })}
                      </div>
                      <label className="pt-consent" htmlFor="pt-consentimento">
                        <input
                          id="pt-consentimento"
                          type="checkbox"
                          checked={form.consentimento}
                          onChange={(e) => set("consentimento", e.target.checked)}
                          aria-invalid={errors.consentimento ? true : undefined}
                        />
                        <span>
                          Concordo que a IA News use estes dados para avaliar minha pauta e entrar
                          em contato. Nada é compartilhado com terceiros.{" "}
                          <Link to="/termos" hash="pauta">
                            Política de privacidade
                          </Link>
                          .
                          {errors.consentimento ? (
                            <span className="pt-err">{errors.consentimento}</span>
                          ) : null}
                        </span>
                      </label>
                    </fieldset>
                  ) : null}

                  <div className="pt2-nav">
                    {step > 1 ? (
                      <button type="button" className="btn line" onClick={() => goStep(step - 1)}>
                        Voltar
                      </button>
                    ) : (
                      <span className="fine">Leva cerca de 3 minutos.</span>
                    )}
                    {step < 3 ? (
                      <button type="button" className="btn blue" onClick={next}>
                        Continuar
                      </button>
                    ) : (
                      <button className="btn blue" type="submit" disabled={sending}>
                        {sending ? "Enviando…" : "Enviar pauta"}
                      </button>
                    )}
                  </div>
                  <p className="msg err" role="status" aria-live="polite">
                    {failMsg ?? ""}
                  </p>
                </form>
              )}
            </div>
          </div>
        </section>

        <div className="wrap">
          <section className="pt-sec" aria-labelledby="pt-how">
            <div className="sec-head">
              <h2 id="pt-how">Como funciona</h2>
            </div>
            <ol className="pt2-how">
              <li>
                <i>1</i>
                <b>Você envia a pauta</b>
                <span>Pelo formulário acima, em cerca de 3 minutos.</span>
              </li>
              <li>
                <i>2</i>
                <b>A redação avalia</b>
                <span>E responde em até 2 dias úteis, pelo WhatsApp ou e-mail.</span>
              </li>
              <li>
                <i>3</i>
                <b>A matéria vai ao ar</b>
                <span>No portal, no Google, nas redes e na newsletter das 7h.</span>
              </li>
            </ol>
          </section>

          {examples.length ? (
            <section className="pt-sec" aria-labelledby="pt-ex">
              <div className="sec-head">
                <h2 id="pt-ex">Histórias que publicamos</h2>
                <Link to="/noticias" search={{}} className="more">
                  Ver todas →
                </Link>
              </div>
              <div className="pt2-ex">
                {examples.map((a) => (
                  <Link
                    key={a.slug}
                    to="/materia/$slug"
                    params={{ slug: a.slug }}
                    className="pt2-ex-it"
                  >
                    <ArticleThumb
                      src={a.cover_image_url}
                      alt=""
                      label={CATEGORY_SEO[a.category]?.label ?? "IA News"}
                      className="r43"
                    />
                    <b>{a.title}</b>
                  </Link>
                ))}
              </div>
              <div className="pt2-again">
                <p>
                  <b>A próxima pode ser a da sua empresa.</b> A redação lê todas as pautas.
                </p>
                <button className="btn blue" type="button" onClick={scrollToForm}>
                  Enviar minha pauta
                </button>
              </div>
            </section>
          ) : null}

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
