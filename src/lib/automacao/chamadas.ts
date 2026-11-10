/* Chamada com palavra-chave no fim de cada legenda automática: leva quem leu o post para o mini chat da
   Renata no Direct (src/lib/automacao/minichat.server.ts). A palavra combina com o assunto do post. */

const SETOR = /sa[uú]de|cl[ií]nica|hospital|m[eé]dic|varejo|e-?commerce|loja|ind[uú]stria|f[aá]brica|agro|educa[cç][aã]o|escola|restaurante|imobili|seguro|banco|log[ií]stica|advocacia|contabil/i;

export function chamadaDoDirect(tipo: "noticia" | "destaque", texto: string): string {
  if (tipo === "noticia") {
    return SETOR.test(texto)
      ? "Comente RADAR e eu te mando no Direct o que está acontecendo de IA no seu setor."
      : "Comente 7H e receba as notícias de IA todo dia às 7h no WhatsApp.";
  }
  return SETOR.test(texto)
    ? "Quer fazer isso na sua empresa? Comente PROJETO e a gente te conecta com quem faz."
    : "Você também faz IA de verdade? Comente LISTA e saiba como entrar na Lista IA News 100.";
}

/** Acrescenta a chamada à legenda, sem repetir se ela já tiver uma palavra-chave. */
export function comChamada(legenda: string, tipo: "noticia" | "destaque", contexto: string): string {
  if (!legenda || /\bComente [A-Z0-9]{2,}\b/.test(legenda)) return legenda;
  return `${legenda.trim()}\n\n${chamadaDoDirect(tipo, `${contexto} ${legenda}`)}`.slice(0, 2200);
}
