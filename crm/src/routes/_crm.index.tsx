import { useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { CalendarPlus, ChevronDown, Flame, MessageCircle, Plus, RefreshCw } from "lucide-react";

import { useCrm } from "@/components/crm/context";
import { BarrasHorizontais, BarrasPorDia } from "@/components/crm/grafico";
import { MensagemDialog, TarefaDialog, type DadosMensagem } from "@/components/crm/dialogs";
import { NegocioDialog, NegocioPainel } from "@/components/crm/negocio";
import { useAcao } from "@/components/crm/queries";
import { TarefaLinha } from "@/components/crm/tarefa";
import {
  Avatar,
  CabecalhoPagina,
  Carregando,
  Erro,
  Etiqueta,
  FaixaNumeros,
  GrupoBadge,
  Secao,
  Vazio,
} from "@/components/crm/ui";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import type { NegocioCompleto } from "@/lib/crm/carregar";
import { getHoje, type FilaViraramPauta, type PainelHoje } from "@/lib/crm/hoje.functions";
import { criarLeadDeEmpresa } from "@/lib/crm/negocios.functions";
import { concluirTarefa } from "@/lib/crm/tarefas.functions";
import {
  atrasado,
  fmtDia,
  fmtDiaCurto,
  fmtMoeda,
  fmtNum,
  linkMateria,
  prazoRelativo,
} from "@/lib/crm/utils";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_crm/")({
  component: HojePage,
});

/** Painel visual da tela Hoje: funil aberto, entrada de leads e origem (30 dias). */
function VisaoGeral({ visao }: { visao: PainelHoje["visao"] }) {
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <FunilAberto visao={visao} />
      <Secao titulo="Entrada de leads · 30 dias" contagem={visao.leads30}>
        <BarrasPorDia dados={visao.leadsPorDia} rotulo="Leads por dia" />
      </Secao>
      <Secao titulo="De onde vêm os leads · 30 dias">
        <BarrasHorizontais itens={visao.origens} />
      </Secao>
    </div>
  );
}

const TONS_ETAPA = [
  "bg-primary/25",
  "bg-primary/40",
  "bg-primary/55",
  "bg-primary/70",
  "bg-primary/85",
  "bg-primary",
  "bg-[#1640b8]",
  "bg-[#0f2f8a]",
  "bg-[#0b2266]",
];

/** Funil aberto: uma linha por funil com o total, o valor e a barra das etapas; toque para abrir as etapas. */
function FunilAberto({ visao }: { visao: PainelHoje["visao"] }) {
  const { funilNome } = useCrm();
  const [aberto, setAberto] = useState<string | null>(null);
  const [todos, setTodos] = useState(false);
  const ordenados = [...visao.funis].sort((a, b) => b.qtd - a.qtd);
  const funis = todos ? ordenados : ordenados.slice(0, 5);
  const total = ordenados.reduce((s, f) => s + f.qtd, 0);
  return (
    <Secao
      titulo="Funil aberto"
      contagem={total}
      className="lg:col-span-2"
      colado
      acoes={
        <span className="text-xs text-muted-foreground">
          {fmtMoeda(visao.pipeline)} em negociação
        </span>
      }
    >
      {funis.length ? (
        <ul className="divide-y">
          {funis.map((f) => {
            const etapas = f.etapas.filter((e) => e.qtd > 0).sort((a, b) => a.ordem - b.ordem);
            const maior = [...etapas].sort((a, b) => b.qtd - a.qtd)[0];
            const exp = aberto === f.funil_id;
            return (
              <li key={f.funil_id}>
                <button
                  type="button"
                  onClick={() => setAberto(exp ? null : f.funil_id)}
                  aria-expanded={exp}
                  className="grid w-full grid-cols-[1fr_auto] items-center gap-x-4 gap-y-2 px-4 py-3 text-left transition hover:bg-[#f8faff] sm:grid-cols-[minmax(180px,260px)_1fr_auto] sm:px-5"
                >
                  <span className="min-w-0">
                    <span className="block truncate text-[13.5px] font-semibold">
                      {funilNome(f.funil_id)}
                    </span>
                    <span className="block truncate text-[11.5px] text-muted-foreground">
                      {maior ? `mais em ${maior.nome} (${fmtNum(maior.qtd)})` : "sem negócios"}
                    </span>
                  </span>
                  <span className="order-3 col-span-2 flex h-2 w-full gap-[2px] overflow-hidden rounded-full bg-muted sm:order-none sm:col-span-1">
                    {etapas.map((e, i) => (
                      <span
                        key={e.nome}
                        title={`${e.nome}: ${fmtNum(e.qtd)}`}
                        className={cn("h-full", TONS_ETAPA[Math.min(i, TONS_ETAPA.length - 1)])}
                        style={{ width: `${(e.qtd / Math.max(1, f.qtd)) * 100}%` }}
                      />
                    ))}
                  </span>
                  <span className="flex items-center gap-2 text-right">
                    <span>
                      <span className="tabular block text-[15px] font-semibold">
                        {fmtNum(f.qtd)}
                      </span>
                      <span className="tabular block text-[11px] text-muted-foreground">
                        {f.valor ? fmtMoeda(f.valor) : "—"}
                      </span>
                    </span>
                    <ChevronDown
                      className={cn(
                        "h-4 w-4 text-muted-foreground transition-transform",
                        exp && "rotate-180",
                      )}
                    />
                  </span>
                </button>
                {exp ? (
                  <div className="bg-[#f8f9fb] px-4 pb-3 pt-1 sm:px-5">
                    <ul className="grid gap-x-6 gap-y-1.5 py-2 sm:grid-cols-2 xl:grid-cols-3">
                      {etapas.map((e, i) => (
                        <li key={e.nome} className="flex items-center gap-2 text-[12.5px]">
                          <span
                            className={cn(
                              "h-2 w-2 shrink-0 rounded-full",
                              TONS_ETAPA[Math.min(i, TONS_ETAPA.length - 1)],
                            )}
                          />
                          <span className="min-w-0 flex-1 truncate">{e.nome}</span>
                          <span className="tabular font-semibold">{fmtNum(e.qtd)}</span>
                        </li>
                      ))}
                    </ul>
                    <Link
                      to="/negocios"
                      search={{ funil: f.funil_id }}
                      className="text-xs font-semibold text-primary hover:underline"
                    >
                      Abrir o funil
                    </Link>
                  </div>
                ) : null}
              </li>
            );
          })}
          {ordenados.length > 5 ? (
            <li>
              <button
                type="button"
                onClick={() => setTodos((v) => !v)}
                className="flex w-full items-center justify-center gap-1 px-4 py-2.5 text-xs font-semibold text-primary hover:bg-[#f8faff]"
              >
                {todos ? "Mostrar só os 5 maiores" : `Ver todos os funis (${ordenados.length})`}
                <ChevronDown className={cn("h-3.5 w-3.5", todos && "rotate-180")} />
              </button>
            </li>
          ) : null}
        </ul>
      ) : (
        <div className="p-4">
          <Vazio>Nenhum negócio aberto.</Vazio>
        </div>
      )}
    </Secao>
  );
}

