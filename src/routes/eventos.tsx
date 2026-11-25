import { createFileRoute, Link } from "@tanstack/react-router";

import { SiteHeader } from "@/components/site/header";
import { SiteFooter } from "@/components/site/footer";
import { AULA } from "@/lib/inscricao";
import { jsonLd } from "@/lib/json-ld";

/* Agenda de eventos da IA News: online, gratuitos e o presencial de BH.
   Cada evento sai com dados estruturados de Event para aparecer na busca de eventos do Google. */

const PAGE_URL = "https://ianewsbr.com/eventos";
const TITLE = "Eventos de inteligência artificial: workshops e Palco IA News";
const DESCRIPTION =
  "Agenda de eventos de IA da IA News: Palco IA News Online em 16/12 e o primeiro Palco presencial em Belo Horizonte, em 11/02/2027, com casos reais de empresas.";

type Evento = {
  id: string;
  kick: string;
  nome: string;
  quando: string;
  onde: string;
  preco: string;
  resumo: string;
  to: "/aula" | "/palco";
  cta: string;
  inicio: string;
  fim?: string;
  online: boolean;
  gratis: boolean;
  status: "aberto" | "lista";
};

const EVENTOS: Evento[] = [
  {
    id: "aula",
    kick: "Aula ao vivo · gratuita",
    nome: AULA.titulo,
    quando: `${AULA.dataLonga}, às ${AULA.hora}`,
    onde: AULA.onde,
    preco: "Gratuito",
    resumo: `${AULA.duracao} com casos reais de empresas brasileiras que usam IA em vendas e atendimento.`,
    to: "/aula",
    cta: "Inscrever-se de graça",
    inicio: AULA.inicio,
    online: true,
    gratis: true,
    status: "aberto",
  },
  {
    id: "palco-online",
    kick: "Workshop ao vivo",
    nome: "Palco IA News Online: Raio-X 2026 da IA nas empresas brasileiras",
    quando: "Quarta-feira, 16 de dezembro de 2026, das 19h às 20h30",
    onde: "Online, ao vivo",
    preco: "R$ 97 (vira crédito no presencial)",
    resumo:
      "O Raio-X 2026 da IA nas empresas, o Playbook IA 2027 e a revelação ao vivo da Lista IA News 100. Gravação por 30 dias e garantia de 7 dias.",
    to: "/palco",
    cta: "Garantir minha vaga",
    inicio: "2026-12-16T19:00:00-03:00",
    fim: "2026-12-16T20:30:00-03:00",
    online: true,
    gratis: false,
    status: "aberto",
  },
  {
    id: "palco-bh",
    kick: "Presencial · Belo Horizonte",
    nome: "Palco IA News Belo Horizonte",
    quando: "11 de fevereiro de 2027",
    onde: "Belo Horizonte (MG)",
    preco: "Prioridade para quem participa do online",
    resumo:
      "O primeiro Palco presencial da IA News: cases, expositores e networking com quem está fazendo IA dar resultado nos negócios.",
    to: "/palco",
    cta: "Entrar pela edição online",
    inicio: "2027-02-11",
    online: false,
    gratis: false,
    status: "lista",
  },
];

const FAQ = [
  {
    q: "Os eventos da IA News são online ou presenciais?",
    a: "A aula de 25/11 e o Palco de 16/12 são online e ao vivo. O primeiro Palco presencial acontece em Belo Horizonte, em 11 de fevereiro de 2027.",
  },
  {
    q: "Para quem são os eventos?",
    a: "Para empresários, fornecedores de IA e líderes que precisam decidir o que fazer com inteligência artificial a partir de casos reais de empresas brasileiras.",
  },
  {
    q: "Tem gravação?",
    a: "O Palco IA News Online fica gravado por 30 dias para quem se inscreveu.",
  },
  {
    q: "Como minha empresa pode patrocinar ou expor?",
    a: "Os planos de patrocínio estão na página Anuncie. Quem fecha o plano Patrocínio tem espaço para a marca e tempo de fala no Palco presencial de Belo Horizonte.",
  },
];

