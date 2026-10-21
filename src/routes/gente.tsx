import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useRef, useState, type FormEvent } from "react";

import { SiteHeader } from "@/components/site/header";
import { SiteFooter } from "@/components/site/footer";
import { PortalSubscribeForm, useSubscribed } from "@/components/site/portal-subscribe";
import { CATEGORY_MAP, type CategoryKey } from "@/components/site/category-chip";
import { getArticleBySlug } from "@/lib/articles.functions";
import { submitContactMessage } from "@/lib/contact.functions";
import { NewsletterOptIn, wantsNewsletter } from "@/components/site/newsletter-opt-in";

const PAGE_URL = "https://ianewsbr.com/gente";
const TITLE = "Gente — quem faz a IA no Brasil | IA News";
const DESCRIPTION =
  "Perfis e bastidores dos brasileiros que estão construindo com inteligência artificial: fundadores, executivos e as rodadas das startups brasileiras de IA.";

/* Crédito padrão das fotos do Web Summit (licença CC BY 2.0). */
const WS = " via Sportsfile · CC BY 2.0";

type Person = {
  name: string;
  role: string;
  img: string;
  pos: string;
  credit: string;
  text: string;
  /** slug de matéria do portal; o link só aparece se a matéria existir. */
  art?: string;
  note?: string;
  src?: [string, string];
};

