import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { SiteHeader } from "@/components/site/header";
import { SiteFooter } from "@/components/site/footer";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/auth")({
  head: () => ({
    meta: [
      { title: "Entrar na sua conta — IA News" },
      {
        name: "description",
        content:
          "Acesse sua conta do IA News para acompanhar seus hábitos de leitura, metas e a edição diária.",
      },
      { property: "og:title", content: "Entrar na sua conta — IA News" },
      {
        property: "og:description",
        content: "Acesse sua conta do IA News e acompanhe seus hábitos de leitura.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "robots", content: "noindex" },
      { property: "og:url", content: "https://ianews.site/auth" },
    ],
    links: [{ rel: "canonical", href: "https://ianews.site/auth" }],
  }),
  component: AuthPage,
});

function AuthPage() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) navigate({ to: "/habitos", replace: true });
    });
  }, [navigate]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    const mail = email.trim();
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(mail)) {
      toast.error("Informe um e-mail válido.");
      return;
    }
    if (password.length < 6) {
      toast.error("Informe sua senha (mínimo de 6 caracteres).");
      return;
    }
    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({ email: mail, password });
    setLoading(false);
    if (error) {
      toast.error(
        error.message.includes("Invalid login")
          ? "E-mail ou senha incorretos."
          : error.message.toLowerCase().includes("not confirmed")
          ? "Confirme seu e-mail antes de entrar."
          : error.message,
      );
      return;
    }
    toast.success("Bem-vindo de volta!");
    navigate({ to: "/habitos" });
  }

  return (
    <div className="min-h-screen bg-background">
      <SiteHeader />
      <main className="mx-auto grid max-w-[1400px] gap-12 px-4 py-16 sm:px-6 lg:grid-cols-2 lg:px-8">
        <div className="max-w-md">
          <p className="font-mono-eyebrow text-primary">Área do leitor</p>
          <h1 className="mt-3 text-4xl font-extrabold tracking-tight">Entrar</h1>
          <p className="mt-3 text-muted-foreground">
            Acompanhe seus hábitos de leitura, defina metas e receba a edição diária.
          </p>

          <form className="mt-8 space-y-5" onSubmit={onSubmit}>
            <div className="space-y-2">
              <Label htmlFor="email">E-mail</Label>
              <Input
                id="email"
                type="email"
                required
                maxLength={255}
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="voce@empresa.com"
                className="h-12 rounded-lg"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Senha</Label>
              <Input
                id="password"
                type="password"
                required
                maxLength={72}
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="h-12 rounded-lg"
              />
            </div>
            <Button
              type="submit"
              disabled={loading}
              className="h-12 w-full rounded-lg text-base font-bold"
            >
              {loading ? "Entrando..." : "Entrar"}
            </Button>
          </form>

          <p className="mt-6 text-sm text-muted-foreground">
            Ainda não tem conta?{" "}
            <Link to="/cadastro" className="font-semibold text-primary hover:underline">
              Cadastre-se grátis
            </Link>
          </p>
        </div>

        <aside className="hidden rounded-2xl bg-[color:var(--color-nav)] p-10 text-white lg:block">
          <p className="font-mono-eyebrow text-[color:var(--color-lime)]">Meus Hábitos</p>
          <h2 className="mt-3 text-3xl font-extrabold leading-tight">
            Sua rotina de leitura, medida de verdade.
          </h2>
          <ul className="mt-8 space-y-4 text-white/75">
            <li>• Tempo de leitura por dia e por semana</li>
            <li>• Metas semanais de matérias e minutos</li>
            <li>• Sequência de dias lendo sem falhar</li>
            <li>• Editorias que você mais acompanha</li>
          </ul>
        </aside>
      </main>
      <SiteFooter />
    </div>
  );
}