import { useMemo, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { ArrowRight, ChevronDown, RefreshCw } from "lucide-react";

import { useCrm } from "@/components/crm/context";
import { CabecalhoPagina, Carregando, Erro, Secao, Vazio } from "@/components/crm/ui";
import { Button } from "@/components/ui/button";
import type { CrmEtapa, CrmFunil } from "@/lib/crm/types";
import { fmtDataHora, fmtMoeda, fmtNum } from "@/lib/crm/utils";
import { getVerticais, type EtapaResumo, type VisaoVerticais } from "@/lib/crm/verticais.functions";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_crm/verticais")({
  validateSearch: (s: Record<string, unknown>): { v?: string } =>
    typeof s.v === "string" && s.v ? { v: s.v } : {},
  component: VerticaisPage,
});

/* Verticais da IA News: cada vertical agrupa os seus funis; cada funil mostra as etapas na ordem,
   quantos negócios há em cada uma e o que se moveu nos últimos 7 dias. Clique leva ao quadro. */

const VERTICAIS: { nome: string; papel: string }[] = [
  {
    nome: "Ativação e base",
    papel: "Leva cada lead da base a uma vertical, entregando valor antes de vender.",
  },
  {
    nome: "Publicidade",
    papel: "Produto: matérias de destaque e planos Presença, Autoridade e Patrocínio.",
  },
  {
    nome: "Eventos",
    papel:
      "Produto: Palco presencial em BH (11/02/2027), com a Aula e o Palco online como entrada.",
  },
  { nome: "Conselho", papel: "Produto: Conselho IA News, com a Lista 100 e o Balcão de Projetos." },
  {
    nome: "Parcerias",
    papel: "Distribuição: aceleradoras, hubs, comunidades e eventos parceiros.",
  },
];

type Totais = {
  total: number;
  abertos: number;
  ganhos: number;
  perdidos: number;
  valorAberto: number;
  valorGanho: number;
  atencao: number;
  hoje: number;
  entraram7d: number;
  novos7d: number;
};

function somar(etapas: CrmEtapa[], resumo: Map<string, EtapaResumo>): Totais {
  const t: Totais = {
    total: 0,
    abertos: 0,
    ganhos: 0,
    perdidos: 0,
    valorAberto: 0,
    valorGanho: 0,
    atencao: 0,
    hoje: 0,
    entraram7d: 0,
    novos7d: 0,
  };
  for (const e of etapas) {
    const r = resumo.get(e.id);
    if (!r) continue;
    t.total += r.qtd;
    t.entraram7d += r.entraram_7d;
    t.novos7d += r.novos_7d;
    if (e.tipo === "aberta") {
      t.abertos += r.qtd;
      t.valorAberto += r.valor;
      t.atencao += r.atencao;
      t.hoje += r.hoje;
    } else if (e.tipo === "ganha") {
      t.ganhos += r.qtd;
      t.valorGanho += r.valor;
    } else t.perdidos += r.qtd;
  }
  return t;
}

