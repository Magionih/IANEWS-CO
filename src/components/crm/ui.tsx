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
    <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div className="min-w-0">
        <h1 className="text-2xl font-extrabold tracking-tight sm:text-3xl">{titulo}</h1>
        {descricao ? (
          <p className="mt-1 max-w-3xl text-sm text-muted-foreground">{descricao}</p>
        ) : null}
      </div>
      {acoes ? <div className="flex flex-wrap items-center gap-2">{acoes}</div> : null}
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
        "rounded-[var(--radius)] border bg-card p-4",
        destaque === "alerta" && "border-destructive/40 bg-destructive/5",
        destaque === "azul" && "border-primary/40 bg-primary/5",
      )}
    >
      <div className="flex items-center justify-between gap-2">
        <p className="font-mono-eyebrow text-muted-foreground">{rotulo}</p>
        {Icone ? <Icone className="h-4 w-4 text-muted-foreground" /> : null}
      </div>
      <p
        className={cn(
          "mt-1 text-2xl font-extrabold tracking-tight",
          destaque === "alerta" && "text-destructive",
        )}
      >
        {valor}
      </p>
      {detalhe ? <p className="mt-0.5 text-xs text-muted-foreground">{detalhe}</p> : null}
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
    <section className={cn("rounded-[var(--radius)] border bg-card", className)}>
      <header className="flex flex-wrap items-center justify-between gap-2 border-b px-4 py-3">
        <h2 className="text-sm font-bold">
          {titulo}
          {contagem != null ? <span className="ml-1.5 text-primary">({contagem})</span> : null}
        </h2>
        {acoes ? <div className="flex items-center gap-2">{acoes}</div> : null}
      </header>
      <div className="p-4">{children}</div>
    </section>
  );
}

export function Carregando({ texto = "Carregando..." }: { texto?: string }) {
  return (
    <div className="flex items-center justify-center gap-2 p-10 text-sm text-muted-foreground">
      <Loader2 className="h-4 w-4 animate-spin" /> {texto}
    </div>
  );
}

export function Erro({ erro }: { erro: unknown }) {
  return (
    <div className="flex items-start gap-2 rounded-[var(--radius)] border border-destructive/40 bg-destructive/5 p-4 text-sm">
      <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-destructive" />
      <span>{erro instanceof Error ? erro.message : "Não foi possível carregar."}</span>
    </div>
  );
}

export function Vazio({ children }: { children: ReactNode }) {
  return <p className="py-6 text-center text-sm text-muted-foreground">{children}</p>;
}

const GRUPO_COR: Record<CrmGrupo, string> = {
  A: "bg-primary text-primary-foreground",
  B: "bg-primary/15 text-primary",
  C: "bg-muted text-muted-foreground",
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
        "inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[11px] font-semibold",
        tom === "neutro" && "bg-muted text-muted-foreground",
        tom === "azul" && "bg-primary/10 text-primary",
        tom === "alerta" && "bg-destructive/10 text-destructive",
        tom === "ok" &&
          "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-200",
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
