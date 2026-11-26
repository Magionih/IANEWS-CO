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
} from "@/components/crm/ui";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import { Switch } from "@/components/ui/switch";
import type { NegocioCompleto } from "@/lib/crm/carregar";
import { getHoje, type FilaViraramPauta, type PainelHoje } from "@/lib/crm/hoje.functions";
import { getResumoInicio, type ConteudoAgenda } from "@/lib/crm/inicio.functions";
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

/* Início: primeiro os números que importam (faturamento, negociação, leads),
   depois "O que fazer agora" em cartões — cada cartão abre a sua lista num painel lateral,
   sem uma página infinita — e por fim os próximos conteúdos e o funil. */

type Painel =
  | "tarefas"
  | "novos"
  | "atrasados"
  | "semResposta"
  | "parados"
  | "semAcao"
  | "pauta"
  | "aquecidos";

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

function InicioPage() {
  const { userId } = useCrm();
  const fetchHoje = useServerFn(getHoje);
  const fetchResumo = useServerFn(getResumoInicio);
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
  const resumo = useQuery({
    queryKey: ["crm", "inicio"],
    queryFn: () => fetchResumo(),
    refetchInterval: 5 * 60_000,
  });

  if (hoje.isLoading) return <Carregando />;
  if (hoje.error || !hoje.data) return <Erro erro={hoje.error} />;
  const data = hoje.data;
  const r = resumo.data;

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
                resumo.refetch();
              }}
              disabled={hoje.isFetching || resumo.isFetching}
            >
              <RefreshCw
                className={cn("h-4 w-4", (hoje.isFetching || resumo.isFetching) && "animate-spin")}
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

      {/* 1. Números do negócio */}
      <section aria-label="Números do negócio" className="space-y-3">
        <TituloBloco>Seu negócio</TituloBloco>
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-3 xl:grid-cols-6">
          <Numero
            rotulo="Faturado no mês"
            valor={r ? fmtMoeda(r.faturadoMes) : "…"}
            detalhe={
              r ? `${r.faturadoMesQtd} pagamentos · total ${fmtMoeda(r.faturadoTotal)}` : null
            }
            destaque="azul"
            icone={CircleDollarSign}
          />
          <Numero
            rotulo="A receber"
            valor={r ? fmtMoeda(r.aReceber) : "…"}
            detalhe={r ? `${r.aReceberQtd} fechados aguardando pagamento` : null}
            icone={BadgeDollarSign}
          />
          <Numero
            rotulo="Em negociação"
            valor={r ? fmtNum(r.negociacaoQtd) : "…"}
            detalhe={
              r
                ? r.negociacaoValor
                  ? `clientes · ${fmtMoeda(r.negociacaoValor)} em propostas`
                  : "clientes que já responderam"
                : null
            }
            icone={Handshake}
          />
          <Numero
            rotulo="Fechados no mês"
            valor={r ? fmtNum(r.fechadosMes) : "…"}
            detalhe={`${fmtNum(data.semana.fechados)} nos últimos 7 dias`}
            icone={Trophy}
          />
          <Numero
            rotulo="Novos leads"
            valor={fmtNum(data.semana.novosLeads)}
            detalhe={`últimos 7 dias · ${fmtNum(data.semana.mensagensEnviadas)} mensagens enviadas`}
            icone={UserPlus}
          />
          <Link to="/newsletter" className="block rounded-xl transition hover:-translate-y-0.5">
            <Numero
              rotulo="Newsletter"
              valor={r?.newsletterAtivos != null ? fmtNum(r.newsletterAtivos) : "—"}
              detalhe={
                r?.newsletterNovos7 != null
                  ? `assinantes · +${fmtNum(r.newsletterNovos7)} em 7 dias`
                  : "assinantes ativos"
              }
              icone={Mail}
            />
          </Link>
        </div>
      </section>

      {/* 2. O que fazer agora */}
      <section aria-label="O que fazer agora" className="space-y-3">
        <TituloBloco>O que fazer agora</TituloBloco>
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

      {/* 3. Conteúdo e funil */}
      <div className="grid gap-5 xl:grid-cols-[1fr_1.15fr]">
        <ProximosConteudos lista={r?.proximos} />
        <FunilAberto visao={data.visao} />
      </div>

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

const HORA = new Intl.DateTimeFormat("pt-BR", {
  hour: "2-digit",
  minute: "2-digit",
  timeZone: "America/Sao_Paulo",
});
const DIA_SEMANA = new Intl.DateTimeFormat("pt-BR", {
  weekday: "short",
  timeZone: "America/Sao_Paulo",
});
const DIA_MES = new Intl.DateTimeFormat("pt-BR", {
  day: "2-digit",
  month: "2-digit",
  timeZone: "America/Sao_Paulo",
});
/** "Sex 27/11" */
function diaCurto(d: Date) {
  const w = DIA_SEMANA.format(d).replace(".", "");
  return `${w.charAt(0).toUpperCase()}${w.slice(1)} ${DIA_MES.format(d)}`;
}

function ProximosConteudos({ lista }: { lista?: ConteudoAgenda[] }) {
  return (
    <Secao
      titulo={
        <span className="flex items-center gap-2">
          <Newspaper className="h-4 w-4 text-primary" /> Próximos conteúdos
        </span>
      }
      colado
      acoes={
        <Link
          to="/calendario"
          className="flex items-center gap-1 text-xs font-semibold text-primary hover:underline"
        >
          <CalendarDays className="h-3.5 w-3.5" /> Calendário
        </Link>
      }
    >
      {!lista ? (
        <p className="p-5 text-sm text-muted-foreground">Carregando…</p>
      ) : lista.length ? (
        <ul className="divide-y">
          {lista.map((c) => {
            const d = new Date(c.published_at);
            return (
              <li key={c.id} className="flex items-center gap-3 px-4 py-2.5 sm:px-5">
                <span className="w-[86px] shrink-0">
                  <span className="block whitespace-nowrap text-[12px] font-semibold">
                    {diaCurto(d)}
                  </span>
                  <span className="tabular block text-[11px] text-muted-foreground">
                    {HORA.format(d)}
                  </span>
                </span>
                <a
                  href={linkMateria(c.slug) ?? undefined}
                  target="_blank"
                  rel="noreferrer"
                  className="line-clamp-2 min-w-0 flex-1 text-[13px] font-medium leading-snug hover:text-primary"
                >
                  {c.title}
                </a>
              </li>
            );
          })}
        </ul>
      ) : (
        <div className="p-5">
          <Vazio>Nenhum conteúdo agendado.</Vazio>
        </div>
      )}
    </Secao>
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
