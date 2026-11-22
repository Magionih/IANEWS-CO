import type { ComponentType, ReactNode } from "react";
import { AlertTriangle, Download, Flame, Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import type { CrmGrupo } from "@/lib/crm/types";
import { baixarCsv, GRUPO_DESCRICAO, type CsvColuna } from "@/lib/crm/utils";

/* Peças visuais comuns das telas do CRM (identidade do painel, azul nos destaques). */

export function CabecalhoPagina({
  titulo,
  descricao,
  acoes,
}: {
  titulo: string;
  descricao?: string;
  acoes?: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between md:gap-6">
      <div className="min-w-0 flex-1">
        <h1 className="text-[22px] font-semibold leading-tight tracking-[-0.02em] sm:text-[26px]">
          {titulo}
        </h1>
        {descricao ? (
          <p className="mt-1 max-w-3xl text-[13.5px] leading-relaxed text-muted-foreground">
            {descricao}
          </p>
        ) : null}
      </div>
      {acoes ? (
        <div className="-mx-4 flex items-center gap-2 overflow-x-auto px-4 pb-0.5 [scrollbar-width:none] sm:mx-0 sm:px-0 md:max-w-[62%] md:flex-wrap md:justify-end md:overflow-visible [&>*]:shrink-0">
          {acoes}
        </div>
      ) : null}
    </div>
  );
}

export function Numero({
  rotulo,
  valor,
  detalhe,
  destaque,
  icone: Icone,
}: {
  rotulo: string;
  valor: ReactNode;
  detalhe?: ReactNode;
  destaque?: "alerta" | "azul";
  icone?: ComponentType<{ className?: string }>;
}) {
  return (
    <div
      className={cn(
        "relative overflow-hidden rounded-xl border bg-card p-3.5 shadow-[var(--shadow-card)] sm:p-4",
        destaque === "alerta" && "border-destructive/30",
        destaque === "azul" && "border-primary/30",
      )}
    >
      {destaque ? (
        <span
          className={cn(
            "absolute inset-x-0 top-0 h-[3px]",
            destaque === "alerta" ? "bg-destructive" : "bg-primary",
          )}
        />
      ) : null}
      <div className="flex items-start justify-between gap-2">
        <p className="text-[12.5px] font-medium leading-snug text-muted-foreground">{rotulo}</p>
        {Icone ? (
          <span
            className={cn(
              "flex h-7 w-7 shrink-0 items-center justify-center rounded-lg sm:h-8 sm:w-8",
              destaque === "alerta"
                ? "bg-destructive/10 text-destructive"
                : "bg-primary/[0.08] text-primary",
            )}
          >
            <Icone className="h-4 w-4" />
          </span>
        ) : null}
      </div>
      <p
        className={cn(
          "tabular mt-1.5 text-[22px] font-semibold leading-none tracking-[-0.02em] sm:text-[26px]",
          destaque === "alerta" && "text-destructive",
        )}
      >
        {valor}
      </p>
      {detalhe ? <p className="mt-1.5 text-xs text-muted-foreground">{detalhe}</p> : null}
    </div>
  );
}

export function Secao({
  titulo,
  contagem,
  acoes,
  children,
  className,
}: {
  titulo: ReactNode;
  contagem?: number;
  acoes?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section
      className={cn("min-w-0 rounded-xl border bg-card shadow-[var(--shadow-card)]", className)}
    >
      <header className="flex flex-wrap items-center justify-between gap-2 border-b px-4 py-3 sm:px-5">
        <h2 className="flex items-center gap-2 text-[14px] font-semibold tracking-[-0.01em]">
          {titulo}
          {contagem != null ? (
            <span className="tabular rounded-full bg-muted px-2 py-0.5 text-[11px] font-semibold text-muted-foreground">
              {contagem}
            </span>
          ) : null}
        </h2>
        {acoes ? <div className="flex flex-wrap items-center gap-2">{acoes}</div> : null}
      </header>
      <div className="p-4 sm:p-5">{children}</div>
    </section>
  );
}

/** Esqueleto de carregamento: mostra a forma da tela enquanto os dados chegam (sem tela "travada"). */
export function Carregando({ texto = "Carregando..." }: { texto?: string }) {
  return (
    <div role="status" aria-live="polite" className="space-y-4 py-2">
      <span className="flex items-center gap-2 text-xs text-muted-foreground">
        <Loader2 className="h-3.5 w-3.5 animate-spin" /> {texto}
      </span>
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="h-24 animate-pulse rounded-xl border bg-card" />
        ))}
      </div>
      <div className="space-y-2">
        {[0, 1, 2, 3, 4].map((i) => (
          <div
            key={i}
            className="h-9 animate-pulse rounded-md bg-muted/70"
            style={{ width: `${95 - i * 9}%` }}
          />
        ))}
      </div>
    </div>
  );
}

