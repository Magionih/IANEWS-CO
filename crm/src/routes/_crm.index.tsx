import { useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { CalendarCheck, ChevronRight, Plus } from "lucide-react";

import { CartaoNotificacoes } from "@/components/crm/avisos";
import { CartaoFaceId } from "@/components/crm/faceid";
import { useCrm } from "@/components/crm/context";
import { TarefaDialog } from "@/components/crm/dialogs";
import { NegocioDialog, NegocioPainel } from "@/components/crm/negocio";
import { Abas, Cartao, Carregando, Erro, FaixaNumeros } from "@/components/crm/ui";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import { getPainelDono, type ItemLista, type PainelDono } from "@/lib/crm/metricas.functions";
import { hojeBR } from "@/lib/crm/utils";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_crm/")({
  component: InicioPage,
});

/* Início: "estou no ritmo da meta?" e "o que faço hoje?".
   A meta, um painel de números (padrão banco), o foco do dia (cobrar, produzir, retomar),
   as próximas publicações, o que falta para os números ficarem completos, o vendido por semana
   e o funil. Tudo se atualiza sozinho a cada movimentação (tempo real). */

const brl = (n: number | null | undefined) =>
  n == null ? "—" : `R$ ${Math.round(n).toLocaleString("pt-BR")}`;

const DIA_LONGO = new Intl.DateTimeFormat("pt-BR", {
  weekday: "long",
  day: "numeric",
  month: "long",
  timeZone: "UTC",
});

function saudacao() {
  const h = Number(
    new Intl.DateTimeFormat("pt-BR", {
      hour: "numeric",
      hour12: false,
      timeZone: "America/Sao_Paulo",
    }).format(new Date()),
  );
  return h < 12 ? "Bom dia" : h < 18 ? "Boa tarde" : "Boa noite";
}

const iniciais = (nome: string) => {
  const p = nome.split(/\s+/).filter((x) => /^[\p{L}\p{N}]/u.test(x));
  return ((p[0]?.[0] ?? "") + (p[1]?.[0] ?? "")).toUpperCase() || "•";
};

function InicioPage() {
  const { userId, membro } = useCrm();
  const fetchPainel = useServerFn(getPainelDono);
  const [aberto, setAberto] = useState<string | null>(null);
  const [novoNegocio, setNovoNegocio] = useState(false);
  const [novaTarefa, setNovaTarefa] = useState(false);
  const { data, isLoading, error } = useQuery({
    queryKey: ["crm", "painel-dono"],
    queryFn: () => fetchPainel(),
    refetchInterval: 5 * 60_000,
  });

  const nome = membro(userId);
  const primeiroNome = nome && nome !== "—" ? nome.split(" ")[0] : "";
  const hoje = hojeBR();
  const dataLonga = DIA_LONGO.format(new Date(`${hoje}T12:00:00Z`));

  return (
    <div className="space-y-4 sm:space-y-5">
      <header className="flex items-end justify-between gap-3">
        <div className="min-w-0">
          <p className="mb-0.5 truncate text-[12.5px] text-muted-foreground sm:text-[13px]">
            {dataLonga.charAt(0).toUpperCase() + dataLonga.slice(1)}
          </p>
          <h1 className="font-display truncate text-[22px] font-bold leading-tight tracking-[-0.02em] sm:text-[28px]">
            {saudacao()}
            {primeiroNome ? `, ${primeiroNome}` : ""}
          </h1>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <Button
            variant="outline"
            className="h-9 w-9 px-0 sm:w-auto sm:px-3"
            onClick={() => setNovaTarefa(true)}
            aria-label="Nova tarefa"
          >
            <CalendarCheck className="h-4 w-4" />
            <span className="hidden sm:inline">Tarefa</span>
          </Button>
          <Button
            className="h-9 w-9 px-0 sm:w-auto sm:px-3"
            onClick={() => setNovoNegocio(true)}
            aria-label="Novo negócio"
          >
            <Plus className="h-4 w-4" />
            <span className="hidden sm:inline">Novo negócio</span>
          </Button>
        </div>
      </header>

      {isLoading ? (
        <Carregando texto="Calculando os números..." />
      ) : error || !data ? (
        <Erro erro={error} />
      ) : (
        <Painel d={data} onAbrir={setAberto} />
      )}

      <NegocioPainel id={aberto} onClose={() => setAberto(null)} />
      <NegocioDialog
        aberto={novoNegocio}
        onClose={() => setNovoNegocio(false)}
        onSalvo={setAberto}
      />
      <TarefaDialog aberto={novaTarefa} onClose={() => setNovaTarefa(false)} />
    </div>
  );
}

