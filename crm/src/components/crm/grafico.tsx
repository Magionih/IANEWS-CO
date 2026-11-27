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

/** Agrupa por semana quando o período é longo (mais de 92 dias), para as barras não sumirem. */
function agrupar<T extends { dia: string; barras: number; linha: number }>(dados: T[]) {
  if (dados.length <= 92) return dados.map((d) => ({ ...d, ate: d.dia }));
  const saida: { dia: string; ate: string; barras: number; linha: number }[] = [];
  for (let i = 0; i < dados.length; i += 7) {
    const bloco = dados.slice(i, i + 7);
    saida.push({
      dia: bloco[0].dia,
      ate: bloco[bloco.length - 1].dia,
      barras: bloco.reduce((s, x) => s + x.barras, 0),
      linha: bloco.reduce((s, x) => s + x.linha, 0),
    });
  }
  return saida;
}

/** Gráfico combinado: barras (ex.: visitas) e linha (ex.: novos assinantes), cada um na sua
 *  escala, com a leitura do dia ao passar o mouse ou tocar. */
export function GraficoCombinado({
  dados,
  barras,
  linha,
  altura = 192,
}: {
  dados: { dia: string; barras: number; linha: number }[];
  barras: string;
  linha: string;
  altura?: number;
}) {
  const [foco, setFoco] = useState<number | null>(null);
  if (!dados.length)
    return <p className="py-8 text-center text-sm text-muted-foreground">Sem dados no período.</p>;
  const serie = agrupar(dados);
  const semanal = serie.length !== dados.length;
  const n = serie.length;
  const maxB = Math.max(1, ...serie.map((d) => d.barras));
  const maxL = Math.max(1, ...serie.map((d) => d.linha));
  const yL = (v: number) => 100 - (v / maxL) * 88;
  const pontos = serie.map((d, i) => `${((i + 0.5) / n) * 100},${yL(d.linha)}`).join(" ");
  const atual = foco != null ? serie[foco] : null;
  const gap = n > 60 ? "gap-px" : "gap-[3px]";
  const rotuloDia = (d: { dia: string; ate: string }) =>
    semanal ? `${fmtDiaCurto(d.dia)} a ${fmtDiaCurto(d.ate)}` : fmtDiaCurto(d.dia);
  return (
    <figure aria-label={`${barras} e ${linha} por ${semanal ? "semana" : "dia"}`}>
      <div className="mb-3 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-[12px] text-muted-foreground">
        <span className="inline-flex items-center gap-1.5">
          <i className="h-2.5 w-2.5 rounded-[3px] bg-[#BFD0FF]" /> {barras}
        </span>
        <span className="inline-flex items-center gap-1.5">
          <i className="h-[3px] w-3.5 rounded-full bg-[#0F1729]" /> {linha}
        </span>
        <span className="tabular ml-auto min-h-[18px] font-medium text-foreground">
          {atual
            ? `${rotuloDia(atual)} · ${fmtNum(atual.barras)} · ${fmtNum(atual.linha)}`
            : semanal
              ? "por semana"
              : "por dia"}
        </span>
      </div>
      <div className="relative" style={{ height: altura }} onMouseLeave={() => setFoco(null)}>
        {[0, 0.5, 1].map((f) => (
          <div
            key={f}
            aria-hidden
            className="pointer-events-none absolute inset-x-0 border-t border-dashed border-[#E6E9EF]"
            style={{ top: `${f * 100}%` }}
          />
        ))}
        <div className={`absolute inset-0 flex items-end ${gap}`}>
          {serie.map((d, i) => (
            <button
              key={d.dia}
              type="button"
              aria-label={`${rotuloDia(d)}: ${d.barras} ${barras.toLowerCase()}, ${d.linha} ${linha.toLowerCase()}`}
              className="flex h-full min-w-0 flex-1 items-end outline-none"
              onMouseEnter={() => setFoco(i)}
              onFocus={() => setFoco(i)}
              onClick={() => setFoco(foco === i ? null : i)}
            >
              <span
                className={`block w-full rounded-t-[3px] transition-colors ${foco === i ? "bg-primary" : "bg-[#BFD0FF]"}`}
                style={{ height: `${Math.max(d.barras ? 1.5 : 0, (d.barras / maxB) * 100)}%` }}
              />
            </button>
          ))}
        </div>
        <svg
          viewBox="0 0 100 100"
          preserveAspectRatio="none"
          aria-hidden
          className="pointer-events-none absolute inset-0 h-full w-full overflow-visible"
        >
          <polyline
            points={pontos}
            fill="none"
            stroke="#0F1729"
            strokeWidth="2"
            strokeLinejoin="round"
            strokeLinecap="round"
            vectorEffect="non-scaling-stroke"
          />
        </svg>
        {atual && foco != null ? (
          <span
            aria-hidden
            className="pointer-events-none absolute h-2.5 w-2.5 -translate-x-1/2 translate-y-1/2 rounded-full border-2 border-white bg-[#0F1729] shadow"
            style={{
              left: `${((foco + 0.5) / n) * 100}%`,
              bottom: `${100 - yL(atual.linha)}%`,
            }}
          />
        ) : null}
      </div>
      <div className="mt-1.5 flex justify-between text-[11px] text-muted-foreground">
        <span>{fmtDiaCurto(serie[0].dia)}</span>
        {n > 2 ? <span>{fmtDiaCurto(serie[Math.floor(n / 2)].dia)}</span> : null}
        <span>{fmtDiaCurto(serie[n - 1].ate)}</span>
      </div>
    </figure>
  );
}
