import { useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";

import { CabecalhoPagina, Carregando, Erro, Numero, Secao } from "@/components/crm/ui";
import { Button } from "@/components/ui/button";
import { painelOperacao, type Metricas } from "@/lib/crm/operacao.functions";
import { fmtDiaCurto, fmtNum } from "@/lib/crm/utils";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_crm/painel")({
  component: PainelPage,
});

/* Painel da operação: quanto conteúdo sai por dia e por canal, o que está agendado, como a
   máquina comercial está rodando (lista, fila, respostas, briefings, produções). */

const META_POSTS_DIA = 5; // 1 destaque + até 4 reels (regra do calendário)

function Barras({
  dados,
  valor,
  meta,
  rotulo,
  cor = "bg-primary",
}: {
  dados: Metricas["dias"];
  valor: (d: Metricas["dias"][number]) => number;
  meta?: number;
  rotulo: (d: Metricas["dias"][number]) => string;
  cor?: string;
}) {
  const max = Math.max(meta ?? 0, ...dados.map(valor), 1);
  return (
    <div className="flex h-36 items-end gap-1">
      {dados.map((d) => {
        const v = valor(d);
        return (
          <div key={d.dia} className="group relative flex flex-1 flex-col items-center justify-end" title={`${fmtDiaCurto(d.dia)}: ${rotulo(d)}`}>
            <div
              className={cn("w-full rounded-t", d.futuro ? "bg-primary/30" : cor, v === 0 && "bg-muted")}
              style={{ height: `${Math.max(2, (v / max) * 100)}%` }}
            />
            <span className="mt-1 text-[10px] text-muted-foreground">{d.dia.slice(8, 10)}</span>
          </div>
        );
      })}
      {meta ? (
        <div className="pointer-events-none absolute left-0 right-0 border-t border-dashed border-destructive/60" style={{ bottom: `${(meta / max) * 100}%` }} />
      ) : null}
    </div>
  );
}

