import { cn } from "@/lib/utils";

export type CategoryKey =
  | "bigtech"
  | "startup"
  | "brasil"
  | "global"
  | "mercado"
  | "pesquisa"
  | "regulacao"
  | "ferramentas"
  | "generativa";

const map: Record<CategoryKey, { label: string; color: string }> = {
  bigtech: { label: "Big Tech", color: "var(--color-cat-bigtech)" },
  startup: { label: "Startup", color: "var(--color-cat-startup)" },
  brasil: { label: "Brasil", color: "var(--color-cat-brasil)" },
  global: { label: "Global", color: "var(--color-cat-global)" },
  mercado: { label: "Mercado", color: "var(--color-cat-mercado)" },
  pesquisa: { label: "Pesquisa", color: "var(--color-cat-pesquisa)" },
  regulacao: { label: "Regulação", color: "var(--color-cat-regulacao)" },
  ferramentas: { label: "Ferramentas", color: "var(--color-cat-ferramentas)" },
  generativa: { label: "IA Generativa", color: "var(--color-cat-generativa)" },
};

interface CategoryChipProps {
  category: CategoryKey;
  className?: string;
  variant?: "solid" | "soft";
}

export function CategoryChip({ category, className, variant = "soft" }: CategoryChipProps) {
  const c = map[category];
  const style =
    variant === "solid"
      ? { backgroundColor: c.color, color: "#fff" }
      : {
          backgroundColor: `color-mix(in oklab, ${c.color} 14%, transparent)`,
          color: c.color,
        };
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full px-2.5 py-1 font-mono-eyebrow",
        className,
      )}
      style={style}
    >
      {c.label}
    </span>
  );
}

export const CATEGORY_MAP = map;