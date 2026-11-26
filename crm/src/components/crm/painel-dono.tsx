import { useState } from "react";
import { Link } from "@tanstack/react-router";
import {
  AlertTriangle,
  ArrowRight,
  BadgeDollarSign,
  Check,
  CircleDollarSign,
  Gauge,
  Lock,
  Mail,
  PiggyBank,
  Target,
  TrendingUp,
} from "lucide-react";

import { Numero, Secao, Vazio, Variacao } from "@/components/crm/ui";
import type { ItemLista, PainelDono } from "@/lib/crm/metricas.functions";
import { fmtMoeda, fmtNum, fmtPct } from "@/lib/crm/utils";
import { cn } from "@/lib/utils";

/* Painel do dono (Henrique): no máximo 8 números, os alertas automáticos e as listas do dia. */

const fmtMeses = (n: number | null) =>
  n == null ? "—" : n >= 12 ? "12+ meses" : `${n.toFixed(1).replace(".", ",")} meses`;

export function NumerosDono({ d }: { d: PainelDono }) {
  const ritmoPct = d.ritmo?.pct ?? null;
  const travado = (
    <Link to="/operacao" className="block rounded-xl transition hover:-translate-y-0.5">
      <Numero
        rotulo="Travado na produção"
        valor={fmtMoeda(d.travado.valor)}
        detalhe={`${d.travado.qtd} pagos aguardando prévia ou publicação`}
        destaque={d.travado.valor > 0 ? "alerta" : undefined}
        icone={Lock}
      />
    </Link>
  );
  const pipeline = (
    <Link to="/comercial" className="block rounded-xl transition hover:-translate-y-0.5">
      <Numero
        rotulo="Pipeline ponderado"
        valor={fmtMoeda(d.pipeline.ponderado)}
        detalhe={`${fmtMoeda(d.pipeline.bruto)} bruto · ${d.pipeline.qtd} negócios`}
        icone={TrendingUp}
      />
    </Link>
  );
  if (!d.admin)
    return (
      <div className="grid grid-cols-2 gap-3">
        {pipeline}
        {travado}
      </div>
    );
  return (
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
      <Link to="/financeiro" className="block rounded-xl transition hover:-translate-y-0.5">
        <Numero
          rotulo="Recebido no mês"
          valor={fmtMoeda(d.recebidoMes)}
          detalhe={<Variacao atual={d.recebidoMes ?? 0} anterior={d.recebidoMesAnterior ?? 0} />}
          destaque="azul"
          icone={CircleDollarSign}
        />
      </Link>
      <Link to="/financeiro" className="block rounded-xl transition hover:-translate-y-0.5">
        <Numero
          rotulo="Lucro líquido do mês"
          valor={fmtMoeda(d.lucroMes)}
          detalhe={`margem ${fmtPct(d.margemMes)} · meta ${d.margemMeta}%`}
          destaque={d.lucroMes != null && d.lucroMes < 0 ? "alerta" : undefined}
          icone={PiggyBank}
        />
      </Link>
      <Link to="/financeiro" className="block rounded-xl transition hover:-translate-y-0.5">
        <Numero
          rotulo="Saldo de caixa"
          valor={d.saldo == null ? "Informe" : fmtMoeda(d.saldo)}
          detalhe={
            d.saldo == null ? "defina o saldo inicial" : `fôlego de ${fmtMeses(d.folegoMeses)}`
          }
          icone={Gauge}
        />
      </Link>
      <Link to="/financeiro" className="block rounded-xl transition hover:-translate-y-0.5">
        <Numero
          rotulo="Ritmo da meta"
          valor={fmtPct(ritmoPct)}
          detalhe={
            d.ritmo
              ? `${fmtMoeda(d.ritmo.ritmoMes)}/mês · precisa ${fmtMoeda(d.ritmo.necessarioMes)}`
              : null
          }
          destaque={ritmoPct != null && ritmoPct < 0.8 ? "alerta" : undefined}
          icone={Target}
        />
      </Link>
      <Link to="/financeiro" className="block rounded-xl transition hover:-translate-y-0.5">
        <Numero
          rotulo="Contas a receber"
          valor={fmtMoeda(d.receber?.valor)}
          detalhe={
            d.receber
              ? `${d.receber.qtd} cobranças${d.receber.vencido ? ` · ${fmtMoeda(d.receber.vencido)} vencido` : ""}`
              : null
          }
          destaque={d.receber?.vencido ? "alerta" : undefined}
          icone={BadgeDollarSign}
        />
      </Link>
      {pipeline}
      {travado}
      <Link to="/audiencia" className="block rounded-xl transition hover:-translate-y-0.5">
        <Numero
          rotulo="Newsletter e site (7 dias)"
          valor={d.audiencia ? fmtNum(d.audiencia.assinantes) : "—"}
          detalhe={
            d.audiencia
              ? `assinantes (+${fmtNum(d.audiencia.novos)}) · ${fmtNum(d.audiencia.visitas)} visitas`
              : "sem dados"
          }
          icone={Mail}
        />
      </Link>
    </div>
  );
}

