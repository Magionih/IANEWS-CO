import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef, useState, type FormEvent } from "react";

import logoWhite from "@/assets/ianews-logo-white.png";
import { subscribeLead } from "@/lib/newsletter.functions";
import {
  INTERESSES,
  maskPhone,
  validateLista,
  type ListaErrors,
  type ListaInput,
} from "@/lib/lista-espera-validate";

/* Lista de espera da FGIA Educação, o palco da IA News (link da bio do @fgiaeducacao).
   Por enquanto só a data do primeiro encontro aparece: formato, local e convidados saem primeiro para a lista.
   Cada inscrição vai para evento_lista_espera e, de lá, para o CRM (funil Evento IANews, etapa "Na lista"). */

const PAGE_URL = "https://ianewsbr.com/eventos";
const TITLE = "FGIA Educação · Lista de espera | IA News";
const DESCRIPTION =
  "Eventos, palestras e mesas com empresários que já colocaram IA para trabalhar. Entre na lista de espera da FGIA Educação, o palco da IA News.";
const INSTAGRAM_URL = "https://www.instagram.com/fgiaeducacao/";
const FONTS =
  "https://fonts.googleapis.com/css2?family=DM+Sans:opsz,wght@9..40,400;9..40,500;9..40,600;9..40,700&family=Instrument+Serif:ital@0;1&family=Syne:wght@700;800&display=swap";

type EventosSearch = { utm_source?: string; utm_medium?: string; utm_campaign?: string; i?: string };

const short = (v: unknown, max: number) => (typeof v === "string" && v.trim() ? v.trim().slice(0, max) : undefined);

export const Route = createFileRoute("/eventos")({
  validateSearch: (s: Record<string, unknown>): EventosSearch => ({
    utm_source: short(s["utm_source"], 80),
    utm_medium: short(s["utm_medium"], 80),
    utm_campaign: short(s["utm_campaign"], 120),
    i: short(s["i"], 40),
  }),
  head: () => ({
    meta: [
      { title: TITLE },
      { name: "description", content: DESCRIPTION },
      { property: "og:title", content: "FGIA Educação · Quem faz, ensina." },
      { property: "og:description", content: DESCRIPTION },
      { property: "og:type", content: "website" },
      { property: "og:url", content: PAGE_URL },
      { name: "theme-color", content: "#070B16" },
    ],
    links: [
      { rel: "canonical", href: PAGE_URL },
      { rel: "stylesheet", href: FONTS },
    ],
  }),
  component: EventosPage,
});

const FORMATOS = [
  {
    n: "01",
    t: "Mesa IANews",
    d: "Conversa online, todo mês, com um empresário que implementou IA e um fundador que constrói com IA.",
  },
  {
    n: "02",
    t: "Palestras In Company",
    d: "Quem já fez a implementação fala para o seu time, no formato que ele precisa.",
  },
  {
    n: "03",
    t: "Evento IA News",
    d: "O encontro com os empresários que viraram pauta na IA News.",
  },
];

const EMPTY: ListaInput = {
  nome: "",
  email: "",
  whatsapp: "",
  empresa: "",
  cargo: "",
  instagram: "",
  interesses: [],
  newsletter: false,
  consentimento: false,
};

const ORDER: (keyof ListaInput)[] = ["nome", "email", "whatsapp", "empresa", "cargo", "instagram", "interesses", "consentimento"];
const FAIL = "Não conseguimos registrar agora. Tente de novo em instantes ou chame a gente no direct do @fgiaeducacao.";

function scrollToForm() {
  document.getElementById("lista")?.scrollIntoView({ behavior: "smooth", block: "start" });
  setTimeout(() => document.getElementById("fg-nome")?.focus({ preventScroll: true }), 450);
}

