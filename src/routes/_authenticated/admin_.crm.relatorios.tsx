import { createFileRoute } from "@tanstack/react-router";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";

import { useCrm } from "@/components/crm/context";
import { BarrasHorizontais } from "@/components/crm/grafico";
import { FiltroPeriodo, usePeriodo } from "@/components/crm/periodo";
import {
  BotaoCsv,
  CabecalhoPagina,
  Carregando,
  Erro,
  Numero,
  Secao,
  Vazio,
} from "@/components/crm/ui";
import { getRelatorios } from "@/lib/crm/indicadores.functions";
import { fmtMoeda, fmtNum, labelDe, linkMateria, ORIGENS } from "@/lib/crm/utils";

export const Route = createFileRoute("/_authenticated/admin_/crm/relatorios")({
  component: RelatoriosPage,
});

const pct = (a: number, b: number) => (b ? `${Math.round((a / b) * 100)}%` : "—");

function RelatoriosPage() {
  const { funis, funilNome, membro } = useCrm();
  const fetchRel = useServerFn(getRelatorios);
  const [periodo, setPeriodo] = usePeriodo(30);
  const { data, isLoading, error, isFetching } = useQuery({
    queryKey: ["crm", "relatorios", periodo.inicio, periodo.fim],
    queryFn: () => fetchRel({ data: periodo }),
    placeholderData: keepPreviousData,
  });
  const r = data?.dados;

  const origens = new Map<string, number>();
  for (const o of r?.novos_por_origem ?? [])
    origens.set(o.origem, (origens.get(o.origem) ?? 0) + o.total);
  const totalNovos = [...origens.values()].reduce((s, n) => s + n, 0);

  return (
    <div className="space-y-5">
      <CabecalhoPagina
        titulo="Relatórios"
        descricao="Indicadores calculados do banco, nunca digitados: conversão por etapa e origem, receita, ticket médio, tempo até fechar, motivos de perda e equipe."
        acoes={
          r ? (
            <>
              <BotaoCsv
                nome="relatorio-etapas"
                linhas={r.passagem_etapas}
                colunas={[
                  { titulo: "Funil", valor: (e) => funilNome(e.funil) },
                  { titulo: "Etapa", valor: (e) => e.etapa },
                  { titulo: "Ordem", valor: (e) => e.ordem },
                  { titulo: "Chegaram no período", valor: (e) => e.chegaram },
                ]}
              />
              <BotaoCsv
                nome="relatorio-origens"
                linhas={r.novos_por_origem}
                colunas={[
                  { titulo: "Origem", valor: (o) => labelDe(ORIGENS, o.origem) },
                  { titulo: "Funil", valor: (o) => funilNome(o.funil) },
                  { titulo: "Novos negócios", valor: (o) => o.total },
                ]}
              />
              <BotaoCsv
                nome="relatorio-equipe"
                linhas={r.equipe}
                colunas={[
                  { titulo: "Pessoa", valor: (e) => membro(e.user_id) },
                  { titulo: "Tarefas feitas", valor: (e) => e.tarefas_feitas },
                  { titulo: "No prazo", valor: (e) => e.no_prazo },
                  { titulo: "Mensagens registradas", valor: (e) => e.mensagens },
                ]}
              />
            </>
          ) : null
        }
      />
      <FiltroPeriodo valor={periodo} onChange={setPeriodo} />

      {isLoading ? (
        <Carregando />
      ) : error || !r ? (
        <Erro erro={error} />
      ) : (
        <div className={isFetching ? "space-y-5 opacity-70" : "space-y-5"}>
          <section className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
            <Numero rotulo="Novos leads" valor={fmtNum(totalNovos)} />
            <Numero
              rotulo="Fechados"
              valor={fmtNum(r.fechados.quantidade ?? 0)}
              detalhe={`${fmtNum(r.fechados.cortesias ?? 0)} cortesias`}
            />
            <Numero
              rotulo="Receita (pagos)"
              valor={fmtMoeda(r.fechados.receita ?? 0)}
              detalhe={`${fmtMoeda(r.fechados.receita_prevista ?? 0)} a receber`}
              destaque="azul"
            />
            <Numero rotulo="Ticket médio" valor={fmtMoeda(r.fechados.ticket_medio ?? 0)} />
            <Numero
              rotulo="Dias até fechar"
              valor={fmtNum(r.fechados.dias_medios_ate_fechar ?? 0)}
              detalhe="média, do cadastro ao fechamento"
            />
            <Numero
              rotulo="Abertos agora"
              valor={fmtNum(r.abertos.quantidade)}
              detalhe={`${fmtMoeda(r.abertos.valor)} · ${r.abertos.atrasados} atrasados`}
              destaque={r.abertos.atrasados ? "alerta" : undefined}
            />
          </section>

          <Secao titulo="Passagem entre etapas (negócios que chegaram a cada etapa no período)">
            <div className="grid gap-5 lg:grid-cols-3">
              {funis.map((f) => {
                const etapas = r.passagem_etapas.filter((e) => e.funil === f.id);
                const base = etapas.find((e) => e.ordem === 1)?.chegaram ?? 0;
                return (
                  <div key={f.id}>
                    <p className="mb-2 text-sm font-bold">{f.nome}</p>
                    <ul className="space-y-1.5 text-sm">
                      {etapas.map((e, i) => {
                        const anterior = i > 0 ? etapas[i - 1] : null;
                        return (
                          <li key={e.etapa} className="flex items-center justify-between gap-2">
                            <span className={e.tipo === "perdida" ? "text-muted-foreground" : ""}>
                              {e.ordem < 90 ? `${e.ordem}. ` : ""}
                              {e.etapa}
                            </span>
                            <span className="flex items-center gap-2">
                              <span className="font-semibold">{fmtNum(e.chegaram)}</span>
                              {anterior && e.ordem < 90 && anterior.ordem < 90 ? (
                                <span
                                  className="w-12 text-right text-xs text-muted-foreground"
                                  title="passagem da etapa anterior"
                                >
                                  {pct(e.chegaram, anterior.chegaram)}
                                </span>
                              ) : (
                                <span className="w-12 text-right text-xs text-muted-foreground">
                                  {e.ordem >= 90 && base ? pct(e.chegaram, base) : ""}
                                </span>
                              )}
                            </span>
                          </li>
                        );
                      })}
                    </ul>
                  </div>
                );
              })}
            </div>
          </Secao>

          <div className="grid gap-5 lg:grid-cols-2">
            <Secao titulo="Novos leads por origem">
              <BarrasHorizontais
                itens={[...origens.entries()]
                  .sort((a, b) => b[1] - a[1])
                  .map(([o, n]) => ({ rotulo: labelDe(ORIGENS, o), valor: n }))}
              />
            </Secao>
            <Secao titulo="Motivos de perda">
              <BarrasHorizontais
                itens={r.motivos_perda.map((m) => ({ rotulo: m.motivo, valor: m.total }))}
              />
            </Secao>
            <Secao titulo="Receita por funil">
              <BarrasHorizontais
                itens={r.receita_por_funil.map((f) => ({
                  rotulo: funilNome(f.funil),
                  valor: Number(f.receita),
                  detalhe: `${f.quantidade} fechados`,
                }))}
              />
            </Secao>
            <Secao titulo="Conteúdo para receita">
              <p className="mb-2 text-xs text-muted-foreground">
                Collab aceito: {fmtNum(r.collab.aceitos)} de {fmtNum(r.collab.com_resposta)} (
                {pct(r.collab.aceitos, r.collab.com_resposta)})
              </p>
              {r.pautas_que_geraram.length ? (
                <ul className="space-y-1.5 text-sm">
                  {r.pautas_que_geraram.map((p) => (
                    <li key={p.slug} className="flex items-start justify-between gap-2">
                      <a
                        href={linkMateria(p.slug)!}
                        target="_blank"
                        rel="noreferrer"
                        className="line-clamp-2 hover:text-primary"
                      >
                        {p.titulo}
                      </a>
                      <span className="shrink-0 text-xs">
                        <strong>{p.leads}</strong> leads · {p.vendas} vendas ·{" "}
                        {fmtMoeda(Number(p.receita))}
                      </span>
                    </li>
                  ))}
                </ul>
              ) : (
                <Vazio>Nenhuma matéria gerou lead no período.</Vazio>
              )}
            </Secao>
          </div>

          <Secao titulo="Equipe">
            {r.equipe.length ? (
              <table className="w-full text-sm">
                <thead className="text-left text-xs text-muted-foreground">
                  <tr>
                    <th className="py-2">Pessoa</th>
                    <th className="py-2 text-right">Tarefas feitas</th>
                    <th className="py-2 text-right">No prazo</th>
                    <th className="py-2 text-right">Mensagens registradas</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {r.equipe.map((e) => (
                    <tr key={e.user_id}>
                      <td className="py-2">{membro(e.user_id)}</td>
                      <td className="py-2 text-right font-semibold">{fmtNum(e.tarefas_feitas)}</td>
                      <td className="py-2 text-right">{pct(e.no_prazo, e.tarefas_feitas)}</td>
                      <td className="py-2 text-right">{fmtNum(e.mensagens)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <Vazio>Sem atividade registrada da equipe no período.</Vazio>
            )}
          </Secao>
        </div>
      )}
    </div>
  );
}
