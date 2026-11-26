import { useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { CalendarCheck, Plus, Search } from "lucide-react";

import { useCrm } from "@/components/crm/context";
import { TarefaDialog } from "@/components/crm/dialogs";
import { NegocioDialog, NegocioPainel } from "@/components/crm/negocio";
import { Carregando, Erro } from "@/components/crm/ui";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import { getPainelDono, type ItemLista, type PainelDono } from "@/lib/crm/metricas.functions";
import { hojeBR } from "@/lib/crm/utils";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_crm/")({
  component: InicioPage,
});

/* Início (protótipo aprovado em 26/11): "estou no ritmo da meta?" e "o que faço hoje?".
   A meta em destaque, 3 números, recebido por semana, o funil, o foco do dia
   (cobrar, produzir, retomar) e o que falta para os números ficarem completos. */

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
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="mb-1 text-[13px] text-muted-foreground">
            {dataLonga.charAt(0).toUpperCase() + dataLonga.slice(1)}
          </p>
          <h1 className="font-display text-[26px] font-bold leading-tight tracking-[-0.02em] sm:text-[30px]">
            {saudacao()}
            {primeiroNome ? `, ${primeiroNome}` : ""}
          </h1>
        </div>
        <div className="flex flex-wrap items-center gap-2.5">
          <button
            type="button"
            onClick={() => window.dispatchEvent(new Event("crm-abrir-busca"))}
            className="hidden h-[38px] w-[300px] items-center gap-2 rounded-[10px] border border-input bg-card px-3 text-left text-[14px] text-muted-foreground transition hover:border-primary/40 md:flex"
          >
            <Search className="h-4 w-4" /> Buscar pessoa, empresa ou negócio
          </button>
          <Button variant="outline" className="h-[38px]" onClick={() => setNovaTarefa(true)}>
            <CalendarCheck className="h-4 w-4" /> Tarefa
          </Button>
          <Button className="h-[38px]" onClick={() => setNovoNegocio(true)}>
            <Plus className="h-4 w-4" /> Novo
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
  return (
    <>
      <section aria-label="Números do negócio" className="flex flex-wrap gap-4">
        {d.admin && d.ritmo ? <CartaoMeta d={d} /> : null}
        {d.admin ? (
          <>
            <Kpi
              rotulo="Recebido no mês"
              valor={brl(d.recebidoMes)}
              detalhe={d.recebidoMesQtd != null ? `${d.recebidoMesQtd} pagamentos` : undefined}
              tom="ok"
              link="/financeiro"
            />
            <Kpi
              rotulo="A receber"
              valor={brl(d.receber?.valor)}
              detalhe={d.receber ? `${d.receber.qtd} cobranças abertas` : undefined}
              tom={d.receber?.qtd ? "alerta" : undefined}
              link="/financeiro"
            />
          </>
        ) : (
          <Kpi
            rotulo="Pagos parados na produção"
            valor={brl(d.travado.valor)}
            detalhe={`${d.travado.qtd} aguardando`}
            tom={d.travado.qtd ? "alerta" : undefined}
            link="/operacao"
          />
        )}
        <Kpi
          rotulo="Pipeline provável"
          valor={brl(d.pipeline.ponderado)}
          detalhe={`de ${brl(d.pipeline.bruto)} em negociação`}
          link="/negocios"
        />
      </section>

      <section className="flex flex-wrap gap-4">
        {d.semanas ? <RecebidoSemanas semanas={d.semanas} /> : null}
        <Funil funil={d.funil} />
      </section>

      <section className="flex flex-wrap gap-4">
        <FocoDeHoje d={d} onAbrir={onAbrir} />
        <div className="flex min-w-0 flex-[2_1_340px] flex-col gap-4">
          <Atencao d={d} />
          <Agenda d={d} />
        </div>
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
      className="flex min-w-0 flex-[2_1_440px] flex-col gap-[18px] rounded-2xl bg-[#0F1729] px-7 py-6 text-white transition hover:bg-[#141e33]"
    >
      <div className="flex items-center justify-between gap-3">
        <span className="text-[13px] font-medium text-[#B7C0D1]">
          Meta de 90 dias · {d.meta.inicio.slice(8, 10)}/{d.meta.inicio.slice(5, 7)} a{" "}
          {d.meta.fim.slice(8, 10)}/{d.meta.fim.slice(5, 7)}
        </span>
        {pct != null ? (
          <span
            className={cn(
              "whitespace-nowrap rounded-full px-2.5 py-1 text-[12px] font-semibold",
              pct >= 100 ? "bg-emerald-400/15 text-emerald-200" : "bg-[#FF9952]/15 text-[#FFD3B0]",
            )}
          >
            {pct}% do ritmo necessário
          </span>
        ) : null}
      </div>
      <div className="flex flex-wrap items-baseline gap-3">
        <span className="font-display tabular text-[38px] font-bold leading-none tracking-[-0.03em] sm:text-[44px]">
          {brl(r.recebido)}
        </span>
        <span className="text-[15px] text-[#B7C0D1]">de {brl(d.meta.valor)}</span>
      </div>
      <div className="h-2.5 overflow-hidden rounded-full bg-white/[0.12]">
        <div
          className="h-full rounded-full bg-[#5B8CFF]"
          style={{ width: `${Math.max(1, progresso)}%` }}
        />
      </div>
      <div className="flex flex-wrap gap-x-7 gap-y-1 text-[13px] text-[#B7C0D1]">
        <span>
          Ritmo atual <b className="font-semibold text-white">{brl(r.ritmoMes)}/mês</b>
        </span>
        <span>
          Necessário <b className="font-semibold text-white">{brl(r.necessarioMes)}/mês</b>
        </span>
        <span>
          Faltam <b className="font-semibold text-white">{d.meta.diasRestantes} dias</b>
        </span>
      </div>
    </Link>
  );
}

