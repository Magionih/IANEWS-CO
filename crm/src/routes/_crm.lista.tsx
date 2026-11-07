import { useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Ban, ExternalLink, RefreshCw, Undo2 } from "lucide-react";

import { useCrm } from "@/components/crm/context";
import { NegocioPainel } from "@/components/crm/negocio";
import { useAcao } from "@/components/crm/queries";
import { CabecalhoPagina, Carregando, Erro, Numero, Secao, Vazio } from "@/components/crm/ui";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  descartarDaLista,
  listLista,
  montarLista,
  salvarConfigLista,
  type ListaItem,
} from "@/lib/crm/operacao.functions";
import { fmtDia } from "@/lib/crm/utils";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_crm/lista")({
  component: ListaPage,
});

const BLOCOS: { id: string; titulo: string; dica: string }[] = [
  { id: "Quentes", titulo: "1 · Quentes", dica: "Já responderam, têm ação prevista para hoje ou briefing/prévia aguardando. Resposta no mesmo dia." },
  { id: "Virou pauta", titulo: "2 · Virou pauta", dica: "Protagonistas das matérias da IA News. Oferta de destaque com a matéria como gancho." },
  { id: "Prospecção", titulo: "2 · Prospecção", dica: "Fundadores e empresas das listas, da maior nota para a menor. Entram na fila do dia dentro do limite de cada canal." },
  { id: "Inbound", titulo: "3 · Inbound", dica: "Vieram pelo site, formulário de pauta ou newsletter. Responder hoje." },
  { id: "Publicidade", titulo: "4 · Publicidade", dica: "Potenciais anunciantes: mídia kit e conversa." },
  { id: "Parcerias", titulo: "5 · Parcerias", dica: "Veículos, eventos e comunidades para ação conjunta." },
  { id: "Radar", titulo: "6 · Radar", dica: "Empresas do banco sem conversa aberta. Completa a lista até o total do dia." },
];

const STATUS_LABEL: Record<ListaItem["status"], string> = {
  listado: "na lista",
  na_fila: "na fila",
  contatado: "contatado",
  respondeu: "respondeu",
  descartado: "descartado",
};

