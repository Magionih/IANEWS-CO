import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { diasEntre, hojeBR, somarDias } from "@/lib/crm/utils";

/* Filtro de período (uma linha acima dos números): atalhos + datas livres. */

export type Periodo = { inicio: string; fim: string };

export function usePeriodo(dias = 30) {
  const fim = hojeBR();
  return useState<Periodo>({ inicio: somarDias(fim, -(dias - 1)), fim });
}

export function FiltroPeriodo({
  valor,
  onChange,
}: {
  valor: Periodo;
  onChange: (p: Periodo) => void;
}) {
  const hoje = hojeBR();
  const atalho = (dias: number) => ({ inicio: somarDias(hoje, -(dias - 1)), fim: hoje });
  const ativo = (dias: number) =>
    valor.fim === hoje && diasEntre(valor.inicio, valor.fim) === dias - 1;
  const mes = { inicio: `${hoje.slice(0, 8)}01`, fim: hoje };
  return (
    <div className="flex flex-wrap items-center gap-2">
      {[7, 30, 90].map((d) => (
        <Button
          key={d}
          size="sm"
          variant={ativo(d) ? "default" : "outline"}
          className="h-9"
          onClick={() => onChange(atalho(d))}
        >
          {d} dias
        </Button>
      ))}
      <Button
        size="sm"
        variant={valor.inicio === mes.inicio && valor.fim === hoje ? "default" : "outline"}
        className="h-9"
        onClick={() => onChange(mes)}
      >
        Este mês
      </Button>
      <Input
        type="date"
        className="h-9 w-[150px]"
        value={valor.inicio}
        max={valor.fim}
        onChange={(e) => e.target.value && onChange({ ...valor, inicio: e.target.value })}
      />
      <span className="text-xs text-muted-foreground">até</span>
      <Input
        type="date"
        className="h-9 w-[150px]"
        value={valor.fim}
        min={valor.inicio}
        max={hoje}
        onChange={(e) => e.target.value && onChange({ ...valor, fim: e.target.value })}
      />
    </div>
  );
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
