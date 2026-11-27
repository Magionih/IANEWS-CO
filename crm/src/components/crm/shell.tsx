import { useEffect, useRef, useState, type ComponentType, type ReactNode } from "react";
import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import {
  BarChart3,
  Building2,
  CalendarCheck,
  CalendarDays,
  ChevronRight,
  Clapperboard,
  Home,
  KanbanSquare,
  Layers,
  LineChart,
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
  UserCog,
  Users,
  UsersRound,
  Wallet,
  X,
} from "lucide-react";

import logo from "@/assets/ianews-logo-white.png";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Sheet, SheetClose, SheetContent, SheetTitle } from "@/components/ui/sheet";
import { buscarCrm } from "@/lib/crm/core.functions";
import {
  getFinanceiro,
  getIndicadores,
  getOperacao,
  getPainelDono,
} from "@/lib/crm/metricas.functions";
import { fmtDia, hojeBR } from "@/lib/crm/utils";
import { cn } from "@/lib/utils";

import { CartaoNotificacoes, SinoAvisos } from "./avisos";
import { useCrm } from "./context";
import { CartaoFaceId } from "./faceid";
import { useEstadoTempoReal } from "./tempo-real";
import { AvisoRepeticao, GrupoBadge } from "./ui";

/* Moldura do CRM:
   - computador: menu lateral por blocos (Operação, Gestão, Análise), sino de avisos, busca (⌘K)
     e a conta no rodapé;
   - celular/app: topo com o título da tela, sino e busca; barra de abas na base; "Menu" abre a
     lista completa, organizada como os Ajustes do iPhone. */

type Item = {
  to: string;
  rotulo: string;
  icone: ComponentType<{ className?: string }>;
  exato?: boolean;
  admin?: boolean;
  /** Linha de apoio no menu do celular. */
  dica?: string;
};

/** Uma área do menu e as abas dela (as abas aparecem no topo da tela). */
type Secao = Item & { abas: Item[]; bloco: "Operação" | "Gestão" | "Análise" };

const SECOES: Secao[] = [
  {
    to: "/",
    rotulo: "Início",
    icone: Home,
    exato: true,
    abas: [],
    bloco: "Operação",
    dica: "Meta, caixa e o foco do dia",
  },
  {
    to: "/negocios",
    rotulo: "Negócios",
    icone: KanbanSquare,
    bloco: "Operação",
    dica: "Funis, lista e fila do dia, conversas",
    abas: [
      {
        to: "/negocios",
        rotulo: "Negócios",
        icone: KanbanSquare,
        dica: "Quadro e lista por funil",
      },
      { to: "/lista", rotulo: "Lista do dia", icone: ListOrdered, dica: "Quem abordar hoje" },
      { to: "/fila", rotulo: "Fila do dia", icone: Send, dica: "Mensagens prontas para enviar" },
      { to: "/direct", rotulo: "Conversas", icone: MessageCircle, dica: "Direct do Instagram" },
    ],
  },
  {
    to: "/operacao",
    rotulo: "Produção",
    icone: Layers,
    bloco: "Operação",
    dica: "Fila de produção, calendário e pautas",
    abas: [
      {
        to: "/operacao",
        rotulo: "Fila de produção",
        icone: Layers,
        dica: "Do material à publicação",
      },
      {
        to: "/calendario",
        rotulo: "Calendário",
        icone: CalendarDays,
        dica: "O que sai em cada dia",
      },
      {
        to: "/pautas",
        rotulo: "Pautas e conteúdo",
        icone: Newspaper,
        dica: "Pautas recebidas e matérias",
      },
      { to: "/producoes", rotulo: "Produções", icone: Clapperboard, dica: "Destaques automáticos" },
    ],
  },
  {
    to: "/financeiro",
    rotulo: "Financeiro",
    icone: Wallet,
    admin: true,
    abas: [],
    bloco: "Gestão",
    dica: "Vendas, caixa, cobranças e notas",
  },
  {
    to: "/clientes",
    rotulo: "Clientes",
    icone: Users,
    bloco: "Gestão",
    dica: "Clientes, empresas e pessoas",
    abas: [
      {
        to: "/clientes",
        rotulo: "Clientes e produtos",
        icone: Users,
        admin: true,
        dica: "LTV, recompra e margem",
      },
      { to: "/empresas", rotulo: "Empresas", icone: Building2, dica: "Base de empresas" },
      { to: "/pessoas", rotulo: "Pessoas", icone: UsersRound, dica: "Base de contatos" },
    ],
  },
  {
    to: "/audiencia",
    rotulo: "Audiência",
    icone: LineChart,
    bloco: "Análise",
    dica: "Site, newsletter e leitores",
    abas: [
      {
        to: "/audiencia",
        rotulo: "Site e newsletter",
        icone: LineChart,
        dica: "Visitas, leituras e assinantes",
      },
      {
        to: "/newsletter",
        rotulo: "Leads da newsletter",
        icone: Mail,
        dica: "Quem assinou e de onde veio",
      },
    ],
  },
  {
    to: "/indicadores",
    rotulo: "Indicadores",
    icone: BarChart3,
    bloco: "Análise",
    dica: "Visão geral, funil e vendas",
    abas: [
      {
        to: "/indicadores",
        rotulo: "Visão geral",
        icone: BarChart3,
        dica: "Leads, negócios e canais",
      },
      {
        to: "/comercial",
        rotulo: "Funil e vendas",
        icone: TrendingUp,
        dica: "Conversão e receita",
      },
    ],
  },
];

