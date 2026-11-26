import { useEffect, useRef, useState, type ComponentType, type ReactNode } from "react";
import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import {
  BadgeCheck,
  Building2,
  CalendarCheck,
  CalendarDays,
  ChevronDown,
  ChevronsLeft,
  ChevronsRight,
  ChevronRight,
  Clapperboard,
  Gauge,
  Home,
  KanbanSquare,
  ListOrdered,
  Loader2,
  LogOut,
  Mail,
  Menu,
  MessageCircle,
  Newspaper,
  Search,
  Send,
  Settings,
  Share,
  Shield,
  SquarePlus,
  TrendingUp,
  Users,
  UsersRound,
  Wallet,
  X,
} from "lucide-react";

import logo from "@/assets/ianews-logo-white.png";
import logoEscuro from "@/assets/ianews-logo.png";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Sheet, SheetClose, SheetContent, SheetTitle } from "@/components/ui/sheet";
import { buscarCrm } from "@/lib/crm/core.functions";
import { fmtDia } from "@/lib/crm/utils";
import { cn } from "@/lib/utils";

import { useCrm } from "./context";
import { AvisoRepeticao, GrupoBadge } from "./ui";

/* Moldura do CRM no formato de plataforma:
   - computador: menu lateral fixo (navy) por grupos, topo com título da área, busca (⌘K) e conta;
   - celular/app: topo compacto, barra de abas na base e "Menu" com todas as áreas. */

type Item = {
  to: string;
  rotulo: string;
  icone: ComponentType<{ className?: string }>;
  exato?: boolean;
  admin?: boolean;
};

type Grupo = { titulo: string; itens: Item[] };

/* Menu nas 5 camadas do documento de métricas estratégicas:
   Financeiro · Comercial · Operação · Audiência · Clientes e produtos.
   Verticais, Publicidade, Relatórios e Painel da operação saíram do menu (as telas continuam
   abrindo pelo endereço) porque os números delas agora estão nas camadas. */
const GRUPOS: Grupo[] = [
  {
    titulo: "Geral",
    itens: [
      { to: "/", rotulo: "Início", icone: Home, exato: true },
      { to: "/tarefas", rotulo: "Tarefas", icone: CalendarCheck },
    ],
  },
  {
    titulo: "Financeiro",
    itens: [{ to: "/financeiro", rotulo: "Caixa e resultado", icone: Wallet, admin: true }],
  },
  {
    titulo: "Comercial",
    itens: [
      { to: "/comercial", rotulo: "Funil e metas", icone: TrendingUp },
      { to: "/negocios", rotulo: "Negócios", icone: KanbanSquare },
      { to: "/empresas", rotulo: "Empresas", icone: Building2 },
      { to: "/pessoas", rotulo: "Pessoas", icone: UsersRound },
      { to: "/lista", rotulo: "Lista do dia", icone: ListOrdered },
      { to: "/fila", rotulo: "Fila do dia", icone: Send },
      { to: "/direct", rotulo: "Direct", icone: MessageCircle },
    ],
  },
  {
    titulo: "Operação",
    itens: [
      { to: "/operacao", rotulo: "Fila de produção", icone: Gauge },
      { to: "/calendario", rotulo: "Calendário", icone: CalendarDays },
      { to: "/pautas", rotulo: "Pautas e conteúdo", icone: Newspaper },
      { to: "/producoes", rotulo: "Produções", icone: Clapperboard },
    ],
  },
  {
    titulo: "Audiência",
    itens: [
      { to: "/audiencia", rotulo: "Site e newsletter", icone: Users },
      { to: "/newsletter", rotulo: "Leads da newsletter", icone: Mail },
    ],
  },
  {
    titulo: "Clientes",
    itens: [
      { to: "/clientes", rotulo: "Clientes e produtos", icone: BadgeCheck, admin: true },
      { to: "/config", rotulo: "Configuração", icone: Settings, admin: true },
    ],
  },
];

/** Abas fixas na base do celular (o resto fica em "Menu"). */
const ABAS = ["/", "/negocios", "/tarefas", "/calendario"];

