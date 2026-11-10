import { comChamada } from "./chamadas";
// Somente servidor. Chamadas de IA da máquina comercial, no mesmo provedor da automação de
// notícias (AI_BASE_URL / AI_API_KEY / AI_FAST_MODEL). Sem chave, as funções devolvem null.

const AI_BASE_URL =
  process.env.AI_BASE_URL ?? "https://generativelanguage.googleapis.com/v1beta/openai";
const FAST_MODEL = process.env.AI_FAST_MODEL ?? "gemini-3.8-flash";
const FALLBACK_MODEL = process.env.AI_FALLBACK_MODEL ?? "gemini-3.6-flash";

// Claude (API da Anthropic) tem prioridade quando ANTHROPIC_API_KEY existe; senão, o provedor
// OpenAI-compatible (Gemini). A resposta estruturada vem como chamada de ferramenta com o schema.
const CLAUDE_MODEL = process.env.ANTHROPIC_MODEL ?? "claude-sonnet-5-5";
const CLAUDE_FAST = process.env.ANTHROPIC_FAST_MODEL ?? "claude-haiku-5-5";

/** Chave da Anthropic. Aceita o nome salvo na Vercel por engano (IANewws) até ser recriada como ANTHROPIC_API_KEY. */
export function chaveAnthropic(): string | undefined {
  const k = process.env.ANTHROPIC_API_KEY ?? process.env.IANewws;
  return k && k.startsWith("sk-ant-") ? k : undefined;
}

export function claudeConfigurado(): boolean {
  return Boolean(chaveAnthropic());
}

async function chamarClaude<T>(
  system: string,
  user: string,
  schema: object,
  nome: string,
  rapido: boolean,
): Promise<T> {
  const apiKey = chaveAnthropic()!;
  let ultimoErro: unknown = null;
  const modelos = rapido ? [CLAUDE_FAST, CLAUDE_MODEL] : [CLAUDE_MODEL, CLAUDE_FAST];
  for (const model of modelos) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 55_000);
    try {
      const res = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        signal: controller.signal,
        headers: {
          "x-api-key": apiKey,
          "anthropic-version": "2023-06-01",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model,
          max_tokens: 4096,
          system,
          messages: [{ role: "user", content: user }],
          tools: [
            {
              name: nome,
              description: "Devolve a resposta no formato pedido.",
              input_schema: schema,
            },
          ],
          tool_choice: { type: "tool", name: nome },
        }),
      });
      if (!res.ok) {
        const texto = (await res.text()).slice(0, 200);
        if ([404, 429, 500, 503, 529].includes(res.status)) {
          ultimoErro = new Error(`Claude ${res.status} (${model}): ${texto}`);
          continue;
        }
        throw new Error(`Claude ${res.status}: ${texto}`);
      }
      const json = (await res.json()) as {
        content?: { type: string; name?: string; input?: unknown }[];
      };
      const tool = (json.content ?? []).find((c) => c.type === "tool_use");
      if (!tool?.input) throw new Error("Claude não devolveu a resposta estruturada.");
      return tool.input as T;
    } catch (err) {
      if (err instanceof Error && err.name === "AbortError") {
        ultimoErro = new Error(`Claude tempo esgotado (${model})`);
        continue;
      }
      throw err;
    } finally {
      clearTimeout(timer);
    }
  }
  throw ultimoErro instanceof Error ? ultimoErro : new Error("Claude indisponível.");
}

async function chamarIa<T>(
  system: string,
  user: string,
  schema: object,
  nome: string,
  rapido = true,
): Promise<T | null> {
  if (claudeConfigurado()) return chamarClaude<T>(system, user, schema, nome, rapido);
  const apiKey = process.env.AI_API_KEY ?? process.env.GEMINI_API_KEY;
  if (!apiKey) return null;
  let ultimoErro: unknown = null;
  for (const model of [FAST_MODEL, FALLBACK_MODEL]) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 45_000);
    try {
      const res = await fetch(`${AI_BASE_URL.replace(/\/$/, "")}/chat/completions`, {
        method: "POST",
        signal: controller.signal,
        headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          model,
          messages: [
            { role: "system", content: system },
            { role: "user", content: user },
          ],
          response_format: {
            type: "json_schema",
            json_schema: { name: nome, strict: true, schema },
          },
        }),
      });
      if (!res.ok) {
        const texto = (await res.text()).slice(0, 200);
        // Modelo indisponível ou sobrecarregado: tenta o reserva
        if ([404, 429, 503].includes(res.status)) {
          ultimoErro = new Error(`IA ${res.status} (${model}): ${texto}`);
          continue;
        }
        throw new Error(`IA ${res.status}: ${texto}`);
      }
      const json = (await res.json()) as { choices?: { message?: { content?: string } }[] };
      const content = json.choices?.[0]?.message?.content;
      return content ? (JSON.parse(content) as T) : null;
    } catch (err) {
      if (err instanceof Error && err.name === "AbortError") {
        ultimoErro = new Error(`IA tempo esgotado (${model})`);
        continue;
      }
      throw err;
    } finally {
      clearTimeout(timer);
    }
  }
  throw ultimoErro instanceof Error ? ultimoErro : new Error("IA indisponível.");
}

