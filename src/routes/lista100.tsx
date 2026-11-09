import { createFileRoute, Link } from "@tanstack/react-router";

import { SiteHeader } from "@/components/site/header";
import { SiteFooter } from "@/components/site/footer";
import {
  Aceite,
  Campo,
  Enviar,
  Escolha,
  Indicados,
  Isca,
  Pronto,
  Texto,
  useInscricao,
} from "@/components/site/inscricao-form";
import { CATEGORIAS_LISTA, CONTATO, LISTA, MAX } from "@/lib/inscricao";

/* Lista IA News 100 · Quem faz IA no Brasil. Candidatura e indicação gratuitas; a escolha é da redação e do júri.
   O envio vai para /api/public/inscricao e cai no CRM (funil Lista IA News 100). */

const PAGE_URL = "https://ianewsbr.com/lista100";
const TITLE = "Lista IA News 100 · Quem faz IA no Brasil | IA News";
const DESCRIPTION =
  "Os 100 nomes que estão fazendo IA de verdade nos negócios no Brasil. Candidaturas e indicações gratuitas até 07/12. Anúncio no Palco IA News, em 16/12.";

export const Route = createFileRoute("/lista100")({
  head: () => ({
    meta: [
      { title: TITLE },
      { name: "description", content: DESCRIPTION },
      { property: "og:title", content: "Lista IA News 100 · Quem faz IA no Brasil" },
      { property: "og:description", content: DESCRIPTION },
      { property: "og:type", content: "website" },
      { property: "og:url", content: PAGE_URL },
      { name: "twitter:card", content: "summary_large_image" },
    ],
    links: [{ rel: "canonical", href: PAGE_URL }],
  }),
  component: Lista100Page,
});

const IMG = (id: number, w: number) =>
  `https://images.pexels.com/photos/${id}/pexels-photo-${id}.jpeg?auto=compress&cs=tinysrgb&w=${w}`;

const FACTS = [
  { label: "Inscrições", value: `Até ${LISTA.fecha}` },
  { label: "Anúncio", value: `${LISTA.anuncio}, no Palco IA News` },
  { label: "Custo", value: "Nenhum, em nenhuma etapa" },
];

const PASSOS = [
  { n: "1", t: "Candidatura ou indicação", d: `Qualquer pessoa pode se candidatar ou indicar alguém até ${LISTA.fecha}.` },
  { n: "2", t: "Avaliação", d: `A redação e o júri leem cada caso de ${LISTA.avaliacao}. Vale o que a IA já entrega, com resultado.` },
  { n: "3", t: "Aviso", d: "Os escolhidos recebem o aviso antes, em sigilo, com o convite para o Palco." },
  { n: "4", t: "Anúncio", d: `A lista sai no Palco IA News, em ${LISTA.anuncio}, em Belo Horizonte, e no dia seguinte no site.` },
];

const FAQ = [
  { q: "Quanto custa para entrar?", a: "Nada. A Lista IA News 100 é editorial: ninguém paga para se candidatar, ser indicado ou ser escolhido." },
  { q: "Posso me candidatar e indicar outras pessoas?", a: "Sim. No fim da candidatura há o campo \"indique alguém\". Você também pode só indicar, sem se candidatar." },
  { q: "Preciso ser de uma empresa grande?", a: "Não. Contam o caso e o resultado, não o tamanho da empresa." },
  { q: "Meu caso fica público?", a: "Só se você for escolhido, e só o que você autorizar. Números sensíveis podem ir como percentual." },
];

