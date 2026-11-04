import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Check, Tags } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { setTagsNegocio } from "@/lib/crm/negocios.functions";
import type { CrmCorTag, CrmTag } from "@/lib/crm/types";
import { cn } from "@/lib/utils";

import { useCrm } from "./context";
import { useAcao } from "./queries";

/* Tags estratégicas dos negócios: chips coloridos, editor na ficha e filtro no funil. */

export const COR_TAG: Record<CrmCorTag, { chip: string; ponto: string; rotulo: string }> = {
  azul: {
    chip: "bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-200",
    ponto: "bg-blue-500",
    rotulo: "Azul",
  },
  verde: {
    chip: "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-200",
    ponto: "bg-emerald-500",
    rotulo: "Verde",
  },
  amarelo: {
    chip: "bg-yellow-100 text-yellow-900 dark:bg-yellow-950 dark:text-yellow-200",
    ponto: "bg-yellow-400",
    rotulo: "Amarelo",
  },
  laranja: {
    chip: "bg-orange-100 text-orange-800 dark:bg-orange-950 dark:text-orange-200",
    ponto: "bg-orange-500",
    rotulo: "Laranja",
  },
  vermelho: {
    chip: "bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-200",
    ponto: "bg-red-500",
    rotulo: "Vermelho",
  },
  roxo: {
    chip: "bg-violet-100 text-violet-800 dark:bg-violet-950 dark:text-violet-200",
    ponto: "bg-violet-500",
    rotulo: "Roxo",
  },
  cinza: {
    chip: "bg-slate-200 text-slate-700 dark:bg-slate-800 dark:text-slate-200",
    ponto: "bg-slate-400",
    rotulo: "Cinza",
  },
};

export function TagChip({
  tag,
  ativa = true,
  onClick,
  pequena,
  sufixo,
  selecionada,
}: {
  /** Mostra o ✓ (padrão: tag ativa e clicável). */
  selecionada?: boolean;
  tag: CrmTag;
  ativa?: boolean;
  onClick?: () => void;
  pequena?: boolean;
  sufixo?: string;
}) {
  const cor = COR_TAG[tag.cor] ?? COR_TAG.azul;
  const classe = cn(
    "inline-flex items-center gap-1 rounded-full font-semibold transition",
    pequena ? "px-1.5 py-0.5 text-[10px]" : "px-2.5 py-1 text-xs",
    ativa ? cor.chip : "border border-dashed text-muted-foreground hover:bg-muted",
  );
  const conteudo = (
    <>
      {(selecionada ?? (ativa && !!onClick)) ? <Check className="h-3 w-3" /> : null}
      {!ativa ? <span className={cn("h-1.5 w-1.5 rounded-full", cor.ponto)} /> : null}
      {tag.nome}
      {sufixo ? <span className="font-normal opacity-80">{sufixo}</span> : null}
    </>
  );
  if (!onClick)
    return (
      <span className={classe} title={tag.descricao ?? tag.nome}>
        {conteudo}
      </span>
    );
  return (
    <button
      type="button"
      className={classe}
      title={tag.descricao ?? tag.nome}
      aria-pressed={ativa}
      onClick={(e) => {
        e.stopPropagation();
        onClick();
      }}
    >
      {conteudo}
    </button>
  );
}

/** Tags no cartão do kanban (até `max`, o resto vira "+n"). */
export function TagsDoNegocio({ ids, max = 3 }: { ids?: string[] | null; max?: number }) {
  const { tag } = useCrm();
  const lista = (ids ?? []).map(tag).filter((t): t is CrmTag => !!t);
  if (!lista.length) return null;
  return (
    <div className="mt-2 flex flex-wrap gap-1">
      {lista.slice(0, max).map((t) => (
        <TagChip key={t.id} tag={t} pequena />
      ))}
      {lista.length > max ? (
        <span className="text-[10px] font-semibold text-muted-foreground">
          +{lista.length - max}
        </span>
      ) : null}
    </div>
  );
}

/** Editor da ficha do negócio: clique numa tag para marcar ou desmarcar (fica no histórico). */
export function EditorTags({ negocioId, ids }: { negocioId: string; ids?: string[] | null }) {
  const { tagsAtivas, tag } = useCrm();
  const salvar = useServerFn(setTagsNegocio);
  const { executar } = useAcao();
  const [marcadas, setMarcadas] = useState<string[]>(ids ?? []);
  useEffect(() => setMarcadas(ids ?? []), [ids]);

  if (!tagsAtivas.length) return null;
  // Tags inativas que o negócio já tem continuam visíveis para poderem ser removidas.
  const inativas = marcadas.map(tag).filter((t): t is CrmTag => !!t && !t.ativo);

  async function alternar(id: string) {
    const antes = marcadas;
    const novas = antes.includes(id) ? antes.filter((x) => x !== id) : [...antes, id];
    setMarcadas(novas);
    const r = await executar(() => salvar({ data: { id: negocioId, tags: novas } }));
    if (!r) setMarcadas(antes);
  }

  return (
    <div className="rounded-lg border p-3">
      <p className="font-mono-eyebrow flex items-center gap-1.5 text-muted-foreground">
        <Tags className="h-3.5 w-3.5" /> Tags estratégicas
      </p>
      <div className="mt-2 flex flex-wrap gap-1.5">
        {[...tagsAtivas, ...inativas].map((t) => (
          <TagChip
            key={t.id}
            tag={t}
            ativa={marcadas.includes(t.id)}
            onClick={() => alternar(t.id)}
          />
        ))}
      </div>
    </div>
  );
}

/** Filtro por tags no funil: mostra negócios com qualquer uma das tags marcadas. */
export function FiltroTags({
  selecionadas,
  onChange,
}: {
  selecionadas: string[];
  onChange: (ids: string[]) => void;
}) {
  const { tagsAtivas } = useCrm();
  if (!tagsAtivas.length) return null;
  const alternar = (id: string) =>
    onChange(
      selecionadas.includes(id) ? selecionadas.filter((x) => x !== id) : [...selecionadas, id],
    );
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant={selecionadas.length ? "default" : "outline"} className="h-10">
          <Tags className="mr-1.5 h-4 w-4" />
          Tags{selecionadas.length ? ` (${selecionadas.length})` : ""}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-72">
        <p className="text-xs text-muted-foreground">
          Mostra negócios com qualquer uma das tags marcadas.
        </p>
        <div className="mt-2 flex flex-wrap gap-1.5">
          {tagsAtivas.map((t) => (
            <TagChip
              key={t.id}
              tag={t}
              ativa={selecionadas.includes(t.id)}
              onClick={() => alternar(t.id)}
            />
          ))}
        </div>
        {selecionadas.length ? (
          <button
            type="button"
            className="mt-3 text-xs font-semibold text-primary hover:underline"
            onClick={() => onChange([])}
          >
            Limpar tags
          </button>
        ) : null}
      </PopoverContent>
    </Popover>
  );
}
