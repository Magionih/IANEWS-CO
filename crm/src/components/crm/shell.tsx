import { useEffect, useRef, useState, type ComponentType, type ReactNode } from "react";
import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  BarChart3,
  Building2,
  CalendarCheck,
  Home,
  KanbanSquare,
  LogOut,
  Loader2,
  Megaphone,
  Newspaper,
  Search,
  Settings,
  Shield,
  Users,
  UsersRound,
} from "lucide-react";

import logo from "@/assets/ianews-logo-white.png";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { buscarCrm } from "@/lib/crm/core.functions";
import { fmtDia } from "@/lib/crm/utils";
import { cn } from "@/lib/utils";

import { useCrm } from "./context";
import { AvisoRepeticao, GrupoBadge } from "./ui";

/* Moldura das telas do CRM: menu lateral próprio, busca global no topo e área de conteúdo. */

type Item = {
  to: string;
  rotulo: string;
  icone: ComponentType<{ className?: string }>;
  exato?: boolean;
  admin?: boolean;
};

const MENU: Item[] = [
  { to: "/", rotulo: "Hoje", icone: Home, exato: true },
  { to: "/negocios", rotulo: "Negócios", icone: KanbanSquare },
  { to: "/empresas", rotulo: "Empresas", icone: Building2 },
  { to: "/pessoas", rotulo: "Pessoas", icone: UsersRound },
  { to: "/pautas", rotulo: "Pautas e conteúdo", icone: Newspaper },
  { to: "/publicidade", rotulo: "Publicidade", icone: Megaphone },
  { to: "/audiencia", rotulo: "Audiência", icone: Users },
  { to: "/tarefas", rotulo: "Tarefas", icone: CalendarCheck },
  { to: "/relatorios", rotulo: "Relatórios", icone: BarChart3 },
  { to: "/config", rotulo: "Configuração", icone: Settings, admin: true },
];

export function CrmShell({ children }: { children: ReactNode }) {
  const { isAdmin, papeis } = useCrm();
  const path = useRouterState({ select: (s) => s.location.pathname });
  const itens = MENU.filter((i) => !i.admin || isAdmin);
  const ativo = (i: Item) =>
    i.exato ? path === i.to || path === `${i.to}/` : path.startsWith(i.to);

  return (
    <div className="min-h-screen bg-background">
      <TopoCrm />
      <div className="mx-auto flex max-w-[1500px] gap-6 px-4 py-6 sm:px-6 lg:px-8">
        <aside className="sticky top-20 hidden h-[calc(100vh-6rem)] w-56 shrink-0 flex-col lg:flex">
          <p className="font-mono-eyebrow text-primary">CRM · IA News</p>
          <nav className="mt-3 flex flex-col gap-0.5" aria-label="Menu do CRM">
            {itens.map((i) => (
              <Link
                key={i.to}
                to={i.to}
                className={cn(
                  "flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium text-muted-foreground transition hover:bg-muted hover:text-foreground",
                  ativo(i) &&
                    "bg-primary/10 font-semibold text-primary hover:bg-primary/10 hover:text-primary",
                )}
              >
                <i.icone className="h-4 w-4" />
                {i.rotulo}
              </Link>
            ))}
          </nav>
          <div className="mt-auto space-y-2 border-t pt-3 text-xs text-muted-foreground">
            <p>Acesso: {papeis.filter((p) => p !== "reader").join(", ")}</p>
          </div>
        </aside>

        <div className="min-w-0 flex-1">
          <BuscaGlobal />
          <nav
            className="-mx-4 mt-3 flex gap-1.5 overflow-x-auto px-4 pb-1 lg:hidden"
            aria-label="Menu do CRM"
          >
            {itens.map((i) => (
              <Link
                key={i.to}
                to={i.to}
                className={cn(
                  "flex shrink-0 items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-semibold",
                  ativo(i)
                    ? "border-primary bg-primary text-primary-foreground"
                    : "bg-card text-muted-foreground",
                )}
              >
                <i.icone className="h-3.5 w-3.5" />
                {i.rotulo}
              </Link>
            ))}
          </nav>
          <main className="mt-5">{children}</main>
        </div>
      </div>
    </div>
  );
}

