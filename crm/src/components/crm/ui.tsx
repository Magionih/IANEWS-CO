import type { ComponentType, CSSProperties, ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import { AlertTriangle, ChevronDown, Download, Flame, Loader2, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import type { CrmGrupo } from "@/lib/crm/types";
import { urlSegura, baixarCsv, GRUPO_DESCRICAO, type CsvColuna } from "@/lib/crm/utils";

/* Peças visuais comuns das telas do CRM (identidade do painel, azul nos destaques). */

/** Cabeçalho da página: no computador é uma barra fixa no topo (título à esquerda, ações à direita);
 *  a descrição vira um ícone de ajuda para não poluir a tela. `titulo` aceita um elemento
 *  (ex.: seletor de funil no lugar do título). */
export function CabecalhoPagina({
  titulo,
  descricao,
  subtitulo,
  acoes,
}: {
  titulo: ReactNode;
  /** Explicação longa: fica num "?" discreto (passe o mouse para ler). */
  descricao?: string;
  /** Linha curta sob o título, com os números que importam. */
  subtitulo?: ReactNode;
  acoes?: ReactNode;
}) {
  return (
    <header className="flex flex-wrap items-center justify-between gap-x-4 gap-y-3">
      <div className="min-w-0 flex-1">
        <div className="flex min-w-0 items-center gap-2">
          {typeof titulo === "string" ? (
            <h1 className="font-display truncate text-[24px] font-bold leading-tight tracking-[-0.02em] sm:text-[28px]">
              {titulo}
            </h1>
          ) : (
            titulo
          )}
          {descricao ? (
            <span
              title={descricao}
              aria-label={descricao}
              className="hidden h-5 w-5 shrink-0 cursor-help items-center justify-center rounded-full border text-[11px] font-semibold text-muted-foreground sm:inline-flex"
            >
              ?
            </span>
          ) : null}
        </div>
        {subtitulo ? (
          <p className="mt-1 text-[14px] text-muted-foreground [&_b]:font-semibold [&_b]:text-foreground">
            {subtitulo}
          </p>
        ) : null}
      </div>
      {acoes ? (
        <div className="flex flex-wrap items-center justify-end gap-2 [&>*]:shrink-0">{acoes}</div>
      ) : null}
    </header>
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
    <div className="flex flex-col gap-2 lg:flex-row lg:items-center">
      <div className="flex min-w-0 flex-1 flex-wrap items-center gap-2 lg:flex-nowrap">
        {children}
      </div>
      {direita ? <div className="flex shrink-0 items-center gap-2">{direita}</div> : null}
    </div>
  );
}

type Tom = "alerta" | "azul" | "ok";

const COR_TOM: Record<Tom, string> = {
  alerta: "font-semibold text-[#B4530A]",
  ok: "font-semibold text-[#0E7A55]",
  azul: "font-semibold text-primary",
};

/** Um número dentro do painel de números (padrão banco: rótulo, valor e detalhe numa célula,
 *  separadas por linhas finas). Use dentro de <PainelNumeros>. */
export function Numero({
  rotulo,
  valor,
  detalhe,
  destaque,
  link,
}: {
  rotulo: string;
  valor: ReactNode;
  detalhe?: ReactNode;
  destaque?: Tom;
  icone?: ComponentType<{ className?: string }>;
  /** Tela que abre ao tocar no número. */
  link?: string;
}) {
  const conteudo = (
    <>
      <dt className="truncate text-[11.5px] font-medium text-muted-foreground sm:text-[12px]">
        {rotulo}
      </dt>
      <dd className="font-display tabular mt-1 truncate text-[18px] font-semibold leading-tight tracking-[-0.015em] text-foreground sm:text-[20px] lg:text-[22px]">
        {valor}
      </dd>
      {detalhe ? (
        <dd
          className={cn(
            "mt-0.5 line-clamp-2 text-[11.5px] leading-snug text-muted-foreground sm:truncate sm:text-[12px]",
            destaque && COR_TOM[destaque],
          )}
        >
          {detalhe}
        </dd>
      ) : null}
    </>
  );
  return link ? (
    <Link to={link} className="kpi-celula kpi-link">
      {conteudo}
    </Link>
  ) : (
    <div className="kpi-celula">{conteudo}</div>
  );
}

/** Colunas no computador: tudo numa linha até 6 números; acima disso, linhas cheias. */
function colunasKpi(n: number) {
  if (n <= 6) return Math.max(2, n);
  if (n % 4 === 0) return 4;
  if (n % 3 === 0) return 3;
  if (n % 5 === 0) return 5;
  return 4;
}

/** Painel único de números, com divisórias finas (2 colunas no celular, uma linha no computador). */
export function PainelNumeros({
  children,
  className,
  quantidade,
}: {
  children: ReactNode;
  className?: string;
  /** Quantos números (para caber numa linha só no computador). */
  quantidade?: number;
}) {
  return (
    <div className={cn("kpi-painel", className)}>
      <dl
        className="kpi-grade"
        style={quantidade ? ({ "--kpi-n": colunasKpi(quantidade) } as CSSProperties) : {}}
      >
        {children}
      </dl>
    </div>
  );
}

/** Cartão padrão das telas (título, linha de apoio e ação à direita). */
export function Cartao({
  titulo,
  sub,
  extra,
  className,
  children,
  colado,
}: {
  titulo: ReactNode;
  sub?: ReactNode;
  extra?: ReactNode;
  className?: string;
  children: ReactNode;
  /** Sem margem interna embaixo (listas de borda a borda). */
  colado?: boolean;
}) {
  return (
    <section className={cn("flex min-w-0 flex-col rounded-xl border bg-card", className)}>
      <header className="flex items-start justify-between gap-3 px-4 pt-4 sm:px-5">
        <div className="min-w-0">
          <h2 className="text-[14.5px] font-semibold tracking-[-0.01em]">{titulo}</h2>
          {sub ? <p className="mt-0.5 text-[12.5px] text-muted-foreground">{sub}</p> : null}
        </div>
        {extra ? <div className="flex shrink-0 items-center gap-2">{extra}</div> : null}
      </header>
      <div className={cn("mt-3 flex flex-1 flex-col", colado ? "" : "px-4 pb-4 sm:px-5 sm:pb-5")}>
        {children}
      </div>
    </section>
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
    <section className={cn("min-w-0 rounded-xl border bg-card", className)}>
      <header className="flex flex-wrap items-center justify-between gap-2 px-4 pb-2.5 pt-4 sm:px-5">
        <h2 className="flex items-center gap-2 text-[14.5px] font-semibold tracking-[-0.01em]">
          {titulo}
          {contagem != null ? (
            <span className="tabular rounded-full bg-muted px-1.5 py-px text-[11.5px] font-semibold text-muted-foreground">
              {contagem}
            </span>
          ) : null}
        </h2>
        {acoes ? <div className="flex flex-wrap items-center gap-2">{acoes}</div> : null}
      </header>
      <div className={colado ? "pb-1" : "px-4 pb-4 sm:px-5 sm:pb-5"}>{children}</div>
    </section>
  );
}

/** Esqueleto de carregamento: mostra a forma da tela enquanto os dados chegam (sem tela "travada"). */
export function Carregando({ texto = "Carregando..." }: { texto?: string }) {
  return (
    <div role="status" aria-live="polite" aria-label={texto} className="space-y-5">
      <div className="h-8 w-48 animate-pulse rounded-lg bg-[#E9ECF1]" />
      <div className="h-[84px] animate-pulse rounded-xl border bg-card" />
      <div className="grid gap-4 lg:grid-cols-[3fr_2fr]">
        <div className="h-64 animate-pulse rounded-xl border bg-card" />
        <div className="h-64 animate-pulse rounded-xl border bg-card" />
      </div>
    </div>
  );
}

/** Filtro em lista (no lugar de vários botões): ícone, rótulo curto e a opção escolhida. */
export function FiltroSelect<T extends string>({
  valor,
  onChange,
  opcoes,
  rotulo,
  icone: Icone,
  className,
  titulo,
}: {
  valor: T;
  onChange: (v: T) => void;
  opcoes: { valor: T; rotulo: string }[];
  /** Prefixo discreto ("Período", "Situação"). */
  rotulo?: string;
  icone?: ComponentType<{ className?: string }>;
  className?: string;
  /** Nome para leitores de tela, quando não há rótulo visível. */
  titulo?: string;
}) {
  return (
    <label
      className={cn(
        "filtro-select relative inline-flex h-9 min-w-0 max-w-full shrink-0 items-center gap-1.5 rounded-[10px] border border-input bg-card pl-3 text-[13px] font-medium text-foreground shadow-[0_1px_1px_rgb(15_23_41/0.03)] transition hover:border-[#C3CBD9] focus-within:border-primary focus-within:ring-2 focus-within:ring-primary/15",
        className,
      )}
    >
      {Icone ? <Icone className="h-4 w-4 shrink-0 text-muted-foreground" /> : null}
      {rotulo ? <span className="shrink-0 text-muted-foreground">{rotulo}</span> : null}
      <select
        value={valor}
        aria-label={titulo ?? rotulo}
        onChange={(e) => onChange(e.target.value as T)}
        className="h-full min-w-0 flex-1 cursor-pointer appearance-none truncate bg-transparent pr-8 font-semibold outline-none"
      >
        {opcoes.map((o) => (
          <option key={o.valor} value={o.valor}>
            {o.rotulo}
          </option>
        ))}
      </select>
      <ChevronDown className="pointer-events-none absolute right-2.5 h-4 w-4 text-muted-foreground" />
    </label>
  );
}

/** Abas de uma tela: no computador, sublinhado; no celular viram um filtro em lista. */
export function Abas<T extends string>({
  valor,
  onChange,
  opcoes,
  rotulo = "Ver",
}: {
  valor: T;
  onChange: (v: T) => void;
  opcoes: { valor: T; rotulo: string; contagem?: ReactNode }[];
  rotulo?: string;
}) {
  return (
    <>
      <FiltroSelect
        valor={valor}
        onChange={onChange}
        rotulo={rotulo}
        className="w-full sm:hidden"
        opcoes={opcoes.map((o) => ({
          valor: o.valor,
          rotulo:
            o.contagem != null && o.contagem !== "" ? `${o.rotulo} · ${o.contagem}` : o.rotulo,
        }))}
      />
      <nav role="tablist" className="-mx-1 hidden overflow-x-auto px-1 sm:block">
        <ul className="flex min-w-max items-center gap-1 border-b">
          {opcoes.map((o) => {
            const on = o.valor === valor;
            return (
              <li key={o.valor}>
                <button
                  type="button"
                  role="tab"
                  aria-selected={on}
                  onClick={() => onChange(o.valor)}
                  className={cn(
                    "-mb-px flex h-10 items-center gap-1.5 border-b-2 border-transparent px-3 text-[13.5px] font-medium text-muted-foreground transition hover:text-foreground",
                    on && "border-primary font-semibold text-foreground",
                  )}
                >
                  {o.rotulo}
                  {o.contagem != null && o.contagem !== "" ? (
                    <span
                      className={cn(
                        "tabular rounded-full px-1.5 py-px text-[11px] font-semibold",
                        on ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground",
                      )}
                    >
                      {o.contagem}
                    </span>
                  ) : null}
                </button>
              </li>
            );
          })}
        </ul>
      </nav>
    </>
  );
}

/** Indicador de dados ao vivo (pisca quando uma atualização chega). */
export function AoVivo({ className }: { className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 text-[11.5px] font-medium text-muted-foreground",
        className,
      )}
      title="As telas se atualizam sozinhas a cada movimentação"
    >
      <span className="relative flex h-2 w-2">
        <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-60" />
        <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
      </span>
      Ao vivo
    </span>
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
    <p className="rounded-xl border border-dashed border-[#D5DAE3] px-4 py-8 text-center text-[13px] text-muted-foreground">
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
  const seguro = urlSegura(href);
  if (!seguro) return null;
  return (
    <a
      href={seguro}
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
      className={cn(
        "inline-flex h-[38px] max-w-full shrink-0 items-center gap-0.5 overflow-x-auto rounded-[10px] bg-[#ECEEF2] p-[3px]",
        className,
      )}
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
              "inline-flex h-8 items-center gap-1.5 whitespace-nowrap rounded-lg px-3.5 text-[13px] font-medium text-[#3A4456] transition hover:text-foreground",
              on && "bg-card font-semibold text-foreground shadow-[0_1px_2px_rgb(15_23_41/0.08)]",
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

/** Faixa de números num painel só, padrão banco: compacta, com divisórias finas. */
export function FaixaNumeros({
  itens,
  children,
}: {
  itens: {
    rotulo: string;
    valor: ReactNode;
    detalhe?: ReactNode;
    tom?: Tom;
    link?: string;
  }[];
  children?: ReactNode;
}) {
  return (
    <section className="space-y-3">
      <PainelNumeros quantidade={itens.length}>
        {itens.map((x) => (
          <Numero
            key={x.rotulo}
            rotulo={x.rotulo}
            valor={x.valor}
            detalhe={x.detalhe}
            destaque={x.tom}
            link={x.link}
          />
        ))}
      </PainelNumeros>
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