export type PapelEmpresa = "protagonista" | "citada" | "veiculo" | "big_tech" | "instituicao";

export type Mencoes = {
  empresas: { nome: string; brasileira: boolean | null; papel: PapelEmpresa }[];
  pessoas: { nome: string; empresa: string | null; cargo: string | null; protagonista: boolean }[];
};

/** Empresas e pessoas reais citadas numa matéria (mesmo critério da tela Pautas do CRM). */
export async function extrairMencoes(artigo: {
  title: string;
  dek: string | null;
  tags: string[] | null;
  body_markdown: string | null;
}): Promise<Mencoes | null> {
  const schema = {
    type: "object",
    additionalProperties: false,
    required: ["empresas", "pessoas"],
    properties: {
      empresas: {
        type: "array",
        items: {
          type: "object",
          additionalProperties: false,
          required: ["nome", "brasileira", "papel"],
          properties: {
            nome: { type: "string" },
            brasileira: { type: ["boolean", "null"] },
            papel: {
              type: "string",
              enum: ["protagonista", "citada", "veiculo", "big_tech", "instituicao"],
            },
          },
        },
      },
      pessoas: {
        type: "array",
        items: {
          type: "object",
          additionalProperties: false,
          required: ["nome", "empresa", "cargo", "protagonista"],
          properties: {
            nome: { type: "string" },
            empresa: { type: ["string", "null"] },
            cargo: { type: ["string", "null"] },
            protagonista: { type: "boolean" },
          },
        },
      },
    },
  };
  const texto = [
    `Título: ${artigo.title}`,
    artigo.dek ? `Linha fina: ${artigo.dek}` : "",
    artigo.tags?.length ? `Tags: ${artigo.tags.join(", ")}` : "",
    `Texto:\n${(artigo.body_markdown ?? "").slice(0, 6000)}`,
  ]
    .filter(Boolean)
    .join("\n");
  const r = await chamarIa<Mencoes>(
    [
      "Você extrai menções de uma matéria jornalística da IA News (mídia sobre IA e negócios no Brasil) para o CRM comercial.",
      "Liste só empresas, startups, instituições e pessoas reais citadas explicitamente no texto. Não invente nada. Ignore produtos, modelos de IA e lugares.",
      "Para cada empresa, classifique o 'papel':",
      "- 'protagonista': a empresa sobre a qual a matéria é (a do fundador/executivo retratado, ou a que fez a ação principal). No máximo 2 por matéria.",
      "- 'citada': aparece de passagem (cliente, concorrente, investidor, parceiro, exemplo).",
      "- 'veiculo': jornal, revista, portal, podcast, newsletter ou perfil de imprensa usado como fonte (Exame, Estadão, Nieman Lab, PEGN etc.).",
      "- 'big_tech': Meta, Google, OpenAI, Microsoft, Amazon, Apple, Nvidia, Anthropic, xAI e similares, mesmo quando protagonistas.",
      "- 'instituicao': governo, Justiça, associação de classe, universidade, ONG.",
      "'brasileira': true só se a empresa é brasileira (sede no Brasil ou fundador brasileiro) ou tem operação própria no Brasil segundo o texto; false se é estrangeira; null se o texto não diz. Não presuma true.",
      "Para pessoas, informe a empresa e o cargo apenas se estiverem no texto; 'protagonista' é true só para a pessoa retratada na matéria.",
    ].join("\n"),
    texto,
    schema,
    "mencoes",
  );
  if (!r) return null;
  const limpa = (s: string | null | undefined) => (s ?? "").trim().slice(0, 200);
  const papeis: PapelEmpresa[] = ["protagonista", "citada", "veiculo", "big_tech", "instituicao"];
  return {
    empresas: (r.empresas ?? [])
      .map((e) => ({
        nome: limpa(e.nome),
        brasileira: typeof e.brasileira === "boolean" ? e.brasileira : null,
        papel: papeis.includes(e.papel) ? e.papel : "citada",
      }))
      .filter((e) => e.nome.length >= 2)
      .slice(0, 15),
    pessoas: (r.pessoas ?? [])
      .map((p) => ({
        nome: limpa(p.nome),
        empresa: limpa(p.empresa) || null,
        cargo: limpa(p.cargo) || null,
        protagonista: p.protagonista === true,
      }))
      .filter((p) => p.nome.length >= 3)
      .slice(0, 15),
  };
}

