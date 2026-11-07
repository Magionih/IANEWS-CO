// Somente servidor. Chamadas de IA da máquina comercial, no mesmo provedor da automação de
// notícias (AI_BASE_URL / AI_API_KEY / AI_FAST_MODEL). Sem chave, as funções devolvem null.

const AI_BASE_URL =
  process.env.AI_BASE_URL ?? "https://generativelanguage.googleapis.com/v1beta/openai";
const FAST_MODEL = process.env.AI_FAST_MODEL ?? "gemini-3.8-flash";

async function chamarIa<T>(
  system: string,
  user: string,
  schema: object,
  nome: string,
): Promise<T | null> {
  const apiKey = process.env.AI_API_KEY ?? process.env.GEMINI_API_KEY;
  if (!apiKey) return null;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 30_000);
  try {
    const res = await fetch(`${AI_BASE_URL.replace(/\/$/, "")}/chat/completions`, {
      method: "POST",
      signal: controller.signal,
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: FAST_MODEL,
        messages: [
          { role: "system", content: system },
          { role: "user", content: user },
        ],
        response_format: { type: "json_schema", json_schema: { name: nome, strict: true, schema } },
      }),
    });
    if (!res.ok) throw new Error(`IA ${res.status}: ${(await res.text()).slice(0, 200)}`);
    const json = (await res.json()) as { choices?: { message?: { content?: string } }[] };
    const content = json.choices?.[0]?.message?.content;
    return content ? (JSON.parse(content) as T) : null;
  } finally {
    clearTimeout(timer);
  }
}

export type Mencoes = {
  empresas: { nome: string; brasileira: boolean | null }[];
  pessoas: { nome: string; empresa: string | null; cargo: string | null }[];
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
          required: ["nome", "brasileira"],
          properties: { nome: { type: "string" }, brasileira: { type: ["boolean", "null"] } },
        },
      },
      pessoas: {
        type: "array",
        items: {
          type: "object",
          additionalProperties: false,
          required: ["nome", "empresa", "cargo"],
          properties: {
            nome: { type: "string" },
            empresa: { type: ["string", "null"] },
            cargo: { type: ["string", "null"] },
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
    "Você extrai menções de uma matéria jornalística. Liste só empresas, startups, instituições e pessoas reais citadas explicitamente no texto. Não invente nada. Para pessoas, informe a empresa e o cargo apenas se estiverem no texto. 'brasileira' é true se a empresa é brasileira ou opera no Brasil segundo o texto, false se é estrangeira sem operação no Brasil, null se o texto não diz. Ignore produtos, modelos de IA e lugares.",
    texto,
    schema,
    "mencoes",
  );
  if (!r) return null;
  const limpa = (s: string | null | undefined) => (s ?? "").trim().slice(0, 200);
  return {
    empresas: (r.empresas ?? [])
      .map((e) => ({
        nome: limpa(e.nome),
        brasileira: typeof e.brasileira === "boolean" ? e.brasileira : null,
      }))
      .filter((e) => e.nome.length >= 2)
      .slice(0, 15),
    pessoas: (r.pessoas ?? [])
      .map((p) => ({
        nome: limpa(p.nome),
        empresa: limpa(p.empresa) || null,
        cargo: limpa(p.cargo) || null,
      }))
      .filter((p) => p.nome.length >= 3)
      .slice(0, 15),
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
