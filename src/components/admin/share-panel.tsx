import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Check, Copy, Instagram, Link2, Loader2, Power, Trash2, Users } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  createShareLink,
  deleteShareLink,
  getShareLinks,
  toggleShareLink,
} from "@/lib/share-links.functions";

const CHANNELS = [
  { value: "instagram_stories", label: "Instagram Stories" },
  { value: "instagram_bio", label: "Instagram Bio" },
  { value: "instagram_post", label: "Instagram Post" },
  { value: "whatsapp", label: "WhatsApp" },
  { value: "linkedin", label: "LinkedIn" },
  { value: "newsletter", label: "Newsletter" },
  { value: "outro", label: "Outro" },
];

const channelLabel = (v: string) => CHANNELS.find((c) => c.value === v)?.label ?? v;
const fmt = (v?: string | null) => (v ? new Date(v).toLocaleString("pt-BR") : "—");

function shareUrl(code: string) {
  const origin = typeof window !== "undefined" ? window.location.origin : "https://ianewsbr.com";
  return `${origin}/s/${code}`;
}

export function SharePanel({ articles }: { articles: { slug: string; title: string }[] }) {
  const qc = useQueryClient();
  const load = useServerFn(getShareLinks);
  const create = useServerFn(createShareLink);
  const toggle = useServerFn(toggleShareLink);
  const remove = useServerFn(deleteShareLink);

  const [slug, setSlug] = useState("");
  const [channel, setChannel] = useState("instagram_stories");
  const [campaign, setCampaign] = useState("");
  const [label, setLabel] = useState("");
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState<string | null>(null);
  const [search, setSearch] = useState("");

  const { data, isLoading } = useQuery({
    queryKey: ["share-links"],
    queryFn: () => load(),
  });

  const links = data?.links ?? [];
  const stats = data?.stats;
  const clicks = data?.clicks ?? [];

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return links;
    return links.filter(
      (l) =>
        l.article_title.toLowerCase().includes(q) ||
        l.code.toLowerCase().includes(q) ||
        l.campaign.toLowerCase().includes(q),
    );
  }, [links, search]);

  const maxDay = Math.max(1, ...(stats?.byDay ?? []).map((d) => d.count));

  async function copy(code: string) {
    try {
      await navigator.clipboard.writeText(shareUrl(code));
      setCopied(code);
      toast.success("Link copiado — cole no sticker de link do Stories.");
      setTimeout(() => setCopied(null), 1800);
    } catch {
      toast.error("Não foi possível copiar automaticamente.");
    }
  }

  async function handleCreate() {
    if (!slug) {
      toast.error("Escolha uma matéria.");
      return;
    }
    setBusy(true);
    try {
      const res = await create({ data: { slug, channel, campaign, label } });
      await qc.invalidateQueries({ queryKey: ["share-links"] });
      await copy(res.code);
      toast.success(res.reused ? "Link já existia — reaproveitado." : "Link criado.");
      setCampaign("");
      setLabel("");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro ao criar link.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        {[
          { label: "Links ativos", value: stats?.totalLinks ?? 0, icon: Link2 },
          { label: "Cliques totais", value: stats?.totalClicks ?? 0, icon: Instagram },
          { label: "Pessoas únicas", value: stats?.uniqueVisitors ?? 0, icon: Users },
          { label: "Cliques 7 dias", value: stats?.clicks7d ?? 0, icon: Link2 },
          { label: "Cliques 24h", value: stats?.clicks24h ?? 0, icon: Link2 },
        ].map((card) => (
          <div key={card.label} className="rounded-xl border border-border bg-card p-4">
            <div className="flex items-center gap-2 text-xs uppercase tracking-wide text-muted-foreground">
              <card.icon className="h-3.5 w-3.5" />
              {card.label}
            </div>
            <p className="mt-2 text-2xl font-black">{card.value}</p>
          </div>
        ))}
      </div>

      <div className="rounded-xl border border-border bg-card p-4">
        <h3 className="text-sm font-bold uppercase tracking-wide">Gerar link para Stories</h3>
        <div className="mt-4 grid gap-3 lg:grid-cols-[2fr_1fr_1fr_auto]">
          <Select value={slug} onValueChange={setSlug}>
            <SelectTrigger>
              <SelectValue placeholder="Escolha a matéria" />
            </SelectTrigger>
            <SelectContent className="max-h-72">
              {articles.map((a) => (
                <SelectItem key={a.slug} value={a.slug}>
                  {a.title}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={channel} onValueChange={setChannel}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {CHANNELS.map((c) => (
                <SelectItem key={c.value} value={c.value}>
                  {c.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Input
            placeholder="Campanha (ex: stories-manha)"
            value={campaign}
            onChange={(e) => setCampaign(e.target.value)}
          />
          <Button onClick={handleCreate} disabled={busy}>
            {busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Link2 className="mr-2 h-4 w-4" />}
            Gerar e copiar
          </Button>
        </div>
        <Input
          className="mt-3"
          placeholder="Rótulo interno (opcional)"
          value={label}
          onChange={(e) => setLabel(e.target.value)}
        />
        <p className="mt-2 text-xs text-muted-foreground">
          O link curto registra cliques, pessoas únicas, dispositivo e origem antes de levar o leitor à matéria.
        </p>
      </div>

      {stats && stats.byDay.some((d) => d.count > 0) ? (
        <div className="rounded-xl border border-border bg-card p-4">
          <h3 className="text-sm font-bold uppercase tracking-wide">Cliques nos últimos 14 dias</h3>
          <div className="mt-4 flex h-28 items-end gap-1">
            {stats.byDay.map((d) => (
              <div key={d.day} className="flex-1" title={`${d.day}: ${d.count}`}>
                <div
                  className="w-full rounded-t bg-primary/80"
                  style={{ height: `${Math.max(4, (d.count / maxDay) * 100)}%` }}
                />
              </div>
            ))}
          </div>
          <div className="mt-3 flex flex-wrap gap-2 text-xs text-muted-foreground">
            {stats.byDevice.map((d) => (
              <span key={d.key} className="rounded-full border border-border px-2 py-0.5">
                {d.key}: {d.count}
              </span>
            ))}
          </div>
        </div>
      ) : null}

      <div className="rounded-xl border border-border bg-card">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border p-4">
          <h3 className="text-sm font-bold uppercase tracking-wide">Links criados</h3>
          <Input
            className="w-full sm:w-64"
            placeholder="Buscar matéria, código..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        {isLoading ? (
          <div className="flex items-center gap-2 p-6 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" /> Carregando links...
          </div>
        ) : filtered.length === 0 ? (
          <p className="p-6 text-sm text-muted-foreground">Nenhum link ainda. Gere o primeiro acima.</p>
        ) : (
          <div className="divide-y divide-border">
            {filtered.map((l) => (
              <div key={l.id} className="flex flex-col gap-3 p-4 lg:flex-row lg:items-center lg:justify-between">
                <div className="min-w-0">
                  <p className="truncate text-sm font-bold">{l.article_title}</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {channelLabel(l.channel)}
                    {l.campaign ? ` · ${l.campaign}` : ""} · criado em {fmt(l.created_at)}
                  </p>
                  <code className="mt-2 inline-block break-all rounded bg-muted px-2 py-1 text-xs">
                    {shareUrl(l.code)}
                  </code>
                </div>
                <div className="flex flex-wrap items-center gap-4">
                  <div className="text-center">
                    <p className="text-lg font-black">{l.clicks_count}</p>
                    <p className="text-[10px] uppercase text-muted-foreground">cliques</p>
                  </div>
                  <div className="text-center">
                    <p className="text-lg font-black">{l.unique_visitors}</p>
                    <p className="text-[10px] uppercase text-muted-foreground">pessoas</p>
                  </div>
                  <div className="flex gap-2">
                    <Button size="sm" variant="outline" onClick={() => copy(l.code)}>
                      {copied === l.code ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      title={l.is_active ? "Desativar" : "Ativar"}
                      onClick={async () => {
                        await toggle({ data: { id: l.id, isActive: !l.is_active } });
                        qc.invalidateQueries({ queryKey: ["share-links"] });
                      }}
                    >
                      <Power className={`h-4 w-4 ${l.is_active ? "" : "opacity-40"}`} />
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={async () => {
                        await remove({ data: { id: l.id } });
                        qc.invalidateQueries({ queryKey: ["share-links"] });
                        toast.success("Link removido.");
                      }}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="rounded-xl border border-border bg-card">
        <h3 className="border-b border-border p-4 text-sm font-bold uppercase tracking-wide">
          Cliques recentes
        </h3>
        {clicks.length === 0 ? (
          <p className="p-6 text-sm text-muted-foreground">Nenhum clique registrado ainda.</p>
        ) : (
          <div className="max-h-80 divide-y divide-border overflow-y-auto">
            {clicks.map((c) => (
              <div key={c.id} className="flex flex-wrap items-center justify-between gap-2 px-4 py-3 text-xs">
                <span className="font-mono">{c.code}</span>
                <span className="truncate text-muted-foreground">{c.article_slug}</span>
                <span>{c.device} · {c.os} · {c.browser}</span>
                <span className="text-muted-foreground">
                  {c.is_new_visitor ? "novo" : "recorrente"} · {fmt(c.clicked_at)}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
