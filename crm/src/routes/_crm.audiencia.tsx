import { createFileRoute } from "@tanstack/react-router";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";

import { BarrasHorizontais, BarrasPorDia } from "@/components/crm/grafico";
import { FiltroPeriodo, preencherDias, usePeriodo } from "@/components/crm/periodo";
import {
  BotaoCsv,
  CabecalhoPagina,
  Carregando,
  Erro,
  Numero,
  Secao,
  Vazio,
} from "@/components/crm/ui";
import { getAudiencia } from "@/lib/crm/indicadores.functions";
import { fmtDataHora, fmtNum, linkMateria } from "@/lib/crm/utils";

export const Route = createFileRoute("/_crm/audiencia")({
  component: AudienciaPage,
});

const pct = (a: number, b: number) => (b ? `${Math.round((a / b) * 100)}%` : "—");

function AudienciaPage() {
  const fetchAud = useServerFn(getAudiencia);
  const [periodo, setPeriodo] = usePeriodo(30);
  const { data, isLoading, error, isFetching } = useQuery({
    queryKey: ["crm", "audiencia", periodo.inicio, periodo.fim],
    queryFn: () => fetchAud({ data: periodo }),
    placeholderData: keepPreviousData,
  });

  const a = data?.dados;
  const novosDia = a
    ? preencherDias(periodo, a.novos_por_dia, (dia) => ({ dia, novos: 0, confirmados: 0 }))
    : [];
  const visitasDia = a
    ? preencherDias(periodo, a.visitas_por_dia, (dia) => ({ dia, visitas: 0, visitantes: 0 }))
    : [];

  return (
    <div className="space-y-5">
      <CabecalhoPagina
        titulo="Audiência"
        descricao="Newsletter, visitas, matérias mais lidas, push e origem dos assinantes, direto das tabelas do site."
        acoes={
          a ? (
            <>
              <BotaoCsv
                nome="audiencia-materias"
                linhas={a.materias_mais_lidas}
                colunas={[
                  { titulo: "Matéria", valor: (m) => m.titulo },
                  { titulo: "Link", valor: (m) => linkMateria(m.slug) },
                  { titulo: "Visitas", valor: (m) => m.visitas },
                  { titulo: "Leituras", valor: (m) => m.leituras },
                  { titulo: "Leituras completas", valor: (m) => m.concluidas },
                  { titulo: "Segundos médios", valor: (m) => m.segundos_medios },
                ]}
              />
              <BotaoCsv
                nome="audiencia-por-dia"
                linhas={novosDia.map((n, i) => ({ ...n, ...visitasDia[i] }))}
                colunas={[
                  { titulo: "Dia", valor: (d) => d.dia },
                  { titulo: "Novos assinantes", valor: (d) => d.novos },
                  { titulo: "Confirmados", valor: (d) => d.confirmados },
                  { titulo: "Visitas", valor: (d) => d.visitas },
                  { titulo: "Visitantes", valor: (d) => d.visitantes },
                ]}
              />
            </>
          ) : null
        }
      />
      <FiltroPeriodo valor={periodo} onChange={setPeriodo} />

      {isLoading ? (
        <Carregando />
      ) : error || !a ? (
        <Erro erro={error} />
      ) : (
        <div className={isFetching ? "space-y-5 opacity-70 transition-opacity" : "space-y-5"}>
          <section className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
            <Numero
              rotulo="Assinantes ativos"
              valor={fmtNum(a.assinantes_ativos)}
              detalhe={`${fmtNum(a.assinantes_confirmados)} confirmados (${pct(a.assinantes_confirmados, a.assinantes_ativos)})`}
              destaque="azul"
            />
            <Numero
              rotulo="Novos no período"
              valor={fmtNum(a.novos_periodo)}
              detalhe={`${fmtNum(a.confirmados_periodo)} confirmaram`}
            />
            <Numero rotulo="Descadastros" valor={fmtNum(a.descadastros_periodo)} />
            <Numero
              rotulo="Entregas da newsletter"
              valor={fmtNum(a.entregas_periodo.entregues)}
              detalhe={`${fmtNum(a.entregas_periodo.edicoes)} envios · ${fmtNum(a.entregas_periodo.falhas)} falhas`}
            />
            <Numero
              rotulo="Visitas"
              valor={fmtNum(a.visitas)}
              detalhe={`${fmtNum(a.visitantes)} visitantes`}
            />
            <Numero
              rotulo="Push ativos"
              valor={fmtNum(a.push_ativos)}
              detalhe={`+${fmtNum(a.push_novos_periodo)} no período`}
            />
          </section>

          <div className="grid gap-5 lg:grid-cols-2">
            <Secao titulo="Novos assinantes por dia">
              <BarrasPorDia
                rotulo="Novos assinantes"
                dados={novosDia.map((d) => ({
                  dia: d.dia,
                  valor: d.novos,
                  detalhe: `${d.confirmados} confirmados`,
                }))}
              />
            </Secao>
            <Secao titulo="Visitas por dia">
              <BarrasPorDia
                rotulo="Visitas"
                dados={visitasDia.map((d) => ({
                  dia: d.dia,
                  valor: d.visitas,
                  detalhe: `${d.visitantes} visitantes`,
                }))}
              />
            </Secao>
          </div>

          <div className="grid gap-5 lg:grid-cols-2">
            <Secao titulo="Origem dos assinantes">
              <BarrasHorizontais
                itens={a.origem_assinantes.map((o) => ({ rotulo: o.origem, valor: o.total }))}
              />
            </Secao>
            <Secao titulo="Origem das visitas">
              <BarrasHorizontais
                itens={a.origem_visitas.map((o) => ({ rotulo: o.origem, valor: o.total }))}
              />
            </Secao>
          </div>

          <Secao titulo="Matérias mais lidas" contagem={a.materias_mais_lidas.length}>
            {a.materias_mais_lidas.length ? (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[640px] text-sm">
                  <thead className="text-left text-xs text-muted-foreground">
                    <tr>
                      <th className="py-2">Matéria</th>
                      <th className="py-2 text-right">Visitas</th>
                      <th className="py-2 text-right">Leituras</th>
                      <th className="py-2 text-right">Completas</th>
                      <th className="py-2 text-right">Tempo médio</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {a.materias_mais_lidas.map((m) => (
                      <tr key={m.slug}>
                        <td className="py-2 pr-3">
                          <a
                            href={linkMateria(m.slug)!}
                            target="_blank"
                            rel="noreferrer"
                            className="hover:text-primary"
                          >
                            {m.titulo}
                          </a>
                        </td>
                        <td className="py-2 text-right font-semibold">{fmtNum(m.visitas)}</td>
                        <td className="py-2 text-right">{fmtNum(m.leituras)}</td>
                        <td className="py-2 text-right">{pct(m.concluidas, m.leituras)}</td>
                        <td className="py-2 text-right">
                          {m.segundos_medios
                            ? `${Math.round(m.segundos_medios / 6) / 10} min`
                            : "—"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <Vazio>Sem leituras no período.</Vazio>
            )}
          </Secao>

          <Secao titulo="Envios da newsletter" contagem={a.envios.length}>
            {a.envios.length ? (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[640px] text-sm">
                  <thead className="text-left text-xs text-muted-foreground">
                    <tr>
                      <th className="py-2">Data</th>
                      <th className="py-2">Assunto</th>
                      <th className="py-2 text-right">Destinatários</th>
                      <th className="py-2 text-right">Entregues</th>
                      <th className="py-2 text-right">Falhas</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {a.envios.map((e) => (
                      <tr key={e.id}>
                        <td className="py-2 pr-3 text-muted-foreground">{fmtDataHora(e.data)}</td>
                        <td className="py-2 pr-3">
                          {e.assunto ?? "—"}{" "}
                          <span className="text-xs text-muted-foreground">
                            ({e.tipo === "ranking" ? "ranking" : "diária"})
                          </span>
                        </td>
                        <td className="py-2 text-right">{fmtNum(e.destinatarios)}</td>
                        <td className="py-2 text-right font-semibold">{fmtNum(e.entregues)}</td>
                        <td className="py-2 text-right">{fmtNum(e.falhas)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <Vazio>Nenhum envio no período.</Vazio>
            )}
          </Secao>
        </div>
      )}
    </div>
  );
}
