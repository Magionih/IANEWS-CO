import { useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  AlertTriangle,
  Ban,
  Check,
  Copy,
  ExternalLink,
  Linkedin,
  Instagram,
  Mail,
  MessageCircle,
  PauseCircle,
  PlayCircle,
  RefreshCw,
  SkipForward,
} from "lucide-react";
import { toast } from "sonner";

import { useCrm } from "@/components/crm/context";
import { NegocioPainel } from "@/components/crm/negocio";
import { useAcao } from "@/components/crm/queries";
import { CabecalhoPagina, Carregando, Erro, Numero, Secao, Vazio } from "@/components/crm/ui";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  listFila,
  marcarFila,
  montarFila,
  painelFila,
  salvarConfigFila,
  type FilaCanal,
  type FilaItem,
} from "@/lib/crm/fila.functions";
import { fmtDia, fmtMoeda, fmtNum } from "@/lib/crm/utils";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_crm/fila")({
  component: FilaPage,
});

const CANAIS: { id: FilaCanal; rotulo: string; icone: typeof Instagram; dica: string }[] = [
  {
    id: "direct",
    rotulo: "Direct",
    icone: Instagram,
    dica: "Abra o perfil pela conta @ianews.co, cole a mensagem e envie. Intervalo de alguns minutos entre envios.",
  },
  {
    id: "linkedin",
    rotulo: "LinkedIn",
    icone: Linkedin,
    dica: "Pelo perfil do Henrique: convite com a nota, sem oferta. A oferta só depois que a pessoa aceitar.",
  },
  {
    id: "email",
    rotulo: "E-mail",
    icone: Mail,
    dica: "Enquanto o domínio de prospecção não estiver aquecido, envie pelo e-mail comercial e marque aqui.",
  },
];

const PASSO_LABEL: Record<string, string> = {
  D0: "1º contato",
  D3: "Lembrete D3",
  D7: "Valor D7",
  D15: "Outro canal D15",
  D21: "Encerramento D21",
};