export type Destaque = {
  titulo: string;
  dek: string;
  body_markdown: string;
  why_it_matters: string;
  category: string;
  tags: string[];
  seo_title: string;
  seo_description: string;
  legenda: string;
  capa: { titulo: string; destaque: string; subtitulo: string };
  texto: { eyebrow: string; titulo: string; paragrafos: string[] };
  numeros: { valor: string; rotulo: string }[];
  frase: { frase: string; quem: string; cargo: string } | null;
  final: { titulo: string; texto: string };
};

/** Escreve matéria, legenda e telas do destaque a partir do briefing preenchido pelo lead. */
export async function redigirDestaque(input: {
  dados: Record<string, unknown>;
  empresa: string | null;
  pessoa: string | null;
  tipo: "pago" | "cortesia";
  ajuste: string | null;
  anterior: Destaque | null;
}): Promise<Destaque | null> {
  const str = { type: "string" };
  const schema = {
    type: "object",
    additionalProperties: false,
    required: [
      "titulo",
      "dek",
      "body_markdown",
      "why_it_matters",
      "category",
      "tags",
      "seo_title",
      "seo_description",
      "legenda",
      "capa",
      "texto",
      "numeros",
      "frase",
      "final",
    ],
    properties: {
      titulo: str,
      dek: str,
      body_markdown: str,
      why_it_matters: str,
      category: {
        type: "string",
        enum: ["brasil", "startup", "mercado", "ferramentas", "generativa"],
      },
      tags: { type: "array", items: str },
      seo_title: str,
      seo_description: str,
      legenda: str,
      capa: {
        type: "object",
        additionalProperties: false,
        required: ["titulo", "destaque", "subtitulo"],
        properties: { titulo: str, destaque: str, subtitulo: str },
      },
      texto: {
        type: "object",
        additionalProperties: false,
        required: ["eyebrow", "titulo", "paragrafos"],
        properties: { eyebrow: str, titulo: str, paragrafos: { type: "array", items: str } },
      },
      numeros: {
        type: "array",
        items: {
          type: "object",
          additionalProperties: false,
          required: ["valor", "rotulo"],
          properties: { valor: str, rotulo: str },
        },
      },
      frase: {
        type: ["object", "null"],
        additionalProperties: false,
        required: ["frase", "quem", "cargo"],
        properties: { frase: str, quem: str, cargo: str },
      },
      final: {
        type: "object",
        additionalProperties: false,
        required: ["titulo", "texto"],
        properties: { titulo: str, texto: str },
      },
    },
  };
  const d = input.dados;
  const campo = (k: string) =>
    typeof d[k] === "string" && (d[k] as string).trim() ? (d[k] as string).trim() : null;
  const briefing = [
    `Nome: ${campo("nome") ?? input.pessoa ?? "-"}`,
    `Cargo: ${campo("cargo") ?? "-"}`,
    `Empresa: ${campo("empresa") ?? input.empresa ?? "-"}`,
    campo("como_aparecer") ? `Como quer aparecer: ${campo("como_aparecer")}` : "",
    `Trajetória: ${campo("trajetoria") ?? "-"}`,
    campo("ia_entrou") ? `Como a IA entrou: ${campo("ia_entrou")}` : "",
    `Resultados: ${campo("resultados") ?? "-"}`,
    campo("frase") ? `Frase sobre IA: ${campo("frase")}` : "",
    campo("site") ? `Site: ${campo("site")}` : "",
    campo("observacoes") ? `Observações: ${campo("observacoes")}` : "",
  ]
    .filter(Boolean)
    .join("\n");
  const system = [
    "Você é a redação da IA News (mídia brasileira sobre IA e negócios: portal ianewsbr.com, Instagram @ianews.co). Escreve em português do Brasil, padrão jornalístico, sem adjetivos vazios, sem clichê de release.",
    "Fonte ÚNICA de fatos: o briefing abaixo, preenchido pela própria pessoa. Nunca invente número, cargo, cliente, data ou citação. Se faltar número, escreva sem número. Não prometa nada e não use 'revolucionário', 'disruptivo', 'inovador'.",
    "Padrão da matéria: título estilo Forbes, sempre com o nome da pessoa e a empresa, até 110 caracteres (ex.: 'Ana Souza, da Exemplo: agente de IA no WhatsApp dobrou as vendas em 6 meses'). Linha fina de 1 a 2 frases. body_markdown com 300 a 550 palavras: parágrafos curtos, **negrito** em nomes, empresa e números-chave, intertítulos '## ' (Quem é, O que fez com IA, Resultados) e terminar com '## Por que importa' seguido de uma linha em itálico '*Fonte: briefing enviado por <nome> à IA News.*'. why_it_matters com 1 a 2 frases.",
    "Legenda do Instagram: primeira linha é o gancho em negrito (use *asteriscos*), 2 parágrafos curtos, uma frase em aspas da pessoa se houver, pergunta de engajamento, 'Matéria completa em ianewsbr.com (link na bio)' e 5 a 7 hashtags em pt-BR no fim.",
    "Telas do carrossel (4:5): capa.titulo até 70 caracteres em frase forte com o nome da pessoa (capa.destaque = as 2 ou 3 palavras do título a realçar, normalmente o nome); capa.subtitulo = empresa + o que fez, até 110 caracteres. texto: eyebrow curto (ex.: 'O que mudou com IA'), titulo até 80 caracteres, 2 ou 3 parágrafos de até 160 caracteres cada. numeros: 0 a 3 itens só com números que estão no briefing (valor curto como 'R$ 3 mi' ou '900%', rotulo até 60 caracteres); se não houver número, lista vazia. frase: a frase da pessoa sobre IA se houver (até 140 caracteres), senão null. final: titulo até 70 e texto até 150 caracteres chamando para a matéria.",
    "tags: 4 a 7 termos minúsculos (pessoa, empresa, tema, 'brasileiros na ia'). seo_title até 65 caracteres, seo_description até 155.",
    input.tipo === "cortesia"
      ? "Este é um destaque de cortesia: tom editorial, sem linguagem de anúncio."
      : "Este é um destaque contratado: tom editorial; a sinalização de parceria é colocada pela equipe, não escreva 'publicidade'.",
    input.ajuste && input.anterior
      ? `A pessoa pediu este ajuste na prévia anterior: "${input.ajuste}". Reescreva atendendo ao pedido e mantendo o resto. Versão anterior (JSON): ${JSON.stringify(input.anterior).slice(0, 6000)}`
      : "",
  ]
    .filter(Boolean)
    .join("\n");
  const r = await chamarIa<Destaque>(system, `Briefing:\n${briefing}`, schema, "destaque", false);
  if (!r) return null;
  const limpa = (s: unknown, n: number) => (typeof s === "string" ? s.trim().slice(0, n) : "");
  return {
    titulo: limpa(r.titulo, 140),
    dek: limpa(r.dek, 260),
    body_markdown: limpa(r.body_markdown, 8000),
    why_it_matters: limpa(r.why_it_matters, 400),
    category: ["brasil", "startup", "mercado", "ferramentas", "generativa"].includes(r.category)
      ? r.category
      : "brasil",
    tags: (r.tags ?? [])
      .map((t) => limpa(t, 40).toLowerCase())
      .filter(Boolean)
      .slice(0, 7),
    seo_title: limpa(r.seo_title, 70),
    seo_description: limpa(r.seo_description, 160),
    legenda: comChamada(limpa(r.legenda, 2160), "destaque", JSON.stringify(input.dados ?? {})),
    capa: {
      titulo: limpa(r.capa?.titulo, 90),
      destaque: limpa(r.capa?.destaque, 40),
      subtitulo: limpa(r.capa?.subtitulo, 130),
    },
    texto: {
      eyebrow: limpa(r.texto?.eyebrow, 40),
      titulo: limpa(r.texto?.titulo, 100),
      paragrafos: (r.texto?.paragrafos ?? [])
        .map((p) => limpa(p, 200))
        .filter(Boolean)
        .slice(0, 3),
    },
    numeros: (r.numeros ?? [])
      .map((n) => ({ valor: limpa(n.valor, 14), rotulo: limpa(n.rotulo, 70) }))
      .filter((n) => n.valor && n.rotulo)
      .slice(0, 3),
    frase:
      r.frase && limpa(r.frase.frase, 160)
        ? {
            frase: limpa(r.frase.frase, 160),
            quem: limpa(r.frase.quem, 60),
            cargo: limpa(r.frase.cargo, 80),
          }
        : null,
    final: { titulo: limpa(r.final?.titulo, 90), texto: limpa(r.final?.texto, 170) },
  };
}

