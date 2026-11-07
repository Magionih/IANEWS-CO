import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Copy, ExternalLink, Link2 } from "lucide-react";
import { toast } from "sonner";

import { NegocioPainel } from "@/components/crm/negocio";
import { useAcao } from "@/components/crm/queries";
import { CabecalhoPagina, Carregando, Erro, Numero, Secao, Vazio } from "@/components/crm/ui";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { briefingsAguardando, listProducoes, registrarLinkPost, type Producao } from "@/lib/crm/operacao.functions";
import { fmtDataHora } from "@/lib/crm/utils";

export const Route = createFileRoute("/_crm/producoes")({
  component: ProducoesPage,
});

const STATUS: Record<string, { rotulo: string; cor: string }> = {
  rascunho: { rotulo: "A IA está escrevendo", cor: "bg-muted text-foreground" },
  previa: { rotulo: "Prévia enviada ao lead", cor: "bg-primary/10 text-primary" },
  ajuste: { rotulo: "Ajuste pedido (IA refaz)", cor: "bg-amber-100 text-amber-900" },
  aprovado: { rotulo: "Aprovado, aguardando pagamento", cor: "bg-amber-100 text-amber-900" },
  agendado: { rotulo: "Agendado", cor: "bg-emerald-100 text-emerald-900" },
  publicado: { rotulo: "Publicado", cor: "bg-emerald-600 text-white" },
  cancelado: { rotulo: "Cancelado", cor: "bg-muted text-muted-foreground" },
};

