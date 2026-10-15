import { createFileRoute, Link } from "@tanstack/react-router";

import { SiteHeader } from "@/components/site/header";
import { SiteFooter } from "@/components/site/footer";

export const Route = createFileRoute("/sobre")({
  head: () => ({
    meta: [
      { title: "Sobre o IA News — quem somos e política editorial" },
      {
        name: "description",
        content:
          "Quem produz o IA News, como apuramos e escrevemos cada matéria de inteligência artificial, uso de IA na redação, atribuição de fontes e política de correções.",
      },
      { property: "og:title", content: "Sobre o IA News — quem somos e política editorial" },
      {
        property: "og:description",
        content:
          "Metodologia editorial do IA News: apuração, análise própria, atribuição de fontes, uso de IA na redação e política de correções.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      { property: "og:url", content: "https://ianewsbr.com/sobre" },
    ],
    links: [{ rel: "canonical", href: "https://ianewsbr.com/sobre" }],
  }),
  component: SobrePage,
});

const SECTIONS: { id: string; title: string; body: string[] }[] = [
  {
    id: "quem-somos",
    title: "Quem somos",
    body: [
      "O IA News é uma publicação brasileira independente dedicada a cobrir inteligência artificial com foco em decisão de negócio. Nascemos da constatação de que a maior parte do noticiário de IA é ou técnica demais para quem decide, ou superficial demais para quem executa.",
      "Nossa audiência é formada por fundadores, executivos, gestores de produto e profissionais que precisam entender o impacto prático da IA — em custo, produtividade, regulação e competição — sem gastar horas garimpando fontes em inglês.",
      "Publicamos matérias diárias, análises editoriais, o Ranking IA (avaliação comparativa de ferramentas) e uma edição diária por e-mail.",
    ],
  },
  {
    id: "metodologia",
    title: "Como produzimos cada matéria",
    body: [
      "1. Monitoramento: acompanhamos anúncios oficiais de empresas, publicações acadêmicas, órgãos reguladores e veículos especializados brasileiros e internacionais.",
      "2. Apuração e verificação: cada fato relevante é conferido na fonte primária (comunicado oficial, documento, paper ou registro público). Quando não há confirmação primária, dizemos isso no texto.",
      "3. Redação original: nenhuma matéria é republicação. Escrevemos texto próprio, com contexto histórico, números comparativos e explicação dos termos técnicos.",
      "4. Camada de análise: toda matéria inclui uma leitura própria da redação — o que muda, para quem, e quais são as implicações práticas para empresas brasileiras.",
      "5. Atribuição: quando partimos de uma informação divulgada por outro veículo ou pela própria empresa, indicamos a fonte com link direto ao final da matéria.",
    ],
  },
  {
    id: "valor-original",
    title: "O que agregamos ao que já existe",
    body: [
      "Contexto para o mercado brasileiro: traduzimos anúncios globais em consequências para operações, contratos, custos e conformidade no Brasil.",
      "Análise editorial assinada: seções como 'Por que isso importa' e 'A leitura da nossa redação' são interpretação própria, não presentes na fonte original.",
      "Comparações e rankings próprios: o Ranking IA combina avaliação editorial, menções recentes e notas de leitores registrados.",
      "Se uma notícia não permite acrescentar análise, contexto ou verificação própria, ela simplesmente não é publicada.",
    ],
  },
  {
    id: "uso-de-ia",
    title: "Uso de inteligência artificial na redação",
    body: [
      "Usamos ferramentas de IA como apoio para triagem de pautas, organização de dados e primeira versão de estruturas de texto.",
      "Nenhum conteúdo é publicado sem revisão humana editorial: verificação dos fatos, checagem das fontes, ajuste de linguagem e validação da análise.",
      "A responsabilidade editorial por todo o conteúdo publicado é da redação do IA News.",
    ],
  },
  {
    id: "imagens",
    title: "Imagens e direitos",
    body: [
      "Usamos imagens licenciadas para uso editorial, material de imprensa fornecido pelas próprias empresas ou imagens ilustrativas devidamente identificadas como tal na legenda.",
      "Não publicamos fotografias de terceiros sem licença ou autorização. Se você identificar um uso indevido, escreva pela página de Contato e removemos ou creditamos em até 48 horas.",
    ],
  },
  {
    id: "correcoes",
    title: "Política de correções",
    body: [
      "Erros acontecem. Quando um dado publicado estiver incorreto, corrigimos o texto e registramos a correção no fim da matéria, com data.",
      "Pedidos de correção, direito de resposta ou remoção podem ser enviados pela página de Contato e são respondidos em até 3 dias úteis.",
    ],
  },
  {
    id: "publicidade",
    title: "Publicidade e independência editorial",
    body: [
      "O IA News não utiliza publicidade programática. Propostas de parcerias comerciais podem ser enviadas pela página Anuncie.",
      "Anunciantes não têm influência sobre a pauta, o texto ou o Ranking IA. Todo conteúdo patrocinado, quando existir, é identificado de forma clara como 'Publicidade' ou 'Conteúdo patrocinado'.",
      "Eventuais ações comerciais são separadas do conteúdo editorial e identificadas com transparência.",
    ],
  },
];

function SobrePage() {
  return (
    <>
      <SiteHeader />
      <main id="main" className="page">
        <div className="wrap">
          <div className="page-head">
            <p className="kick">Sobre</p>
            <h1>Quem somos e como o IA News é feito</h1>
            <p className="sub">
              Transparência editorial: nossa metodologia de apuração, o uso de IA na redação,
              atribuição de fontes, correções e a relação com a publicidade.
            </p>
          </div>

          <div className="two-col">
            <div className="prose">
              {SECTIONS.map((s, i) => (
                <section key={s.id} id={s.id} style={{ scrollMarginTop: 96 }}>
                  <h2 style={i === 0 ? { marginTop: 0 } : undefined}>{s.title}</h2>
                  {s.body.map((p) => (
                    <p key={p}>{p}</p>
                  ))}
                </section>
              ))}

              <div className="note-box" style={{ marginTop: 32 }}>
                <h3>Fale com a redação</h3>
                <p>
                  Pautas, correções, direito de resposta e propostas comerciais:{" "}
                  <Link to="/contato">página de Contato</Link>. Regras de uso e tratamento de dados
                  na página de <Link to="/termos">Termos &amp; Privacidade</Link>.
                </p>
              </div>
            </div>

            <nav aria-label="Índice" className="panel-form" style={{ position: "sticky", top: 96 }}>
              <h3>Nesta página</h3>
              <ul className="plain" style={{ marginTop: 0 }}>
                {SECTIONS.map((s) => (
                  <li key={s.id}>
                    <a href={`#${s.id}`}>{s.title}</a>
                  </li>
                ))}
              </ul>
            </nav>
          </div>
        </div>
      </main>
      <SiteFooter />
    </>
  );
}