/** Barra superior do CRM: marca, quem está logado e sair. */
export function TopoCrm() {
  const navigate = useNavigate();
  const [email, setEmail] = useState<string | null>(null);
  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setEmail(data.user?.email ?? null));
  }, []);
  async function sair() {
    await supabase.auth.signOut();
    navigate({ to: "/login", replace: true });
  }
  return (
    <header className="sticky top-0 z-30 border-b border-white/10 bg-[#0D1117] text-white">
      <div className="mx-auto flex h-14 max-w-[1500px] items-center justify-between gap-3 px-4 sm:px-6 lg:px-8">
        <Link to="/" className="flex items-center gap-2.5">
          <img src={logo} alt="IANews" className="h-5 w-auto" />
          <span className="rounded bg-primary px-1.5 py-0.5 text-[11px] font-bold tracking-wide">
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
      <div className="mx-auto mt-16 max-w-md rounded-2xl border bg-card p-10 text-center">
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

function BuscaGlobal() {
  const navigate = useNavigate();
  const buscar = useServerFn(buscarCrm);
  const [q, setQ] = useState("");
  const [termo, setTermo] = useState("");
  const [aberto, setAberto] = useState(false);
  const caixa = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const t = setTimeout(() => setTermo(q.trim()), 250);
    return () => clearTimeout(t);
  }, [q]);

  useEffect(() => {
    const fora = (e: MouseEvent) => {
      if (caixa.current && !caixa.current.contains(e.target as Node)) setAberto(false);
    };
    document.addEventListener("mousedown", fora);
    return () => document.removeEventListener("mousedown", fora);
  }, []);

  const { data, isFetching } = useQuery({
    queryKey: ["crm", "busca", termo],
    queryFn: () => buscar({ data: { q: termo } }),
    enabled: termo.length >= 2,
    staleTime: 15_000,
  });

  const ir = (to: string, id: string) => {
    setAberto(false);
    setQ("");
    navigate({ to, params: { id } });
  };

  const vazio = data && !data.empresas.length && !data.pessoas.length;

  return (
    <div ref={caixa} className="relative">
      <div className="flex items-center gap-2 rounded-lg border bg-card px-3.5 py-2.5 focus-within:border-primary">
        <Search className="h-4 w-4 text-muted-foreground" />
        <input
          value={q}
          onChange={(e) => {
            setQ(e.target.value);
            setAberto(true);
          }}
          onFocus={() => setAberto(true)}
          onKeyDown={(e) => e.key === "Escape" && setAberto(false)}
          placeholder="Buscar empresa, pessoa, e-mail, Instagram ou WhatsApp (antes de criar pauta)"
          aria-label="Busca global do CRM"
          className="w-full bg-transparent text-sm outline-none placeholder:text-muted-foreground"
        />
        {isFetching ? <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" /> : null}
      </div>
      {aberto && termo.length >= 2 && data ? (
        <div className="absolute z-40 mt-1 max-h-[70vh] w-full overflow-y-auto rounded-lg border bg-popover p-2 shadow-lg">
          {vazio ? (
            <p className="p-3 text-sm text-muted-foreground">
              Nada encontrado. Pessoa e empresa ainda não apareceram no conteúdo.
            </p>
          ) : null}
          {data.empresas.length ? (
            <p className="px-2 pb-1 pt-1 font-mono-eyebrow text-muted-foreground">Empresas</p>
          ) : null}
          {data.empresas.map((e) => (
            <button
              key={e.id}
              type="button"
              onClick={() => ir("/empresas/$id", e.id)}
              className="flex w-full flex-wrap items-center gap-2 rounded-md px-2 py-2 text-left text-sm hover:bg-muted"
            >
              <Building2 className="h-4 w-4 text-muted-foreground" />
              <span className="font-semibold">{e.nome}</span>
              <GrupoBadge grupo={e.grupo as never} pontuacao={e.pontuacao} />
              {e.e_cliente ? <span className="text-xs text-primary">cliente</span> : null}
              <AvisoRepeticao
                vezes={e.mencoes}
                ultima={
                  e.ultima_mencao
                    ? `${e.ultima_mencao.titulo ?? ""} (${fmtDia(e.ultima_mencao.em)})`
                    : null
                }
              />
            </button>
          ))}
          {data.pessoas.length ? (
            <p className="px-2 pb-1 pt-2 font-mono-eyebrow text-muted-foreground">Pessoas</p>
          ) : null}
          {data.pessoas.map((p) => (
            <button
              key={p.id}
              type="button"
              onClick={() => ir("/pessoas/$id", p.id)}
              className="flex w-full flex-wrap items-center gap-2 rounded-md px-2 py-2 text-left text-sm hover:bg-muted"
            >
              <UsersRound className="h-4 w-4 text-muted-foreground" />
              <span className="font-semibold">{p.nome}</span>
              {p.empresas.length ? (
                <span className="text-xs text-muted-foreground">{p.empresas.join(", ")}</span>
              ) : null}
              {p.email ? <span className="text-xs text-muted-foreground">{p.email}</span> : null}
              <AvisoRepeticao
                vezes={p.mencoes}
                ultima={
                  p.ultima_mencao
                    ? `${p.ultima_mencao.titulo ?? ""} (${fmtDia(p.ultima_mencao.em)})`
                    : null
                }
              />
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}
