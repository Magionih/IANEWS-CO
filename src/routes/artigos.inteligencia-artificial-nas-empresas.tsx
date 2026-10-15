import { createFileRoute, Link } from "@tanstack/react-router";

import { SiteHeader } from "@/components/site/header";
import { SiteFooter } from "@/components/site/footer";

const TITLE = "IA para empresas: guia prático de implementação (2026)";
const DESCRIPTION =
  "Guia completo de inteligência artificial nas empresas: onde começar, casos de uso reais por área, custos, governança, LGPD, métricas e um roteiro de 90 dias.";
const URL = "https://ianewsbr.com/artigos/inteligencia-artificial-nas-empresas";

export const Route = createFileRoute("/artigos/inteligencia-artificial-nas-empresas")({
  head: () => ({
    meta: [
      { title: TITLE },
      { name: "description", content: DESCRIPTION },
      { property: "og:title", content: TITLE },
      { property: "og:description", content: DESCRIPTION },
      { property: "og:type", content: "article" },
      { property: "og:url", content: URL },
      { name: "twitter:card", content: "summary_large_image" },
    ],
    links: [{ rel: "canonical", href: URL }],
    scripts: [
      {
        type: "application/ld+json",
        children: JSON.stringify({
          "@context": "https://schema.org",
          "@type": "Article",
          headline: TITLE,
          description: DESCRIPTION,
          mainEntityOfPage: URL,
          author: { "@type": "Organization", name: "IA News" },
          publisher: { "@type": "Organization", name: "IA News" },
        }),
      },
      {
        type: "application/ld+json",
        children: JSON.stringify({
          "@context": "https://schema.org",
          "@type": "BreadcrumbList",
          itemListElement: [
            { "@type": "ListItem", position: 1, name: "IA News", item: "https://ianewsbr.com/" },
            {
              "@type": "ListItem",
              position: 2,
              name: "Artigos",
              item: "https://ianewsbr.com/artigos/inteligencia-artificial-nas-empresas",
            },
            { "@type": "ListItem", position: 3, name: "IA para empresas", item: URL },
          ],
        }),
      },
    ],
  }),
  component: GuiaIaEmpresas,
});

type Section = { id: string; title: string; body: string[]; bullets?: string[] };

const SECTIONS: Section[] = [
  {
    id: "o-que-e",
    title: 'O que significa "IA para empresas" na prática',
    body: [
      "Inteligência artificial nas empresas deixou de ser projeto de laboratório. Na prática, hoje significa três coisas distintas: usar ferramentas prontas (assistentes de texto, transcrição, atendimento), conectar modelos de linguagem aos sistemas internos da companhia (CRM, ERP, base de conhecimento) e automatizar processos ponta a ponta com agentes que executam tarefas com supervisão humana.",
      "A diferença entre uma empresa que ganha produtividade e outra que só gasta com licenças está quase sempre na escolha do problema, não na escolha do modelo. Comece pelo processo caro, repetitivo e bem documentado — não pelo mais chamativo.",
    ],
  },
  {
    id: "casos-de-uso",
    title: "Casos de uso por área (com exemplos reais)",
    body: [
      "Estes são os usos que mais aparecem em empresas brasileiras de médio e grande porte e que costumam apresentar retorno mensurável em menos de um trimestre.",
    ],
    bullets: [
      "Atendimento e CS: triagem automática de tickets, sugestão de resposta ao agente humano e resumo de conversas longas. Ganho típico: queda de 20% a 40% no tempo médio de atendimento.",
      "Vendas: enriquecimento de leads, resumo de reuniões gravadas, geração de propostas a partir de modelos aprovados e priorização de pipeline.",
      "Financeiro e backoffice: leitura de notas fiscais e contratos, conciliação de documentos e classificação contábil com revisão humana por amostragem.",
      "Jurídico e compliance: revisão de cláusulas contra uma cartilha interna, comparação de versões e busca semântica no acervo de contratos.",
      "Marketing e conteúdo: variações de campanha, adaptação por canal e análise de desempenho — sempre com aprovação editorial humana.",
      "Engenharia e TI: assistentes de código, documentação automática e triagem de incidentes a partir de logs.",
      "RH: triagem de currículos com critérios auditáveis, onboarding assistido e respostas a dúvidas de políticas internas.",
    ],
  },
  {
    id: "por-onde-comecar",
    title: "Por onde começar: roteiro de 90 dias",
    body: [
      "Um piloto bem feito vale mais que uma estratégia de 40 slides. Este roteiro é o que temos visto funcionar em empresas que saíram do experimento para a operação.",
    ],
    bullets: [
      "Dias 1–15: mapeie de 5 a 10 processos candidatos. Para cada um, registre volume mensal, tempo gasto, custo por execução e nível de risco em caso de erro.",
      "Dias 16–30: escolha dois pilotos — um de ganho rápido (baixo risco) e um estratégico. Defina a métrica de sucesso antes de começar.",
      "Dias 31–60: rode o piloto com um grupo pequeno, sempre com revisão humana. Meça tempo economizado, taxa de erro e adoção real.",
      "Dias 61–75: decida com dados: escalar, ajustar ou encerrar. Encerrar um piloto ruim rápido é resultado, não fracasso.",
      "Dias 76–90: formalize governança, treinamento e política de uso antes de abrir para toda a empresa.",
    ],
  },
  {
    id: "custos",
    title: "Quanto custa e como calcular o retorno",
    body: [
      "O custo de IA em empresa tem quatro componentes: licenças ou consumo por token, integração e desenvolvimento, revisão humana e treinamento das equipes. Projetos que só orçam o primeiro item estouram o orçamento.",
      "Para calcular retorno, use uma conta simples: (horas economizadas por mês × custo médio da hora) − (custo mensal total da solução). Se o piloto não fecha essa conta em três meses, o problema geralmente é o processo escolhido, não a tecnologia.",
    ],
  },
  {
    id: "governanca",
    title: "Governança, LGPD e risco",
    body: [
      "Antes de conectar dados reais a qualquer ferramenta, defina o básico: quais dados podem sair da empresa, quais fornecedores estão aprovados, quem revisa saídas sensíveis e como os registros ficam auditáveis.",
      "No Brasil, a LGPD exige base legal para o tratamento e transparência com o titular. Dados pessoais de clientes e colaboradores em prompts merecem a mesma atenção que qualquer outro tratamento — inclusive contratualmente com o fornecedor.",
    ],
    bullets: [
      "Política de uso escrita, curta e conhecida por todos, com lista de ferramentas aprovadas.",
      "Classificação de dados: público, interno, confidencial e pessoal — com regras claras para cada nível.",
      "Revisão humana obrigatória em decisões que afetam pessoas (crédito, contratação, desligamento, preço).",
      "Registro de prompts e saídas em processos críticos, para auditoria e correção.",
    ],
  },
  {
    id: "metricas",
    title: "Métricas que provam valor",
    body: ["Adoção sozinha não é resultado. Acompanhe indicadores que a diretoria reconhece."],
    bullets: [
      "Tempo médio por tarefa antes e depois.",
      "Custo por atendimento, por proposta ou por documento processado.",
      "Taxa de retrabalho e de erro detectado na revisão.",
      "Percentual de uso semanal ativo entre os usuários habilitados.",
      "Receita ou margem influenciada nos processos de venda.",
    ],
  },
  {
    id: "erros",
    title: "Erros comuns que travam a adoção",
    body: ["Os tropeços se repetem em empresas de todos os portes."],
    bullets: [
      "Comprar licenças para toda a empresa antes de validar um caso de uso.",
      "Escolher o processo mais complexo como piloto inicial.",
      "Não treinar as equipes — sem repertório de uso, a ferramenta vira novidade abandonada em duas semanas.",
      "Ignorar o dono do processo: quem executa precisa participar do desenho.",
      "Tratar IA como projeto de TI, quando é decisão de operação e de negócio.",
    ],
  },
];