function ProducoesPage() {
  const fetchProducoes = useServerFn(listProducoes);
  const fetchBriefings = useServerFn(briefingsAguardando);
  const registrar = useServerFn(registrarLinkPost);
  const { executar, ocupado } = useAcao();
  const [negocio, setNegocio] = useState<string | null>(null);
  const [links, setLinks] = useState<Record<string, string>>({});

  const q = useQuery({ queryKey: ["crm", "producoes"], queryFn: () => fetchProducoes() });
  const b = useQuery({ queryKey: ["crm", "briefings-aguardando"], queryFn: () => fetchBriefings() });

  if (q.isLoading) return <Carregando texto="Carregando as produções..." />;
  if (q.error) return <Erro erro={q.error} />;
  const lista = q.data ?? [];
  const por = (s: string) => lista.filter((p) => p.status === s).length;
  const agendadas = lista.filter((p) => p.status === "agendado").sort((a, b2) => (a.data_publicacao ?? "").localeCompare(b2.data_publicacao ?? ""));

  async function copiar(texto: string) {
    try {
      await navigator.clipboard.writeText(texto);
      toast.success("Copiado.");
    } catch {
      toast.error("Não consegui copiar.");
    }
  }

  return (
    <div className="space-y-6">
      <CabecalhoPagina
        titulo="Produções"
        descricao="Cada briefing enviado vira matéria, legenda e telas do post pela IA (a cada 20 minutos). O lead aprova pelo link da prévia; a aprovação marca a publicação na primeira vaga do calendário, a matéria entra no site sozinha e a equipe agenda o post no Instagram (collab + curtidas ocultas) com as telas prontas."
      />

      <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
        <Numero rotulo="Briefings aguardando" valor={(b.data ?? []).filter((x) => x.status !== "aberto").length} detalhe={`${(b.data ?? []).filter((x) => x.status === "aberto").length} abertos sem envio`} />
        <Numero rotulo="Prévias com o lead" valor={por("previa")} detalhe="aguardando aprovação" destaque="azul" />
        <Numero rotulo="Ajustes" valor={por("ajuste")} detalhe="a IA refaz na próxima rodada" />
        <Numero rotulo="Agendadas" valor={por("agendado")} detalhe="matéria no site + tarefa de IG" />
        <Numero rotulo="Publicadas" valor={por("publicado")} detalhe="links enviados ao lead" />
      </div>

      {agendadas.length ? (
        <Secao titulo="Próximas publicações" contagem={agendadas.length}>
          <ul className="divide-y text-sm">
            {agendadas.map((p) => (
              <li key={p.id} className="flex flex-wrap items-center justify-between gap-2 py-2">
                <span>
                  <strong>{p.data_publicacao ? fmtDataHora(p.data_publicacao) : "—"}</strong> · {p.titulo}
                </span>
                <span className="text-xs text-muted-foreground">collab {p.collabs.length ? p.collabs.map((c) => "@" + c).join(", ") : "—"}</span>
              </li>
            ))}
          </ul>
        </Secao>
      ) : null}

      <Secao titulo="Todas as produções" contagem={lista.length}>
        {lista.length === 0 ? (
          <Vazio>Nenhuma produção ainda. Quando um lead enviar o briefing, a IA gera a prévia aqui.</Vazio>
        ) : (
          <ul className="space-y-4">
            {lista.map((p: Producao) => {
              const s = STATUS[p.status] ?? { rotulo: p.status, cor: "bg-muted" };
              return (
                <li key={p.id} className="rounded-[var(--radius)] border p-3">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="font-bold">{p.titulo ?? "(sem título ainda)"}</p>
                      <p className="text-xs text-muted-foreground">
                        {p.pessoa ?? "—"}{p.empresa ? ` · ${p.empresa}` : ""} · {p.tipo} · v{p.versao}
                        {p.data_publicacao ? ` · sai ${fmtDataHora(p.data_publicacao)}` : ""}
                      </p>
                    </div>
                    <span className={`rounded px-2 py-0.5 text-xs font-semibold ${s.cor}`}>{s.rotulo}</span>
                  </div>
                  {p.erro ? <p className="mt-2 text-xs text-destructive">Erro na última rodada: {p.erro}</p> : null}
                  {p.ajuste_pedido && p.status === "ajuste" ? <p className="mt-2 text-xs">Ajuste pedido: “{p.ajuste_pedido}”</p> : null}
                  {p.telas?.length ? (
                    <div className="mt-3 flex gap-2 overflow-x-auto">
                      {p.telas.map((t, i) => (
                        <a key={t} href={t} target="_blank" rel="noopener noreferrer" className="shrink-0" title={`Tela ${i + 1}`}>
                          <img src={t} alt={`Tela ${i + 1}`} className="h-40 rounded border object-cover" style={{ aspectRatio: "4/5" }} />
                        </a>
                      ))}
                    </div>
                  ) : null}
                  <div className="mt-3 flex flex-wrap gap-2">
                    <Button size="sm" variant="outline" asChild>
                      <a href={`https://ianewsbr.com/previa/${p.token}`} target="_blank" rel="noopener noreferrer">
                        <ExternalLink className="h-4 w-4" /> Prévia
                      </a>
                    </Button>
                    {p.slug ? (
                      <Button size="sm" variant="outline" asChild>
                        <a href={`https://ianewsbr.com/materia/${p.slug}`} target="_blank" rel="noopener noreferrer">
                          <ExternalLink className="h-4 w-4" /> Matéria
                        </a>
                      </Button>
                    ) : null}
                    {p.legenda ? (
                      <Button size="sm" variant="outline" onClick={() => copiar(p.legenda ?? "")}>
                        <Copy className="h-4 w-4" /> Copiar legenda
                      </Button>
                    ) : null}
                    {p.collabs.length ? (
                      <Button size="sm" variant="ghost" onClick={() => copiar(p.collabs.map((c) => "@" + c).join(" "))}>
                        collab: {p.collabs.map((c) => "@" + c).join(" ")}
                      </Button>
                    ) : null}
                    {p.negocio_id ? (
                      <Button size="sm" variant="ghost" onClick={() => setNegocio(p.negocio_id)}>Ver negócio</Button>
                    ) : null}
                  </div>
                  {["agendado", "publicado"].includes(p.status) && !p.social_url ? (
                    <div className="mt-3 flex flex-wrap items-center gap-2">
                      <Input
                        placeholder="Link do post no Instagram (depois de publicar)"
                        className="h-8 max-w-md"
                        value={links[p.id] ?? ""}
                        onChange={(e) => setLinks((l) => ({ ...l, [p.id]: e.target.value }))}
                      />
                      <Button size="sm" disabled={ocupado || !(links[p.id] ?? "").trim()} onClick={() => executar(() => registrar({ data: { id: p.id, url: links[p.id] } }), "Link registrado: vai junto no aviso ao lead.")}>
                        <Link2 className="h-4 w-4" /> Registrar link
                      </Button>
                    </div>
                  ) : p.social_url ? (
                    <p className="mt-2 text-xs"><a className="text-primary underline" href={p.social_url} target="_blank" rel="noopener noreferrer">{p.social_url}</a></p>
                  ) : null}
                </li>
              );
            })}
          </ul>
        )}
      </Secao>

      <Secao titulo="Briefings em andamento" contagem={(b.data ?? []).length}>
        {(b.data ?? []).length === 0 ? (
          <Vazio>Nenhum briefing aberto.</Vazio>
        ) : (
          <ul className="divide-y text-sm">
            {(b.data ?? []).map((x) => (
              <li key={x.id} className="flex flex-wrap items-center justify-between gap-2 py-2">
                <span>
                  {x.pessoa?.nome ?? x.empresa?.nome ?? "Lead"} · {x.tipo} ·{" "}
                  <span className="text-muted-foreground">
                    {x.status === "aberto" ? "link enviado, sem preencher" : x.status === "enviado" ? "enviado, entra na próxima rodada da IA" : x.status === "em_producao" ? "a IA está escrevendo" : "ajuste pedido"}
                  </span>
                </span>
                <a className="text-xs text-primary underline" href={`https://ianewsbr.com/briefing/${x.token}`} target="_blank" rel="noopener noreferrer">link do briefing</a>
              </li>
            ))}
          </ul>
        )}
      </Secao>

      {negocio ? <NegocioPainel id={negocio} onClose={() => setNegocio(null)} /> : null}
    </div>
  );
}
