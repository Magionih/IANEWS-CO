/**
 * Configuração das páginas-hub temáticas do IA News.
 * Cada hub agrupa matérias já publicadas por termos-chave e organiza o
 * conteúdo em temas, com CTA e breadcrumb próprios.
 */
export type HubTheme = {
  id: string;
  title: string;
  description: string;
  terms: string[];
};

export type HubCta = "newsletter" | "contato";

export type HubConfig = {
  slug: string;
  eyebrow: string;
  h1: string;
  title: string;
  description: string;
  intro: string[];
  themes: HubTheme[];
  cta: HubCta;
  ctaTitle: string;
  ctaDescription: string;
  ctaAction: string;
  faq: { q: string; a: string }[];
};

export const SITE_URL = "https://ianewsbr.com";

export const HUBS: Record<string, HubConfig> = {
  "regulamentacao-da-ia-no-brasil": {
    slug: "regulamentacao-da-ia-no-brasil",
    eyebrow: "Hub de cobertura",
    h1: "Regulamentação da IA no Brasil",
    title: "Regulamentação da IA no Brasil: PL 2338, LGPD e o que muda para empresas",
    description:
      "Acompanhe a regulamentação da inteligência artificial no Brasil: andamento do PL 2338, relação entre LGPD e IA, obrigações por nível de risco e o impacto prático para empresas.",
    intro: [
      "O Brasil discute um marco legal próprio para inteligência artificial enquanto a LGPD já se aplica a praticamente todo uso corporativo de IA que envolva dados pessoais. Reunimos aqui a cobertura do IA News sobre os dois eixos, organizada por tema.",
      "Esta página é atualizada automaticamente conforme novas matérias entram no site.",
    ],
    themes: [
      {
        id: "pl-2338",
        title: "PL 2338 e o marco legal da IA",
        description:
          "Tramitação do projeto de lei, classificação por nível de risco, sistemas proibidos, obrigações de transparência e o papel do órgão fiscalizador.",
        terms: ["pl 2338", "marco legal", "regulament", "projeto de lei", "congresso", "senado", "câmara", "ai act", "legisla"],
      },
      {
        id: "lgpd-e-ia",
        title: "LGPD e IA",
        description:
          "Base legal para treinar e operar modelos, dados pessoais em prompts, decisões automatizadas, direitos do titular e atuação da ANPD.",
        terms: ["lgpd", "anpd", "dados pessoais", "privacidade", "proteção de dados", "titular"],
      },
      {
        id: "impacto-empresas",
        title: "Impacto para empresas",
        description:
          "O que muda na prática para quem já usa IA em atendimento, crédito, RH e marketing: governança, auditoria e responsabilidade sobre saídas do modelo.",
        terms: ["governança", "compliance", "auditoria", "risco", "responsabilidade", "empresa", "corporativ"],
      },
      {
        id: "mundo",
        title: "Regulação no mundo",
        description:
          "Decisões da União Europeia, Estados Unidos e China que costumam antecipar o debate brasileiro e influenciar contratos com fornecedores globais.",
        terms: ["união europeia", "europa", "estados unidos", "china", "eua", "global", "internacional"],
      },
    ],
    cta: "newsletter",
    ctaTitle: "Receba cada movimento da regulação de IA antes das 8h",
    ctaDescription:
      "A newsletter diária do IA News resume o que mudou na regulamentação e o que isso exige da sua empresa. Grátis, todos os dias.",
    ctaAction: "Assinar a newsletter diária",
    faq: [
      {
        q: "O Brasil já tem uma lei específica de inteligência artificial?",
        a: "Ainda não há um marco legal de IA em vigor. O debate se concentra no PL 2338 e em propostas correlatas; enquanto isso, o uso corporativo de IA é regido pela LGPD, pelo Código de Defesa do Consumidor e pela legislação setorial.",
      },
      {
        q: "A LGPD se aplica a sistemas de IA?",
        a: "Sim. Sempre que o sistema tratar dados pessoais — em treinamento, em prompts ou nas saídas — valem as regras de base legal, finalidade, transparência e direitos do titular, incluindo a revisão de decisões automatizadas.",
      },
      {
        q: "O que uma empresa deve organizar desde já?",
        a: "Política de uso escrita, lista de ferramentas aprovadas, classificação de dados, revisão humana em decisões que afetam pessoas e registro auditável de prompts e saídas em processos críticos.",
      },
    ],
  },
  "ia-para-pequenas-empresas": {
    slug: "ia-para-pequenas-empresas",
    eyebrow: "Hub de cobertura",
    h1: "IA para pequenas empresas",
    title: "IA para pequenas empresas: ferramentas, custos e casos de uso reais",
    description:
      "Como pequenas e médias empresas usam inteligência artificial sem time de tecnologia: ferramentas acessíveis, custo real, automação de rotinas e primeiros passos com retorno mensurável.",
    intro: [
      "Pequenas empresas não precisam de projeto de IA — precisam de duas ou três rotinas caras resolvidas com ferramenta pronta. Esta página reúne a cobertura do IA News voltada a PMEs, organizada por tema.",
      "Comece pelo processo repetitivo e bem documentado. Se o piloto não paga em três meses, o problema quase sempre é a escolha do processo.",
    ],
    themes: [
      {
        id: "ferramentas",
        title: "Ferramentas acessíveis",
        description:
          "Assistentes, geradores e plataformas com plano gratuito ou baixo custo que uma equipe enxuta consegue operar sem desenvolvedor.",
        terms: ["ferramenta", "chatgpt", "gemini", "copilot", "claude", "plataforma", "app", "gratuit"],
      },
      {
        id: "automacao",
        title: "Automação de rotinas",
        description:
          "Agentes e integrações que tiram tarefas manuais do dia a dia: propostas, cobrança, agendamento, resumo de reuniões e organização de documentos.",
        terms: ["automa", "agente", "workflow", "integra", "produtividade", "processo"],
      },
      {
        id: "custos",
        title: "Custos e retorno",
        description:
          "Preços, planos, consumo por token e como calcular o retorno antes de comprar licença para o time inteiro.",
        terms: ["preço", "custo", "assinatura", "plano", "investimento", "roi", "retorno", "barato"],
      },
      {
        id: "mercado-pme",
        title: "Mercado e negócios",
        description:
          "O que empresas de porte semelhante estão adotando, o que funcionou e o que se provou hype caro.",
        terms: ["pequena empresa", "pme", "startup", "empreend", "negócio", "mercado", "varejo"],
      },
    ],
    cta: "contato",
    ctaTitle: "Quer discutir IA na sua operação?",
    ctaDescription:
      "Fale com a redação do IA News sobre pauta, parceria ou divulgação para o público empresarial brasileiro.",
    ctaAction: "Envie sua pauta",
    faq: [
      {
        q: "Por onde uma pequena empresa deve começar com IA?",
        a: "Pelo processo mais repetitivo e caro que já esteja documentado — normalmente atendimento, propostas comerciais ou organização de documentos. Um piloto pequeno, com métrica definida antes de começar, vale mais que uma estratégia ampla.",
      },
      {
        q: "Quanto custa usar IA em uma empresa pequena?",
        a: "A maior parte das ferramentas de produtividade cobra por usuário e por mês, com planos de entrada acessíveis. O custo real inclui também o tempo de revisão humana e o treinamento da equipe — orçar apenas a licença é o erro mais comum.",
      },
      {
        q: "É preciso ter equipe de tecnologia?",
        a: "Para ferramentas prontas, não. Para integrar modelos ao ERP ou ao CRM, sim — ou um parceiro externo. A recomendação é validar valor com ferramenta pronta antes de investir em integração.",
      },
    ],
  },
  "ia-no-atendimento-ao-cliente": {
    slug: "ia-no-atendimento-ao-cliente",
    eyebrow: "Hub de cobertura",
    h1: "IA no atendimento ao cliente",
    title: "IA no atendimento ao cliente: chatbots, agentes e resultados reais",
    description:
      "Como a inteligência artificial está mudando o atendimento ao cliente: chatbots e agentes, integração com CRM e WhatsApp, métricas de satisfação e os limites que exigem humano.",
    intro: [
      "Atendimento é onde a IA mostra retorno mais rápido — e onde erra de forma mais visível para o cliente. Esta página reúne a cobertura do IA News sobre o tema, organizada por frente de aplicação.",
      "A regra que se repete nas operações que dão certo: a IA resolve o repetitivo e prepara o contexto; o humano decide o sensível.",
    ],
    themes: [
      {
        id: "chatbots-agentes",
        title: "Chatbots e agentes",
        description:
          "Da árvore de decisão ao agente que consulta sistemas e executa ações com supervisão — o que mudou e o que ainda não funciona.",
        terms: ["chatbot", "agente", "assistente", "bot", "conversa", "voz", "callcenter", "call center"],
      },
      {
        id: "canais",
        title: "Canais e integrações",
        description:
          "WhatsApp, e-mail, CRM e help desk: onde a IA se conecta ao que a empresa já usa.",
        terms: ["whatsapp", "crm", "canal", "integra", "helpdesk", "omnichannel", "suporte"],
      },
      {
        id: "metricas",
        title: "Experiência e métricas",
        description:
          "Tempo médio de atendimento, resolução no primeiro contato, satisfação e taxa de escalonamento para humano.",
        terms: ["experiência", "satisfação", "nps", "cliente", "métrica", "csat", "retenção"],
      },
      {
        id: "limites",
        title: "Limites e riscos",
        description:
          "Alucinação em resposta ao cliente, promessa indevida, dados sensíveis no chat e o que a legislação exige informar.",
        terms: ["erro", "alucina", "risco", "reclama", "privacidade", "lgpd", "transparência"],
      },
    ],
    cta: "contato",
    ctaTitle: "Sua empresa atende com IA? Conte para a redação",
    ctaDescription:
      "Buscamos casos reais de atendimento com inteligência artificial no Brasil para nossas reportagens — e temos espaços de mídia para quem quer falar com esse público.",
    ctaAction: "Envie sua pauta",
    faq: [
      {
        q: "IA substitui a equipe de atendimento?",
        a: "Nas operações maduras, não. A IA assume triagem, respostas repetitivas e preparação de contexto, enquanto o time humano fica com casos sensíveis, negociação e exceções — geralmente com ganho de tempo médio de atendimento entre 20% e 40%.",
      },
      {
        q: "Quais métricas provam que funcionou?",
        a: "Tempo médio de atendimento, resolução no primeiro contato, taxa de escalonamento para humano, satisfação (CSAT ou NPS) e custo por atendimento antes e depois da adoção.",
      },
      {
        q: "É obrigatório avisar que o cliente fala com uma IA?",
        a: "A transparência é a prática recomendada e tende a virar exigência formal nas propostas de marco legal em discussão. O Código de Defesa do Consumidor já veda informação enganosa sobre o serviço prestado.",
      },
    ],
  },
  "agentes-de-ia": {
    slug: "agentes-de-ia",
    eyebrow: "Guia",
    h1: "Agentes de IA",
    title: "Agentes de IA: o que são, como criar e casos reais no Brasil",
    description:
      "O que são agentes de IA, a diferença para um chatbot, como criar um agente, agentes de IA para WhatsApp, vendas e atendimento, e empresas brasileiras que já operam com agentes.",
    intro: [
      "Agente de IA é um sistema que recebe um objetivo, decide os passos e usa ferramentas (sistemas, planilhas, CRM, WhatsApp) para cumprir a tarefa, com supervisão humana nas decisões sensíveis. É o assunto de IA que mais cresce nas buscas de empresas brasileiras.",
      "Esta página reúne a cobertura da IA News sobre agentes, com casos de empresas brasileiras que mostraram números. Ela é atualizada automaticamente conforme novas matérias entram no site.",
    ],
    themes: [
      {
        id: "o-que-sao",
        title: "O que são agentes de IA",
        description:
          "Como um agente planeja, usa ferramentas e executa tarefas, e o que o separa de um chatbot de perguntas e respostas.",
        terms: ["agente", "agentes", "agêntic", "agentic", "autônom", "orquestra"],
      },
      {
        id: "whatsapp-vendas",
        title: "Agentes no WhatsApp, vendas e atendimento",
        description:
          "Agentes que atendem, qualificam e vendem pelo WhatsApp e por outros canais, com integração ao CRM.",
        terms: ["whatsapp", "vendas", "atendimento", "sdr", "comercial", "crm", "cliente"],
      },
      {
        id: "como-criar",
        title: "Como criar um agente de IA",
        description:
          "Ferramentas sem código, automação e desenvolvimento com IA: o caminho de quem já construiu agentes dentro da própria empresa.",
        terms: ["criar", "construir", "n8n", "no-code", "automação", "claude code", "codex", "make"],
      },
      {
        id: "casos-brasil",
        title: "Casos no Brasil",
        description:
          "Empresas brasileiras que colocaram agentes para trabalhar, com o problema, o investimento e o resultado.",
        terms: ["brasil", "brasileir", "empresa", "startup", "fundador", "milhões"],
      },
    ],
    cta: "newsletter",
    ctaTitle: "Os melhores casos de agentes de IA, toda manhã",
    ctaDescription:
      "A newsletter diária da IA News traz o que empresas brasileiras estão fazendo com agentes, com números. Grátis, às 7h.",
    ctaAction: "Assinar a newsletter diária",
    faq: [
      {
        q: "O que é um agente de IA?",
        a: "É um sistema baseado em um modelo de linguagem que recebe um objetivo, decide os passos e usa ferramentas, como sistemas internos, planilhas, e-mail ou WhatsApp, para executar a tarefa. Diferente de um assistente que só responde, o agente age dentro de limites definidos pela empresa.",
      },
      {
        q: "Qual a diferença entre chatbot e agente de IA?",
        a: "O chatbot tradicional segue um roteiro de perguntas e respostas. O agente entende o pedido em linguagem natural, consulta informações, toma decisões dentro de regras e executa ações, como agendar, registrar um pedido ou atualizar o CRM.",
      },
      {
        q: "Como criar um agente de IA?",
        a: "Comece por um processo repetitivo e bem documentado, defina o que o agente pode e não pode fazer, conecte as ferramentas necessárias (plataformas sem código ou desenvolvimento próprio), teste com casos reais e mantenha revisão humana nas decisões sensíveis.",
      },
      {
        q: "Agente de IA para WhatsApp funciona para pequenas empresas?",
        a: "Funciona quando a empresa tem perguntas e etapas que se repetem, como orçamento, agendamento e qualificação de clientes. O cuidado está em deixar claro que é uma IA, passar para um humano nos casos fora do roteiro e proteger os dados pessoais conforme a LGPD.",
      },
    ],
  },
  "ferramentas-de-ia": {
    slug: "ferramentas-de-ia",
    eyebrow: "Guia",
    h1: "Ferramentas de IA",
    title: "Melhores ferramentas de IA em 2026: Gemini, ChatGPT, Claude, DeepSeek e mais",
    description:
      "As ferramentas de inteligência artificial mais buscadas no Brasil: Gemini, ChatGPT, Claude, DeepSeek, Grok, NotebookLM, Veo 3, Nano Banana e Manus. Notícias, comparativos e o Ranking IA.",
    intro: [
      "Gemini, DeepSeek, Veo 3, NotebookLM, Grok e Nano Banana estiveram entre os assuntos de IA mais buscados no Google pelos brasileiros em 2025. Esta página reúne a cobertura da IA News sobre as principais ferramentas, organizada por uso.",
      "Para saber qual ferramenta lidera hoje, consulte o Ranking IA, atualizado com dados públicos de benchmarks e a fonte de cada número.",
    ],
    themes: [
      {
        id: "assistentes",
        title: "Assistentes: Gemini, ChatGPT, Claude, Grok e DeepSeek",
        description: "Lançamentos, preços, comparativos e o que cada assistente faz melhor no trabalho.",
        terms: ["gemini", "chatgpt", "openai", "claude", "anthropic", "grok", "deepseek", "copilot", "llama", "mistral"],
      },
      {
        id: "imagem-video",
        title: "Imagem e vídeo: Veo 3, Nano Banana, Flow e Sora",
        description: "Geradores de imagem e vídeo, o que mudou em qualidade e como empresas usam em marketing.",
        terms: ["veo", "nano banana", "flow", "sora", "imagem", "vídeo", "midjourney", "pixverse", "kling"],
      },
      {
        id: "pesquisa-produtividade",
        title: "Pesquisa e produtividade: NotebookLM, Perplexity e Manus",
        description: "Ferramentas para pesquisar, resumir documentos e executar tarefas de ponta a ponta.",
        terms: ["notebooklm", "perplexity", "manus", "pesquisa", "produtividade", "resumo", "busca"],
      },
      {
        id: "modelos",
        title: "Novos modelos e benchmarks",
        description: "Os modelos que chegam ao mercado e como eles se saem nos testes públicos.",
        terms: ["modelo", "benchmark", "lança", "versão", "ranking", "llm"],
      },
    ],
    cta: "newsletter",
    ctaTitle: "Qual IA lidera esta semana? Receba o Ranking IA",
    ctaDescription:
      "A newsletter diária da IA News traz os lançamentos que importam e o Ranking IA semanal, com a fonte de cada número. Grátis, às 7h.",
    ctaAction: "Assinar a newsletter diária",
    faq: [
      {
        q: "Qual é a melhor inteligência artificial hoje?",
        a: "Depende do uso: texto, programação, imagem ou vídeo. O Ranking IA da IA News mostra quais modelos lideram nos benchmarks públicos, com a data e a fonte de cada número, e é atualizado com frequência.",
      },
      {
        q: "Quais IAs têm versão gratuita?",
        a: "Os principais assistentes, como Gemini, ChatGPT, Claude, Grok e DeepSeek, oferecem uso gratuito com limites. Os planos pagos liberam modelos mais fortes, mais uso e recursos como agentes e geração de vídeo.",
      },
      {
        q: "O que é o NotebookLM?",
        a: "É uma ferramenta do Google que responde com base nos documentos que você envia, como PDFs, planilhas e links, e cria resumos, perguntas e até áudios explicativos a partir desse material.",
      },
      {
        q: "O que é o Veo 3?",
        a: "É o modelo de geração de vídeo do Google, que cria cenas a partir de texto, com áudio. Ele é usado em ferramentas como o Flow e foi um dos assuntos de IA mais buscados no Brasil em 2025.",
      },
    ],
  },
  "lideres-de-ia-no-brasil": {
    slug: "lideres-de-ia-no-brasil",
    eyebrow: "Guia",
    h1: "Líderes e startups de IA no Brasil",
    title: "Líderes de IA no Brasil: empresários, startups e cases com números",
    description:
      "Empresários, fundadores e startups brasileiras que estão crescendo com inteligência artificial: entrevistas, cases com números, rodadas de investimento e a Lista IA News 100.",
    intro: [
      "A IA News conta as histórias de quem está fazendo IA de verdade nos negócios no Brasil: o problema que resolveram, quanto investiram e o resultado. Esta página reúne essas entrevistas e a cobertura de startups brasileiras de IA.",
      "Os nomes mais relevantes entram na Lista IA News 100, revelada ao vivo no Palco IA News. Ninguém paga para entrar.",
    ],
    themes: [
      {
        id: "lideres",
        title: "Empresários e líderes",
        description: "Entrevistas com fundadores, CEOs e executivos que colocaram IA no centro da operação.",
        terms: ["fundador", "fundadora", "ceo", "empresári", "executiv", "diretor", "presidente", "cofundador"],
      },
      {
        id: "startups",
        title: "Startups brasileiras de IA",
        description: "Novas empresas, produtos e rodadas de investimento do ecossistema brasileiro de IA.",
        terms: ["startup", "rodada", "investimento", "aporte", "captação", "unicórnio", "venture"],
      },
      {
        id: "cases",
        title: "Cases com números",
        description: "Faturamento, economia de tempo e crescimento que empresas brasileiras atribuem à IA.",
        terms: ["faturamento", "receita", "milhões", "milhão", "cresceu", "resultado", "economia", "mil "],
      },
      {
        id: "brasil",
        title: "IA nas empresas brasileiras",
        description: "Bancos, varejo, indústria, agro, saúde e serviços: como os setores estão adotando IA.",
        terms: ["brasil", "brasileir", "banco", "varejo", "indústria", "agro", "saúde"],
      },
    ],
    cta: "contato",
    ctaTitle: "Sua empresa usa IA? Ela pode ser a próxima história",
    ctaDescription:
      "A redação da IA News procura empresários brasileiros com resultados reais de IA. Envie sua pauta: respondemos em até 2 dias úteis.",
    ctaAction: "Envie sua pauta",
    faq: [
      {
        q: "Quem são os líderes de IA no Brasil?",
        a: "São fundadores, executivos e empresários que colocaram inteligência artificial para gerar resultado nos negócios. A IA News publica entrevistas com essas pessoas e reúne os 100 nomes mais relevantes na Lista IA News 100.",
      },
      {
        q: "Como minha empresa pode aparecer na IA News?",
        a: "Envie sua pauta pela página Envie sua pauta, contando como a empresa usa IA e quais resultados teve. A redação avalia e responde em até 2 dias úteis.",
      },
      {
        q: "O que é a Lista IA News 100?",
        a: "É a seleção dos 100 nomes que fazem IA de verdade nos negócios no Brasil, escolhidos por critérios públicos. As candidaturas e indicações são gratuitas e ninguém paga para entrar.",
      },
    ],
  },
};

export const HUB_LIST = Object.values(HUBS);