import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Loader2, Mail, Megaphone, Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
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
  deleteContactMessage,
  getContactMessages,
  updateContactMessage,
  type ContactMessage,
  type ContactStatus,
} from "@/lib/contact.functions";

const STATUSES: { value: ContactStatus; label: string }[] = [
  { value: "nova", label: "Nova" },
  { value: "andamento", label: "Em andamento" },
  { value: "respondida", label: "Respondida" },
  { value: "arquivada", label: "Arquivada" },
];

const fmtDateTime = (v?: string | null) => (v ? new Date(v).toLocaleString("pt-BR") : "—");

export function MessagesPanel() {
  const queryClient = useQueryClient();
  const fetchMessages = useServerFn(getContactMessages);
  const saveMessage = useServerFn(updateContactMessage);
  const removeMessage = useServerFn(deleteContactMessage);

  const [search, setSearch] = useState("");
  const [kind, setKind] = useState<"all" | "contato" | "anuncie">("all");
  const [selected, setSelected] = useState<ContactMessage | null>(null);
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ["contact-messages"],
    queryFn: () => fetchMessages(),
    retry: false,
  });

  const messages = data?.messages ?? [];
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return messages.filter((m) => {
      if (kind !== "all" && m.kind !== kind) return false;
      if (!q) return true;
      return (
        m.full_name.toLowerCase().includes(q) ||
        m.email.toLowerCase().includes(q) ||
        (m.company ?? "").toLowerCase().includes(q) ||
        m.message.toLowerCase().includes(q)
      );
    });
  }, [messages, search, kind]);

  async function changeStatus(id: string, status: ContactStatus) {
    try {
      await saveMessage({ data: { id, status } });
      await queryClient.invalidateQueries({ queryKey: ["contact-messages"] });
      toast.success("Situação atualizada.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Falha ao atualizar.");
    }
  }

  async function saveNotes() {
    if (!selected) return;
    setSaving(true);
    try {
      await saveMessage({ data: { id: selected.id, admin_notes: notes } });
      await queryClient.invalidateQueries({ queryKey: ["contact-messages"] });
      toast.success("Anotações salvas.");
      setSelected(null);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Falha ao salvar.");
    } finally {
      setSaving(false);
    }
  }

  async function remove(id: string) {
    try {
      await removeMessage({ data: { id } });
      await queryClient.invalidateQueries({ queryKey: ["contact-messages"] });
      toast.success("Mensagem excluída.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Falha ao excluir.");
    }
  }

  if (isLoading) {
    return (
      <div className="flex items-center gap-2 p-10 text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" /> Carregando mensagens...
      </div>
    );
  }

  const stats = data?.stats;

  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-4">
        {[
          { label: "Total", value: stats?.total ?? 0 },
          { label: "Novas", value: stats?.novas ?? 0 },
          { label: "Anuncie", value: stats?.anuncie ?? 0 },
          { label: "Contato", value: stats?.contato ?? 0 },
        ].map((s) => (
          <div key={s.label} className="rounded-[var(--radius)] border bg-card p-4">
            <p className="font-mono-eyebrow text-muted-foreground">{s.label}</p>
            <p className="mt-1 text-2xl font-extrabold">{s.value}</p>
          </div>
        ))}
      </div>

      <div className="flex flex-col gap-3 sm:flex-row">
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Buscar por nome, e-mail, empresa ou texto"
          className="h-11 rounded-lg"
        />
        <Select value={kind} onValueChange={(v) => setKind(v as typeof kind)}>
          <SelectTrigger className="h-11 w-full rounded-lg sm:w-52">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos os tipos</SelectItem>
            <SelectItem value="contato">Contato</SelectItem>
            <SelectItem value="anuncie">Anuncie</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="overflow-x-auto rounded-[var(--radius)] border">
        <table className="w-full min-w-[860px] text-left text-sm">
          <thead className="bg-secondary/60 font-mono-eyebrow text-muted-foreground">
            <tr>
              <th className="px-4 py-3">Tipo</th>
              <th className="px-4 py-3">Nome</th>
              <th className="px-4 py-3">Contato</th>
              <th className="px-4 py-3">Empresa / Verba</th>
              <th className="px-4 py-3">Recebida</th>
              <th className="px-4 py-3">Situação</th>
              <th className="px-4 py-3 text-right">Ações</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {filtered.map((m) => (
              <tr key={m.id} className="align-top">
                <td className="px-4 py-3">
                  <span className="inline-flex items-center gap-1 rounded-md bg-secondary px-2 py-1 text-xs font-bold">
                    {m.kind === "anuncie" ? (
                      <Megaphone className="h-3 w-3" aria-hidden />
                    ) : (
                      <Mail className="h-3 w-3" aria-hidden />
                    )}
                    {m.kind}
                  </span>
                </td>
                <td className="px-4 py-3 font-semibold">{m.full_name}</td>
                <td className="px-4 py-3 text-muted-foreground">
                  <div>{m.email}</div>
                  <div>{m.phone ?? "—"}</div>
                </td>
                <td className="px-4 py-3 text-muted-foreground">
                  <div>{m.company ?? "—"}</div>
                  <div>{m.budget ?? "—"}</div>
                </td>
                <td className="px-4 py-3 text-muted-foreground">{fmtDateTime(m.created_at)}</td>
                <td className="px-4 py-3">
                  <Select
                    value={m.status}
                    onValueChange={(v) => changeStatus(m.id, v as ContactStatus)}
                  >
                    <SelectTrigger className="h-9 w-36 rounded-lg">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {STATUSES.map((s) => (
                        <SelectItem key={s.value} value={s.value}>
                          {s.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </td>
                <td className="px-4 py-3">
                  <div className="flex justify-end gap-2">
                    <Button
                      size="sm"
                      variant="secondary"
                      onClick={() => {
                        setSelected(m);
                        setNotes(m.admin_notes ?? "");
                      }}
                    >
                      Abrir
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => remove(m.id)} aria-label="Excluir mensagem">
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </td>
              </tr>
            ))}
            {filtered.length === 0 && (
              <tr>
                <td colSpan={7} className="px-4 py-10 text-center text-muted-foreground">
                  Nenhuma mensagem recebida ainda.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <Dialog open={!!selected} onOpenChange={(o) => !o && setSelected(null)}>
        <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>{selected?.subject || "Mensagem recebida"}</DialogTitle>
            <DialogDescription>
              {selected?.full_name} — {selected?.email} — {fmtDateTime(selected?.created_at)}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <p className="whitespace-pre-wrap rounded-[var(--radius)] bg-secondary/60 p-4 text-sm">
              {selected?.message}
            </p>
            <div className="space-y-2">
              <p className="font-mono-eyebrow text-muted-foreground">Anotações internas</p>
              <Textarea
                rows={5}
                value={notes}
                maxLength={4000}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Registre o andamento do atendimento"
                className="rounded-lg"
              />
            </div>
            <div className="flex flex-wrap gap-2">
              <Button onClick={saveNotes} disabled={saving}>
                {saving ? "Salvando..." : "Salvar anotações"}
              </Button>
              {selected && (
                <Button variant="secondary" asChild>
                  <a href={`mailto:${selected.email}?subject=${encodeURIComponent(selected.subject || "IA News")}`}>
                    Responder por e-mail
                  </a>
                </Button>
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}