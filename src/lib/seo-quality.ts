/* Regras de qualidade para busca, compartilhadas entre a matéria, os sitemaps e o IndexNow.
   Matéria muito curta continua no ar para o leitor, mas sai do índice do Google até ser ampliada:
   conteúdo raso em volume derruba a avaliação do site inteiro. */

export const MIN_INDEX_WORDS = 150;

export const EDITOR = {
  slug: "henrique-magioni",
  name: "Henrique Magioni",
  url: "https://ianewsbr.com/autor/henrique-magioni",
  id: "https://ianewsbr.com/#henrique-magioni",
};

export function wordCount(markdown: string | null | undefined) {
  const t = (markdown ?? "").replace(/[#*_>`\[\]()-]/g, " ").trim();
  return t ? t.split(/\s+/).length : 0;
}

export function isIndexable(markdown: string | null | undefined) {
  return wordCount(markdown) >= MIN_INDEX_WORDS;
}