function Painel({ d, onAbrir }: { d: PainelDono; onAbrir: (id: string) => void }) {
  const numeros = d.admin
    ? [
        {
          rotulo: "Vendido no mês",
          valor: brl(d.recebidoMes),
          detalhe: d.vendidoCartaoMes
            ? `inclui ${brl(d.vendidoCartaoMes)} no cartão`
            : d.recebidoMesQtd != null
              ? `${d.recebidoMesQtd} pagamentos`
              : undefined,
          tom: "ok" as const,
          link: "/financeiro",
        },
        ...(d.saldo != null
          ? [
              {
                rotulo: "Caixa hoje",
                valor: brl(d.saldo),
                detalhe:
                  d.folegoMeses != null
                    ? `fôlego de ${d.folegoMeses >= 12 ? "12+" : d.folegoMeses.toFixed(1).replace(".", ",")} meses`
                    : undefined,
                link: "/financeiro",
              },
            ]
          : []),
        ...(d.cartao
          ? [
              {
                rotulo: "Cartão a receber",
                valor: brl(d.cartao.liquido),
                detalhe: `${brl(d.cartao.proximos30)} em 30 dias`,
                link: "/financeiro",
              },
            ]
          : []),
        {
          rotulo: "A receber",
          valor: brl(d.receber?.valor),
          detalhe: d.receber ? `${d.receber.qtd} cobranças abertas` : undefined,
          tom: d.receber?.qtd ? ("alerta" as const) : undefined,
          link: "/financeiro",
        },
        {
          rotulo: "Pipeline provável",
          valor: brl(d.pipeline.ponderado),
          detalhe: `de ${brl(d.pipeline.bruto)} em negociação`,
          link: "/negocios",
        },
      ]
    : [
        {
          rotulo: "Pagos parados na produção",
          valor: brl(d.travado.valor),
          detalhe: `${d.travado.qtd} aguardando`,
          tom: d.travado.qtd ? ("alerta" as const) : undefined,
          link: "/operacao",
        },
        {
          rotulo: "Pipeline provável",
          valor: brl(d.pipeline.ponderado),
          detalhe: `de ${brl(d.pipeline.bruto)} em negociação`,
          link: "/negocios",
        },
      ];
  return (
    <>
      {d.admin && d.ritmo ? <CartaoMeta d={d} /> : null}
      <FaixaNumeros itens={numeros} />
      <CartaoFaceId compacto />
      <CartaoNotificacoes compacto />

      <section className="grid gap-4 lg:grid-cols-[3fr_2fr]">
        <FocoDeHoje d={d} onAbrir={onAbrir} />
        <div className="flex min-w-0 flex-col gap-4">
          <Agenda d={d} />
          <Atencao d={d} />
        </div>
      </section>

      <section className="grid gap-4 lg:grid-cols-[3fr_2fr]">
        {d.semanas ? <RecebidoSemanas semanas={d.semanas} /> : null}
        <Funil funil={d.funil} />
      </section>
    </>
  );
}