const PAPEL_NOME: Record<string, string> = {
  admin: "Administrador",
  comercial: "Comercial",
  editorial: "Editorial",
};

function useAtivo() {
  const path = useRouterState({ select: (s) => s.location.pathname });
  return (i: Item) =>
    i.exato ? path === i.to || path === `${i.to}/` : path === i.to || path.startsWith(`${i.to}/`);
}

function useGrupos() {
  const { isAdmin } = useCrm();
  return GRUPOS.map((g) => ({ ...g, itens: g.itens.filter((i) => !i.admin || isAdmin) })).filter(
    (g) => g.itens.length,
  );
}

function useEmail() {
  const [email, setEmail] = useState<string | null>(null);
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setEmail(data.session?.user.email ?? null));
  }, []);
  return email;
}

function useSair() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  return async () => {
    queryClient.clear();
    await supabase.auth.signOut();
    navigate({ to: "/login", replace: true });
  };
}

function iniciais(nome: string) {
  const partes = nome
    .replace(/@.*/, "")
    .split(/[\s._-]+/)
    .filter(Boolean);
  return ((partes[0]?.[0] ?? "") + (partes[1]?.[0] ?? "")).toUpperCase() || "IA";
}

export function CrmShell({ children }: { children: ReactNode }) {
  const [busca, setBusca] = useState(false);
  const [menu, setMenu] = useState(false);
  const [recolhido, setRecolhido] = useRecolhido();
  const path = useRouterState({ select: (s) => s.location.pathname });

  // ⌘K / Ctrl+K abre a busca em qualquer tela.
  useEffect(() => {
    const atalho = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setBusca((v) => !v);
      }
    };
    window.addEventListener("keydown", atalho);
    return () => window.removeEventListener("keydown", atalho);
  }, []);

  // Fecha o menu do celular ao trocar de tela.
  useEffect(() => setMenu(false), [path]);

  return (
    <div className="app-shell bg-background" data-recolhido={recolhido ? "1" : "0"}>
      <MenuLateral
        recolhido={recolhido}
        onRecolher={() => setRecolhido(!recolhido)}
        onBuscar={() => setBusca(true)}
      />
      <TopoCelular onBuscar={() => setBusca(true)} onMenu={() => setMenu(true)} />
      <main className="crm-main mx-auto w-full max-w-[1600px] px-4 pt-4 sm:px-6 lg:pt-0">
        {children}
      </main>
      <BarraAbas onMenu={() => setMenu(true)} />
      <MenuCelular aberto={menu} onFechar={() => setMenu(false)} />
      <BuscaGlobal aberto={busca} onFechar={() => setBusca(false)} />
      <AvisoInstalar />
    </div>
  );
}

/** Menu lateral recolhido ou aberto (lembrado neste navegador). */
function useRecolhido(): [boolean, (v: boolean) => void] {
  const [v, setV] = useState(false);
  useEffect(() => {
    try {
      setV(window.localStorage.getItem("crm-menu-recolhido") === "1");
    } catch {
      /* sem armazenamento */
    }
  }, []);
  return [
    v,
    (x: boolean) => {
      setV(x);
      try {
        window.localStorage.setItem("crm-menu-recolhido", x ? "1" : "0");
      } catch {
        /* ignora */
      }
    },
  ];
}

/** Funis abertos recentemente (aparecem embaixo de "Negócios" no menu). */
const CHAVE_RECENTES = "crm-funis-recentes";
export function registrarFunilRecente(id: string) {
  try {
    const atual = JSON.parse(window.localStorage.getItem(CHAVE_RECENTES) ?? "[]") as string[];
    const novo = [id, ...atual.filter((x) => x !== id)].slice(0, 4);
    window.localStorage.setItem(CHAVE_RECENTES, JSON.stringify(novo));
    window.dispatchEvent(new Event(CHAVE_RECENTES));
  } catch {
    /* ignora */
  }
}
function useFunisRecentes() {
  const [ids, setIds] = useState<string[]>([]);
  useEffect(() => {
    const ler = () => {
      try {
        setIds(JSON.parse(window.localStorage.getItem(CHAVE_RECENTES) ?? "[]"));
      } catch {
        setIds([]);
      }
    };
    ler();
    window.addEventListener(CHAVE_RECENTES, ler);
    return () => window.removeEventListener(CHAVE_RECENTES, ler);
  }, []);
  return ids;
}

