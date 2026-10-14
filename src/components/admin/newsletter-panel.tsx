import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Eye, Loader2, Mail, Send, Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  deleteLead,
  getNewsletterData,
  previewNewsletter,
  sendNewsletterNow,
  sendRankingNewsletterNow,
  setLeadActive,
  type Lead,
  type NewsletterSend,
} from "@/lib/newsletter.functions";

const fmtDateTime = (v?: string | null) => (v ? new Date(v).toLocaleString("pt-BR") : "—");

function StatusBadge({ status }: { status: string }) {
  const tone =
    status === "sent"
      ? "bg-[color:var(--color-lime)] text-white"
      : status === "failed"
        ? "bg-destructive text-destructive-foreground"
        : "bg-secondary text-foreground";
  return <span className={`rounded-md px-2 py-1 text-xs font-bold ${tone}`}>{status}</span>;
}

export function NewsletterPanel() {
  const queryClient = useQueryClient();
  const fetchData = useServerFn(getNewsletterData);
  const sendNow = useServerFn(sendNewsletterNow);
  const sendRanking = useServerFn(sendRankingNewsletterNow);
  const toggleLead = useServerFn(setLeadActive);
  const removeLead = useServerFn(deleteLead);
  const loadPreview = useServerFn(previewNewsletter);

  const [testEmail, setTestEmail] = useState("");
  const [sending, setSending] = useState(false);
  const [sendingRanking, setSendingRanking] = useState(false);
  const [search, setSearch] = useState("");
  const [previewOpen, setPreviewOpen] = useState(false);

  const preview = useQuery({
    queryKey: ["newsletter-preview"],
    queryFn: () => loadPreview(),
    enabled: previewOpen,
    retry: false,
  });

  const { data, isLoading } = useQuery({
    queryKey: ["newsletter-data"],
    queryFn: () => fetchData(),
    retry: false,
  });

  async function dispatch(test: boolean) {
    if (test && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(testEmail.trim())) {
      toast.error("Informe um e-mail válido para o teste.");
      return;
    }
    setSending(true);
    const id = toast.loading(test ? "Enviando edição de teste..." : "Enviando a edição diária...");
    try {
      const res = await sendNow({
        data: { limit: 5, testEmail: test ? testEmail.trim() : undefined },
      });
      if (res.ok) toast.success(res.message, { id });
      else toast.error(res.message, { id });
      queryClient.invalidateQueries({ queryKey: ["newsletter-data"] });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Falha ao enviar.", { id });
    } finally {
      setSending(false);
    }
  }

  async function dispatchRanking(test: boolean) {
    if (test && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(testEmail.trim())) {
      toast.error("Informe um e-mail válido no campo de teste acima.");
      return;
    }
    setSendingRanking(true);
    const id = toast.loading(
      test ? "Enviando ranking de teste..." : "Enviando o Ranking IA semanal...",
    );
    try {
      const res = await sendRanking({
        data: { limit: 8, testEmail: test ? testEmail.trim() : undefined },
      });
      if (res.ok) toast.success(res.message, { id });
      else toast.error(res.message, { id });
      queryClient.invalidateQueries({ queryKey: ["newsletter-data"] });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Falha ao enviar.", { id });
    } finally {
      setSendingRanking(false);
    }
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center gap-3 py-16 text-muted-foreground">
        <Loader2 className="h-5 w-5 animate-spin" /> Carregando base de leads...
      </div>
    );
  }
  if (!data) return null;

  const leads = (data.leads as Lead[]).filter((l) => {
    const q = search.trim().toLowerCase();
    if (!q) return true;
    return (
      l.email.toLowerCase().includes(q) ||
      (l.full_name ?? "").toLowerCase().includes(q) ||
      (l.phone ?? "").toLowerCase().includes(q)
    );
  });
  const sends = data.sends as NewsletterSend[];

  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {[
          { label: "Leads na base", value: data.stats.totalLeads },
          { label: "Assinantes ativos", value: data.stats.activeLeads },
          { label: "Novos (7 dias)", value: data.stats.newThisWeek },
          { label: "E-mails entregues", value: data.stats.delivered },
        ].map((s) => (
          <div key={s.label} className="rounded-2xl border border-border bg-card p-5">
            <p className="text-xs uppercase tracking-wide text-muted-foreground">{s.label}</p>
            <p className="mt-2 text-2xl font-extrabold">{s.value.toLocaleString("pt-BR")}</p>
          </div>
        ))}
      </div>

      <div className="rounded-2xl border border-border bg-card p-5">
        <div className="flex items-start gap-3">
          <Mail className="mt-1 h-5 w-5 text-[color:var(--color-lime)]" />
          <div>
            <h3 className="font-bold">Edição diária automática</h3>
            <p className="mt-1 text-sm text-muted-foreground">
              Todo dia às 8h (Brasília) o sistema apura novas notícias e envia as 5 matérias mais
              recentes para todos os assinantes ativos. Use os botões abaixo para disparar
              manualmente ou testar o layout.
            </p>
          </div>
        </div>
        <div className="mt-4 flex flex-col gap-3 sm:flex-row">
          <Button
            variant="secondary"
            className="h-11"
            onClick={() => setPreviewOpen(true)}
          >
            <Eye className="mr-2 h-4 w-4" />
            Ver layout do e-mail
          </Button>
          <Input
            value={testEmail}
            onChange={(e) => setTestEmail(e.target.value)}
            placeholder="e-mail para teste"
            aria-label="E-mail de teste"
            className="h-11 sm:max-w-xs"
          />
          <Button
            variant="outline"
            className="h-11"
            disabled={sending}
            onClick={() => dispatch(true)}
          >
            Enviar teste
          </Button>
          <Button className="h-11 font-bold" disabled={sending} onClick={() => dispatch(false)}>
            {sending ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Send className="mr-2 h-4 w-4" />
            )}
            Enviar edição agora
          </Button>
        </div>
      </div>


      <div className="rounded-2xl border border-border bg-card p-5">
        <div className="flex items-start gap-3">
          <Mail className="mt-1 h-5 w-5 text-primary" />
          <div>
            <h3 className="font-bold">Ranking IA semanal automático</h3>
            <p className="mt-1 text-sm text-muted-foreground">
              Toda segunda-feira às 8h (Brasília) os leads que pediram o comparativo na página de
              Ranking IA recebem as melhores ferramentas de inteligência artificial da semana, no
              mesmo formato de ranking do site.
            </p>
          </div>
        </div>
        <div className="mt-4 flex flex-col gap-3 sm:flex-row">
          <Button
            variant="outline"
            className="h-11"
            disabled={sendingRanking}
            onClick={() => dispatchRanking(true)}
          >
            Enviar ranking de teste
          </Button>
          <Button
            className="h-11 font-bold"
            disabled={sendingRanking}
            onClick={() => dispatchRanking(false)}
          >
            {sendingRanking ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Send className="mr-2 h-4 w-4" />
            )}
            Enviar ranking agora
          </Button>
        </div>
      </div>



      <Dialog open={previewOpen} onOpenChange={setPreviewOpen}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>Layout da newsletter</DialogTitle>
            <DialogDescription>
              {preview.data?.live
                ? "Pré-visualização com as 5 matérias mais recentes do site."
                : "Pré-visualização com conteúdo de exemplo (ainda não há matérias publicadas)."}
            </DialogDescription>
          </DialogHeader>
          {preview.isLoading ? (
            <div className="flex items-center justify-center gap-3 py-16 text-muted-foreground">
              <Loader2 className="h-5 w-5 animate-spin" /> Montando a edição...
            </div>
          ) : preview.error ? (
            <p className="py-10 text-center text-sm text-destructive">
              Não foi possível carregar o layout: {(preview.error as Error).message}
            </p>
          ) : (
            <iframe
              title="Pré-visualização da newsletter"
              srcDoc={preview.data?.html ?? ""}
              className="h-[65vh] w-full rounded-xl border border-border bg-white"
            />
          )}
        </DialogContent>
      </Dialog>

      <div>
        <h3 className="mb-3 font-bold">Histórico de envios</h3>
        <div className="overflow-x-auto rounded-2xl border border-border bg-card">
          <table className="w-full min-w-[820px] text-sm">
            <thead className="border-b border-border bg-secondary/50 text-left text-xs uppercase tracking-wide text-muted-foreground">
              <tr>
                <th className="px-4 py-3">Assunto</th>
                <th className="px-4 py-3">Enviada em</th>
                <th className="px-4 py-3">Origem</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3 text-right">Destinatários</th>
                <th className="px-4 py-3 text-right">Entregues</th>
                <th className="px-4 py-3 text-right">Falhas</th>
              </tr>
            </thead>
            <tbody>
              {sends.map((s) => (
                <tr key={s.id} className="border-b border-border/60 last:border-0">
                  <td className="max-w-[320px] truncate px-4 py-3 font-semibold">{s.subject}</td>
                  <td className="px-4 py-3">{fmtDateTime(s.started_at)}</td>
                  <td className="px-4 py-3 text-muted-foreground">{s.triggered_by}</td>
                  <td className="px-4 py-3">
                    <StatusBadge status={s.status} />
                  </td>
                  <td className="px-4 py-3 text-right">{s.recipients_count}</td>
                  <td className="px-4 py-3 text-right font-semibold">{s.delivered_count}</td>
                  <td className="px-4 py-3 text-right">{s.failed_count}</td>
                </tr>
              ))}
              {sends.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-4 py-10 text-center text-muted-foreground">
                    Nenhuma newsletter enviada ainda.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div>
        <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
          <h3 className="font-bold">Base de leads ({leads.length})</h3>
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar lead por nome ou e-mail"
            aria-label="Buscar lead"
            className="h-10 sm:max-w-xs"
          />
        </div>
        <div className="overflow-x-auto rounded-2xl border border-border bg-card">
          <table className="w-full min-w-[760px] text-sm">
            <thead className="border-b border-border bg-secondary/50 text-left text-xs uppercase tracking-wide text-muted-foreground">
              <tr>
                <th className="px-4 py-3">E-mail</th>
                <th className="px-4 py-3">Nome</th>
                <th className="px-4 py-3">Telefone</th>
                <th className="px-4 py-3">Origem</th>
                <th className="px-4 py-3">Cadastro</th>
                <th className="px-4 py-3">Ativo</th>
                <th className="px-4 py-3 text-right">Ações</th>
              </tr>
            </thead>
            <tbody>
              {leads.map((l) => (
                <tr key={l.id} className="border-b border-border/60 last:border-0">
                  <td className="px-4 py-3 font-semibold">{l.email}</td>
                  <td className="px-4 py-3">{l.full_name ?? "—"}</td>
                  <td className="px-4 py-3 text-muted-foreground">{l.phone ?? "—"}</td>
                  <td className="px-4 py-3 text-muted-foreground">{l.source}</td>
                  <td className="px-4 py-3">{fmtDateTime(l.created_at)}</td>
                  <td className="px-4 py-3">
                    <Switch
                      checked={l.is_active && !l.unsubscribed_at}
                      onCheckedChange={async (checked) => {
                        try {
                          await toggleLead({ data: { id: l.id, is_active: checked } });
                          queryClient.invalidateQueries({ queryKey: ["newsletter-data"] });
                        } catch (err) {
                          toast.error(err instanceof Error ? err.message : "Falha ao atualizar.");
                        }
                      }}
                      aria-label={`Ativar envios para ${l.email}`}
                    />
                  </td>
                  <td className="px-4 py-3 text-right">
                    <Button
                      variant="ghost"
                      size="icon"
                      aria-label={`Remover ${l.email}`}
                      onClick={async () => {
                        if (!confirm(`Remover ${l.email} da base?`)) return;
                        try {
                          await removeLead({ data: { id: l.id } });
                          toast.success("Lead removido.");
                          queryClient.invalidateQueries({ queryKey: ["newsletter-data"] });
                        } catch (err) {
                          toast.error(err instanceof Error ? err.message : "Falha ao remover.");
                        }
                      }}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </td>
                </tr>
              ))}
              {leads.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-4 py-10 text-center text-muted-foreground">
                    Nenhum lead cadastrado ainda.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}