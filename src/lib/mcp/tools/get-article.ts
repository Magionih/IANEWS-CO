import { defineTool, ToolError } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { SITE_URL, supabaseAnon } from "../supabase";
import { allowCall, cached, RATE_LIMITED } from "../guard";

export default defineTool({
  name: "get_article",
  title: "Ler matéria",
  description:
    "Retorna o texto público de uma matéria do IA News pelo slug: título, resumo, link e conteúdo editorial.",
  inputSchema: {
    slug: z
      .string()
      .trim()
      .min(1)
      .max(200)
      .regex(/^[a-z0-9-]+$/i, "Slug inválido.")
      .describe("Slug da matéria, ex.: 'ia-generativa-no-varejo'."),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ slug }) => {
    if (!allowCall("get_article")) return RATE_LIMITED;
    const result = await cached(`article:${slug.toLowerCase()}`, async () => {
      const supabase = supabaseAnon();
      const { data, error } = await supabase
        .from("articles")
        .select("slug,title,dek,body_markdown")
        .eq("slug", slug)
        .maybeSingle();
      if (error) return { error: error.message };
      if (!data) return { missing: true as const };
      return {
        article: {
          title: data.title,
          summary: data.dek ?? "",
          url: `${SITE_URL}/materia/${data.slug}`,
          content: data.body_markdown ?? "",
        },
      };
    });
    if ("error" in result) return { content: [{ type: "text", text: result.error! }], isError: true };
    if ("missing" in result) throw new ToolError(`Nenhuma matéria encontrada com o slug "${slug}".`);
    return {
      content: [{ type: "text", text: JSON.stringify(result.article, null, 2) }],
      structuredContent: { article: result.article },
    };
  },
});
