import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";

import { SiteHeader } from "@/components/site/header";
import { SiteFooter } from "@/components/site/footer";
import { Aceite, Campo, Enviar, Isca, Pilulas, Pronto, useInscricao } from "@/components/site/inscricao-form";
import { AULA, CANAL_URL, CONTATO, PERFIS } from "@/lib/inscricao";

/* Aula ao vivo da IA News: workshop online gratuito, uma vez por mês, dado por quem já colocou IA para trabalhar.
   A inscrição cai no CRM (funil Aula ao vivo) e leva a pessoa ao WhatsApp da IA News; os lembretes saem do CRM. */

const PAGE_URL = "https://ianewsbr.com/aula";
const DESCRIPTION = `Aula ao vivo e gratuita da IA News: "${AULA.titulo}". ${AULA.dataCurta}, às ${AULA.hora}, ${AULA.duracao} com casos reais.`;

export const Route = createFileRoute("/aula")({
  head: () => ({
    meta: [
      { title: `Aula ao vivo · ${AULA.titulo} | IA News` },
      { name: "description", content: DESCRIPTION },
      { property: "og:title", content: `Aula ao vivo IA News · ${AULA.dataCurta}, ${AULA.hora}` },
      { property: "og:description", content: DESCRIPTION },
      { property: "og:url", content: PAGE_URL },
      { name: "twitter:card", content: "summary_large_image" },
    ],
    links: [{ rel: "canonical", href: PAGE_URL }],
  }),
  component: AulaPage,
});

const IMG = (id: number, w: number) =>
  `https://images.pexels.com/photos/${id}/pexels-photo-${id}.jpeg?auto=compress&cs=tinysrgb&w=${w}`;

const INICIO = new Date(AULA.inicio).getTime();

const FACTS = [
  { label: "Quando", value: `${AULA.dataCurta} · ${AULA.hora} (Brasília)` },
  { label: "Duração", value: AULA.duracao },
  { label: "Onde", value: AULA.onde },
];

const LEVA = [
  { t: "Casos reais, com números", d: "Dois empresários mostram onde a IA entrou na venda, quanto custou e o que mudou." },
  { t: "O que copiar na segunda-feira", d: "Cada caso termina com o passo que você pode aplicar na sua empresa." },
  { t: "Perguntas ao vivo", d: "Os últimos 15 minutos são para as suas perguntas." },
];

