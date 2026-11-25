/**
 * Páginas "Empresas de IA": uma página por grande empresa, que reúne a cobertura da IA News
 * sobre ela (busca por termos no título, linha fina e tags) com contexto fixo e FAQ.
 * Os textos trazem apenas fatos estáveis (fundação, sede, produtos). Cargos atuais ficam de fora
 * porque mudam; quem quiser o detalhe do dia lê as matérias.
 */
export type Company = {
  slug: string;
  name: string;
  /** Nome curto para títulos: "OpenAI", "Google". */
  short: string;
  title: string;
  description: string;
  h1: string;
  intro: string[];
  facts: { label: string; value: string }[];
  products: string[];
  terms: string[];
  website: string;
  wikipedia: string;
  foundingDate: string;
  founders: string[];
  faq: { q: string; a: string }[];
};

export const COMPANIES: Company[] = [
  {
    slug: "openai",
    name: "OpenAI",
    short: "OpenAI",
    title: "OpenAI: notícias, ChatGPT, GPT e o que muda para empresas",
    description:
      "Tudo sobre a OpenAI: lançamentos do ChatGPT e dos modelos GPT, acordos, preços e como empresas brasileiras usam as ferramentas da criadora do ChatGPT.",
    h1: "OpenAI: notícias e análise",
    intro: [
      "A OpenAI é a empresa americana que criou o ChatGPT e a família de modelos GPT. Desde o lançamento do ChatGPT, em novembro de 2022, ela passou a ditar o ritmo da corrida da IA generativa e virou referência para empresas que começam a usar inteligência artificial.",
      "Aqui reunimos a cobertura da IA News sobre a OpenAI: novos modelos, mudanças de preço e de produto, parcerias e, principalmente, o que isso significa para quem decide em empresas no Brasil.",
    ],
    facts: [
      { label: "Fundação", value: "2015" },
      { label: "Sede", value: "São Francisco (EUA)" },
      { label: "Principal produto", value: "ChatGPT" },
    ],
    products: ["ChatGPT", "Modelos GPT", "API da OpenAI", "Sora", "DALL·E", "Codex"],
    terms: ["openai", "chatgpt", "sam altman", "gpt-", "sora"],
    website: "https://openai.com",
    wikipedia: "https://pt.wikipedia.org/wiki/OpenAI",
    foundingDate: "2015-12-11",
    founders: ["Sam Altman", "Greg Brockman", "Ilya Sutskever", "Elon Musk"],
    faq: [
      {
        q: "O que é a OpenAI?",
        a: "É a empresa de pesquisa e produtos de inteligência artificial que criou o ChatGPT e os modelos GPT. Foi fundada em 2015, em São Francisco, nos Estados Unidos.",
      },
      {
        q: "Qual a diferença entre OpenAI e ChatGPT?",
        a: "OpenAI é a empresa. ChatGPT é o assistente de conversa que ela vende, que funciona com os modelos GPT. Empresas também podem usar esses modelos pela API da OpenAI.",
      },
      {
        q: "Empresas brasileiras podem usar a OpenAI?",
        a: "Sim. O ChatGPT tem planos para equipes e empresas, e a API permite integrar os modelos a sistemas próprios. A IA News publica casos de empresas brasileiras que fizeram isso.",
      },
    ],
  },
  {
    slug: "google",
    name: "Google",
    short: "Google",
    title: "Google e IA: notícias do Gemini, DeepMind e da busca com IA",
    description:
      "A cobertura da IA News sobre o Google na inteligência artificial: Gemini, DeepMind, busca com IA, Veo, NotebookLM e o impacto para empresas e anunciantes no Brasil.",
    h1: "Google e inteligência artificial",
    intro: [
      "O Google é uma das empresas que mais investem em inteligência artificial. Desenvolve a família de modelos Gemini, mantém o laboratório Google DeepMind e está colocando IA dentro da busca, do Android, do Workspace e da publicidade.",
      "Nesta página estão as matérias da IA News sobre a estratégia de IA do Google e o que ela muda para empresas, criadores e anunciantes brasileiros.",
    ],
    facts: [
      { label: "Fundação", value: "1998" },
      { label: "Sede", value: "Mountain View (EUA)" },
      { label: "Controladora", value: "Alphabet" },
    ],
    products: ["Gemini", "Google DeepMind", "NotebookLM", "Veo", "Nano Banana", "Busca com IA"],
    terms: ["google", "gemini", "deepmind", "alphabet", "notebooklm", "veo ", "nano banana"],
    website: "https://ai.google",
    wikipedia: "https://pt.wikipedia.org/wiki/Google",
    foundingDate: "1998-09-04",
    founders: ["Larry Page", "Sergey Brin"],
    faq: [
      {
        q: "Qual é a IA do Google?",
        a: "A principal é o Gemini, que funciona como assistente e como família de modelos usada em produtos do Google e por desenvolvedores. O Google também tem o NotebookLM, o Veo (vídeo) e o Nano Banana (imagem).",
      },
      {
        q: "O que é o Google DeepMind?",
        a: "É o laboratório de pesquisa em IA do Google, responsável pelos modelos Gemini e por pesquisas como o AlphaFold.",
      },
      {
        q: "A IA muda a busca do Google?",
        a: "Sim. A busca passou a mostrar respostas geradas por IA, o que muda como as empresas aparecem nos resultados. A IA News acompanha essas mudanças e o efeito para negócios.",
      },
    ],
  },
  {
    slug: "meta",
    name: "Meta",
    short: "Meta",
    title: "Meta e IA: notícias do Llama, Meta AI no WhatsApp e Instagram",
    description:
      "A Meta na inteligência artificial: modelos Llama, Meta AI no WhatsApp, Instagram e Facebook, óculos com IA e o que muda para marcas e empresas no Brasil.",
    h1: "Meta e inteligência artificial",
    intro: [
      "A Meta, dona do Facebook, do Instagram e do WhatsApp, colocou a inteligência artificial no centro da estratégia. Desenvolve os modelos abertos Llama e levou o assistente Meta AI para os aplicativos que os brasileiros mais usam.",
      "Para empresas no Brasil, isso pesa direto no atendimento pelo WhatsApp, nos anúncios e na produção de conteúdo. Reunimos aqui a cobertura da IA News sobre a Meta.",
    ],
    facts: [
      { label: "Fundação", value: "2004" },
      { label: "Sede", value: "Menlo Park (EUA)" },
      { label: "Apps", value: "WhatsApp, Instagram, Facebook" },
    ],
    products: ["Meta AI", "Llama", "WhatsApp Business", "Óculos Ray-Ban Meta", "Anúncios com IA"],
    terms: ["meta ai", "meta platforms", "zuckerberg", "llama", "ray-ban meta"],
    website: "https://ai.meta.com",
    wikipedia: "https://pt.wikipedia.org/wiki/Meta_Platforms",
    foundingDate: "2004-02-04",
    founders: ["Mark Zuckerberg"],
    faq: [
      {
        q: "O que é a Meta AI?",
        a: "É o assistente de inteligência artificial da Meta, disponível dentro do WhatsApp, do Instagram, do Facebook e do Messenger.",
      },
      {
        q: "O que é o Llama?",
        a: "É a família de modelos de linguagem da Meta, distribuída de forma aberta para que empresas e desenvolvedores possam usar e adaptar.",
      },
      {
        q: "Como empresas usam IA no WhatsApp?",
        a: "Com agentes e assistentes que respondem clientes, agendam, vendem e fazem pós-venda. A IA News publica casos brasileiros com números de resultado.",
      },
    ],
  },
  {
    slug: "anthropic",
    name: "Anthropic",
    short: "Anthropic",
    title: "Anthropic: notícias do Claude, Claude Code e segurança em IA",
    description:
      "Tudo sobre a Anthropic, criadora do Claude: novos modelos, Claude Code, uso em empresas, pesquisa de segurança em IA e o que muda para negócios no Brasil.",
    h1: "Anthropic: notícias e análise",
    intro: [
      "A Anthropic é a empresa americana de inteligência artificial que desenvolve o Claude, assistente e família de modelos usada por empresas para escrever, analisar documentos e programar. Foi fundada em 2021 por ex-integrantes da OpenAI, com foco em segurança de IA.",
      "Aqui está a cobertura da IA News sobre a Anthropic e o Claude: lançamentos, ferramentas para programação como o Claude Code e casos de uso em empresas.",
    ],
    facts: [
      { label: "Fundação", value: "2021" },
      { label: "Sede", value: "São Francisco (EUA)" },
      { label: "Principal produto", value: "Claude" },
    ],
    products: ["Claude", "Claude Code", "API da Anthropic"],
    terms: ["anthropic", "claude"],
    website: "https://www.anthropic.com",
    wikipedia: "https://pt.wikipedia.org/wiki/Anthropic",
    foundingDate: "2021",
    founders: ["Dario Amodei", "Daniela Amodei"],
    faq: [
      {
        q: "O que é a Anthropic?",
        a: "É a empresa de inteligência artificial que cria o Claude. Foi fundada em 2021, em São Francisco, e tem a segurança de IA como foco de pesquisa.",
      },
      {
        q: "O que é o Claude?",
        a: "É o assistente de IA da Anthropic, também disponível como modelo pela API. É muito usado para leitura de documentos longos, escrita e programação.",
      },
      {
        q: "O que é o Claude Code?",
        a: "É a ferramenta da Anthropic para programar com IA, que trabalha direto no código do projeto.",
      },
    ],
  },
  {
    slug: "nvidia",
    name: "Nvidia",
    short: "Nvidia",
    title: "Nvidia e IA: notícias de chips, GPUs e data centers",
    description:
      "A Nvidia na corrida da inteligência artificial: chips e GPUs para IA, data centers, resultados, parcerias e o efeito para empresas e para o Brasil.",
    h1: "Nvidia e inteligência artificial",
    intro: [
      "A Nvidia fabrica os chips (GPUs) que treinam e rodam a maior parte dos modelos de inteligência artificial do mundo. Por isso virou uma das empresas mais valiosas do mercado e um termômetro da corrida da IA.",
      "Nesta página estão as matérias da IA News sobre a Nvidia: lançamentos de chips, data centers, resultados e o que a disputa por capacidade de computação significa para empresas.",
    ],
    facts: [
      { label: "Fundação", value: "1993" },
      { label: "Sede", value: "Santa Clara (EUA)" },
      { label: "Principal negócio", value: "GPUs para IA" },
    ],
    products: ["GPUs para data center", "Plataforma CUDA", "GeForce", "Supercomputadores de IA"],
    terms: ["nvidia", "jensen huang", "gpu", "chips de ia"],
    website: "https://www.nvidia.com",
    wikipedia: "https://pt.wikipedia.org/wiki/Nvidia",
    foundingDate: "1993-04-05",
    founders: ["Jensen Huang", "Chris Malachowsky", "Curtis Priem"],
    faq: [
      {
        q: "Por que a Nvidia é importante para a IA?",
        a: "Porque as GPUs da Nvidia são o principal hardware usado para treinar e rodar modelos de IA. A demanda por esses chips cresceu com a IA generativa.",
      },
      {
        q: "O que é GPU?",
        a: "É um processador feito para fazer muitos cálculos ao mesmo tempo. Essa característica tornou as GPUs o padrão para treinar redes neurais.",
      },
    ],
  },
  {
    slug: "amazon",
    name: "Amazon",
    short: "Amazon",
    title: "Amazon e IA: notícias da AWS, Alexa e IA no varejo",
    description:
      "A Amazon na inteligência artificial: AWS, modelos e chips próprios, Alexa, IA no varejo e na logística, e o que muda para empresas no Brasil.",
    h1: "Amazon e inteligência artificial",
    intro: [
      "A Amazon usa inteligência artificial no varejo, na logística, na Alexa e, principalmente, na AWS, sua divisão de nuvem, que vende infraestrutura e modelos de IA para empresas do mundo todo, inclusive do Brasil.",
      "Reunimos aqui a cobertura da IA News sobre a Amazon e a AWS na corrida da IA.",
    ],
    facts: [
      { label: "Fundação", value: "1994" },
      { label: "Sede", value: "Seattle (EUA)" },
      { label: "Nuvem", value: "AWS" },
    ],
    products: ["AWS", "Amazon Bedrock", "Alexa", "Chips de IA próprios"],
    terms: ["amazon", "aws", "bezos", "alexa", "bedrock"],
    website: "https://www.aboutamazon.com",
    wikipedia: "https://pt.wikipedia.org/wiki/Amazon",
    foundingDate: "1994-07-05",
    founders: ["Jeff Bezos"],
    faq: [
      {
        q: "Como a Amazon usa IA?",
        a: "Em recomendações e logística do varejo, na Alexa e na AWS, que oferece infraestrutura e modelos de IA para outras empresas.",
      },
      {
        q: "O que é a AWS?",
        a: "É a Amazon Web Services, a divisão de computação em nuvem da Amazon, usada por empresas para rodar sistemas e aplicações de IA.",
      },
    ],
  },
  {
    slug: "microsoft",
    name: "Microsoft",
    short: "Microsoft",
    title: "Microsoft e IA: notícias do Copilot, Azure e parceria com a OpenAI",
    description:
      "A Microsoft na inteligência artificial: Copilot no Windows e no Office, Azure, parceria com a OpenAI e o que muda para empresas brasileiras.",
    h1: "Microsoft e inteligência artificial",
    intro: [
      "A Microsoft levou a inteligência artificial para ferramentas que quase toda empresa usa, como Windows, Word, Excel, Outlook e Teams, por meio do Copilot. Também vende IA pela nuvem Azure e é uma das principais parceiras da OpenAI.",
      "Aqui reunimos as matérias da IA News sobre a estratégia de IA da Microsoft.",
    ],
    facts: [
      { label: "Fundação", value: "1975" },
      { label: "Sede", value: "Redmond (EUA)" },
      { label: "Assistente", value: "Copilot" },
    ],
    products: ["Microsoft Copilot", "Copilot no Microsoft 365", "Azure", "GitHub Copilot"],
    terms: ["microsoft", "copilot", "azure", "satya nadella"],
    website: "https://www.microsoft.com/ai",
    wikipedia: "https://pt.wikipedia.org/wiki/Microsoft",
    foundingDate: "1975-04-04",
    founders: ["Bill Gates", "Paul Allen"],
    faq: [
      {
        q: "O que é o Microsoft Copilot?",
        a: "É o assistente de IA da Microsoft, disponível no Windows, no navegador Edge e dentro do Microsoft 365 (Word, Excel, PowerPoint, Outlook e Teams).",
      },
      {
        q: "Qual a relação entre Microsoft e OpenAI?",
        a: "A Microsoft é investidora e parceira de nuvem da OpenAI, e usa modelos da OpenAI em produtos como o Copilot e o Azure.",
      },
    ],
  },
  {
    slug: "ifood",
    name: "iFood",
    short: "iFood",
    title: "iFood e IA: agentes, automação e inteligência artificial no delivery",
    description:
      "Como o iFood usa inteligência artificial: agentes de IA, automação, atendimento e logística. A cobertura da IA News sobre a IA na maior plataforma de delivery do Brasil.",
    h1: "iFood e inteligência artificial",
    intro: [
      "O iFood, maior plataforma de delivery do Brasil, é um dos casos brasileiros mais citados de uso de inteligência artificial em escala, da logística das entregas ao atendimento e às ferramentas para restaurantes.",
      "Aqui está a cobertura da IA News sobre como o iFood aplica IA e o que outras empresas brasileiras podem aprender com isso.",
    ],
    facts: [
      { label: "Fundação", value: "2011" },
      { label: "Sede", value: "Osasco (SP)" },
      { label: "Setor", value: "Delivery e tecnologia" },
    ],
    products: [
      "App de delivery",
      "Agentes de IA",
      "Ferramentas para restaurantes",
      "Logística com IA",
    ],
    terms: ["ifood"],
    website: "https://www.ifood.com.br",
    wikipedia: "https://pt.wikipedia.org/wiki/IFood",
    foundingDate: "2011",
    founders: [],
    faq: [
      {
        q: "Como o iFood usa inteligência artificial?",
        a: "Em logística e roteirização das entregas, recomendações, atendimento e agentes de IA para operação interna e para parceiros. As matérias desta página trazem os números divulgados.",
      },
    ],
  },
];

export const COMPANY_MAP: Record<string, Company> = Object.fromEntries(
  COMPANIES.map((c) => [c.slug, c]),
);