function CartaoMeta({ d }: { d: PainelDono }) {
  const r = d.ritmo!;
  const progresso = Math.min(100, (r.recebido / d.meta.valor) * 100);
  const pct = r.pct == null ? null : Math.round(r.pct * 100);
  return (
    <Link
      to="/financeiro"
      className="grid gap-4 rounded-xl bg-[#0F1729] px-5 py-5 text-white transition hover:bg-[#141e33] sm:px-6 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)] lg:items-center lg:gap-8"
    >
      <div className="min-w-0 space-y-3">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
          <span className="text-[12.5px] font-medium text-[#B7C0D1]">
            Meta de 90 dias · {d.meta.inicio.slice(8, 10)}/{d.meta.inicio.slice(5, 7)} a{" "}
            {d.meta.fim.slice(8, 10)}/{d.meta.fim.slice(5, 7)}
          </span>
          {pct != null ? (
            <span
              className={cn(
                "whitespace-nowrap rounded-full px-2 py-0.5 text-[11.5px] font-semibold",
                pct >= 100
                  ? "bg-emerald-400/15 text-emerald-200"
                  : "bg-[#FF9952]/15 text-[#FFD3B0]",
              )}
            >
              {pct}% do ritmo necessário
            </span>
          ) : null}
        </div>
        <div className="flex flex-wrap items-baseline gap-x-2.5 gap-y-1">
          <span className="font-display tabular text-[30px] font-bold leading-none tracking-[-0.03em] sm:text-[36px]">
            {brl(r.recebido)}
          </span>
          <span className="text-[14px] text-[#B7C0D1]">de {brl(d.meta.valor)}</span>
        </div>
        <div className="h-2 overflow-hidden rounded-full bg-white/[0.12]">
          <div
            className="h-full rounded-full bg-[#5B8CFF]"
            style={{ width: `${Math.max(1, progresso)}%` }}
          />
        </div>
      </div>
      <dl className="grid grid-cols-3 gap-3 border-t border-white/10 pt-3.5 lg:border-l lg:border-t-0 lg:pl-8 lg:pt-0">
        {[
          ["Ritmo atual/mês", brl(r.ritmoMes)],
          ["Precisa/mês", brl(r.necessarioMes)],
          ["Faltam", `${d.meta.diasRestantes} dias`],
        ].map(([rotulo, valor]) => (
          <div key={rotulo} className="min-w-0">
            <dt className="truncate text-[11.5px] text-[#B7C0D1]">{rotulo}</dt>
            <dd className="tabular mt-0.5 truncate text-[14px] font-semibold sm:text-[15px]">
              {valor}
            </dd>
          </div>
        ))}
      </dl>
    </Link>
  );
}

function RecebidoSemanas({ semanas }: { semanas: NonNullable<PainelDono["semanas"]> }) {
  const maior = Math.max(1, ...semanas.map((s) => s.valor));
  const total = semanas.reduce((s, x) => s + x.valor, 0);
  return (
    <Cartao
      titulo="Vendido por semana"
      sub={`${brl(total)} no mês`}
      extra={<span className="text-[12px] text-muted-foreground">este mês</span>}
    >
      <div className="flex h-[168px] items-end gap-3 border-b px-1 sm:gap-5 sm:px-2">
        {semanas.map((s) => (
          <div
            key={s.rotulo}
            className="flex h-full flex-1 flex-col items-center justify-end gap-1.5"
          >
            <span className="tabular text-[11.5px] font-semibold">{brl(s.valor)}</span>
            <div
              className={cn(
                "w-full max-w-[64px] rounded-t-md rounded-b-[2px]",
                s.parcial ? "bg-[#C9D7FF]" : "bg-primary",
              )}
              style={{ height: `${Math.max(4, Math.round((s.valor / maior) * 128))}px` }}
            />
          </div>
        ))}
      </div>
      <div className="flex gap-3 px-1 pt-2 sm:gap-5 sm:px-2">
        {semanas.map((s) => (
          <span key={s.rotulo} className="flex-1 text-center text-[11.5px] text-muted-foreground">
            {s.rotulo}
          </span>
        ))}
      </div>
    </Cartao>
  );
}

function Funil({ funil }: { funil: PainelDono["funil"] }) {
  const base = Math.max(1, funil[0]?.qtd ?? 1);
  const pagos = funil[5]?.qtd ?? 0;
  const resp = funil[1]?.qtd ?? 0;
  return (
    <Cartao
      titulo="Funil · últimos 30 dias"
      extra={
        <Link to="/comercial" className="text-[13px] font-semibold text-primary hover:underline">
          Ver detalhes
        </Link>
      }
    >
      <div className="flex flex-col gap-3">
        {funil.map((f, i) => (
          <div
            key={f.etapa}
            className="grid grid-cols-[96px_minmax(0,1fr)_52px] items-center gap-3"
          >
            <span className="text-[13px] text-[#3A4456]">{f.etapa}</span>
            <div className="h-[22px] overflow-hidden rounded-md bg-[#F1F3F7]">
              <div
                className={cn("h-full rounded-md", i === 5 ? "bg-[#0E8A5F]" : "bg-primary")}
                style={{ width: `${Math.max(2, (f.qtd / base) * 100)}%`, opacity: 1 - i * 0.1 }}
              />
            </div>
            <span className="tabular text-right text-[13px] font-semibold">
              {f.qtd.toLocaleString("pt-BR")}
            </span>
          </div>
        ))}
      </div>
      <p className="mt-4 text-[13px] text-muted-foreground">
        De cada 100 abordados,{" "}
        <b className="text-foreground">
          {Math.round((pagos / base) * 100)} paga{Math.round((pagos / base) * 100) === 1 ? "" : "m"}
        </b>
        . {resp / base < 0.4 ? "O maior vazamento é entre abordar e a pessoa responder." : ""}
      </p>
    </Cartao>
  );
}