const PEOPLE: Person[] = [
  {
    name: "Tarciana Medeiros",
    role: "Presidente do Banco do Brasil",
    img: "/gente/tarciana.jpg",
    pos: "50% 20%",
    credit: "Foto: Vaughn Ridley/Web Summit" + WS,
    art: "banco-do-brasil-ia-20-mil-funcionarios",
    text: "Primeira mulher a presidir o banco em mais de 200 anos. Diz que 2,3 mil agentes de IA já rendem o equivalente ao trabalho de 20 mil pessoas.",
  },
  {
    name: "Rodrigo Tognini",
    role: "Cofundador e CEO da Conta Simples",
    img: "/gente/tognini.jpg",
    pos: "62% 30%",
    credit: "Foto: Sam Barnes/Web Summit" + WS,
    art: "conta-simples-agente-ia-banco-agentico",
    text: "Quer transformar a conta da empresa em um “banco agêntico”, com agentes de IA que pagam e conciliam dentro de limites.",
  },
  {
    name: "Diego Barreto",
    role: "CEO do iFood",
    img: "/gente/diego-frase.jpg",
    pos: "55% 25%",
    credit: "Foto: Ramsey Cardy/Web Summit" + WS,
    art: "diego-barreto-ifood-agentes-de-ia",
    text: "Mineiro de Uberaba, conduziu a virada que colocou 14 mil agentes de IA para trabalhar dentro do iFood.",
  },
  {
    name: "Luis Silva",
    role: "Fundador e CEO da CloudWalk",
    img: "/gente/luis.jpg",
    pos: "50% 18%",
    credit: "Foto: Sam Barnes/Web Summit" + WS,
    art: "cloudwalk-receita-por-funcionario-ia",
    text: "Dobrou a receita da dona da InfinitePay para R$ 5,44 bilhões com 720 pessoas e agentes que executam processos inteiros.",
  },
  {
    name: "Mônica Hauck",
    role: "Fundadora e CEO da Sólides",
    img: "/gente/monica-retrato.jpg",
    pos: "50% 18%",
    credit: "Foto: Ramsey Cardy/Web Summit" + WS,
    art: "solides-start-contratar-por-audio-whatsapp",
    text: "Criou uma forma de pequenas empresas sem RH abrirem vagas por áudio no WhatsApp, com IA na triagem.",
  },
  {
    name: "Renan Oliveira",
    role: "Chief AI Officer do PicPay",
    img: "/gente/renan.jpg",
    pos: "50% 25%",
    credit: "Foto: Sam Barnes/Web Summit" + WS,
    text: "“Aqui IA não é só IA, é IA resolvendo problemas de verdade.” O PicPay usa IA generativa desde 2023 e reduziu em 8 pontos percentuais os chamados que precisam de atendimento humano.",
    note: "Fonte: PicPay, via ABES, jun/2025",
  },
  {
    name: "Christian Pedrosa",
    role: "CEO e fundador da DigAí",
    img: "/gente/digai.jpg",
    pos: "50% 60%",
    credit: "A DigAí no palco do Web Summit Rio 2025 · Foto: Vaughn Ridley/Web Summit" + WS,
    text: "A startup de agentes de IA venceu a competição do Web Summit Rio 2025, que reuniu 1.397 startups. Na final, superou Biolinker e Elephan.AI.",
    note: "Fontes: Web Summit e Canaltech, mai/2025",
  },
  {
    name: "Mateus Costa-Ribeiro",
    role: "CEO e cofundador da Enter",
    img: "/gente/enter.jpg",
    pos: "50% 30%",
    credit:
      "Henrique Vaz, Mateus Costa-Ribeiro e Michael Mac-Vicar, da Enter · Foto: Divulgação, via Forbes Brasil",
    text: "Entrou na faculdade de Direito aos 14 anos e deixou o MBA em Stanford para fundar a Enter, que captou US$ 100 milhões em maio de 2026.",
    src: [
      "Forbes Brasil",
      "https://forbes.com.br/geral/2026/05/startup-juridica-enter-vira-unicornio-de-ia-com-rodada-de-us-100-milhoes-liderada-pelo-founders-fund/",
    ],
  },
  {
    name: "Alice Iglesias",
    role: "CEO e cofundadora da Settle",
    img: "/gente/settle.jpg",
    pos: "50% 30%",
    credit: "Os fundadores da Settle · Foto: Divulgação, via Bloomberg Línea",
    art: "settle-agentes-ia-licitacoes",
    text: "Ex-McKinsey e ex-Guiabolso, colocou mais de 100 agentes de IA para ler os editais de licitação que o Brasil publica todos os dias.",
  },
  {
    name: "Rica Barros",
    role: "CEO e cofundador da Tess AI",
    img: "/gente/rica.jpg",
    pos: "50% 30%",
    credit: "Foto: Divulgação, via Finsiders Brasil",
    text: "Criou a Tess dentro da Pareto. A plataforma reúne mais de 250 modelos para montar agentes sem programar.",
    src: [
      "Times Brasil | CNBC",
      "https://timesbrasil.com.br/empresas-e-negocios/tecnologia-e-inovacao/tess-revoluciona-o-mercado-com-plataforma-que-integra-250-modelos/",
    ],
  },
  {
    name: "Pedro Salles",
    role: "CEO e cofundador da Inner AI",
    img: "/gente/pedro.jpg",
    pos: "50% 30%",
    credit: "Foto: Divulgação, via Baguete",
    text: "Fundou a Inner AI em 2023 com Eduardo Mitelman. Em abril de 2026 a startup captou R$ 30 milhões.",
    src: ["Baguete", "https://www.baguete.com.br/noticias/inner-ai-capta-r-30-milhoes"],
  },
  {
    name: "Eric Acher",
    role: "Sócio-fundador da Monashees",
    img: "/gente/eric.jpg",
    pos: "35% 30%",
    credit: "Foto: Reprodução, via Bloomberg Línea",
    art: "gama-house-monashees-google-b3",
    text: "À frente da gestora que fundou em 2005, abriu com Google e B3 a Gama House, uma casa só para startups nativas em IA.",
  },
];