export type RespostaAgente = {
  acao: "responder" | "passar_para_humano";
  motivo: string;
  resposta: string;
};

const MANUAL = `Você é o assistente de atendimento da IA News no WhatsApp (mídia brasileira sobre IA e negócios:
portal ianewsbr.com, Instagram @ianews.co, newsletter diária às 7h e canal no WhatsApp).
Regras:
- Português do Brasil, tom humano e cordial, frases curtas, no máximo 1 emoji, nunca o mesmo emoji duas vezes seguidas.
- Se perguntarem se você é uma pessoa, diga que é o assistente da IA News e que a equipe acompanha a conversa.
- Você pode explicar: como funciona a matéria de destaque (o time escreve a matéria e as artes, o lead aprova a prévia
  antes de publicar; sai no portal, no Instagram, na newsletter e no canal), o que o briefing pede (dados, trajetória,
  resultados, uma frase sobre IA, 3 a 5 fotos e o logo) e que o briefing é preenchido num link com progresso salvo.
- Nunca informe preço, desconto, prazo garantido nem condição comercial. Nunca prometa publicação.
- Passe para humano (acao "passar_para_humano") quando: pedirem valor, proposta, publicidade, workshop, contrato ou
  nota fiscal; houver reclamação ou tom negativo; pedirem para não receber mais mensagens; o assunto sair do manual.
  Nesses casos a resposta é curta: avise que alguém da equipe vai responder em breve.
- Nunca redirecione o lead para o site da IA News como forma de encerrar a conversa.`;