/* ---------- Computador ---------- */

function MenuLateral({
  recolhido,
  onRecolher,
  onBuscar,
}: {
  recolhido: boolean;
  onRecolher: () => void;
  onBuscar: () => void;
}) {
  const grupos = useGrupos();
  const ativo = useAtivo();
  const { funilNome } = useCrm();
  const recentes = useFunisRecentes();
  const funilAtual = useRouterState({
    select: (s) => (s.location.search as { funil?: string }).funil,
  });
  return (
    <aside className="fixed inset-y-0 left-0 z-30 hidden w-[var(--sb)] flex-col border-r border-nav-border bg-nav text-nav-foreground transition-[width] duration-200 lg:flex">
      <div
        className={cn(
          "flex h-[60px] shrink-0 items-center gap-2",
          recolhido ? "justify-center px-2" : "px-4",
        )}
      >
        <Link to="/" className="flex items-center gap-2" aria-label="Início do CRM">
          <img src="/icon-192.png" alt="" className="h-7 w-7 rounded-md" />
          {recolhido ? null : <img src={logoEscuro} alt="IA News" className="h-[15px] w-auto" />}
        </Link>
        {recolhido ? null : (
          <button
            type="button"
            onClick={onRecolher}
            title="Recolher menu"
            aria-label="Recolher menu"
            className="ml-auto rounded-md p-1.5 text-nav-muted transition hover:bg-nav-hover hover:text-nav-foreground"
          >
            <ChevronsLeft className="h-4 w-4" />
          </button>
        )}
      </div>

      <div className={cn("pb-2", recolhido ? "px-2" : "px-3")}>
        <button
          type="button"
          onClick={onBuscar}
          title="Buscar (⌘K)"
          className={cn(
            "flex w-full items-center gap-2 rounded-lg border border-nav-border bg-card text-left text-[13px] text-nav-muted shadow-[0_1px_2px_rgb(16_24_40/0.04)] transition hover:border-primary/40 hover:text-nav-foreground",
            recolhido ? "justify-center px-0 py-2" : "px-3 py-2",
          )}
        >
          <Search className="h-4 w-4" />
          {recolhido ? null : (
            <>
              <span className="flex-1">Buscar…</span>
              <kbd className="rounded border border-nav-border bg-background px-1.5 text-[10px] font-medium">
                ⌘K
              </kbd>
            </>
          )}
        </button>
      </div>

      <nav
        className={cn("nav-scroll flex-1 overflow-y-auto pb-4", recolhido ? "px-2" : "px-3")}
        aria-label="Menu do CRM"
      >
        {grupos.map((g, gi) => (
          <div key={g.titulo} className={cn(gi > 0 && "mt-2 border-t border-nav-border pt-2")}>
            <ul className="space-y-0.5">
              {g.itens.map((i) => {
                const on = ativo(i);
                const ehNegocios = i.to === "/negocios";
                return (
                  <li key={i.to}>
                    <Link
                      to={i.to}
                      title={recolhido ? i.rotulo : undefined}
                      aria-current={on ? "page" : undefined}
                      className={cn(
                        "group relative flex items-center gap-2.5 rounded-lg text-[13.5px] font-medium text-nav-muted transition hover:bg-nav-hover hover:text-nav-foreground",
                        recolhido ? "justify-center px-0 py-2.5" : "px-3 py-[7px]",
                        on &&
                          "bg-primary/[0.08] text-primary hover:bg-primary/[0.1] hover:text-primary",
                      )}
                    >
                      {on ? (
                        <span className="absolute inset-y-1.5 left-0 w-[3px] rounded-r bg-primary" />
                      ) : null}
                      <i.icone className="h-[17px] w-[17px] shrink-0" />
                      {recolhido ? null : (
                        <>
                          <span className="flex-1 truncate">{i.rotulo}</span>
                          {ehNegocios && recentes.length ? (
                            <ChevronDown
                              className={cn("h-3.5 w-3.5 transition", !on && "-rotate-90")}
                            />
                          ) : null}
                        </>
                      )}
                    </Link>
                    {ehNegocios && on && !recolhido && recentes.length ? (
                      <div className="mb-1 ml-[26px] mt-1 border-l border-nav-border pl-3">
                        <p className="py-1 text-[10.5px] font-semibold uppercase tracking-wide text-nav-muted/80">
                          Funis recentes
                        </p>
                        {recentes.map((id) => (
                          <Link
                            key={id}
                            to="/negocios"
                            search={{ funil: id }}
                            className={cn(
                              "block truncate rounded-md px-2 py-1 text-[12.5px] text-nav-muted hover:bg-nav-hover hover:text-nav-foreground",
                              funilAtual === id && "font-semibold text-primary",
                            )}
                          >
                            {funilNome(id)}
                          </Link>
                        ))}
                      </div>
                    ) : null}
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </nav>

      {recolhido ? (
        <button
          type="button"
          onClick={onRecolher}
          title="Abrir menu"
          aria-label="Abrir menu"
          className="mx-auto mb-2 rounded-md p-2 text-nav-muted transition hover:bg-nav-hover hover:text-nav-foreground"
        >
          <ChevronsRight className="h-4 w-4" />
        </button>
      ) : null}
      <ContaLateral recolhido={recolhido} />
    </aside>
  );
}

function ContaLateral({ recolhido }: { recolhido?: boolean }) {
  const { userId, membro, papeis } = useCrm();
  const email = useEmail();
  const sair = useSair();
  const nome = membro(userId) !== "—" ? membro(userId) : (email ?? "Equipe");
  const papel = papeis.filter((p) => p !== "reader").map((p) => PAPEL_NOME[p] ?? p)[0];
  return (
    <div className="border-t border-nav-border p-3">
      <div
        className={cn(
          "flex items-center gap-3 rounded-lg py-2",
          recolhido ? "justify-center px-0" : "px-2",
        )}
      >
        <span
          title={recolhido ? nome : undefined}
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary text-xs font-bold text-white"
        >
          {iniciais(nome)}
        </span>
        <div className={cn("min-w-0 flex-1", recolhido && "hidden")}>
          <p className="truncate text-[13px] font-semibold text-nav-foreground">{nome}</p>
          <p className="truncate text-[11px] text-nav-muted">{papel ?? email}</p>
        </div>
        <button
          type="button"
          onClick={sair}
          title="Sair"
          aria-label="Sair"
          className={cn(
            "rounded-md p-1.5 text-nav-muted transition hover:bg-nav-hover hover:text-destructive",
            recolhido && "hidden",
          )}
        >
          <LogOut className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}

function useTituloAtual() {
  const grupos = useGrupos();
  const ativo = useAtivo();
  for (const g of grupos) {
    const i = g.itens.find(ativo);
    if (i) return { grupo: g.titulo, item: i };
  }
  return null;
}

/* ---------- Celular / app ---------- */

function TopoCelular({ onBuscar, onMenu }: { onBuscar: () => void; onMenu: () => void }) {
  const atual = useTituloAtual();
  return (
    <header className="safe-top sticky top-0 z-30 border-b border-nav-border bg-nav text-nav-foreground lg:hidden">
      <div className="flex h-[var(--topbar-h)] items-center gap-2 px-3">
        <Link to="/" className="flex items-center gap-2 pl-1" aria-label="Início do CRM">
          <img src="/icon-192.png" alt="" className="h-7 w-7 rounded-md" />
        </Link>
        <div className="min-w-0 flex-1 pl-1">
          <p className="truncate text-[15px] font-semibold leading-tight">
            {atual?.item.rotulo ?? "CRM"}
          </p>
          <p className="truncate text-[11px] leading-tight text-nav-muted">
            {atual ? `${atual.grupo} · IA News CRM` : "IA News CRM"}
          </p>
        </div>
        <button
          type="button"
          onClick={onBuscar}
          aria-label="Buscar"
          className="flex h-10 w-10 items-center justify-center rounded-full text-nav-foreground transition active:bg-nav-hover"
        >
          <Search className="h-5 w-5" />
        </button>
        <button
          type="button"
          onClick={onMenu}
          aria-label="Abrir menu"
          className="flex h-10 w-10 items-center justify-center rounded-full text-nav-foreground transition active:bg-nav-hover"
        >
          <Menu className="h-5 w-5" />
        </button>
      </div>
    </header>
  );
}

function BarraAbas({ onMenu }: { onMenu: () => void }) {
  const grupos = useGrupos();
  const ativo = useAtivo();
  const todos = grupos.flatMap((g) => g.itens);
  const abas = ABAS.map((to) => todos.find((i) => i.to === to)).filter(Boolean) as Item[];
  const algumaAtiva = abas.some(ativo);
  return (
    <nav
      aria-label="Navegação principal"
      className="safe-bottom fixed inset-x-0 bottom-0 z-30 border-t bg-card/95 backdrop-blur-md lg:hidden"
    >
      <ul className="mx-auto grid h-[var(--tabbar-h)] max-w-lg grid-cols-5">
        {abas.map((i) => {
          const on = ativo(i);
          return (
            <li key={i.to}>
              <Link
                to={i.to}
                aria-current={on ? "page" : undefined}
                className={cn(
                  "flex h-full flex-col items-center justify-center gap-1 text-[10.5px] font-medium text-muted-foreground",
                  on && "text-primary",
                )}
              >
                <span
                  className={cn(
                    "flex h-7 w-12 items-center justify-center rounded-full transition",
                    on && "bg-primary/10",
                  )}
                >
                  <i.icone className="h-[19px] w-[19px]" />
                </span>
                {i.rotulo === "Lista do dia" ? "Lista" : i.rotulo}
              </Link>
            </li>
          );
        })}
        <li>
          <button
            type="button"
            onClick={onMenu}
            className={cn(
              "flex h-full w-full flex-col items-center justify-center gap-1 text-[10.5px] font-medium text-muted-foreground",
              !algumaAtiva && "text-primary",
            )}
          >
            <span
              className={cn(
                "flex h-7 w-12 items-center justify-center rounded-full",
                !algumaAtiva && "bg-primary/10",
              )}
            >
              <Menu className="h-[19px] w-[19px]" />
            </span>
            Menu
          </button>
        </li>
      </ul>
    </nav>
  );
}

function MenuCelular({ aberto, onFechar }: { aberto: boolean; onFechar: () => void }) {
  const grupos = useGrupos();
  const ativo = useAtivo();
  const { userId, membro, papeis } = useCrm();
  const email = useEmail();
  const sair = useSair();
  const nome = membro(userId) !== "—" ? membro(userId) : (email ?? "Equipe");
  return (
    <Sheet open={aberto} onOpenChange={(v) => !v && onFechar()}>
      <SheetContent
        side="bottom"
        semFechar
        onOpenAutoFocus={(e) => e.preventDefault()}
        className="flex max-h-[88dvh] flex-col gap-0 bg-background p-0 lg:hidden"
      >
        <div className="flex items-center justify-between border-b bg-card px-4 py-3">
          <SheetTitle className="text-base font-semibold">Menu</SheetTitle>
          <SheetClose
            aria-label="Fechar menu"
            className="flex h-9 w-9 items-center justify-center rounded-full bg-muted text-foreground transition active:scale-95"
          >
            <X className="h-4 w-4" />
          </SheetClose>
        </div>
        <div className="flex-1 overflow-y-auto overscroll-contain px-4 pb-[calc(1rem+env(safe-area-inset-bottom))] pt-4">
          <div className="mb-4 flex items-center gap-3 rounded-xl border bg-card p-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-full bg-primary text-sm font-bold text-white">
              {iniciais(nome)}
            </span>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold">{nome}</p>
              <p className="truncate text-xs text-muted-foreground">
                {papeis
                  .filter((p) => p !== "reader")
                  .map((p) => PAPEL_NOME[p] ?? p)
                  .join(" · ") || email}
              </p>
            </div>
            <Button variant="outline" size="sm" onClick={sair}>
              <LogOut className="h-4 w-4" /> Sair
            </Button>
          </div>
          <div className="space-y-4">
            {grupos.map((g) => (
              <div key={g.titulo}>
                <p className="px-1 pb-2 text-xs font-semibold text-muted-foreground">{g.titulo}</p>
                <div className="grid grid-cols-4 gap-2">
                  {g.itens.map((i) => {
                    const on = ativo(i);
                    return (
                      <Link
                        key={i.to}
                        to={i.to}
                        onClick={onFechar}
                        className={cn(
                          "flex min-h-[68px] flex-col items-center justify-center gap-1.5 rounded-xl border bg-card px-1 py-2.5 text-center text-[11px] font-medium leading-tight transition active:scale-[0.98]",
                          on && "border-primary/40 bg-primary/[0.06] text-primary",
                        )}
                      >
                        <i.icone
                          className={cn("h-5 w-5", on ? "text-primary" : "text-foreground/70")}
                        />
                        {i.rotulo}
                      </Link>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}

/** No iPhone (Safari, fora do app), explica como instalar o CRM na Tela de Início. */
function AvisoInstalar() {
  const [mostrar, setMostrar] = useState(false);
  useEffect(() => {
    try {
      const ua = window.navigator.userAgent;
      const ios = /iPhone|iPad|iPod/.test(ua) || (ua.includes("Mac") && "ontouchend" in document);
      const safari = /Safari/.test(ua) && !/CriOS|FxiOS|EdgiOS|Instagram|FBAN|FBAV/.test(ua);
      const instalado =
        window.matchMedia("(display-mode: standalone)").matches ||
        (window.navigator as Navigator & { standalone?: boolean }).standalone === true;
      const dispensado = window.localStorage.getItem("crm-aviso-instalar") === "1";
      if (ios && safari && !instalado && !dispensado) setMostrar(true);
    } catch {
      /* sem armazenamento: não mostra o aviso */
    }
  }, []);
  if (!mostrar) return null;
  const fechar = () => {
    setMostrar(false);
    try {
      window.localStorage.setItem("crm-aviso-instalar", "1");
    } catch {
      /* ignora */
    }
  };
  return (
    <div className="fixed inset-x-3 bottom-[calc(var(--tabbar-h)+env(safe-area-inset-bottom)+0.75rem)] z-40 rounded-2xl border bg-card p-4 shadow-[var(--shadow-pop)] lg:hidden">
      <button
        type="button"
        onClick={fechar}
        aria-label="Fechar aviso"
        className="absolute right-2 top-2 rounded-full p-1.5 text-muted-foreground"
      >
        <X className="h-4 w-4" />
      </button>
      <div className="flex gap-3 pr-6">
        <img src="/icon-192.png" alt="" className="h-11 w-11 shrink-0 rounded-xl" />
        <div className="text-sm">
          <p className="font-semibold">Instale o CRM no iPhone</p>
          <p className="mt-0.5 text-muted-foreground">
            Toque em <Share className="inline h-4 w-4 -translate-y-0.5 text-primary" /> Compartilhar
            e depois em{" "}
            <span className="whitespace-nowrap font-medium text-foreground">
              <SquarePlus className="inline h-4 w-4 -translate-y-0.5" /> Adicionar à Tela de Início
            </span>
            . Ele abre em tela cheia, como um app.
          </p>
        </div>
      </div>
    </div>
  );
}

/** Topo simples (usado na tela de acesso restrito, fora da moldura completa). */
export function TopoCrm() {
  const email = useEmail();
  const sair = useSair();
  return (
    <header className="safe-top sticky top-0 z-30 bg-nav text-white">
      <div className="mx-auto flex h-14 max-w-[1440px] items-center justify-between gap-3 px-4 sm:px-6 lg:px-8">
        <Link to="/" className="flex items-center gap-2.5">
          <img src="/icon-192.png" alt="" className="h-7 w-7 rounded-md" />
          <img src={logo} alt="IA News" className="h-[15px] w-auto" />
          <span className="rounded-md border border-white/15 px-1.5 py-0.5 text-[10px] font-semibold tracking-wide text-white/70">
            CRM
          </span>
        </Link>
        {email ? (
          <div className="flex items-center gap-3 text-sm">
            <span className="hidden text-white/70 sm:inline">{email}</span>
            <button
              type="button"
              onClick={sair}
              className="flex items-center gap-1.5 text-white/80 hover:text-white"
            >
              <LogOut className="h-4 w-4" /> Sair
            </button>
          </div>
        ) : null}
      </div>
    </header>
  );
}

export function SemAcesso({ mensagem }: { mensagem?: string }) {
  const navigate = useNavigate();
  async function trocarConta() {
    await supabase.auth.signOut();
    navigate({ to: "/login", replace: true });
  }
  return (
    <div className="min-h-screen bg-background">
      <TopoCrm />
      <div className="mx-4 mt-16 max-w-md rounded-2xl border bg-card p-10 text-center shadow-[var(--shadow-card)] sm:mx-auto">
        <Shield className="mx-auto h-10 w-10 text-muted-foreground" />
        <h1 className="mt-4 text-xl font-bold">Acesso restrito</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          {mensagem ?? "O CRM é só para a equipe autorizada (admin, comercial e editorial)."} Peça
          ao administrador para liberar seu acesso.
        </p>
        <Button className="mt-6" onClick={trocarConta}>
          Entrar com outra conta
        </Button>
      </div>
    </div>
  );
}

/* ---------- Busca global (⌘K) ---------- */

function BuscaGlobal({ aberto, onFechar }: { aberto: boolean; onFechar: () => void }) {
  const navigate = useNavigate();
  const buscar = useServerFn(buscarCrm);
  const grupos = useGrupos();
  const [q, setQ] = useState("");
  const [termo, setTermo] = useState("");
  const campo = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const t = setTimeout(() => setTermo(q.trim()), 250);
    return () => clearTimeout(t);
  }, [q]);

  useEffect(() => {
    if (!aberto) setQ("");
  }, [aberto]);

  const { data, isFetching } = useQuery({
    queryKey: ["crm", "busca", termo],
    queryFn: () => buscar({ data: { q: termo } }),
    enabled: aberto && termo.length >= 2,
    staleTime: 15_000,
  });

  const ir = (to: string, id: string) => {
    onFechar();
    navigate({ to, params: { id } });
  };

  const vazio = data && !data.empresas.length && !data.pessoas.length;
  const atalhos = grupos
    .flatMap((g) => g.itens)
    .filter((i) => !q || i.rotulo.toLowerCase().includes(q.trim().toLowerCase()));

  return (
    <DialogPrimitive.Root open={aberto} onOpenChange={(v) => !v && onFechar()}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-[#0b1220]/55 backdrop-blur-[2px] data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0" />
        <DialogPrimitive.Content
          onOpenAutoFocus={(e) => {
            e.preventDefault();
            campo.current?.focus();
          }}
          className="safe-top fixed inset-0 z-50 flex flex-col bg-card data-[state=open]:animate-in data-[state=open]:fade-in-0 sm:inset-auto sm:left-1/2 sm:top-[12vh] sm:max-h-[70vh] sm:w-full sm:max-w-xl sm:-translate-x-1/2 sm:rounded-xl sm:border sm:shadow-[var(--shadow-pop)]"
        >
          <DialogPrimitive.Title className="sr-only">Buscar no CRM</DialogPrimitive.Title>
          <div className="flex items-center gap-2 border-b px-4">
            <Search className="h-4 w-4 shrink-0 text-muted-foreground" />
            <input
              ref={campo}
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Buscar empresa, pessoa, e-mail…"
              aria-label="Busca global do CRM"
              className="h-14 w-full bg-transparent text-[15px] outline-none placeholder:text-muted-foreground"
            />
            {isFetching ? <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" /> : null}
            <DialogPrimitive.Close className="rounded-md px-2 py-1 text-sm font-medium text-primary sm:hidden">
              Cancelar
            </DialogPrimitive.Close>
            <kbd className="hidden rounded border px-1.5 text-[10px] text-muted-foreground sm:inline">
              Esc
            </kbd>
          </div>

          <div className="flex-1 overflow-y-auto p-2">
            {termo.length >= 2 && data ? (
              <>
                {vazio ? (
                  <p className="p-4 text-sm text-muted-foreground">
                    Nada encontrado. Pessoa e empresa ainda não apareceram no conteúdo.
                  </p>
                ) : null}
                {data.empresas.length ? <Rotulo>Empresas</Rotulo> : null}
                {data.empresas.map((e) => (
                  <ItemBusca key={e.id} onClick={() => ir("/empresas/$id", e.id)}>
                    <Icone>
                      <Building2 className="h-4 w-4" />
                    </Icone>
                    <div className="min-w-0 flex-1">
                      <p className="flex flex-wrap items-center gap-2 font-semibold">
                        {e.nome}
                        <GrupoBadge grupo={e.grupo as never} pontuacao={e.pontuacao} />
                        {e.e_cliente ? <span className="text-xs text-primary">cliente</span> : null}
                      </p>
                      <AvisoRepeticao
                        vezes={e.mencoes}
                        ultima={
                          e.ultima_mencao
                            ? `${e.ultima_mencao.titulo ?? ""} (${fmtDia(e.ultima_mencao.em)})`
                            : null
                        }
                      />
                    </div>
                  </ItemBusca>
                ))}
                {data.pessoas.length ? <Rotulo>Pessoas</Rotulo> : null}
                {data.pessoas.map((p) => (
                  <ItemBusca key={p.id} onClick={() => ir("/pessoas/$id", p.id)}>
                    <Icone>
                      <UsersRound className="h-4 w-4" />
                    </Icone>
                    <div className="min-w-0 flex-1">
                      <p className="font-semibold">{p.nome}</p>
                      <p className="truncate text-xs text-muted-foreground">
                        {[p.empresas.join(", "), p.email].filter(Boolean).join(" · ")}
                      </p>
                      <AvisoRepeticao
                        vezes={p.mencoes}
                        ultima={
                          p.ultima_mencao
                            ? `${p.ultima_mencao.titulo ?? ""} (${fmtDia(p.ultima_mencao.em)})`
                            : null
                        }
                      />
                    </div>
                  </ItemBusca>
                ))}
              </>
            ) : null}

            {atalhos.length && !(termo.length >= 2 && data && !vazio) ? (
              <>
                <Rotulo>Ir para</Rotulo>
                {atalhos.map((i) => (
                  <ItemBusca
                    key={i.to}
                    onClick={() => {
                      onFechar();
                      navigate({ to: i.to });
                    }}
                  >
                    <Icone>
                      <i.icone className="h-4 w-4" />
                    </Icone>
                    <span className="flex-1 font-medium">{i.rotulo}</span>
                    <ChevronRight className="h-4 w-4 text-muted-foreground" />
                  </ItemBusca>
                ))}
              </>
            ) : null}
          </div>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}

function Rotulo({ children }: { children: ReactNode }) {
  return <p className="px-3 pb-1 pt-3 text-xs font-semibold text-muted-foreground">{children}</p>;
}

function Icone({ children }: { children: ReactNode }) {
  return (
    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground">
      {children}
    </span>
  );
}

function ItemBusca({ children, onClick }: { children: ReactNode; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left text-sm transition hover:bg-muted focus-visible:bg-muted focus-visible:outline-none"
    >
      {children}
    </button>
  );
}