function Kpi({
  rotulo,
  valor,
  detalhe,
  tom,
  link,
}: {
  rotulo: string;
  valor: string;
  detalhe?: string;
  tom?: "ok" | "alerta";
  link: string;
}) {
  return (
    <Link
      to={link}
      className="flex min-w-0 flex-[1_1_200px] flex-col gap-2.5 rounded-2xl border bg-card px-6 py-[22px] transition hover:border-[#C9D7FF]"
    >
      <span className="text-[13px] font-medium text-muted-foreground">{rotulo}</span>
      <span className="font-display tabular text-[30px] font-bold leading-none tracking-[-0.02em]">
        {valor}
      </span>
      {detalhe ? (
        <span
          className={cn(
            "text-[13px] text-muted-foreground",
            tom === "ok" && "font-semibold text-[#0E7A55]",
            tom === "alerta" && "font-semibold text-[#B4530A]",
          )}
        >
          {detalhe}
        </span>
      ) : null}
    </Link>
  );
}

function Cartao({
  titulo,
  extra,
  className,
  children,
}: {
  titulo: string;
  extra?: React.ReactNode;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div className={cn("min-w-0 rounded-2xl border bg-card p-6", className)}>
      <div className="mb-5 flex items-center justify-between gap-3">
        <h2 className="text-[16px] font-semibold">{titulo}</h2>
        {extra}
      </div>
      {children}
    </div>
  );
}