/** Decide e escreve a resposta do agente; null quando não há chave de IA. */
export async function responderComoAgente(
  historico: { tipo: string; texto: string }[],
  ultima: string,
  linkBriefing: string | null,
): Promise<RespostaAgente | null> {
  const schema = {
    type: "object",
    additionalProperties: false,
    required: ["acao", "motivo", "resposta"],
    properties: {
      acao: { type: "string", enum: ["responder", "passar_para_humano"] },
      motivo: { type: "string" },
      resposta: { type: "string" },
    },
  };
  const conversa = historico
    .map(
      (h) =>
        `${h.tipo === "mensagem_recebida" ? "Lead" : "IA News"}: ${h.texto.replace(/\s*\[wa:[^\]]*\]/, "")}`,
    )
    .join("\n")
    .slice(-6000);
  const extra = linkBriefing ? `\nLink do briefing deste lead: ${linkBriefing}` : "";
  return chamarIa<RespostaAgente>(
    MANUAL + extra,
    `Conversa até agora:\n${conversa}\n\nÚltima mensagem do lead:\n${ultima}`,
    schema,
    "resposta_agente",
  );
}

export type CarrosselNoticia = {
  capa: { titulo: string; destaque: string; subtitulo: string };
  texto: { eyebrow: string; titulo: string; paragrafos: string[] };
  numeros: { valor: string; rotulo: string }[];
  frase: { frase: string; quem: string; cargo: string } | null;
  final: { titulo: string; texto: string };
  legenda: string;
};