function ListaPage() {
  const { isAdmin } = useCrm();
  const fetchLista = useServerFn(listLista);
  const montar = useServerFn(montarLista);
  const descartar = useServerFn(descartarDaLista);
  const salvarCfg = useServerFn(salvarConfigLista);
  const { executar, ocupado } = useAcao();
  const [bloco, setBloco] = useState<string | null>(null);
  const [negocio, setNegocio] = useState<string | null>(null);
  const [busca, setBusca] = useState("");

  const q = useQuery({ queryKey: ["crm", "lista", "hoje"], queryFn: () => fetchLista({ data: {} }) });

  const itens = useMemo(() => {
    const todos = q.data?.itens ?? [];
    const termo = busca.trim().toLowerCase();
    return todos.filter(
      (i) =>
        (!bloco || i.bloco === bloco) &&
        (!termo ||
          (i.pessoa_nome ?? "").toLowerCase().includes(termo) ||
          (i.empresa_nome ?? "").toLowerCase().includes(termo) ||
          (i.motivo ?? "").toLowerCase().includes(termo)),
    );
  }, [q.data, bloco, busca]);

  if (q.isLoading) return <Carregando texto="Carregando a lista do dia..." />;
  if (q.error) return <Erro erro={q.error} />;
  const r = q.data!.resumo;
  const st = r.por_status ?? {};

  return (
    <div className="space-y-6">
      <CabecalhoPagina
        titulo="Lista do dia"
        descricao="Às 7h o sistema monta a lista de leads do dia (meta: 200), em blocos de prioridade e com o canal sugerido. A fila das 7h20 puxa daqui os primeiros contatos, dentro do limite seguro de cada canal; o resto fica como reserva e volta no dia seguinte."
        acoes={
          <Button
            variant="outline"
            disabled={ocupado}
            onClick={() =>
              executar(
                () => montar(),
                (x) => {
                  const res = x as { total?: number; blocos?: Record<string, number> };
                  return `Lista refeita: ${res.total ?? 0} leads (${Object.entries(res.blocos ?? {})
                    .map(([k, v]) => `${k} ${v}`)
                    .join(", ")}).`;
                },
              )
            }
          >
            <RefreshCw className="h-4 w-4" /> Montar lista agora
          </Button>
        }
      />

      <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
        <Numero rotulo={`Lista · ${fmtDia(r.dia)}`} valor={r.total} detalhe="leads listados hoje" destaque="azul" />
        <Numero rotulo="Na fila" valor={st.na_fila ?? 0} detalhe="entraram na fila do dia" />
        <Numero rotulo="Contatados" valor={st.contatado ?? 0} detalhe="mensagem enviada" />
        <Numero rotulo="Responderam" valor={st.respondeu ?? 0} detalhe="conversa aberta" />
        <Numero rotulo="Reserva" valor={st.listado ?? 0} detalhe="ficam para amanhã" />
      </div>

      <div className="flex flex-wrap gap-2" role="tablist" aria-label="Bloco">
        <Button role="tab" aria-selected={bloco === null} variant={bloco === null ? "default" : "outline"} onClick={() => setBloco(null)}>
          Todos <span className="ml-1 rounded-full bg-background/20 px-1.5 text-xs">{r.total}</span>
        </Button>
        {BLOCOS.filter((b) => (r.por_bloco ?? {})[b.id]).map((b) => (
          <Button key={b.id} role="tab" aria-selected={bloco === b.id} variant={bloco === b.id ? "default" : "outline"} onClick={() => setBloco(b.id)}>
            {b.titulo} <span className="ml-1 rounded-full bg-background/20 px-1.5 text-xs">{(r.por_bloco ?? {})[b.id]}</span>
          </Button>
        ))}
      </div>
      {bloco ? <p className="text-sm text-muted-foreground">{BLOCOS.find((b) => b.id === bloco)?.dica}</p> : null}

      <Secao
        titulo="Leads"
        contagem={itens.length}
        acoes={<Input placeholder="Buscar nome, empresa ou motivo" value={busca} onChange={(e) => setBusca(e.target.value)} className="h-8 w-56" />}
      >
        {itens.length === 0 ? (
          <Vazio>Nenhum lead neste bloco hoje. Clique em "Montar lista agora" ou cadastre mais leads com contato (Instagram, e-mail ou LinkedIn).</Vazio>
        ) : (
          <ul className="divide-y">
            {itens.map((i) => (
              <li key={i.id} className={cn("flex flex-wrap items-center gap-3 py-2.5", i.status === "descartado" && "opacity-50")}>
                <span className="w-8 shrink-0 text-right font-mono text-xs text-muted-foreground">{i.posicao}</span>
                <div className="min-w-0 flex-1">
                  <p className="truncate font-semibold">
                    {i.pessoa_nome ?? i.empresa_nome ?? "Lead"}
                    {i.pessoa_nome && i.empresa_nome ? <span className="font-normal text-muted-foreground"> · {i.empresa_nome}</span> : null}
                  </p>
                  <p className="truncate text-xs text-muted-foreground">
                    <span className="rounded bg-primary/10 px-1.5 py-0.5 font-semibold text-primary">{i.bloco}</span>{" "}
                    nota {i.nota ?? "—"} · {i.canal ?? "sem canal"} · {i.motivo}
                  </p>
                </div>
                <span className="text-xs text-muted-foreground">{STATUS_LABEL[i.status]}</span>
                {i.instagram ? (
                  <a className="text-xs text-primary underline" href={`https://instagram.com/${i.instagram.replace(/^@/, "")}`} target="_blank" rel="noopener noreferrer">
                    @{i.instagram.replace(/^@/, "")} <ExternalLink className="inline h-3 w-3" />
                  </a>
                ) : i.linkedin ? (
                  <a className="text-xs text-primary underline" href={i.linkedin} target="_blank" rel="noopener noreferrer">LinkedIn</a>
                ) : i.email ? (
                  <span className="text-xs text-muted-foreground">{i.email}</span>
                ) : null}
                {i.negocio_id ? (
                  <Button variant="ghost" size="sm" onClick={() => setNegocio(i.negocio_id)}>Ver negócio</Button>
                ) : null}
                {i.status === "descartado" ? (
                  <Button variant="ghost" size="sm" disabled={ocupado} onClick={() => executar(() => descartar({ data: { id: i.id, voltar: true } }), "De volta à lista.")}>
                    <Undo2 className="h-4 w-4" />
                  </Button>
                ) : i.status === "listado" ? (
                  <Button variant="ghost" size="sm" className="text-destructive" disabled={ocupado} onClick={() => executar(() => descartar({ data: { id: i.id } }), "Descartado por hoje.")}>
                    <Ban className="h-4 w-4" />
                  </Button>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </Secao>

      {isAdmin ? <ConfigLista salvar={salvarCfg} /> : null}
      {negocio ? <NegocioPainel id={negocio} onClose={() => setNegocio(null)} /> : null}
    </div>
  );
}

function ConfigLista({ salvar }: { salvar: (o: { data: { lista_tamanho?: number; lista_nota_minima?: number; horario_destaque_lead?: string } }) => Promise<unknown> }) {
  const { executar, ocupado } = useAcao();
  const [tamanho, setTamanho] = useState("200");
  const [minima, setMinima] = useState("25");
  const [hora, setHora] = useState("15:00");
  return (
    <Secao titulo="Configuração (admin)">
      <div className="grid gap-3 sm:grid-cols-3">
        <div>
          <Label htmlFor="cfg-tam">Leads por dia</Label>
          <Input id="cfg-tam" type="number" value={tamanho} onChange={(e) => setTamanho(e.target.value)} />
        </div>
        <div>
          <Label htmlFor="cfg-min">Nota mínima para entrar na lista</Label>
          <Input id="cfg-min" type="number" value={minima} onChange={(e) => setMinima(e.target.value)} />
        </div>
        <div>
          <Label htmlFor="cfg-hora">Hora do destaque de lead (Brasília)</Label>
          <Input id="cfg-hora" value={hora} onChange={(e) => setHora(e.target.value)} placeholder="15:00" />
        </div>
      </div>
      <Button
        className="mt-3"
        variant="outline"
        disabled={ocupado}
        onClick={() =>
          executar(
            () => salvar({ data: { lista_tamanho: Number(tamanho), lista_nota_minima: Number(minima), horario_destaque_lead: hora } }),
            "Configuração salva. Vale a partir da próxima lista.",
          )
        }
      >
        Salvar
      </Button>
    </Secao>
  );
}