function RecebidoSemanas({ semanas }: { semanas: NonNullable<PainelDono["semanas"]> }) {
  const maior = Math.max(1, ...semanas.map((s) => s.valor));
  return (
    <Cartao
      titulo="Recebido por semana"
      extra={<span className="text-[12px] text-muted-foreground">este mês</span>}
      className="flex-[3_1_460px]"
    >
      <div className="flex h-[200px] items-end gap-5 border-b px-2">
        {semanas.map((s) => (
          <div
            key={s.rotulo}
            className="flex h-full flex-1 flex-col items-center justify-end gap-2"
          >
            <span className="tabular text-[12px] font-semibold">{brl(s.valor)}</span>
            <div
              className={cn(
                "w-full max-w-[72px] rounded-t-lg rounded-b-[3px]",
                s.parcial ? "bg-[#C9D7FF]" : "bg-primary",
              )}
              style={{ height: `${Math.max(4, Math.round((s.valor / maior) * 150))}px` }}
            />
          </div>
        ))}
      </div>
      <div className="flex gap-5 px-2 pt-2.5">
        {semanas.map((s) => (
          <span key={s.rotulo} className="flex-1 text-center text-[12px] text-muted-foreground">
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
      className="flex-[2_1_340px]"
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
    <div className="min-w-0 flex-[3_1_460px] rounded-2xl border bg-card p-6">
      <div className="mb-2 flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-[16px] font-semibold">Foco de hoje</h2>
        <div role="tablist" aria-label="Listas do dia" className="flex flex-wrap gap-2">
          {ordem.map((k) => (
            <button
              key={k}
              type="button"
              role="tab"
              aria-selected={k === aba}
              onClick={() => setAba(k)}
              className={cn(
                "inline-flex h-9 items-center gap-2 rounded-full border bg-card px-3.5 text-[13px] font-medium text-[#3A4456] transition hover:border-[#C9D7FF]",
                k === aba && "border-[#0F1729] bg-[#0F1729] text-white hover:border-[#0F1729]",
              )}
            >
              {ABAS[k].nome}
              <span className="tabular opacity-75">{listas[k].length}</span>
            </button>
          ))}
        </div>
      </div>
      <p className="mb-1.5 text-[13px] text-muted-foreground">{cfg.dica}</p>
      <ListaFoco itens={itens.slice(0, 5)} acao={cfg.acao} onAbrir={onAbrir} vazio={cfg.vazio} />
      {itens.length > 5 ? (
        <button
          type="button"
          onClick={() => setTodos(true)}
          className="mt-2 h-10 w-full rounded-[10px] border border-dashed border-[#C7CCD6] text-[13px] font-semibold text-primary transition hover:bg-[#F8FAFF]"
        >
          Ver todos ({itens.length})
        </button>
      ) : null}

      <Sheet open={todos} onOpenChange={setTodos}>
        <SheetContent className="flex w-full flex-col gap-0 p-0 sm:max-w-[560px]">
          <div className="border-b px-6 py-5 pr-12">
            <SheetTitle className="text-[18px]">
              {cfg.nome} · {itens.length}
            </SheetTitle>
            <p className="mt-1 text-[13px] text-muted-foreground">{cfg.dica}</p>
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto px-6 pb-6">
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
    </div>
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
    return <p className="py-10 text-center text-[13px] text-muted-foreground">{vazio}</p>;
  return (
    <ul>
      {itens.map((i) => (
        <li key={i.id} className="flex items-center gap-3.5 border-t border-[#EEF0F4] px-1 py-3.5">
          <span
            className={cn(
              "flex h-9 w-9 shrink-0 items-center justify-center rounded-[10px] text-[12px] font-bold",
              i.alerta ? "bg-[#FFF1E6] text-[#A3400A]" : "bg-[#EEF3FF] text-primary",
            )}
          >
            {iniciais(i.titulo)}
          </span>
          <button
            type="button"
            onClick={() => onAbrir(i.id)}
            className="flex min-w-0 flex-1 flex-col gap-0.5 text-left"
          >
            <span className="truncate text-[14px] font-semibold hover:text-primary">
              {i.titulo}
            </span>
            <span className="truncate text-[12.5px] text-muted-foreground">{i.detalhe}</span>
          </button>
          {i.valor ? (
            <span className="font-display tabular text-[14px] font-semibold">{brl(i.valor)}</span>
          ) : null}
          <button
            type="button"
            onClick={() => onAbrir(i.id)}
            className="h-[34px] shrink-0 rounded-[9px] border border-input bg-card px-3.5 text-[13px] font-semibold transition hover:bg-background"
          >
            {acao}
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
    <div className="rounded-2xl border bg-card p-6">
      <h2 className="mb-1.5 text-[16px] font-semibold">Para destravar os números</h2>
      <p className="mb-2 text-[13px] text-muted-foreground">
        Sem isso, lucro e caixa ficam incompletos.
      </p>
      <ul>
        {linhas.map((l) => (
          <li key={l.id} className="flex items-center gap-3.5 border-t border-[#EEF0F4] py-3">
            <span
              className={cn(
                "h-2 w-2 shrink-0 rounded-full",
                l.forte ? "bg-[#C2410C]" : "bg-[#D9A400]",
              )}
            />
            <span className="min-w-0 flex-1 text-[14px]">{l.texto}</span>
            <Link
              to={l.link}
              className="shrink-0 text-[13px] font-semibold text-primary hover:underline"
            >
              Resolver
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}

function Agenda({ d }: { d: PainelDono }) {
  return (
    <div className="rounded-2xl border bg-card p-6">
      <div className="mb-3.5 flex items-center justify-between">
        <h2 className="text-[16px] font-semibold">Próximas publicações</h2>
        <Link to="/calendario" className="text-[13px] font-semibold text-primary hover:underline">
          Calendário
        </Link>
      </div>
      <div className="grid grid-cols-4 gap-2">
        {d.agenda.map((a, i) => (
          <div
            key={a.dia}
            className={cn("rounded-xl p-3 text-center", i === 0 ? "bg-[#EEF3FF]" : "bg-background")}
          >
            <span
              className={cn(
                "block text-[12px] font-semibold",
                i === 0 ? "text-primary" : "text-muted-foreground",
              )}
            >
              {a.rotulo}
            </span>
            <span className="font-display tabular text-[22px] font-bold">{a.qtd}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
