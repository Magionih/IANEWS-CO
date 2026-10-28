import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import {
  BarChart3,
  Eye,
  FileText,
  Loader2,
  Newspaper,
  Pencil,
  Plus,
  RefreshCw,
  Search,
  Shield,
  Trash2,
  Users,
  Sparkles,
} from "lucide-react";

import { SiteHeader } from "@/components/site/header";
import { SiteFooter } from "@/components/site/footer";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  deleteArticle,
  getAdminData,
  saveArticle,
  setUserRole,
  type AdminArticle,
  type AdminReader,
  type AdminRole,
} from "@/lib/admin.functions";
import { refreshNews } from "@/lib/ingest.functions";
import { INGEST_TOPICS } from "@/lib/ingest-topics";
import { Checkbox } from "@/components/ui/checkbox";
import { Switch } from "@/components/ui/switch";
import { NewsletterPanel } from "@/components/admin/newsletter-panel";
import { MessagesPanel } from "@/components/admin/messages-panel";
import { PautasPanel } from "@/components/admin/pautas-panel";
import { SharePanel } from "@/components/admin/share-panel";
import { AnalyticsPanel } from "@/components/admin/analytics-panel";
import { ConversionPanel } from "@/components/admin/conversion-panel";
import { AdsPanel } from "@/components/admin/ads-panel";