function HojePage() {
  const { userId, membro } = useCrm();
  const fetchHoje = useServerFn(getHoje);
  const concluir = useServerFn(concluirTarefa);
  const criarLead = useServerFn(criarLeadDeEmpresa);
  const { executar } = useAcao();
  const [soMinhas, setSoMinhas] = useState(false);
  const [aberto, setAberto] = useState<string | null>(null);
  const [novoNegocio, setNovoNegocio] = useState(false);
  const [novaTarefa, setNovaTarefa] = useState(false);
  const [mensagem, setMensagem] = useState<DadosMensagem | null>(null);

  const { data, isLoading, error, refetch, isFetching } = useQuery({
    queryKey: ["crm", "hoje"],
    queryFn: () => fetchHoje(),
    refetchInterval: 5 * 60_000,
  });

  if (isLoading) return <Carregando />;
  if (error || !data) return <Erro erro={error} />;

  const tarefas = soMinhas
    ? data.tarefas.filter((t) => t.responsavel_id === userId || !t.responsavel_id)
    : data.tarefas;
  const atrasadas = tarefas.filter((t) => atrasado(t.vence_em, data.hoje));

  async function virarLead(f: FilaViraramPauta) {
    const r = await executar(
      () => criarLead({ data: { empresa_id: f.empresa_id, article_id: f.article_id } }),
      (res) => (res.existente ? "A empresa já tinha negócio aberto." : `Lead criado: ${f.nome}.`),
    );
    if (r) setAberto(r.id);
  }

  return (
    <div className="space-y-6">
      <CabecalhoPagina
        titulo="Hoje"
        descricao={`${fmtDia(data.hoje)} · responda primeiro quem respondeu e os formulários; no fim do dia, nenhum negócio aberto sem próxima ação.`}
        acoes={
          <>
            <Button
              variant="outline"
              size="sm"
              className="h-9"
              onClick={() => refetch()}
              disabled={isFetching}
            >
              <RefreshCw className={cn("h-4 w-4", isFetching && "animate-spin")} />
              <span className="hidden sm:inline">Atualizar</span>
            </Button>
            <Button variant="outline" size="sm" className="h-9" onClick={() => setNovaTarefa(true)}>
              <CalendarPlus className="h-4 w-4" />
              <span className="hidden sm:inline">Tarefa</span>
            </Button>
            <Button size="sm" className="h-9" onClick={() => setNovoNegocio(true)}>
              <Plus className="h-4 w-4" /> Novo lead
            </Button>
          </>
        }
      />

      <FaixaNumeros
        itens={[
          {
            rotulo: "Tarefas hoje",
            valor: fmtNum(tarefas.length),
            detalhe: `${atrasadas.length} atrasadas`,
            tom: atrasadas.length ? "alerta" : undefined,
          },
          {
            rotulo: "Novos leads 24h",
            valor: fmtNum(data.novos.length),
            tom: data.novos.length ? "azul" : undefined,
          },
          {
            rotulo: "Negócios atrasados",
            valor: fmtNum(data.atrasados.length),
            tom: data.atrasados.length ? "alerta" : undefined,
          },
          { rotulo: "Leads · 7 dias", valor: fmtNum(data.semana.novosLeads) },
          { rotulo: "Mensagens · 7 dias", valor: fmtNum(data.semana.mensagensEnviadas) },
          {
            rotulo: "Fechados · 7 dias",
            valor: fmtNum(data.semana.fechados),
            detalhe: `${fmtMoeda(data.semana.receita)} recebidos`,
          },
        ]}
      />

      <VisaoGeral visao={data.visao} />

      <div className="grid gap-6 xl:grid-cols-[1.3fr_1fr]">
        <Secao
          titulo="Tarefas de hoje e atrasadas"
          contagem={tarefas.length}
          colado
          acoes={
            <label className="flex items-center gap-2 text-xs text-muted-foreground">
              <Switch checked={soMinhas} onCheckedChange={setSoMinhas} /> Só as minhas
            </label>
          }
        >
          {tarefas.length ? (
            <ul className="divide-y">
              {tarefas.map((t) => (
                <TarefaLinha
                  key={t.id}
                  t={t}
                  hoje={data.hoje}
                  onAbrir={t.negocio_id ? () => setAberto(t.negocio_id) : undefined}
                  onNegocio={t.negocio_id ? () => setAberto(t.negocio_id) : undefined}
                  onConcluir={() =>
                    executar(
                      () => concluir({ data: { id: t.id, feita: true } }),
                      "Tarefa concluída.",
                    )
                  }
                />
              ))}
            </ul>
          ) : (
            <div className="p-4">
              <Vazio>Nada para hoje. Que tal puxar a fila “Viraram pauta”?</Vazio>
            </div>
          )}
        </Secao>

        <div className="space-y-6">
          <ListaNegocios
            titulo="Novos leads (24h)"
            lista={data.novos}
            onAbrir={setAberto}
            vazio="Nenhum lead novo."
          />
          <ListaNegocios
            titulo="Negócios atrasados"
            lista={data.atrasados}
            onAbrir={setAberto}
            vazio="Nenhum atrasado."
            alerta
          />
        </div>
      </div>

      <Secao titulo='Fila "Viraram pauta"' contagem={data.viraramPauta.length}>
        <p className="mb-3 text-xs text-muted-foreground">
          Empresas citadas em matérias e posts, sem negócio aberto. Comece pelo grupo A. O 1º
          contato manda o link da matéria e do post, sem métricas e sem preço.
        </p>
        {data.viraramPauta.length ? (
          <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-3">
            {data.viraramPauta.map((f) => (
              <div key={f.empresa_id} className="flex flex-col gap-2 rounded-lg border p-3">
                <div className="flex items-start justify-between gap-2">
                  <Link
                    to="/empresas/$id"
                    params={{ id: f.empresa_id }}
                    className="font-semibold hover:text-primary"
                  >
                    {f.nome}
                  </Link>
                  <GrupoBadge grupo={f.grupo} pontuacao={f.pontuacao} />
                </div>
                {f.article_slug ? (
                  <a
                    href={linkMateria(f.article_slug)!}
                    target="_blank"
                    rel="noreferrer"
                    className="line-clamp-2 text-xs text-primary hover:underline"
                  >
                    {f.article_title}
                  </a>
                ) : null}
                <p className="text-[11px] text-muted-foreground">
                  {f.mencoes} menção(ões) · última {fmtDiaCurto(f.ultima_mencao_em)}
                  {f.brasileira === false ? " · estrangeira" : ""}
                </p>
                <div className="mt-auto flex gap-2">
                  <Button size="sm" className="h-8 flex-1" onClick={() => virarLead(f)}>
                    Criar lead
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-8"
                    title="Montar 1ª mensagem"
                    onClick={() =>
                      setMensagem({
                        empresa: f.nome,
                        article_slug: f.article_slug,
                        link_post: f.post_url,
                        empresa_id: f.empresa_id,
                      })
                    }
                  >
                    <MessageCircle className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <Vazio>Fila vazia. Marque as empresas citadas em Pautas e conteúdo.</Vazio>
        )}
      </Secao>

      <div className="grid gap-6 lg:grid-cols-2">
        <ListaNegocios
          titulo="Sem resposta há mais de 3 dias"
          lista={data.semResposta}
          onAbrir={setAberto}
          vazio="Ninguém esperando retorno."
          detalhe={(n) => `última mensagem ${fmtDiaCurto(n.ultima_enviada_em)}`}
        />
        <ListaNegocios
          titulo="Parados (7 dias sem atividade)"
          lista={data.parados}
          onAbrir={setAberto}
          vazio="Nenhum negócio parado."
          detalhe={(n) => `última atividade ${fmtDiaCurto(n.ultima_atividade_em ?? n.etapa_desde)}`}
        />
        <ListaNegocios
          titulo="Sem próxima ação"
          lista={data.semAcao}
          onAbrir={setAberto}
          vazio="Todos têm próxima ação."
          alerta
        />
        <Secao titulo="Leads aquecidos" contagem={data.aquecidos.length}>
          <p className="mb-2 text-xs text-muted-foreground">
            Pessoas cadastradas que leram 3 matérias ou mais em 7 dias.
          </p>
          {data.aquecidos.length ? (
            <ul className="space-y-1.5">
              {data.aquecidos.map((p) => (
                <li key={p.id} className="flex items-center gap-2 text-sm">
                  <Flame className="h-4 w-4 text-orange-500" />
                  <Link
                    to="/pessoas/$id"
                    params={{ id: p.id }}
                    className="font-semibold hover:text-primary"
                  >
                    {p.nome}
                  </Link>
                  <span className="text-xs text-muted-foreground">
                    {fmtDiaCurto(p.aquecido_em)}
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <Vazio>Nenhum lead aquecido nos últimos 7 dias.</Vazio>
          )}
        </Secao>
      </div>

      <NegocioPainel id={aberto} onClose={() => setAberto(null)} />
      <NegocioDialog
        aberto={novoNegocio}
        onClose={() => setNovoNegocio(false)}
        onSalvo={setAberto}
      />
      <TarefaDialog aberto={novaTarefa} onClose={() => setNovaTarefa(false)} />
      <MensagemDialog
        aberto={!!mensagem}
        onClose={() => setMensagem(null)}
        dados={mensagem ?? {}}
      />
    </div>
  );
}

function ListaNegocios({
  titulo,
  lista,
  onAbrir,
  vazio,
  alerta,
  detalhe,
}: {
  titulo: string;
  lista: NegocioCompleto[];
  onAbrir: (id: string) => void;
  vazio: string;
  alerta?: boolean;
  detalhe?: (n: NegocioCompleto) => string;
}) {
  const { membro } = useCrm();
  const [todos, setTodos] = useState(false);
  const visiveis = todos ? lista.slice(0, 40) : lista.slice(0, 5);
  return (
    <Secao titulo={titulo} contagem={lista.length} colado>
      {lista.length ? (
        <>
          <ul className="divide-y">
            {visiveis.map((n) => (
              <li key={n.id}>
                <button
                  type="button"
                  onClick={() => onAbrir(n.id)}
                  className="flex w-full items-center gap-3 px-4 py-2.5 text-left transition hover:bg-[#f8faff] sm:px-5"
                >
                  <span className="min-w-0 flex-1">
                    <span className="flex items-center gap-2">
                      <span className="truncate text-[13.5px] font-semibold">
                        {n.empresa_nome ?? n.titulo}
                      </span>
                      <GrupoBadge grupo={n.empresa_grupo} />
                    </span>
                    <span className="block truncate text-xs text-muted-foreground">
                      {n.etapa_nome}
                      {detalhe
                        ? ` · ${detalhe(n)}`
                        : n.proxima_acao_em
                          ? ` · ${prazoRelativo(n.proxima_acao_em)}`
                          : ""}
                    </span>
                  </span>
                  {alerta && atrasado(n.proxima_acao_em) ? (
                    <Etiqueta tom="alerta">atrasado</Etiqueta>
                  ) : null}
                  <Avatar nome={membro(n.dono_id)} />
                </button>
              </li>
            ))}
          </ul>
          {lista.length > 5 ? (
            <button
              type="button"
              onClick={() => setTodos((v) => !v)}
              className="flex w-full items-center justify-center gap-1 border-t px-4 py-2.5 text-xs font-semibold text-primary hover:bg-[#f8faff]"
            >
              {todos ? "Mostrar menos" : `Ver todos (${fmtNum(lista.length)})`}
              <ChevronDown className={cn("h-3.5 w-3.5", todos && "rotate-180")} />
            </button>
          ) : null}
        </>
      ) : (
        <div className="p-4">
          <Vazio>{vazio}</Vazio>
        </div>
      )}
    </Secao>
  );
}
