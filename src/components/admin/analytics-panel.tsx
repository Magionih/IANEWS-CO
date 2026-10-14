import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Activity, Eye, Globe, Loader2, MonitorSmartphone, Users } from "lucide-react";

import { getSiteAnalytics, type Bucket } from "@/lib/analytics.functions";

const fmt = (n: number) => n.toLocaleString("pt-BR");
const fmtDateTime = (v: string) =>
  new Date(v).toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });

function Stat({
  label,
  value,
  hint,
  icon: Icon,
}: {
  label: string;
  value: string;
  hint?: string;
  icon: typeof Eye;
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

function BucketList({ title, items }: { title: string; items: Bucket[] }) {
  const max = Math.max(1, ...items.map((i) => i.count));
  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <h3 className="text-sm font-bold">{title}</h3>
      <ul className="mt-3 space-y-2">
        {items.length === 0 ? (
          <li className="text-xs text-muted-foreground">Sem dados ainda.</li>
        ) : (
          items.map((i) => (
            <li key={i.key} className="text-xs">
              <div className="flex items-center justify-between gap-3">
                <span className="truncate font-medium">{i.key}</span>
                <span className="shrink-0 tabular-nums text-muted-foreground">{fmt(i.count)}</span>
              </div>
              <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-muted">
                <div
                  className="h-full rounded-full bg-primary"
                  style={{ width: `${(i.count / max) * 100}%` }}
                />
              </div>
            </li>
          ))
        )}
      </ul>
    </div>
  );
}

export function AnalyticsPanel() {
  const fetchAnalytics = useServerFn(getSiteAnalytics);
  const { data, isLoading, error } = useQuery({
    queryKey: ["site-analytics"],
    queryFn: () => fetchAnalytics(),
    retry: false,
    refetchInterval: 60_000,
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center gap-3 py-16 text-muted-foreground">
        <Loader2 className="h-5 w-5 animate-spin" /> Carregando audiência...
      </div>
    );
  }
  if (error || !data) {
    return (
      <p className="py-10 text-center text-sm text-muted-foreground">
        Não foi possível carregar as métricas de audiência.
      </p>
    );
  }

  const t = data.totals;
  const maxDay = Math.max(1, ...data.byDay.map((d) => d.pageviews));

  return (
    <div className="space-y-6">
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Stat
          label="Online agora"
          value={fmt(t.online)}
          hint="visitantes ativos nos últimos 5 min"
          icon={Activity}
        />
        <Stat
          label="Visitantes (24h)"
          value={fmt(t.visitors24h)}
          hint={`${fmt(t.pageviews24h)} páginas vistas`}
          icon={Users}
        />
        <Stat
          label="Visitantes (7 dias)"
          value={fmt(t.visitors7d)}
          hint={`${fmt(t.pageviews7d)} páginas vistas`}
          icon={Users}
        />
        <Stat
          label="Visitantes (30 dias)"
          value={fmt(t.visitors30d)}
          hint={`${fmt(t.pageviews30d)} páginas vistas`}
          icon={Globe}
        />
        <Stat label="Sessões (30 dias)" value={fmt(t.sessions)} icon={MonitorSmartphone} />
        <Stat
          label="Páginas por sessão"
          value={t.viewsPerSession.toLocaleString("pt-BR")}
          icon={Eye}
        />
        <Stat
          label="Novos visitantes"
          value={fmt(t.newVisitors)}
          hint="primeira visita ao site"
          icon={Users}
        />
        <Stat
          label="Acessos logados"
          value={fmt(t.loggedVisits)}
          hint="visitas com conta conectada"
          icon={Users}
        />
      </div>

      <div className="rounded-xl border border-border bg-card p-4">
        <h3 className="text-sm font-bold">Acessos por dia (30 dias)</h3>
        <div className="mt-4 flex h-40 items-end gap-1">
          {data.byDay.map((d) => (
            <div key={d.day} className="group relative flex-1">
              <div
                className="w-full rounded-t bg-primary/80 transition-colors group-hover:bg-primary"
                style={{ height: `${Math.max(2, (d.pageviews / maxDay) * 150)}px` }}
              />
              <span className="pointer-events-none absolute bottom-full left-1/2 z-10 mb-1 hidden -translate-x-1/2 whitespace-nowrap rounded bg-foreground px-2 py-1 text-[10px] font-semibold text-background group-hover:block">
                {d.day.slice(8)}/{d.day.slice(5, 7)} · {fmt(d.pageviews)} views ·{" "}
                {fmt(d.visitors)} visitantes
              </span>
            </div>
          ))}
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="rounded-xl border border-border bg-card p-4">
          <h3 className="text-sm font-bold">Páginas mais acessadas</h3>
          <ul className="mt-3 space-y-2">
            {data.topPages.length === 0 ? (
              <li className="text-xs text-muted-foreground">Sem dados ainda.</li>
            ) : (
              data.topPages.map((p) => (
                <li key={p.key} className="flex items-center justify-between gap-3 text-xs">
                  <span className="min-w-0 truncate">
                    <span className="font-medium">{p.title ?? p.key}</span>
                    <span className="ml-2 text-muted-foreground">{p.key}</span>
                  </span>
                  <span className="shrink-0 tabular-nums font-semibold">{fmt(p.count)}</span>
                </li>
              ))
            )}
          </ul>
        </div>
        <BucketList title="Origem do tráfego" items={data.byReferrer} />
        <BucketList title="Dispositivos" items={data.byDevice} />
        <BucketList title="Navegadores" items={data.byBrowser} />
        <BucketList title="Sistemas" items={data.byOs} />
        <BucketList title="Países" items={data.byCountry} />
        <BucketList title="Campanhas (utm_source)" items={data.byUtm} />
        <div className="rounded-xl border border-border bg-card p-4">
          <h3 className="text-sm font-bold">Acessos por hora (7 dias)</h3>
          <div className="mt-4 flex h-28 items-end gap-1">
            {data.byHour.map((h) => {
              const max = Math.max(1, ...data.byHour.map((x) => x.count));
              return (
                <div key={h.key} className="flex-1 text-center">
                  <div
                    className="w-full rounded-t bg-primary/70"
                    style={{ height: `${Math.max(2, (h.count / max) * 90)}px` }}
                    title={`${h.key}h · ${fmt(h.count)}`}
                  />
                </div>
              );
            })}
          </div>
          <p className="mt-2 text-[10px] text-muted-foreground">00h → 23h</p>
        </div>
      </div>

      <div className="rounded-xl border border-border bg-card p-4">
        <h3 className="text-sm font-bold">Acessos recentes</h3>
        <div className="mt-3 overflow-x-auto">
          <table className="w-full min-w-[640px] text-xs">
            <thead className="text-left text-muted-foreground">
              <tr>
                <th className="py-2">Quando</th>
                <th className="py-2">Página</th>
                <th className="py-2">Origem</th>
                <th className="py-2">Dispositivo</th>
                <th className="py-2">País</th>
              </tr>
            </thead>
            <tbody>
              {data.recent.map((v) => (
                <tr key={v.id} className="border-t border-border/60">
                  <td className="py-2 whitespace-nowrap">{fmtDateTime(v.visited_at)}</td>
                  <td className="max-w-[260px] truncate py-2">{v.path}</td>
                  <td className="py-2">{v.referrer_host ?? "direto"}</td>
                  <td className="py-2">
                    {v.device} · {v.browser}
                  </td>
                  <td className="py-2">{v.country ?? "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {data.recent.length === 0 ? (
            <p className="py-6 text-center text-xs text-muted-foreground">
              Ainda não há acessos registrados. Os dados aparecem assim que o site receber visitas.
            </p>
          ) : null}
        </div>
      </div>
    </div>
  );
}