function FilaPage() {
  const { isAdmin } = useCrm();
  const fetchFila = useServerFn(listFila);
  const fetchPainel = useServerFn(painelFila);
  const marcar = useServerFn(marcarFila);
  const montar = useServerFn(montarFila);
  const salvarCfg = useServerFn(salvarConfigFila);
  const { executar, ocupado } = useAcao();
  const [canal, setCanal] = useState<FilaCanal>("direct");
  const [negocio, setNegocio] = useState<string | null>(null);
  const [mostrarFeitos, setMostrarFeitos] = useState(false);

  const painel = useQuery({ queryKey: ["crm", "fila", "painel"], queryFn: () => fetchPainel() });
  const hoje = painel.data?.hoje ?? null;
  const fila = useQuery({
    queryKey: ["crm", "fila", "itens", hoje],
    queryFn: () => fetchFila({ data: { dia: hoje } }),
    enabled: !!hoje,
  });

  const doCanal = useMemo(
    () => (fila.data ?? []).filter((i) => i.canal === canal),
    [fila.data, canal],
  );
  const pendentes = doCanal.filter((i) => i.status === "pendente");
  const feitos = doCanal.filter((i) => i.status !== "pendente");

  if (painel.isLoading) return <Carregando texto="Carregando a fila do dia..." />;
  if (painel.error) return <Erro erro={painel.error} />;
  const p = painel.data!;
  const lim = p.limites ?? {};
  const contagem = (c: FilaCanal) => p.fila?.[c];
  const respostaPct =
    p.ultimos_14.enviadas > 0
      ? `${Math.round((p.ultimos_14.recebidas / p.ultimos_14.enviadas) * 100)}% de resposta`
      : "sem envios";

  async function copiarEAbrir(item: FilaItem) {
    try {
      await navigator.clipboard.writeText(
        item.canal === "email" && item.assunto
          ? `${item.assunto}\n\n${item.mensagem}`
          : item.mensagem,
      );
      toast.success("Mensagem copiada. Cole na conversa e envie.");
    } catch {
      toast.error("Não consegui copiar. Selecione o texto e copie à mão.");
    }
    if (item.link) window.open(item.link, "_blank", "noopener,noreferrer");
  }

  return (
    <div className="space-y-6">
      <CabecalhoPagina
        titulo="Fila do dia"
        descricao="O sistema monta a fila às 7h20 (dias úteis) com os leads de maior nota, dentro do limite de cada canal. Você abre o perfil, cola a mensagem pronta e marca como enviada. Se o lead responder, a sequência para sozinha."
        acoes={
          <>
            <Button
              variant="outline"
              disabled={ocupado || p.pausado}
              onClick={() =>
                executar(
                  () => montar(),
                  (r) => {
                    const x = r as {
                      primeiros_contatos?: number;
                      follow_ups?: number;
                      fim_de_semana?: boolean;
                    };
                    if (x.fim_de_semana) return "Fim de semana: a fila não é montada.";
                    return `Fila atualizada: ${x.primeiros_contatos ?? 0} primeiros contatos e ${x.follow_ups ?? 0} follow-ups.`;
                  },
                )
              }
            >
              <RefreshCw className="h-4 w-4" /> Montar fila agora
            </Button>
            {isAdmin ? (
              <Button
                variant={p.pausado ? "default" : "outline"}
                disabled={ocupado}
                onClick={() =>
                  executar(
                    () => salvarCfg({ data: { pausado: !p.pausado } }),
                    p.pausado ? "Máquina retomada." : "Máquina pausada.",
                  )
                }
              >
                {p.pausado ? (
                  <PlayCircle className="h-4 w-4" />
                ) : (
                  <PauseCircle className="h-4 w-4" />
                )}
                {p.pausado ? "Retomar" : "Pausar tudo"}
              </Button>
            ) : null}
          </>
        }
      />

      {p.pausado ? (
        <div className="flex items-center gap-2 rounded-[var(--radius)] border border-destructive/40 bg-destructive/5 p-3 text-sm">
          <PauseCircle className="h-4 w-4 text-destructive" /> A máquina está pausada: nenhuma fila
          nova é montada.
        </div>
      ) : null}
      {p.alertas?.length ? (
        <div className="flex items-start gap-2 rounded-[var(--radius)] border border-destructive/40 bg-destructive/5 p-3 text-sm">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-destructive" />
          <span>
            Alertas dos últimos 7 dias:{" "}
            {p.alertas.map((a) => `${a.n} ${a.tipo.replace("_", " ")} (${a.canal})`).join(", ")}.
            Reduza o limite do canal antes de continuar.
          </span>
        </div>
      ) : null}

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {CANAIS.map((c) => (
          <Numero
            key={c.id}
            rotulo={`${c.rotulo} hoje`}
            icone={c.icone}
            valor={`${contagem(c.id)?.enviado ?? 0}/${contagem(c.id)?.d0 ?? 0}`}
            detalhe={`limite ${lim[c.id] ?? 0} primeiros contatos · ${contagem(c.id)?.pendente ?? 0} pendentes`}
            destaque={c.id === canal ? "azul" : undefined}
          />
        ))}
        <Numero
          rotulo="Prontos para a fila"
          valor={fmtNum(p.elegiveis)}
          detalhe={`nota ${p.nota_corte} ou mais, sem contato há 90 dias`}
        />
        <Numero
          rotulo="Últimos 14 dias"
          icone={MessageCircle}
          valor={`${fmtNum(p.ultimos_14.recebidas)} respostas`}
          detalhe={`${fmtNum(p.ultimos_14.enviadas)} enviadas · ${respostaPct}`}
        />
        <Numero
          rotulo="Receita do mês"
          valor={fmtMoeda(p.receita_mes)}
          detalhe={`${p.ultimos_14.pagamentos} pagamentos em 14 dias · ${p.pagamentos_pendentes} cobranças abertas`}
        />
        <Numero
          rotulo="Briefings"
          valor={`${p.briefings.abertos} abertos`}
          detalhe={`${p.briefings.enviados} recebidos · ${p.briefings.em_producao} em produção`}
          destaque={p.quentes_sem_resposta > 0 ? "alerta" : undefined}
        />
      </div>
      {p.quentes_sem_resposta > 0 ? (
        <p className="text-sm text-destructive">
          {p.quentes_sem_resposta} lead(s) responderam e estão sem retorno há mais de 24 horas
          (etapa "Respondeu").
        </p>
      ) : null}

      <div className="flex flex-wrap gap-2" role="tablist" aria-label="Canal">
        {CANAIS.map((c) => {
          const Icone = c.icone;
          const n = (fila.data ?? []).filter(
            (i) => i.canal === c.id && i.status === "pendente",
          ).length;
          return (
            <Button
              key={c.id}
              role="tab"
              aria-selected={canal === c.id}
              variant={canal === c.id ? "default" : "outline"}
              onClick={() => setCanal(c.id)}
            >
              <Icone className="h-4 w-4" /> {c.rotulo}
              <span className="ml-1 rounded-full bg-background/20 px-1.5 text-xs">{n}</span>
            </Button>
          );
        })}
      </div>
      <p className="text-sm text-muted-foreground">{CANAIS.find((c) => c.id === canal)?.dica}</p>

      <Secao titulo={`Pendentes · ${hoje ? fmtDia(hoje) : ""}`} contagem={pendentes.length}>
        {fila.isLoading ? (
          <Carregando />
        ) : fila.error ? (
          <Erro erro={fila.error} />
        ) : pendentes.length === 0 ? (
          <Vazio>Nada pendente neste canal hoje.</Vazio>
        ) : (
          <ul className="space-y-3">
            {pendentes.map((item) => (
              <li key={item.id} className="rounded-[var(--radius)] border p-3">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="font-bold">
                      {item.pessoa_nome ?? item.empresa_nome ?? item.negocio_titulo ?? "Lead"}
                      {item.empresa_nome && item.pessoa_nome ? (
                        <span className="font-normal text-muted-foreground">
                          {" "}
                          · {item.empresa_nome}
                        </span>
                      ) : null}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      <span className="rounded bg-primary/10 px-1.5 py-0.5 font-semibold text-primary">
                        {PASSO_LABEL[item.passo] ?? item.passo}
                      </span>{" "}
                      nota {item.nota ?? "—"} · {item.destino ?? "sem destino"}
                      {item.motivo ? ` · ${item.motivo}` : ""}
                    </p>
                  </div>
                  <Button variant="ghost" size="sm" onClick={() => setNegocio(item.negocio_id)}>
                    Ver negócio
                  </Button>
                </div>
                {item.assunto ? (
                  <p className="mt-2 text-xs">
                    <span className="text-muted-foreground">Assunto:</span> {item.assunto}
                  </p>
                ) : null}
                <pre className="mt-2 max-h-48 overflow-auto whitespace-pre-wrap rounded-md bg-muted/60 p-3 font-sans text-sm">
                  {item.mensagem}
                </pre>
                <div className="mt-3 flex flex-wrap gap-2">
                  <Button size="sm" onClick={() => copiarEAbrir(item)}>
                    <Copy className="h-4 w-4" /> Copiar e abrir
                    {item.link ? <ExternalLink className="h-3.5 w-3.5" /> : null}
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={ocupado}
                    onClick={() =>
                      executar(
                        () => marcar({ data: { id: item.id, status: "enviado" } }),
                        "Marcado como enviado.",
                      )
                    }
                  >
                    <Check className="h-4 w-4" /> Enviei
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={ocupado}
                    onClick={() =>
                      executar(
                        () => marcar({ data: { id: item.id, status: "respondeu" } }),
                        "Sequência parada: o lead respondeu.",
                      )
                    }
                  >
                    <MessageCircle className="h-4 w-4" /> Já respondeu
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    disabled={ocupado}
                    onClick={() =>
                      executar(
                        () => marcar({ data: { id: item.id, status: "pulado", motivo: "pular" } }),
                        "Pulado. Ele volta a ser candidato amanhã.",
                      )
                    }
                  >
                    <SkipForward className="h-4 w-4" /> Pular
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="text-destructive"
                    disabled={ocupado}
                    onClick={() =>
                      executar(
                        () =>
                          marcar({
                            data: { id: item.id, status: "pulado", motivo: "sem_interesse" },
                          }),
                        "Lead tirado de todas as sequências.",
                      )
                    }
                  >
                    <Ban className="h-4 w-4" /> Não contatar mais
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </Secao>

      {feitos.length ? (
        <Secao
          titulo="Concluídos hoje"
          contagem={feitos.length}
          acoes={
            <Button variant="ghost" size="sm" onClick={() => setMostrarFeitos((v) => !v)}>
              {mostrarFeitos ? "Esconder" : "Mostrar"}
            </Button>
          }
        >
          {mostrarFeitos ? (
            <ul className="divide-y text-sm">
              {feitos.map((i) => (
                <li key={i.id} className="flex flex-wrap items-center justify-between gap-2 py-2">
                  <span>
                    {i.pessoa_nome ?? i.empresa_nome ?? "Lead"} · {PASSO_LABEL[i.passo] ?? i.passo}
                  </span>
                  <span
                    className={cn(
                      "text-xs",
                      i.status === "enviado" ? "text-primary" : "text-muted-foreground",
                    )}
                  >
                    {i.status}
                    {i.status !== "enviado" ? (
                      <button
                        type="button"
                        className="ml-2 underline"
                        onClick={() =>
                          executar(
                            () => marcar({ data: { id: i.id, status: "pendente" } }),
                            "Voltou para pendente.",
                          )
                        }
                      >
                        desfazer
                      </button>
                    ) : null}
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-muted-foreground">
              {feitos.filter((i) => i.status === "enviado").length} enviados,{" "}
              {feitos.filter((i) => i.status !== "enviado").length} pulados ou respondidos.
            </p>
          )}
        </Secao>
      ) : null}

      {isAdmin ? <ConfigFila limites={lim} notaCorte={p.nota_corte} salvar={salvarCfg} /> : null}

      {negocio ? <NegocioPainel id={negocio} onClose={() => setNegocio(null)} /> : null}
    </div>
  );
}

function ConfigFila({
  limites,
  notaCorte,
  salvar,
}: {
  limites: Record<string, number>;
  notaCorte: number;
  salvar: (a: {
    data: { limites?: Record<string, number>; nota_corte?: number };
  }) => Promise<unknown>;
}) {
  const { executar, ocupado } = useAcao();
  const [d, setD] = useState({
    direct: limites.direct ?? 20,
    linkedin: limites.linkedin ?? 15,
    email: limites.email ?? 25,
    nota: notaCorte ?? 50,
  });
  return (
    <Secao titulo="Limites e nota de corte (admin)">
      <p className="mb-3 text-sm text-muted-foreground">
        Primeiros contatos por dia em cada canal. Suba aos poucos e só se não houver bloqueio ou
        denúncia por 2 semanas. WhatsApp frio fica sempre em zero.
      </p>
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {(
          [
            ["direct", "Direct"],
            ["linkedin", "LinkedIn"],
            ["email", "E-mail"],
            ["nota", "Nota de corte"],
          ] as const
        ).map(([k, rotulo]) => (
          <div key={k} className="space-y-1">
            <Label htmlFor={`cfg-${k}`}>{rotulo}</Label>
            <Input
              id={`cfg-${k}`}
              type="number"
              min={0}
              max={k === "nota" ? 100 : 200}
              value={d[k]}
              onChange={(e) => setD((v) => ({ ...v, [k]: Number(e.target.value) }))}
            />
          </div>
        ))}
      </div>
      <Button
        className="mt-3"
        disabled={ocupado}
        onClick={() =>
          executar(
            () =>
              salvar({
                data: {
                  limites: { direct: d.direct, linkedin: d.linkedin, email: d.email },
                  nota_corte: d.nota,
                },
              }),
            "Configuração salva.",
          )
        }
      >
        Salvar
      </Button>
    </Secao>
  );
}
