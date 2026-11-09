import { createFileRoute } from "@tanstack/react-router";
import { useEffect } from "react";

import { SiteHeader } from "@/components/site/header";
import { SiteFooter } from "@/components/site/footer";
import { Aceite, Campo, Enviar, Escolha, Isca, Pronto, Texto, useInscricao } from "@/components/site/inscricao-form";
import { CONTATO, INVESTIMENTOS, MAX, PORTES, PRAZOS, SETORES } from "@/lib/inscricao";

/* Balcão de Projetos IA News: o empresário conta o que quer resolver com IA; a IA News conversa, escreve o escopo e
   apresenta 2 ou 3 especialistas. Gratuito para quem pede. Cai no CRM (funil Implementação, etapa Lead). */

const PAGE_URL = "https://ianewsbr.com/projetos";
const DESCRIPTION =
  "Quer colocar IA para trabalhar na sua empresa? Conte o que você quer resolver: a IA News escreve o escopo e apresenta especialistas que já fizeram projetos parecidos. Sem custo para você.";

type Busca = { materia?: string };

export const Route = createFileRoute("/projetos")({
  validateSearch: (s: Record<string, unknown>): Busca => ({
    materia: typeof s.materia === "string" ? s.materia.slice(0, 200) : undefined,
  }),
  head: () => ({
    meta: [
      { title: "Balcão de Projetos · IA na sua empresa | IA News" },
      { name: "description", content: DESCRIPTION },
      { property: "og:title", content: "Quer fazer isso na sua empresa? · IA News" },
      { property: "og:description", content: DESCRIPTION },
      { property: "og:url", content: PAGE_URL },
    ],
    links: [{ rel: "canonical", href: PAGE_URL }],
  }),
  component: ProjetosPage,
});

const IMG = (id: number, w: number) =>
  `https://images.pexels.com/photos/${id}/pexels-photo-${id}.jpeg?auto=compress&cs=tinysrgb&w=${w}`;

const PASSOS = [
  { n: "1", t: "Você conta o problema", d: "Em 2 minutos, aqui mesmo: o que quer resolver, o tamanho da empresa e o prazo." },
  { n: "2", t: "Conversa de 20 minutos", d: "Alguém da IA News te chama pelo WhatsApp em até 1 dia útil para entender o contexto." },
  { n: "3", t: "Escopo escrito", d: "Transformamos a conversa num pedido claro, que qualquer especialista entende." },
  { n: "4", t: "2 ou 3 especialistas", d: "Apresentamos quem já fez projetos parecidos. Você escolhe com quem seguir, ou não segue." },
];

