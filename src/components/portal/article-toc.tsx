import { useEffect, useState } from "react";

/* "Nesta matéria": índice lateral com destaque da seção em leitura (como no protótipo). */

export type TocItem = { id: string; label: string };

export function ArticleToc({ items }: { items: TocItem[] }) {
  const [active, setActive] = useState<string | null>(null);

  useEffect(() => {
    if (typeof IntersectionObserver === "undefined") return;
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) if (e.isIntersecting) setActive(e.target.id);
      },
      { rootMargin: "-20% 0px -70% 0px" },
    );
    for (const it of items) {
      const node = document.getElementById(it.id);
      if (node) io.observe(node);
    }
    return () => io.disconnect();
  }, [items]);

  if (items.length < 2) return null;

  return (
    <div className="box toc-box">
      <h3>Nesta matéria</h3>
      <nav className="toc" aria-label="Nesta matéria">
        {items.map((it) => (
          <a key={it.id} href={`#${it.id}`} className={active === it.id ? "on" : undefined}>
            {it.label}
          </a>
        ))}
      </nav>
    </div>
  );
}
