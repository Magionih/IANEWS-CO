import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { PALCO_PIXEL, pixel } from "@/lib/pixel";

import { SiteHeader } from "@/components/site/header";
import { SiteFooter } from "@/components/site/footer";
import { CONTACT_EMAIL, maskPhone } from "@/lib/pauta-validate";
import {
  DESAFIO_MAX,
  PALCO_PAGAMENTO_URL,
  PAPEIS,
  PORTES,
  SETORES,
  validatePalco,
  type PalcoErrors,
  type PalcoInput,
  type PalcoPapel,
} from "@/lib/palco-validate";

/* Palco IA News Online · 16/12, 19h às 20h30, ao vivo. Ingresso de R$ 97 (o link de pagamento vai por WhatsApp e
   e-mail depois da inscrição). O presencial em Belo Horizonte ficou para fevereiro de 2027.
   Landing no formato de página de evento: topo com o ingresso, prova, para quem é, o que leva, programação
   proporcional aos 90 minutos, oferta com o formulário, presencial, dúvidas e chamada final.
   A inscrição vai para /api/public/palco e cai sozinha no CRM. */

const PAGE_URL = "https://ianewsbr.com/palco";
const TITLE = "Palco IA News Online · 16 de dezembro, ao vivo | IA News";
const DESCRIPTION =
  "Workshop online e ao vivo, em 16/12, às 19h: o Raio-X do que deu certo com IA nas empresas brasileiras em 2026, três cases com números e o Playbook IA 2027. Ingresso de R$ 97.";

type PalcoSearch = { utm_source?: string; utm_medium?: string; utm_campaign?: string; papel?: PalcoPapel };

const short = (v: unknown, max: number) => (typeof v === "string" && v.trim() ? v.trim().slice(0, max) : undefined);

export const Route = createFileRoute("/palco")({
  validateSearch: (s: Record<string, unknown>): PalcoSearch => ({
    utm_source: short(s["utm_source"], 80),
    utm_medium: short(s["utm_medium"], 80),
    utm_campaign: short(s["utm_campaign"], 120),
    papel: PAPEIS.some((p) => p.value === s["papel"]) ? (s["papel"] as PalcoPapel) : undefined,
  }),
  head: () => ({
    meta: [
      { title: TITLE },
      { name: "description", content: DESCRIPTION },
      { property: "og:title", content: "Palco IA News Online · Raio-X 2026 da IA nas empresas" },
      { property: "og:description", content: DESCRIPTION },
      { property: "og:type", content: "website" },
      { property: "og:url", content: PAGE_URL },
      { property: "og:image", content: IMG(20733081, 1200) },
      { name: "twitter:card", content: "summary_large_image" },
    ],
    links: [{ rel: "canonical", href: PAGE_URL }],
  }),
  component: PalcoPage,
});

function IMG(id: number, w: number) {
  return `https://images.pexels.com/photos/${id}/pexels-photo-${id}.jpeg?auto=compress&cs=tinysrgb&w=${w}`;
}

const EVENT_START = new Date("2026-12-16T19:00:00-03:00").getTime();
const PRECO = "R$ 97";

const PROVAS = [
  { n: "108 mil", t: "seguidores da IA News no Instagram" },
  { n: "320+", t: "matérias sobre IA nas empresas desde outubro" },
  { n: "523", t: "empresas de IA mapeadas pela redação" },
];

const PUBLICO = [
  {
    t: "Empresário",
    d: "Quer colocar IA no atendimento, nas vendas ou na operação e precisa saber por onde começar sem desperdiçar dinheiro.",
    sai: "Sai com um roteiro para escolher, contratar e medir o primeiro projeto.",
  },
  {
    t: "Fornecedor de IA",
    d: "Vende agentes, automação ou consultoria e quer entender o que as empresas brasileiras realmente compraram em 2026.",
    sai: "Sai sabendo o que o cliente valoriza e como apresentar resultado.",
  },
  {
    t: "Marca e liderança",
    d: "Precisa decidir orçamento e prioridades de IA para 2027 com base em casos reais, não em promessa.",
    sai: "Sai com o mapa do que deu certo e do que não repetir.",
  },
];

const LEVA = [
  {
    t: "Raio-X IA News 2026",
    d: "O que as empresas brasileiras fizeram com IA este ano, a partir das matérias e da base da IA News: setores, usos e o que virou resultado.",
    img: 9275222,
  },
  {
    t: "Três cases com números",
    d: "Empresas que colocaram IA para trabalhar mostram o problema, o que fizeram, quanto investiram e o resultado.",
    img: 29335353,
  },
  {
    t: "Playbook IA 2027 e gravação",
    d: "Um roteiro para escolher, contratar e medir projetos de IA, e outro para quem vende IA. Gravação disponível por 30 dias.",
    img: 7648057,
  },
];