function GuiaIaEmpresas() {
  return (
    <>
      <SiteHeader />
      <main id="main" className="page">
        <div className="wrap">
          <nav aria-label="Trilha" className="crumbs">
            <Link to="/">IA News</Link>
            <span aria-hidden="true">/</span>
            <Link to="/noticias" search={{ q: "", cat: "all" }}>
              Notícias
            </Link>
            <span aria-hidden="true">/</span>
            <span>IA para empresas</span>
          </nav>

          <div className="page-head">
            <p className="kick">Guia IA News</p>
            <h1>Inteligência artificial nas empresas: o guia prático para quem decide</h1>
            <p className="sub">
              Onde a IA gera retorno real, quanto custa, como implementar em 90 dias e o que a sua
              empresa precisa ter no lugar antes de escalar — sem hype, com foco em operação.
            </p>
          </div>

          <div className="art" style={{ paddingTop: 0 }}>
            <article className="art-main">
              <div className="prose">
                {SECTIONS.map((s, i) => (
                  <section key={s.id} id={s.id} style={{ scrollMarginTop: 96 }}>
                    <h2 style={i === 0 ? { marginTop: 0 } : undefined}>{s.title}</h2>
                    {s.body.map((p) => (
                      <p key={p}>{p}</p>
                    ))}
                    {s.bullets ? (
                      <ul
                        className="plain"
                        style={{ listStyle: "none", margin: "0 0 18px", padding: 0 }}
                      >
                        {s.bullets.map((b) => (
                          <li key={b}>{b}</li>
                        ))}
                      </ul>
                    ) : null}
                  </section>
                ))}
              </div>

              <section id="continue">
                <h2 className="h-sm">Continue pelo IA News</h2>
                <ul className="plain links-list">
                  <li>
                    <Link to="/noticias" search={{ q: "", cat: "all" }}>
                      Últimas notícias de IA aplicadas a negócios
                    </Link>
                  </li>
                  <li>
                    <Link to="/ranking">Ranking IA — comparação das principais ferramentas</Link>
                  </li>
                  <li>
                    <Link to="/sobre">Nossa política editorial e metodologia</Link>
                  </li>
                </ul>
              </section>

              <section className="inline-cta">
                <p className="kick">Fale com a gente</p>
                <h3>Quer discutir a adoção de IA na sua empresa?</h3>
                <p className="s">
                  Envie sua dúvida, sugestão de pauta ou proposta de parceria para a redação do IA
                  News. Respondemos em até 3 dias úteis.
                </p>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                  <Link className="btn blue" to="/contato">
                    Falar com a redação →
                  </Link>
                  <Link className="btn line" to="/anuncie">
                    Anunciar no IA News
                  </Link>
                </div>
              </section>
            </article>

            <aside className="art-side">
              <nav aria-label="Índice" className="box toc toc-box">
                <h3>Nesta página</h3>
                <div>
                  {SECTIONS.map((s) => (
                    <a key={s.id} href={`#${s.id}`}>
                      {s.title}
                    </a>
                  ))}
                </div>
              </nav>
            </aside>
          </div>
        </div>
      </main>
      <SiteFooter />
    </>
  );
}