type Aba = "cobrar" | "produzir" | "retomar";

const ABAS: Record<Aba, { nome: string; acao: string; dica: string; vazio: string }> = {
  cobrar: {
    nome: "Cobrar",
    acao: "Cobrar",
    dica: "Fecharam e ainda não pagaram. Mande o link de pagamento hoje.",
    vazio: "Ninguém para cobrar.",
  },
  produzir: {
    nome: "Produzir",
    acao: "Abrir",
    dica: "Vendidos e ainda não publicados. Pagos sempre primeiro.",
    vazio: "Fila de produção vazia.",
  },
  retomar: {
    nome: "Retomar",
    acao: "Retomar",
    dica: "Responderam e esfriaram (3+ dias parados). Os de maior valor primeiro.",
    vazio: "Nenhum negócio parado.",
  },
};

function FocoDeHoje({ d, onAbrir }: { d: PainelDono; onAbrir: (id: string) => void }) {
  const listas: Record<Aba, ItemLista[]> = {
    cobrar: d.cobrancas,
    produzir: d.producao,
    retomar: d.followups,
  };
  const ordem: Aba[] = d.admin ? ["cobrar", "produzir", "retomar"] : ["produzir", "retomar"];
  const [aba, setAba] = useState<Aba>(ordem[0]);
  const [todos, setTodos] = useState(false);
  const itens = listas[aba];
  const cfg = ABAS[aba];
  return (
    <Cartao titulo="Foco de hoje" sub={cfg.dica} colado>
      <div className="px-4 sm:px-5">
        <Abas
          valor={aba}
          onChange={setAba}
          rotulo="Lista"
          opcoes={ordem.map((k) => ({
            valor: k,
            rotulo: ABAS[k].nome,
            contagem: listas[k].length,
          }))}
        />
      </div>
      <ListaFoco itens={itens.slice(0, 6)} acao={cfg.acao} onAbrir={onAbrir} vazio={cfg.vazio} />
      {itens.length > 6 ? (
        <button
          type="button"
          onClick={() => setTodos(true)}
          className="flex h-11 items-center justify-center gap-1 border-t text-[13px] font-semibold text-primary transition hover:bg-[#F8FAFF]"
        >
          Ver todos ({itens.length}) <ChevronRight className="h-4 w-4" />
        </button>
      ) : (
        <div className="h-1.5" />
      )}

      <Sheet open={todos} onOpenChange={setTodos}>
        <SheetContent className="flex w-full flex-col gap-0 p-0 sm:max-w-[560px]">
          <div className="border-b px-5 py-4 pr-12">
            <SheetTitle className="text-[17px]">
              {cfg.nome} · {itens.length}
            </SheetTitle>
            <p className="mt-1 text-[13px] text-muted-foreground">{cfg.dica}</p>
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto pb-6">
            <ListaFoco
              itens={itens}
              acao={cfg.acao}
              vazio={cfg.vazio}
              onAbrir={(id) => {
                setTodos(false);
                onAbrir(id);
              }}
            />
          </div>
        </SheetContent>
      </Sheet>
    </Cartao>
  );
}

