import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";

import { getAdMetrics, type AdSegmentRow } from "@/lib/ad-metrics.functions";
import { Button } from "@/components/ui/button";

const RANGES = [7, 30, 90] as const;

function Kpi({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="border-2 border-foreground bg-background p-4">
      <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-muted-foreground">
        {label}
      </p>
      <p className="mt-1 text-2xl font-extrabold">{value}</p>
      {hint ? <p className="mt-1 text-xs text-muted-foreground">{hint}</p> : null}
    </div>
  );
}

function SegmentTable({ title, rows }: { title: string; rows: AdSegmentRow[] }) {
  return (
    <div className="border-2 border-foreground bg-background">
      <p className="border-b-2 border-foreground px-4 py-2 text-sm font-extrabold uppercase tracking-wide">
        {title}
      </p>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[560px] text-sm">
          <thead>
            <tr className="border-b border-border text-left text-[11px] uppercase tracking-wide text-muted-foreground">
              <th className="px-4 py-2">Segmento</th>
              <th className="px-3 py-2 text-right">Impressões</th>
              <th className="px-3 py-2 text-right">Visíveis</th>
              <th className="px-3 py-2 text-right">Cliques</th>
              <th className="px-3 py-2 text-right">CTR</th>
              <th className="px-3 py-2 text-right">Viewability</th>
              <th className="px-3 py-2 text-right">Tempo visível</th>
            </tr>
          </thead>
          <tbody>
            {rows.length ? (
              rows.map((r) => (
                <tr key={r.key} className="border-b border-border/60 last:border-0">
                  <td className="max-w-[240px] truncate px-4 py-2 font-medium">{r.key}</td>
                  <td className="px-3 py-2 text-right">{r.impressions}</td>
                  <td className="px-3 py-2 text-right">{r.viewables}</td>
                  <td className="px-3 py-2 text-right">{r.clicks}</td>
                  <td className="px-3 py-2 text-right">{r.ctr}%</td>
                  <td className="px-3 py-2 text-right">{r.viewability}%</td>
                  <td className="px-3 py-2 text-right">{(r.avgVisibleMs / 1000).toFixed(1)}s</td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={7} className="px-4 py-6 text-center text-muted-foreground">
                  Sem dados no período.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export function AdsPanel() {
  const [days, setDays] = useState<number>(30);
  const fetchMetrics = useServerFn(getAdMetrics);
  const { data, isLoading } = useQuery({
    queryKey: ["ad-metrics", days],
    queryFn: () => fetchMetrics({ data: { days } }),
  });

  const t = data?.totals;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-2">
        {RANGES.map((r) => (
          <Button
            key={r}
            size="sm"
            variant={days === r ? "default" : "outline"}
            className="rounded-none"
            onClick={() => setDays(r)}
          >
            {r} dias
          </Button>
        ))}
        {isLoading ? <span className="text-xs text-muted-foreground">Carregando…</span> : null}
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Kpi label="Impressões" value={String(t?.impressions ?? 0)} hint={`${t?.requests ?? 0} solicitações`} />
        <Kpi
          label="Viewability"
          value={`${t?.viewability ?? 0}%`}
          hint={`${t?.viewables ?? 0} blocos ≥50% por 1s`}
        />
        <Kpi label="Cliques / CTR" value={`${t?.clicks ?? 0} · ${t?.ctr ?? 0}%`} />
        <Kpi
          label="Fill rate"
          value={`${t?.fillRate ?? 0}%`}
          hint={`${t?.unfilled ?? 0} sem anúncio · ${((t?.avgVisibleMs ?? 0) / 1000).toFixed(1)}s visível`}
        />
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <SegmentTable title="Por página" rows={data?.byPage ?? []} />
        <SegmentTable title="Por bloco" rows={data?.byBlock ?? []} />
        <SegmentTable title="Por matéria" rows={data?.byArticle ?? []} />
        <SegmentTable title="Por país" rows={data?.byCountry ?? []} />
      </div>

      <div className="border-2 border-foreground bg-background">
        <p className="border-b-2 border-foreground px-4 py-2 text-sm font-extrabold uppercase tracking-wide">
          Evolução diária
        </p>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[420px] text-sm">
            <thead>
              <tr className="border-b border-border text-left text-[11px] uppercase tracking-wide text-muted-foreground">
                <th className="px-4 py-2">Dia</th>
                <th className="px-3 py-2 text-right">Impressões</th>
                <th className="px-3 py-2 text-right">Visíveis</th>
                <th className="px-3 py-2 text-right">Cliques</th>
                <th className="px-3 py-2 text-right">CTR</th>
              </tr>
            </thead>
            <tbody>
              {(data?.daily ?? []).map((d) => (
                <tr key={d.date} className="border-b border-border/60 last:border-0">
                  <td className="px-4 py-2">{d.date}</td>
                  <td className="px-3 py-2 text-right">{d.impressions}</td>
                  <td className="px-3 py-2 text-right">{d.viewables}</td>
                  <td className="px-3 py-2 text-right">{d.clicks}</td>
                  <td className="px-3 py-2 text-right">{d.ctr}%</td>
                </tr>
              ))}
              {!data?.daily.length ? (
                <tr>
                  <td colSpan={5} className="px-4 py-6 text-center text-muted-foreground">
                    Sem dados no período.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
