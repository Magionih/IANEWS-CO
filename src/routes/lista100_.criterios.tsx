import { createFileRoute, Link } from "@tanstack/react-router";

import { SiteHeader } from "@/components/site/header";
import { SiteFooter } from "@/components/site/footer";
import { CATEGORIAS_LISTA, CONTATO, LISTA } from "@/lib/inscricao";

/* Regras da Lista IA News 100: critérios, categorias, júri e datas. É o que sustenta a credibilidade do selo. */

const PAGE_URL = "https://ianewsbr.com/lista100/criterios";
const DESCRIPTION =
  "Como a Lista IA News 100 é escolhida: critérios, categorias, júri, datas e o compromisso de que ninguém paga para entrar.";

/** Júri convidado. Preencher quando os nomes estiverem confirmados; enquanto vazio, a página diz quando saem. */
const JURI: { nome: string; papel: string }[] = [];

export const Route = createFileRoute("/lista100_/criterios")({
  head: () => ({
    meta: [
      { title: "Critérios da Lista IA News 100 | IA News" },
      { name: "description", content: DESCRIPTION },
      { property: "og:title", content: "Como a Lista IA News 100 é escolhida" },
      { property: "og:description", content: DESCRIPTION },
      { property: "og:url", content: PAGE_URL },
    ],
    links: [{ rel: "canonical", href: PAGE_URL }],
  }),
  component: CriteriosPage,
});

const CRITERIOS = [
  { t: "IA em operação", d: "A IA já roda no dia a dia de uma empresa, sua ou de um cliente. Projeto em teste ou ideia não entram." },
  { t: "Resultado que se mede", d: "Tempo, dinheiro, vendas, clientes ou qualidade. Um número vale mais que um adjetivo; percentual serve." },
  { t: "Feito no Brasil", d: "A operação, o cliente ou a equipe estão no Brasil." },
  { t: "Caso que se pode contar", d: "O escolhido autoriza a IA News a contar o caso, nos limites que ele definir." },
  { t: "Diversidade de setores", d: "O júri busca a lista mais representativa: saúde, varejo, serviços, indústria, agro, educação e outros." },
];

const DATAS = [
  { d: "Até 07/12", t: "Candidaturas e indicações abertas" },
  { d: LISTA.avaliacao, t: "Avaliação da redação e do júri" },
  { d: "Até 12/12", t: "Aviso aos escolhidos, em sigilo" },
  { d: LISTA.anuncio, t: "Anúncio no Palco IA News, em Belo Horizonte" },
  { d: "17/12", t: "Matéria especial no site e posts com cada escolhido" },
];

function CriteriosPage() {
  return (
    <>
      <SiteHeader />
      <main id="main" className="wrap ins-doc">
        <p className="pc2-eyebrow">Lista IA News 100 · Regras da edição 2026</p>
        <h1 className="pc2-h2">Como a Lista IA News 100 é escolhida</h1>
        <p className="ins-lead">
          A Lista IA News 100 reúne os 100 nomes que estão colocando IA para trabalhar de verdade nos negócios no Brasil. A escolha é
          editorial: <b>ninguém paga para se candidatar, ser indicado ou ser escolhido</b>, e patrocínio não compra lugar.
        </p>

        <section aria-labelledby="c-crit">
          <h2 id="c-crit">Critérios</h2>
          <ol className="ins-crit">
            {CRITERIOS.map((c) => (
              <li key={c.t}>
                <b>{c.t}.</b> {c.d}
              </li>
            ))}
          </ol>
        </section>

        <section aria-labelledby="c-cat">
          <h2 id="c-cat">Categorias</h2>
          <div className="ins-grid">
            {CATEGORIAS_LISTA.map((c) => (
              <article key={c.value} className="ins-tile">
                <h3>{c.label}</h3>
                <p>{c.hint}</p>
              </article>
            ))}
          </div>
          <p className="pc2-note">A divisão de vagas entre as categorias é decidida pelo júri a partir das candidaturas recebidas.</p>
        </section>

        <section aria-labelledby="c-juri">
          <h2 id="c-juri">Júri</h2>
          <p>
            A redação da IA News faz a primeira leitura de todas as candidaturas. A escolha final é de um júri com convidados do
            ecossistema de IA e de negócios: empreendedores, investidores e executivos sem candidatura própria na edição.
          </p>
          {JURI.length ? (
            <ul className="ins-juri">
              {JURI.map((j) => (
                <li key={j.nome}>
                  <b>{j.nome}</b>
                  <span>{j.papel}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="pc2-note">Os nomes do júri são publicados nesta página assim que todos confirmarem.</p>
          )}
          <p>Quem é jurado não avalia candidaturas da própria empresa, de sócios ou de clientes.</p>
        </section>

        <section aria-labelledby="c-datas">
          <h2 id="c-datas">Datas</h2>
          <ul className="ins-datas">
            {DATAS.map((x) => (
              <li key={x.t}>
                <time>{x.d}</time>
                <span>{x.t}</span>
              </li>
            ))}
          </ul>
        </section>

        <section aria-labelledby="c-comp">
          <h2 id="c-comp">Compromissos da IA News</h2>
          <ul className="pc2-list">
            <li>
              <b>Independência:</b> nenhum pagamento, patrocínio ou relação comercial com a IA News dá vantagem na escolha.
            </li>
            <li>
              <b>Privacidade:</b> as candidaturas são lidas só pela redação e pelo júri. Só o caso dos escolhidos é publicado, com
              autorização.
            </li>
            <li>
              <b>Transparência:</b> patrocinadores podem dar nome a uma categoria, mas não indicam nem escolhem ninguém.
            </li>
          </ul>
        </section>

        <div className="ins-cta">
          <Link className="btn blue" to="/lista100">
            Candidatar ou indicar
          </Link>
          <span>
            Dúvidas: <a href={`mailto:${CONTATO}`}>{CONTATO}</a>
          </span>
        </div>
      </main>
      <SiteFooter />
    </>
  );
}
