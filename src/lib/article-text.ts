/* Funções puras do corpo da matéria, usadas no servidor (HTML) e no navegador (índice). */

/** Âncora estável para os intertítulos (usada no índice "Nesta matéria"). */
export function anchorOf(text: string): string {
  const base = text
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
  return "s-" + (base || "secao");
}

/** Divide o corpo em duas partes para a chamada de newsletter no meio. */
export function splitBody(markdown: string): [string, string] {
  const blocks = markdown.split(/\n{2,}/).filter((b) => b.trim().length > 0);
  if (blocks.length < 5) return [markdown, ""];
  let cut = Math.round(blocks.length * 0.45);
  // não deixar um intertítulo órfão antes da chamada de newsletter
  while (cut < blocks.length - 1 && blocks[cut - 1]!.trim().startsWith("#")) cut += 1;
  return [blocks.slice(0, cut).join("\n\n"), blocks.slice(cut).join("\n\n")];
}