function eventLd(e: Evento) {
  const url = `https://ianewsbr.com${e.to}`;
  return {
    "@type": "Event",
    name: e.nome,
    description: e.resumo,
    startDate: e.inicio,
    ...(e.fim ? { endDate: e.fim } : {}),
    eventStatus: "https://schema.org/EventScheduled",
    eventAttendanceMode: e.online
      ? "https://schema.org/OnlineEventAttendanceMode"
      : "https://schema.org/OfflineEventAttendanceMode",
    inLanguage: "pt-BR",
    location: e.online
      ? { "@type": "VirtualLocation", url }
      : {
          "@type": "Place",
          name: "Belo Horizonte",
          address: {
            "@type": "PostalAddress",
            addressLocality: "Belo Horizonte",
            addressRegion: "MG",
            addressCountry: "BR",
          },
        },
    image: ["https://ianewsbr.com/og-ianews.png"],
    organizer: { "@type": "Organization", name: "IA News", url: "https://ianewsbr.com" },
    ...(e.gratis
      ? {
          isAccessibleForFree: true,
          offers: {
            "@type": "Offer",
            url,
            price: "0",
            priceCurrency: "BRL",
            availability: "https://schema.org/InStock",
          },
        }
      : e.id === "palco-online"
        ? {
            offers: {
              "@type": "Offer",
              url,
              price: "97",
              priceCurrency: "BRL",
              availability: "https://schema.org/InStock",
            },
          }
        : {}),
    url,
  };
}

export const Route = createFileRoute("/eventos")({
  head: () => ({
    meta: [
      { title: `${TITLE} | IA News` },
      { name: "description", content: DESCRIPTION },
      { property: "og:title", content: TITLE },
      { property: "og:description", content: DESCRIPTION },
      { property: "og:url", content: PAGE_URL },
      { property: "og:type", content: "website" },
    ],
    links: [{ rel: "canonical", href: PAGE_URL }],
    scripts: [
      {
        type: "application/ld+json",
        children: jsonLd({
          "@context": "https://schema.org",
          "@type": "ItemList",
          name: "Eventos de inteligência artificial da IA News",
          itemListElement: EVENTOS.map((e, i) => ({
            "@type": "ListItem",
            position: i + 1,
            item: eventLd(e),
          })),
        }),
      },
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
  component: EventosPage,
});

function EventosPage() {
  return (
    <>
      <SiteHeader />
      <main id="main" className="ev">
        <section className="ev-hero">
          <div className="wrap">
            <p className="ev-kick">Agenda IA News</p>
            <h1>Eventos de inteligência artificial para quem decide</h1>
            <p className="ev-lead">
              Workshops e encontros com casos reais de empresas brasileiras que colocaram IA para
              trabalhar. Online e ao vivo, e o primeiro Palco presencial em Belo Horizonte em
              fevereiro de 2027.
            </p>
          </div>
        </section>

        <section className="wrap ev-list" aria-label="Próximos eventos">
          {EVENTOS.map((e) => (
            <article key={e.id} className={"ev-card" + (e.status === "lista" ? " is-soon" : "")}>
              <p className="ev-card-k">{e.kick}</p>
              <h2>{e.nome}</h2>
              <dl>
                <div>
                  <dt>Quando</dt>
                  <dd>{e.quando}</dd>
                </div>
                <div>
                  <dt>Onde</dt>
                  <dd>{e.onde}</dd>
                </div>
                <div>
                  <dt>Ingresso</dt>
                  <dd>{e.preco}</dd>
                </div>
              </dl>
              <p className="ev-card-d">{e.resumo}</p>
              <Link className="btn blue" to={e.to}>
                {e.cta} →
              </Link>
            </article>
          ))}
        </section>

        <section className="wrap ev-more">
          <div>
            <h2>Sua empresa quer patrocinar ou expor?</h2>
            <p>Espaço para a marca e tempo de fala no Palco presencial de Belo Horizonte.</p>
          </div>
          <Link className="btn" to="/anuncie">
            Ver planos de patrocínio
          </Link>
        </section>

        <section className="wrap ev-faq" aria-labelledby="ev-faq-h">
          <h2 id="ev-faq-h">Dúvidas sobre os eventos</h2>
          <div className="faq">
            {FAQ.map((f) => (
              <details key={f.q}>
                <summary>{f.q}</summary>
                <p>{f.a}</p>
              </details>
            ))}
          </div>
        </section>
      </main>
      <SiteFooter />
    </>
  );
}