/* Capas: o texto vem da matéria real do banco; foto e citação são creditadas. */
const FEATURES = [
  {
    slug: "conta-simples-agente-ia-banco-agentico",
    img: "/gente/tognini.jpg",
    pos: "60% 30%",
    cap: "Rodrigo Tognini, cofundador e CEO da Conta Simples, no Web Summit Rio 2025",
    credit: "Foto: Sam Barnes/Web Summit" + WS,
    quote: [
      "Qualquer gestor descreve em linguagem natural o que o agente deve fazer, quando agir e com quais limites.",
      "Rodrigo Tognini, cofundador e CEO da Conta Simples",
    ],
  },
  {
    slug: "diego-barreto-ifood-agentes-de-ia",
    img: "/gente/diego.jpg",
    pos: "45% 25%",
    cap: "Diego Barreto, CEO do iFood, no Web Summit Rio",
    credit: "Foto: Ramsey Cardy/Web Summit" + WS,
    quote: [
      "Se eu desligar os modelos, a empresa não funciona.",
      "Diego Barreto, CEO do iFood, ao Times Brasil",
    ],
  },
] as const;

type Stat = {
  value: string;
  text: string;
  source: string;
  href?: string;
  /** matéria interna usada como fonte; o número só aparece se ela existir. */
  art?: string;
};

const STATS: Stat[] = [
  {
    value: "52%",
    text: "dos pequenos negócios brasileiros usaram IA em duas semanas. Nos EUA, 21%.",
    source: "Sebrae",
    art: "pequenos-negocios-ia-pesquisa-sebrae-2026",
  },
  {
    value: "US$ 219 mi",
    text: "captados por startups brasileiras de IA em 17 rodadas no 2º trimestre de 2026.",
    source: "CB Insights",
    href: "https://www.bloomberglinea.com.br/startups/rodadas-da-semana-latam-fica-com-1-dos-aportes-globais-em-startups-de-ia-no-trimestre/",
  },
  {
    value: "149%",
    text: "é o crescimento médio anual de receita das startups brasileiras nativas em IA.",
    source: "AWS Startups",
    href: "https://www.bloomberglinea.com.br/startups/rodadas-da-semana-startups-de-ia-registram-crescimento-de-149-em-receitas-no-brasil/",
  },
  {
    value: "215 mi",
    text: "de mensagens por dia os brasileiros mandam ao ChatGPT.",
    source: "OpenAI",
    art: "brasil-top-5-receita-openai",
  },
];

const ROUNDS: [string, string, string, string, string, string][] = [
  [
    "Enter",
    "Série B",
    "US$ 100 mi",
    "Founders Fund",
    "mai 2026",
    "https://forbes.com.br/geral/2026/05/startup-juridica-enter-vira-unicornio-de-ia-com-rodada-de-us-100-milhoes-liderada-pelo-founders-fund/",
  ],
  [
    "Pax",
    "Seed",
    "US$ 40 mi",
    "Greenoaks e Benchmark",
    "mai 2026",
    "https://www.bloomberglinea.com.br/negocios/chatgpt-da-policia-brasileira-pax-atrai-capital-dos-eua-com-ia-para-seguranca-publica/",
  ],
  [
    "Telepatia AI",
    "Série A",
    "US$ 33 mi",
    "Andreessen Horowitz",
    "2º tri 2026",
    "https://www.bloomberglinea.com.br/startups/rodadas-da-semana-latam-fica-com-1-dos-aportes-globais-em-startups-de-ia-no-trimestre/",
  ],
  [
    "Jota",
    "Série A",
    "R$ 150 mi",
    "Haun Ventures",
    "jul 2026",
    "https://www.bloomberglinea.com.br/startups/rodadas-da-semana-startups-de-ia-registram-crescimento-de-149-em-receitas-no-brasil/",
  ],
  [
    "Inner AI",
    "Não informado",
    "R$ 30 mi",
    "Canary e One VC",
    "abr 2026",
    "https://www.baguete.com.br/noticias/inner-ai-capta-r-30-milhoes",
  ],
  [
    "Shiva",
    "Pré-seed",
    "US$ 10 mi",
    "Monashees",
    "ago 2026",
    "https://www.bloomberglinea.com.br/startups/com-google-e-b3-monashees-abre-hub-de-startups-de-ia-com-modelos-de-negocios-globais/",
  ],
  [
    "Settle",
    "Pré-seed",
    "US$ 3,08 mi",
    "Canary e Row Capital",
    "fim de 2024",
    "https://www.bloomberglinea.com.br/startups/settle-usa-agentes-de-ia-para-destravar-mercado-de-licitacoes-publicas-de-r-1-tri/",
  ],
];

