import { useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { CheckCircle2, Flame, MessageCircle, Plus, RefreshCw } from "lucide-react";

import { useCrm } from "@/components/crm/context";
import { MensagemDialog, TarefaDialog, type DadosMensagem } from "@/components/crm/dialogs";
import { NegocioDialog, NegocioPainel } from "@/components/crm/negocio";
import { useAcao } from "@/components/crm/queries";
import {
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
import { Switch } from "@/components/ui/switch";
import type { NegocioCompleto } from "@/lib/crm/carregar";
import { getHoje, type FilaViraramPauta } from "@/lib/crm/hoje.functions";
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
              <RefreshCw className={cn("mr-1.5 h-4 w-4", isFetching && "animate-spin")} /> Atualizar
            </Button>
            <Button variant="outline" size="sm" className="h-9" onClick={() => setNovaTarefa(true)}>
              <Plus className="mr-1.5 h-4 w-4" /> Tarefa
            </Button>
            <Button size="sm" className="h-9" onClick={() => setNovoNegocio(true)}>
              <Plus className="mr-1.5 h-4 w-4" /> Novo lead
            </Button>
          </>
        }
      />

      <section className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
        <Numero
          rotulo="Tarefas hoje"
          valor={fmtNum(tarefas.length)}
          detalhe={`${atrasadas.length} atrasadas`}
          destaque={atrasadas.length ? "alerta" : undefined}
        />
        <Numero
          rotulo="Novos leads 24h"
          valor={fmtNum(data.novos.length)}
          destaque={data.novos.length ? "azul" : undefined}
        />
        <Numero
          rotulo="Negócios atrasados"
          valor={fmtNum(data.atrasados.length)}
          destaque={data.atrasados.length ? "alerta" : undefined}
        />
        <Numero rotulo="Leads novos (7 dias)" valor={fmtNum(data.semana.novosLeads)} />
        <Numero rotulo="Mensagens (7 dias)" valor={fmtNum(data.semana.mensagensEnviadas)} />
        <Numero
          rotulo="Fechados (7 dias)"
          valor={fmtNum(data.semana.fechados)}
          detalhe={`${fmtMoeda(data.semana.receita)} recebidos`}
        />
      </section>

      <div className="grid gap-6 xl:grid-cols-[1.3fr_1fr]">
        <Secao
          titulo="Tarefas de hoje e atrasadas"
          contagem={tarefas.length}
          acoes={
            <label className="flex items-center gap-2 text-xs text-muted-foreground">
              <Switch checked={soMinhas} onCheckedChange={setSoMinhas} /> Só as minhas
            </label>
          }
        >
          {tarefas.length ? (
            <ul className="divide-y">
              {tarefas.map((t) => (
                <li key={t.id} className="flex items-start gap-3 py-2.5">
                  <button
                    type="button"
                    aria-label="Concluir tarefa"
                    className="mt-0.5 text-muted-foreground hover:text-primary"
                    onClick={() =>
                      executar(
                        () => concluir({ data: { id: t.id, feita: true } }),
                        "Tarefa concluída.",
                      )
                    }
                  >
                    <CheckCircle2 className="h-5 w-5" />
                  </button>
                  <div className="min-w-0 flex-1">
                    <button
                      type="button"
                      className="text-left text-sm font-semibold hover:text-primary"
                      onClick={() => t.negocio_id && setAberto(t.negocio_id)}
                    >
                      {t.titulo}
                    </button>
                    <p className="text-xs text-muted-foreground">
                      <span
                        className={cn(
                          atrasado(t.vence_em, data.hoje) && "font-semibold text-destructive",
                        )}
                      >
                        {prazoRelativo(t.vence_em, data.hoje)}
                      </span>
                      {" · "}
                      {membro(t.responsavel_id)}
                      {t.empresa_nome ? ` · ${t.empresa_nome}` : ""}
                      {t.automatica ? " · automática" : ""}
                    </p>
                    {t.descricao ? (
                      <p className="mt-0.5 text-xs text-muted-foreground">{t.descricao}</p>
                    ) : null}
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <Vazio>Nada para hoje. Que tal puxar a fila “Viraram pauta”?</Vazio>
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
  return (
    <Secao titulo={titulo} contagem={lista.length}>
      {lista.length ? (
        <ul className="divide-y">
          {lista.slice(0, 25).map((n) => (
            <li key={n.id}>
              <button
                type="button"
                onClick={() => onAbrir(n.id)}
                className="flex w-full items-start justify-between gap-3 py-2 text-left hover:text-primary"
              >
                <span className="min-w-0">
                  <span className="block truncate text-sm font-semibold">
                    {n.empresa_nome ?? n.titulo}
                  </span>
                  <span className="block text-xs text-muted-foreground">
                    {n.etapa_nome} · {membro(n.dono_id)}
                    {detalhe
                      ? ` · ${detalhe(n)}`
                      : n.proxima_acao_em
                        ? ` · ${prazoRelativo(n.proxima_acao_em)}`
                        : ""}
                  </span>
                </span>
                <span className="flex shrink-0 items-center gap-1">
                  {alerta && atrasado(n.proxima_acao_em) ? (
                    <Etiqueta tom="alerta">atrasado</Etiqueta>
                  ) : null}
                  <GrupoBadge grupo={n.empresa_grupo} />
                </span>
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <Vazio>{vazio}</Vazio>
      )}
    </Secao>
  );
}
