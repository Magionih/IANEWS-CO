/* Enquadramento da capa escolhido no painel (articles.cover_position).
   Nulo = padrão do site (.thumb img prioriza a parte de cima, onde ficam os rostos). */

export type CoverPosition = "top" | "center" | "bottom";

export const COVER_POSITIONS: { value: CoverPosition; label: string }[] = [
  { value: "top", label: "Topo" },
  { value: "center", label: "Centro" },
  { value: "bottom", label: "Base" },
];

const MAP: Record<CoverPosition, string> = { top: "50% 0%", center: "50% 50%", bottom: "50% 100%" };

/** Valor de object-position para o enquadramento, ou undefined para o padrão. */
export function coverObjectPosition(pos: string | null | undefined): string | undefined {
  return pos && pos in MAP ? MAP[pos as CoverPosition] : undefined;
}