const ATALHOS: Item[] = [
  { to: "/tarefas", rotulo: "Tarefas", icone: CalendarCheck, dica: "O que vence hoje e depois" },
  {
    to: "/config",
    rotulo: "Configuração",
    icone: Settings,
    admin: true,
    dica: "Funis, tags, equipe e segurança",
  },
];

const BLOCOS = ["Operação", "Gestão", "Análise"] as const;

/** Abas fixas na base do celular (o resto fica em "Menu"). */
const ABAS_ADMIN = ["/", "/negocios", "/operacao", "/financeiro"];
const ABAS_EQUIPE = ["/", "/negocios", "/operacao", "/audiencia"];

const PAPEL_NOME: Record<string, string> = {
  admin: "Administrador",
  comercial: "Comercial",
  editorial: "Editorial",
};

const casa = (path: string, i: Item) =>
  i.exato ? path === i.to || path === `${i.to}/` : path === i.to || path.startsWith(`${i.to}/`);

/** Área do menu em que a tela atual está (pela própria rota ou por uma das abas). */
function useSecaoAtual(): Secao | null {
  const path = useRouterState({ select: (s) => s.location.pathname });
  return SECOES.find((sec) => casa(path, sec) || sec.abas.some((a) => casa(path, a))) ?? null;
}

