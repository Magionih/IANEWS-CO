import { useEffect, useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Check, Plus, Search, Tags, X } from "lucide-react";

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
export function TagsDoNegocio({
  ids,
  max = 2,
  compacto,
}: {
  ids?: string[] | null;
  max?: number;
  compacto?: boolean;
}) {
  const { tag } = useCrm();
  const lista = (ids ?? []).map(tag).filter((t): t is CrmTag => !!t);
  if (!lista.length) return null;
  return (
    <div className={cn("flex flex-wrap items-center gap-1", !compacto && "mt-2")}>
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

/** Agrupa as tags pelo prefixo do nome ("Perfil A · …" → "Perfil"); as soltas ficam em "Situação". */
function grupoDaTag(nome: string) {
  const i = nome.indexOf(" · ");
  if (i < 0) return "Situação";
  const prefixo = nome.slice(0, i);
  return /^Perfil/.test(prefixo) ? "Perfil" : /^Teste/.test(prefixo) ? "Testes" : prefixo;
}
const ORDEM_GRUPOS = ["Situação", "Perfil", "Status", "Pagamento", "Canal", "Ativação", "Testes"];

/** Nome curto (sem o prefixo do grupo) para listas agrupadas. */
function nomeCurto(nome: string) {
  const i = nome.indexOf(" · ");
  return i < 0 ? nome : nome.slice(i + 3);
}

/** Lista de tags com busca e grupos (para filtrar ou marcar). */
export function ListaTags({
  selecionadas,
  onAlternar,
  contagem,
  tags,
}: {
  selecionadas: string[];
  onAlternar: (id: string) => void;
  contagem?: Map<string, number>;
  tags?: CrmTag[];
}) {
  const { tagsAtivas } = useCrm();
  const [q, setQ] = useState("");
  const grupos = useMemo(() => {
    const termo = q.trim().toLowerCase();
    const lista = (tags ?? tagsAtivas).filter(
      (t) => !termo || t.nome.toLowerCase().includes(termo),
    );
    const m = new Map<string, CrmTag[]>();
    for (const t of lista) {
      const g = grupoDaTag(t.nome);
      m.set(g, [...(m.get(g) ?? []), t]);
    }
    return [...m.entries()].sort(
      (a, b) => (ORDEM_GRUPOS.indexOf(a[0]) + 1 || 50) - (ORDEM_GRUPOS.indexOf(b[0]) + 1 || 50),
    );
  }, [q, tags, tagsAtivas]);

  return (
    <div className="flex min-h-0 flex-col">
      <div className="flex items-center gap-2 rounded-lg border bg-background px-2.5">
        <Search className="h-3.5 w-3.5 text-muted-foreground" />
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Buscar tag"
          aria-label="Buscar tag"
          className="h-9 w-full bg-transparent text-sm outline-none placeholder:text-muted-foreground"
        />
      </div>
      <div className="mt-2 max-h-[46vh] overflow-y-auto pr-1">
        {grupos.length ? null : (
          <p className="py-4 text-center text-xs text-muted-foreground">Nenhuma tag encontrada.</p>
        )}
        {grupos.map(([grupo, lista]) => (
          <div key={grupo} className="py-1">
            <p className="px-1.5 pb-1 pt-1.5 text-[11px] font-semibold text-muted-foreground">
              {grupo}
            </p>
            {lista.map((t) => {
              const marcada = selecionadas.includes(t.id);
              const n = contagem?.get(t.id);
              return (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => onAlternar(t.id)}
                  title={t.descricao ?? t.nome}
                  className="flex w-full items-center gap-2.5 rounded-md px-1.5 py-1.5 text-left text-[13px] hover:bg-muted"
                >
                  <span
                    className={cn(
                      "flex h-4 w-4 shrink-0 items-center justify-center rounded border",
                      marcada ? "border-primary bg-primary text-white" : "border-input bg-card",
                    )}
                  >
                    {marcada ? <Check className="h-3 w-3" /> : null}
                  </span>
                  <span className={cn("h-2 w-2 shrink-0 rounded-full", COR_TAG[t.cor]?.ponto)} />
                  <span className="min-w-0 flex-1 truncate">
                    {grupo === "Situação" ? t.nome : nomeCurto(t.nome)}
                  </span>
                  {n != null ? (
                    <span className="tabular text-[11px] text-muted-foreground">{n}</span>
                  ) : null}
                </button>
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
}

/** Editor da ficha do negócio: mostra só as tags marcadas e um botão para adicionar (fica no histórico). */
export function EditorTags({ negocioId, ids }: { negocioId: string; ids?: string[] | null }) {
  const { tagsAtivas, tag } = useCrm();
  const salvar = useServerFn(setTagsNegocio);
  const { executar } = useAcao();
  const [marcadas, setMarcadas] = useState<string[]>(ids ?? []);
  useEffect(() => setMarcadas(ids ?? []), [ids]);

  if (!tagsAtivas.length) return null;
  const lista = marcadas.map(tag).filter((t): t is CrmTag => !!t);

  async function alternar(id: string) {
    const antes = marcadas;
    const novas = antes.includes(id) ? antes.filter((x) => x !== id) : [...antes, id];
    setMarcadas(novas);
    const r = await executar(() => salvar({ data: { id: negocioId, tags: novas } }));
    if (!r) setMarcadas(antes);
  }

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {lista.map((t) => (
        <span
          key={t.id}
          className={cn(
            "inline-flex items-center gap-1 rounded-full py-0.5 pl-2.5 pr-1 text-xs font-semibold",
            (COR_TAG[t.cor] ?? COR_TAG.azul).chip,
          )}
          title={t.descricao ?? t.nome}
        >
          {t.nome}
          <button
            type="button"
            aria-label={`Tirar a tag ${t.nome}`}
            onClick={() => alternar(t.id)}
            className="rounded-full p-0.5 opacity-60 hover:bg-black/10 hover:opacity-100"
          >
            <X className="h-3 w-3" />
          </button>
        </span>
      ))}
      <Popover>
        <PopoverTrigger asChild>
          <button
            type="button"
            className="inline-flex items-center gap-1 rounded-full border border-dashed px-2.5 py-1 text-xs font-medium text-muted-foreground hover:border-primary/50 hover:text-primary"
          >
            <Plus className="h-3 w-3" /> {lista.length ? "Tag" : "Adicionar tag"}
          </button>
        </PopoverTrigger>
        <PopoverContent align="start" className="w-[min(92vw,300px)]">
          <ListaTags
            selecionadas={marcadas}
            onAlternar={alternar}
            tags={[...tagsAtivas, ...lista.filter((t) => !t.ativo)]}
          />
        </PopoverContent>
      </Popover>
    </div>
  );
}

/** Filtro por tags no funil: mostra negócios com qualquer uma das tags marcadas. */
export function FiltroTags({
  selecionadas,
  onChange,
  contagem,
}: {
  selecionadas: string[];
  onChange: (ids: string[]) => void;
  contagem?: Map<string, number>;
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
        <Button variant="outline" className="h-10">
          <Tags className="h-4 w-4" />
          Tags
          {selecionadas.length ? (
            <span className="rounded-full bg-primary px-1.5 text-[11px] font-semibold text-white">
              {selecionadas.length}
            </span>
          ) : null}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-[min(92vw,300px)]">
        <ListaTags selecionadas={selecionadas} onAlternar={alternar} contagem={contagem} />
        {selecionadas.length ? (
          <button
            type="button"
            className="mt-2 text-xs font-semibold text-primary hover:underline"
            onClick={() => onChange([])}
          >
            Limpar tags
          </button>
        ) : null}
      </PopoverContent>
    </Popover>
  );
}
