import { useState } from "react";
import { CalendarRange } from "lucide-react";

import { FiltroSelect } from "@/components/crm/ui";
import { Input } from "@/components/ui/input";
import { diasEntre, hojeBR, somarDias } from "@/lib/crm/utils";

/* Filtro de período em lista (no lugar dos botões 7/30/90): atalhos e, se quiser, datas livres. */

export type Periodo = { inicio: string; fim: string };

type Atalho = "hoje" | "7" | "30" | "90" | "mes" | "mes_ant" | "ano" | "livre";

export function usePeriodo(dias = 30) {
  const fim = hojeBR();
  return useState<Periodo>({ inicio: somarDias(fim, -(dias - 1)), fim });
}

function mesAnterior(hoje: string): Periodo {
  const [a, m] = hoje.split("-").map(Number);
  const ini = new Date(Date.UTC(a, m - 2, 1));
  const fim = new Date(Date.UTC(a, m - 1, 0));
  return { inicio: ini.toISOString().slice(0, 10), fim: fim.toISOString().slice(0, 10) };
}

function periodoDe(atalho: Atalho, hoje: string): Periodo | null {
  switch (atalho) {
    case "hoje":
      return { inicio: hoje, fim: hoje };
    case "7":
    case "30":
    case "90":
      return { inicio: somarDias(hoje, -(Number(atalho) - 1)), fim: hoje };
    case "mes":
      return { inicio: `${hoje.slice(0, 8)}01`, fim: hoje };
    case "mes_ant":
      return mesAnterior(hoje);
    case "ano":
      return { inicio: `${hoje.slice(0, 4)}-01-01`, fim: hoje };
    default:
      return null;
  }
}

function atalhoDe(p: Periodo, hoje: string): Atalho {
  for (const a of ["hoje", "7", "30", "90", "mes", "mes_ant", "ano"] as Atalho[]) {
    const x = periodoDe(a, hoje);
    if (x && x.inicio === p.inicio && x.fim === p.fim) return a;
  }
  return "livre";
}

const fmtCurto = (d: string) => `${d.slice(8, 10)}/${d.slice(5, 7)}`;

export function FiltroPeriodo({
  valor,
  onChange,
}: {
  valor: Periodo;
  onChange: (p: Periodo) => void;
}) {
  const hoje = hojeBR();
  const atual = atalhoDe(valor, hoje);
  const [livre, setLivre] = useState(atual === "livre");
  const escolhido: Atalho = livre ? "livre" : atual;
  const dias = diasEntre(valor.inicio, valor.fim) + 1;

  return (
    <div className="flex flex-wrap items-center gap-2">
      <FiltroSelect<Atalho>
        valor={escolhido}
        icone={CalendarRange}
        titulo="Período"
        onChange={(a) => {
          if (a === "livre") return setLivre(true);
          setLivre(false);
          const p = periodoDe(a, hoje);
          if (p) onChange(p);
        }}
        opcoes={[
          { valor: "hoje", rotulo: "Hoje" },
          { valor: "7", rotulo: "Últimos 7 dias" },
          { valor: "30", rotulo: "Últimos 30 dias" },
          { valor: "90", rotulo: "Últimos 90 dias" },
          { valor: "mes", rotulo: "Este mês" },
          { valor: "mes_ant", rotulo: "Mês passado" },
          { valor: "ano", rotulo: "Este ano" },
          { valor: "livre", rotulo: "Escolher datas…" },
        ]}
      />
      {escolhido === "livre" ? (
        <div className="flex items-center gap-1.5">
          <Input
            type="date"
            aria-label="Início do período"
            className="h-9 w-[150px]"
            value={valor.inicio}
            max={valor.fim}
            onChange={(e) => e.target.value && onChange({ ...valor, inicio: e.target.value })}
          />
          <span className="text-xs text-muted-foreground">até</span>
          <Input
            type="date"
            aria-label="Fim do período"
            className="h-9 w-[150px]"
            value={valor.fim}
            min={valor.inicio}
            max={hoje}
            onChange={(e) => e.target.value && onChange({ ...valor, fim: e.target.value })}
          />
        </div>
      ) : (
        <span className="tabular hidden text-[12px] text-muted-foreground sm:inline">
          {fmtCurto(valor.inicio)} – {fmtCurto(valor.fim)} · {dias} dia{dias === 1 ? "" : "s"}
        </span>
      )}
    </div>
  );
}

/** O período anterior de mesmo tamanho (para comparar "vs. período anterior"). */
export function periodoAnterior(p: Periodo): Periodo {
  const dias = diasEntre(p.inicio, p.fim) + 1;
  const fim = somarDias(p.inicio, -1);
  return { inicio: somarDias(fim, -(dias - 1)), fim };
}

/** Completa os dias sem registro com zero (o banco só devolve dias com movimento). */
export function preencherDias<T extends { dia: string }>(
  periodo: Periodo,
  linhas: T[],
  vazio: (dia: string) => T,
): T[] {
  const mapa = new Map(linhas.map((l) => [l.dia, l]));
  const saida: T[] = [];
  for (let d = periodo.inicio; d <= periodo.fim; d = somarDias(d, 1))
    saida.push(mapa.get(d) ?? vazio(d));
  return saida;
}
