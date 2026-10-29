import { useState } from "react";

import { fmtDiaCurto, fmtNum } from "@/lib/crm/utils";

/* Barras por dia (uma série): marcas finas na cor de destaque, eixo discreto e dica ao passar o mouse.
   Cada gráfico tem a tabela correspondente na mesma tela (e exportação CSV). */

export function BarrasPorDia({
  dados,
  rotulo,
}: {
  dados: { dia: string; valor: number; detalhe?: string }[];
  rotulo: string;
}) {
  const [foco, setFoco] = useState<number | null>(null);
  if (!dados.length)
    return <p className="py-8 text-center text-sm text-muted-foreground">Sem dados no período.</p>;
  const max = Math.max(1, ...dados.map((d) => d.valor));
  const atual = foco != null ? dados[foco] : null;
  return (
    <figure className="space-y-2" aria-label={rotulo}>
      <div className="flex h-5 items-center justify-between text-xs text-muted-foreground">
        <span>{rotulo}</span>
        <span className="font-medium text-foreground">
          {atual
            ? `${fmtDiaCurto(atual.dia)}: ${fmtNum(atual.valor)}${atual.detalhe ? ` · ${atual.detalhe}` : ""}`
            : `máx. ${fmtNum(max)}`}
        </span>
      </div>
      <div
        className="relative flex h-40 items-end gap-[2px] border-b border-border"
        onMouseLeave={() => setFoco(null)}
      >
        <div
          className="pointer-events-none absolute inset-x-0 top-0 border-t border-dashed border-border/70"
          aria-hidden
        />
        {dados.map((d, i) => (
          <div
            key={d.dia}
            className="flex h-full min-w-0 flex-1 cursor-default items-end"
            onMouseEnter={() => setFoco(i)}
            onFocus={() => setFoco(i)}
            tabIndex={0}
            aria-label={`${fmtDiaCurto(d.dia)}: ${d.valor}`}
          >
            <div
              className={`w-full rounded-t-[4px] bg-primary transition-opacity ${foco != null && foco !== i ? "opacity-40" : ""}`}
              style={{ height: `${Math.max(d.valor ? 2 : 0, (d.valor / max) * 100)}%` }}
            />
          </div>
        ))}
      </div>
      <div className="flex justify-between text-[11px] text-muted-foreground">
        <span>{fmtDiaCurto(dados[0].dia)}</span>
        <span>{fmtDiaCurto(dados[dados.length - 1].dia)}</span>
      </div>
    </figure>
  );
}

/** Barras horizontais para rankings (origem, motivos): rótulo e valor em texto, barra só como apoio. */
export function BarrasHorizontais({
  itens,
}: {
  itens: { rotulo: string; valor: number; detalhe?: string }[];
}) {
  if (!itens.length)
    return <p className="py-6 text-center text-sm text-muted-foreground">Sem dados no período.</p>;
  const max = Math.max(1, ...itens.map((i) => i.valor));
  return (
    <ul className="space-y-2">
      {itens.map((i) => (
        <li key={i.rotulo} className="text-sm" title={`${i.rotulo}: ${i.valor}`}>
          <div className="flex justify-between gap-2">
            <span className="truncate">{i.rotulo}</span>
            <span className="shrink-0 font-semibold">
              {fmtNum(i.valor)}
              {i.detalhe ? (
                <span className="ml-1 font-normal text-muted-foreground">{i.detalhe}</span>
              ) : null}
            </span>
          </div>
          <div className="mt-1 h-1.5 rounded-full bg-muted">
            <div
              className="h-1.5 rounded-full bg-primary"
              style={{ width: `${(i.valor / max) * 100}%` }}
            />
          </div>
        </li>
      ))}
    </ul>
  );
}
