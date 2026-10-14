// Server-only: pipeline de ingestão de notícias reais (Google Notícias -> curadoria IA -> banco).
import { supabaseAdmin } from "@/integrations/supabase/client.server";

export const CATEGORIES = [
  "bigtech",
  "startup",
  "brasil",
  "global",
  "mercado",
  "pesquisa",
  "regulacao",
  "ferramentas",
  "generativa",
] as const;
export type Category = (typeof CATEGORIES)[number];

const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126 Safari/537.36";

// Fetch com timeout para nunca travar a requisição do painel.
async function safeFetch(input: string, init: RequestInit = {}, ms = 12000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), ms);
  try {
    return await fetch(input, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

export const TOPICS = {
  geral: "inteligência artificial",
  bigtech: "OpenAI OR Anthropic OR \"Google Gemini\" OR Microsoft OR Meta inteligência artificial",
  brasil: "inteligência artificial Brasil empresas",
  regulacao: "regulação OR lei inteligência artificial",
  mercado: "investimento OR mercado inteligência artificial negócios",
  startup: "startup inteligência artificial rodada investimento",
  pesquisa: "pesquisa OR modelo OR benchmark inteligência artificial",
  ferramentas: "ferramentas OR agentes de inteligência artificial produtividade",
} as const;
export type Topic = keyof typeof TOPICS;
export const TOPIC_KEYS = Object.keys(TOPICS) as Topic[];

// Feeds RSS diretos dos veículos: entregam a URL real da matéria (sem
// depender da resolução instável de links do Google Notícias).
type SourceFeed = { url: string; name: string; topics: Topic[]; aiOnly: boolean };

const SOURCE_FEEDS: SourceFeed[] = [
  {
    url: "https://techcrunch.com/category/artificial-intelligence/feed/",
    name: "TechCrunch",
    topics: ["geral", "bigtech", "startup", "ferramentas", "mercado"],
    aiOnly: true,
  },
  {
    url: "https://www.technologyreview.com/topic/artificial-intelligence/feed",
    name: "MIT Technology Review",
    topics: ["geral", "pesquisa", "regulacao"],
    aiOnly: true,
  },
  {
    url: "https://blog.google/technology/ai/rss/",
    name: "Google AI",
    topics: ["bigtech", "ferramentas", "pesquisa"],
    aiOnly: true,
  },
  {
    url: "https://openai.com/news/rss.xml",
    name: "OpenAI",
    topics: ["bigtech", "pesquisa", "ferramentas"],
    aiOnly: true,
  },
  {
    url: "https://canaltech.com.br/rss/",
    name: "Canaltech",
    topics: ["brasil", "geral", "ferramentas"],
    aiOnly: false,
  },
  {
    url: "https://olhardigital.com.br/feed/",
    name: "Olhar Digital",
    topics: ["brasil", "geral"],
    aiOnly: false,
  },
  {
    url: "https://exame.com/feed/",
    name: "Exame",
    topics: ["brasil", "mercado", "regulacao"],
    aiOnly: false,
  },
  {
    url: "https://neofeed.com.br/feed/",
    name: "NeoFeed",
    topics: ["brasil", "mercado", "startup"],
    aiOnly: false,
  },
  {
    url: "https://braziljournal.com/feed/",
    name: "Brazil Journal",
    topics: ["brasil", "mercado", "startup"],
    aiOnly: false,
  },
  {
    url: "https://www.infomoney.com.br/feed/",
    name: "InfoMoney",
    topics: ["mercado", "brasil"],
    aiOnly: false,
  },
  {
    url: "https://feeds.arstechnica.com/arstechnica/technology-lab",
    name: "Ars Technica",
    topics: ["geral", "pesquisa", "bigtech"],
    aiOnly: false,
  },
  {
    url: "https://www.theverge.com/rss/index.xml",
    name: "The Verge",
    topics: ["geral", "bigtech", "ferramentas"],
    aiOnly: false,
  },
];

const AI_TERMS = [
  "inteligência artificial",
  "inteligencia artificial",
  "artificial intelligence",
  " ia ",
  " ai ",
  "openai",
  "anthropic",
  "chatgpt",
  "gemini",
  "copilot",
  "claude",
  "llm",
  "machine learning",
  "aprendizado de máquina",
  "deep learning",
  "generativa",
  "generative",
  "modelo de linguagem",
  "nvidia",
  "deepseek",
  "mistral",
  "agentes de ia",
  "ai agent",
];

function looksLikeAI(text: string) {
  const t = ` ${text.toLowerCase()} `;
  return AI_TERMS.some((term) => t.includes(term));
}

export type IngestOptions = {
  limit?: number;
  topics?: Topic[];
  hours?: number;
  minWords?: number;
  requireImage?: boolean;
};

type FeedItem = { title: string; url: string; source: string; pubDate: string; summary: string };

function decodeEntities(s: string) {
  return s
    .replace(/<!\[CDATA\[|\]\]>/g, "")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&nbsp;/g, " ");
}

function tag(block: string, name: string) {
  const m = block.match(new RegExp(`<${name}[^>]*>([\\s\\S]*?)</${name}>`, "i"));
  return m ? decodeEntities(m[1]).trim() : "";
}

function attrHref(block: string) {
  // Atom: <link rel="alternate" href="..."/>
  const alt = block.match(/<link[^>]+rel=["']alternate["'][^>]*href=["']([^"']+)["']/i)?.[1];
  if (alt) return decodeEntities(alt);
  const any = block.match(/<link[^>]+href=["']([^"']+)["']/i)?.[1];
  return any ? decodeEntities(any) : "";
}

function stripTags(html: string) {
  return decodeEntities(html.replace(/<[^>]+>/g, " ")).replace(/\s+/g, " ").trim();
}

async function fetchSourceFeed(feed: SourceFeed, hours: number): Promise<FeedItem[]> {
  let xml = "";
  try {
    const res = await safeFetch(feed.url, {
      headers: { "User-Agent": UA, Accept: "application/rss+xml, application/xml, text/xml, */*" },
    });
    if (!res.ok) return [];
    xml = await res.text();
  } catch {
    return [];
  }

  const isAtom = !xml.includes("<item>") && xml.includes("<entry");
  const blocks = isAtom ? xml.split(/<entry[\s>]/).slice(1) : xml.split("<item>").slice(1);
  const cutoff = Date.now() - hours * 3600 * 1000;
  const items: FeedItem[] = [];

  for (const block of blocks.slice(0, 60)) {
    const title = tag(block, "title");
    const link = isAtom ? attrHref(block) : tag(block, "link") || attrHref(block);
    const pubDate = tag(block, "pubDate") || tag(block, "published") || tag(block, "updated") || "";
    const summary = stripTags(
      tag(block, "description") || tag(block, "summary") || tag(block, "content"),
    ).slice(0, 800);
    if (!title || !link || !/^https?:\/\//i.test(link)) continue;
    const ts = Date.parse(pubDate);
    if (Number.isFinite(ts) && ts < cutoff) continue;
    if (!feed.aiOnly && !looksLikeAI(`${title} ${summary}`)) continue;
    items.push({
      title,
      url: link.split("#")[0],
      source: feed.name,
      pubDate: pubDate || new Date().toISOString(),
      summary,
    });
  }
  return items;
}

type PageData = { text: string; image: string | null; siteName: string | null };

async function fetchPage(url: string): Promise<PageData> {
  try {
    const res = await safeFetch(url, { headers: { "User-Agent": UA } });
    const html = await res.text();
    const meta = (prop: string) =>
      html.match(
        new RegExp(`<meta[^>]+(?:property|name)=["']${prop}["'][^>]+content=["']([^"']+)["']`, "i"),
      )?.[1] ??
      html.match(
        new RegExp(`<meta[^>]+content=["']([^"']+)["'][^>]+(?:property|name)=["']${prop}["']`, "i"),
      )?.[1] ??
      null;
    const body = html
      .replace(/<script[\s\S]*?<\/script>/gi, " ")
      .replace(/<style[\s\S]*?<\/style>/gi, " ")
      .replace(/<[^>]+>/g, " ");
    const text = decodeEntities(body).replace(/\s+/g, " ").trim().slice(0, 7000);
    let image = meta("og:image") || meta("twitter:image");
    if (image && image.startsWith("//")) image = `https:${image}`;
    if (image && image.startsWith("/")) image = new URL(image, url).toString();
    return { text, image, siteName: meta("og:site_name") };
  } catch {
    return { text: "", image: null, siteName: null };
  }
}

export function slugify(input: string) {
  return input
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9\s-]/g, "")
    .trim()
    .replace(/\s+/g, "-")
    .slice(0, 80);
}

type Curated = {
  title: string;
  seo_title: string;
  seo_description: string;
  dek: string;
  body_markdown: string;
  why_it_matters: string;
  analysis_markdown: string;
  business_context: string;
  editorial_conclusion: string;
  business_impacts: string[];
  category: Category;
  tags: string[];
  read_minutes: number;
};

const WRITER_MODEL = "google/gemini-2.5-pro";
const FAST_MODEL = "google/gemini-2.5-flash";

/** Nota mínima (0-10) exigida para uma matéria ir ao ar. */
export const QUALITY_THRESHOLD = 8.2;

type AiMessage = { role: "system" | "user"; content: string };

/**
 * Chamada única ao gateway de IA com saída JSON estruturada.
 * Se o modelo premium não estiver disponível, cai para o modelo rápido.
 */
async function callAgent<T>(
  apiKey: string,
  model: string,
  messages: AiMessage[],
  schemaName: string,
  schema: Record<string, unknown>,
): Promise<T | null> {
  const request = async (m: string) =>
    safeFetch(
      "https://ai.gateway.lovable.dev/v1/chat/completions",
      {
        method: "POST",
        headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          model: m,
          messages,
          response_format: {
            type: "json_schema",
            json_schema: { name: schemaName, strict: true, schema },
          },
        }),
      },
      90000,
    );

  let res = await request(model);
  if (res.status === 400 && model !== FAST_MODEL) res = await request(FAST_MODEL);
  if (!res.ok) {
    const body = await res.text();
    if (res.status === 429)
      throw new Error("Limite de requisições da IA atingido. Tente novamente em alguns minutos.");
    if (res.status === 402) throw new Error("Créditos de IA esgotados no workspace.");
    throw new Error(`AI ${res.status}: ${body.slice(0, 200)}`);
  }
  const json = (await res.json()) as { choices?: { message?: { content?: string } }[] };
  const content = json.choices?.[0]?.message?.content;
  if (!content) return null;
  try {
    return JSON.parse(content) as T;
  } catch {
    return null;
  }
}

const NEWSROOM = `Você faz parte da redação do IA News, portal brasileiro de inteligência artificial para executivos, fundadores e decisores B2B.
Padrão editorial inegociável:
- Conteúdo 100% autoral em português do Brasil. Nunca copie, traduza ou parafraseie frases da fonte.
- Nenhum número, data, nome ou citação pode ser inventado: use só o que está no material apurado.
- Tom analítico, direto, sem hype, sem adjetivos vazios e sem clichês de IA ("revolucionário", "game changer", "no mundo cada vez mais...").
- Toda afirmação estratégica precisa vir com raciocínio explícito (porque X, então Y).`;

// ---------- Agente 1: pauta ----------
type Angle = {
  worth_publishing: boolean;
  reason: string;
  angle: string;
  thesis: string;
  key_questions: string[];
  audience_stake: string;
  category: Category;
};

async function agentAngle(item: FeedItem, page: PageData, apiKey: string) {
  return callAgent<Angle>(
    apiKey,
    FAST_MODEL,
    [
      {
        role: "system",
        content: `${NEWSROOM}
Seu papel: CHEFE DE PAUTA. Avalie se o material rende uma matéria proprietária do IA News (não um mero release ou nota curta) e defina o ângulo editorial.
Reprove (worth_publishing=false) quando: for conteúdo promocional, nota rasa sem fatos verificáveis, evento irrelevante para decisores brasileiros, ou material insuficiente para 700+ palavras com análise própria.
Categoria válida: ${CATEGORIES.join(", ")}.
Responda apenas com JSON.`,
      },
      {
        role: "user",
        content: `Manchete: ${item.title}\nVeículo: ${item.source}\nData: ${item.pubDate}\n\nMaterial apurado:\n${page.text || item.title}`,
      },
    ],
    "pauta",
    {
      type: "object",
      additionalProperties: false,
      properties: {
        worth_publishing: { type: "boolean" },
        reason: { type: "string" },
        angle: { type: "string" },
        thesis: { type: "string" },
        key_questions: { type: "array", items: { type: "string" } },
        audience_stake: { type: "string" },
        category: { type: "string", enum: [...CATEGORIES] },
      },
      required: [
        "worth_publishing",
        "reason",
        "angle",
        "thesis",
        "key_questions",
        "audience_stake",
        "category",
      ],
    },
  );
}

// ---------- Agente 2: redação ----------
const ARTICLE_SCHEMA = {
  type: "object",
  additionalProperties: false,
  properties: {
    title: { type: "string" },
    seo_title: { type: "string" },
    seo_description: { type: "string" },
    dek: { type: "string" },
    body_markdown: { type: "string" },
    why_it_matters: { type: "string" },
    analysis_markdown: { type: "string" },
    business_context: { type: "string" },
    editorial_conclusion: { type: "string" },
    business_impacts: { type: "array", items: { type: "string" } },
    category: { type: "string", enum: [...CATEGORIES] },
    tags: { type: "array", items: { type: "string" } },
    read_minutes: { type: "number" },
  },
  required: [
    "title",
    "seo_title",
    "seo_description",
    "dek",
    "body_markdown",
    "why_it_matters",
    "analysis_markdown",
    "business_context",
    "editorial_conclusion",
    "business_impacts",
    "category",
    "tags",
    "read_minutes",
  ],
} as const;

const WRITER_RULES = `Seu papel: REPÓRTER-ANALISTA SÊNIOR. Escreva a matéria proprietária do IA News seguindo o ângulo definido pela pauta.
Requisitos de forma:
- title: até 85 caracteres, palavra-chave principal no início, sem clickbait.
- seo_title até 60 chars; seo_description até 155 chars com CTA sutil; dek até 180 chars; 4 a 7 tags minúsculas.
- body_markdown: 750-1000 palavras, abertura direta com o fato e o número mais relevante, subtítulos "##" (3 a 5), pelo menos uma lista com dados concretos, contexto histórico curto e movimento do setor. Sem seção de conclusão (ela vive em outro campo).
- analysis_markdown: 3 a 5 parágrafos de análise assinada, com interpretação crítica, cenários prováveis, riscos e o que observar nos próximos meses. Não repita frases do corpo.
- business_context: 1 parágrafo (4-6 frases) sobre mercado, concorrência, custo, regulação e maturidade de adoção no Brasil.
- business_impacts: 3 a 5 itens, cada um começando pelo efeito e trazendo a consequência operacional ou financeira.
- editorial_conclusion: 3-4 frases com posicionamento claro e recomendação de ação.
- why_it_matters: 2-3 frases sobre o impacto para empresas brasileiras.
Responda apenas com JSON.`;

async function agentWrite(item: FeedItem, page: PageData, angle: Angle, apiKey: string) {
  return callAgent<Curated>(
    apiKey,
    WRITER_MODEL,
    [
      { role: "system", content: `${NEWSROOM}\n${WRITER_RULES}` },
      {
        role: "user",
        content: `PAUTA APROVADA
Ângulo: ${angle.angle}
Tese central: ${angle.thesis}
O que está em jogo para o leitor: ${angle.audience_stake}
Perguntas que a matéria precisa responder: ${(angle.key_questions ?? []).join(" | ")}
Categoria sugerida: ${angle.category}

MATERIAL APURADO
Manchete original: ${item.title}
Veículo: ${item.source}
Data: ${item.pubDate}

${page.text || item.title}`,
      },
    ],
    "materia",
    ARTICLE_SCHEMA as unknown as Record<string, unknown>,
  );
}

// ---------- Agente 3: auditoria editorial ----------
type Review = {
  score: number;
  originality: number;
  factuality: number;
  depth: number;
  seo: number;
  readability: number;
  approved: boolean;
  blocking_issues: string[];
  fix_instructions: string[];
};

async function agentReview(draft: Curated, page: PageData, apiKey: string) {
  return callAgent<Review>(
    apiKey,
    FAST_MODEL,
    [
      {
        role: "system",
        content: `${NEWSROOM}
Seu papel: EDITOR-CHEFE AUDITOR. Avalie a matéria com rigor alto e sem complacência, comparando com o material apurado.
Notas de 0 a 10 em: originalidade (não é resumo da fonte), factualidade (nada inventado, tudo sustentado pelo material), profundidade (análise própria, contexto e cenários), SEO (título, description, escaneabilidade) e legibilidade (clareza, ausência de clichê e de texto inflado).
score = média ponderada: factualidade 30%, originalidade 25%, profundidade 25%, SEO 10%, legibilidade 10%.
approved = true somente se score >= ${QUALITY_THRESHOLD} E factualidade >= 9 E não houver blocking_issues.
blocking_issues: problemas que impedem a publicação (invenção de dados, cópia da fonte, texto raso, promessa não cumprida no título).
fix_instructions: instruções objetivas e acionáveis de reescrita, campo a campo.
Responda apenas com JSON.`,
      },
      {
        role: "user",
        content: `MATERIAL APURADO (verdade de referência):\n${(page.text || "").slice(0, 6000)}\n\nMATÉRIA SUBMETIDA:\n${JSON.stringify(draft).slice(0, 20000)}`,
      },
    ],
    "auditoria",
    {
      type: "object",
      additionalProperties: false,
      properties: {
        score: { type: "number" },
        originality: { type: "number" },
        factuality: { type: "number" },
        depth: { type: "number" },
        seo: { type: "number" },
        readability: { type: "number" },
        approved: { type: "boolean" },
        blocking_issues: { type: "array", items: { type: "string" } },
        fix_instructions: { type: "array", items: { type: "string" } },
      },
      required: [
        "score",
        "originality",
        "factuality",
        "depth",
        "seo",
        "readability",
        "approved",
        "blocking_issues",
        "fix_instructions",
      ],
    },
  );
}

// ---------- Agente 4: refino final ----------
async function agentRefine(draft: Curated, review: Review, page: PageData, apiKey: string) {
  return callAgent<Curated>(
    apiKey,
    WRITER_MODEL,
    [
      { role: "system", content: `${NEWSROOM}\nSeu papel: EDITOR DE TEXTO SÊNIOR. Reescreva a matéria aplicando TODAS as correções da auditoria, mantendo o padrão de forma abaixo.\n${WRITER_RULES}` },
      {
        role: "user",
        content: `AUDITORIA
Nota: ${review.score}
Problemas bloqueantes: ${(review.blocking_issues ?? []).join(" | ") || "nenhum"}
Correções obrigatórias: ${(review.fix_instructions ?? []).join(" | ")}

MATERIAL APURADO:
${(page.text || "").slice(0, 6000)}

MATÉRIA A CORRIGIR:
${JSON.stringify(draft).slice(0, 20000)}`,
      },
    ],
    "materia",
    ARTICLE_SCHEMA as unknown as Record<string, unknown>,
  );
}

export type CurationOutcome = {
  article: Curated;
  review: Review | null;
  angle: Angle;
  revisions: number;
};

/**
 * Cadeia editorial de agentes: pauta -> redação -> auditoria -> refino.
 * Só devolve matéria aprovada pelo auditor (ou reprovada, para ser descartada).
 */
async function curateWithAgents(
  item: FeedItem,
  page: PageData,
  apiKey: string,
): Promise<{ ok: true; outcome: CurationOutcome } | { ok: false; reason: string }> {
  const angle = await agentAngle(item, page, apiKey);
  if (!angle) return { ok: false, reason: "pauta indisponível" };
  if (!angle.worth_publishing)
    return { ok: false, reason: `pauta reprovada: ${angle.reason?.slice(0, 160) ?? "sem valor editorial"}` };

  let article = await agentWrite(item, page, angle, apiKey);
  if (!article) return { ok: false, reason: "redação falhou" };

  let review = await agentReview(article, page, apiKey);
  let revisions = 0;

  // Até 2 rodadas de correção antes de descartar a matéria.
  while (review && !(review.approved && review.score >= QUALITY_THRESHOLD) && revisions < 2) {
    const refined = await agentRefine(article, review, page, apiKey);
    if (!refined) break;
    article = refined;
    revisions += 1;
    review = await agentReview(article, page, apiKey);
  }

  if (review && !(review.approved && review.score >= QUALITY_THRESHOLD)) {
    return {
      ok: false,
      reason: `reprovada na auditoria (nota ${review.score?.toFixed?.(1) ?? review.score}): ${(review.blocking_issues ?? [])[0] ?? "abaixo do padrão IA News"}`,
    };
  }

  return { ok: true, outcome: { article, review, angle, revisions } };
}

export type IngestResult = { imported: number; skipped: number; errors: string[] };

export async function runNewsIngest(
  limitOrOptions: number | IngestOptions = 8,
): Promise<IngestResult> {
  const opts: IngestOptions =
    typeof limitOrOptions === "number" ? { limit: limitOrOptions } : limitOrOptions;
  const limit = Math.max(1, Math.min(20, Math.round(opts.limit ?? 8)));
  const hours = Math.max(6, Math.min(168, Math.round(opts.hours ?? 26)));
  const minWords = Math.max(60, Math.min(1200, Math.round(opts.minWords ?? 80)));
  const requireImage = opts.requireImage ?? false;
  const topics = (opts.topics ?? []).filter((t) => TOPIC_KEYS.includes(t));
  const selected = topics.length
    ? SOURCE_FEEDS.filter((f) => f.topics.some((t) => topics.includes(t)))
    : SOURCE_FEEDS;
  const activeFeeds = selected.length ? selected : SOURCE_FEEDS;

  const apiKey = process.env.LOVABLE_API_KEY;
  if (!apiKey) throw new Error("LOVABLE_API_KEY não configurada.");

  const { data: runRow } = await supabaseAdmin
    .from("ingest_runs")
    .insert({
      status: "running",
      options: { limit, hours, minWords, requireImage, topics: topics.length ? topics : "auto" },
    })
    .select("id")
    .single();
  const runId = (runRow as { id: string } | null)?.id;

  const result: IngestResult = { imported: 0, skipped: 0, errors: [] };
  const deadline = Date.now() + 300_000; // trava de segurança: 5 min (cadeia de agentes é mais lenta)

  try {
    const feeds = await Promise.all(activeFeeds.map((f) => fetchSourceFeed(f, hours)));
    const seenTitle = new Set<string>();
    const seenUrl = new Set<string>();
    const candidates: FeedItem[] = [];
    // Intercala as fontes para não publicar tudo de um único veículo.
    const maxLen = Math.max(0, ...feeds.map((f) => f.length));
    for (let i = 0; i < maxLen; i++) {
      for (const list of feeds) {
        const item = list[i];
        if (!item) continue;
        const key = slugify(item.title).slice(0, 50);
        if (!key || seenTitle.has(key) || seenUrl.has(item.url)) continue;
        seenTitle.add(key);
        seenUrl.add(item.url);
        candidates.push(item);
      }
    }
    if (candidates.length === 0) {
      result.errors.push(
        "Nenhuma notícia nova encontrada nas fontes na janela de tempo escolhida. Aumente o período e tente de novo.",
      );
    }

    const { data: recent } = await supabaseAdmin
      .from("articles")
      .select("slug, source_url")
      .order("published_at", { ascending: false })
      .limit(300);
    const existingSlugs = new Set(((recent ?? []) as { slug: string }[]).map((r) => r.slug));
    const existingUrls = new Set(
      ((recent ?? []) as { source_url: string | null }[]).map((r) => r.source_url ?? ""),
    );

    for (const item of candidates) {
      if (result.imported >= limit) break;
      if (Date.now() > deadline) {
        result.errors.push("Tempo limite da execução atingido; publicado o que foi apurado.");
        break;
      }
      const realUrl = item.url;
      if (existingUrls.has(realUrl)) {
        result.skipped += 1;
        continue;
      }
      let page: PageData = { text: "", image: null, siteName: null };
      try {
        page = await fetchPage(realUrl);
      } catch {
        page = { text: "", image: null, siteName: null };
      }
      // O resumo do feed serve de lastro quando a página bloqueia o scraping.
      if (page.text.split(/\s+/).length < minWords && item.summary) {
        page = { ...page, text: `${item.title}. ${item.summary}` };
      }
      if (page.text.split(/\s+/).length < Math.min(minWords, 40)) {
        result.skipped += 1;
        continue;
      }
      if (requireImage && !page.image) {
        result.skipped += 1;
        continue;
      }

      let curated: Curated | null = null;
      let review: Review | null = null;
      let angleUsed: Angle | null = null;
      let revisions = 0;
      try {
        const outcome = await curateWithAgents(item, page, apiKey);
        if (!outcome.ok) {
          result.skipped += 1;
          result.errors.push(`"${item.title.slice(0, 60)}": ${outcome.reason}`);
          continue;
        }
        curated = outcome.outcome.article;
        review = outcome.outcome.review;
        angleUsed = outcome.outcome.angle;
        revisions = outcome.outcome.revisions;
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        result.errors.push(message);
        if (result.errors.filter((e) => e === message).length >= 3) break;
        continue;
      }
      if (!curated) {
        result.skipped += 1;
        continue;
      }

      let slug = slugify(curated.title);
      if (!slug) {
        result.skipped += 1;
        continue;
      }
      if (existingSlugs.has(slug)) slug = `${slug}-${Date.now().toString(36).slice(-4)}`;

      const sourceName = item.source.replace(/^.*? - /, "").slice(0, 120) || page.siteName || "Fonte";
      const { error } = await supabaseAdmin.from("articles").insert({
        slug,
        title: curated.title.slice(0, 200),
        dek: curated.dek.slice(0, 300),
        seo_title: curated.seo_title.slice(0, 70),
        seo_description: curated.seo_description.slice(0, 170),
        tags: (curated.tags ?? []).slice(0, 8).map((t) => t.toLowerCase().slice(0, 40)),
        body_markdown: curated.body_markdown,
        why_it_matters: curated.why_it_matters,
        analysis_markdown: curated.analysis_markdown ?? null,
        business_context: curated.business_context ?? null,
        editorial_conclusion: curated.editorial_conclusion ?? null,
        business_impacts: (curated.business_impacts ?? []).slice(0, 6).map((i) => i.slice(0, 400)),
        sources: [
          {
            name: sourceName,
            url: realUrl,
            published_at: item.pubDate ?? null,
          },
        ],
        author: "Análise IA News",
        category: CATEGORIES.includes(curated.category) ? curated.category : "geral",
        cover_image_url: page.image,
        source_name: sourceName,
        source_url: realUrl,
        read_minutes: Math.max(2, Math.min(15, Math.round(curated.read_minutes || 4))),
        quality_score: review?.score ?? null,
        quality_report: review ? { ...review, revisions } : null,
        editorial_angle: angleUsed?.angle ?? null,
        published_at: new Date().toISOString(),
      });
      if (error) {
        result.errors.push(error.message);
        continue;
      }
      existingSlugs.add(slug);
      existingUrls.add(realUrl);
      result.imported += 1;
    }

    if (runId) {
      await supabaseAdmin
        .from("ingest_runs")
        .update({
          status: result.imported > 0 ? "success" : "empty",
          imported_count: result.imported,
          error: result.errors.length ? result.errors.join(" | ").slice(0, 1000) : null,
          finished_at: new Date().toISOString(),
        })
        .eq("id", runId);
    }
    return result;
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    if (runId) {
      await supabaseAdmin
        .from("ingest_runs")
        .update({ status: "error", error: message.slice(0, 1000), finished_at: new Date().toISOString() })
        .eq("id", runId);
    }
    throw err;
  }
}
