import { Link } from "@tanstack/react-router";
import { ChevronRight } from "lucide-react";

import { cn } from "@/lib/utils";

export type Crumb = { label: string; to?: string };

/** Trilha de navegação visível, alinhada ao BreadcrumbList do Schema.org. */
export function Breadcrumbs({ items, className }: { items: Crumb[]; className?: string }) {
  return (
    <nav aria-label="Trilha de navegação" className={cn("text-xs", className)}>
      <ol className="flex flex-wrap items-center gap-1.5 text-muted-foreground">
        {items.map((item, i) => {
          const last = i === items.length - 1;
          return (
            <li key={item.label} className="flex items-center gap-1.5">
              {item.to && !last ? (
                <Link to={item.to} className="font-medium hover:text-[color:var(--color-lime)]">
                  {item.label}
                </Link>
              ) : (
                <span className={last ? "font-semibold text-foreground" : undefined} aria-current={last ? "page" : undefined}>
                  {item.label}
                </span>
              )}
              {last ? null : <ChevronRight className="h-3 w-3 shrink-0 opacity-60" />}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
