import { useMemo } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { ArrowRight, RefreshCw } from "lucide-react";

import { useCrm } from "@/components/crm/context";
import { CabecalhoPagina, Carregando, Erro, Secao, Vazio } from "@/components/crm/ui";
import { Button } from "@/components/ui/button";
import type { CrmEtapa, CrmFunil } from "@/lib/crm/types";
import { fmtDataHora, fmtMoeda, fmtNum } from "@/lib/crm/utils";
import { getVerticais, type EtapaResumo, type VisaoVerticais } from "@/lib/crm/verticais.functions";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_crm/verticais")({
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
  const { data, isLoading, error, refetch, isFetching } = useQuery({
    queryKey: ["crm", "verticais"],
    queryFn: () => fetchVisao(),
    refetchInterval: 5 * 60_000,
  });

  const resumo = useMemo(() => new Map((data?.etapas ?? []).map((e) => [e.etapa_id, e])), [data]);

  const grupos = useMemo(() => {
    const ativos = funis.filter((f) => f.ativo).sort((a, b) => a.ordem - b.ordem);
    const lista = VERTICAIS.map((v) => ({
      ...v,
      funis: ativos.filter((f) => f.vertical === v.nome),
    }));
    const outros = ativos.filter((f) => !VERTICAIS.some((v) => v.nome === f.vertical));
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

  return (
    <div className="space-y-6">
      <CabecalhoPagina
        titulo="Verticais"
        descricao="Todas as verticais da IA News num lugar: cada funil com as suas etapas, quantos negócios há em cada uma e o que se moveu nos últimos 7 dias. Clique numa etapa para abrir o quadro."
        acoes={
          <Button
            variant="outline"
            size="sm"
            className="h-9"
            onClick={() => refetch()}
            disabled={isFetching}
          >
            <RefreshCw className={cn("mr-1.5 h-4 w-4", isFetching && "animate-spin")} /> Atualizar
          </Button>
        }
      />

      <section
        className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5"
        aria-label="Resumo das verticais"
      >
        {grupos.map((g) => {
          const t = somar(
            g.funis.flatMap((f) => etapasDo(f.id)),
            resumo,
          );
          const mov = g.funis.reduce((s, f) => s + (data.atividade7d[f.id]?.movidos ?? 0), 0);
          return (
            <a
              key={g.nome}
              href={`#v-${slug(g.nome)}`}
              className="rounded-[var(--radius)] border bg-card p-4 transition hover:border-primary"
            >
              <p className="font-mono-eyebrow text-primary">{g.nome}</p>
              <p className="mt-1 text-2xl font-extrabold tracking-tight">{fmtNum(t.abertos)}</p>
              <p className="text-xs text-muted-foreground">em andamento</p>
              <dl className="mt-3 grid grid-cols-2 gap-x-3 gap-y-1 text-xs">
                <dt className="text-muted-foreground">Ganhos</dt>
                <dd className="text-right font-semibold">{fmtNum(t.ganhos)}</dd>
                <dt className="text-muted-foreground">Movidos 7d</dt>
                <dd className="text-right font-semibold">{fmtNum(mov)}</dd>
                <dt className="text-muted-foreground">Para hoje</dt>
                <dd className="text-right font-semibold">{fmtNum(t.hoje)}</dd>
                <dt className="text-muted-foreground">Atrasados</dt>
                <dd className={cn("text-right font-semibold", t.atencao && "text-destructive")}>
                  {fmtNum(t.atencao)}
                </dd>
                {t.valorGanho || t.valorAberto ? (
                  <>
                    <dt className="text-muted-foreground">Receita</dt>
                    <dd className="text-right font-semibold">{fmtMoeda(t.valorGanho)}</dd>
                  </>
                ) : null}
              </dl>
            </a>
          );
        })}
      </section>

      <div className="grid gap-6 2xl:grid-cols-[1fr_340px]">
        <div className="space-y-6">
          {grupos.map((g) => (
            <section key={g.nome} id={`v-${slug(g.nome)}`} className="scroll-mt-24 space-y-3">
              <div>
                <h2 className="text-lg font-extrabold tracking-tight">{g.nome}</h2>
                <p className="text-sm text-muted-foreground">{g.papel}</p>
              </div>
              {g.funis.map((f) => (
                <FunilCartao
                  key={f.id}
                  funil={f}
                  etapas={etapasDo(f.id)}
                  resumo={resumo}
                  atividade={data.atividade7d[f.id]}
                />
              ))}
            </section>
          ))}
        </div>
        <Recentes recentes={data.recentes} funilNome={funilNome} />
      </div>
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
  return (
    <div className="rounded-[var(--radius)] border bg-card">
      <header className="flex flex-wrap items-start justify-between gap-3 border-b px-4 py-3">
        <div className="min-w-0">
          <h3 className="font-bold">{funil.nome}</h3>
          {funil.descricao ? (
            <p className="text-xs text-muted-foreground">{funil.descricao}</p>
          ) : null}
        </div>
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs">
          <span>
            <b className="text-sm">{fmtNum(t.abertos)}</b> em andamento
          </span>
          <span>
            <b className="text-sm text-emerald-600">{fmtNum(t.ganhos)}</b> ganhos
          </span>
          {t.valorGanho ? (
            <span>
              <b className="text-sm">{fmtMoeda(t.valorGanho)}</b> fechado
            </span>
          ) : null}
          {t.valorAberto ? (
            <span>
              <b className="text-sm">{fmtMoeda(t.valorAberto)}</b> em negociação
            </span>
          ) : null}
          <span className={cn(t.atencao && "text-destructive")}>
            <b className="text-sm">{fmtNum(t.atencao)}</b> atrasados
          </span>
          <Link
            to="/negocios"
            search={{ funil: funil.id }}
            className="flex items-center gap-1 font-semibold text-primary hover:underline"
          >
            Abrir quadro <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        </div>
      </header>
      {t.total ? (
        <div className="overflow-x-auto p-3">
          <ol className="flex min-w-max gap-2">
            {etapas.map((e) => {
              const r = resumo.get(e.id);
              const qtd = r?.qtd ?? 0;
              return (
                <li key={e.id}>
                  <Link
                    to="/negocios"
                    search={{ funil: funil.id }}
                    title={e.criterio_entrada ?? e.nome}
                    className={cn(
                      "flex h-full w-[132px] flex-col rounded-lg border p-2.5 transition hover:border-primary",
                      e.tipo === "ganha" &&
                        "border-emerald-500/40 bg-emerald-50/60 dark:bg-emerald-950/20",
                      e.tipo === "perdida" && "bg-muted/50 text-muted-foreground",
                      !qtd && "opacity-60",
                    )}
                  >
                    <span className="line-clamp-2 min-h-[2rem] text-[11px] font-semibold leading-tight">
                      {e.nome}
                    </span>
                    <span className="mt-1 text-xl font-extrabold tracking-tight">
                      {fmtNum(qtd)}
                    </span>
                    <span className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-muted">
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
                    <span className="mt-1.5 space-y-0.5 text-[10.5px] text-muted-foreground">
                      {r?.entraram_7d ? (
                        <span className="block">+{fmtNum(r.entraram_7d)} em 7 dias</span>
                      ) : null}
                      {e.tipo === "aberta" && r?.hoje ? (
                        <span className="block font-semibold text-primary">
                          {fmtNum(r.hoje)} para hoje
                        </span>
                      ) : null}
                      {r?.valor ? <span className="block">{fmtMoeda(r.valor)}</span> : null}
                    </span>
                  </Link>
                </li>
              );
            })}
          </ol>
        </div>
      ) : (
        <p className="px-4 py-5 text-sm text-muted-foreground">Nenhum negócio neste funil ainda.</p>
      )}
      <footer className="flex flex-wrap gap-x-5 gap-y-1 border-t px-4 py-2 text-[11px] text-muted-foreground">
        <span>Últimos 7 dias:</span>
        <span>
          <b className="text-foreground">{fmtNum(t.novos7d)}</b> novos
        </span>
        <span>
          <b className="text-foreground">{fmtNum(atividade?.movidos ?? 0)}</b> mudanças de etapa
        </span>
        <span>
          <b className="text-foreground">{fmtNum(atividade?.enviadas ?? 0)}</b> mensagens enviadas
        </span>
        <span>
          <b className="text-foreground">{fmtNum(atividade?.recebidas ?? 0)}</b> respostas
        </span>
      </footer>
    </div>
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
    <Secao titulo="Movimentações recentes" className="h-fit 2xl:sticky 2xl:top-20">
      {recentes.length ? (
        <ol className="max-h-[75vh] space-y-3 overflow-y-auto pr-1">
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
