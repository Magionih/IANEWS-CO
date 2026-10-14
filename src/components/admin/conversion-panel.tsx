import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  BellRing,
  Clock,
  Download,
  Loader2,
  Mail,
  MousePointerClick,
  Target,
  UserPlus,
} from "lucide-react";
import { toast } from "sonner";

import type { ConversionFilters, SegmentRow } from "@/lib/conversion.functions";
import { exportConversionCsv, getConversionData } from "@/lib/conversion.functions";
import { getPushStats, sendDailyPushNow } from "@/lib/push.functions";

const fmt = (n: number) => n.toLocaleString("pt-BR");
const dur = (s: number) => (s >= 60 ? `${Math.floor(s / 60)}m ${s % 60}s` : `${s}s`);

function Stat({
  label,
  value,
  hint,
  icon: Icon,
}: {
  label: string;
  value: string;
  hint?: string;
  icon: typeof Target;
}) {
  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        <Icon className="h-4 w-4 text-primary" /> {label}
      </div>
      <p className="mt-2 text-2xl font-extrabold tracking-tight sm:text-3xl">{value}</p>
      {hint ? <p className="mt-1 text-xs text-muted-foreground">{hint}</p> : null}
    </div>
  );
}

function Select({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: string[];
  onChange: (v: string) => void;
}) {
  return (
    <label className="flex flex-col gap-1 text-xs">
      <span className="font-semibold uppercase tracking-wide text-muted-foreground">{label}</span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="h-9 min-w-[130px] max-w-[220px] rounded-md border border-border bg-background px-2 text-xs"
      >
        <option value="">Todos</option>
        {options.map((o) => (
          <option key={o} value={o}>
            {o}
          </option>
        ))}
      </select>
    </label>
  );
}