export function Erro({ erro }: { erro: unknown }) {
  return (
    <div className="flex items-start gap-2 rounded-xl border border-destructive/30 bg-destructive/5 p-4 text-sm">
      <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-destructive" />
      <span>{erro instanceof Error ? erro.message : "Não foi possível carregar."}</span>
    </div>
  );
}

export function Vazio({ children }: { children: ReactNode }) {
  return (
    <p className="rounded-lg border border-dashed bg-muted/40 px-4 py-8 text-center text-sm text-muted-foreground">
      {children}
    </p>
  );
}

const GRUPO_COR: Record<CrmGrupo, string> = {
  A: "bg-primary text-primary-foreground",
  B: "bg-primary/[0.1] text-primary ring-1 ring-inset ring-primary/20",
  C: "bg-muted text-muted-foreground ring-1 ring-inset ring-border",
};

export function GrupoBadge({
  grupo,
  manual,
  pontuacao,
}: {
  grupo: CrmGrupo | null;
  manual?: boolean;
  pontuacao?: number;
}) {
  if (!grupo) return <span className="text-xs text-muted-foreground">—</span>;
  return (
    <span
      title={`Grupo ${grupo}: ${GRUPO_DESCRICAO[grupo]}${manual ? " (definido à mão)" : ""}${pontuacao != null ? ` · ${pontuacao} pontos` : ""}`}
      className={cn(
        "inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-xs font-bold",
        GRUPO_COR[grupo],
      )}
    >
      {grupo}
      {pontuacao != null ? <span className="font-medium opacity-80">{pontuacao}</span> : null}
      {manual ? <span aria-label="manual">*</span> : null}
    </span>
  );
}

export function Etiqueta({
  children,
  tom = "neutro",
}: {
  children: ReactNode;
  tom?: "neutro" | "azul" | "alerta" | "ok";
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold ring-1 ring-inset",
        tom === "neutro" && "bg-muted text-muted-foreground ring-border",
        tom === "azul" && "bg-primary/[0.07] text-primary ring-primary/20",
        tom === "alerta" && "bg-destructive/[0.07] text-destructive ring-destructive/20",
        tom === "ok" && "bg-emerald-50 text-emerald-700 ring-emerald-600/20",
      )}
    >
      {children}
    </span>
  );
}

export function AvisoRepeticao({ vezes, ultima }: { vezes: number; ultima?: string | null }) {
  if (!vezes) return null;
  return (
    <Etiqueta tom="alerta">
      <Flame className="h-3 w-3" /> Já apareceu {vezes}x{ultima ? ` · ${ultima}` : ""}
    </Etiqueta>
  );
}

export function BotaoCsv<T>({
  nome,
  linhas,
  colunas,
}: {
  nome: string;
  linhas: T[];
  colunas: CsvColuna<T>[];
}) {
  return (
    <Button
      variant="outline"
      size="sm"
      className="h-9"
      onClick={() => baixarCsv(nome, linhas, colunas)}
      disabled={!linhas.length}
    >
      <Download className="mr-1.5 h-4 w-4" /> CSV
    </Button>
  );
}

export function Campo({
  rotulo,
  children,
  dica,
  className,
}: {
  rotulo: string;
  children: ReactNode;
  dica?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("space-y-1.5", className)}>
      <Label className="text-xs font-semibold">{rotulo}</Label>
      {children}
      {dica ? <p className="text-[11px] text-muted-foreground">{dica}</p> : null}
    </div>
  );
}

/** Lista de links externos (site, Instagram, LinkedIn, WhatsApp) com ícones simples. */
export function LinkExterno({ href, children }: { href: string | null; children: ReactNode }) {
  if (!href) return null;
  return (
    <a
      href={href}
      target="_blank"
      rel="noreferrer noopener"
      className="text-primary underline-offset-2 hover:underline"
    >
      {children}
    </a>
  );
}
