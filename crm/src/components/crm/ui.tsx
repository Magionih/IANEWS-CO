import type { ComponentType, ReactNode } from "react";
import { AlertTriangle, Download, Flame, Loader2, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import type { CrmGrupo } from "@/lib/crm/types";
import { baixarCsv, GRUPO_DESCRICAO, type CsvColuna } from "@/lib/crm/utils";

/* Peças visuais comuns das telas do CRM (identidade do painel, azul nos destaques). */

/** Cabeçalho da página: no computador é uma barra fixa no topo (título à esquerda, ações à direita);
 *  a descrição vira um ícone de ajuda para não poluir a tela. `titulo` aceita um elemento
 *  (ex.: seletor de funil no lugar do título). */
export function CabecalhoPagina({
  titulo,
  descricao,
  acoes,
}: {
  titulo: ReactNode;
  descricao?: string;
  acoes?: ReactNode;
}) {
  return (
    <div className="mb-1 flex items-center justify-between gap-3 lg:sticky lg:top-0 lg:z-20 lg:-mx-6 lg:mb-5 lg:h-[60px] lg:border-b lg:bg-card/95 lg:px-6 lg:backdrop-blur-md">
      <div className="flex min-w-0 flex-1 items-center gap-2">
        {typeof titulo === "string" ? (
          <h1 className="truncate text-[20px] font-semibold leading-tight tracking-[-0.015em] lg:text-[18px]">
            {titulo}
          </h1>
        ) : (
          titulo
        )}
        {descricao ? (
          <span
            title={descricao}
            aria-label={descricao}
            className="hidden h-5 w-5 shrink-0 cursor-help items-center justify-center rounded-full border text-[11px] font-semibold text-muted-foreground lg:inline-flex"
          >
            ?
          </span>
        ) : null}
      </div>
      {acoes ? (
        <div className="flex max-w-[70%] flex-wrap items-center justify-end gap-2 md:max-w-[65%] [&>*]:shrink-0">
          {acoes}
        </div>
      ) : null}
    </div>
  );
}

/** Barra de ferramentas logo abaixo do cabeçalho (busca, visão, filtros, contagem, ordenação). */
export function BarraFerramentas({
  children,
  direita,
}: {
  children: ReactNode;
  direita?: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-2 xl:flex-row xl:items-center">
      <div className="flex min-w-0 flex-1 flex-wrap items-center gap-2">{children}</div>
      {direita ? <div className="flex shrink-0 items-center gap-2">{direita}</div> : null}
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
        "relative overflow-hidden rounded-xl border bg-card p-3 shadow-[var(--shadow-card)] sm:p-4",
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
        <p className="text-[11.5px] font-medium leading-snug text-muted-foreground sm:text-[12.5px]">
          {rotulo}
        </p>
        {Icone ? (
          <span
            className={cn(
              "hidden h-8 w-8 shrink-0 items-center justify-center rounded-lg sm:flex",
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
          "tabular mt-1 text-[20px] font-semibold leading-none tracking-[-0.02em] sm:mt-1.5 sm:text-[26px]",
          destaque === "alerta" && "text-destructive",
        )}
      >
        {valor}
      </p>
      {detalhe ? (
        <p className="mt-1 text-[11px] leading-snug text-muted-foreground sm:mt-1.5 sm:text-xs">
          {detalhe}
        </p>
      ) : null}
    </div>
  );
}

export function Secao({
  titulo,
  contagem,
  acoes,
  children,
  className,
  colado,
}: {
  titulo: ReactNode;
  contagem?: number;
  acoes?: ReactNode;
  children: ReactNode;
  className?: string;
  /** Sem margem interna (listas que vão de borda a borda). */
  colado?: boolean;
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
      <div className={colado ? "" : "p-4 sm:p-5"}>{children}</div>
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
        "inline-flex items-center gap-1 whitespace-nowrap rounded-full px-2 py-0.5 text-[11px] font-semibold ring-1 ring-inset",
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
      <Download className="h-4 w-4" /> <span className="hidden sm:inline">CSV</span>
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

/** Alternador compacto (lista/quadro, pagos/cortesia...). */
export function Alternador<T extends string>({
  valor,
  onChange,
  opcoes,
  className,
}: {
  valor: T;
  onChange: (v: T) => void;
  opcoes: {
    valor: T;
    rotulo?: ReactNode;
    icone?: ComponentType<{ className?: string }>;
    titulo?: string;
  }[];
  className?: string;
}) {
  return (
    <div
      role="radiogroup"
      className={cn("inline-flex h-10 shrink-0 items-center rounded-lg bg-muted p-1", className)}
    >
      {opcoes.map((o) => {
        const on = o.valor === valor;
        return (
          <button
            key={o.valor}
            type="button"
            role="radio"
            aria-checked={on}
            aria-label={o.titulo}
            title={o.titulo}
            onClick={() => onChange(o.valor)}
            className={cn(
              "inline-flex h-8 items-center gap-1.5 whitespace-nowrap rounded-md px-2.5 text-[13px] font-medium text-muted-foreground transition",
              on && "bg-card text-foreground shadow-[0_1px_2px_rgb(16_24_40/0.08)]",
            )}
          >
            {o.icone ? <o.icone className="h-4 w-4" /> : null}
            {o.rotulo}
          </button>
        );
      })}
    </div>
  );
}

/** Iniciais do membro em círculo (responsável, dono). */
export function Avatar({ nome, className }: { nome: string; className?: string }) {
  // Só palavras que começam com letra ou número ("Matéria · Patrícia" → "MP").
  const partes = nome.split(/\s+/).filter((p) => /^[\p{L}\p{N}]/u.test(p));
  const ini = ((partes[0]?.[0] ?? "") + (partes[1]?.[0] ?? "")).toUpperCase() || "—";
  return (
    <span
      title={nome}
      className={cn(
        "inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary/10 text-[10px] font-semibold text-primary",
        className,
      )}
    >
      {ini}
    </span>
  );
}

/** Filtro aplicado, com botão para tirar. */
export function ChipFiltro({ children, onTirar }: { children: ReactNode; onTirar: () => void }) {
  return (
    <span className="inline-flex items-center gap-1 rounded-full border bg-card py-0.5 pl-2.5 pr-1 text-xs font-medium shadow-[var(--shadow-card)]">
      {children}
      <button
        type="button"
        onClick={onTirar}
        aria-label="Tirar filtro"
        className="rounded-full p-0.5 text-muted-foreground hover:bg-muted hover:text-foreground"
      >
        <X className="h-3 w-3" />
      </button>
    </span>
  );
}

/** Faixa de números num painel só (mais compacta que vários cartões, boa no celular). */
export function FaixaNumeros({
  itens,
  children,
}: {
  itens: { rotulo: string; valor: ReactNode; detalhe?: ReactNode; tom?: "alerta" | "azul" }[];
  children?: ReactNode;
}) {
  const cols =
    itens.length >= 6 ? "lg:grid-cols-6" : itens.length === 5 ? "lg:grid-cols-5" : "lg:grid-cols-4";
  return (
    <section className="overflow-hidden rounded-xl border bg-card shadow-[var(--shadow-card)]">
      <dl className={cn("grid grid-cols-3 gap-px bg-border", cols)}>
        {itens.map((x) => (
          <div key={x.rotulo} className="min-w-0 bg-card px-3 py-3 sm:px-4">
            <dt className="truncate text-[11.5px] font-medium text-muted-foreground">{x.rotulo}</dt>
            <dd
              className={cn(
                "tabular mt-0.5 truncate text-[15px] font-semibold tracking-[-0.01em] sm:text-xl",
                x.tom === "alerta" && "text-destructive",
                x.tom === "azul" && "text-primary",
              )}
            >
              {x.valor}
            </dd>
            {x.detalhe ? (
              <dd className="truncate text-[11px] text-muted-foreground">{x.detalhe}</dd>
            ) : null}
          </div>
        ))}
        {/* Completa a última linha no celular para a grade não ficar com buraco. */}
        {Array.from({ length: (3 - (itens.length % 3)) % 3 }, (_, i) => (
          <div key={`v${i}`} className="bg-card lg:hidden" />
        ))}
      </dl>
      {children}
    </section>
  );
}

/** Rodapé de tabela com paginação ("Anterior · 1 2 3 · Próxima"). */
export function Paginacao({
  pagina,
  total,
  porPagina,
  onMudar,
}: {
  pagina: number;
  total: number;
  porPagina: number;
  onMudar: (p: number) => void;
}) {
  const paginas = Math.max(1, Math.ceil(total / porPagina));
  if (paginas <= 1)
    return (
      <div className="border-t px-5 py-2.5 text-[12px] text-muted-foreground">{total} itens</div>
    );
  const ini = Math.max(0, Math.min(pagina - 2, paginas - 5));
  const nums = Array.from({ length: Math.min(5, paginas) }, (_, i) => ini + i);
  return (
    <div className="flex flex-wrap items-center justify-between gap-2 border-t px-5 py-2.5 text-[12.5px]">
      <span className="text-muted-foreground">
        {pagina * porPagina + 1}–{Math.min(total, (pagina + 1) * porPagina)} de {total}
      </span>
      <div className="flex items-center gap-1">
        <button
          type="button"
          disabled={pagina === 0}
          onClick={() => onMudar(pagina - 1)}
          className="rounded-md px-2.5 py-1 font-medium hover:bg-muted disabled:opacity-40"
        >
          Anterior
        </button>
        {nums.map((n) => (
          <button
            key={n}
            type="button"
            onClick={() => onMudar(n)}
            className={cn(
              "tabular h-7 min-w-7 rounded-md px-2 font-semibold",
              n === pagina ? "bg-primary text-primary-foreground" : "hover:bg-muted",
            )}
          >
            {n + 1}
          </button>
        ))}
        <button
          type="button"
          disabled={pagina >= paginas - 1}
          onClick={() => onMudar(pagina + 1)}
          className="rounded-md px-2.5 py-1 font-medium hover:bg-muted disabled:opacity-40"
        >
          Próxima
        </button>
      </div>
    </div>
  );
}

/** Variação contra o período anterior: "+14% vs. mês anterior" (verde/vermelho). */
export function Variacao({
  atual,
  anterior,
  rotulo = "vs. mês anterior",
}: {
  atual: number;
  anterior: number;
  rotulo?: string;
}) {
  if (!anterior && !atual) return <span className="text-muted-foreground">sem dados {rotulo}</span>;
  if (!anterior)
    return (
      <span>
        <b className="font-semibold text-emerald-600">Novo</b>{" "}
        <span className="text-muted-foreground">{rotulo}</span>
      </span>
    );
  const pct = ((atual - anterior) / anterior) * 100;
  const sobe = pct >= 0;
  return (
    <span>
      <b className={cn("font-semibold", sobe ? "text-emerald-600" : "text-destructive")}>
        {sobe ? "+" : ""}
        {pct.toFixed(1).replace(".", ",")}%
      </b>{" "}
      <span className="text-muted-foreground">{rotulo}</span>
    </span>
  );
}
