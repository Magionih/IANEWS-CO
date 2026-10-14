import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";

import { SiteHeader } from "@/components/site/header";
import { SiteFooter } from "@/components/site/footer";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/cadastro")({
  head: () => ({
    meta: [
      { title: "Cadastre-se grátis no IA News" },
      {
        name: "description",
        content:
          "Crie sua conta gratuita no IA News: acompanhe metas de leitura, tempo dedicado e receba a edição diária de inteligência artificial.",
      },
      { property: "og:title", content: "Cadastre-se grátis no IA News" },
      {
        property: "og:description",
        content: "Crie sua conta e acompanhe seus hábitos de leitura sobre inteligência artificial.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      { property: "og:url", content: "https://ianewsbr.com/cadastro" },
    ],
    links: [{ rel: "canonical", href: "https://ianewsbr.com/cadastro" }],
  }),
  component: SignupPage,
});

async function captureLead(name: string, email: string, phone: string) {
  try {
    const { subscribeLead } = await import("@/lib/newsletter.functions");
    await subscribeLead({
      data: { email, full_name: name, phone, source: "cadastro" },
    });
  } catch (err) {
    console.error("[cadastro] lead capture failed", err);
  }
}

function SignupPage() {
  const navigate = useNavigate();
  const [form, setForm] = useState({ name: "", email: "", phone: "", password: "" });
  const [loading, setLoading] = useState(false);

  function set(key: keyof typeof form, value: string) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    const name = form.name.trim();
    const email = form.email.trim();
    const phone = form.phone.trim();

    if (name.length < 2 || name.length > 120) {
      toast.error("Informe seu nome completo.");
      return;
    }
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email) || email.length > 255) {
      toast.error("Informe um e-mail válido.");
      return;
    }
    if (phone.replace(/\D/g, "").length < 10) {
      toast.error("Informe um telefone com DDD.");
      return;
    }
    if (form.password.length < 8) {
      toast.error("A senha precisa ter ao menos 8 caracteres.");
      return;
    }
    if (form.password.length > 72) {
      toast.error("A senha pode ter no máximo 72 caracteres.");
      return;
    }

    setLoading(true);
    const { data, error } = await supabase.auth.signUp({
      email,
      password: form.password,
      options: {
        emailRedirectTo: window.location.origin,
        data: { full_name: name, phone },
      },
    });

    if (error) {
      setLoading(false);
      const msg = error.message.toLowerCase();
      toast.error(
        msg.includes("already registered") || msg.includes("already been registered")
          ? "Este e-mail já tem conta. Faça login."
          : msg.includes("password") && msg.includes("least")
            ? "A senha é muito curta. Use ao menos 8 caracteres."
            : msg.includes("pwned") || msg.includes("weak") || msg.includes("compromised")
              ? "Essa senha é considerada insegura. Escolha outra mais forte."
              : error.message,
      );
      return;
    }

    if (data.session) {
      const { saveProfile } = await import("@/lib/reading.functions");
      try {
        await saveProfile({ data: { full_name: name, email, phone } });
      } catch (err) {
        console.error("[cadastro] profile save failed", err);
      }
      await captureLead(name, email, phone);
      setLoading(false);
      toast.success("Conta criada! Bem-vindo ao IA News.");
      navigate({ to: "/habitos" });
      return;
    }

    await captureLead(name, email, phone);
    setLoading(false);
    toast.success("Conta criada! Confirme o e-mail que enviamos para entrar.");
    navigate({ to: "/auth" });
  }

  return (
    <div className="min-h-screen bg-background">
      <SiteHeader />
      <main className="mx-auto grid max-w-[1400px] gap-12 px-4 py-16 sm:px-6 lg:grid-cols-2 lg:px-8">
        <div className="max-w-md">
          <p className="font-mono-eyebrow text-primary">Grátis para sempre</p>
          <h1 className="mt-3 text-4xl font-extrabold tracking-tight">Cadastre-se</h1>
          <p className="mt-3 text-muted-foreground">
            Crie sua conta para acompanhar metas, tempo de leitura e a edição diária.
          </p>

          <form className="mt-8 space-y-5" onSubmit={onSubmit}>
            <div className="space-y-2">
              <Label htmlFor="name">Nome completo</Label>
              <Input
                id="name"
                required
                maxLength={120}
                autoComplete="name"
                value={form.name}
                onChange={(e) => set("name", e.target.value)}
                placeholder="Maria Silva"
                className="h-12 rounded-lg"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="email">E-mail</Label>
              <Input
                id="email"
                type="email"
                required
                maxLength={255}
                autoComplete="email"
                value={form.email}
                onChange={(e) => set("email", e.target.value)}
                placeholder="voce@empresa.com"
                className="h-12 rounded-lg"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="phone">Telefone (WhatsApp)</Label>
              <Input
                id="phone"
                type="tel"
                required
                maxLength={30}
                autoComplete="tel"
                value={form.phone}
                onChange={(e) => set("phone", e.target.value)}
                placeholder="(11) 99999-0000"
                className="h-12 rounded-lg"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Senha</Label>
              <Input
                id="password"
                type="password"
                required
                minLength={8}
                maxLength={72}
                autoComplete="new-password"
                value={form.password}
                onChange={(e) => set("password", e.target.value)}
                placeholder="Mínimo de 8 caracteres"
                className="h-12 rounded-lg"
              />
            </div>
            <Button
              type="submit"
              disabled={loading}
              className="h-12 w-full rounded-lg text-base font-bold"
            >
              {loading ? "Criando conta..." : "Criar minha conta"}
            </Button>
          </form>

          <p className="mt-6 text-sm text-muted-foreground">
            Já tem conta?{" "}
            <Link to="/auth" className="font-semibold text-primary hover:underline">
              Entrar
            </Link>
          </p>
        </div>

        <aside className="hidden rounded-2xl bg-secondary/60 p-10 lg:block">
          <h2 className="text-2xl font-extrabold leading-tight">
            O que você desbloqueia agora
          </h2>
          <ul className="mt-6 space-y-4 text-muted-foreground">
            <li>
              <strong className="text-foreground">Meus Hábitos.</strong> Tempo de leitura,
              metas semanais e sequência de dias.
            </li>
            <li>
              <strong className="text-foreground">Histórico.</strong> Tudo o que você leu,
              organizado por editoria.
            </li>
            <li>
              <strong className="text-foreground">Edição diária.</strong> O resumo do dia
              antes das 8h.
            </li>
            <li>
              <strong className="text-foreground">Ranking IA.</strong> O placar dos modelos
              atualizado a cada edição.
            </li>
          </ul>
        </aside>
      </main>
      <SiteFooter />
    </div>
  );
}