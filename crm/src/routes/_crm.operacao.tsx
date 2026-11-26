import { useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { CalendarDays, Clapperboard } from "lucide-react";

import { NegocioPainel } from "@/components/crm/negocio";
import {
  Alternador,
  CabecalhoPagina,
  Carregando,
  Erro,
  Etiqueta,
  FaixaNumeros,
  Secao,
  Vazio,
} from "@/components/crm/ui";
import { Button } from "@/components/ui/button";
import { getOperacao } from "@/lib/crm/metricas.functions";
import { fmtDataHora, fmtMoeda, fmtNum, fmtPct, linkMateria } from "@/lib/crm/utils";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_crm/operacao")({
  component: OperacaoPage,
});

/* Camada 3 · Operação: fila de produção com os pagos primeiro, prazos (material → prévia em até
   2 dias, pagos 1; prévia → aprovação em até 3), valor travado, rascunhos vencidos e capacidade. */

function OperacaoPage() {
  const fetchOp = useServerFn(getOperacao);
  const [filtro, setFiltro] = useState<"todos" | "pagos" | "atrasados">("todos");
  const [aberto, setAberto] = useState<string | null>(null);
  const { data, isLoading, error } = useQuery({
    queryKey: ["crm", "operacao"],
    queryFn: () => fetchOp(),
    refetchInterval: 5 * 60_000,
  });
  if (isLoading) return <Carregando texto="Montando a fila de produção..." />;
  if (error || !data) return <Erro erro={error} />;

  const fila = data.fila.filter((f) =>
    filtro === "pagos" ? f.pago : filtro === "atrasados" ? f.atrasado : true,
  );
  const pagos = data.fila.filter((f) => f.pago);
  const s = data.semana;

  return (
    <div className="space-y-5">
      <CabecalhoPagina
        titulo="Operação"
        descricao="Produção das matérias vendidas: pagos sempre primeiro. Prazos: material → prévia em até 2 dias (pagos: 1); prévia → aprovação em até 3."
        acoes={
          <>
            <Button asChild variant="outline" size="sm" className="h-9">
              <Link to="/producoes">
                <Clapperboard className="h-4 w-4" />{" "}
                <span className="hidden sm:inline">Produções</span>
              </Link>
            </Button>
            <Button asChild variant="outline" size="sm" className="h-9">
              <Link to="/calendario">
                <CalendarDays className="h-4 w-4" />{" "}
                <span className="hidden sm:inline">Calendário</span>
              </Link>
            </Button>
          </>
        }
      />

      <FaixaNumeros
        itens={[
          {
            rotulo: "Valor travado",
            valor: fmtMoeda(data.valorTravado),
            detalhe: `${pagos.length} pagos sem publicar`,
            tom: data.valorTravado ? "alerta" : undefined,
          },
          {
            rotulo: "Na fila",
            valor: fmtNum(data.fila.length),
            detalhe: `${data.fila.filter((f) => f.atrasado).length} fora do prazo`,
          },
          {
            rotulo: "Prévias aguardando",
            valor: fmtNum(data.previasAguardando),
            detalhe: "esperando aprovação do cliente",
          },
          {
            rotulo: "Fechado → publicado",
            valor:
              data.fechadoAtePublicar == null
                ? "—"
                : `${data.fechadoAtePublicar.toFixed(1).replace(".", ",")} dias`,
            detalhe: "média",
          },
          {
            rotulo: "Publicadas (7 dias)",
            valor: fmtNum(s.publicadas),
            detalhe: `${fmtNum(s.agendadas7)} agendadas p/ 7 dias`,
          },
          {
            rotulo: "Com post ligado",
            valor: fmtPct(s.publicadas ? s.comPost / s.publicadas : null),
            detalhe: "canais completos",
          },
        ]}
      />

      <Secao
        titulo="Fila de produção"
        contagem={fila.length}
        colado
        acoes={
          <Alternador
            valor={filtro}
            onChange={setFiltro}
            opcoes={[
              { valor: "todos", rotulo: "Todos" },
              { valor: "pagos", rotulo: "Pagos" },
              { valor: "atrasados", rotulo: "Fora do prazo" },
            ]}
          />
        }
      >
        {fila.length ? (
          <ul className="divide-y">
            {fila.map((f) => (
              <li key={f.id}>
                <button
                  type="button"
                  onClick={() => setAberto(f.id)}
                  className="flex w-full flex-wrap items-center gap-3 px-4 py-2.5 text-left hover:bg-[#f8faff] sm:px-5"
                >
                  <span
                    className={cn(
                      "h-2 w-2 shrink-0 rounded-full",
                      f.atrasado ? "bg-destructive" : f.pago ? "bg-emerald-500" : "bg-primary/40",
                    )}
                  />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[13.5px] font-semibold">{f.cliente}</span>
                    <span className="block truncate text-[11.5px] text-muted-foreground">
                      {f.etapa} há {f.dias} dia{f.dias === 1 ? "" : "s"}
                    </span>
                  </span>
                  <span className="flex flex-wrap items-center gap-1.5">
                    {f.pago ? (
                      <Etiqueta tom="ok">pago</Etiqueta>
                    ) : f.cortesia ? (
                      <Etiqueta>cortesia</Etiqueta>
                    ) : (
                      <Etiqueta tom="azul">a receber</Etiqueta>
                    )}
                    <Etiqueta tom={f.material ? "ok" : "neutro"}>
                      {f.material ? "material ok" : "sem material"}
                    </Etiqueta>
                    {f.previa ? (
                      <Etiqueta tom={f.aprovado ? "ok" : "azul"}>
                        {f.aprovado ? "aprovado" : "prévia enviada"}
                      </Etiqueta>
                    ) : null}
                    {f.ajuste ? <Etiqueta tom="alerta">ajuste</Etiqueta> : null}
                    {f.atrasado ? <Etiqueta tom="alerta">fora do prazo</Etiqueta> : null}
                  </span>
                  <span className="tabular w-20 text-right text-[13px] font-semibold">
                    {f.valor ? fmtMoeda(f.valor) : "—"}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        ) : (
          <div className="p-5">
            <Vazio>Nada na fila.</Vazio>
          </div>
        )}
      </Secao>

      <div className="grid gap-5 xl:grid-cols-2">
        <ListaArtigos
          titulo="Rascunhos com data vencida"
          lista={data.rascunhosVencidos}
          vazio="Nenhum rascunho atrasado."
        />
        <ListaArtigos
          titulo="Próximas 24h sem capa"
          lista={data.semCapa24h}
          vazio="Todas as matérias das próximas 24h têm capa."
        />
      </div>
      <p className="text-[12px] text-muted-foreground">
        Retrabalho (prévias com ajuste pedido): {fmtPct(data.retrabalhoPct)}. Os tempos de prévia e
        aprovação passam a ser medidos conforme os briefings recebem material e prévia.
      </p>
      <NegocioPainel id={aberto} onClose={() => setAberto(null)} />
    </div>
  );
}

function ListaArtigos({
  titulo,
  lista,
  vazio,
}: {
  titulo: string;
  lista: { slug: string; title: string; published_at: string }[];
  vazio: string;
}) {
  return (
    <Secao titulo={titulo} contagem={lista.length} colado>
      {lista.length ? (
        <ul className="divide-y">
          {lista.map((a) => (
            <li key={a.slug} className="flex items-center gap-3 px-4 py-2.5 sm:px-5">
              <span className="w-28 shrink-0 text-[12px] font-semibold text-muted-foreground">
                {fmtDataHora(a.published_at)}
              </span>
              <a
                href={linkMateria(a.slug) ?? undefined}
                target="_blank"
                rel="noreferrer"
                className="line-clamp-2 min-w-0 flex-1 text-[13px] font-medium hover:text-primary"
              >
                {a.title}
              </a>
            </li>
          ))}
        </ul>
      ) : (
        <div className="p-4">
          <Vazio>{vazio}</Vazio>
        </div>
      )}
    </Secao>
  );
}