function EventosPage() {
  const search = Route.useSearch();
  const preset = INTERESSES.some((x) => x.id === search.i) ? [search.i as string] : [];
  const [form, setForm] = useState<ListaInput>({ ...EMPTY, interesses: preset });
  const [errors, setErrors] = useState<ListaErrors>({});
  const [failMsg, setFailMsg] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const [doneName, setDoneName] = useState<string | null>(null);
  const hp = useRef<HTMLInputElement>(null);
  const origem = useRef<string | null>(null);
  const doneRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
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
    if (doneName !== null) doneRef.current?.scrollIntoView({ block: "center", behavior: "smooth" });
  }, [doneName]);

  function set<K extends keyof ListaInput>(key: K, value: ListaInput[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
    if (errors[key]) setErrors((prev) => ({ ...prev, [key]: undefined }));
  }

  function toggle(id: string) {
    set("interesses", form.interesses.includes(id) ? form.interesses.filter((x) => x !== id) : [...form.interesses, id]);
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (sending) return;
    setFailMsg(null);
    const { errors: found, clean } = validateLista(form);
    if (Object.keys(found).length) {
      setErrors(found);
      const first = ORDER.find((k) => found[k]);
      if (first) document.getElementById(`fg-${first}`)?.focus();
      return;
    }
    setSending(true);
    try {
      const res = await fetch("/api/public/lista-espera", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          ...form,
          site_empresa: hp.current?.value ?? "",
          origem_path: origem.current,
          utm_source: search.utm_source ?? null,
          utm_medium: search.utm_medium ?? null,
          utm_campaign: search.utm_campaign ?? null,
        }),
      });
      const json = (await res.json().catch(() => ({}))) as { ok?: boolean; error?: string; errors?: ListaErrors };
      if (res.ok && json.ok) {
        if (clean.newsletter) {
          try {
            await subscribeLead({
              data: {
                email: clean.email,
                full_name: clean.nome,
                phone: clean.whatsapp,
                source: "fgia-lista",
                placement: "eventos",
                variant: "lista-espera",
                path: "/eventos",
                utmSource: search.utm_source ?? null,
                utmMedium: search.utm_medium ?? null,
                utmCampaign: search.utm_campaign ?? null,
              },
            });
          } catch {
            /* a lista de espera já foi gravada; a newsletter pode ser assinada depois */
          }
        }
        setDoneName(clean.nome.split(/\s+/)[0] ?? "");
        setForm(EMPTY);
        return;
      }
      if (json.errors) setErrors(json.errors);
      setFailMsg(json.error ?? FAIL);
    } catch {
      setFailMsg(FAIL);
    } finally {
      setSending(false);
    }
  }

  const field = (
    key: "nome" | "email" | "whatsapp" | "empresa" | "cargo" | "instagram",
    label: string,
    props: React.InputHTMLAttributes<HTMLInputElement> & { optional?: boolean },
  ) => {
    const { optional, ...rest } = props;
    const err = errors[key];
    return (
      <label className="fg-f" htmlFor={`fg-${key}`}>
        <span className="fg-l">
          {label} {optional ? <small>opcional</small> : null}
        </span>
        <input
          className={"fg-in" + (err ? " fg-bad" : "")}
          id={`fg-${key}`}
          value={form[key]}
          aria-invalid={err ? true : undefined}
          aria-describedby={err ? `fg-${key}-err` : undefined}
          onChange={(e) => set(key, key === "whatsapp" ? maskPhone(e.target.value) : e.target.value)}
          {...rest}
        />
        {err ? (
          <span className="fg-err" id={`fg-${key}-err`}>
            {err}
          </span>
        ) : null}
      </label>
    );
  };

  return (
    <main id="main" className="fg">
      <header className="fg-top">
        <a className="fg-mark" href="#topo" aria-label="FGIA Educação">
          <b>FGIA</b>
          <i aria-hidden="true" />
          <span>EDUCAÇÃO</span>
        </a>
        <a className="fg-ianews" href="https://ianewsbr.com/">
          <span>uma marca</span>
          <img src={logoWhite} alt="IA News" width={795} height={160} />
        </a>
      </header>

      <section className="fg-hero" id="topo">
        <div className="fg-wrap">
          <p className="fg-eb">Lista de espera</p>
          <h1>
            Quem faz, <em>ensina.</em>
          </h1>
          <p className="fg-lead">
            A FGIA Educação é o palco da IA News: eventos, palestras e mesas com empresários que já colocaram IA para
            trabalhar dentro de uma empresa.
          </p>
          <div className="fg-date">
            <span className="fg-date-n">17.12</span>
            <span className="fg-date-t">Primeiro encontro. Os detalhes chegam antes para quem está na lista.</span>
          </div>
          <button type="button" className="fg-btn" onClick={scrollToForm}>
            Entrar na lista de espera
          </button>
        </div>
      </section>

      <section className="fg-formats">
        <div className="fg-wrap">
          <p className="fg-eb">Três formatos, um critério</p>
          <h2>
            No palco, só quem <em>já fez.</em>
          </h2>
          <ol className="fg-cards">
            {FORMATOS.map((f) => (
              <li key={f.n}>
                <span className="fg-n">{f.n}</span>
                <div>
                  <h3>{f.t}</h3>
                  <p>{f.d}</p>
                </div>
              </li>
            ))}
          </ol>
        </div>
      </section>

      <section className="fg-form-sec" id="lista">
        <div className="fg-wrap fg-narrow">
          {doneName !== null ? (
            <div className="fg-done" ref={doneRef} role="status">
              <p className="fg-eb">Lista de espera</p>
              <h2>
                Pronto{doneName ? `, ${doneName}` : ""}. <em>Você está na lista.</em>
              </h2>
              <p>Os detalhes do dia 17 de dezembro chegam primeiro para você, por e-mail e WhatsApp.</p>
              <a className="fg-btn" href={INSTAGRAM_URL} target="_blank" rel="noopener noreferrer">
                Seguir @fgiaeducacao
              </a>
            </div>
          ) : (
            <form className="fg-form" onSubmit={onSubmit} noValidate>
              <p className="fg-eb">Entre na lista</p>
              <h2>
                Seja avisado <em>antes de todo mundo.</em>
              </h2>
              <div className="fg-grid">
                {field("nome", "Nome completo", { autoComplete: "name", maxLength: 160 })}
                {field("email", "E-mail", { type: "email", autoComplete: "email", inputMode: "email", maxLength: 254 })}
                {field("whatsapp", "WhatsApp com DDD", { type: "tel", autoComplete: "tel-national", inputMode: "tel", placeholder: "(11) 91234-5678" })}
                {field("empresa", "Empresa", { autoComplete: "organization", maxLength: 160 })}
                {field("cargo", "Cargo", { autoComplete: "organization-title", maxLength: 120 })}
                {field("instagram", "Instagram", { optional: true, placeholder: "@seuperfil", maxLength: 120 })}
              </div>

              <fieldset className="fg-chips" aria-describedby={errors.interesses ? "fg-interesses-err" : undefined}>
                <legend className="fg-l">O que te interessa?</legend>
                <div className="fg-chip-row" id="fg-interesses" tabIndex={-1}>
                  {INTERESSES.map((it) => {
                    const on = form.interesses.includes(it.id);
                    return (
                      <button
                        type="button"
                        key={it.id}
                        className={"fg-chip" + (on ? " on" : "")}
                        aria-pressed={on}
                        onClick={() => toggle(it.id)}
                      >
                        {it.label}
                      </button>
                    );
                  })}
                </div>
                {errors.interesses ? (
                  <span className="fg-err" id="fg-interesses-err">
                    {errors.interesses}
                  </span>
                ) : null}
              </fieldset>

              <label className="fg-check">
                <input type="checkbox" checked={form.newsletter} onChange={(e) => set("newsletter", e.target.checked)} />
                <span>Quero receber também a newsletter diária da IA News, às 7h.</span>
              </label>
              <label className="fg-check">
                <input
                  id="fg-consentimento"
                  type="checkbox"
                  checked={form.consentimento}
                  aria-invalid={errors.consentimento ? true : undefined}
                  aria-describedby={errors.consentimento ? "fg-consentimento-err" : undefined}
                  onChange={(e) => set("consentimento", e.target.checked)}
                />
                <span>Autorizo a IA News a me avisar sobre os eventos da FGIA Educação por e-mail e WhatsApp.</span>
              </label>
              {errors.consentimento ? (
                <span className="fg-err" id="fg-consentimento-err">
                  {errors.consentimento}
                </span>
              ) : null}

              <input
                ref={hp}
                type="text"
                name="site_empresa"
                tabIndex={-1}
                autoComplete="off"
                className="fg-hp"
                aria-hidden="true"
              />

              {failMsg ? (
                <p className="fg-fail" role="alert">
                  {failMsg}
                </p>
              ) : null}

              <button type="submit" className="fg-btn fg-submit" disabled={sending}>
                {sending ? "Enviando…" : "Entrar na lista de espera"}
              </button>
              <p className="fg-note">
                Seus dados ficam só com a IA News. Para sair da lista, responda o e-mail de confirmação.
              </p>
            </form>
          )}
        </div>
      </section>

      <footer className="fg-foot">
        <div className="fg-wrap">
          <span className="fg-mark fg-mark-sm" aria-hidden="true">
            <b>FGIA</b>
            <i />
            <span>EDUCAÇÃO</span>
          </span>
          <p>
            Uma marca <a href="https://ianewsbr.com/">IA News</a> ·{" "}
            <a href={INSTAGRAM_URL} target="_blank" rel="noopener noreferrer">
              @fgiaeducacao
            </a>
          </p>
        </div>
      </footer>
    </main>
  );
}