function AulaPage() {
  const f = useInscricao("aula");
  const [left, setLeft] = useState<{ d: number; h: number; m: number } | null>(null);

  useEffect(() => {
    const tick = () => {
      const ms = Math.max(0, INICIO - Date.now());
      setLeft({ d: Math.floor(ms / 864e5), h: Math.floor((ms % 864e5) / 36e5), m: Math.floor((ms % 36e5) / 6e4) });
    };
    tick();
    const t = window.setInterval(tick, 30000);
    return () => window.clearInterval(t);
  }, []);

  // Depois da inscrição, leva ao WhatsApp da IA News (no celular, abre o app sozinho)
  useEffect(() => {
    if (!f.feito || f.feito.already) return;
    if (!/mobi|android|iphone|ipad/i.test(navigator.userAgent)) return;
    const t = window.setTimeout(() => window.location.assign(CANAL_URL), 1800);
    return () => window.clearTimeout(t);
  }, [f.feito]);

  return (
    <>
      <SiteHeader />
      <main id="main" className="pc2">
        <section className="pc2-hero" style={{ backgroundImage: `url(${IMG(29335353, 1600)})` }}>
          <div className="pc2-shade" aria-hidden="true" />
          <div className="wrap pc2-hero-grid">
            <div className="pc2-hero-copy">
              <p className="pc2-kick">Aula ao vivo nº {AULA.numero} · IA News</p>
              <h1 className="ins-h1-longo">
                {AULA.titulo}
                <span>Quem faz, ensina.</span>
              </h1>
              <p className="pc2-sub">
                {AULA.duracao} ao vivo com empresários que já colocaram IA para vender. Gratuita, online e sem enrolação.
              </p>
              <ul className="pc2-facts">
                {FACTS.map((x) => (
                  <li key={x.label}>
                    <small>{x.label}</small>
                    <b>{x.value}</b>
                  </li>
                ))}
              </ul>
              {left && INICIO > Date.now() ? (
                <div className="pc2-count" aria-label="Contagem regressiva para a aula">
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
            </div>

            <div className="pc2-form" id="inscricao">
              <div className="pc2-form-head">
                <span className="pc2-badge">Gratuita · vagas limitadas na sala</span>
                <h2>Garanta sua vaga</h2>
                <p>O link chega pelo WhatsApp 1 hora antes.</p>
              </div>
              <div className="biz-card pt-card-form">
                {f.feito ? (
                  <Pronto titulo={f.feito.already ? "Você já estava inscrito" : "Vaga garantida!"} canal={false}>
                    <p>
                      {`Pronto${f.feito.nome ? `, ${f.feito.nome}` : ""}. A aula é ${AULA.dataLonga}, às ${AULA.hora}. Entre no WhatsApp da IA News para receber o link e os lembretes.`}
                    </p>
                    <div className="actions">
                      <a className="btn blue" href={CANAL_URL} target="_blank" rel="noopener noreferrer">
                        Abrir o WhatsApp da IA News
                      </a>
                    </div>
                  </Pronto>
                ) : (
                  <form className="biz-form" onSubmit={(e) => f.enviar(e)} noValidate>
                    <Isca f={f} />
                    <fieldset>
                      <legend className="pc2-sr">Seus dados</legend>
                      <div className="biz-fields">
                        <Campo f={f} k="nome" rotulo="Nome completo" autoComplete="name" maxLength={160} placeholder="Seu nome" cheio />
                        <Campo f={f} k="whatsapp" rotulo="WhatsApp" type="tel" inputMode="tel" autoComplete="tel-national" maxLength={16} placeholder="(00) 00000-0000" />
                        <Campo f={f} k="email" rotulo="E-mail" type="email" inputMode="email" autoComplete="email" maxLength={254} placeholder="voce@empresa.com.br" />
                        <Campo f={f} k="empresa" rotulo="Empresa" opcional autoComplete="organization" maxLength={160} placeholder="Nome da empresa" cheio />
                      </div>
                    </fieldset>
                    <Pilulas f={f} k="perfil" legenda="Você é" opcoes={PERFIS} />
                    <Aceite f={f} texto="Aceito receber o link, os lembretes e as novidades da IA News por WhatsApp e e-mail." />
                    <Enviar f={f} rotulo="Quero minha vaga" fino="Gratuita. Ao enviar, abrimos o WhatsApp da IA News." />
                  </form>
                )}
              </div>
            </div>
          </div>
        </section>

        <div className="wrap">
          <section className="pc2-sec" aria-labelledby="a-leva">
            <p className="pc2-eyebrow">O que você leva</p>
            <h2 id="a-leva" className="pc2-h2">
              Uma hora para sair com um próximo passo.
            </h2>
            <div className="ins-grid">
              {LEVA.map((c) => (
                <article key={c.t} className="ins-tile">
                  <h3>{c.t}</h3>
                  <p>{c.d}</p>
                </article>
              ))}
            </div>
            <p className="pc2-note">Os nomes de quem dá a aula saem nesta página e no canal da IA News antes do dia.</p>
          </section>

          <section className="pc2-sec pc2-who" aria-labelledby="a-quem">
            <img src={IMG(3143850, 1000)} alt="" loading="lazy" width={1000} height={1500} />
            <div>
              <p className="pc2-eyebrow">Para quem é</p>
              <h2 id="a-quem" className="pc2-h2">
                Para quem tem negócio e quer ver a IA vendendo.
              </h2>
              <ul className="pc2-list">
                <li>
                  <b>Empresários</b> que querem IA nas vendas e no atendimento.
                </li>
                <li>
                  <b>Fornecedores de IA</b> que querem ver o que funciona na ponta.
                </li>
                <li>
                  <b>Times comerciais</b> que precisam vender mais com a mesma equipe.
                </li>
              </ul>
              <a className="btn blue" href="#inscricao">
                Quero minha vaga
              </a>
            </div>
          </section>

          <section className="pc2-sec" aria-labelledby="a-faq">
            <p className="pc2-eyebrow">Dúvidas</p>
            <h2 id="a-faq" className="pc2-h2">
              Perguntas frequentes
            </h2>
            <div className="faq">
              <details>
                <summary>É gratuita mesmo?</summary>
                <p>Sim. A Aula ao vivo é aberta e gratuita; só pedimos a inscrição para mandar o link.</p>
              </details>
              <details>
                <summary>Vai ter gravação?</summary>
                <p>Quem se inscreve recebe o replay pelo WhatsApp no dia seguinte.</p>
              </details>
              <details>
                <summary>Outro assunto?</summary>
                <p>
                  Escreva para <a href={`mailto:${CONTATO}`}>{CONTATO}</a>.
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