function ListaFoco({
  itens,
  acao,
  vazio,
  onAbrir,
}: {
  itens: ItemLista[];
  acao: string;
  vazio: string;
  onAbrir: (id: string) => void;
}) {
  if (!itens.length)
    return <p className="px-5 py-10 text-center text-[13px] text-muted-foreground">{vazio}</p>;
  return (
    <ul className="mt-1">
      {itens.map((i) => (
        <li key={i.id} className="border-t border-[#EEF0F4] first:border-t-0">
          <button
            type="button"
            onClick={() => onAbrir(i.id)}
            className="group flex w-full items-center gap-3 px-4 py-3 text-left transition hover:bg-[#F8FAFF] sm:px-5"
          >
            <span
              className={cn(
                "flex h-9 w-9 shrink-0 items-center justify-center rounded-[10px] text-[12px] font-bold",
                i.alerta ? "bg-[#FFF1E6] text-[#A3400A]" : "bg-[#EEF3FF] text-primary",
              )}
            >
              {iniciais(i.titulo)}
            </span>
            <span className="flex min-w-0 flex-1 flex-col gap-0.5">
              <span className="truncate text-[14px] font-semibold group-hover:text-primary">
                {i.titulo}
              </span>
              <span className="truncate text-[12.5px] text-muted-foreground">{i.detalhe}</span>
            </span>
            {i.valor ? (
              <span className="font-display tabular shrink-0 text-[14px] font-semibold">
                {brl(i.valor)}
              </span>
            ) : null}
            <span className="hidden h-8 shrink-0 items-center rounded-[9px] border border-input bg-card px-3 text-[12.5px] font-semibold transition group-hover:border-primary/40 sm:inline-flex">
              {acao}
            </span>
            <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground sm:hidden" />
          </button>
        </li>
      ))}
    </ul>
  );
}

/** O que falta para os números ficarem completos + alertas que não estão nas listas. */
function Atencao({ d }: { d: PainelDono }) {
  const pendentes = d.comecar
    .filter((c) => !c.feito)
    .map((c) => ({ id: c.id, texto: c.texto, link: c.link, forte: true }));
  const outros = d.alertas
    .filter((a) => !["cobranca", "producao", "followup"].includes(a.id))
    .map((a) => ({ id: a.id, texto: a.titulo, link: a.link, forte: a.nivel === "alto" }));
  const linhas = [...pendentes, ...outros].slice(0, 6);
  if (!linhas.length) return null;
  return (
    <Cartao
      titulo="Para destravar os números"
      sub="Sem isso, lucro e caixa ficam incompletos."
      colado
    >
      <ul className="pb-1">
        {linhas.map((l) => (
          <li key={l.id} className="border-t border-[#EEF0F4] first:border-t-0">
            <Link
              to={l.link}
              className="group flex items-center gap-3 px-4 py-3 transition hover:bg-[#F8FAFF] sm:px-5"
            >
              <span
                className={cn(
                  "h-2 w-2 shrink-0 rounded-full",
                  l.forte ? "bg-[#C2410C]" : "bg-[#D9A400]",
                )}
              />
              <span className="min-w-0 flex-1 text-[13.5px] leading-snug">{l.texto}</span>
              <span className="shrink-0 text-[12.5px] font-semibold text-primary group-hover:underline">
                Resolver
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </Cartao>
  );
}

function Agenda({ d }: { d: PainelDono }) {
  const total = d.agenda.reduce((s, a) => s + a.qtd, 0);
  return (
    <Cartao
      titulo="Próximas publicações"
      sub={`${total} ${total === 1 ? "conteúdo" : "conteúdos"} nos próximos ${d.agenda.length} dias`}
      extra={
        <Link to="/calendario" className="text-[12.5px] font-semibold text-primary hover:underline">
          Calendário
        </Link>
      }
    >
      <ol
        className="grid overflow-hidden rounded-lg border"
        style={{ gridTemplateColumns: `repeat(${Math.max(1, d.agenda.length)}, minmax(0, 1fr))` }}
      >
        {d.agenda.map((a, i) => (
          <li
            key={a.dia}
            className={cn(
              "border-l px-2 py-2.5 text-center first:border-l-0",
              i === 0 && "bg-[#F5F8FF]",
            )}
          >
            <span
              className={cn(
                "block truncate text-[11.5px] font-medium",
                i === 0 ? "text-primary" : "text-muted-foreground",
              )}
            >
              {a.rotulo}
            </span>
            <span
              className={cn(
                "font-display tabular mt-0.5 block text-[18px] font-semibold leading-tight",
                !a.qtd && "text-[#B5BCC8]",
              )}
            >
              {a.qtd}
            </span>
          </li>
        ))}
      </ol>
    </Cartao>
  );
}
