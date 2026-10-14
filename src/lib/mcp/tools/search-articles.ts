import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { SITE_URL, supabaseAnon } from "../supabase";
import { allowCall, cached, RATE_LIMITED, toPublicArticle } from "../guard";

export default defineTool({
  name: "search_articles",
  title: "Buscar matérias",
  description:
    "Busca matérias publicadas do IA News por termo no título ou no resumo. Retorna apenas título, resumo e link.",
  inputSchema: {
    query: z.string().trim().min(2).max(120).describe("Termo de busca, ex.: 'agentes de IA'."),
    limit: z.number().int().min(1).max(25).optional().describe("Quantidade de resultados (1-25, padrão 10)."),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ query, limit }) => {
    if (!allowCall("search_articles")) return RATE_LIMITED;
    const term = query.replace(/[%,()]/g, " ").trim();
    const n = limit ?? 10;
    const result = await cached(`search:${term.toLowerCase()}:${n}`, async () => {
      const supabase = supabaseAnon();
      const { data, error } = await supabase
        .from("articles")
        .select("slug,title,dek")
        .or(`title.ilike.%${term}%,dek.ilike.%${term}%`)
        .order("published_at", { ascending: false })
        .limit(n);
      if (error) return { error: error.message };
      return { items: (data ?? []).map((a) => toPublicArticle(a, SITE_URL)) };
    });
    if ("error" in result) return { content: [{ type: "text", text: result.error! }], isError: true };
    return {
      content: [{ type: "text", text: JSON.stringify(result.items, null, 2) }],
      structuredContent: { results: result.items },
    };
  },
});
