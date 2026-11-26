import { useState, type ComponentType, type ReactNode } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  AlarmClock,
  ArrowRight,
  BadgeDollarSign,
  CalendarCheck,
  CalendarDays,
  CalendarPlus,
  ChevronDown,
  CircleDollarSign,
  Flame,
  Handshake,
  Hourglass,
  Mail,
  MessageCircle,
  MessageSquareDashed,
  Newspaper,
  Plus,
  RefreshCw,
  Sparkles,
  Trophy,
  UserPlus,
  Zap,
} from "lucide-react";

import { useCrm } from "@/components/crm/context";
import { AlertasDono, ListaDoDia, NumerosDono, ParaComecar } from "@/components/crm/painel-dono";
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
  GrupoBadge,
  Numero,
  Secao,
  Vazio,
  Variacao,
} from "@/components/crm/ui";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import { Switch } from "@/components/ui/switch";
import type { NegocioCompleto } from "@/lib/crm/carregar";
import { getHoje, type FilaViraramPauta, type PainelHoje } from "@/lib/crm/hoje.functions";
import { getPainelDono } from "@/lib/crm/metricas.functions";
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
  component: InicioPage,
});

/* Início = painel do dono (documento de métricas estratégicas): até 8 números, alertas
   automáticos, a rotina da equipe ("O que fazer agora") e as listas do dia
   (cobrança, fila de produção com pagos primeiro e follow-up). */

type Painel =
  | "tarefas"
  | "novos"
  | "atrasados"
  | "semResposta"
  | "parados"
  | "semAcao"
  | "pauta"
  | "aquecidos";