/* Os 90 minutos, bloco a bloco. `min` define a largura de cada bloco na faixa da programação. */
const AGENDA = [
  { time: "19h00", min: 5, title: "Abertura", d: "Henrique Magioni, fundador da IA News, abre a noite e explica como as perguntas funcionam." },
  { time: "19h05", min: 20, title: "Raio-X IA News 2026", d: "Setores, usos e resultados: o que as empresas brasileiras fizeram com IA este ano." },
  { time: "19h25", min: 25, title: "Três cases: quem faz, ensina", d: "Oito minutos por empresa: problema, solução, investimento, resultado e um erro que não repetiriam." },
  { time: "19h50", min: 15, title: "Playbook IA 2027", d: "Como escolher, contratar e medir um projeto de IA. E como vender IA para empresas." },
  { time: "20h05", min: 10, title: "Anúncio da Lista IA News 100", d: "Os 100 nomes que fazem IA de verdade nos negócios no Brasil, revelados ao vivo.", hi: true },
  { time: "20h15", min: 10, title: "Mesa IA News", d: "Os convidados respondem às perguntas do chat." },
  { time: "20h25", min: 5, title: "Encerramento", d: "Próximos passos, Conselho IA News e o presencial de fevereiro." },
];

const INCLUI = [
  { t: "Workshop ao vivo de 1h30", d: "16/12, das 19h às 20h30, com perguntas no chat" },
  { t: "Gravação por 30 dias", d: "Para rever ou assistir se não puder no horário" },
  { t: "Slides do Raio-X IA News 2026", d: "Os dados apresentados, para usar no seu planejamento" },
  { t: "Playbook IA 2027", d: "Roteiro para quem compra e para quem vende IA" },
  { t: "R$ 97 de crédito no presencial", d: "Vira desconto no Palco IA News em Belo Horizonte, em fevereiro" },
];

const FAQ = [
  {
    q: "Como eu pago?",
    a: "Logo depois da inscrição, você vai direto para a página de pagamento, com Pix, cartão ou boleto. O mesmo link também chega por e-mail. A vaga é confirmada com o pagamento.",
  },
  { q: "Como eu assisto?", a: "É online e ao vivo. O link de acesso chega por WhatsApp e e-mail, na véspera e 2 horas antes do início." },
  { q: "E se eu não puder ver ao vivo?", a: "A gravação fica disponível por 30 dias para quem se inscreveu." },
  {
    q: "E o evento presencial?",
    a: "O Palco IA News presencial acontece em Belo Horizonte, em fevereiro de 2027. Quem participar do online tem prioridade e usa os R$ 97 como desconto no ingresso.",
  },
  {
    q: "Quero patrocinar.",
    a: "Escolha \"Empresa ou marca\" no formulário. A equipe da IA News te procura com as cotas de apoio e de apresentação.",
  },
  { q: "Quem organiza?", a: "A IA News, com a FGIA Educação, a vertical de eventos e aulas da IA News." },
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
  document.getElementById("inscricao")?.scrollIntoView({ behavior: "smooth", block: "start" });
  setTimeout(() => document.getElementById("pc-nome")?.focus({ preventScroll: true }), 500);
}

