// Sugestão de menções com IA (mesmo provedor da automação de notícias: AI_BASE_URL / AI_API_KEY).
// Só servidor. Sem chave configurada, devolve null e o CRM usa só as regras de texto.

const AI_BASE_URL =
  process.env.AI_BASE_URL ?? "https://generativelanguage.googleapis.com/v1beta/openai";
const FAST_MODEL = process.env.AI_FAST_MODEL ?? "gemini-2.5-flash";

export type SugestaoIa = {
  empresas: { nome: string; brasileira: boolean | null }[];
  pessoas: { nome: string; empresa: string | null; cargo: string | null }[];
};

const SCHEMA = {
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

export async function sugerirComIa(artigo: {
  title: string;
  dek: string | null;
  tags: string[] | null;
  body_markdown: string | null;
}): Promise<SugestaoIa | null> {
  const apiKey = process.env.AI_API_KEY ?? process.env.GEMINI_API_KEY;
  if (!apiKey) return null;

  const texto = [
    `Título: ${artigo.title}`,
    artigo.dek ? `Linha fina: ${artigo.dek}` : "",
    artigo.tags?.length ? `Tags: ${artigo.tags.join(", ")}` : "",
    `Texto:\n${(artigo.body_markdown ?? "").slice(0, 6000)}`,
  ]
    .filter(Boolean)
    .join("\n");

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
          {
            role: "system",
            content:
              "Você extrai menções de uma matéria jornalística. Liste só empresas, startups, instituições e pessoas reais citadas explicitamente no texto. Não invente nada. Para pessoas, informe a empresa e o cargo apenas se estiverem no texto. 'brasileira' é true se a empresa é brasileira ou opera no Brasil segundo o texto, false se é estrangeira sem operação no Brasil, null se o texto não diz. Ignore produtos, modelos de IA e lugares.",
          },
          { role: "user", content: texto },
        ],
        response_format: {
          type: "json_schema",
          json_schema: { name: "mencoes", strict: true, schema: SCHEMA },
        },
      }),
    });
    if (!res.ok) throw new Error(`IA ${res.status}: ${(await res.text()).slice(0, 200)}`);
    const json = (await res.json()) as { choices?: { message?: { content?: string } }[] };
    const content = json.choices?.[0]?.message?.content;
    if (!content) return null;
    const parsed = JSON.parse(content) as SugestaoIa;
    const limpa = (s: string | null | undefined) => (s ?? "").trim().slice(0, 200);
    return {
      empresas: (parsed.empresas ?? [])
        .map((e) => ({
          nome: limpa(e.nome),
          brasileira: typeof e.brasileira === "boolean" ? e.brasileira : null,
        }))
        .filter((e) => e.nome.length >= 2)
        .slice(0, 15),
      pessoas: (parsed.pessoas ?? [])
        .map((p) => ({
          nome: limpa(p.nome),
          empresa: limpa(p.empresa) || null,
          cargo: limpa(p.cargo) || null,
        }))
        .filter((p) => p.nome.length >= 3)
        .slice(0, 15),
    };
  } finally {
    clearTimeout(timer);
  }
}