function Lista100Page() {
  const f = useInscricao("lista100");
  const candidato = f.form.tipo === "lista100";

  return (
    <>
      <SiteHeader />
      <main id="main" className="pc2">
        <section className="pc2-hero" style={{ backgroundImage: `url(${IMG(7648057, 1600)})` }}>
          <div className="pc2-shade" aria-hidden="true" />
          <div className="wrap pc2-hero-grid">
            <div className="pc2-hero-copy">
              <p className="pc2-kick">IA News · Edição 2026</p>
              <h1>
                Lista IA News 100
                <span>Quem faz IA no Brasil.</span>
              </h1>
              <p className="pc2-sub">
                Os 100 nomes que estão colocando IA para trabalhar de verdade nos negócios brasileiros. Escolhidos pela redação e
                por um júri do ecossistema, pelo caso e pelo resultado.
              </p>
              <ul className="pc2-facts">
                {FACTS.map((x) => (
                  <li key={x.label}>
                    <small>{x.label}</small>
                    <b>{x.value}</b>
                  </li>
                ))}
              </ul>
              <Link className="pc2-link" to="/lista100/criterios">
                Ver critérios, categorias e júri →
              </Link>
            </div>

            <div className="pc2-form" id="candidatura">
              <div className="pc2-form-head">
                <span className="pc2-badge">Gratuita · até {LISTA.fecha}</span>
                <h2>{candidato ? "Candidate-se" : "Indique quem merece"}</h2>
                <p>{candidato ? "Conte o seu caso de IA. Leva 3 minutos." : "Indique até 5 pessoas. A gente convida e conta que foi você."}</p>
              </div>
              <div className="ins-modo" role="tablist" aria-label="O que você quer fazer">
                <button
                  type="button"
                  role="tab"
                  aria-selected={candidato}
                  className={candidato ? "on" : undefined}
                  onClick={() => f.set("tipo", "lista100")}
                >
                  Quero me candidatar
                </button>
                <button
                  type="button"
                  role="tab"
                  aria-selected={!candidato}
                  className={!candidato ? "on" : undefined}
                  onClick={() => f.set("tipo", "indicacao")}
                >
                  Quero indicar alguém
                </button>
              </div>
              <div className="biz-card pt-card-form">
                {f.feito ? (
                  <Pronto titulo={f.feito.already ? "Sua candidatura já estava com a gente" : candidato ? "Candidatura recebida!" : "Indicação recebida!"}>
                    <p>
                      {candidato
                        ? `Pronto${f.feito.nome ? `, ${f.feito.nome}` : ""}. O júri avalia de ${LISTA.avaliacao}, e os escolhidos recebem o aviso antes do anúncio de ${LISTA.anuncio}. A confirmação foi para o seu e-mail.`
                        : `Obrigada${f.feito.nome ? `, ${f.feito.nome}` : ""}. Vamos convidar cada pessoa e contar que foi você quem indicou.`}
                    </p>
                  </Pronto>
                ) : (
                  <form className="biz-form" onSubmit={(e) => f.enviar(e)} noValidate>
                    <Isca f={f} />
                    <fieldset>
                      <legend className="pc2-sr">Seus dados</legend>
                      <div className="biz-fields">
                        <Campo f={f} k="nome" rotulo="Nome completo" autoComplete="name" maxLength={160} placeholder="Seu nome" cheio />
                        <Campo
                          f={f}
                          k="empresa"
                          rotulo="Empresa"
                          opcional={!candidato}
                          autoComplete="organization"
                          maxLength={160}
                          placeholder="Nome da empresa"
                        />
                        {candidato ? (
                          <Campo f={f} k="cargo" rotulo="Cargo" opcional autoComplete="organization-title" maxLength={120} placeholder="Fundador, CEO..." />
                        ) : null}
                        <Campo f={f} k="whatsapp" rotulo="WhatsApp" type="tel" inputMode="tel" autoComplete="tel-national" maxLength={16} placeholder="(00) 00000-0000" />
                        <Campo f={f} k="email" rotulo="E-mail" type="email" inputMode="email" autoComplete="email" maxLength={254} placeholder="voce@empresa.com.br" />
                        {candidato ? (
                          <Campo f={f} k="instagram" rotulo="Instagram" opcional maxLength={120} placeholder="@perfil" />
                        ) : null}
                      </div>
                    </fieldset>

                    {candidato ? (
                      <fieldset>
                        <legend className="pc2-legend">O seu caso de IA</legend>
                        <div className="biz-fields">
                          <Escolha f={f} k="categoria" rotulo="Categoria" opcoes={CATEGORIAS_LISTA} />
                          <div className="f ins-vazio" aria-hidden="true" />
                          <Texto
                            f={f}
                            k="caso"
                            rotulo="O que a IA faz no seu negócio (ou no do seu cliente)?"
                            max={MAX.caso}
                            linhas={4}
                            placeholder="Ex.: um agente no WhatsApp atende e agenda as consultas da clínica fora do horário, ligado à agenda dos médicos."
                          />
                          <Texto
                            f={f}
                            k="resultado"
                            rotulo="Qual foi o resultado?"
                            dica="De preferência com um número: tempo, dinheiro, vendas, clientes."
                            max={MAX.resultado}
                            linhas={2}
                            placeholder="Ex.: 38% mais consultas marcadas em 3 meses."
                          />
                        </div>
                      </fieldset>
                    ) : null}

                    {candidato ? (
                      <details className="pc2-more" open={f.form.indicados.some((i) => i.nome || i.contato)}>
                        <summary>
                          Conhece alguém que também deveria estar na lista? <small>opcional</small>
                        </summary>
                        <Indicados f={f} titulo={<span className="pc2-sr">Pessoas indicadas</span>} />
                      </details>
                    ) : (
                      <Indicados f={f} titulo="Quem você indica" minimo={1} />
                    )}

                    <Aceite f={f} texto="Aceito receber o resultado da Lista e as novidades da IA News por WhatsApp e e-mail." />
                    <Enviar f={f} rotulo={candidato ? "Enviar candidatura" : "Enviar indicação"} fino="Gratuito. Não se paga nada para entrar na lista." />
                  </form>
                )}
              </div>
            </div>
          </div>
        </section>

        <div className="wrap">
          <section className="pc2-sec" aria-labelledby="l-como">
            <p className="pc2-eyebrow">Como funciona</p>
            <h2 id="l-como" className="pc2-h2">
              Quatro passos, do caso ao palco.
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

          <section className="pc2-sec" aria-labelledby="l-cat">
            <p className="pc2-eyebrow">Categorias</p>
            <h2 id="l-cat" className="pc2-h2">
              Cinco formas de fazer IA acontecer.
            </h2>
            <div className="ins-grid">
              {CATEGORIAS_LISTA.map((c) => (
                <article key={c.value} className="ins-tile">
                  <h3>{c.label}</h3>
                  <p>{c.hint}</p>
                </article>
              ))}
            </div>
            <p className="pc2-note">
              Critérios completos, júri e datas em <Link to="/lista100/criterios">ianewsbr.com/lista100/criterios</Link>.
            </p>
          </section>

          <section className="pc2-sec" aria-labelledby="l-faq">
            <p className="pc2-eyebrow">Dúvidas</p>
            <h2 id="l-faq" className="pc2-h2">
              Perguntas frequentes
            </h2>
            <div className="faq">
              {FAQ.map((x) => (
                <details key={x.q}>
                  <summary>{x.q}</summary>
                  <p>{x.a}</p>
                </details>
              ))}
              <details>
                <summary>Outro assunto?</summary>
                <p>
                  Escreva para <a href={`mailto:${CONTATO}`}>{CONTATO}</a>.
                </p>
              </details>
            </div>
          </section>
        </div>

        <section className="pc2-final" style={{ backgroundImage: `url(${IMG(9275222, 1600)})` }}>
          <div className="pc2-shade" aria-hidden="true" />
          <div className="wrap pc2-final-in">
            <h2>Quem faz IA no Brasil merece ser visto.</h2>
            <p>Candidaturas e indicações gratuitas até {LISTA.fecha}.</p>
            <a className="btn blue pc2-submit" href="#candidatura">
              Candidatar ou indicar
            </a>
          </div>
        </section>
      </main>
      <SiteFooter />
    </>
  );
}
