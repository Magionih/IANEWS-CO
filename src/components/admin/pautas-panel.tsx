import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  getPautaLeads,
  updatePautaLead,
  type PautaGrupo,
  type PautaLead,
  type PautaStatus,
} from "@/lib/pauta.functions";

/* Aba "Pautas" do painel: leads da página /pauta para o comercial responder. */

const STATUSES: { value: PautaStatus; label: string }[] = [
  { value: "novo", label: "Novo" },
  { value: "em_contato", label: "Em contato" },
  { value: "proposta", label: "Proposta" },
  { value: "fechado", label: "Fechado" },
  { value: "descartado", label: "Descartado" },
];
const GRUPOS: PautaGrupo[] = ["A", "B", "C"];

const fmt = (v?: string | null) => (v ? new Date(v).toLocaleString("pt-BR") : "—");
const origem = (l: PautaLead) =>
  [l.utm_source, l.utm_medium, l.utm_campaign].filter(Boolean).join(" / ") || (l.article_slug ? "matéria" : "direto");
const waLink = (v: string) => {
  const d = v.replace(/\D/g, "");
  return `https://wa.me/${d.startsWith("55") ? d : `55${d}`}`;
};

export function PautasPanel() {
  const queryClient = useQueryClient();
  const fetchLeads = useServerFn(getPautaLeads);
  const save = useServerFn(updatePautaLead);

  const [status, setStatus] = useState<"all" | PautaStatus>("all");
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<PautaLead | null>(null);
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);

  const { data, isLoading, error } = useQuery({
    queryKey: ["pauta-leads"],
    queryFn: () => fetchLeads(),
    retry: false,
  });
  const leads = data?.leads ?? [];

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return leads.filter((l) => {
      if (status !== "all" && l.status !== status) return false;
      if (!q) return true;
      return [l.nome, l.empresa, l.cargo, l.email, l.descricao].some((v) => v.toLowerCase().includes(q));
    });
  }, [leads, status, search]);

  async function patch(id: string, payload: { status?: PautaStatus; grupo?: PautaGrupo | ""; admin_notes?: string }) {
    try {
      await save({ data: { id, ...payload } });
      await queryClient.invalidateQueries({ queryKey: ["pauta-leads"] });
      toast.success("Pauta atualizada.");
      return true;
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Falha ao atualizar.");
      return false;
    }
  }

  async function saveNotes() {
    if (!selected) return;
    setSaving(true);
    const ok = await patch(selected.id, { admin_notes: notes });
    setSaving(false);
    if (ok) setSelected(null);
  }

  if (isLoading) {
    return (
      <div className="flex items-center gap-2 p-10 text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" /> Carregando pautas...
      </div>
    );
  }
  if (error) {
    return <p className="p-10 text-muted-foreground">{error instanceof Error ? error.message : "Erro ao carregar."}</p>;
  }

  const count = (s: PautaStatus) => leads.filter((l) => l.status === s).length;

  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-5">
        {[
          { label: "Total", value: leads.length },
          { label: "Novas", value: count("novo") },
          { label: "Em contato", value: count("em_contato") },
          { label: "Proposta", value: count("proposta") },
          { label: "Fechadas", value: count("fechado") },
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
          placeholder="Buscar por nome, empresa, cargo, e-mail ou texto"
          className="h-11 rounded-lg"
        />
        <Select value={status} onValueChange={(v) => setStatus(v as typeof status)}>
          <SelectTrigger className="h-11 w-full rounded-lg sm:w-52">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas as situações</SelectItem>
            {STATUSES.map((s) => (
              <SelectItem key={s.value} value={s.value}>
                {s.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="overflow-x-auto rounded-[var(--radius)] border">
        <table className="w-full min-w-[920px] text-left text-sm">
          <thead className="bg-secondary/60 font-mono-eyebrow text-muted-foreground">
            <tr>
              <th className="px-4 py-3">Recebida</th>
              <th className="px-4 py-3">Empresa</th>
              <th className="px-4 py-3">Nome / cargo</th>
              <th className="px-4 py-3">Origem</th>
              <th className="px-4 py-3">Situação</th>
              <th className="px-4 py-3">Grupo</th>
              <th className="px-4 py-3 text-right">Ações</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {filtered.map((l) => (
              <tr key={l.id} className="align-top">
                <td className="px-4 py-3 text-muted-foreground">{fmt(l.created_at)}</td>
                <td className="px-4 py-3 font-semibold">{l.empresa}</td>
                <td className="px-4 py-3">
                  <div>{l.nome}</div>
                  <div className="text-muted-foreground">{l.cargo}</div>
                </td>
                <td className="px-4 py-3 text-muted-foreground">{origem(l)}</td>
                <td className="px-4 py-3">
                  <Select value={l.status} onValueChange={(v) => patch(l.id, { status: v as PautaStatus })}>
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
                  <Select value={l.grupo ?? "none"} onValueChange={(v) => patch(l.id, { grupo: v === "none" ? "" : (v as PautaGrupo) })}>
                    <SelectTrigger className="h-9 w-20 rounded-lg">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">—</SelectItem>
                      {GRUPOS.map((g) => (
                        <SelectItem key={g} value={g}>
                          {g}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </td>
                <td className="px-4 py-3">
                  <div className="flex justify-end">
                    <Button
                      size="sm"
                      variant="secondary"
                      onClick={() => {
                        setSelected(l);
                        setNotes(l.admin_notes ?? "");
                      }}
                    >
                      Abrir
                    </Button>
                  </div>
                </td>
              </tr>
            ))}
            {filtered.length === 0 && (
              <tr>
                <td colSpan={7} className="px-4 py-10 text-center text-muted-foreground">
                  Nenhuma pauta recebida ainda. A página é ianewsbr.com/pauta.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <Dialog open={!!selected} onOpenChange={(o) => !o && setSelected(null)}>
        <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>
              {selected?.empresa} · {selected?.cargo}
            </DialogTitle>
            <DialogDescription>
              {selected?.nome} — {fmt(selected?.created_at)}
            </DialogDescription>
          </DialogHeader>
          {selected && (
            <div className="space-y-4 text-sm">
              <div className="grid gap-1">
                <div>
                  <b>WhatsApp:</b>{" "}
                  <a className="underline" href={waLink(selected.whatsapp)} target="_blank" rel="noopener noreferrer">
                    {selected.whatsapp}
                  </a>
                </div>
                <div>
                  <b>E-mail:</b>{" "}
                  <a className="underline" href={`mailto:${selected.email}`}>
                    {selected.email}
                  </a>
                </div>
                {selected.site && (
                  <div>
                    <b>Site:</b>{" "}
                    <a className="underline" href={selected.site} target="_blank" rel="noopener noreferrer">
                      {selected.site}
                    </a>
                  </div>
                )}
                {selected.instagram && (
                  <div>
                    <b>Instagram:</b>{" "}
                    <a
                      className="underline"
                      href={`https://www.instagram.com/${selected.instagram.replace(/^@/, "")}/`}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      {selected.instagram}
                    </a>
                  </div>
                )}
                {selected.linkedin && (
                  <div>
                    <b>LinkedIn:</b>{" "}
                    <a className="underline" href={selected.linkedin} target="_blank" rel="noopener noreferrer">
                      {selected.linkedin}
                    </a>
                  </div>
                )}
                {selected.link_noticia && (
                  <div>
                    <b>Notícia / release:</b>{" "}
                    <a className="underline" href={selected.link_noticia} target="_blank" rel="noopener noreferrer">
                      {selected.link_noticia}
                    </a>
                  </div>
                )}
                <div className="text-muted-foreground">
                  Origem: {origem(selected)}
                  {selected.origem_path ? ` · ${selected.origem_path}` : ""}
                  {selected.device ? ` · ${selected.device}` : ""}
                </div>
              </div>
              <p className="whitespace-pre-wrap rounded-[var(--radius)] bg-secondary/60 p-4">{selected.descricao}</p>
              <div className="space-y-2">
                <p className="font-mono-eyebrow text-muted-foreground">Observações internas</p>
                <Textarea
                  rows={5}
                  value={notes}
                  maxLength={4000}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Andamento da conversa, próximos passos"
                  className="rounded-lg"
                />
              </div>
              <Button onClick={saveNotes} disabled={saving}>
                {saving ? "Salvando..." : "Salvar observações"}
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