/** Telas e legenda do carrossel de uma matéria de notícia já escrita (sem inventar nada além do texto). */
export async function redigirCarrosselNoticia(artigo: {
  title: string;
  dek: string | null;
  body_markdown: string | null;
  tags: string[] | null;
  sources: unknown;
}): Promise<CarrosselNoticia | null> {
  const str = { type: "string" };
  const schema = {
    type: "object",
    additionalProperties: false,
    required: ["capa", "texto", "numeros", "frase", "final", "legenda"],
    properties: {
      capa: {
        type: "object",
        additionalProperties: false,
        required: ["titulo", "destaque", "subtitulo"],
        properties: { titulo: str, destaque: str, subtitulo: str },
      },
      texto: {
        type: "object",
        additionalProperties: false,
        required: ["eyebrow", "titulo", "paragrafos"],
        properties: { eyebrow: str, titulo: str, paragrafos: { type: "array", items: str } },
      },
      numeros: {
        type: "array",
        items: {
          type: "object",
          additionalProperties: false,
          required: ["valor", "rotulo"],
          properties: { valor: str, rotulo: str },
        },
      },
      frase: {
        type: ["object", "null"],
        additionalProperties: false,
        required: ["frase", "quem", "cargo"],
        properties: { frase: str, quem: str, cargo: str },
      },
      final: {
        type: "object",
        additionalProperties: false,
        required: ["titulo", "texto"],
        properties: { titulo: str, texto: str },
      },
      legenda: str,
    },
  };
  const fontes = Array.isArray(artigo.sources)
    ? (artigo.sources as { name?: string; url?: string }[])
        .map((s) => s.name)
        .filter(Boolean)
        .join(", ")
    : "";
  const system = [
    "Você é a redação da IA News (Instagram @ianews.co). Transforme a matéria abaixo em um carrossel de 4:5 e na legenda. Fonte ÚNICA: o texto da matéria. Não acrescente fato, número ou citação que não esteja nela.",
    "capa.titulo: até 70 caracteres, frase forte com o nome da pessoa ou empresa protagonista; capa.destaque: 2 ou 3 palavras do título a realçar (normalmente o nome); capa.subtitulo: até 110 caracteres com o fato principal.",
    "texto: eyebrow curto (ex.: 'O que aconteceu'), titulo até 80 caracteres, 2 ou 3 parágrafos de até 160 caracteres cada, em ordem: fato, como, contexto Brasil.",
    "numeros: 0 a 3 números que estão na matéria (valor curto como 'R$ 12 mi', '900%', '1,2 milhão'; rotulo até 60 caracteres). Sem número na matéria, lista vazia.",
    "frase: uma citação direta que esteja na matéria (até 140 caracteres), com quem e cargo; senão null.",
    "final: titulo até 70 e texto até 150 caracteres chamando para a matéria completa.",
    "legenda: primeira linha é o gancho em negrito (*asteriscos*), 2 parágrafos curtos, pergunta de engajamento, 'Matéria completa em ianewsbr.com (link na bio)', crédito 'Fonte: " +
      (fontes || "IA News") +
      "' e 5 a 7 hashtags em pt-BR.",
  ].join("\n");
  const texto = [
    `Título: ${artigo.title}`,
    artigo.dek ? `Linha fina: ${artigo.dek}` : "",
    artigo.tags?.length ? `Tags: ${artigo.tags.join(", ")}` : "",
    `Texto:\n${(artigo.body_markdown ?? "").slice(0, 7000)}`,
  ]
    .filter(Boolean)
    .join("\n");
  const r = await chamarIa<CarrosselNoticia>(system, texto, schema, "carrossel_noticia", true);
  if (!r) return null;
  const limpa = (s: unknown, n: number) => (typeof s === "string" ? s.trim().slice(0, n) : "");
  return {
    capa: {
      titulo: limpa(r.capa?.titulo, 90),
      destaque: limpa(r.capa?.destaque, 40),
      subtitulo: limpa(r.capa?.subtitulo, 130),
    },
    texto: {
      eyebrow: limpa(r.texto?.eyebrow, 40),
      titulo: limpa(r.texto?.titulo, 100),
      paragrafos: (r.texto?.paragrafos ?? [])
        .map((p) => limpa(p, 200))
        .filter(Boolean)
        .slice(0, 3),
    },
    numeros: (r.numeros ?? [])
      .map((n) => ({ valor: limpa(n.valor, 14), rotulo: limpa(n.rotulo, 70) }))
      .filter((n) => n.valor && n.rotulo)
      .slice(0, 3),
    frase:
      r.frase && limpa(r.frase.frase, 160)
        ? {
            frase: limpa(r.frase.frase, 160),
            quem: limpa(r.frase.quem, 60),
            cargo: limpa(r.frase.cargo, 80),
          }
        : null,
    final: { titulo: limpa(r.final?.titulo, 90), texto: limpa(r.final?.texto, 170) },
    legenda: comChamada(limpa(r.legenda, 2160), "noticia", `${artigo.title} ${artigo.dek ?? ""} ${(artigo.tags ?? []).join(" ")}`),
  };
}
