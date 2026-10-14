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
    ctaAction: "Falar com a redação",
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
    ctaAction: "Falar com a redação",
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
};

export const HUB_LIST = Object.values(HUBS);
