/* Sugestão de menções sem IA: cadastros citados no texto e padrões dos títulos da IANews. */

import { normalizar } from "./utils";

const escapar = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/** Cadastros (empresas ou pessoas) cujo nome aparece no texto como palavra inteira. */
export function encontrarCitados<T extends { id: string; nome: string }>(
  texto: string,
  lista: T[],
): T[] {
  const alvo = ` ${normalizar(texto).replace(/[^a-z0-9.&+-]+/g, " ")} `;
  return lista.filter((item) => {
    const nome = normalizar(item.nome)
      .replace(/[^a-z0-9.&+-]+/g, " ")
      .trim();
    if (nome.length < 3) return false;
    return new RegExp(`(^|\\s)${escapar(nome)}(\\s|$)`).test(alvo);
  });
}

export type Candidato = { tipo: "empresa" | "pessoa"; nome: string; empresa?: string | null };

const pareceNome = (s: string, max = 5) => {
  const palavras = s.trim().split(/\s+/);
  return palavras.length >= 1 && palavras.length <= max && /^[A-ZÀ-Ý0-9"]/.test(s.trim());
};
const pareceGente = (s: string) => {
  const palavras = s.trim().split(/\s+/);
  return (
    palavras.length >= 2 &&
    palavras.length <= 5 &&
    palavras.every((p) => /^([A-ZÀ-Ý]|d[aeo]s?$|e$)/.test(p))
  );
};
const limpar = (s: string) => s.replace(/^["“”']+|["“”']+$/g, "").trim();

/**
 * Padrões comuns dos títulos:
 *  "Grant Lee, da Gamma, chegou..."        -> pessoa + empresa
 *  "Bosch, de Gastón Diaz Perez, investe..." -> empresa + pessoa
 *  "Cemig, presidida por Fulano, abre..."   -> empresa + pessoa
 *  "\"Frase\", diz Fulano, da XP"           -> pessoa + empresa
 */
export function candidatosDoTitulo(tituloOriginal: string): Candidato[] {
  const saida: Candidato[] = [];
  const titulo = tituloOriginal.replace(/^["“][^"”]*["”][:,]?\s*(diz\s+)?/i, "").trim();
  const par = (pessoa: string, empresa: string) => {
    const e = limpar(empresa);
    const pessoas = limpar(pessoa).split(/\s+e\s+/);
    if (pareceNome(e)) saida.push({ tipo: "empresa", nome: e });
    for (const p of pessoas)
      if (pareceGente(p))
        saida.push({ tipo: "pessoa", nome: limpar(p), empresa: pareceNome(e) ? e : null });
  };

  let m = titulo.match(/^([^,:]+?),\s+d(?:a|o|as|os)\s+([^,:]+?)(?:[,:]|\s+-\s|$)/);
  if (m) {
    par(m[1], m[2]);
    return saida;
  }
  m = titulo.match(/^([^,:]+?),\s+de\s+([^,:]+?)[,:]/);
  if (m) {
    par(m[2], m[1]);
    return saida;
  }
  m = titulo.match(
    /^([^,:]+?),\s+(?:empresa\s+)?(?:presidid[ao]|comandad[ao]|fundad[ao]|liderad[ao]|criad[ao]|dirigid[ao])\s+por\s+([^,:]+?)[,:]/i,
  );
  if (m) {
    const antes = m[1].match(/\s(?:d[ao]s?)\s+(.+)$/);
    par(m[2], antes ? antes[1] : m[1]);
    return saida;
  }
  return saida;
}