function ProjetosPage() {
  const { materia } = Route.useSearch();
  const f = useInscricao("projeto");
  const { set } = f;

  useEffect(() => {
    if (materia) set("materia", materia);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [materia]);

  return (
    <>
      <SiteHeader />
      <main id="main" className="pc2">
        <section className="pc2-hero" style={{ backgroundImage: `url(${IMG(3143850, 1600)})` }}>
          <div className="pc2-shade" aria-hidden="true" />
          <div className="wrap pc2-hero-grid">
            <div className="pc2-hero-copy">
              <p className="pc2-kick">Balcão de Projetos · IA News</p>
              <h1>
                Quer fazer isso na sua empresa?
                <span>A gente encontra quem faz.</span>
              </h1>
              <p className="pc2-sub">
                Conte o que você quer resolver com IA. A IA News escreve o escopo com você e apresenta especialistas que já fizeram
                projetos parecidos. Para você, não tem custo.
              </p>
              <ul className="pc2-facts">
                <li>
                  <small>Resposta</small>
                  <b>Em até 1 dia útil</b>
                </li>
                <li>
                  <small>Especialistas</small>
                  <b>2 ou 3, com casos reais</b>
                </li>
                <li>
                  <small>Custo para você</small>
                  <b>Nenhum</b>
                </li>
              </ul>
            </div>

            <div className="pc2-form" id="pedido">
              <div className="pc2-form-head">
                <span className="pc2-badge">Gratuito para empresas</span>
                <h2>Conte o seu projeto</h2>
                <p>Leva 2 minutos. Ninguém recebe seus dados sem você aceitar.</p>
              </div>
              <div className="biz-card pt-card-form">
                {f.feito ? (
                  <Pronto titulo="Pedido recebido!">
                    <p>{`Obrigada${f.feito.nome ? `, ${f.feito.nome}` : ""}. Em até 1 dia útil alguém da IA News te chama pelo WhatsApp para a conversa de 20 minutos.`}</p>
                  </Pronto>
                ) : (
                  <form className="biz-form" onSubmit={(e) => f.enviar(e)} noValidate>
                    <Isca f={f} />
                    <div className="biz-fields">
                      <Texto
                        f={f}
                        k="problema"
                        rotulo="O que você quer resolver com IA?"
                        max={MAX.problema}
                        linhas={4}
                        placeholder="Ex.: perdemos clientes porque demoramos a responder no WhatsApp à noite e no fim de semana."
                      />
                      <Escolha f={f} k="setor" rotulo="Setor" opcoes={SETORES} opcional />
                      <Escolha f={f} k="porte" rotulo="Pessoas na empresa" opcoes={PORTES} />
                      <Escolha f={f} k="prazo" rotulo="Quando quer começar" opcoes={PRAZOS} />
                      <Escolha f={f} k="investimento" rotulo="Investimento previsto" opcoes={INVESTIMENTOS} opcional />
                    </div>
                    <fieldset>
                      <legend className="pc2-legend">Seus dados</legend>
                      <div className="biz-fields">
                        <Campo f={f} k="nome" rotulo="Nome completo" autoComplete="name" maxLength={160} placeholder="Seu nome" cheio />
                        <Campo f={f} k="empresa" rotulo="Empresa" autoComplete="organization" maxLength={160} placeholder="Nome da empresa" />
                        <Campo f={f} k="cargo" rotulo="Cargo" opcional autoComplete="organization-title" maxLength={120} placeholder="Sócio, diretor..." />
                        <Campo f={f} k="whatsapp" rotulo="WhatsApp" type="tel" inputMode="tel" autoComplete="tel-national" maxLength={16} placeholder="(00) 00000-0000" />
                        <Campo f={f} k="email" rotulo="E-mail" type="email" inputMode="email" autoComplete="email" maxLength={254} placeholder="voce@empresa.com.br" />
                      </div>
                    </fieldset>
                    <Aceite f={f} texto="Aceito que a IA News fale comigo por WhatsApp e e-mail e apresente especialistas para o meu projeto." />
                    <Enviar f={f} rotulo="Enviar meu projeto" fino="Sem custo e sem compromisso." />
                  </form>
                )}
              </div>
            </div>
          </div>
        </section>

        <div className="wrap">
          <section className="pc2-sec" aria-labelledby="p-como">
            <p className="pc2-eyebrow">Como funciona</p>
            <h2 id="p-como" className="pc2-h2">
              Do problema ao especialista certo.
            </h2>
            <ol className="ins-passos">
              {PASSOS.map((p) => (
                <li key={p.n}>
                  <span>{p.n}</span>
                  <b>{p.t}</b>
                  <p>{p.d}</p>
                </li>
              ))}
            </ol>
          </section>

          <section className="pc2-sec" aria-labelledby="p-faq">
            <p className="pc2-eyebrow">Dúvidas</p>
            <h2 id="p-faq" className="pc2-h2">
              Perguntas frequentes
            </h2>
            <div className="faq">
              <details>
                <summary>Quanto custa?</summary>
                <p>Para a sua empresa, nada. Os especialistas são parceiros da IA News; o projeto você combina direto com quem escolher.</p>
              </details>
              <details>
                <summary>Quem são os especialistas?</summary>
                <p>Empresas e profissionais que já colocaram IA para funcionar em outros clientes, muitos deles com casos publicados na IA News.</p>
              </details>
              <details>
                <summary>Sou obrigado a contratar?</summary>
                <p>Não. Você recebe as apresentações e decide se segue, com quem e quando.</p>
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
