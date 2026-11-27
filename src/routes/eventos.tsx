import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Briefcase, CalendarDays, Cpu, MapPin, Ticket, Users } from "lucide-react";

import { PortalSubscribeForm } from "@/components/site/portal-subscribe";

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
    a: "O Palco IA News de 16/12 é online e ao vivo. O primeiro Palco presencial acontece em Belo Horizonte, em 11 de fevereiro de 2027.",
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
          itemListElement: EVENTOS.filter((e) => fimDe(e) > Date.now()).map((e, i) => ({
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

const PALCO_IMG =
  "https://images.pexels.com/photos/9275222/pexels-photo-9275222.jpeg?auto=compress&cs=tinysrgb&w=1200";

const VER = [
  "O Raio-X 2026: como as empresas brasileiras estão usando IA, com números e casos reais",
  "O Playbook IA 2027: o que priorizar no próximo ano, por área da empresa",
  "A revelação ao vivo da Lista IA News 100: quem faz a IA acontecer no Brasil",
];

const PUBLICO = [
  {
    icon: Briefcase,
    t: "Empresários e diretores",
    d: "Para decidir onde a IA dá retorno no seu negócio, a partir de casos de empresas parecidas.",
  },
  {
    icon: Cpu,
    t: "Quem vende ou implementa IA",
    d: "Para entender o que o mercado está comprando e encontrar clientes e parceiros.",
  },
  {
    icon: Users,
    t: "Líderes e equipes",
    d: "Para levar ideias práticas para dentro da empresa e treinar o time com exemplos reais.",
  },
];

const MESES = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];

function diaMes(iso: string) {
  const d = new Date(iso.length === 10 ? iso + "T12:00:00-03:00" : iso);
  const parts = new Intl.DateTimeFormat("en-US", {
    day: "numeric",
    month: "numeric",
    year: "numeric",
    timeZone: "America/Sao_Paulo",
  }).formatToParts(d);
  const g = (t: string) => Number(parts.find((p) => p.type === t)?.value ?? 0);
  return { dia: g("day"), mes: MESES[g("month") - 1] ?? "", ano: g("year") };
}

function fimDe(e: Evento) {
  const iso = e.fim ?? e.inicio;
  const t = new Date(iso.length === 10 ? iso + "T23:59:00-03:00" : iso).getTime();
  return e.fim ? t : t + 2 * 3600 * 1000;
}

function EventosPage() {
  const [agora, setAgora] = useState<number | null>(null);
  useEffect(() => setAgora(Date.now()), []);
  const ref = Date.now();
  const proximos = EVENTOS.filter((e) => fimDe(e) > (agora ?? ref));
  const passados = EVENTOS.filter((e) => fimDe(e) <= (agora ?? ref));
  const destaque = proximos.find((e) => e.status === "aberto") ?? proximos[0];
  const faltam =
    agora && destaque
      ? Math.max(0, Math.ceil((new Date(destaque.inicio).getTime() - agora) / 86400000))
      : null;

  return (
    <>
      <SiteHeader />
      <main id="main" className="page ev2">
        <section className="ev2-hero">
          <div className="wrap ev2-hero-grid">
            <div>
              <p className="kick">Agenda IA News</p>
              <h1>Eventos de IA para quem decide</h1>
              <p className="sub">
                Casos reais de empresas brasileiras que colocaram IA para trabalhar. Online e ao
                vivo, e o primeiro Palco presencial em Belo Horizonte, em fevereiro de 2027.
              </p>
              <div className="ev2-hero-cta">
                {destaque ? (
                  <Link to={destaque.to} className="btn blue">
                    {destaque.cta}
                  </Link>
                ) : null}
                <a href="#agenda" className="btn ev2-ghost">
                  Ver a agenda
                </a>
              </div>
              <ul className="ev2-facts">
                <li>
                  <b>{EVENTOS.length}</b> encontros em 2026–27
                </li>
                <li>
                  <b>Ao vivo</b> com gravação
                </li>
                <li>
                  <b>BH</b> presencial em fev/27
                </li>
              </ul>
            </div>
            <figure className="ev2-hero-img">
              <img
                src={PALCO_IMG}
                alt="Plateia assistindo a uma palestra"
                width={720}
                height={480}
              />
              {destaque ? (
                <figcaption>
                  <span className="ev2-date">
                    <b>{diaMes(destaque.inicio).dia}</b>
                    <span>{diaMes(destaque.inicio).mes}</span>
                  </span>
                  <span>
                    <small>Próximo evento</small>
                    <b>{destaque.nome}</b>
                  </span>
                </figcaption>
              ) : null}
            </figure>
          </div>
        </section>

        <div className="wrap">
          {destaque ? (
            <section className="ev2-feat" aria-labelledby="ev2-feat-h">
              <div className="ev2-feat-main">
                <p className="kick">
                  {destaque.kick}
                  {faltam != null ? (
                    <span className="ev2-count">
                      {faltam === 0
                        ? "É hoje"
                        : faltam === 1
                          ? "Falta 1 dia"
                          : `Faltam ${faltam} dias`}
                    </span>
                  ) : null}
                </p>
                <h2 id="ev2-feat-h">{destaque.nome}</h2>
                <p className="ev2-feat-res">{destaque.resumo}</p>
                {destaque.id === "palco-online" ? (
                  <>
                    <p className="ev2-lb">O que você vai ver</p>
                    <ul className="ticks">
                      {VER.map((v) => (
                        <li key={v}>{v}</li>
                      ))}
                    </ul>
                  </>
                ) : null}
              </div>
              <aside className="ev2-feat-side">
                <dl>
                  <div>
                    <dt>
                      <CalendarDays aria-hidden="true" /> Quando
                    </dt>
                    <dd>{destaque.quando}</dd>
                  </div>
                  <div>
                    <dt>
                      <MapPin aria-hidden="true" /> Onde
                    </dt>
                    <dd>{destaque.onde}</dd>
                  </div>
                  <div>
                    <dt>
                      <Ticket aria-hidden="true" /> Ingresso
                    </dt>
                    <dd>{destaque.preco}</dd>
                  </div>
                </dl>
                <Link to={destaque.to} className="btn blue wide">
                  {destaque.cta}
                </Link>
                {destaque.id === "palco-online" ? (
                  <p className="fine">Garantia de 7 dias. Gravação disponível por 30 dias.</p>
                ) : null}
              </aside>
            </section>
          ) : null}

          <section className="pt-sec" id="agenda" aria-labelledby="ev2-ag-h">
            <div className="sec-head">
              <h2 id="ev2-ag-h">Agenda</h2>
            </div>
            <ol className="ev2-list">
              {proximos.map((e) => {
                const d = diaMes(e.inicio);
                return (
                  <li key={e.id}>
                    <span className="ev2-date">
                      <b>{d.dia}</b>
                      <span>{d.mes}</span>
                      <small>{d.ano}</small>
                    </span>
                    <span className="ev2-li-txt">
                      <span className="ev2-li-k">
                        {e.kick}
                        <em className={e.status === "aberto" ? "open" : "wait"}>
                          {e.status === "aberto" ? "Inscrições abertas" : "Lista de prioridade"}
                        </em>
                      </span>
                      <b>{e.nome}</b>
                      <span className="ev2-li-m">
                        {e.onde} · {e.preco}
                      </span>
                    </span>
                    <Link
                      to={e.to}
                      className={"btn s " + (e.status === "aberto" ? "blue" : "line")}
                    >
                      {e.cta}
                    </Link>
                  </li>
                );
              })}
            </ol>
          </section>

          <section className="pt-sec" aria-labelledby="ev2-pub-h">
            <div className="sec-head">
              <h2 id="ev2-pub-h">Para quem são os eventos</h2>
            </div>
            <div className="ev2-pub">
              {PUBLICO.map((p) => (
                <div key={p.t}>
                  <span className="ev2-pub-ic" aria-hidden="true">
                    <p.icon />
                  </span>
                  <b>{p.t}</b>
                  <p>{p.d}</p>
                </div>
              ))}
            </div>
          </section>

          {passados.length ? (
            <section className="pt-sec" aria-labelledby="ev2-past-h">
              <div className="sec-head">
                <h2 id="ev2-past-h">Já aconteceu</h2>
              </div>
              <div className="ev2-past">
                {passados.map((e) => {
                  const d = diaMes(e.inicio);
                  return (
                    <div key={e.id}>
                      <span className="ev2-past-k">
                        {d.dia} {d.mes} · {e.online ? "Online" : e.onde}
                      </span>
                      <b>{e.nome}</b>
                      <p>{e.resumo}</p>
                    </div>
                  );
                })}
              </div>
            </section>
          ) : null}

          <div className="ev2-bands">
            <div className="ev2-band dark">
              <div>
                <p className="kick">Patrocínio e exposição</p>
                <h3>Sua marca no palco de quem decide sobre IA</h3>
                <p>Espaço para a marca e tempo de fala no Palco presencial de Belo Horizonte.</p>
              </div>
              <Link className="btn" to="/anuncie">
                Ver planos de patrocínio
              </Link>
            </div>
            <div className="ev2-band">
              <div>
                <p className="kick">Próximos eventos</p>
                <h3>Receba a agenda no seu e-mail</h3>
                <p>As datas chegam primeiro para quem assina a newsletter das 7h.</p>
              </div>
              <PortalSubscribeForm placement="eventos" button="Quero receber" />
            </div>
          </div>

          <section className="pt-sec" aria-labelledby="ev2-faq-h">
            <div className="sec-head">
              <h2 id="ev2-faq-h">Dúvidas sobre os eventos</h2>
            </div>
            <div className="faq">
              {FAQ.map((f) => (
                <details key={f.q}>
                  <summary>{f.q}</summary>
                  <p>{f.a}</p>
                </details>
              ))}
            </div>
          </section>
        </div>
      </main>
      <SiteFooter />
    </>
  );
}