function Check() {
  return (
    <svg className="plv-check" width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="m5 12.5 4.5 4.5L19 7.5" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function PalcoPage() {
  const search = Route.useSearch();
  const navigate = useNavigate();
  const [form, setForm] = useState<PalcoInput>({ ...EMPTY, papel: search.papel ?? "" });
  const [errors, setErrors] = useState<PalcoErrors>({});
  const [failMsg, setFailMsg] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const [done, setDone] = useState<{ name: string; already: boolean } | null>(null);
  const hp = useRef<HTMLInputElement>(null);
  const origem = useRef<string | null>(null);
  const doneRef = useRef<HTMLDivElement>(null);
  const formRef = useRef<HTMLDivElement>(null);
  const heroRef = useRef<HTMLElement>(null);
  const [left, setLeft] = useState<{ d: number; h: number; m: number } | null>(null);
  const [showBar, setShowBar] = useState(false);

  useEffect(() => {
    // Contagem regressiva até 16/12, 19h (só no navegador, para não divergir do HTML do servidor).
    const tick = () => {
      const ms = Math.max(0, EVENT_START - Date.now());
      setLeft({ d: Math.floor(ms / 864e5), h: Math.floor((ms % 864e5) / 36e5), m: Math.floor((ms % 36e5) / 6e4) });
    };
    tick();
    const t = window.setInterval(tick, 30000);
    return () => window.clearInterval(t);
  }, []);

  useEffect(() => {
    // Barra fixa: aparece depois do topo e some quando o formulário está na tela.
    const form = formRef.current;
    const hero = heroRef.current;
    if (!form || !hero || typeof IntersectionObserver === "undefined") return;
    let formVisible = false;
    let heroVisible = true;
    const update = () => setShowBar(!formVisible && !heroVisible);
    const io = new IntersectionObserver((entries) => {
      for (const e of entries) {
        if (e.target === form) formVisible = e.isIntersecting;
        if (e.target === hero) heroVisible = e.isIntersecting;
      }
      update();
    });
    io.observe(form);
    io.observe(hero);
    return () => io.disconnect();
  }, [done]);

  useEffect(() => {
    pixel("ViewContent", PALCO_PIXEL);
  }, []);

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
    if (!done) return;
    doneRef.current?.scrollIntoView({ block: "center", behavior: "smooth" });
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
      if (first) (first === "papel" ? document.getElementById("pc-papel-1") : document.getElementById(`pc-${first}`))?.focus();
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
        id?: string;
        token?: string;
      };
      if (res.ok && json.ok && json.id && json.token) {
        pixel("Lead", PALCO_PIXEL, `lead-${json.id}`);
        // Vai direto para o checkout da IA News, com o pedido desta inscrição.
        navigate({ to: "/palco/checkout", search: { i: json.id, t: json.token } });
        return;
      }
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

  const total = AGENDA.reduce((s, a) => s + a.min, 0);

  return (
    <>
      <SiteHeader />
      <main id="main" className="plv">
        {/* 1. Topo: o evento e o ingresso */}
        <section className="plv-hero" ref={heroRef}>
          <img className="plv-hero-img" src={IMG(20733081, 1920)} alt="" fetchPriority="high" />
          <div className="plv-hero-shade" aria-hidden="true" />
          <div className="wrap plv-hero-grid">
            <div className="plv-hero-copy">
              <p className="plv-live">
                <span className="plv-live-dot" aria-hidden="true" />
                Online e ao vivo · 16 de dezembro, 19h
              </p>
              <p className="plv-brand">Palco IA News</p>
              <h1>O que deu certo com IA nas empresas brasileiras em 2026</h1>
              <p className="plv-sub">
                Em 1h30, o Raio-X da IA News, três empresas mostrando resultado com números e um plano prático para
                2027.
              </p>
              <div className="plv-cta">
                <button className="btn blue plv-btn" type="button" onClick={scrollToForm}>
                  Garantir minha vaga por {PRECO}
                </button>
                <a className="plv-ghost" href="#programacao">
                  Ver a programação
                </a>
              </div>
              <p className="plv-fine">Gravação por 30 dias. Os {PRECO} viram desconto no presencial de fevereiro.</p>
            </div>

            <aside className="plv-ticket" aria-label="Resumo do ingresso">
              <div className="plv-ticket-top">
                <span>Ingresso único</span>
                <b>{PRECO}</b>
              </div>
              <dl className="plv-ticket-facts">
                <div>
                  <dt>Data</dt>
                  <dd>Quarta, 16/12</dd>
                </div>
                <div>
                  <dt>Horário</dt>
                  <dd>19h às 20h30</dd>
                </div>
                <div>
                  <dt>Formato</dt>
                  <dd>Online, ao vivo</dd>
                </div>
              </dl>
              {left ? (
                <div className="plv-count" aria-label="Contagem regressiva para o evento">
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
              <button className="btn blue plv-btn plv-btn-full" type="button" onClick={scrollToForm}>
                Quero meu ingresso
              </button>
            </aside>
          </div>
        </section>

        {/* 2. Prova */}
        <section className="plv-proof" aria-label="A IA News em números">
          <div className="wrap plv-proof-row">
            <p className="plv-proof-lead">Quem apresenta acompanha o mercado de IA todos os dias.</p>
            {PROVAS.map((p) => (
              <div key={p.t}>
                <b>{p.n}</b>
                <span>{p.t}</span>
              </div>
            ))}
          </div>
        </section>

        <div className="wrap">
          {/* 3. O problema */}
          <section className="plv-sec plv-why" aria-labelledby="plv-why">
            <h2 id="plv-why" className="plv-h2">
              Em 2026 todo mundo falou de IA. Pouca gente mostrou resultado.
            </h2>
            <div className="plv-why-txt">
              <p>
                A IA News publicou mais de 320 matérias sobre IA nas empresas desde outubro e mapeou 523 empresas do setor.
                Neste workshop, a redação abre o que viu: onde a IA virou receita, onde virou custo e o que muda em 2027.
              </p>
              <p>Sem palestra motivacional. Só dado, caso real e um plano que você aplica na segunda-feira.</p>
            </div>
          </section>

          {/* 4. Para quem é */}
          <section className="plv-sec" aria-labelledby="plv-quem">
            <h2 id="plv-quem" className="plv-h2">
              Para quem é
            </h2>
            <div className="plv-who">
              {PUBLICO.map((p) => (
                <article key={p.t} className="plv-who-card">
                  <h3>{p.t}</h3>
                  <p>{p.d}</p>
                  <p className="plv-who-sai">{p.sai}</p>
                </article>
              ))}
            </div>
          </section>

          {/* 5. O que você leva */}
          <section className="plv-sec" aria-labelledby="plv-leva">
            <h2 id="plv-leva" className="plv-h2">
              O que você leva
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

          {/* 6. Programação: a faixa mostra o peso de cada bloco nos 90 minutos */}
          <section className="plv-sec" id="programacao" aria-labelledby="plv-prog">
            <h2 id="plv-prog" className="plv-h2">
              Programação de 16/12
            </h2>
            <p className="plv-lead">90 minutos, das 19h às 20h30. Cada bloco tem hora para começar e para acabar.</p>
            <div className="plv-strip" aria-hidden="true">
              {AGENDA.map((a) => (
                <span key={a.time} className={a.hi ? "hi" : undefined} style={{ flexGrow: a.min, flexBasis: 0 }}>
                  <i>{a.min}′</i>
                </span>
              ))}
            </div>
            <ol className="plv-agenda">
              {AGENDA.map((a) => (
                <li key={a.time} className={a.hi ? "hi" : undefined}>
                  <time>{a.time}</time>
                  <div>
                    <h3>
                      {a.title} <small>{a.min} min</small>
                    </h3>
                    <p>{a.d}</p>
                  </div>
                </li>
              ))}
            </ol>
            <p className="plv-note">
              Total de {total} minutos. Os convidados dos cases são anunciados em 30/11, primeiro para quem está inscrito.
            </p>
          </section>
        </div>

        {/* 7. Lista 100: o momento que só acontece ao vivo */}
        <section className="plv-band">
          <div className="wrap plv-band-in">
            <div>
              <h2>A Lista IA News 100 é revelada ao vivo, às 20h05.</h2>
              <p>
                Os 100 nomes que estão fazendo IA de verdade nos negócios no Brasil. Ninguém paga para entrar, e o anúncio
                acontece primeiro para quem está no Palco.
              </p>
            </div>
            <Link className="btn line plv-band-btn" to="/lista100">
              Conhecer a Lista 100
            </Link>
          </div>
        </section>

        {/* 8. Oferta e inscrição */}
        <section className="plv-offer" id="inscricao" aria-labelledby="plv-ofe">
          <div className="wrap plv-offer-grid">
            <div className="plv-offer-copy">
              <h2 id="plv-ofe" className="plv-h2">
                Seu ingresso para o Palco IA News Online
              </h2>
              <ul className="plv-inclui">
                {INCLUI.map((i) => (
                  <li key={i.t}>
                    <Check />
                    <div>
                      <b>{i.t}</b>
                      <span>{i.d}</span>
                    </div>
                  </li>
                ))}
              </ul>
              <div className="plv-price">
                <span>Tudo isso por</span>
                <b>{PRECO}</b>
                <small>pagamento único, por Pix, cartão ou boleto</small>
              </div>
            </div>

            <div className="plv-form" id="lista" ref={formRef}>
              <div className="biz-card pt-card-form">
                {done ? (
                  <div className="biz-done" ref={doneRef} role="status">
                    <span className="ok-mark" aria-hidden="true">
                      <Check />
                    </span>
                    <h2>{done.already ? "Você já está inscrito" : "Inscrição recebida"}</h2>
                    <p>
                      {done.already
                        ? "Este e-mail já estava inscrito. Se ainda não pagou, conclua o pagamento para confirmar a vaga."
                        : `Pronto${done.name ? `, ${done.name}` : ""}. Falta só o pagamento para confirmar sua vaga. Estamos te levando para a página de pagamento, com Pix, cartão ou boleto.`}
                    </p>
                    <div className="actions">
                      <a className="btn blue plv-btn plv-btn-full" href={PALCO_PAGAMENTO_URL}>
                        Pagar {PRECO} e confirmar a vaga
                      </a>
                    </div>
                    <p className="fine">O link de pagamento também foi para o seu e-mail.</p>
                  </div>
                ) : (
                  <form className="biz-form" onSubmit={onSubmit} noValidate>
                    <div className="plv-form-head">
                      <h3>Garanta sua vaga</h3>
                      <p>Preencha em 30 segundos e siga para o pagamento.</p>
                    </div>
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
                        {field("empresa", "Empresa", { autoComplete: "organization", maxLength: 160, placeholder: "Nome da empresa", full: true })}
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
                      <summary>
                        Quer levar uma pergunta para a Mesa IA News? <small>opcional</small>
                      </summary>
                      <div className="biz-fields">
                        {field("cargo", "Cargo", {
                          autoComplete: "organization-title",
                          maxLength: 120,
                          placeholder: "Sócio, CEO, gerente...",
                          optional: true,
                        })}
                        <label className="f" htmlFor="pc-setor">
                          <span>Setor</span>
                          <select className="field" id="pc-setor" value={form.setor} onChange={(e) => set("setor", e.target.value)}>
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
                          <span>Sua pergunta ou desafio com IA</span>
                          <textarea
                            className="field"
                            id="pc-desafio"
                            rows={3}
                            maxLength={DESAFIO_MAX}
                            value={form.desafio}
                            placeholder="Ex.: como medir se um agente de atendimento está dando retorno?"
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
                        Aceito receber as informações do Palco IA News por WhatsApp e e-mail. Nada é compartilhado com
                        terceiros. <Link to="/termos">Política de privacidade</Link>.
                        {errors.consentimento ? <span className="pt-err">{errors.consentimento}</span> : null}
                      </span>
                    </label>

                    <div className="biz-submit">
                      <button className="btn blue pc2-submit" type="submit" disabled={sending}>
                        {sending ? "Enviando…" : `Garantir minha vaga por ${PRECO}`}
                      </button>
                      <span className="fine">Em seguida, você paga por Pix, cartão ou boleto.</span>
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

        {/* 9. Presencial de fevereiro */}
        <section className="wrap plv-sec">
          <div className="plv-next">
            <img src={IMG(3143850, 1200)} alt="Palco iluminado diante de uma plateia" loading="lazy" width={1200} height={800} />
            <div>
              <h2>Em fevereiro, o Palco sobe em Belo Horizonte.</h2>
              <p>
                O primeiro Palco IA News presencial acontece em fevereiro de 2027, com cases, expositores e networking. Quem
                participar do online tem prioridade na compra e usa os {PRECO} como desconto.
              </p>
            </div>
          </div>
        </section>

        <div className="wrap">
          {/* 10. Quem organiza */}
          <section className="plv-sec plv-org" aria-labelledby="plv-org">
            <h2 id="plv-org" className="plv-h2">
              Quem organiza
            </h2>
            <div className="plv-org-grid">
              <div>
                <h3>IA News</h3>
                <p>Portal, newsletter e Instagram sobre IA para quem decide. A corrida da IA, explicada para quem decide.</p>
              </div>
              <div>
                <h3>FGIA Educação</h3>
                <p>A vertical de eventos e aulas da IA News, onde só ensina quem já colocou IA para trabalhar.</p>
              </div>
              <div>
                <h3>Henrique Magioni</h3>
                <p>Fundador da IA News e anfitrião do Palco. Conduz o Raio-X e a Mesa IA News.</p>
              </div>
            </div>
          </section>

          {/* 11. Dúvidas */}
          <section className="plv-sec" aria-labelledby="pc-faq">
            <h2 id="pc-faq" className="plv-h2">
              Dúvidas frequentes
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

        {/* 12. Chamada final */}
        <section className="pc2-final" style={{ backgroundImage: `url(${IMG(2833037, 1600)})` }}>
          <div className="pc2-shade" aria-hidden="true" />
          <div className="wrap pc2-final-in">
            <h2>16 de dezembro, 19h. Ao vivo, de onde você estiver.</h2>
            <p>1h30 de dados, cases e plano para 2027 por {PRECO}, com gravação por 30 dias.</p>
            <button className="btn blue plv-btn" type="button" onClick={scrollToForm}>
              Garantir minha vaga
            </button>
          </div>
        </section>

        {/* Barra fixa */}
        {!done ? (
          <div className={"plv-bar" + (showBar ? " on" : "")} aria-hidden={!showBar}>
            <span className="plv-bar-txt">
              <b>Palco IA News Online</b>
              <small>16/12, 19h · {PRECO}</small>
            </span>
            <button className="btn blue" type="button" onClick={scrollToForm} tabIndex={showBar ? 0 : -1}>
              Garantir vaga
            </button>
          </div>
        ) : null}
      </main>
      <SiteFooter />
    </>
  );
}