function PainelPage() {
  const fetchPainel = useServerFn(painelOperacao);
  const [dias, setDias] = useState(14);
  const q = useQuery({ queryKey: ["crm", "painel", dias], queryFn: () => fetchPainel({ data: { dias, futuro: 30 } }) });

  const m = q.data;
  const passado = useMemo(() => (m?.dias ?? []).filter((d) => !d.futuro), [m]);
  const futuro = useMemo(() => (m?.dias ?? []).filter((d) => d.futuro), [m]);
  const soma = (f: (d: Metricas["dias"][number]) => number, lista = passado) => lista.reduce((a, d) => a + f(d), 0);

  if (q.isLoading) return <Carregando texto="Carregando o painel..." />;
  if (q.error || !m) return <Erro erro={q.error ?? new Error("Sem dados.")} />;

  const t = m.totais;
  const diasComMaterias = passado.filter((d) => d.materias > 0).length || 1;
  const mediaMaterias = soma((d) => d.materias) / diasComMaterias;
  const enviados = soma((d) => d.fila.enviados);
  const respondeu = soma((d) => d.fila.respondeu);
  const diasSemConteudo = futuro.filter((d) => d.materias === 0).map((d) => d.dia);
  const diasAbaixoMeta = futuro.filter((d) => d.materias > 0 && d.materias < META_POSTS_DIA).length;

  return (
    <div className="space-y-6">
      <CabecalhoPagina
        titulo="Painel da operação"
        descricao="Conteúdo que sai por dia (site, com uma matéria por post), agenda dos próximos 30 dias e os números da máquina comercial: lista, fila, respostas, briefings e produções."
        acoes={
          <>
            {[7, 14, 30].map((n) => (
              <Button key={n} size="sm" variant={dias === n ? "default" : "outline"} onClick={() => setDias(n)}>
                {n} dias
              </Button>
            ))}
          </>
        }
      />

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4 lg:grid-cols-6">
        <Numero rotulo="Matérias por dia" valor={mediaMaterias.toFixed(1)} detalhe={`média dos últimos ${dias} dias · meta ${META_POSTS_DIA}`} destaque="azul" />
        <Numero rotulo="Agendadas" valor={fmtNum(t.materias_agendadas)} detalhe={`${futuro.filter((d) => d.materias > 0).length} dias cobertos dos próximos 30`} />
        <Numero rotulo="Dias sem conteúdo" valor={diasSemConteudo.length} detalhe={diasSemConteudo.length ? `a partir de ${fmtDiaCurto(diasSemConteudo[0])}` : "próximos 30 dias cobertos"} destaque={diasSemConteudo.length ? "alerta" : undefined} />
        <Numero rotulo="Publicadas (total)" valor={fmtNum(t.materias_publicadas)} detalhe={`${t.rascunhos} rascunhos`} />
        <Numero rotulo="Newsletter" valor={fmtNum(t.assinantes_ativos)} detalhe={`assinantes ativos · ${fmtNum(soma((d) => d.newsletter.entregues))} entregas em ${dias} dias`} />
        <Numero rotulo="Base" valor={fmtNum(t.empresas)} detalhe={`empresas · ${fmtNum(t.pessoas)} pessoas · ${fmtNum(t.negocios_abertos)} negócios abertos`} />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Secao titulo={`Matérias publicadas por dia (${dias} dias)`}>
          <div className="relative">
            <Barras dados={passado} valor={(d) => d.materias} meta={META_POSTS_DIA} rotulo={(d) => `${d.materias} matérias (${d.de_instagram} de posts, ${d.de_newsletter} da newsletter)`} />
          </div>
          <p className="mt-2 text-xs text-muted-foreground">Linha tracejada: meta de {META_POSTS_DIA} por dia (1 destaque às 15h + até 4 reels). Cada post vira uma matéria no site, então esta é a medida de conteúdo publicado.</p>
        </Secao>
        <Secao titulo="Agenda dos próximos 30 dias">
          <div className="relative">
            <Barras dados={futuro} valor={(d) => d.materias} meta={META_POSTS_DIA} rotulo={(d) => `${d.materias} agendadas`} />
          </div>
          <p className="mt-2 text-xs text-muted-foreground">
            {diasAbaixoMeta} dia(s) abaixo da meta e {diasSemConteudo.length} sem nada agendado. Os destaques aprovados entram na primeira vaga das 15h.
          </p>
        </Secao>
      </div>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4 lg:grid-cols-6">
        <Numero rotulo="Lista do dia" valor={fmtNum(soma((d) => d.lista.total))} detalhe={`leads listados em ${dias} dias · ${fmtNum(soma((d) => d.lista.contatados))} contatados`} />
        <Numero rotulo="Fila: enviados" valor={fmtNum(enviados)} detalhe={`${fmtNum(soma((d) => d.fila.primeiros))} primeiros contatos · ${fmtNum(soma((d) => d.fila.followups))} follow-ups`} />
        <Numero rotulo="Responderam" valor={fmtNum(respondeu)} detalhe={enviados ? `${Math.round((respondeu / enviados) * 100)}% de resposta` : "sem envios"} destaque="azul" />
        <Numero rotulo="Briefings" valor={fmtNum(soma((d) => d.briefings.enviados))} detalhe={`recebidos · ${fmtNum(soma((d) => d.briefings.aprovados))} prévias aprovadas`} />
        <Numero rotulo="Aguardando" valor={t.briefings_aguardando + t.previas_aguardando} detalhe={`${t.briefings_aguardando} para a IA produzir · ${t.previas_aguardando} prévias com o lead`} />
        <Numero rotulo="Negócios novos" valor={fmtNum(soma((d) => d.negocios.total))} detalhe={`em ${dias} dias`} />
      </div>

      <Secao titulo="Dia a dia">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-left text-xs text-muted-foreground">
              <tr>
                <th className="py-1 pr-3">Dia</th>
                <th className="py-1 pr-3">Matérias</th>
                <th className="py-1 pr-3">Posts registrados</th>
                <th className="py-1 pr-3">Newsletter</th>
                <th className="py-1 pr-3">Lista</th>
                <th className="py-1 pr-3">Fila (env./resp.)</th>
                <th className="py-1 pr-3">Briefings</th>
                <th className="py-1 pr-3">Negócios</th>
              </tr>
            </thead>
            <tbody>
              {[...passado].reverse().map((d) => (
                <tr key={d.dia} className="border-t">
                  <td className="py-1.5 pr-3 font-medium">{fmtDiaCurto(d.dia)}</td>
                  <td className="py-1.5 pr-3">{d.materias}{d.sem_capa ? <span className="ml-1 text-xs text-destructive">({d.sem_capa} sem capa)</span> : null}</td>
                  <td className="py-1.5 pr-3 text-xs">{Object.entries(d.posts).map(([k, v]) => `${k} ${v}`).join(" · ") || "—"}</td>
                  <td className="py-1.5 pr-3">{d.newsletter.envios ? `${d.newsletter.entregues}/${d.newsletter.destinatarios}` : "—"}</td>
                  <td className="py-1.5 pr-3">{d.lista.total ? `${d.lista.contatados}/${d.lista.total}` : "—"}</td>
                  <td className="py-1.5 pr-3">{d.fila.primeiros + d.fila.followups ? `${d.fila.enviados}/${d.fila.primeiros + d.fila.followups} · ${d.fila.respondeu}` : "—"}</td>
                  <td className="py-1.5 pr-3">{d.briefings.enviados || d.briefings.aprovados ? `${d.briefings.enviados} rec. · ${d.briefings.aprovados} apr.` : "—"}</td>
                  <td className="py-1.5 pr-3">{d.negocios.total || "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="mt-2 text-xs text-muted-foreground">"Posts registrados" conta o que está em Pautas e conteúdo (link do post por canal). Instagram, Facebook, LinkedIn e Threads ainda não são lidos pela API: o número de matérias é a medida fiel do que sai por dia.</p>
      </Secao>

      <Secao titulo="O que está agendado (próximos 30 dias)">
        <ul className="divide-y text-sm">
          {futuro.filter((d) => d.agenda.length).map((d) => (
            <li key={d.dia} className="py-2">
              <p className="font-semibold">{fmtDiaCurto(d.dia)} <span className="font-normal text-muted-foreground">· {d.materias} matéria(s)</span></p>
              <ul className="mt-1 grid gap-0.5 text-xs text-muted-foreground sm:grid-cols-2">
                {d.agenda.map((a) => (
                  <li key={a.slug}><span className="font-mono">{a.hora}</span> {a.titulo}</li>
                ))}
              </ul>
            </li>
          ))}
        </ul>
      </Secao>
    </div>
  );
}
