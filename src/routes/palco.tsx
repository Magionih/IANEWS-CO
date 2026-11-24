import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { PALCO_PIXEL, metaCtx, pixel } from "@/lib/pixel";

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
  "Workshop online e ao vivo, em 16/12, às 19h (Brasília): o Raio-X do que deu certo com IA nas empresas brasileiras em 2026, o Playbook IA 2027 e a revelação da Lista IA News 100. Ingresso de R$ 97, com gravação e garantia de 7 dias.";

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
    scripts: [
      {
        type: "application/ld+json",
        children: JSON.stringify({
          "@context": "https://schema.org",
          "@type": "Event",
          name: "Palco IA News Online: Raio-X 2026 da IA nas empresas brasileiras",
          description: DESCRIPTION,
          startDate: "2026-12-16T19:00:00-03:00",
          endDate: "2026-12-16T20:30:00-03:00",
          eventStatus: "https://schema.org/EventScheduled",
          eventAttendanceMode: "https://schema.org/OnlineEventAttendanceMode",
          inLanguage: "pt-BR",
          location: { "@type": "VirtualLocation", url: PAGE_URL },
          image: [IMG(20733081, 1200)],
          organizer: { "@type": "Organization", name: "IA News", url: "https://ianewsbr.com" },
          performer: { "@type": "Person", name: "Henrique Magioni" },
          offers: {
            "@type": "Offer",
            url: PAGE_URL,
            price: "97",
            priceCurrency: "BRL",
            availability: "https://schema.org/InStock",
            validFrom: "2026-11-10T00:00:00-03:00",
          },
        }),
      },
      {
        type: "application/ld+json",
        children: JSON.stringify({
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
    t: "Sua pergunta respondida ao vivo",
    d: "Mande seu desafio na inscrição ou no chat. A Mesa IA News responde ao vivo, com base no que a redação apurou.",
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
  { time: "19h25", min: 25, title: "O que deu certo, setor por setor", d: "Os casos que a IA News apurou em 2026: o problema, o que a empresa fez, o resultado publicado e o erro que não vale repetir." },
  { time: "19h50", min: 15, title: "Playbook IA 2027", d: "Como escolher, contratar e medir um projeto de IA. E como vender IA para empresas." },
  { time: "20h05", min: 10, title: "Anúncio da Lista IA News 100", d: "Os 100 nomes que fazem IA de verdade nos negócios no Brasil, revelados ao vivo.", hi: true },
  { time: "20h15", min: 10, title: "Mesa IA News", d: "Henrique Magioni responde às perguntas enviadas na inscrição e no chat." },
  { time: "20h25", min: 5, title: "Encerramento", d: "Próximos passos, Conselho IA News e o presencial de fevereiro." },
];

const INCLUI = [
  { t: "Workshop ao vivo de 1h30", d: "16/12, das 19h às 20h30, com perguntas no chat" },
  { t: "Gravação por 30 dias", d: "Para rever ou assistir se não puder no horário" },
  { t: "Slides do Raio-X IA News 2026", d: "Os dados apresentados, para usar no seu planejamento" },
  { t: "Playbook IA 2027", d: "Roteiro para quem compra e para quem vende IA" },
  { t: "R$ 97 de crédito no presencial", d: "Vira desconto no Palco IA News em Belo Horizonte, em fevereiro" },
  { t: "Garantia de 7 dias", d: "Desistiu em até 7 dias depois da compra? Devolvemos 100%" },
];

const FAQ = [
  {
    q: "Como eu pago?",
    a: "Logo depois da inscrição, você vai direto para a página de pagamento, com Pix, cartão ou boleto. O mesmo link também chega por e-mail. A vaga é confirmada com o pagamento.",
  },
  { q: "Como eu assisto?", a: "É online e ao vivo. O link de acesso chega por WhatsApp e e-mail, na véspera e 2 horas antes do início." },
  { q: "E se eu não puder ver ao vivo?", a: "A gravação fica disponível por 30 dias para quem se inscreveu." },
  {
    q: "E se eu desistir?",
    a: `Você tem 7 dias depois da compra para desistir. É só escrever para ${CONTACT_EMAIL} e devolvemos 100% do valor, pelo mesmo meio de pagamento.`,
  },
  {
    q: "E o evento presencial?",
    a: "O Palco IA News presencial acontece em Belo Horizonte, em 11 de fevereiro de 2027. Quem participar do online tem prioridade e usa os R$ 97 como desconto no ingresso.",
  },
  {
    q: "Preciso entender de tecnologia?",
    a: "Não. O conteúdo é para dono, sócio e gestor que decide onde investir. Nada de código ou tutorial de ferramenta.",
  },
  {
    q: "Quero patrocinar.",
    a: `Escreva para ${CONTACT_EMAIL}. A equipe da IA News te procura com as cotas de apoio e de apresentação.`,
  },
  { q: "Quem organiza?", a: "A IA News, com a FGIA Educação, a vertical de eventos e aulas da IA News." },
];

/* Cases e falas reais, de empresários que a IA News entrevistou. Não são os palestrantes do Palco:
   nenhum deles está confirmado como convidado. Números e frases saem das matérias publicadas. */
const COVER = (slug: string, file: string) =>
  `https://hgydwvuowxxkdgtlqrdy.supabase.co/storage/v1/object/public/covers/${slug}/${file}`;

const CASES = [
  {
    slug: "thiago-cardoso-ifood-27-mil-agentes-de-ia-30-por-cento-ebitda",
    img: "366049ec1c18.webp",
    n: "27 mil",
    t: "agentes de IA no iFood",
    who: "Thiago Cardoso",
    org: "iFood",
  },
  {
    slug: "amanda-diniz-divos-da-ia-empresa-agentica",
    img: "2ab712919abf.jpg",
    n: "R$ 500 mil",
    t: "em 6 meses, com agentes feitos por ela",
    who: "Amanda Diniz",
    org: "Divos da IA",
  },
  {
    slug: "christian-hart-orbit-ia-gestao-agentica-1230-empresas",
    img: "07fb181ebf82.png",
    n: "R$ 6 mi",
    t: "de receita recorrente, com 40 agentes",
    who: "Christian Hart",
    org: "Orbit",
  },
  {
    slug: "rodrigo-lins-nevoa-ai-controlador-ia-advocacia",
    img: "1e25c3320e33.webp",
    n: "2,4 mi",
    t: "de tarefas por ano automatizadas",
    who: "Rodrigo Lins",
    org: "Nevoa AI",
  },
  {
    slug: "bruno-richards-da-not-journal-com-tres-pessoas-e-ia-83-milhoes-de-visualizacoes-em-um-mes",
    img: "365a7b8882ff.jpg",
    n: "83 mi",
    t: "de visualizações em um mês, com 3 pessoas",
    who: "Bruno Richards",
    org: "Not Journal",
  },
  {
    slug: "matheus-caiaffa-ia-ecommerce-5-milhoes",
    img: "badd567496f7.jpg",
    n: "R$ 5 mi",
    t: "faturados sozinho, com IA, em 2 anos",
    who: "Matheus Caiaffa",
    org: "E-commerce",
  },
];

const FALAS = [
  {
    q: "A IA acelera quem sabe o que está fazendo. Para quem não sabe, ela acelera o erro.",
    who: "Amanda Diniz",
    org: "Divos da IA",
    slug: "amanda-diniz-divos-da-ia-empresa-agentica",
    img: "2ab712919abf.jpg",
  },
  {
    q: "Comece pela dor. Olhe para onde a sua empresa perde mais tempo e dinheiro e comece por ali.",
    who: "Christian Hart",
    org: "Orbit",
    slug: "christian-hart-orbit-ia-gestao-agentica-1230-empresas",
    img: "07fb181ebf82.png",
  },
  {
    q: "Minha organização começa a ser composta por pessoas e agentes.",
    who: "Thiago Cardoso",
    org: "iFood",
    slug: "thiago-cardoso-ifood-27-mil-agentes-de-ia-30-por-cento-ebitda",
    img: "366049ec1c18.webp",
  },
  {
    q: "A maioria usa IA pra escrever email. Eu uso pra rodar negócio.",
    who: "Matheus Caiaffa",
    org: "E-commerce",
    slug: "matheus-caiaffa-ia-ecommerce-5-milhoes",
    img: "badd567496f7.jpg",
  },
  {
    q: "Nossa visão é que o advogado não vai morrer, vamos fazer ele ficar superpoderoso.",
    who: "Rafael Bagolin",
    org: "Jusfy",
    slug: "rafael-bagolin-jusfy-jusgpt-advogados-r-50-milhoes",
    img: "9c79113e9af2.jpg",
  },
  {
    q: "A IA não vem para substituir ninguém. […] Ela vem para aprimorar a forma como as pessoas atuam dentro da empresa.",
    who: "Erick Castilio",
    org: "Astrevo",
    slug: "erick-castilio-astrevo-ia-so-onde-ha-retorno",
    img: "29f70dbf299d.png",
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
          meta: metaCtx(),
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
      <main id="main" className="pd">
        {/* 1. Topo: foto do auditório, data, promessa e contagem */}
        <section className="pd-hero" ref={heroRef}>
          <img className="pd-hero-img" src={IMG(20733081, 1920)} alt="" fetchPriority="high" />
          <div className="pd-hero-shade" aria-hidden="true" />
          <div className="wrap pd-hero-in">
            <p className="pd-pill">
              <span className="pd-dot" aria-hidden="true" />
              Ao vivo · 16 de dezembro · 19h<span className="pd-pill-tz"> (Brasília)</span>
            </p>
            <h1>Raio-X 2026 da IA nas empresas brasileiras</h1>
            <p className="pd-sub">
              O que deu certo com IA nas empresas brasileiras em 2026, o Playbook IA 2027 e a revelação da Lista IA News 100.
              Online, em 1h30, para quem decide onde investir em 2027.
            </p>
            <div className="pd-cta">
              <button className="pd-btn" type="button" onClick={scrollToForm}>
                Quero participar · {PRECO}
              </button>
              <a className="pd-ghost" href="#programacao">
                Ver a programação
              </a>
            </div>
            <div className="pd-count" aria-label="Contagem regressiva para o evento">
              <span>
                <b>{left ? left.d : "–"}</b>dias
              </span>
              <span>
                <b>{left ? String(left.h).padStart(2, "0") : "–"}</b>horas
              </span>
              <span>
                <b>{left ? String(left.m).padStart(2, "0") : "–"}</b>min
              </span>
            </div>
            <p className="pd-fine">Gravação por 30 dias · Garantia de 7 dias · Pix, cartão ou boleto</p>
          </div>
        </section>

        {/* 2. Prova */}
        <section className="pd-proof" aria-label="A IA News em números">
          <div className="wrap pd-proof-row">
            {PROVAS.map((p) => (
              <div key={p.t}>
                <b>{p.n}</b>
                <span>{p.t}</span>
              </div>
            ))}
            <div>
              <b className="hot">1h30</b>
              <span>ao vivo, com perguntas no chat</span>
            </div>
          </div>
        </section>

        {/* 3. O que você leva */}
        <section className="pd-sec" aria-labelledby="pd-leva">
          <div className="wrap">
            <p className="pd-kick">O problema</p>
            <h2 id="pd-leva" className="pd-h2">
              Em 2026 todo mundo falou de IA. Pouca gente mostrou resultado.
            </h2>
            <p className="pd-lead">
              A IA News publicou mais de 320 matérias sobre IA nas empresas e mapeou 523 empresas do setor. Neste workshop,
              a redação abre o que viu. Você sai da noite com três coisas na mão:
            </p>
            <div className="pd-cards">
              {LEVA.map((c, i) => (
                <article className="pd-card" key={c.t}>
                  <img src={IMG(c.img, 800)} alt="" loading="lazy" width={800} height={533} />
                  <div>
                    <span className="pd-num">0{i + 1}</span>
                    <h3>{c.t}</h3>
                    <p>{c.d}</p>
                  </div>
                </article>
              ))}
            </div>
          </div>
        </section>

        {/* 4. Cases que a IA News já contou */}
        <section className="pd-sec pd-cases" id="cases" aria-labelledby="pd-cases">
          <div className="wrap">
            <p className="pd-kick">Cases reais</p>
            <h2 id="pd-cases" className="pd-h2">
              A redação que apresenta o Palco é a mesma que contou estas histórias.
            </h2>
            <p className="pd-lead">
              Empresários brasileiros que colocaram IA para trabalhar e mostraram os números para a IA News. No Palco, a
              redação junta o que aprendeu com essas histórias e com as outras 320 matérias do ano.
            </p>
          </div>
          <div className="pd-rail" role="list">
            {CASES.map((c) => (
              <Link
                key={c.slug}
                role="listitem"
                className="pd-case"
                to="/materia/$slug"
                params={{ slug: c.slug }}
              >
                <img src={COVER(c.slug, c.img)} alt={c.who} loading="lazy" width={600} height={750} />
                <div className="pd-case-txt">
                  <b>{c.n}</b>
                  <span className="pd-case-t">{c.t}</span>
                  <span className="pd-case-who">
                    {c.who} · {c.org}
                  </span>
                </div>
              </Link>
            ))}
          </div>
        </section>

        {/* 5. Depoimentos: falas dos entrevistados */}
        <section className="pd-sec pd-falas" aria-labelledby="pd-falas">
          <div className="wrap">
            <p className="pd-kick">O que dizem os empresários</p>
            <h2 id="pd-falas" className="pd-h2">
              Quem faz IA dar resultado fala assim.
            </h2>
          </div>
          <div className="pd-rail" role="list">
            {FALAS.map((f) => (
              <figure key={f.who} role="listitem" className="pd-fala">
                <svg className="pd-quote" width="28" height="28" viewBox="0 0 24 24" aria-hidden="true">
                  <path
                    fill="currentColor"
                    d="M10 7H6a3 3 0 0 0-3 3v4h4v4l3-4v-7zm11 0h-4a3 3 0 0 0-3 3v4h4v4l3-4v-7z"
                  />
                </svg>
                <blockquote>{f.q}</blockquote>
                <figcaption>
                  <img src={COVER(f.slug, f.img)} alt="" loading="lazy" width={48} height={48} />
                  <span>
                    <b>{f.who}</b>
                    <small>
                      {f.org} ·{" "}
                      <Link to="/materia/$slug" params={{ slug: f.slug }}>
                        ler a matéria
                      </Link>
                    </small>
                  </span>
                </figcaption>
              </figure>
            ))}
          </div>
          <p className="wrap pd-note">Falas publicadas nas entrevistas da IA News.</p>
        </section>

        {/* 6. Para quem é */}
        <section className="pd-sec" aria-labelledby="pd-quem">
          <div className="wrap">
            <p className="pd-kick">Para quem é</p>
            <h2 id="pd-quem" className="pd-h2">
              Três perfis, uma decisão: o que fazer com IA em 2027.
            </h2>
            <div className="pd-who">
              {PUBLICO.map((p) => (
                <article key={p.t}>
                  <h3>{p.t}</h3>
                  <p>{p.d}</p>
                  <p className="pd-who-sai">{p.sai}</p>
                </article>
              ))}
            </div>
            <p className="pd-note">
              Não é um curso técnico: não tem código nem tutorial de ferramenta. É para quem decide onde a empresa coloca
              tempo e dinheiro em IA.
            </p>
          </div>
        </section>

        {/* 7. Programação: a faixa mostra o peso de cada bloco */}
        <section className="pd-sec" id="programacao" aria-labelledby="pd-prog">
          <div className="wrap">
            <p className="pd-kick">Programação</p>
            <h2 id="pd-prog" className="pd-h2">
              16 de dezembro, das 19h às 20h30
            </h2>
            <div className="pd-strip" aria-hidden="true">
              {AGENDA.map((a) => (
                <span key={a.time} className={a.hi ? "hi" : undefined} style={{ flexGrow: a.min, flexBasis: 0 }} />
              ))}
            </div>
            <ol className="pd-agenda">
              {AGENDA.map((a) => (
                <li key={a.time} className={a.hi ? "hi" : undefined}>
                  <time>
                    {a.time} <small>· {a.min} min</small>
                  </time>
                  <h3>{a.title}</h3>
                  <p>{a.d}</p>
                </li>
              ))}
            </ol>
            <p className="pd-note">Total de {total} minutos.</p>
          </div>
        </section>

        {/* 8. Lista 100 */}
        <section className="pd-band">
          <div className="wrap pd-band-in">
            <div>
              <h2>A Lista IA News 100 é revelada ao vivo, às 20h05.</h2>
              <p>
                Os 100 nomes que fazem IA de verdade nos negócios no Brasil. Ninguém paga para entrar, e o anúncio acontece
                primeiro para quem está no Palco.
              </p>
            </div>
            <Link className="pd-ghost" to="/lista100">
              Conhecer a Lista 100
            </Link>
          </div>
        </section>

        {/* 9. Oferta e inscrição */}
        <section className="pd-offer" id="inscricao" aria-labelledby="pd-ofe">
          <div className="wrap pd-offer-grid">
            <div className="pd-offer-copy">
              <h2 id="pd-ofe">Um ingresso. Dois eventos.</h2>
              <p className="pd-offer-lead">
                Os {PRECO} do online voltam como crédito no Palco IA News presencial, em Belo Horizonte, em fevereiro de
                2027. E quem vai ao online tem prioridade na compra.
              </p>
              <ul className="pd-inclui">
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
            </div>

            <div className="pd-form" id="lista" ref={formRef}>
              <div className="biz-card pt-card-form pd-ticket">
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
                      <a className="pd-btn pd-btn-full" href={PALCO_PAGAMENTO_URL}>
                        Pagar {PRECO} e confirmar a vaga
                      </a>
                    </div>
                    <p className="fine">O link de pagamento também foi para o seu e-mail.</p>
                  </div>
                ) : (
                  <form className="biz-form" onSubmit={onSubmit} noValidate>
                    <div className="pd-ticket-top">
                      <span>Palco IA News Online</span>
                      <b>{PRECO}</b>
                    </div>
                    <p className="pd-ticket-sub">Só 3 campos. Depois, o pagamento.</p>
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

                    <details className="pc2-more">
                      <summary>
                        Quer levar uma pergunta para a Mesa IA News? <small>opcional</small>
                      </summary>
                      <div className="biz-fields">
                        {field("empresa", "Empresa", {
                          autoComplete: "organization",
                          maxLength: 160,
                          placeholder: "Nome da empresa",
                          optional: true,
                        })}
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

                    <div className="biz-submit">
                      <button className="pd-btn pd-btn-full" type="submit" disabled={sending}>
                        {sending ? "Enviando…" : `Garantir minha vaga por ${PRECO}`}
                      </button>
                      <span className="fine">
                        Em seguida, você paga por Pix, cartão ou boleto. Ao continuar, você aceita receber as informações do
                        Palco por WhatsApp e e-mail. <Link to="/termos">Privacidade</Link>.
                      </span>
                      <p className="msg err" role="status" aria-live="polite">
                        {failMsg ?? ""}
                      </p>
                    </div>
                  </form>
                )}
              </div>
              <p className="pd-guarantee">
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                  <path d="M12 3l7 3v6c0 4.5-3 7.5-7 9-4-1.5-7-4.5-7-9V6z" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
                  <path d="m8.5 12 2.5 2.5 4.5-5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
                <span>
                  <b>Garantia de 7 dias.</b> Desistiu? Devolvemos 100%, pelo mesmo meio de pagamento.
                </span>
              </p>
            </div>
          </div>
        </section>

        {/* 10. Presencial de fevereiro */}
        <section className="pd-sec">
          <div className="wrap pd-next">
            <img src={IMG(3143850, 1200)} alt="Palco iluminado diante de uma plateia" loading="lazy" width={1200} height={800} />
            <div>
              <p className="pd-kick">Fevereiro de 2027</p>
              <h2 className="pd-h2">Depois do online, o Palco sobe em Belo Horizonte.</h2>
              <p className="pd-lead">
                O primeiro Palco IA News presencial acontece em fevereiro, com cases, expositores e networking. Quem
                participar do online tem prioridade e usa os {PRECO} como desconto.
              </p>
            </div>
          </div>
        </section>

        {/* 11. Quem organiza e dúvidas */}
        <section className="pd-sec pd-light">
          <div className="wrap">
            <div className="pd-org">
              <div>
                <h3>IA News</h3>
                <p>Portal, newsletter e Instagram sobre IA para quem decide.</p>
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
            <h2 id="pc-faq" className="pd-h2 pd-faq-h">
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
          </div>
        </section>

        {/* 12. Chamada final */}
        <section className="pd-final">
          <img src={IMG(9275222, 1600)} alt="" loading="lazy" />
          <div className="pd-final-shade" aria-hidden="true" />
          <div className="wrap pd-final-in">
            <h2>16 de dezembro, 19h. Ao vivo, de onde você estiver.</h2>
            <button className="pd-btn pd-btn-hot" type="button" onClick={scrollToForm}>
              Garantir vaga por {PRECO}
            </button>
            <p>Uma realização IA News com a FGIA Educação</p>
          </div>
        </section>

        {/* Barra fixa */}
        {!done ? (
          <div className={"plv-bar" + (showBar ? " on" : "")} aria-hidden={!showBar}>
            <span className="plv-bar-txt">
              <b>Palco IA News Online</b>
              <small>16/12, 19h · {PRECO}</small>
            </span>
            <button className="pd-btn" type="button" onClick={scrollToForm} tabIndex={showBar ? 0 : -1}>
              Garantir vaga
            </button>
          </div>
        ) : null}
      </main>
      <SiteFooter />
    </>
  );
}