function VerticaisPage() {
  const { funis, etapasDo, funilNome } = useCrm();
  const fetchVisao = useServerFn(getVerticais);
  const { v } = Route.useSearch();
  const navigate = Route.useNavigate();
  const [verMov, setVerMov] = useState(false);
  const { data, isLoading, error, refetch, isFetching } = useQuery({
    queryKey: ["crm", "verticais"],
    queryFn: () => fetchVisao(),
    refetchInterval: 5 * 60_000,
  });

  const resumo = useMemo(() => new Map((data?.etapas ?? []).map((e) => [e.etapa_id, e])), [data]);

  const grupos = useMemo(() => {
    const ativos = funis.filter((f) => f.ativo).sort((a, b) => a.ordem - b.ordem);
    const lista = VERTICAIS.map((vv) => ({
      ...vv,
      funis: ativos.filter((f) => f.vertical === vv.nome),
    }));
    const outros = ativos.filter((f) => !VERTICAIS.some((vv) => vv.nome === f.vertical));
    if (outros.length)
      lista.push({
        nome: "Outros funis",
        papel: "Funis ainda sem vertical definida.",
        funis: outros,
      });
    return lista.filter((g) => g.funis.length);
  }, [funis]);

  if (isLoading) return <Carregando texto="Montando as verticais..." />;
  if (error || !data) return <Erro erro={error} />;

  const atual = grupos.find((g) => slug(g.nome) === v) ?? grupos[0];
  const totais = (g: (typeof grupos)[number]) =>
    somar(
      g.funis.flatMap((f) => etapasDo(f.id)),
      resumo,
    );
  const t = atual ? totais(atual) : null;
  const recentes = atual
    ? data.recentes.filter((m) => atual.funis.some((f) => f.id === m.funil_id))
    : [];

  return (
    <div className="space-y-5">
      <CabecalhoPagina
        titulo="Verticais"
        descricao="Escolha uma vertical para ver os funis dela, etapa por etapa."
        acoes={
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
        }
      />

      {/* Abas das verticais: rolam de lado no celular, sem mexer no resto da tela. */}
      <nav
        aria-label="Verticais"
        className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 [scrollbar-width:none] sm:mx-0 sm:flex-wrap sm:px-0"
      >
        {grupos.map((g) => {
          const on = g === atual;
          const n = totais(g).abertos;
          return (
            <button
              key={g.nome}
              type="button"
              onClick={() =>
                navigate({ search: { v: slug(g.nome) }, replace: true, resetScroll: false })
              }
              aria-pressed={on}
              className={cn(
                "flex shrink-0 items-center gap-2 rounded-full border px-3.5 py-2 text-[13px] font-semibold transition",
                on
                  ? "border-primary bg-primary text-primary-foreground shadow-sm"
                  : "bg-card text-foreground hover:border-primary/50",
              )}
            >
              {g.nome}
              <span
                className={cn(
                  "tabular rounded-full px-1.5 text-[11px]",
                  on ? "bg-white/20" : "bg-muted text-muted-foreground",
                )}
              >
                {fmtNum(n)}
              </span>
            </button>
          );
        })}
      </nav>

      {atual && t ? (
        <>
          <section className="rounded-xl border bg-card p-4 shadow-[var(--shadow-card)] sm:p-5">
            <p className="text-sm text-muted-foreground">{atual.papel}</p>
            <dl className="mt-4 grid grid-cols-2 gap-4 sm:grid-cols-4">
              <Mini rotulo="Em andamento" valor={fmtNum(t.abertos)} />
              <Mini rotulo="Ganhos" valor={fmtNum(t.ganhos)} tom="ok" />
              <Mini
                rotulo="Atrasados"
                valor={fmtNum(t.atencao)}
                tom={t.atencao ? "alerta" : undefined}
              />
              <Mini rotulo="Receita" valor={fmtMoeda(t.valorGanho)} />
            </dl>
          </section>

          <div className="space-y-4">
            {atual.funis.map((f) => (
              <FunilCartao
                key={f.id}
                funil={f}
                etapas={etapasDo(f.id)}
                resumo={resumo}
                atividade={data.atividade7d[f.id]}
              />
            ))}
          </div>

          <div>
            <button
              type="button"
              onClick={() => setVerMov((x) => !x)}
              className="flex items-center gap-1 text-sm font-semibold text-primary hover:underline"
            >
              {verMov ? "Esconder" : "Ver"} movimentações recentes ({recentes.length})
              <ChevronDown className={cn("h-4 w-4 transition", verMov && "rotate-180")} />
            </button>
            {verMov ? (
              <div className="mt-3">
                <Recentes recentes={recentes} funilNome={funilNome} />
              </div>
            ) : null}
          </div>
        </>
      ) : (
        <Vazio>Nenhum funil ativo.</Vazio>
      )}
    </div>
  );
}

function Mini({ rotulo, valor, tom }: { rotulo: string; valor: string; tom?: "ok" | "alerta" }) {
  return (
    <div>
      <dt className="text-[11.5px] font-medium text-muted-foreground">{rotulo}</dt>
      <dd
        className={cn(
          "tabular mt-0.5 text-[22px] font-semibold tracking-[-0.02em]",
          tom === "ok" && "text-emerald-600",
          tom === "alerta" && "text-destructive",
        )}
      >
        {valor}
      </dd>
    </div>
  );
}

