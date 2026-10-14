import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { SITE_URL, supabaseAnon } from "../supabase";
import { allowCall, cached, RATE_LIMITED, toPublicArticle } from "../guard";

export default defineTool({
  name: "list_articles",
  title: "Listar matérias",
  description:
    "Lista as matérias publicadas mais recentes do IA News, retornando apenas título, resumo e link.",
  inputSchema: {
    limit: z.number().int().min(1).max(50).optional().describe("Quantidade de matérias (1-50, padrão 10)."),
    category: z.string().trim().max(60).optional().describe("Filtra por categoria, ex.: 'Negócios'."),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ limit, category }) => {
    if (!allowCall("list_articles")) return RATE_LIMITED;
    const n = limit ?? 10;
    const key = `list:${n}:${category ?? ""}`;
    const result = await cached(key, async () => {
      const supabase = supabaseAnon();
      let query = supabase
        .from("articles")
        .select("slug,title,dek")
        .order("published_at", { ascending: false })
        .limit(n);
      if (category) query = query.eq("category", category);
      const { data, error } = await query;
      if (error) return { error: error.message };
      return { items: (data ?? []).map((a) => toPublicArticle(a, SITE_URL)) };
    });
    if ("error" in result) return { content: [{ type: "text", text: result.error! }], isError: true };
    return {
      content: [{ type: "text", text: JSON.stringify(result.items, null, 2) }],
      structuredContent: { articles: result.items },
    };
  },
});
