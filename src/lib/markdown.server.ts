/* Markdown → HTML no servidor. O navegador recebe o HTML pronto e não baixa o leitor de markdown.
   HTML cru do texto é descartado e o resultado passa pelo sanitizador (sem javascript: em links). */
import { unified } from "unified";
import remarkParse from "remark-parse";
import remarkGfm from "remark-gfm";
import remarkRehype from "remark-rehype";
import rehypeSanitize, { defaultSchema } from "rehype-sanitize";
import rehypeStringify from "rehype-stringify";

import { anchorOf } from "@/lib/article-text";

type HNode = {
  type: string;
  tagName?: string;
  value?: string;
  properties?: Record<string, unknown>;
  children?: HNode[];
};

function textOf(n: HNode): string {
  if (n.type === "text") return n.value ?? "";
  return (n.children ?? []).map(textOf).join("");
}

/** Intertítulos h2 com id estável; links externos abrem em nova aba sem vazar a origem. */
function decorate() {
  return (tree: HNode) => {
    const walk = (n: HNode) => {
      if (n.type === "element" && n.tagName === "h2") {
        n.properties = { ...(n.properties ?? {}), id: anchorOf(textOf(n)) };
      }
      if (n.type === "element" && n.tagName === "a") {
        const href = String(n.properties?.href ?? "");
        if (/^https?:\/\//i.test(href) && !/^https?:\/\/(www\.)?ianewsbr\.com/i.test(href)) {
          n.properties = { ...(n.properties ?? {}), target: "_blank", rel: "noopener noreferrer" };
        }
      }
      (n.children ?? []).forEach(walk);
    };
    walk(tree);
  };
}

const schema = { ...defaultSchema, clobberPrefix: "" };

const processor = unified()
  .use(remarkParse)
  .use(remarkGfm)
  .use(remarkRehype)
  .use(rehypeSanitize, schema)
  .use(decorate)
  .use(rehypeStringify);

export function mdToHtml(markdown: string | null | undefined): string {
  if (!markdown) return "";
  return String(processor.processSync(markdown));
}