export const Route = createFileRoute("/_authenticated/admin")({
  head: () => ({
    meta: [
      { title: "Painel administrativo — IA News" },
      {
        name: "description",
        content:
          "CRM interno do IA News: métricas de audiência, gestão de matérias, leitores, permissões e importações automáticas.",
      },
      { property: "og:title", content: "Painel administrativo — IA News" },
      {
        property: "og:description",
        content: "Central de gestão de conteúdo, leitores e automações do IA News.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
  component: AdminPage,
});

const fmtDate = (v?: string | null) =>
  v ? new Date(v).toLocaleDateString("pt-BR", { day: "2-digit", month: "short", year: "numeric" }) : "—";
const fmtNum = (n: number) => n.toLocaleString("pt-BR");

/** ISO -> valor de <input type="datetime-local"> no horário de Brasília (UTC-3). */
const toLocalInput = (iso?: string | null) => {
  if (!iso) return "";
  const d = new Date(new Date(iso).getTime() - 3 * 3600 * 1000);
  return d.toISOString().slice(0, 16);
};
/** Valor do <input type="datetime-local"> (Brasília) -> ISO. */
const fromLocalInput = (v: string) => (v ? new Date(`${v}:00-03:00`).toISOString() : null);
const fmtDateTime = (v?: string | null) =>
  v
    ? new Date(v).toLocaleString("pt-BR", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit", timeZone: "America/Sao_Paulo" })
    : "—";

function ArticleStatus({ a }: { a: AdminArticle }) {
  if (a.status === "draft")
    return <span className="rounded-md bg-secondary px-2 py-1 text-xs font-bold">Rascunho</span>;
  if (new Date(a.published_at).getTime() > Date.now())
    return (
      <span className="rounded-md bg-amber-100 px-2 py-1 text-xs font-bold text-amber-900" title="Entra no ar sozinha no horário marcado">
        Agendada · {fmtDateTime(a.published_at)}
      </span>
    );
  return <span className="text-muted-foreground">{fmtDate(a.published_at)}</span>;
}

const emptyForm = {
  id: undefined as string | undefined,
  slug: "",
  title: "",
  dek: "",
  category: "geral",
  author: "Redação IA News",
  cover_image_url: "",
  source_name: "",
  source_url: "",
  read_minutes: 3,
  body_markdown: "",
  why_it_matters: "",
  status: "published" as "draft" | "published",
  publish_at: "",
  origin: "",
  social_url: "",
};

function AdminPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const fetchAdmin = useServerFn(getAdminData);
  const [query, setQuery] = useState("");
  const [form, setForm] = useState(emptyForm);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [ingesting, setIngesting] = useState(false);
  const [ingestOpen, setIngestOpen] = useState(false);
  const [ingestOpts, setIngestOpts] = useState({
    limit: 8,
    hours: 24,
    minWords: 80,
    requireImage: true,
    topics: ["geral", "bigtech", "brasil", "regulacao"] as string[],
  });
  const runIngest = useServerFn(refreshNews);

  const { data, isLoading, error, refetch, isFetching } = useQuery({
    queryKey: ["admin-data"],
    queryFn: () => fetchAdmin(),
    retry: false,
  });

  const forbidden = !!error;

  // O painel só existe para administradores: quem não é, é levado embora.
  useEffect(() => {
    if (forbidden) navigate({ to: "/habitos", replace: true });
  }, [forbidden, navigate]);

  const articles = useMemo(() => {
    const list = data?.articles ?? [];
    const q = query.trim().toLowerCase();
    if (!q) return list;
    return list.filter(
      (a: AdminArticle) =>
        a.title.toLowerCase().includes(q) ||
        a.category.toLowerCase().includes(q) ||
        a.slug.toLowerCase().includes(q),
    );
  }, [data, query]);

  const readers = useMemo(() => {
    const list = data?.readers ?? [];
    const q = query.trim().toLowerCase();
    if (!q) return list;
    return list.filter(
      (r: AdminReader) =>
        r.full_name.toLowerCase().includes(q) || r.email.toLowerCase().includes(q),
    );
  }, [data, query]);

  function openNew() {
    setForm(emptyForm);
    setDialogOpen(true);
  }

  function openEdit(a: AdminArticle) {
    setForm({
      ...emptyForm,
      id: a.id,
      slug: a.slug,
      title: a.title,
      dek: a.dek ?? "",
      category: a.category,
      author: a.author ?? "",
      cover_image_url: a.cover_image_url ?? "",
      source_name: a.source_name ?? "",
      source_url: a.source_url ?? "",
      read_minutes: a.read_minutes ?? 3,
      body_markdown: "",
      why_it_matters: "",
      status: a.status ?? "published",
      publish_at: toLocalInput(a.published_at),
      origin: a.origin ?? "",
      social_url: a.social_url ?? "",
    });
    setDialogOpen(true);
  }

  async function submitArticle(e: React.FormEvent) {
    e.preventDefault();
    if (form.title.trim().length < 5) return toast.error("Título muito curto.");
    if (!/^[a-z0-9-]{3,}$/.test(form.slug.trim()))
      return toast.error("Slug inválido — use apenas letras minúsculas, números e hífens.");
    setSaving(true);
    try {
      const { publish_at, ...rest } = form;
      const publishedAt = fromLocalInput(publish_at);
      await saveArticle({
        data: {
          ...rest,
          published_at: publishedAt,
          origin: form.origin || null,
          social_url: form.social_url || null,
          read_minutes: Number(form.read_minutes) || 3,
          body_markdown: form.id && !form.body_markdown ? undefined : form.body_markdown,
          why_it_matters: form.why_it_matters || undefined,
        },
      });
      toast.success(
        form.status === "draft"
          ? "Rascunho salvo."
          : publishedAt && new Date(publishedAt).getTime() > Date.now()
            ? `Matéria agendada para ${fmtDateTime(publishedAt)}.`
            : form.id
              ? "Matéria atualizada."
              : "Matéria publicada.",
      );
      setDialogOpen(false);
      queryClient.invalidateQueries({ queryKey: ["admin-data"] });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Não foi possível salvar.");
    } finally {
      setSaving(false);
    }
  }

  async function removeArticle(a: AdminArticle) {
    if (!confirm(`Excluir definitivamente "${a.title}"?`)) return;
    try {
      await deleteArticle({ data: { id: a.id } });
      toast.success("Matéria excluída.");
      queryClient.invalidateQueries({ queryKey: ["admin-data"] });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Não foi possível excluir.");
    }
  }

  async function changeRole(userId: string, role: AdminRole) {
    try {
      await setUserRole({ data: { user_id: userId, role } });
      toast.success("Permissão atualizada.");
      queryClient.invalidateQueries({ queryKey: ["admin-data"] });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Não foi possível atualizar.");
    }
  }

  async function updateNews() {
    setIngesting(true);
    const toastId = toast.loading(
      `Apurando até ${ingestOpts.limit} matérias das últimas ${ingestOpts.hours}h...`,
    );
    try {
      const result = await runIngest({ data: ingestOpts });
      if (result.ok === false) {
        toast.error(result.message ?? "Falha ao atualizar notícias.", { id: toastId });
        return;
      }
      setIngestOpen(false);
      if (result.imported > 0) {
        toast.success(
          `${result.imported} novas matérias publicadas (${result.skipped} descartadas na curadoria).${
            result.errors.length ? ` Avisos: ${result.errors[0]}` : ""
          }`,
          { id: toastId },
        );
      } else {
        toast.info(
          result.errors.length
            ? result.errors[0]
            : `Nenhuma matéria nova aprovada agora (${result.skipped} descartadas). Amplie a janela de tempo ou os temas.`,
          { id: toastId },
        );
      }
      queryClient.invalidateQueries({ queryKey: ["admin-data"] });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Falha ao atualizar notícias.", {
        id: toastId,
      });
    } finally {
      setIngesting(false);
    }
  }

  function toggleTopic(value: string) {
    setIngestOpts((prev) => ({
      ...prev,
      topics: prev.topics.includes(value)
        ? prev.topics.filter((t) => t !== value)
        : [...prev.topics, value],
    }));
  }

  return (
    <div className="min-h-screen bg-background">
      <SiteHeader />
      <main className="mx-auto max-w-[1400px] px-4 py-10 sm:px-6 lg:px-8">
        <div className="flex flex-col gap-5 sm:flex-row sm:flex-wrap sm:items-end sm:justify-between">
          <div className="min-w-0">
            <p className="font-mono-eyebrow text-primary">CRM · IA News</p>
            <h1 className="mt-2 text-2xl font-extrabold tracking-tight sm:text-4xl">
              Painel administrativo
            </h1>
            <p className="mt-2 max-w-2xl text-sm text-muted-foreground sm:text-base">
              Todas as informações da operação em um só lugar: audiência, matérias, leitores,
              permissões e importações automáticas.
            </p>
          </div>
          <div className="grid grid-cols-2 gap-2 sm:flex sm:items-center">
            <Button variant="outline" className="h-11 rounded-lg font-bold" onClick={() => navigate({ to: "/admin/crm" })}>
              <Users className="mr-2 h-4 w-4" /> CRM
            </Button>
            <Button
              variant="outline"
              onClick={() => refetch()}
              className="h-11 rounded-lg"
              disabled={isFetching}
            >
              <RefreshCw className={`mr-2 h-4 w-4 ${isFetching ? "animate-spin" : ""}`} />
              Atualizar
            </Button>
            <Button
              onClick={() => setIngestOpen(true)}
              disabled={ingesting}
              variant="secondary"
              className="h-11 rounded-lg font-bold"
            >
              {ingesting ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Sparkles className="mr-2 h-4 w-4" />
              )}
              <span className="truncate">Publicação automática</span>
            </Button>
            <Button onClick={openNew} className="col-span-2 h-11 rounded-lg font-bold">
              <Plus className="mr-2 h-4 w-4" /> Nova matéria
            </Button>
          </div>
        </div>

        {isLoading ? (
          <div className="mt-16 flex items-center justify-center gap-3 text-muted-foreground">
            <Loader2 className="h-5 w-5 animate-spin" /> Carregando dados do painel...
          </div>
        ) : forbidden ? (
          <div className="mt-12 rounded-2xl border border-border bg-card p-10 text-center">
            <Shield className="mx-auto h-10 w-10 text-muted-foreground" />
            <h2 className="mt-4 text-xl font-bold">Acesso restrito</h2>
            <p className="mx-auto mt-2 max-w-md text-sm text-muted-foreground">
              Sua conta não tem permissão de administrador. Peça a um administrador para liberar
              seu acesso no painel.
            </p>
            <Button
              className="mt-6 h-11 rounded-lg"
              onClick={() => navigate({ to: "/habitos" })}
            >
              Ir para Meus Hábitos
            </Button>
          </div>
        ) : (
          data && (
            <>
              <section className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
                <StatCard icon={Newspaper} label="Matérias" value={fmtNum(data.stats.totalArticles)} />
                <StatCard icon={Eye} label="Visualizações" value={fmtNum(data.stats.totalViews)} />
                <StatCard icon={Users} label="Leitores" value={fmtNum(data.stats.totalReaders)} />
                <StatCard icon={FileText} label="Leituras (7 dias)" value={fmtNum(data.stats.readsThisWeek)} />
                <StatCard icon={BarChart3} label="Minutos (7 dias)" value={fmtNum(data.stats.minutesThisWeek)} />
              </section>

              <section className="mt-4 grid gap-4 sm:grid-cols-2">
                <StatCard
                  icon={Eye}
                  label="Taxa de conclusão de leitura"
                  value={`${data.stats.completionRate}%`}
                />
                <StatCard
                  icon={BarChart3}
                  label="Rolagem média por matéria"
                  value={`${data.stats.avgScroll}%`}
                />
              </section>

              <div className="mt-8 flex items-center gap-2 rounded-lg border border-border bg-card px-3.5 py-2.5">
                <Search className="h-4 w-4 text-muted-foreground" />
                <input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Buscar matérias ou leitores..."
                  aria-label="Buscar no painel"
                  className="w-full bg-transparent text-sm outline-none placeholder:text-muted-foreground"
                />
              </div>

              <Tabs
                defaultValue={
                  typeof window !== "undefined" && new URLSearchParams(window.location.search).get("aba") === "pautas"
                    ? "pautas"
                    : "audience"
                }
                className="mt-6"
              >
                <TabsList className="h-11 w-full justify-start overflow-x-auto">
                  <TabsTrigger value="audience">Audiência</TabsTrigger>
                  <TabsTrigger value="conversion">Conversão</TabsTrigger>
                  <TabsTrigger value="ads">Publicidade</TabsTrigger>
                  <TabsTrigger value="articles">Matérias</TabsTrigger>
                  <TabsTrigger value="readers">Leitores</TabsTrigger>
                  <TabsTrigger value="activity">Atividade</TabsTrigger>
                  <TabsTrigger value="ops">Automação</TabsTrigger>
                  <TabsTrigger value="newsletter">Newsletter</TabsTrigger>
                  <TabsTrigger value="pautas">Pautas</TabsTrigger>
                  <TabsTrigger value="messages">Mensagens</TabsTrigger>
                  <TabsTrigger value="share">Stories</TabsTrigger>
                </TabsList>

                <TabsContent value="audience" className="mt-5">
                  <AnalyticsPanel />
                </TabsContent>

                <TabsContent value="conversion" className="mt-5">
                  <ConversionPanel />
                </TabsContent>

                <TabsContent value="ads" className="mt-5">
                  <AdsPanel />
                </TabsContent>

                <TabsContent value="articles" className="mt-5">
                  <div className="overflow-x-auto rounded-2xl border border-border bg-card">
                    <table className="w-full min-w-[860px] text-sm">
                      <thead className="border-b border-border bg-secondary/50 text-left text-xs uppercase tracking-wide text-muted-foreground">
                        <tr>
                          <th className="px-4 py-3">Título</th>
                          <th className="px-4 py-3">Editoria</th>
                          <th className="px-4 py-3">Publicação</th>
                          <th className="px-4 py-3 text-right">Qualidade</th>
                          <th className="px-4 py-3 text-right">Views</th>
                          <th className="px-4 py-3 text-right">Ações</th>
                        </tr>
                      </thead>
                      <tbody>
                        {articles.map((a: AdminArticle) => (
                          <tr key={a.id} className="border-b border-border/60 last:border-0">
                            <td className="max-w-[420px] px-4 py-3">
                              <p className="truncate font-semibold">{a.title}</p>
                              <p className="truncate text-xs text-muted-foreground">/{a.slug}</p>
                            </td>
                            <td className="px-4 py-3">
                              <span className="rounded-md bg-[color:var(--color-lime)] px-2 py-1 text-xs font-bold text-white">
                                {a.category}
                              </span>
                            </td>
                            <td className="px-4 py-3">
                              <ArticleStatus a={a} />
                            </td>
                            <td className="px-4 py-3 text-right">
                              {a.quality_score == null ? (
                                <span className="text-xs text-muted-foreground">—</span>
                              ) : (
                                <span
                                  className={`rounded-md px-2 py-1 text-xs font-bold ${
                                    a.quality_score >= 9
                                      ? "bg-[color:var(--color-lime)] text-white"
                                      : "bg-secondary text-foreground"
                                  }`}
                                  title="Nota da auditoria editorial dos agentes IA News"
                                >
                                  {Number(a.quality_score).toFixed(1)}
                                </span>
                              )}
                            </td>
                            <td className="px-4 py-3 text-right font-semibold">{fmtNum(a.views_count)}</td>
                            <td className="px-4 py-3">
                              <div className="flex justify-end gap-1">
                                <Button variant="ghost" size="icon" aria-label="Editar" onClick={() => openEdit(a)}>
                                  <Pencil className="h-4 w-4" />
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  aria-label="Excluir"
                                  onClick={() => removeArticle(a)}
                                >
                                  <Trash2 className="h-4 w-4 text-destructive" />
                                </Button>
                              </div>
                            </td>
                          </tr>
                        ))}
                        {articles.length === 0 && (
                          <tr>
                            <td colSpan={5} className="px-4 py-10 text-center text-muted-foreground">
                              Nenhuma matéria encontrada.
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </TabsContent>

                <TabsContent value="readers" className="mt-5">
                  <div className="overflow-x-auto rounded-2xl border border-border bg-card">
                    <table className="w-full min-w-[900px] text-sm">
                      <thead className="border-b border-border bg-secondary/50 text-left text-xs uppercase tracking-wide text-muted-foreground">
                        <tr>
                          <th className="px-4 py-3">Leitor</th>
                          <th className="px-4 py-3">Telefone</th>
                          <th className="px-4 py-3">Cadastro</th>
                          <th className="px-4 py-3 text-right">Leituras</th>
                          <th className="px-4 py-3 text-right">Minutos</th>
                          <th className="px-4 py-3 text-right">Conclusão</th>
                          <th className="px-4 py-3">Permissão</th>
                        </tr>
                      </thead>
                      <tbody>
                        {readers.map((r: AdminReader) => (
                          <tr key={r.user_id} className="border-b border-border/60 last:border-0">
                            <td className="px-4 py-3">
                              <p className="font-semibold">{r.full_name || "—"}</p>
                              <p className="text-xs text-muted-foreground">{r.email}</p>
                            </td>
                            <td className="px-4 py-3 text-muted-foreground">{r.phone ?? "—"}</td>
                            <td className="px-4 py-3 text-muted-foreground">{fmtDate(r.created_at)}</td>
                            <td className="px-4 py-3 text-right font-semibold">{fmtNum(r.articles_read)}</td>
                            <td className="px-4 py-3 text-right font-semibold">{fmtNum(r.minutes_read)}</td>
                            <td className="px-4 py-3 text-right font-semibold">
                              {r.completion_rate}%
                              <span className="ml-1 text-xs font-normal text-muted-foreground">
                                ({r.avg_scroll}% rolagem)
                              </span>
                            </td>
                            <td className="px-4 py-3">
                              <Select
                                value={(["admin", "comercial", "editorial", "editor"] as const).find((p) => r.roles.includes(p)) ?? "reader"}
                                onValueChange={(v) => changeRole(r.user_id, v as AdminRole)}
                              >
                                <SelectTrigger className="h-9 w-[140px]">
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="reader">Leitor</SelectItem>
                                  <SelectItem value="editor">Editor</SelectItem>
                                  <SelectItem value="editorial">Editorial (CRM)</SelectItem>
                                  <SelectItem value="comercial">Comercial (CRM)</SelectItem>
                                  <SelectItem value="admin">Administrador</SelectItem>
                                </SelectContent>
                              </Select>
                            </td>
                          </tr>
                        ))}
                        {readers.length === 0 && (
                          <tr>
                            <td colSpan={7} className="px-4 py-10 text-center text-muted-foreground">
                              Nenhum leitor encontrado.
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </TabsContent>

                <TabsContent value="activity" className="mt-5 grid gap-6 lg:grid-cols-[1fr_360px]">
                  <div className="rounded-2xl border border-border bg-card p-5">
                    <h2 className="text-lg font-bold">Últimas leituras</h2>
                    <ul className="mt-4 divide-y divide-border/60">
                      {data.recentEvents.map((e: { article_slug: string; article_title: string; category: string; minutes: number; read_at: string }, i: number) => (
                        <li key={`${e.article_slug}-${i}`} className="flex items-center justify-between gap-4 py-3">
                          <div className="min-w-0">
                            <p className="truncate text-sm font-semibold">{e.article_title}</p>
                            <p className="text-xs text-muted-foreground">
                              {e.category} · {e.minutes} min
                            </p>
                          </div>
                          <span className="shrink-0 text-xs text-muted-foreground">{fmtDate(e.read_at)}</span>
                        </li>
                      ))}
                      {data.recentEvents.length === 0 && (
                        <li className="py-8 text-center text-sm text-muted-foreground">
                          Nenhuma leitura registrada ainda.
                        </li>
                      )}
                    </ul>
                  </div>
                  <div className="rounded-2xl border border-border bg-card p-5">
                    <h2 className="text-lg font-bold">Matérias por editoria</h2>
                    <ul className="mt-4 space-y-3">
                      {data.stats.categories.map((c: { name: string; count: number }) => (
                        <li key={c.name}>
                          <div className="flex items-center justify-between text-sm">
                            <span className="font-semibold">{c.name}</span>
                            <span className="text-muted-foreground">{c.count}</span>
                          </div>
                          <div className="mt-1.5 h-2 rounded-full bg-secondary">
                            <div
                              className="h-2 rounded-full bg-[color:var(--color-lime)]"
                              style={{
                                width: `${Math.round((c.count / Math.max(1, data.stats.totalArticles)) * 100)}%`,
                              }}
                            />
                          </div>
                        </li>
                      ))}
                    </ul>
                  </div>
                </TabsContent>

                <TabsContent value="ops" className="mt-5">
                  <div className="overflow-x-auto rounded-2xl border border-border bg-card">
                    <table className="w-full min-w-[720px] text-sm">
                      <thead className="border-b border-border bg-secondary/50 text-left text-xs uppercase tracking-wide text-muted-foreground">
                        <tr>
                          <th className="px-4 py-3">Início</th>
                          <th className="px-4 py-3">Status</th>
                          <th className="px-4 py-3 text-right">Importadas</th>
                          <th className="px-4 py-3">Erro</th>
                        </tr>
                      </thead>
                      <tbody>
                        {data.runs.map((run) => (
                          <tr key={run.id} className="border-b border-border/60 last:border-0">
                            <td className="px-4 py-3">
                              {new Date(run.started_at).toLocaleString("pt-BR")}
                            </td>
                            <td className="px-4 py-3">
                              <span
                                className={`rounded-md px-2 py-1 text-xs font-bold ${
                                  run.status === "success"
                                    ? "bg-[color:var(--color-lime)] text-white"
                                    : "bg-secondary text-foreground"
                                }`}
                              >
                                {run.status}
                              </span>
                            </td>
                            <td className="px-4 py-3 text-right font-semibold">{run.imported_count}</td>
                            <td className="max-w-[320px] truncate px-4 py-3 text-muted-foreground">
                              {run.error ?? "—"}
                            </td>
                          </tr>
                        ))}
                        {data.runs.length === 0 && (
                          <tr>
                            <td colSpan={4} className="px-4 py-10 text-center text-muted-foreground">
                              Nenhuma importação registrada.
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </TabsContent>

                <TabsContent value="newsletter" className="mt-5">
                  <NewsletterPanel />
                </TabsContent>

                <TabsContent value="pautas" className="mt-5">
                  <PautasPanel />
                </TabsContent>

                <TabsContent value="messages" className="mt-5">
                  <MessagesPanel />
                </TabsContent>

                <TabsContent value="share" className="mt-5">
                  <SharePanel
                    articles={(data?.articles ?? []).map((a: AdminArticle) => ({
                      slug: a.slug,
                      title: a.title,
                    }))}
                  />
                </TabsContent>
              </Tabs>
            </>
          )
        )}
      </main>
      <SiteFooter />

      <Dialog open={ingestOpen} onOpenChange={setIngestOpen}>
        <DialogContent className="max-h-[88vh] overflow-y-auto sm:max-w-xl">
          <DialogHeader>
            <DialogTitle>Publicação automática de matérias</DialogTitle>
            <DialogDescription>
              Escolha quantas matérias quer publicar, os temas e o rigor da curadoria. A apuração
              busca notícias reais, resolve a fonte original e reescreve com análise estratégica e
              SEO.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-5">
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Quantas matérias novas" id="ing-limit">
                <Select
                  value={String(ingestOpts.limit)}
                  onValueChange={(v) => setIngestOpts({ ...ingestOpts, limit: Number(v) })}
                >
                  <SelectTrigger id="ing-limit" className="h-11">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {[1, 2, 3, 5, 8, 10, 15, 20].map((n) => (
                      <SelectItem key={n} value={String(n)}>
                        {n} {n === 1 ? "matéria" : "matérias"}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
              <Field label="Janela de publicação" id="ing-hours">
                <Select
                  value={String(ingestOpts.hours)}
                  onValueChange={(v) => setIngestOpts({ ...ingestOpts, hours: Number(v) })}
                >
                  <SelectTrigger id="ing-hours" className="h-11">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="12">Últimas 12 horas</SelectItem>
                    <SelectItem value="24">Últimas 24 horas</SelectItem>
                    <SelectItem value="48">Últimas 48 horas</SelectItem>
                    <SelectItem value="72">Últimos 3 dias</SelectItem>
                    <SelectItem value="168">Última semana</SelectItem>
                  </SelectContent>
                </Select>
              </Field>
            </div>

            <div>
              <Label className="text-sm">Temas da apuração</Label>
              <div className="mt-3 grid gap-2.5 sm:grid-cols-2">
                {INGEST_TOPICS.map((t) => (
                  <label
                    key={t.value}
                    className="flex cursor-pointer items-center gap-2.5 rounded-lg border border-border px-3 py-2.5 text-sm"
                  >
                    <Checkbox
                      checked={ingestOpts.topics.includes(t.value)}
                      onCheckedChange={() => toggleTopic(t.value)}
                    />
                    <span>{t.label}</span>
                  </label>
                ))}
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Rigor da curadoria" id="ing-words">
                <Select
                  value={String(ingestOpts.minWords)}
                  onValueChange={(v) => setIngestOpts({ ...ingestOpts, minWords: Number(v) })}
                >
                  <SelectTrigger id="ing-words" className="h-11">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="60">Flexível (mais volume)</SelectItem>
                    <SelectItem value="80">Equilibrado</SelectItem>
                    <SelectItem value="250">Rigoroso (só matérias densas)</SelectItem>
                    <SelectItem value="500">Muito rigoroso</SelectItem>
                  </SelectContent>
                </Select>
              </Field>
              <div className="flex items-center justify-between gap-4 rounded-lg border border-border px-4">
                <div className="py-3">
                  <p className="text-sm font-semibold">Exigir imagem real</p>
                  <p className="text-xs text-muted-foreground">
                    Descarta notícias sem foto original.
                  </p>
                </div>
                <Switch
                  checked={ingestOpts.requireImage}
                  onCheckedChange={(v) => setIngestOpts({ ...ingestOpts, requireImage: v })}
                />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setIngestOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={updateNews} disabled={ingesting || ingestOpts.topics.length === 0} className="font-bold">
              {ingesting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Apurando...
                </>
              ) : (
                <>
                  <Sparkles className="mr-2 h-4 w-4" /> Publicar agora
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-h-[88vh] overflow-y-auto sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>{form.id ? "Editar matéria" : "Nova matéria"}</DialogTitle>
            <DialogDescription>
              {form.id
                ? "Deixe o conteúdo em branco para manter o texto atual."
                : "Publique uma matéria manualmente no IA News."}
            </DialogDescription>
          </DialogHeader>
          <form className="space-y-4" onSubmit={submitArticle}>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Título" id="title">
                <Input
                  id="title"
                  value={form.title}
                  maxLength={300}
                  onChange={(e) => setForm({ ...form, title: e.target.value })}
                  required
                />
              </Field>
              <Field label="Slug (URL)" id="slug">
                <Input
                  id="slug"
                  value={form.slug}
                  maxLength={200}
                  onChange={(e) => setForm({ ...form, slug: e.target.value })}
                  placeholder="minha-materia"
                  required
                />
              </Field>
            </div>
            <Field label="Linha fina" id="dek">
              <Textarea
                id="dek"
                value={form.dek}
                maxLength={500}
                onChange={(e) => setForm({ ...form, dek: e.target.value })}
                rows={2}
              />
            </Field>
            <div className="grid gap-4 sm:grid-cols-3">
              <Field label="Editoria" id="category">
                <Input
                  id="category"
                  value={form.category}
                  maxLength={60}
                  onChange={(e) => setForm({ ...form, category: e.target.value })}
                />
              </Field>
              <Field label="Autor" id="author">
                <Input
                  id="author"
                  value={form.author}
                  maxLength={120}
                  onChange={(e) => setForm({ ...form, author: e.target.value })}
                />
              </Field>
              <Field label="Minutos de leitura" id="read_minutes">
                <Input
                  id="read_minutes"
                  type="number"
                  min={1}
                  max={60}
                  value={form.read_minutes}
                  onChange={(e) => setForm({ ...form, read_minutes: Number(e.target.value) })}
                />
              </Field>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Status" id="status">
                <select
                  id="status"
                  className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                  value={form.status}
                  onChange={(e) => setForm({ ...form, status: e.target.value as "draft" | "published" })}
                >
                  <option value="published">Publicar (agora ou na data abaixo)</option>
                  <option value="draft">Rascunho (não aparece no site)</option>
                </select>
              </Field>
              <Field label="Publicar em (horário de Brasília)" id="publish_at">
                <Input
                  id="publish_at"
                  type="datetime-local"
                  value={form.publish_at}
                  onChange={(e) => setForm({ ...form, publish_at: e.target.value })}
                />
              </Field>
            </div>
            <p className="-mt-2 text-xs text-muted-foreground">
              Deixe a data em branco para publicar agora. Com data futura, a matéria fica agendada e entra no ar sozinha.
            </p>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Canal de origem" id="origin">
                <select
                  id="origin"
                  className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                  value={form.origin}
                  onChange={(e) => setForm({ ...form, origin: e.target.value })}
                >
                  <option value="">Redação (site)</option>
                  <option value="instagram">Instagram</option>
                  <option value="linkedin">LinkedIn</option>
                  <option value="newsletter">Newsletter</option>
                </select>
              </Field>
              <Field label="Link do post (opcional)" id="social_url">
                <Input
                  id="social_url"
                  value={form.social_url}
                  onChange={(e) => setForm({ ...form, social_url: e.target.value })}
                  placeholder="https://www.instagram.com/p/..."
                />
              </Field>
            </div>
            <Field label="Imagem de capa (URL)" id="cover">
              <Input
                id="cover"
                value={form.cover_image_url}
                onChange={(e) => setForm({ ...form, cover_image_url: e.target.value })}
                placeholder="https://..."
              />
            </Field>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Fonte" id="source_name">
                <Input
                  id="source_name"
                  value={form.source_name}
                  maxLength={120}
                  onChange={(e) => setForm({ ...form, source_name: e.target.value })}
                />
              </Field>
              <Field label="Link da fonte" id="source_url">
                <Input
                  id="source_url"
                  value={form.source_url}
                  onChange={(e) => setForm({ ...form, source_url: e.target.value })}
                  placeholder="https://..."
                />
              </Field>
            </div>
            <Field label="Conteúdo (markdown)" id="body">
              <Textarea
                id="body"
                value={form.body_markdown}
                onChange={(e) => setForm({ ...form, body_markdown: e.target.value })}
                rows={8}
                required={!form.id}
              />
            </Field>
            <Field label="Por que isso importa" id="why">
              <Textarea
                id="why"
                value={form.why_it_matters}
                onChange={(e) => setForm({ ...form, why_it_matters: e.target.value })}
                rows={3}
              />
            </Field>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>
                Cancelar
              </Button>
              <Button type="submit" disabled={saving} className="font-bold">
                {saving ? "Salvando..." : form.id ? "Salvar alterações" : "Publicar"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function Field({
  label,
  id,
  children,
}: {
  label: string;
  id: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-2">
      <Label htmlFor={id}>{label}</Label>
      {children}
    </div>
  );
}

function StatCard({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof Users;
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-2xl border border-border bg-card p-5">
      <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-[color:var(--color-lime)]">
        <Icon className="h-5 w-5 text-white" />
      </div>
      <p className="mt-4 text-2xl font-extrabold tracking-tight">{value}</p>
      <p className="text-sm text-muted-foreground">{label}</p>
    </div>
  );
}
