import { useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Ban, ExternalLink, KanbanSquare, RefreshCw, Search, Undo2 } from "lucide-react";

import { useCrm } from "@/components/crm/context";
import { NegocioPainel } from "@/components/crm/negocio";
import { useAcao } from "@/components/crm/queries";
import { CabecalhoPagina, Carregando, Erro, FaixaNumeros, Secao, Vazio } from "@/components/crm/ui";
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
import { urlSegura, fmtDia } from "@/lib/crm/utils";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_crm/lista")({
  component: ListaPage,
});

const BLOCOS: { id: string; titulo: string; dica: string }[] = [
  {
    id: "Quentes",
    titulo: "1 · Quentes",
    dica: "Já responderam, têm ação prevista para hoje ou briefing/prévia aguardando. Resposta no mesmo dia.",
  },
  {
    id: "Palco IA News",
    titulo: "1 · Palco IA News",
    dica: "Convites, inscrições e lembretes do Palco IA News Online (16/12, 19h, R$ 97). A mensagem é o modelo indicado no motivo, que está no negócio de cada pessoa.",
  },
  {
    id: "Virou pauta",
    titulo: "2 · Virou pauta",
    dica: "Protagonistas das matérias da IA News. Oferta de destaque com a matéria como gancho.",
  },
  {
    id: "Prospecção",
    titulo: "2 · Prospecção",
    dica: "Fundadores e empresas das listas, da maior nota para a menor. Entram na fila do dia dentro do limite de cada canal.",
  },
  {
    id: "Inbound",
    titulo: "3 · Inbound",
    dica: "Vieram pelo site, formulário de pauta ou newsletter. Responder hoje.",
  },
  {
    id: "Publicidade",
    titulo: "4 · Publicidade",
    dica: "Potenciais anunciantes: mídia kit e conversa.",
  },
  {
    id: "Parcerias",
    titulo: "5 · Parcerias",
    dica: "Veículos, eventos e comunidades para ação conjunta.",
  },
  {
    id: "Radar",
    titulo: "6 · Radar",
    dica: "Empresas do banco sem conversa aberta. Completa a lista até o total do dia.",
  },
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

  const q = useQuery({
    queryKey: ["crm", "lista", "hoje"],
    queryFn: () => fetchLista({ data: {} }),
  });

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
        descricao="Montada às 7h em blocos de prioridade, com o canal sugerido. A fila das 7h20 puxa daqui os primeiros contatos; o resto fica de reserva para amanhã."
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
            <RefreshCw className="h-4 w-4" />{" "}
            <span className="hidden sm:inline">Montar lista agora</span>
            <span className="sm:hidden">Montar</span>
          </Button>
        }
      />

      <FaixaNumeros
        itens={[
          {
            rotulo: `Lista · ${fmtDia(r.dia)}`,
            valor: r.total,
            detalhe: "leads hoje",
            tom: "azul",
          },
          { rotulo: "Na fila", valor: st.na_fila ?? 0, detalhe: "entraram na fila" },
          { rotulo: "Contatados", valor: st.contatado ?? 0, detalhe: "mensagem enviada" },
          { rotulo: "Responderam", valor: st.respondeu ?? 0, detalhe: "conversa aberta" },
          { rotulo: "Reserva", valor: st.listado ?? 0, detalhe: "ficam para amanhã" },
        ]}
      />

      <div className="space-y-2">
        <div
          className="-mx-4 flex gap-1.5 overflow-x-auto px-4 pb-0.5 [scrollbar-width:none] sm:mx-0 sm:flex-wrap sm:px-0"
          role="tablist"
          aria-label="Bloco"
        >
          {[{ id: null as string | null, titulo: "Todos", qtd: r.total }]
            .concat(
              BLOCOS.filter((b) => (r.por_bloco ?? {})[b.id]).map((b) => ({
                id: b.id,
                titulo: b.titulo,
                qtd: (r.por_bloco ?? {})[b.id],
              })),
            )
            .map((b) => {
              const on = bloco === b.id;
              return (
                <button
                  key={b.id ?? "todos"}
                  type="button"
                  role="tab"
                  aria-selected={on}
                  onClick={() => setBloco(b.id)}
                  className={cn(
                    "inline-flex h-8 shrink-0 items-center gap-1.5 rounded-full border px-3 text-[12.5px] font-medium transition",
                    on
                      ? "border-primary bg-primary text-white"
                      : "bg-card text-muted-foreground hover:text-foreground",
                  )}
                >
                  {b.titulo}
                  <span
                    className={cn(
                      "tabular rounded-full px-1.5 text-[11px] font-semibold",
                      on ? "bg-white/20" : "bg-muted",
                    )}
                  >
                    {b.qtd}
                  </span>
                </button>
              );
            })}
        </div>
        {bloco ? (
          <p className="text-[13px] text-muted-foreground">
            {BLOCOS.find((b) => b.id === bloco)?.dica}
          </p>
        ) : null}
      </div>

      <Secao
        titulo="Leads"
        contagem={itens.length}
        colado
        acoes={
          <div className="flex h-8 w-[min(60vw,260px)] items-center gap-2 rounded-lg border bg-background px-2.5">
            <Search className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
            <input
              placeholder="Buscar nome, empresa ou motivo"
              aria-label="Buscar na lista"
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              className="w-full min-w-0 bg-transparent text-[13px] outline-none placeholder:text-muted-foreground"
            />
          </div>
        }
      >
        {itens.length === 0 ? (
          <div className="p-4">
            <Vazio>
              Nenhum lead neste bloco hoje. Clique em "Montar lista agora" ou cadastre mais leads
              com contato (Instagram, e-mail ou LinkedIn).
            </Vazio>
          </div>
        ) : (
          <ul className="divide-y">
            {itens.map((i) => (
              <li
                key={i.id}
                className={cn(
                  "flex items-start gap-3 px-4 py-3 transition hover:bg-[#f8faff] sm:px-5",
                  i.status === "descartado" && "opacity-50",
                )}
              >
                <span className="tabular mt-0.5 flex h-6 min-w-6 shrink-0 items-center justify-center rounded-md bg-muted px-1 text-[11px] font-semibold text-muted-foreground">
                  {i.posicao}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[14px] font-semibold">
                    {i.pessoa_nome ?? i.empresa_nome ?? "Lead"}
                    {i.pessoa_nome && i.empresa_nome ? (
                      <span className="font-normal text-muted-foreground"> · {i.empresa_nome}</span>
                    ) : null}
                  </p>
                  {i.motivo ? (
                    <p className="line-clamp-1 text-xs text-muted-foreground">{i.motivo}</p>
                  ) : null}
                  <div className="mt-1.5 flex flex-wrap items-center gap-1.5 text-[11.5px]">
                    <span className="rounded-md bg-primary/[0.08] px-1.5 py-0.5 font-medium text-primary">
                      {i.bloco}
                    </span>
                    <span className="rounded-md bg-muted px-1.5 py-0.5 text-muted-foreground">
                      nota {i.nota ?? "—"}
                    </span>
                    <span className="rounded-md bg-muted px-1.5 py-0.5 text-muted-foreground">
                      {i.canal ?? "sem canal"}
                    </span>
                    <span className="rounded-md px-1.5 py-0.5 font-medium text-foreground/70 ring-1 ring-inset ring-border">
                      {STATUS_LABEL[i.status]}
                    </span>
                    {i.instagram ? (
                      <a
                        className="inline-flex items-center gap-0.5 font-medium text-primary hover:underline"
                        href={`https://instagram.com/${i.instagram.replace(/^@/, "")}`}
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        @{i.instagram.replace(/^@/, "")} <ExternalLink className="h-3 w-3" />
                      </a>
                    ) : i.linkedin ? (
                      <a
                        className="font-medium text-primary hover:underline"
                        href={urlSegura(i.linkedin)}
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        LinkedIn
                      </a>
                    ) : i.email ? (
                      <span className="text-muted-foreground">{i.email}</span>
                    ) : null}
                  </div>
                </div>
                <div className="flex shrink-0 items-center gap-1">
                  {i.negocio_id ? (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setNegocio(i.negocio_id)}
                      title="Ver negócio"
                    >
                      <KanbanSquare className="h-4 w-4" />
                      <span className="hidden sm:inline">Negócio</span>
                    </Button>
                  ) : null}
                  {i.status === "descartado" ? (
                    <Button
                      variant="ghost"
                      size="sm"
                      title="Voltar para a lista"
                      disabled={ocupado}
                      onClick={() =>
                        executar(
                          () => descartar({ data: { id: i.id, voltar: true } }),
                          "De volta à lista.",
                        )
                      }
                    >
                      <Undo2 className="h-4 w-4" />
                    </Button>
                  ) : i.status === "listado" ? (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-muted-foreground hover:text-destructive"
                      title="Descartar por hoje"
                      disabled={ocupado}
                      onClick={() =>
                        executar(() => descartar({ data: { id: i.id } }), "Descartado por hoje.")
                      }
                    >
                      <Ban className="h-4 w-4" />
                    </Button>
                  ) : null}
                </div>
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

function ConfigLista({
  salvar,
}: {
  salvar: (o: {
    data: { lista_tamanho?: number; lista_nota_minima?: number; horario_destaque_lead?: string };
  }) => Promise<unknown>;
}) {
  const { executar, ocupado } = useAcao();
  const [tamanho, setTamanho] = useState("200");
  const [minima, setMinima] = useState("25");
  const [hora, setHora] = useState("15:00");
  return (
    <Secao titulo="Configuração (admin)">
      <div className="grid gap-3 sm:grid-cols-3">
        <div>
          <Label htmlFor="cfg-tam">Leads por dia</Label>
          <Input
            id="cfg-tam"
            type="number"
            value={tamanho}
            onChange={(e) => setTamanho(e.target.value)}
          />
        </div>
        <div>
          <Label htmlFor="cfg-min">Nota mínima para entrar na lista</Label>
          <Input
            id="cfg-min"
            type="number"
            value={minima}
            onChange={(e) => setMinima(e.target.value)}
          />
        </div>
        <div>
          <Label htmlFor="cfg-hora">Hora do destaque de lead (Brasília)</Label>
          <Input
            id="cfg-hora"
            value={hora}
            onChange={(e) => setHora(e.target.value)}
            placeholder="15:00"
          />
        </div>
      </div>
      <Button
        className="mt-3"
        variant="outline"
        disabled={ocupado}
        onClick={() =>
          executar(
            () =>
              salvar({
                data: {
                  lista_tamanho: Number(tamanho),
                  lista_nota_minima: Number(minima),
                  horario_destaque_lead: hora,
                },
              }),
            "Configuração salva. Vale a partir da próxima lista.",
          )
        }
      >
        Salvar
      </Button>
    </Secao>
  );
}