function FunilCartao({
  funil,
  etapas,
  resumo,
  atividade,
}: {
  funil: CrmFunil;
  etapas: CrmEtapa[];
  resumo: Map<string, EtapaResumo>;
  atividade?: VisaoVerticais["atividade7d"][string];
}) {
  const t = somar(etapas, resumo);
  const max = Math.max(1, ...etapas.map((e) => resumo.get(e.id)?.qtd ?? 0));
  const comNegocios = etapas.filter((e) => (resumo.get(e.id)?.qtd ?? 0) > 0);
  const [todas, setTodas] = useState(false);
  const lista = todas ? etapas : comNegocios;
  return (
    <section className="min-w-0 rounded-xl border bg-card shadow-[var(--shadow-card)]">
      <header className="flex items-start justify-between gap-3 border-b px-4 py-3 sm:px-5">
        <div className="min-w-0">
          <h3 className="text-[15px] font-semibold">{funil.nome}</h3>
          <p className="mt-0.5 text-xs text-muted-foreground">
            {fmtNum(t.abertos)} em andamento · {fmtNum(t.ganhos)} ganhos
            {t.atencao ? (
              <span className="text-destructive"> · {fmtNum(t.atencao)} atrasados</span>
            ) : null}
          </p>
        </div>
        <Link
          to="/negocios"
          search={{ funil: funil.id }}
          className="flex shrink-0 items-center gap-1 rounded-lg border px-2.5 py-1.5 text-xs font-semibold text-primary transition hover:border-primary"
        >
          Abrir quadro <ArrowRight className="h-3.5 w-3.5" />
        </Link>
      </header>
      {t.total ? (
        <ol className="divide-y">
          {lista.map((e) => {
            const r = resumo.get(e.id);
            const qtd = r?.qtd ?? 0;
            return (
              <li key={e.id}>
                <Link
                  to="/negocios"
                  search={{ funil: funil.id }}
                  title={e.criterio_entrada ?? e.nome}
                  className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-4 gap-y-1.5 px-4 py-2.5 transition hover:bg-[#f8faff] sm:grid-cols-[minmax(140px,220px)_1fr_auto] sm:px-5"
                >
                  <span className="truncate text-[13px] font-medium">{e.nome}</span>
                  <span className="order-3 col-span-2 h-1.5 overflow-hidden rounded-full bg-muted sm:order-none sm:col-span-1">
                    <span
                      className={cn(
                        "block h-full rounded-full",
                        e.tipo === "ganha"
                          ? "bg-emerald-500"
                          : e.tipo === "perdida"
                            ? "bg-muted-foreground/40"
                            : "bg-primary",
                      )}
                      style={{ width: `${(qtd / max) * 100}%` }}
                    />
                  </span>
                  <span className="text-right">
                    <span className="tabular text-[14px] font-semibold">{fmtNum(qtd)}</span>
                    {r?.entraram_7d ? (
                      <span className="ml-1.5 text-[11px] text-emerald-600">
                        +{fmtNum(r.entraram_7d)}
                      </span>
                    ) : null}
                  </span>
                </Link>
              </li>
            );
          })}
        </ol>
      ) : (
        <p className="px-5 py-4 text-sm text-muted-foreground">Nenhum negócio neste funil ainda.</p>
      )}
      <footer className="flex flex-wrap items-center justify-between gap-2 border-t px-4 py-2 text-[11.5px] text-muted-foreground sm:px-5">
        <span>
          7 dias: {fmtNum(t.novos7d)} novos · {fmtNum(atividade?.enviadas ?? 0)} mensagens ·{" "}
          {fmtNum(atividade?.recebidas ?? 0)} respostas
        </span>
        {comNegocios.length < etapas.length ? (
          <button
            type="button"
            onClick={() => setTodas((x) => !x)}
            className="font-semibold text-primary hover:underline"
          >
            {todas ? "Só etapas com negócios" : `Ver todas as ${etapas.length} etapas`}
          </button>
        ) : null}
      </footer>
    </section>
  );
}

const ROTULO_TIPO: Record<string, string> = {
  mudanca_etapa: "Mudou de etapa",
  mensagem_enviada: "Mensagem enviada",
  mensagem_recebida: "Respondeu",
};

function Recentes({
  recentes,
  funilNome,
}: {
  recentes: VisaoVerticais["recentes"];
  funilNome: (id?: string | null) => string;
}) {
  return (
    <Secao titulo="Movimentações recentes">
      {recentes.length ? (
        <ol className="max-h-[60vh] space-y-3 overflow-y-auto pr-1">
          {recentes.map((m) => (
            <li key={m.id} className="border-l-2 border-primary/40 pl-3 text-sm">
              <p className="text-[11px] text-muted-foreground">
                {fmtDataHora(m.created_at)} · {funilNome(m.funil_id)}
              </p>
              {m.negocio_id ? (
                <Link
                  to="/negocios"
                  search={{ funil: m.funil_id ?? undefined, negocio: m.negocio_id }}
                  className="font-semibold hover:text-primary"
                >
                  {m.titulo ?? "Negócio"}
                </Link>
              ) : null}
              <p className="text-xs text-muted-foreground">
                {ROTULO_TIPO[m.tipo] ?? m.tipo}
                {m.tipo === "mudanca_etapa" && m.texto ? `: ${m.texto}` : ""}
              </p>
            </li>
          ))}
        </ol>
      ) : (
        <Vazio>Nada se moveu nos últimos 7 dias.</Vazio>
      )}
    </Secao>
  );
}

function slug(s: string) {
  return s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-");
}