/** Abas da área atual, no topo da página (some quando a área tem uma tela só). */
function SubAbas() {
  const { isAdmin } = useCrm();
  const sec = useSecaoAtual();
  const path = useRouterState({ select: (s) => s.location.pathname });
  const abas = (sec?.abas ?? []).filter((a) => !a.admin || isAdmin);
  if (abas.length < 2) return null;
  return (
    <nav
      aria-label={`Telas de ${sec?.rotulo}`}
      className="-mx-4 mb-5 overflow-x-auto px-4 sm:-mx-1 sm:px-1"
    >
      <ul className="flex min-w-max items-center gap-1 border-b border-border">
        {abas.map((a) => {
          const on = casa(path, a);
          return (
            <li key={a.to}>
              <Link
                to={a.to}
                aria-current={on ? "page" : undefined}
                className={cn(
                  "-mb-px flex h-10 items-center border-b-2 border-transparent px-3 text-[13.5px] font-medium text-muted-foreground transition hover:text-foreground",
                  on && "border-primary font-semibold text-foreground",
                )}
              >
                {a.rotulo}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

/** Todas as telas por bloco (busca global e menu). */
function useGrupos() {
  const { isAdmin } = useCrm();
  return [
    ...SECOES.filter((s) => !s.admin || isAdmin).map((s) => ({
      titulo: s.rotulo,
      itens: (s.abas.length ? s.abas : [s]).filter((i) => !i.admin || isAdmin),
    })),
    { titulo: "Atalhos", itens: ATALHOS.filter((i) => !i.admin || isAdmin) },
  ].filter((g) => g.itens.length);
}

function useAtivo() {
  const path = useRouterState({ select: (s) => s.location.pathname });
  return (i: Item) =>
    i.exato ? path === i.to || path === `${i.to}/` : path === i.to || path.startsWith(`${i.to}/`);
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

function useConta() {
  const { userId, membro, papeis } = useCrm();
  const email = useEmail();
  const nome = membro(userId) !== "—" ? membro(userId) : (email ?? "Equipe");
  const papel =
    papeis
      .filter((p) => p !== "reader")
      .map((p) => PAPEL_NOME[p] ?? p)
      .join(" · ") ||
    email ||
    "";
  return { nome, papel, email };
}

export function CrmShell({ children }: { children: ReactNode }) {
  const [busca, setBusca] = useState(false);
  const [menu, setMenu] = useState(false);
  const [conta, setConta] = useState(false);
  const path = useRouterState({ select: (s) => s.location.pathname });

  // ⌘K / Ctrl+K abre a busca em qualquer tela.
  useEffect(() => {
    const atalho = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setBusca((v) => !v);
      }
    };
    const abrir = () => setBusca(true);
    window.addEventListener("keydown", atalho);
    window.addEventListener("crm-abrir-busca", abrir);
    return () => {
      window.removeEventListener("keydown", atalho);
      window.removeEventListener("crm-abrir-busca", abrir);
    };
  }, []);

  // Fecha o menu do celular ao trocar de tela.
  useEffect(() => setMenu(false), [path]);

  return (
    <div className="app-shell bg-background">
      <MenuLateral onBuscar={() => setBusca(true)} onConta={() => setConta(true)} />
      <TopoCelular onBuscar={() => setBusca(true)} />
      <main className="crm-main px-4 pt-4 sm:px-6 sm:pt-5 lg:px-10 lg:pt-7">
        <div className="mx-auto w-full max-w-[1280px]">
          <SubAbas />
          {children}
        </div>
      </main>
      <BarraAbas onMenu={() => setMenu(true)} />
      <MenuCelular
        aberto={menu}
        onFechar={() => setMenu(false)}
        onConta={() => {
          setMenu(false);
          setConta(true);
        }}
      />
      <MinhaConta aberto={conta} onFechar={() => setConta(false)} />
      <BuscaGlobal aberto={busca} onFechar={() => setBusca(false)} />
      <AvisoInstalar />
    </div>
  );
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

/** Ponto verde "ao vivo" (tempo real conectado). */
function PontoAoVivo({ comTexto }: { comTexto?: boolean }) {
  const { conectado } = useEstadoTempoReal();
  return (
    <span
      className="inline-flex items-center gap-1.5 text-[11px] font-medium text-muted-foreground"
      title={
        conectado
          ? "Ao vivo: as telas se atualizam sozinhas a cada movimentação"
          : "Atualiza ao voltar para o app e a cada poucos minutos"
      }
    >
      <span className="relative flex h-2 w-2">
        {conectado ? (
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-60" />
        ) : null}
        <span
          className={cn(
            "relative inline-flex h-2 w-2 rounded-full",
            conectado ? "bg-emerald-500" : "bg-[#C3CBD9]",
          )}
        />
      </span>
      {comTexto ? (conectado ? "Ao vivo" : "Atualizado") : null}
    </span>
  );
}

/* ---------- Computador ---------- */

/** Ao passar o mouse numa área do menu, já busca os dados dela (a tela abre pronta). */
function usePrefetchArea() {
  const qc = useQueryClient();
  const { isAdmin } = useCrm();
  const painel = useServerFn(getPainelDono);
  const fin = useServerFn(getFinanceiro);
  const op = useServerFn(getOperacao);
  const ind = useServerFn(getIndicadores);
  return (to: string) => {
    const mes = hojeBR().slice(0, 7);
    const alvo: Record<string, () => void> = {
      "/": () => qc.prefetchQuery({ queryKey: ["crm", "painel-dono"], queryFn: () => painel() }),
      "/financeiro": () =>
        isAdmin &&
        qc.prefetchQuery({
          queryKey: ["crm", "financeiro", mes],
          queryFn: () => fin({ data: { mes } }),
        }),
      "/operacao": () => qc.prefetchQuery({ queryKey: ["crm", "operacao"], queryFn: () => op() }),
      "/indicadores": () =>
        qc.prefetchQuery({ queryKey: ["crm", "indicadores"], queryFn: () => ind() }),
    };
    alvo[to]?.();
  };
}

function MenuLateral({ onBuscar, onConta }: { onBuscar: () => void; onConta: () => void }) {
  const { isAdmin } = useCrm();
  const prefetch = usePrefetchArea();
  const sec = useSecaoAtual();
  const path = useRouterState({ select: (s) => s.location.pathname });
  const secoes = SECOES.filter((x) => !x.admin || isAdmin);
  const atalhos = ATALHOS.filter((x) => !x.admin || isAdmin);
  // Sem o painel de clientes (só admin), "Clientes" abre direto em Empresas.
  const destino = (x: Secao) => (x.to === "/clientes" && !isAdmin ? "/empresas" : x.to);
  const linha = (on: boolean) =>
    cn(
      "group flex h-9 items-center gap-3 rounded-[9px] px-2.5 text-[13.5px] font-medium text-nav-muted transition hover:bg-nav-hover hover:text-nav-foreground",
      on && "bg-[#EEF3FF] font-semibold text-primary hover:bg-[#E6EEFF] hover:text-primary",
    );
  return (
    <aside className="fixed inset-y-0 left-0 z-30 hidden w-[var(--sb)] flex-col border-r border-nav-border bg-nav text-nav-foreground lg:flex">
      <div className="flex items-center gap-2.5 px-4 pb-3 pt-5">
        <Link
          to="/"
          className="flex min-w-0 flex-1 items-center gap-2.5"
          aria-label="Início do CRM"
        >
          <span className="font-display flex h-8 w-8 shrink-0 items-center justify-center rounded-[9px] bg-primary text-[14px] font-bold text-white">
            IA
          </span>
          <span className="min-w-0">
            <span className="font-display block text-[16px] font-bold leading-tight tracking-[-0.02em]">
              IA News
            </span>
            <span className="block leading-tight">
              <PontoAoVivo comTexto />
            </span>
          </span>
        </Link>
        <SinoAvisos className="-mr-1.5" />
      </div>

      <div className="px-3.5">
        <button
          type="button"
          onClick={onBuscar}
          title="Buscar (⌘K)"
          className="flex h-9 w-full items-center gap-2 rounded-[9px] border border-nav-border bg-card px-3 text-left text-[13px] text-muted-foreground transition hover:border-primary/40 hover:text-foreground"
        >
          <Search className="h-4 w-4" />
          <span className="flex-1">Buscar</span>
          <kbd className="rounded border border-nav-border bg-background px-1.5 text-[10px] font-medium">
            ⌘K
          </kbd>
        </button>
      </div>

      <nav
        aria-label="Menu principal"
        className="nav-scroll mt-3 flex-1 overflow-y-auto px-3.5 pb-4"
      >
        {BLOCOS.map((bloco) => {
          const itens = secoes.filter((x) => x.bloco === bloco);
          if (!itens.length) return null;
          return (
            <div key={bloco} className="mt-3 first:mt-0">
              <p className="px-2.5 pb-1 pt-1 text-[10.5px] font-semibold uppercase tracking-[0.08em] text-muted-foreground/80">
                {bloco}
              </p>
              <ul className="space-y-px">
                {itens.map((x) => {
                  const on = sec?.to === x.to;
                  return (
                    <li key={x.to}>
                      <Link
                        to={destino(x)}
                        onMouseEnter={() => prefetch(x.to)}
                        onFocus={() => prefetch(x.to)}
                        aria-current={on ? "page" : undefined}
                        className={linha(on)}
                      >
                        <x.icone className="h-[17px] w-[17px] shrink-0" />
                        <span className="flex-1">{x.rotulo}</span>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </div>
          );
        })}
        <div className="mt-3">
          <p className="px-2.5 pb-1 pt-1 text-[10.5px] font-semibold uppercase tracking-[0.08em] text-muted-foreground/80">
            Atalhos
          </p>
          <ul className="space-y-px">
            {atalhos.map((x) => {
              const on = casa(path, x);
              return (
                <li key={x.to}>
                  <Link to={x.to} aria-current={on ? "page" : undefined} className={linha(on)}>
                    <x.icone className="h-[17px] w-[17px] shrink-0" />
                    {x.rotulo}
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      </nav>

      <ContaLateral onConta={onConta} />
    </aside>
  );
}

function ContaLateral({ onConta }: { onConta: () => void }) {
  const { nome, papel } = useConta();
  const sair = useSair();
  return (
    <div className="border-t border-nav-border px-2.5 py-2.5">
      <div className="flex items-center gap-1">
        <button
          type="button"
          onClick={onConta}
          title="Minha conta: Face ID e notificações"
          className="flex min-w-0 flex-1 items-center gap-2.5 rounded-[10px] px-1.5 py-1.5 text-left transition hover:bg-nav-hover"
        >
          <span className="flex h-[32px] w-[32px] shrink-0 items-center justify-center rounded-full bg-[#0F1729] text-[11px] font-bold text-white">
            {iniciais(nome)}
          </span>
          <span className="min-w-0 flex-1">
            <span className="block truncate text-[13px] font-semibold text-nav-foreground">
              {nome}
            </span>
            <span className="block truncate text-[11px] text-nav-muted">{papel}</span>
          </span>
        </button>
        <button
          type="button"
          onClick={sair}
          title="Sair"
          aria-label="Sair"
          className="rounded-md p-2 text-nav-muted transition hover:bg-nav-hover hover:text-destructive"
        >
          <LogOut className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}

function useTituloAtual() {
  const { isAdmin } = useCrm();
  const ativo = useAtivo();
  for (const s of SECOES) {
    const itens = (s.abas.length ? s.abas : [s]).filter((i) => !i.admin || isAdmin);
    const i = itens.find(ativo);
    if (i) return { grupo: s.rotulo, item: i };
  }
  const a = ATALHOS.find(ativo);
  return a ? { grupo: "Atalhos", item: a } : null;
}

/* ---------- Celular / app ---------- */

function TopoCelular({ onBuscar }: { onBuscar: () => void }) {
  const atual = useTituloAtual();
  return (
    <header className="safe-top sticky top-0 z-30 border-b border-nav-border bg-nav/95 text-nav-foreground backdrop-blur-md lg:hidden">
      <div className="flex h-[var(--topbar-h)] items-center gap-1.5 pl-4 pr-2">
        <Link to="/" className="shrink-0" aria-label="Início do CRM">
          <span className="font-display flex h-8 w-8 items-center justify-center rounded-[9px] bg-primary text-[13px] font-bold text-white">
            IA
          </span>
        </Link>
        <div className="min-w-0 flex-1 pl-2">
          <p className="truncate text-[15px] font-semibold leading-tight">
            {atual?.item.rotulo ?? "CRM"}
          </p>
          <p className="flex items-center gap-1.5 truncate text-[11px] leading-tight text-nav-muted">
            <PontoAoVivo />
            {atual && atual.grupo !== atual.item.rotulo ? atual.grupo : "IA News CRM"}
          </p>
        </div>
        <SinoAvisos claro />
        <button
          type="button"
          onClick={onBuscar}
          aria-label="Buscar"
          className="flex h-10 w-10 items-center justify-center rounded-full text-nav-foreground transition active:bg-nav-hover"
        >
          <Search className="h-5 w-5" />
        </button>
      </div>
    </header>
  );
}

function BarraAbas({ onMenu }: { onMenu: () => void }) {
  const { isAdmin } = useCrm();
  const sec = useSecaoAtual();
  const abas = (isAdmin ? ABAS_ADMIN : ABAS_EQUIPE)
    .map((to) => SECOES.find((x) => x.to === to))
    .filter((x): x is Secao => !!x && (!x.admin || isAdmin));
  const ativo = (i: Item) => sec?.to === i.to;
  const algumaAtiva = abas.some(ativo);
  const item = (on: boolean) =>
    cn(
      "flex h-full w-full flex-col items-center justify-center gap-[3px] text-[10.5px] font-medium text-muted-foreground transition active:scale-95",
      on && "font-semibold text-primary",
    );
  return (
    <nav
      aria-label="Navegação principal"
      className="safe-bottom fixed inset-x-0 bottom-0 z-30 border-t bg-card/95 backdrop-blur-md lg:hidden"
    >
      <ul className="mx-auto grid h-[var(--tabbar-h)] max-w-lg grid-cols-5 px-1">
        {abas.map((i) => {
          const on = ativo(i);
          return (
            <li key={i.to}>
              <Link to={i.to} aria-current={on ? "page" : undefined} className={item(on)}>
                <span
                  className={cn(
                    "flex h-7 w-12 items-center justify-center rounded-full transition",
                    on && "bg-primary/10",
                  )}
                >
                  <i.icone className="h-[19px] w-[19px]" />
                </span>
                {i.rotulo}
              </Link>
            </li>
          );
        })}
        <li>
          <button type="button" onClick={onMenu} className={item(!algumaAtiva)}>
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

const COR_BLOCO: Record<string, string> = {
  Operação: "bg-[#EEF3FF] text-primary",
  Gestão: "bg-emerald-50 text-emerald-700",
  Análise: "bg-violet-50 text-violet-700",
  Atalhos: "bg-amber-50 text-amber-700",
};

/** Menu completo no celular: lista por blocos (como os Ajustes do iPhone), com a conta no topo. */
function MenuCelular({
  aberto,
  onFechar,
  onConta,
}: {
  aberto: boolean;
  onFechar: () => void;
  onConta: () => void;
}) {
  const { isAdmin } = useCrm();
  const ativo = useAtivo();
  const { nome, papel } = useConta();
  const sair = useSair();
  const [q, setQ] = useState("");
  useEffect(() => {
    if (!aberto) setQ("");
  }, [aberto]);

  const termo = q.trim().toLowerCase();
  const grupos = [
    ...BLOCOS.map((b) => ({
      titulo: b as string,
      itens: SECOES.filter((s) => s.bloco === b && (!s.admin || isAdmin)).flatMap((s) =>
        (s.abas.length ? s.abas : [s]).filter((i) => !i.admin || isAdmin),
      ),
    })),
    { titulo: "Atalhos", itens: ATALHOS.filter((i) => !i.admin || isAdmin) },
  ]
    .map((g) => ({
      ...g,
      itens: termo
        ? g.itens.filter((i) => `${i.rotulo} ${i.dica ?? ""}`.toLowerCase().includes(termo))
        : g.itens,
    }))
    .filter((g) => g.itens.length);

  return (
    <Sheet open={aberto} onOpenChange={(v) => !v && onFechar()}>
      <SheetContent
        side="bottom"
        semFechar
        onOpenAutoFocus={(e) => e.preventDefault()}
        className="flex h-[92dvh] flex-col gap-0 rounded-t-[22px] bg-background p-0 lg:hidden"
      >
        <div className="mx-auto mt-2 h-1 w-10 shrink-0 rounded-full bg-[#D5DAE3]" aria-hidden />
        <div className="flex items-center justify-between px-4 pb-2 pt-2">
          <SheetTitle className="text-[20px] font-bold tracking-[-0.02em]">Menu</SheetTitle>
          <SheetClose
            aria-label="Fechar menu"
            className="flex h-9 w-9 items-center justify-center rounded-full bg-muted text-foreground transition active:scale-95"
          >
            <X className="h-4 w-4" />
          </SheetClose>
        </div>
        <div className="px-4 pb-3">
          <label className="flex h-10 items-center gap-2 rounded-[11px] bg-[#E9ECF1] px-3 text-muted-foreground">
            <Search className="h-4 w-4 shrink-0" />
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Ir para…"
              aria-label="Procurar tela"
              className="h-full w-full bg-transparent text-foreground outline-none placeholder:text-muted-foreground"
            />
          </label>
        </div>
        <div className="flex-1 overflow-y-auto overscroll-contain px-4 pb-[calc(1rem+env(safe-area-inset-bottom))]">
          {!termo ? (
            <button
              type="button"
              onClick={onConta}
              className="mb-4 flex w-full items-center gap-3 rounded-[14px] bg-card p-3 text-left shadow-[0_1px_2px_rgb(15_23_41/0.06)] transition active:scale-[0.99]"
            >
              <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-[#0F1729] text-sm font-bold text-white">
                {iniciais(nome)}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[15px] font-semibold">{nome}</span>
                <span className="block truncate text-[12.5px] text-muted-foreground">
                  {papel} · Face ID e notificações
                </span>
              </span>
              <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
            </button>
          ) : null}
          <div className="space-y-4">
            {grupos.map((g) => (
              <div key={g.titulo}>
                <p className="px-3 pb-1.5 text-[12px] font-semibold uppercase tracking-[0.06em] text-muted-foreground">
                  {g.titulo}
                </p>
                <ul className="overflow-hidden rounded-[14px] bg-card shadow-[0_1px_2px_rgb(15_23_41/0.06)]">
                  {g.itens.map((i, n) => {
                    const on = ativo(i);
                    return (
                      <li key={i.to}>
                        <Link
                          to={i.to}
                          onClick={onFechar}
                          className={cn(
                            "flex items-center gap-3 px-3 py-2.5 transition active:bg-muted",
                            on && "bg-primary/[0.05]",
                          )}
                        >
                          <span
                            className={cn(
                              "flex h-8 w-8 shrink-0 items-center justify-center rounded-[9px]",
                              COR_BLOCO[g.titulo] ?? "bg-muted text-foreground",
                            )}
                          >
                            <i.icone className="h-[17px] w-[17px]" />
                          </span>
                          <span
                            className={cn(
                              "flex min-w-0 flex-1 items-center gap-3 py-0.5",
                              n > 0 && "-mt-2.5 border-t border-[#EEF0F4] pt-3",
                            )}
                          >
                            <span className="min-w-0 flex-1">
                              <span
                                className={cn(
                                  "block truncate text-[15px]",
                                  on ? "font-semibold text-primary" : "font-medium",
                                )}
                              >
                                {i.rotulo}
                              </span>
                              {i.dica ? (
                                <span className="block truncate text-[12px] text-muted-foreground">
                                  {i.dica}
                                </span>
                              ) : null}
                            </span>
                            <ChevronRight className="h-4 w-4 shrink-0 text-[#B4BCCA]" />
                          </span>
                        </Link>
                      </li>
                    );
                  })}
                </ul>
              </div>
            ))}
            {!grupos.length ? (
              <p className="py-10 text-center text-[13px] text-muted-foreground">
                Nenhuma tela com esse nome.
              </p>
            ) : null}
          </div>
          {!termo ? (
            <button
              type="button"
              onClick={sair}
              className="mt-5 flex h-11 w-full items-center justify-center gap-2 rounded-[14px] bg-card text-[15px] font-semibold text-destructive shadow-[0_1px_2px_rgb(15_23_41/0.06)] active:scale-[0.99]"
            >
              <LogOut className="h-4 w-4" /> Sair
            </button>
          ) : null}
        </div>
      </SheetContent>
    </Sheet>
  );
}

/** Minha conta: Face ID e notificações deste aparelho (vale para toda a equipe, não só admin). */
function MinhaConta({ aberto, onFechar }: { aberto: boolean; onFechar: () => void }) {
  const { nome, papel, email } = useConta();
  const sair = useSair();
  return (
    <Sheet open={aberto} onOpenChange={(v) => !v && onFechar()}>
      <SheetContent className="flex w-full flex-col gap-0 bg-background p-0 sm:max-w-[460px]">
        <div className="border-b bg-card px-5 pb-4 pr-12 pt-[calc(1rem+env(safe-area-inset-top))]">
          <SheetTitle className="flex items-center gap-2 text-[16px]">
            <UserCog className="h-4 w-4 text-muted-foreground" /> Minha conta
          </SheetTitle>
          <p className="mt-0.5 truncate text-[12.5px] text-muted-foreground">
            {nome} · {papel || email}
          </p>
        </div>
        <div className="flex-1 space-y-4 overflow-y-auto p-4 pb-[calc(1rem+env(safe-area-inset-bottom))]">
          <CartaoFaceId />
          <CartaoNotificacoes />
          <Button variant="outline" className="h-10 w-full" onClick={sair}>
            <LogOut className="h-4 w-4" /> Sair do CRM
          </Button>
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
