/**
 * Metadados de SEO/GEO das editorias do IA News.
 * Cada editoria vira uma página própria em /categoria/{slug}, com título,
 * descrição, palavras-chave e texto de abertura exclusivos — o que permite ao
 * Google e às LLMs indexarem seções distintas da marca IA News (sitelinks),
 * em vez de apenas a home.
 */
import type { CategoryKey } from "@/components/site/category-chip";

export type CategorySeo = {
  key: CategoryKey;
  slug: string;
  label: string;
  h1: string;
  title: string;
  description: string;
  intro: string;
  keywords: string[];
  related: { label: string; href: string }[];
};

export const CATEGORY_SEO: Record<string, CategorySeo> = {
  bigtech: {
    key: "bigtech",
    slug: "bigtech",
    label: "Big Tech",
    h1: "Notícias de IA nas Big Techs",
    title: "Big Techs e IA: OpenAI, Google, Microsoft e Meta | IA News",
    description:
      "Cobertura diária das big techs em inteligência artificial: lançamentos da OpenAI, Google, Microsoft, Meta, Anthropic e Amazon, com análise do impacto para empresas brasileiras.",
    intro:
      "Tudo o que OpenAI, Google, Microsoft, Meta, Anthropic, Amazon e Nvidia anunciam em inteligência artificial — e o que cada movimento significa para quem contrata essas plataformas no Brasil.",
    keywords: ["openai", "google gemini", "microsoft copilot", "meta ia", "anthropic claude", "nvidia"],
    related: [
      { label: "Ranking IA", href: "/ranking" },
      { label: "IA para empresas", href: "/artigos/inteligencia-artificial-nas-empresas" },
    ],
  },
  brasil: {
    key: "brasil",
    slug: "brasil",
    label: "Brasil",
    h1: "Inteligência artificial no Brasil",
    title: "IA no Brasil: empresas, governo e adoção nacional | IA News",
    description:
      "Notícias de inteligência artificial no Brasil: adoção em bancos, varejo e indústria, investimentos, políticas públicas e casos de uso reais em empresas brasileiras.",
    intro:
      "Como a inteligência artificial está sendo adotada no Brasil: bancos, varejo, indústria, governo e startups nacionais, com números e casos verificados pela redação.",
    keywords: ["ia no brasil", "inteligência artificial brasileira", "adoção de ia", "empresas brasileiras"],
    related: [
      { label: "Regulamentação da IA no Brasil", href: "/guias/regulamentacao-da-ia-no-brasil" },
      { label: "IA para pequenas empresas", href: "/guias/ia-para-pequenas-empresas" },
    ],
  },
  regulacao: {
    key: "regulacao",
    slug: "regulacao",
    label: "Regulação",
    h1: "Regulação e leis de inteligência artificial",
    title: "Regulação da IA: PL 2338, LGPD e AI Act | IA News",
    description:
      "Acompanhe a regulação da inteligência artificial: PL 2338 no Congresso, LGPD aplicada a IA, AI Act europeu e as obrigações que já valem para empresas.",
    intro:
      "O que muda na lei para quem usa IA: tramitação do PL 2338, decisões da ANPD, LGPD aplicada a modelos e as regras internacionais que chegam aos contratos brasileiros.",
    keywords: ["pl 2338", "regulamentação da ia", "lgpd e ia", "ai act", "anpd"],
    related: [
      { label: "Guia: regulamentação da IA no Brasil", href: "/guias/regulamentacao-da-ia-no-brasil" },
      { label: "Sobre o IA News", href: "/sobre" },
    ],
  },
  mercado: {
    key: "mercado",
    slug: "mercado",
    label: "Mercado",
    h1: "Mercado de inteligência artificial",
    title: "Mercado de IA: investimentos, valuations e negócios | IA News",
    description:
      "Investimentos, aquisições, valuations e resultados financeiros do mercado de inteligência artificial, com leitura editorial para executivos e investidores.",
    intro:
      "Rodadas de investimento, aquisições, receita das plataformas de IA e o que os números dizem sobre a sustentabilidade do setor.",
    keywords: ["mercado de ia", "investimento em ia", "valuation", "aquisições"],
    related: [
      { label: "Ranking IA", href: "/ranking" },
      { label: "Startups de IA", href: "/categoria/startup" },
    ],
  },
  startup: {
    key: "startup",
    slug: "startup",
    label: "Startups",
    h1: "Startups de inteligência artificial",
    title: "Startups de IA: novas empresas e produtos | IA News",
    description:
      "Startups de inteligência artificial no Brasil e no mundo: produtos lançados, captações, modelos de negócio e o que já resolve problema real de empresa.",
    intro:
      "As startups que estão criando produtos de IA relevantes — quem captou, o que entregou e onde o produto realmente substitui uma ferramenta cara.",
    keywords: ["startups de ia", "ai startup", "captação", "novos produtos de ia"],
    related: [
      { label: "IA para pequenas empresas", href: "/guias/ia-para-pequenas-empresas" },
      { label: "Mercado de IA", href: "/categoria/mercado" },
    ],
  },
  pesquisa: {
    key: "pesquisa",
    slug: "pesquisa",
    label: "Pesquisa",
    h1: "Pesquisa e novos modelos de IA",
    title: "Pesquisa em IA: novos modelos e benchmarks | IA News",
    description:
      "Pesquisa em inteligência artificial explicada sem jargão: novos modelos, benchmarks públicos, avanços em raciocínio e limites técnicos que afetam produtos.",
    intro:
      "Novos modelos, papers relevantes e resultados de benchmark traduzidos para o que muda na prática em produtos e operações.",
    keywords: ["benchmark de ia", "novos modelos", "llm", "pesquisa em ia"],
    related: [
      { label: "Ranking IA", href: "/ranking" },
      { label: "Big Techs", href: "/categoria/bigtech" },
    ],
  },
  ferramentas: {
    key: "ferramentas",
    slug: "ferramentas",
    label: "Ferramentas",
    h1: "Ferramentas de inteligência artificial",
    title: "Ferramentas de IA: lançamentos, testes e comparativos | IA News",
    description:
      "Ferramentas de inteligência artificial avaliadas pela redação: lançamentos, recursos novos, preços e comparativos com o Ranking IA atualizado diariamente.",
    intro:
      "Quais ferramentas de IA valem o investimento: novidades, mudanças de preço e testes práticos, sempre conectados ao Ranking IA.",
    keywords: ["ferramentas de ia", "melhores ias", "comparativo de ia", "preço de ia"],
    related: [
      { label: "Ranking IA", href: "/ranking" },
      { label: "IA no atendimento ao cliente", href: "/guias/ia-no-atendimento-ao-cliente" },
    ],
  },
  generativa: {
    key: "generativa",
    slug: "generativa",
    label: "IA Generativa",
    h1: "IA generativa: texto, imagem, vídeo e voz",
    title: "IA generativa: texto, imagem, vídeo e voz | IA News",
    description:
      "Notícias de IA generativa: geradores de texto, imagem, vídeo e voz, direitos autorais, deepfakes e uso corporativo com controle de risco.",
    intro:
      "O avanço dos modelos que criam texto, imagem, vídeo e áudio — e as questões de direito autoral, autenticidade e governança que vêm junto.",
    keywords: ["ia generativa", "geração de imagem", "geração de vídeo", "deepfake", "direitos autorais"],
    related: [
      { label: "Ferramentas de IA", href: "/categoria/ferramentas" },
      { label: "Regulação", href: "/categoria/regulacao" },
    ],
  },
  global: {
    key: "global",
    slug: "global",
    label: "Global",
    h1: "IA no mundo",
    title: "IA no mundo: EUA, Europa e China | IA News",
    description:
      "Inteligência artificial no cenário internacional: disputa entre Estados Unidos, China e Europa, geopolítica de chips e decisões que chegam ao Brasil.",
    intro:
      "A corrida global da IA: Estados Unidos, China e União Europeia, controle de chips e acordos que definem o que a sua empresa poderá contratar.",
    keywords: ["ia estados unidos", "ia china", "união europeia ia", "geopolítica de chips"],
    related: [
      { label: "Regulação", href: "/categoria/regulacao" },
      { label: "Big Techs", href: "/categoria/bigtech" },
    ],
  },
};

export const CATEGORY_SEO_LIST = Object.values(CATEGORY_SEO);