export function AlertasDono({ alertas }: { alertas: PainelDono["alertas"] }) {
  if (!alertas.length)
    return (
      <div className="flex items-center gap-2 rounded-xl border border-emerald-600/20 bg-emerald-50 px-4 py-3 text-[13px] font-medium text-emerald-800">
        <Check className="h-4 w-4" /> Nenhum alerta agora. Caixa, cobrança, produção e funil em dia.
      </div>
    );
  return (
    <ul className="divide-y overflow-hidden rounded-xl border bg-card shadow-[var(--shadow-card)]">
      {alertas.map((a) => (
        <li key={a.id}>
          <Link
            to={a.link}
            className="flex items-center gap-3 px-4 py-3 transition hover:bg-[#f8faff] sm:px-5"
          >
            <span
              className={cn(
                "flex h-8 w-8 shrink-0 items-center justify-center rounded-lg",
                a.nivel === "alto"
                  ? "bg-destructive/10 text-destructive"
                  : "bg-amber-100 text-amber-700",
              )}
            >
              <AlertTriangle className="h-4 w-4" />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-[13.5px] font-semibold leading-snug">{a.titulo}</span>
              <span className="block truncate text-[12px] text-muted-foreground">{a.detalhe}</span>
            </span>
            <ArrowRight className="h-4 w-4 shrink-0 text-muted-foreground" />
          </Link>
        </li>
      ))}
    </ul>
  );
}

export function ListaDoDia({
  titulo,
  itens,
  vazio,
  link,
  onAbrir,
}: {
  titulo: string;
  itens: ItemLista[];
  vazio: string;
  link: string;
  onAbrir: (id: string) => void;
}) {
  const [todos, setTodos] = useState(false);
  const visiveis = todos ? itens : itens.slice(0, 6);
  return (
    <Secao
      titulo={titulo}
      contagem={itens.length}
      colado
      acoes={
        <Link to={link} className="text-xs font-semibold text-primary hover:underline">
          Ver tela
        </Link>
      }
    >
      {itens.length ? (
        <ul className="divide-y">
          {visiveis.map((i) => (
            <li key={i.id}>
              <button
                type="button"
                onClick={() => onAbrir(i.id)}
                className="flex w-full items-center gap-3 px-4 py-2.5 text-left transition hover:bg-[#f8faff] sm:px-5"
              >
                <span
                  className={cn(
                    "h-2 w-2 shrink-0 rounded-full",
                    i.alerta ? "bg-destructive" : "bg-primary/40",
                  )}
                />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[13px] font-semibold">{i.titulo}</span>
                  <span className="block truncate text-[11.5px] text-muted-foreground">
                    {i.detalhe}
                  </span>
                </span>
                {i.valor ? (
                  <span className="tabular shrink-0 text-[12.5px] font-semibold">
                    {fmtMoeda(i.valor)}
                  </span>
                ) : null}
              </button>
            </li>
          ))}
          {itens.length > 6 ? (
            <li>
              <button
                type="button"
                onClick={() => setTodos((v) => !v)}
                className="w-full px-4 py-2 text-center text-xs font-semibold text-primary hover:bg-[#f8faff]"
              >
                {todos ? "Mostrar menos" : `Ver mais ${itens.length - 6}`}
              </button>
            </li>
          ) : null}
        </ul>
      ) : (
        <div className="p-4">
          <Vazio>{vazio}</Vazio>
        </div>
      )}
    </Secao>
  );
}

export function ParaComecar({ itens }: { itens: PainelDono["comecar"] }) {
  const faltam = itens.filter((i) => !i.feito);
  const [aberto, setAberto] = useState(true);
  if (!faltam.length) return null;
  return (
    <section className="rounded-xl border border-primary/25 bg-primary/[0.03] shadow-[var(--shadow-card)]">
      <button
        type="button"
        onClick={() => setAberto((v) => !v)}
        className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left sm:px-5"
      >
        <span className="text-[14px] font-semibold">
          Para começar já{" "}
          <span className="text-[12px] font-medium text-muted-foreground">
            · {itens.length - faltam.length} de {itens.length} feitos
          </span>
        </span>
        <span className="text-xs font-semibold text-primary">{aberto ? "Esconder" : "Abrir"}</span>
      </button>
      {aberto ? (
        <ul className="grid gap-px border-t bg-border sm:grid-cols-2 lg:grid-cols-3">
          {itens.map((i) => (
            <li key={i.id} className="bg-card">
              <Link
                to={i.link}
                className="flex h-full items-start gap-3 px-4 py-3 hover:bg-[#f8faff]"
              >
                <span
                  className={cn(
                    "mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border",
                    i.feito ? "border-emerald-600 bg-emerald-600 text-white" : "border-border",
                  )}
                >
                  {i.feito ? <Check className="h-3 w-3" /> : null}
                </span>
                <span className="min-w-0">
                  <span
                    className={cn(
                      "block text-[13px] font-semibold",
                      i.feito && "text-muted-foreground line-through",
                    )}
                  >
                    {i.texto}
                  </span>
                  {i.detalhe ? (
                    <span className="block text-[11.5px] text-muted-foreground">{i.detalhe}</span>
                  ) : null}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      ) : null}
    </section>
  );
}
