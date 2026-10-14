import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import { BookOpen, Clock, Flame, LogOut, Target } from "lucide-react";
import { toast } from "sonner";

import { SiteHeader } from "@/components/site/header";
import { SiteFooter } from "@/components/site/footer";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { supabase } from "@/integrations/supabase/client";
import {
  getReadingDashboard,
  saveReadingGoals,
  type ReadingEvent,
} from "@/lib/reading.functions";

export const Route = createFileRoute("/_authenticated/habitos")({
  head: () => ({
    meta: [
      { title: "Meus Hábitos de leitura — IA News" },
      {
        name: "description",
        content:
          "Acompanhe seu tempo de leitura, metas semanais, sequência de dias e as editorias que você mais lê no IA News.",
      },
      { property: "og:title", content: "Meus Hábitos de leitura — IA News" },
      {
        property: "og:description",
        content: "Tempo de leitura, metas semanais e sequência de dias no IA News.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: HabitosPage,
});

function startOfWeek(): Date {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  const day = (d.getDay() + 6) % 7; // segunda = 0
  d.setDate(d.getDate() - day);
  return d;
}

function computeStreak(events: ReadingEvent[]): number {
  const days = new Set(events.map((e) => new Date(e.read_at).toDateString()));
  let streak = 0;
  const cursor = new Date();
  cursor.setHours(0, 0, 0, 0);
  if (!days.has(cursor.toDateString())) cursor.setDate(cursor.getDate() - 1);
  while (days.has(cursor.toDateString())) {
    streak += 1;
    cursor.setDate(cursor.getDate() - 1);
  }
  return streak;
}

function HabitosPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const fetchDashboard = useServerFn(getReadingDashboard);
  const persistGoals = useServerFn(saveReadingGoals);

  const { data, isLoading } = useQuery({
    queryKey: ["reading-dashboard"],
    queryFn: () => fetchDashboard(),
  });

  const events = data?.events ?? [];
  const goals = data?.goals ?? { weekly_articles: 10, weekly_minutes: 60, daily_streak_goal: 5 };
  const profile = data?.profile ?? null;

  const [articlesGoal, setArticlesGoal] = useState(String(goals.weekly_articles));
  const [minutesGoal, setMinutesGoal] = useState(String(goals.weekly_minutes));
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setArticlesGoal(String(goals.weekly_articles));
    setMinutesGoal(String(goals.weekly_minutes));
  }, [goals.weekly_articles, goals.weekly_minutes]);

  const weekStart = startOfWeek().getTime();
  const weekEvents = events.filter((e) => new Date(e.read_at).getTime() >= weekStart);
  const weekMinutes = weekEvents.reduce((sum, e) => sum + e.minutes, 0);
  const totalMinutes = events.reduce((sum, e) => sum + e.minutes, 0);
  const streak = computeStreak(events);
  const completionRate = events.length
    ? Math.round((events.filter((e) => e.completed).length / events.length) * 100)
    : 0;
  const avgSeconds = events.length
    ? Math.round(events.reduce((s, e) => s + (e.seconds_read ?? 0), 0) / events.length)
    : 0;

  const byCategory = new Map<string, number>();
  events.forEach((e) => byCategory.set(e.category, (byCategory.get(e.category) ?? 0) + 1));
  const topCategories = [...byCategory.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5);
  const maxCat = topCategories[0]?.[1] ?? 1;

  const last7 = Array.from({ length: 7 }, (_, i) => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    d.setDate(d.getDate() - (6 - i));
    const minutes = events
      .filter((e) => new Date(e.read_at).toDateString() === d.toDateString())
      .reduce((sum, e) => sum + e.minutes, 0);
    return { label: d.toLocaleDateString("pt-BR", { weekday: "short" }).slice(0, 3), minutes };
  });
  const maxDay = Math.max(1, ...last7.map((d) => d.minutes));

  async function onSaveGoals(e: React.FormEvent) {
    e.preventDefault();
    const a = Number(articlesGoal);
    const m = Number(minutesGoal);
    if (!Number.isFinite(a) || a < 1 || a > 100) {
      toast.error("Meta de matérias deve ficar entre 1 e 100.");
      return;
    }
    if (!Number.isFinite(m) || m < 5 || m > 2000) {
      toast.error("Meta de minutos deve ficar entre 5 e 2000.");
      return;
    }
    setSaving(true);
    try {
      await persistGoals({ data: { weekly_articles: a, weekly_minutes: m } });
      await queryClient.invalidateQueries({ queryKey: ["reading-dashboard"] });
      toast.success("Metas atualizadas.");
    } catch (err) {
      console.error(err);
      toast.error("Não foi possível salvar suas metas.");
    } finally {
      setSaving(false);
    }
  }

  async function onSignOut() {
    await queryClient.cancelQueries();
    queryClient.clear();
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  }

  return (
    <div className="min-h-screen bg-background">
      <SiteHeader />
      <main className="mx-auto max-w-[1400px] px-4 py-10 sm:px-6 lg:px-8">
        <div className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-4 sm:flex sm:flex-wrap sm:items-end sm:justify-between">
          <div className="min-w-0">
            <p className="font-mono-eyebrow text-primary">Área do leitor</p>
            <h1 className="mt-2 text-3xl font-extrabold tracking-tight sm:text-4xl md:text-5xl">
              Meus Hábitos
            </h1>
            <p className="mt-3 max-w-2xl text-base text-muted-foreground sm:text-lg">
              {profile?.full_name
                ? `Olá, ${profile.full_name.split(" ")[0]} — aqui está sua rotina de leitura.`
                : "Sua rotina de leitura no IA News, medida de verdade."}
            </p>
          </div>
          <Button variant="outline" className="h-11 shrink-0 rounded-lg" onClick={onSignOut}>
            <LogOut className="mr-2 h-4 w-4" /> Sair
          </Button>
        </div>

        {isLoading ? (
          <p className="mt-10 text-muted-foreground">Carregando seus dados...</p>
        ) : (
          <>
            <div className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
              <StatCard
                icon={<BookOpen className="h-4 w-4" />}
                label="Matérias nesta semana"
                value={String(weekEvents.length)}
                hint={`meta de ${goals.weekly_articles}`}
              />
              <StatCard
                icon={<Clock className="h-4 w-4" />}
                label="Minutos nesta semana"
                value={String(weekMinutes)}
                hint={`meta de ${goals.weekly_minutes} min`}
              />
              <StatCard
                icon={<Flame className="h-4 w-4" />}
                label="Sequência de dias"
                value={String(streak)}
                hint={streak === 1 ? "dia seguido" : "dias seguidos"}
              />
              <StatCard
                icon={<Target className="h-4 w-4" />}
                label="Tempo total (60 dias)"
                value={`${Math.round(totalMinutes / 60)}h`}
                hint={`${totalMinutes} minutos lidos`}
              />
            </div>

            <div className="mt-5 grid gap-5 sm:grid-cols-2">
              <StatCard
                icon={<Target className="h-4 w-4" />}
                label="Matérias concluídas"
                value={`${completionRate}%`}
                hint="leituras que você levou até o fim"
              />
              <StatCard
                icon={<Clock className="h-4 w-4" />}
                label="Tempo médio por matéria"
                value={
                  avgSeconds >= 60
                    ? `${Math.floor(avgSeconds / 60)}m ${avgSeconds % 60}s`
                    : `${avgSeconds}s`
                }
                hint="medido em tempo real de leitura"
              />
            </div>

            <div className="mt-10 grid gap-8 lg:grid-cols-[minmax(0,1fr)_360px]">
              <div className="space-y-8">
                <section className="rounded-xl bg-secondary/60 p-6">
                  <h2 className="text-xl font-bold">Progresso da semana</h2>
                  <div className="mt-5 space-y-5">
                    <GoalBar
                      label="Matérias lidas"
                      current={weekEvents.length}
                      goal={goals.weekly_articles}
                      unit=""
                    />
                    <GoalBar
                      label="Tempo de leitura"
                      current={weekMinutes}
                      goal={goals.weekly_minutes}
                      unit=" min"
                    />
                  </div>
                </section>

                <section className="rounded-xl bg-secondary/60 p-6">
                  <h2 className="text-xl font-bold">Últimos 7 dias</h2>
                  <div className="mt-6 flex h-40 items-end gap-3">
                    {last7.map((d, i) => (
                      <div key={i} className="flex flex-1 flex-col items-center gap-2">
                        <span className="text-xs font-semibold text-muted-foreground">
                          {d.minutes || ""}
                        </span>
                        <div
                          className="w-full rounded-t-md"
                          style={{
                            height: `${Math.max(4, (d.minutes / maxDay) * 100)}%`,
                            background:
                              d.minutes > 0
                                ? "var(--color-lime)"
                                : "color-mix(in oklab, var(--color-nav) 12%, transparent)",
                          }}
                        />
                        <span className="text-xs capitalize text-muted-foreground">{d.label}</span>
                      </div>
                    ))}
                  </div>
                </section>

                <section className="rounded-xl bg-secondary/60 p-6">
                  <h2 className="text-xl font-bold">Histórico de leitura</h2>
                  {events.length === 0 ? (
                    <p className="mt-4 text-muted-foreground">
                      Você ainda não leu nenhuma matéria por aqui.{" "}
                      <Link
                        to="/noticias"
                        search={{ q: "", cat: "all" }}
                        className="font-semibold text-primary hover:underline"
                      >
                        Comece agora
                      </Link>
                      .
                    </p>
                  ) : (
                    <ul className="mt-4 divide-y divide-border/70">
                      {events.slice(0, 12).map((e) => (
                        <li key={e.id} className="flex items-start justify-between gap-4 py-3.5">
                          <div>
                            <Link
                              to="/materia/$slug"
                              params={{ slug: e.article_slug }}
                              className="text-[15px] font-semibold leading-snug hover:text-primary"
                            >
                              {e.article_title || e.article_slug}
                            </Link>
                            <p className="mt-1 text-xs text-muted-foreground">
                              {new Date(e.read_at).toLocaleDateString("pt-BR", {
                                day: "2-digit",
                                month: "short",
                                hour: "2-digit",
                                minute: "2-digit",
                              })}
                            </p>
                          </div>
                          <span className="shrink-0 text-xs font-semibold text-muted-foreground">
                            {e.minutes} min
                          </span>
                        </li>
                      ))}
                    </ul>
                  )}
                </section>
              </div>

              <aside className="flex flex-col gap-6">
                <section className="rounded-xl bg-secondary/60 p-6">
                  <h2 className="text-xl font-bold">Minhas metas</h2>
                  <form className="mt-4 space-y-4" onSubmit={onSaveGoals}>
                    <div className="space-y-2">
                      <Label htmlFor="articlesGoal">Matérias por semana</Label>
                      <Input
                        id="articlesGoal"
                        type="number"
                        min={1}
                        max={100}
                        value={articlesGoal}
                        onChange={(e) => setArticlesGoal(e.target.value)}
                        className="h-11 rounded-lg"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="minutesGoal">Minutos por semana</Label>
                      <Input
                        id="minutesGoal"
                        type="number"
                        min={5}
                        max={2000}
                        value={minutesGoal}
                        onChange={(e) => setMinutesGoal(e.target.value)}
                        className="h-11 rounded-lg"
                      />
                    </div>
                    <Button
                      type="submit"
                      disabled={saving}
                      className="h-11 w-full rounded-lg font-bold"
                    >
                      {saving ? "Salvando..." : "Salvar metas"}
                    </Button>
                  </form>
                </section>

                <section className="rounded-xl bg-secondary/60 p-6">
                  <h2 className="text-xl font-bold">Suas editorias</h2>
                  {topCategories.length === 0 ? (
                    <p className="mt-3 text-sm text-muted-foreground">
                      Leia algumas matérias para ver seu perfil de interesse.
                    </p>
                  ) : (
                    <ul className="mt-4 space-y-3">
                      {topCategories.map(([cat, count]) => (
                        <li key={cat}>
                          <div className="flex items-center justify-between text-sm">
                            <span className="font-medium capitalize">{cat}</span>
                            <span className="text-muted-foreground">{count}</span>
                          </div>
                          <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-border/60">
                            <div
                              className="h-full rounded-full"
                              style={{
                                width: `${(count / maxCat) * 100}%`,
                                background: "var(--color-lime)",
                              }}
                            />
                          </div>
                        </li>
                      ))}
                    </ul>
                  )}
                </section>

                {profile ? (
                  <section className="rounded-xl bg-secondary/60 p-6">
                    <h2 className="text-xl font-bold">Meus dados</h2>
                    <dl className="mt-4 space-y-3 text-sm">
                      <div>
                        <dt className="text-muted-foreground">Nome</dt>
                        <dd className="font-semibold">{profile.full_name || "—"}</dd>
                      </div>
                      <div>
                        <dt className="text-muted-foreground">E-mail</dt>
                        <dd className="font-semibold">{profile.email || "—"}</dd>
                      </div>
                      <div>
                        <dt className="text-muted-foreground">Telefone</dt>
                        <dd className="font-semibold">{profile.phone || "—"}</dd>
                      </div>
                    </dl>
                  </section>
                ) : null}
              </aside>
            </div>
          </>
        )}
      </main>
      <SiteFooter />
    </div>
  );
}

function StatCard({
  icon,
  label,
  value,
  hint,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  hint: string;
}) {
  return (
    <div className="rounded-xl border border-border/60 bg-background p-5 shadow-[var(--shadow-mui-sm)]">
      <p className="flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
        {icon}
        {label}
      </p>
      <p className="mt-3 text-3xl font-extrabold">{value}</p>
      <p className="mt-1 text-xs text-muted-foreground">{hint}</p>
    </div>
  );
}

function GoalBar({
  label,
  current,
  goal,
  unit,
}: {
  label: string;
  current: number;
  goal: number;
  unit: string;
}) {
  const pct = Math.min(100, Math.round((current / Math.max(1, goal)) * 100));
  return (
    <div>
      <div className="flex items-center justify-between text-sm">
        <span className="font-medium">{label}</span>
        <span className="text-muted-foreground">
          {current}
          {unit} / {goal}
          {unit} — {pct}%
        </span>
      </div>
      <Progress value={pct} className="mt-2 h-2.5" />
    </div>
  );
}