function SegmentTable({ title, rows }: { title: string; rows: SegmentRow[] }) {
  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <h3 className="text-sm font-bold">{title}</h3>
      <div className="mt-3 overflow-x-auto">
        <table className="w-full min-w-[520px] text-xs">
          <thead className="text-left text-muted-foreground">
            <tr>
              <th className="py-1.5">Segmento</th>
              <th className="py-1.5 text-right">Exib.</th>
              <th className="py-1.5 text-right">Cliques</th>
              <th className="py-1.5 text-right">CTR</th>
              <th className="py-1.5 text-right">Leads</th>
              <th className="py-1.5 text-right">Confirm.</th>
              <th className="py-1.5 text-right">% conf.</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td colSpan={7} className="py-3 text-muted-foreground">
                  Sem dados no período.
                </td>
              </tr>
            ) : (
              rows.map((r) => (
                <tr key={r.key} className="border-t border-border/60">
                  <td className="max-w-[220px] truncate py-2 pr-2 font-medium">{r.key}</td>
                  <td className="py-2 text-right tabular-nums">{fmt(r.impressions)}</td>
                  <td className="py-2 text-right tabular-nums">{fmt(r.clicks)}</td>
                  <td className="py-2 text-right tabular-nums">{r.ctr}%</td>
                  <td className="py-2 text-right font-bold tabular-nums text-primary">
                    {fmt(r.leads)}
                  </td>
                  <td className="py-2 text-right tabular-nums">{fmt(r.confirmed)}</td>
                  <td className="py-2 text-right tabular-nums">{r.confirmRate}%</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export function ConversionPanel() {
  const [filters, setFilters] = useState<ConversionFilters>({ days: 30 });
  const [exporting, setExporting] = useState(false);
  const [pushing, setPushing] = useState(false);

  const fn = useServerFn(getConversionData);
  const exportFn = useServerFn(exportConversionCsv);
  const pushStatsFn = useServerFn(getPushStats);
  const pushNowFn = useServerFn(sendDailyPushNow);

  const key = useMemo(() => JSON.stringify(filters), [filters]);
  const { data, isLoading, error } = useQuery({
    queryKey: ["conversion-data", key],
    queryFn: () => fn({ data: filters }),
    refetchInterval: 60000,
  });
  const pushQuery = useQuery({
    queryKey: ["push-stats"],
    queryFn: () => pushStatsFn({}),
    refetchInterval: 120000,
  });

  const set = (patch: Partial<ConversionFilters>) => setFilters((f) => ({ ...f, ...patch }));

  const download = async () => {
    setExporting(true);
    try {
      const res = await exportFn({ data: filters });
      const blob = new Blob([res.csv], { type: "text/csv;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = res.filename;
      a.click();
      URL.revokeObjectURL(url);
      toast.success("CSV do funil exportado.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Falha ao exportar.");
    } finally {
      setExporting(false);
    }
  };

  const sendPush = async () => {
    setPushing(true);
    try {
      const res: any = await pushNowFn({});
      if (res?.ok) toast.success(`Notificação enviada para ${res.delivered} aparelhos.`);
      else toast.error(res?.error ?? "Não foi possível enviar.");
      void pushQuery.refetch();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Falha no envio.");
    } finally {
      setPushing(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center gap-2 p-8 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" /> Carregando funil de conversão...
      </div>
    );
  }
  if (error || !data) {
    return (
      <p className="p-6 text-sm text-destructive">
        {error instanceof Error ? error.message : "Não foi possível carregar os dados."}
      </p>
    );
  }

  const t = data.totals;
  const maxDay = Math.max(1, ...data.byDay.map((d) => d.clicks));
  const funnel = [
    { label: "Exibições", value: t.impressions },
    { label: "Cliques", value: t.clicks },
    { label: "Leads", value: t.leads },
    { label: "Confirmados", value: t.confirmed },
  ];
  const funnelMax = Math.max(1, t.impressions);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end gap-3 rounded-xl border border-border bg-card p-4">
        <Select
          label="País"
          value={filters.country ?? ""}
          options={data.options.countries}
          onChange={(v) => set({ country: v || null })}
        />
        <Select
          label="Página"
          value={filters.path ?? ""}
          options={data.options.paths}
          onChange={(v) => set({ path: v || null })}
        />
        <Select
          label="Matéria"
          value={filters.slug ?? ""}
          options={data.options.slugs}
          onChange={(v) => set({ slug: v || null })}
        />
        <Select
          label="UTM source"
          value={filters.utmSource ?? ""}
          options={data.options.utmSources}
          onChange={(v) => set({ utmSource: v || null })}
        />
        <Select
          label="UTM campaign"
          value={filters.utmCampaign ?? ""}
          options={data.options.utmCampaigns}
          onChange={(v) => set({ utmCampaign: v || null })}
        />
        <label className="flex flex-col gap-1 text-xs">
          <span className="font-semibold uppercase tracking-wide text-muted-foreground">
            Período
          </span>
          <select
            value={String(filters.days ?? 30)}
            onChange={(e) => set({ days: Number(e.target.value) })}
            className="h-9 rounded-md border border-border bg-background px-2 text-xs"
          >
            <option value="7">7 dias</option>
            <option value="30">30 dias</option>
            <option value="90">90 dias</option>
          </select>
        </label>
        <div className="ml-auto flex gap-2">
          <button
            type="button"
            onClick={() => setFilters({ days: filters.days ?? 30 })}
            className="h-9 rounded-md border border-border px-3 text-xs font-semibold"
          >
            Limpar
          </button>
          <button
            type="button"
            onClick={download}
            disabled={exporting}
            className="inline-flex h-9 items-center gap-2 rounded-md bg-primary px-3 text-xs font-bold text-primary-foreground disabled:opacity-60"
          >
            {exporting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Download className="h-3.5 w-3.5" />}
            Exportar CSV
          </button>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Stat
          label="Exibições de CTA"
          value={fmt(t.impressions)}
          hint={`${fmt(t.clicks)} cliques • CTR ${t.ctr}%`}
          icon={Target}
        />
        <Stat
          label="Cliques em CTA"
          value={fmt(t.clicks)}
          hint={`${t.conversionRate}% viram lead`}
          icon={MousePointerClick}
        />
        <Stat
          label="Leads captados"
          value={fmt(t.leads)}
          hint={`${fmt(t.confirmed)} confirmados (${t.confirmRate}%)`}
          icon={UserPlus}
        />
        <Stat
          label="Tempo médio por matéria"
          value={dur(t.avgSecondsPerArticle)}
          hint={`Mediana até confirmar: ${t.medianHoursToConfirm}h`}
          icon={Clock}
        />
      </div>

      <div className="rounded-xl border border-border bg-card p-4">
        <h3 className="text-sm font-bold">Funil completo</h3>
        <div className="mt-4 space-y-2">
          {funnel.map((step, i) => (
            <div key={step.label} className="flex items-center gap-3">
              <span className="w-28 shrink-0 text-xs font-semibold">{step.label}</span>
              <div className="h-6 flex-1 bg-muted">
                <div
                  className="h-full bg-primary"
                  style={{ width: `${Math.max(1, (step.value / funnelMax) * 100)}%` }}
                />
              </div>
              <span className="w-32 shrink-0 text-right text-xs tabular-nums">
                {fmt(step.value)}
                {i > 0 && funnel[i - 1]!.value > 0
                  ? ` • ${Math.round((step.value / funnel[i - 1]!.value) * 1000) / 10}%`
                  : ""}
              </span>
            </div>
          ))}
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="rounded-xl border border-border bg-card p-4">
          <h3 className="text-sm font-bold">Desempenho por posição de CTA</h3>
          <div className="mt-3 overflow-x-auto">
            <table className="w-full text-xs">
              <thead className="text-left text-muted-foreground">
                <tr>
                  <th className="py-1.5">Posição</th>
                  <th className="py-1.5 text-right">Exib.</th>
                  <th className="py-1.5 text-right">Cliques</th>
                  <th className="py-1.5 text-right">CTR</th>
                  <th className="py-1.5 text-right">Leads</th>
                </tr>
              </thead>
              <tbody>
                {data.byPlacement.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="py-3 text-muted-foreground">
                      Ainda sem eventos registrados.
                    </td>
                  </tr>
                ) : (
                  data.byPlacement.map((p) => (
                    <tr key={p.placement} className="border-t border-border/60">
                      <td className="py-2 pr-2 font-medium">{p.placement}</td>
                      <td className="py-2 text-right tabular-nums">{fmt(p.impressions)}</td>
                      <td className="py-2 text-right tabular-nums">{fmt(p.clicks)}</td>
                      <td className="py-2 text-right tabular-nums">{p.ctr}%</td>
                      <td className="py-2 text-right font-bold tabular-nums text-primary">
                        {fmt(p.conversions)}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        <div className="space-y-4">
          <div className="rounded-xl border border-border bg-card p-4">
            <h3 className="text-sm font-bold">Cliques por dia</h3>
            <div className="mt-4 flex h-28 items-end gap-[3px]">
              {data.byDay.map((d) => (
                <div
                  key={d.day}
                  title={`${d.day}: ${d.clicks} cliques, ${d.conversions} leads`}
                  className="flex-1 rounded-t bg-primary/70"
                  style={{ height: `${Math.max(2, (d.clicks / maxDay) * 100)}%` }}
                />
              ))}
            </div>
          </div>

          <div className="rounded-xl border border-border bg-card p-4">
            <h3 className="text-sm font-bold">Coorte: tempo até a confirmação</h3>
            <ul className="mt-3 space-y-2 text-xs">
              {data.cohort.map((c) => (
                <li key={c.label} className="flex items-center gap-3">
                  <span className="w-36 shrink-0 font-medium">{c.label}</span>
                  <div className="h-3 flex-1 bg-muted">
                    <div className="h-full bg-primary/70" style={{ width: `${c.share}%` }} />
                  </div>
                  <span className="w-20 text-right tabular-nums text-muted-foreground">
                    {fmt(c.count)} • {c.share}%
                  </span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <SegmentTable title="Por país" rows={data.segments.country} />
        <SegmentTable title="Por página" rows={data.segments.path} />
        <SegmentTable title="Por matéria" rows={data.segments.article} />
        <SegmentTable title="Por UTM (source / campaign)" rows={data.segments.utm} />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="rounded-xl border border-border bg-card p-4">
          <h3 className="flex items-center gap-2 text-sm font-bold">
            <Mail className="h-4 w-4 text-primary" /> Métricas de e-mail
          </h3>
          {!data.email.available ? (
            <p className="mt-3 text-xs text-muted-foreground">{data.email.note}</p>
          ) : (
            <>
              <div className="mt-3 grid grid-cols-2 gap-2 text-xs sm:grid-cols-4">
                <div>
                  <p className="text-muted-foreground">Enviados</p>
                  <p className="text-lg font-extrabold">{fmt(data.email.sent)}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Entregues</p>
                  <p className="text-lg font-extrabold">
                    {fmt(data.email.delivered)}{" "}
                    <span className="text-xs font-normal">({data.email.deliveryRate}%)</span>
                  </p>
                </div>
                <div>
                  <p className="text-muted-foreground">Retornos</p>
                  <p className="text-lg font-extrabold">{fmt(data.email.bounced)}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Descadastros</p>
                  <p className="text-lg font-extrabold">{fmt(data.email.unsubscribed)}</p>
                </div>
              </div>
              <table className="mt-4 w-full text-xs">
                <thead className="text-left text-muted-foreground">
                  <tr>
                    <th className="py-1.5">Origem do CTA</th>
                    <th className="py-1.5 text-right">Enviados</th>
                    <th className="py-1.5 text-right">Retornos</th>
                    <th className="py-1.5 text-right">Descad.</th>
                  </tr>
                </thead>
                <tbody>
                  {data.email.byOrigin.map((o) => (
                    <tr key={o.key} className="border-t border-border/60">
                      <td className="py-2 pr-2 font-medium">{o.key}</td>
                      <td className="py-2 text-right tabular-nums">{fmt(o.sent)}</td>
                      <td className="py-2 text-right tabular-nums">{fmt(o.bounced)}</td>
                      <td className="py-2 text-right tabular-nums">{fmt(o.unsubscribed)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <p className="mt-3 text-[11px] text-muted-foreground">{data.email.note}</p>
            </>
          )}
        </div>

        <div className="rounded-xl border border-border bg-card p-4">
          <h3 className="flex items-center gap-2 text-sm font-bold">
            <BellRing className="h-4 w-4 text-primary" /> Notificações no app (PWA)
          </h3>
          <p className="mt-2 text-xs text-muted-foreground">
            {fmt(pushQuery.data?.activeDevices ?? 0)} aparelhos ativos de{" "}
            {fmt(pushQuery.data?.totalDevices ?? 0)} inscritos. O envio diário é automático.
          </p>
          <button
            type="button"
            onClick={sendPush}
            disabled={pushing}
            className="mt-3 inline-flex h-9 items-center gap-2 rounded-md bg-foreground px-3 text-xs font-bold text-background disabled:opacity-60"
          >
            {pushing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <BellRing className="h-3.5 w-3.5" />}
            Enviar notificação agora
          </button>
          <ul className="mt-4 space-y-1.5 text-xs">
            {(pushQuery.data?.lastSends ?? []).map((s) => (
              <li key={s.id} className="flex justify-between gap-3 border-t border-border/60 py-1.5">
                <span className="truncate font-medium">{s.title}</span>
                <span className="shrink-0 tabular-nums text-muted-foreground">
                  {fmt(s.delivered)} ok • {fmt(s.failed)} falhas
                </span>
              </li>
            ))}
            {(pushQuery.data?.lastSends ?? []).length === 0 ? (
              <li className="text-muted-foreground">Nenhum envio ainda.</li>
            ) : null}
          </ul>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="rounded-xl border border-border bg-card p-4">
          <h3 className="text-sm font-bold">Origem dos leads</h3>
          <ul className="mt-3 space-y-1.5 text-xs">
            {data.leadsBySource.length === 0 ? (
              <li className="text-muted-foreground">Sem leads no período.</li>
            ) : (
              data.leadsBySource.map((s) => (
                <li key={s.key} className="flex justify-between gap-3">
                  <span className="truncate font-medium">{s.key}</span>
                  <span className="tabular-nums text-muted-foreground">{fmt(s.count)}</span>
                </li>
              ))
            )}
          </ul>
        </div>
        <div className="rounded-xl border border-border bg-card p-4">
          <h3 className="text-sm font-bold">Dispositivos</h3>
          <ul className="mt-3 space-y-1.5 text-xs">
            {data.byDevice.map((d) => (
              <li key={d.key} className="flex justify-between gap-3">
                <span className="font-medium capitalize">{d.key}</span>
                <span className="tabular-nums text-muted-foreground">
                  {fmt(d.clicks)} cliques • {fmt(d.conversions)} leads
                </span>
              </li>
            ))}
            {data.byDevice.length === 0 ? (
              <li className="text-muted-foreground">Sem dados ainda.</li>
            ) : null}
          </ul>
        </div>
      </div>

      <div className="rounded-xl border border-border bg-card p-4">
        <h3 className="text-sm font-bold">Tempo de visualização por matéria</h3>
        <div className="mt-3 overflow-x-auto">
          <table className="w-full min-w-[640px] text-xs">
            <thead className="text-left text-muted-foreground">
              <tr>
                <th className="py-1.5">Matéria</th>
                <th className="py-1.5 text-right">Sessões</th>
                <th className="py-1.5 text-right">Tempo médio</th>
                <th className="py-1.5 text-right">Rolagem média</th>
                <th className="py-1.5 text-right">Leitura completa</th>
                <th className="py-1.5 text-right">Min. totais</th>
              </tr>
            </thead>
            <tbody>
              {data.articles.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-3 text-muted-foreground">
                    Ainda sem leituras medidas.
                  </td>
                </tr>
              ) : (
                data.articles.map((a) => (
                  <tr key={a.slug} className="border-t border-border/60">
                    <td className="max-w-[320px] truncate py-2 pr-2 font-medium">{a.title}</td>
                    <td className="py-2 text-right tabular-nums">{fmt(a.sessions)}</td>
                    <td className="py-2 text-right tabular-nums">{dur(a.avgSeconds)}</td>
                    <td className="py-2 text-right tabular-nums">{a.avgScroll}%</td>
                    <td className="py-2 text-right tabular-nums">{a.completionRate}%</td>
                    <td className="py-2 text-right tabular-nums">{fmt(a.totalMinutes)}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
