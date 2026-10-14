import { Link, useNavigate } from "@tanstack/react-router";
import { Menu, Search, User } from "lucide-react";
import { useState } from "react";

import { Logo } from "@/components/brand/logo";
import { useAuth } from "@/hooks/use-auth";
import { useAdminAccess } from "@/hooks/use-admin";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetTrigger,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";

const nav = [
  { to: "/", label: "Home" },
  { to: "/noticias", label: "Notícias" },
  { to: "/ranking", label: "Ranking IA" },
  { to: "/newsletter", label: "Newsletter" },
  { to: "/habitos", label: "Meus Hábitos" },
] as const;

export function SiteHeader() {
  const [open, setOpen] = useState(false);
  const { isAuthenticated } = useAuth();
  const { isAdmin } = useAdminAccess();
  const navigate = useNavigate();

  async function signOut() {
    await supabase.auth.signOut();
    navigate({ to: "/", replace: true });
  }

  return (
    <header className="sticky top-0 z-50 w-full bg-[color:var(--color-nav)] text-[color:var(--color-nav-foreground)] [padding-top:env(safe-area-inset-top)]">
      <div className="mx-auto flex h-[72px] max-w-[1400px] items-center gap-4 px-4 sm:px-6 lg:px-8">
        <Logo onDark />
        <nav className="hidden shrink-0 items-center gap-4 lg:flex">
          {nav.map((item) => (
            <Link
              key={item.label}
              to={item.to}
              className="inline-flex items-center gap-1 text-[15px] font-medium text-white/70 transition-colors hover:text-white"
              activeProps={{ className: "text-white font-semibold" }}
            >
              {item.label}
            </Link>
          ))}
        </nav>
        <div className="ml-auto flex items-center gap-2">
          <Button
            asChild
            className="hidden h-10 rounded-lg bg-[color:var(--color-lime)] px-5 text-sm font-bold text-white hover:bg-[color:var(--color-lime)]/90 sm:inline-flex"
          >
            <Link to="/newsletter">Assine</Link>
          </Button>
          {isAdmin && (
            <Button
              asChild
              variant="ghost"
              className="hidden h-10 rounded-lg px-3 text-sm font-semibold text-white/80 hover:bg-white/10 hover:text-white lg:inline-flex"
            >
              <Link to="/admin">Painel</Link>
            </Button>
          )}
          {isAuthenticated ? (
            <>
              <Button
                asChild
                variant="outline"
                className="hidden h-10 rounded-lg border-white/25 bg-transparent px-4 text-sm font-semibold text-white hover:bg-white/10 hover:text-white md:inline-flex"
              >
                <Link to="/habitos">
                  <User className="mr-1.5 h-4 w-4" /> Minha conta
                </Link>
              </Button>
              <Button
                variant="ghost"
                onClick={signOut}
                className="hidden h-10 rounded-lg px-3 text-sm font-semibold text-white/70 hover:bg-white/10 hover:text-white lg:inline-flex"
              >
                Sair
              </Button>
            </>
          ) : (
            <>
              <Button
                asChild
                variant="outline"
                className="hidden h-10 rounded-lg border-white/25 bg-transparent px-5 text-sm font-semibold text-white hover:bg-white/10 hover:text-white md:inline-flex"
              >
                <Link to="/cadastro">Cadastre-se</Link>
              </Button>
              <Button
                asChild
                variant="ghost"
                className="hidden h-10 rounded-lg px-3 text-sm font-semibold text-white/70 hover:bg-white/10 hover:text-white lg:inline-flex"
              >
                <Link to="/auth">Entrar</Link>
              </Button>
            </>
          )}
          <label className="hidden items-center gap-2 rounded-lg bg-white/10 px-3.5 py-2.5 xl:flex">
            <Search className="h-4 w-4 text-white/60" />
            <input
              type="search"
              placeholder="Buscar..."
              aria-label="Buscar no IA News"
              className="w-44 bg-transparent text-sm text-white outline-none placeholder:text-white/50"
            />
          </label>
          <Sheet open={open} onOpenChange={setOpen}>
            <SheetTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="rounded-lg text-white hover:bg-white/10 hover:text-white lg:hidden"
                aria-label="Abrir menu"
              >
                <Menu className="h-5 w-5" />
              </Button>
            </SheetTrigger>
            <SheetContent
              side="right"
              className="flex w-[86vw] max-w-sm flex-col overflow-y-auto overscroll-contain bg-background p-5 pt-[calc(env(safe-area-inset-top)+1.25rem)] pb-[calc(env(safe-area-inset-bottom)+1.5rem)]"
            >
              <SheetHeader className="p-0 text-left">
                <SheetTitle className="text-left">
                  <Logo />
                </SheetTitle>
              </SheetHeader>
              <nav className="mt-6 flex flex-col gap-1">
                {nav.map((item) => (
                  <Link
                    key={item.label}
                    to={item.to}
                    onClick={() => setOpen(false)}
                    className="rounded-md px-3 py-3 text-base font-medium text-foreground/80 hover:bg-secondary hover:text-foreground"
                    activeProps={{ className: "bg-secondary font-semibold text-foreground" }}
                  >
                    {item.label}
                  </Link>
                ))}
                {isAdmin && (
                  <Link
                    to="/admin"
                    onClick={() => setOpen(false)}
                    className="rounded-md px-3 py-3 text-base font-medium text-foreground/80 hover:bg-secondary"
                  >
                    Painel administrativo
                  </Link>
                )}
                {isAuthenticated ? (
                  <Link
                    to="/habitos"
                    onClick={() => setOpen(false)}
                    className="rounded-md px-3 py-3 text-base font-medium text-foreground/80 hover:bg-secondary"
                  >
                    Minha conta
                  </Link>
                ) : (
                  <>
                    <Link
                      to="/cadastro"
                      onClick={() => setOpen(false)}
                      className="rounded-md px-3 py-3 text-base font-medium text-foreground/80 hover:bg-secondary"
                    >
                      Cadastre-se
                    </Link>
                    <Link
                      to="/auth"
                      onClick={() => setOpen(false)}
                      className="rounded-md px-3 py-3 text-base font-medium text-foreground/80 hover:bg-secondary"
                    >
                      Entrar
                    </Link>
                  </>
                )}
                <Button
                  asChild
                  className="mt-4"
                >
                  <Link to="/newsletter" onClick={() => setOpen(false)}>Assine</Link>
                </Button>
              </nav>
            </SheetContent>
          </Sheet>
        </div>
      </div>
    </header>
  );
}