type ArticleLite = { slug: string; title: string; dek: string | null; category: string };

const LINKED_SLUGS = Array.from(
  new Set([
    ...FEATURES.map((f) => f.slug),
    ...PEOPLE.flatMap((p) => (p.art ? [p.art] : [])),
    ...STATS.flatMap((s) => (s.art ? [s.art] : [])),
  ]),
);

export const Route = createFileRoute("/gente")({
  loader: async () => {
    const found = await Promise.all(
      LINKED_SLUGS.map(async (slug): Promise<ArticleLite | null> => {
        try {
          const a = await getArticleBySlug({ data: { slug } });
          return a ? { slug: a.slug, title: a.title, dek: a.dek, category: a.category } : null;
        } catch (err) {
          console.error("[gente] loader failed", slug, err);
          return null;
        }
      }),
    );
    const articles: Record<string, ArticleLite> = {};
    for (const a of found) if (a) articles[a.slug] = a;
    return { articles };
  },
  head: () => ({
    meta: [
      { title: TITLE },
      { name: "description", content: DESCRIPTION },
      { property: "og:title", content: "Gente — quem faz a IA no Brasil" },
      { property: "og:description", content: DESCRIPTION },
      { property: "og:type", content: "website" },
      { property: "og:url", content: PAGE_URL },
      { property: "og:image", content: "https://ianewsbr.com/gente/tognini.jpg" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
    links: [{ rel: "canonical", href: PAGE_URL }],
  }),
  component: GentePage,
});

function catLabel(c: string) {
  return CATEGORY_MAP[c as CategoryKey]?.label ?? c;
}

function Thumb({
  src,
  alt,
  pos,
  cls,
  eager,
  label,
}: {
  src: string;
  alt: string;
  pos?: string;
  cls?: string;
  eager?: boolean;
  label?: string;
}) {
  const [broken, setBroken] = useState(false);
  if (broken) {
    return (
      <span className={"thumb none" + (cls ? " " + cls : "")}>
        <span>{label ?? "IANews"}</span>
      </span>
    );
  }
  return (
    <span className={"thumb" + (cls ? " " + cls : "")}>
      <img
        src={src}
        alt={alt}
        decoding="async"
        loading={eager ? "eager" : "lazy"}
        style={pos ? { objectPosition: pos } : undefined}
        onError={() => setBroken(true)}
      />
    </span>
  );
}

function GentePage() {
  const { articles } = Route.useLoaderData();
  const subscribed = useSubscribed();
  const features = FEATURES.filter((f) => articles[f.slug]);
  const stats = STATS.filter((s) => s.href || (s.art && articles[s.art]));

  return (
    <>
      <SiteHeader />
      <main id="main" className="page">
        <div className="wrap">
          <div className="page-head">
            <p className="kick">Gente</p>
            <h1>Quem faz a IA no Brasil</h1>
            <p className="sub">
              IA, negócios e as pessoas por trás. Perfis, bastidores e os brasileiros que estão
              construindo daqui para o mundo.
            </p>
          </div>

          {features.map((f, i) => {
            const a = articles[f.slug];
            return (
              <div
                key={f.slug}
                className={"feature" + (i % 2 === 1 ? " rev" : "")}
                style={i > 0 ? { marginTop: 48 } : undefined}
              >
                <Link
                  to="/materia/$slug"
                  params={{ slug: a.slug }}
                  style={{ textDecoration: "none", color: "inherit", minWidth: 0 }}
                >
                  <Thumb
                    src={f.img}
                    alt={f.cap}
                    pos={f.pos}
                    cls="r32"
                    eager={i === 0}
                    label={catLabel(a.category)}
                  />
                  <p className="cap">
                    <b>{f.cap}</b> · {f.credit}
                  </p>
                </Link>
                <div className="feature-txt">
                  <span className="kick">
                    <span className="tag">Capa</span>
                    <span>{catLabel(a.category)}</span>
                  </span>
                  <h3>{a.title}</h3>
                  {a.dek ? <p className="dek">{a.dek}</p> : null}
                  <blockquote>
                    {f.quote[0]}
                    <cite>{f.quote[1]}</cite>
                  </blockquote>
                  <Link className="btn" to="/materia/$slug" params={{ slug: a.slug }}>
                    Ler a capa
                  </Link>
                </div>
              </div>
            );
          })}

          <div className="sec-head" style={{ marginTop: features.length ? 56 : 8 }}>
            <h2>Para acompanhar</h2>
            <p className="lede">Nomes que estão puxando a fila</p>
          </div>
          <div className="people">
            {PEOPLE.map((p) => {
              const art = p.art ? articles[p.art] : undefined;
              return (
                <article key={p.name} className="person">
                  <Thumb
                    src={p.img}
                    alt={`${p.name}, ${p.role}`}
                    pos={p.pos}
                    cls="r43"
                    label={p.name}
                  />
                  <div>
                    <h3>{p.name}</h3>
                    <p className="role">{p.role}</p>
                  </div>
                  <p className="bio">{p.text}</p>
                  {art ? (
                    <Link className="lnk" to="/materia/$slug" params={{ slug: art.slug }}>
                      Ler a matéria →
                    </Link>
                  ) : p.src ? (
                    <a className="lnk" href={p.src[1]} target="_blank" rel="noopener noreferrer">
                      Fonte: {p.src[0]}
                    </a>
                  ) : null}
                  <p className="credit">{(p.note ? p.note + " · " : "") + p.credit}</p>
                </article>
              );
            })}
          </div>

          {!subscribed ? (
            <div className="band" style={{ marginTop: 48 }}>
              <div className="txt">
                <p className="kick">Newsletter IANews</p>
                <h2>Uma história de quem constrói com IA no Brasil, em toda edição</h2>
              </div>
              <PortalSubscribeForm placement="gente" button="Assinar grátis" />
            </div>
          ) : null}

          {stats.length ? (
            <>
              <div className="sec-head" style={{ marginTop: 56 }}>
                <h2>Em números</h2>
                <p className="lede">O tamanho da IA brasileira</p>
              </div>
              <div className="stats">
                {stats.map((s) => (
                  <div key={s.value}>
                    <b>{s.value}</b>
                    <span>
                      {s.text}{" "}
                      {s.href ? (
                        <a href={s.href} target="_blank" rel="noopener noreferrer">
                          {s.source}
                        </a>
                      ) : s.art ? (
                        <Link to="/materia/$slug" params={{ slug: s.art }}>
                          {s.source}
                        </Link>
                      ) : null}
                    </span>
                  </div>
                ))}
              </div>
            </>
          ) : null}

          <div className="sec-head" style={{ marginTop: 56 }}>
            <h2>Rodadas</h2>
            <p className="lede">Quem levantou dinheiro</p>
          </div>
          <div className="tbl-wrap stack">
            <table>
              <thead>
                <tr>
                  {["Startup", "Rodada", "Valor", "Quem liderou", "Quando", "Fonte"].map((h) => (
                    <th key={h}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {ROUNDS.map((r) => (
                  <tr key={r[0]}>
                    <td className="n">{r[0]}</td>
                    <td>{r[1]}</td>
                    <td className="n">{r[2]}</td>
                    <td>{r[3]}</td>
                    <td>{r[4]}</td>
                    <td>
                      <a href={r[5]} target="_blank" rel="noopener noreferrer">
                        Ver
                      </a>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="two-col" id="indicar" style={{ marginTop: 56, scrollMarginTop: 80 }}>
            <div>
              <p className="kick" style={{ marginBottom: 10 }}>
                Indique
              </p>
              <h2 className="big">Quem deve ser a próxima capa?</h2>
              <p className="intro">
                Indique um brasileiro que faz a IA acontecer. Pode ser do seu time, da sua cidade ou
                você.
              </p>
            </div>
            <IndicacaoForm />
          </div>
        </div>
      </main>
      <SiteFooter />
    </>
  );
}

const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

/** Indicação para a próxima capa: vai para a caixa de contato do painel. */
function IndicacaoForm() {
  const [form, setForm] = useState({ nome: "", email: "", pessoa: "", motivo: "" });
  const [msg, setMsg] = useState<{ t: string; ok: boolean } | null>(null);
  const [sending, setSending] = useState(false);
  const hp = useRef<HTMLInputElement>(null);
  const loadedAt = useRef(0);

  useEffect(() => {
    loadedAt.current = Date.now();
  }, []);

  function set(key: keyof typeof form, value: string) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    const newsletter = wantsNewsletter(e);
    if (sending) return;
    if (hp.current?.value) {
      setMsg({ t: "Indicação enviada. Obrigado!", ok: true });
      return;
    }
    const pessoa = form.pessoa.trim();
    if (!pessoa) return setMsg({ t: "Diga quem você indica.", ok: false });
    if (form.nome.trim().length < 2) return setMsg({ t: "Informe o seu nome.", ok: false });
    if (!EMAIL_RE.test(form.email.trim()))
      return setMsg({ t: "Digite um e-mail válido.", ok: false });
    if (Date.now() - loadedAt.current < 1500) return;
    setSending(true);
    setMsg(null);
    try {
      const motivo = form.motivo.trim();
      await submitContactMessage({
        data: {
          newsletter,
          kind: "contato",
          full_name: form.nome,
          email: form.email,
          subject: `Indicação para Gente: ${pessoa}`.slice(0, 200),
          message: `Indicação para a próxima capa de Gente\n\nQuem: ${pessoa}${motivo ? `\nO que está fazendo: ${motivo}` : ""}`,
        },
      });
      setMsg({ t: "Indicação enviada. Obrigado! A redação vai olhar com carinho.", ok: true });
      setForm({ nome: "", email: "", pessoa: "", motivo: "" });
    } catch (err) {
      setMsg({
        t: err instanceof Error && err.message ? err.message : "Não foi possível enviar agora.",
        ok: false,
      });
    } finally {
      setSending(false);
    }
  }

  return (
    <form className="panel-form" onSubmit={onSubmit} noValidate>
      <input
        ref={hp}
        className="hp"
        type="text"
        name="site"
        tabIndex={-1}
        autoComplete="off"
        aria-hidden="true"
      />
      <label className="f">
        Quem você indica?
        <input
          className="field"
          name="pessoa"
          type="text"
          placeholder="Nome e empresa"
          maxLength={120}
          value={form.pessoa}
          onChange={(e) => set("pessoa", e.target.value)}
        />
      </label>
      <div className="two">
        <label className="f">
          Seu nome
          <input
            className="field"
            name="nome"
            type="text"
            autoComplete="name"
            placeholder="Seu nome"
            maxLength={160}
            value={form.nome}
            onChange={(e) => set("nome", e.target.value)}
          />
        </label>
        <label className="f">
          Seu e-mail
          <input
            className="field"
            name="email"
            type="email"
            inputMode="email"
            autoComplete="email"
            placeholder="voce@email.com"
            maxLength={254}
            value={form.email}
            onChange={(e) => set("email", e.target.value)}
          />
        </label>
      </div>
      <label className="f">
        O que ela está fazendo?
        <textarea
          className="field"
          name="motivo"
          rows={2}
          placeholder="Em uma frase"
          maxLength={600}
          value={form.motivo}
          onChange={(e) => set("motivo", e.target.value)}
        />
      </label>
      <NewsletterOptIn />
      <div>
        <button className="btn" type="submit" disabled={sending}>
          {sending ? "Enviando..." : "Enviar indicação"}
        </button>
      </div>
      <p
        className={"msg" + (msg ? (msg.ok ? " ok" : " err") : "")}
        role="status"
        aria-live="polite"
      >
        {msg?.t ?? ""}
      </p>
    </form>
  );
}