function InicioPage() {
  const { userId } = useCrm();
  const fetchHoje = useServerFn(getHoje);
  const fetchPainel = useServerFn(getPainelDono);
  const concluir = useServerFn(concluirTarefa);
  const criarLead = useServerFn(criarLeadDeEmpresa);
  const { executar } = useAcao();
  const [soMinhas, setSoMinhas] = useState(false);
  const [painel, setPainel] = useState<Painel | null>(null);
  const [aberto, setAberto] = useState<string | null>(null);
  const [novoNegocio, setNovoNegocio] = useState(false);
  const [novaTarefa, setNovaTarefa] = useState(false);
  const [mensagem, setMensagem] = useState<DadosMensagem | null>(null);

  const hoje = useQuery({
    queryKey: ["crm", "hoje"],
    queryFn: () => fetchHoje(),
    refetchInterval: 5 * 60_000,
  });
  const painelDono = useQuery({
    queryKey: ["crm", "painel-dono"],
    queryFn: () => fetchPainel(),
    refetchInterval: 5 * 60_000,
  });

  if (hoje.isLoading) return <Carregando />;
  if (hoje.error || !hoje.data) return <Erro erro={hoje.error} />;
  const data = hoje.data;

  const tarefas = soMinhas
    ? data.tarefas.filter((t) => t.responsavel_id === userId || !t.responsavel_id)
    : data.tarefas;
  const atrasadas = tarefas.filter((t) => atrasado(t.vence_em, data.hoje));

  function abrirNegocio(id: string) {
    setPainel(null);
    setAberto(id);
  }

  async function virarLead(f: FilaViraramPauta) {
    const res = await executar(
      () => criarLead({ data: { empresa_id: f.empresa_id, article_id: f.article_id } }),
      (x) => (x.existente ? "A empresa já tinha negócio aberto." : `Lead criado: ${f.nome}.`),
    );
    if (res) abrirNegocio(res.id);
  }

  const cartoes: {
    id: Painel;
    rotulo: string;
    qtd: number;
    dica: string;
    icone: ComponentType<{ className?: string }>;
    tom?: "alerta" | "azul";
  }[] = [
    {
      id: "tarefas",
      rotulo: "Tarefas de hoje",
      qtd: tarefas.length,
      dica: atrasadas.length ? `${atrasadas.length} atrasadas` : "em dia",
      icone: CalendarCheck,
      tom: atrasadas.length ? "alerta" : "azul",
    },
    {
      id: "novos",
      rotulo: "Novos leads",
      qtd: data.novos.length,
      dica: "últimas 24 horas",
      icone: UserPlus,
      tom: data.novos.length ? "azul" : undefined,
    },
    {
      id: "atrasados",
      rotulo: "Negócios atrasados",
      qtd: data.atrasados.length,
      dica: "próxima ação vencida",
      icone: AlarmClock,
      tom: data.atrasados.length ? "alerta" : undefined,
    },
    {
      id: "semResposta",
      rotulo: "Sem resposta",
      qtd: data.semResposta.length,
      dica: "há mais de 3 dias",
      icone: MessageSquareDashed,
    },
    {
      id: "parados",
      rotulo: "Parados",
      qtd: data.parados.length,
      dica: "7 dias sem atividade",
      icone: Hourglass,
    },
    {
      id: "semAcao",
      rotulo: "Sem próxima ação",
      qtd: data.semAcao.length,
      dica: "defina o próximo passo",
      icone: Zap,
    },
    {
      id: "pauta",
      rotulo: "Viraram pauta",
      qtd: data.viraramPauta.length,
      dica: "empresas citadas sem negócio",
      icone: Sparkles,
    },
    {
      id: "aquecidos",
      rotulo: "Leads aquecidos",
      qtd: data.aquecidos.length,
      dica: "leram 3+ matérias em 7 dias",
      icone: Flame,
    },
  ];
  const atual = cartoes.find((c) => c.id === painel);

  return (
    <div className="space-y-7">
      <CabecalhoPagina
        titulo="Início"
        descricao={`${fmtDia(data.hoje)} · os números do negócio e o que pede atenção hoje.`}
        acoes={
          <>
            <Button
              variant="outline"
              size="sm"
              className="h-9"
              onClick={() => {
                hoje.refetch();
                painelDono.refetch();
              }}
              disabled={hoje.isFetching || painelDono.isFetching}
            >
              <RefreshCw
                className={cn(
                  "h-4 w-4",
                  (hoje.isFetching || painelDono.isFetching) && "animate-spin",
                )}
              />
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

      {/* 1. Painel do dono: no máximo 8 números + alertas automáticos */}
      <section aria-label="Números do negócio" className="space-y-3">
        <TituloBloco>Seu negócio</TituloBloco>
        {painelDono.data ? (
          <NumerosDono d={painelDono.data} />
        ) : painelDono.error ? (
          <Erro erro={painelDono.error} />
        ) : (
          <p className="text-sm text-muted-foreground">Calculando os números…</p>
        )}
      </section>

      {painelDono.data?.comecar.length ? <ParaComecar itens={painelDono.data.comecar} /> : null}

      {painelDono.data ? (
        <section aria-label="Alertas" className="space-y-3">
          <TituloBloco>Alertas</TituloBloco>
          <AlertasDono alertas={painelDono.data.alertas} />
        </section>
      ) : null}

      {/* 2. O que fazer agora */}
      <section aria-label="O que fazer agora" className="space-y-3">
        <TituloBloco>Rotina da equipe</TituloBloco>
        {/* celular: lista compacta */}
        <ul className="divide-y overflow-hidden rounded-xl border bg-card shadow-[var(--shadow-card)] md:hidden">
          {cartoes.map((c) => (
            <li key={c.id}>
              <button
                type="button"
                onClick={() => setPainel(c.id)}
                className={cn(
                  "flex w-full items-center gap-3 px-4 py-3 text-left active:bg-muted",
                  c.qtd === 0 && "opacity-55",
                )}
              >
                <span
                  className={cn(
                    "flex h-9 w-9 shrink-0 items-center justify-center rounded-lg",
                    c.tom === "alerta" && c.qtd
                      ? "bg-destructive/10 text-destructive"
                      : "bg-primary/[0.08] text-primary",
                  )}
                >
                  <c.icone className="h-4 w-4" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[14px] font-semibold">{c.rotulo}</span>
                  <span className="block truncate text-[12px] text-muted-foreground">{c.dica}</span>
                </span>
                <span
                  className={cn(
                    "tabular text-[17px] font-semibold",
                    c.tom === "alerta" && c.qtd ? "text-destructive" : "",
                  )}
                >
                  {fmtNum(c.qtd)}
                </span>
                <ArrowRight className="h-4 w-4 text-muted-foreground" />
              </button>
            </li>
          ))}
        </ul>
        <div className="hidden grid-cols-4 gap-3 md:grid">
          {cartoes.map((c) => (
            <button
              key={c.id}
              type="button"
              onClick={() => setPainel(c.id)}
              className={cn(
                "group flex min-h-[104px] flex-col justify-between rounded-xl border bg-card p-4 text-left shadow-[var(--shadow-card)] transition hover:-translate-y-0.5 hover:border-primary/40",
                c.qtd === 0 && "opacity-60",
              )}
            >
              <span className="flex items-start justify-between gap-2">
                <span className="text-[13px] font-semibold leading-snug">{c.rotulo}</span>
                <span
                  className={cn(
                    "flex h-8 w-8 shrink-0 items-center justify-center rounded-lg",
                    c.tom === "alerta" && c.qtd
                      ? "bg-destructive/10 text-destructive"
                      : "bg-primary/[0.08] text-primary",
                  )}
                >
                  <c.icone className="h-4 w-4" />
                </span>
              </span>
              <span className="mt-2 flex items-end justify-between gap-2">
                <span>
                  <span
                    className={cn(
                      "tabular block text-[26px] font-semibold leading-none tracking-[-0.02em]",
                      c.tom === "alerta" && c.qtd ? "text-destructive" : "",
                    )}
                  >
                    {fmtNum(c.qtd)}
                  </span>
                  <span className="mt-1 block text-[11.5px] text-muted-foreground">{c.dica}</span>
                </span>
                <ArrowRight className="h-4 w-4 text-muted-foreground transition group-hover:translate-x-0.5 group-hover:text-primary" />
              </span>
            </button>
          ))}
        </div>
      </section>

      {/* 3. Listas do dia: cobrança, produção (pagos primeiro) e follow-up */}
      {painelDono.data ? (
        <section aria-label="Listas do dia" className="space-y-3">
          <TituloBloco>Listas do dia</TituloBloco>
          <div className="grid gap-5 xl:grid-cols-3">
            {painelDono.data.admin ? (
              <ListaDoDia
                titulo="Cobranças"
                itens={painelDono.data.cobrancas}
                vazio="Nada para cobrar."
                link="/financeiro"
                onAbrir={abrirNegocio}
              />
            ) : null}
            <ListaDoDia
              titulo="Fila de produção"
              itens={painelDono.data.producao}
              vazio="Nada na fila."
              link="/operacao"
              onAbrir={abrirNegocio}
            />
            <ListaDoDia
              titulo="Follow-up (parados 3+ dias)"
              itens={painelDono.data.followups}
              vazio="Nenhum negócio parado."
              link="/comercial"
              onAbrir={abrirNegocio}
            />
          </div>
        </section>
      ) : null}

      <Sheet open={!!painel} onOpenChange={(v) => !v && setPainel(null)}>
        <SheetContent className="flex w-full flex-col gap-0 p-0 sm:max-w-[520px]">
          <div className="border-b px-5 py-4 pr-12">
            <SheetTitle className="flex items-center gap-2 text-base">
              {atual ? <atual.icone className="h-4 w-4 text-primary" /> : null}
              {atual?.rotulo}
              <span className="tabular rounded-full bg-muted px-2 py-0.5 text-[11px] font-semibold text-muted-foreground">
                {atual?.qtd ?? 0}
              </span>
            </SheetTitle>
            <p className="mt-0.5 text-xs text-muted-foreground">{atual?.dica}</p>
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto">
            {painel === "tarefas" ? (
              <>
                <div className="flex items-center justify-between border-b px-5 py-2.5">
                  <label className="flex items-center gap-2 text-xs text-muted-foreground">
                    <Switch checked={soMinhas} onCheckedChange={setSoMinhas} /> Só as minhas
                  </label>
                  <Link
                    to="/tarefas"
                    className="text-xs font-semibold text-primary hover:underline"
                  >
                    Todas as tarefas →
                  </Link>
                </div>
                {tarefas.length ? (
                  <ul className="divide-y">
                    {tarefas.map((t) => (
                      <TarefaLinha
                        key={t.id}
                        t={t}
                        hoje={data.hoje}
                        onAbrir={t.negocio_id ? () => abrirNegocio(t.negocio_id!) : undefined}
                        onNegocio={t.negocio_id ? () => abrirNegocio(t.negocio_id!) : undefined}
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
                  <div className="p-5">
                    <Vazio>Nada para hoje.</Vazio>
                  </div>
                )}
              </>
            ) : null}
            {painel === "novos" ? (
              <ListaNegocios lista={data.novos} onAbrir={abrirNegocio} vazio="Nenhum lead novo." />
            ) : null}
            {painel === "atrasados" ? (
              <ListaNegocios
                lista={data.atrasados}
                onAbrir={abrirNegocio}
                vazio="Nenhum atrasado."
                alerta
              />
            ) : null}
            {painel === "semResposta" ? (
              <ListaNegocios
                lista={data.semResposta}
                onAbrir={abrirNegocio}
                vazio="Ninguém esperando retorno."
                detalhe={(n) => `última mensagem ${fmtDiaCurto(n.ultima_enviada_em)}`}
              />
            ) : null}
            {painel === "parados" ? (
              <ListaNegocios
                lista={data.parados}
                onAbrir={abrirNegocio}
                vazio="Nenhum negócio parado."
                detalhe={(n) =>
                  `última atividade ${fmtDiaCurto(n.ultima_atividade_em ?? n.etapa_desde)}`
                }
              />
            ) : null}
            {painel === "semAcao" ? (
              <ListaNegocios
                lista={data.semAcao}
                onAbrir={abrirNegocio}
                vazio="Todos têm próxima ação."
                alerta
              />
            ) : null}
            {painel === "pauta" ? (
              <FilaPauta
                fila={data.viraramPauta}
                onCriar={virarLead}
                onMensagem={(f) =>
                  setMensagem({
                    empresa: f.nome,
                    article_slug: f.article_slug,
                    link_post: f.post_url,
                    empresa_id: f.empresa_id,
                  })
                }
              />
            ) : null}
            {painel === "aquecidos" ? <Aquecidos lista={data.aquecidos} /> : null}
          </div>
        </SheetContent>
      </Sheet>

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

function TituloBloco({ children }: { children: ReactNode }) {
  return (
    <h2 className="text-[12px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
      {children}
    </h2>
  );
}

function FilaPauta({
  fila,
  onCriar,
  onMensagem,
}: {
  fila: FilaViraramPauta[];
  onCriar: (f: FilaViraramPauta) => void;
  onMensagem: (f: FilaViraramPauta) => void;
}) {
  if (!fila.length)
    return (
      <div className="p-5">
        <Vazio>Fila vazia. Marque as empresas citadas em Pautas e conteúdo.</Vazio>
      </div>
    );
  return (
    <ul className="divide-y">
      {fila.map((f) => (
        <li key={f.empresa_id} className="space-y-1.5 px-5 py-3">
          <div className="flex items-start justify-between gap-2">
            <Link
              to="/empresas/$id"
              params={{ id: f.empresa_id }}
              className="text-[13.5px] font-semibold hover:text-primary"
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
              className="line-clamp-1 text-xs text-primary hover:underline"
            >
              {f.article_title}
            </a>
          ) : null}
          <div className="flex gap-2 pt-1">
            <Button size="sm" className="h-8" onClick={() => onCriar(f)}>
              Criar lead
            </Button>
            <Button size="sm" variant="outline" className="h-8" onClick={() => onMensagem(f)}>
              <MessageCircle className="h-4 w-4" /> 1ª mensagem
            </Button>
          </div>
        </li>
      ))}
    </ul>
  );
}

function Aquecidos({ lista }: { lista: PainelHoje["aquecidos"] }) {
  if (!lista.length)
    return (
      <div className="p-5">
        <Vazio>Nenhum lead aquecido nos últimos 7 dias.</Vazio>
      </div>
    );
  return (
    <ul className="divide-y">
      {lista.map((p) => (
        <li key={p.id} className="flex items-center gap-2 px-5 py-2.5 text-sm">
          <Flame className="h-4 w-4 text-orange-500" />
          <Link
            to="/pessoas/$id"
            params={{ id: p.id }}
            className="font-semibold hover:text-primary"
          >
            {p.nome}
          </Link>
          <span className="ml-auto text-xs text-muted-foreground">
            {fmtDiaCurto(p.aquecido_em)}
          </span>
        </li>
      ))}
    </ul>
  );
}

function ListaNegocios({
  lista,
  onAbrir,
  vazio,
  alerta,
  detalhe,
}: {
  lista: NegocioCompleto[];
  onAbrir: (id: string) => void;
  vazio: string;
  alerta?: boolean;
  detalhe?: (n: NegocioCompleto) => string;
}) {
  const { membro } = useCrm();
  const [limite, setLimite] = useState(30);
  if (!lista.length)
    return (
      <div className="p-5">
        <Vazio>{vazio}</Vazio>
      </div>
    );
  return (
    <>
      <ul className="divide-y">
        {lista.slice(0, limite).map((n) => (
          <li key={n.id}>
            <button
              type="button"
              onClick={() => onAbrir(n.id)}
              className="flex w-full items-center gap-3 px-5 py-2.5 text-left transition hover:bg-[#f8faff]"
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
      {lista.length > limite ? (
        <button
          type="button"
          onClick={() => setLimite((l) => l + 30)}
          className="flex w-full items-center justify-center gap-1 border-t px-4 py-3 text-xs font-semibold text-primary hover:bg-[#f8faff]"
        >
          Ver mais ({fmtNum(lista.length - limite)}) <ChevronDown className="h-3.5 w-3.5" />
        </button>
      ) : null}
    </>
  );
}
