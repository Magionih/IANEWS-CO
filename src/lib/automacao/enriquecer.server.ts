// Somente servidor. Enriquecimento de leads com a API nativa do Gemini + busca do Google:
// acha o Instagram oficial, o LinkedIn e o site de uma empresa e do fundador citado.
// Sem chave, devolve null. Nunca inventa: o modelo só pode responder o que achou na busca.

const GEMINI_NATIVE =
  process.env.GEMINI_NATIVE_URL ?? "https://generativelanguage.googleapis.com/v1beta/models";
const MODELS = [
  process.env.AI_FAST_MODEL ?? "gemini-3.8-flash",
  process.env.AI_FALLBACK_MODEL ?? "gemini-3.6-flash",
];

export type Enriquecido = {
  empresa: {
    instagram: string | null;
    linkedin: string | null;
    site: string | null;
    cidade: string | null;
    setor: string | null;
    brasileira: boolean | null;
    seguidores_instagram: number | null;
    descricao: string | null;
  };
  pessoa: {
    instagram: string | null;
    linkedin: string | null;
    cargo: string | null;
  } | null;
  confianca: "alta" | "media" | "baixa";
  fontes: string[];
};

function limparHandle(v: unknown): string | null {
  if (typeof v !== "string") return null;
  const s = v
    .trim()
    .replace(/^https?:\/\/(www\.)?instagram\.com\//i, "")
    .replace(/^@/, "")
    .replace(/[/?#].*$/, "");
  return /^[a-z0-9._]{2,30}$/i.test(s) ? s.toLowerCase() : null;
}

function limparUrl(v: unknown, host: string): string | null {
  if (typeof v !== "string") return null;
  const s = v.trim();
  if (!s) return null;
  try {
    const u = new URL(s.startsWith("http") ? s : `https://${s}`);
    if (host && !u.hostname.replace(/^www\./, "").endsWith(host)) return null;
    return u.toString().replace(/\/$/, "");
  } catch {
    return null;
  }
}

function extrairJson(texto: string): Record<string, unknown> | null {
  const m = texto.match(/\{[\s\S]*\}/);
  if (!m) return null;
  try {
    return JSON.parse(m[0]) as Record<string, unknown>;
  } catch {
    return null;
  }
}

export async function enriquecerLead(input: {
  empresa: string;
  site: string | null;
  pessoa: string | null;
  cargo: string | null;
  contexto: string | null;
}): Promise<Enriquecido | null> {
  const anthropicKey = process.env.ANTHROPIC_API_KEY;
  const apiKey = process.env.AI_API_KEY ?? process.env.GEMINI_API_KEY;
  if (!anthropicKey && !apiKey) return null;
  const prompt = [
    "Você é pesquisador da IA News (mídia brasileira sobre IA e negócios). Use a busca do Google para achar os canais OFICIAIS abaixo.",
    `Empresa: ${input.empresa}${input.site ? ` (site informado: ${input.site})` : ""}`,
    input.pessoa ? `Pessoa: ${input.pessoa}${input.cargo ? `, ${input.cargo}` : ""}` : "",
    input.contexto ? `Contexto: ${input.contexto.slice(0, 600)}` : "",
    "",
    "Regras: só informe um dado se encontrou numa fonte (site da empresa, perfil verificado, LinkedIn, imprensa). Se não tiver certeza, deixe null. Nunca chute um @ parecido.",
    "Responda SOMENTE com um JSON neste formato:",
    JSON.stringify({
      empresa: {
        instagram: "handle sem @ ou null",
        linkedin: "url linkedin.com/company/... ou null",
        site: "url ou null",
        cidade: "cidade/UF ou null",
        setor: "setor em 2 a 4 palavras ou null",
        brasileira: "true/false/null",
        seguidores_instagram: "número aproximado ou null",
        descricao: "1 frase sobre o que a empresa faz ou null",
      },
      pessoa: {
        instagram: "handle ou null",
        linkedin: "url linkedin.com/in/... ou null",
        cargo: "cargo ou null",
      },
      confianca: "alta|media|baixa",
      fontes: ["urls usadas"],
    }),
  ]
    .filter(Boolean)
    .join("\n");

  const normalizar = (obj: Record<string, unknown>): Enriquecido => {
    const e = (obj.empresa ?? {}) as Record<string, unknown>;
    const p = (obj.pessoa ?? null) as Record<string, unknown> | null;
    const conf = String(obj.confianca ?? "baixa");
    const seg = Number(e.seguidores_instagram);
    return {
      empresa: {
        instagram: limparHandle(e.instagram),
        linkedin: limparUrl(e.linkedin, "linkedin.com"),
        site: limparUrl(e.site, ""),
        cidade: typeof e.cidade === "string" ? e.cidade.slice(0, 80) : null,
        setor: typeof e.setor === "string" ? e.setor.slice(0, 60) : null,
        brasileira:
          e.brasileira === true || e.brasileira === "true"
            ? true
            : e.brasileira === false || e.brasileira === "false"
              ? false
              : null,
        seguidores_instagram: Number.isFinite(seg) && seg > 0 ? Math.round(seg) : null,
        descricao: typeof e.descricao === "string" ? e.descricao.slice(0, 300) : null,
      },
      pessoa:
        p && input.pessoa
          ? {
              instagram: limparHandle(p.instagram),
              linkedin: limparUrl(p.linkedin, "linkedin.com"),
              cargo: typeof p.cargo === "string" ? p.cargo.slice(0, 80) : null,
            }
          : null,
      confianca: conf === "alta" || conf === "media" ? conf : "baixa",
      fontes: Array.isArray(obj.fontes)
        ? (obj.fontes.filter((f) => typeof f === "string").slice(0, 6) as string[])
        : [],
    };
  };

  // Claude com busca na web (API da Anthropic)
  if (anthropicKey) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 90_000);
    try {
      const res = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        signal: controller.signal,
        headers: {
          "x-api-key": anthropicKey,
          "anthropic-version": "2023-06-01",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: process.env.ANTHROPIC_FAST_MODEL ?? "claude-haiku-5-5",
          max_tokens: 2048,
          messages: [{ role: "user", content: prompt }],
          tools: [{ type: "web_search_20250305", name: "web_search", max_uses: 4 }],
        }),
      });
      if (!res.ok) throw new Error(`Claude ${res.status}: ${(await res.text()).slice(0, 200)}`);
      const json = (await res.json()) as { content?: { type: string; text?: string }[] };
      const texto = (json.content ?? [])
        .filter((c) => c.type === "text")
        .map((c) => c.text ?? "")
        .join("\n");
      const obj = extrairJson(texto);
      if (!obj) throw new Error("Claude não devolveu JSON.");
      return normalizar(obj);
    } finally {
      clearTimeout(timer);
    }
  }

  let ultimoErro: unknown = null;
  for (const model of MODELS) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 50_000);
    try {
      const res = await fetch(`${GEMINI_NATIVE}/${model}:generateContent`, {
        method: "POST",
        signal: controller.signal,
        headers: { "x-goog-api-key": apiKey as string, "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ role: "user", parts: [{ text: prompt }] }],
          tools: [{ google_search: {} }],
          generationConfig: { temperature: 0.1 },
        }),
      });
      if (!res.ok) {
        const t = (await res.text()).slice(0, 200);
        if ([404, 429, 503].includes(res.status)) {
          ultimoErro = new Error(`IA ${res.status} (${model}): ${t}`);
          continue;
        }
        throw new Error(`IA ${res.status}: ${t}`);
      }
      const json = (await res.json()) as {
        candidates?: { content?: { parts?: { text?: string }[] } }[];
      };
      const texto = (json.candidates?.[0]?.content?.parts ?? []).map((p) => p.text ?? "").join("");
      const obj = extrairJson(texto);
      if (!obj) throw new Error("IA não devolveu JSON.");
      return normalizar(obj);
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
