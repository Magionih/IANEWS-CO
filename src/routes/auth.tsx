import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { SiteHeader } from "@/components/site/header";
import { SiteFooter } from "@/components/site/footer";
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
      { property: "og:url", content: "https://ianewsbr.com/auth" },
    ],
    links: [{ rel: "canonical", href: "https://ianewsbr.com/auth" }],
  }),
  component: AuthPage,
});

function AuthPage() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) navigate({ to: "/habitos", replace: true });
    });
  }, [navigate]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    const mail = email.trim();
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(mail)) {
      setError("Informe um e-mail válido.");
      return;
    }
    if (password.length < 6) {
      setError("Informe sua senha (mínimo de 6 caracteres).");
      return;
    }
    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({ email: mail, password });
    setLoading(false);
    if (error) {
      setError(
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
    <>
      <SiteHeader />
      <main id="main">
        <div className="wrap">
          <div className="page-head">
            <p className="kick">Área do leitor</p>
            <h1>Entrar</h1>
            <p className="sub">
              Acompanhe seus hábitos de leitura, defina metas e receba a edição diária.
            </p>
          </div>

          <div className="two-col" style={{ paddingBottom: 64 }}>
            <section
              className="panel-form"
              style={{ padding: 28, boxShadow: "var(--p-shadow)", maxWidth: 520 }}
            >
              <form noValidate style={{ display: "grid", gap: 14 }} onSubmit={onSubmit}>
                <label className="f" htmlFor="email">
                  E-mail
                  <input
                    id="email"
                    className="field"
                    type="email"
                    inputMode="email"
                    required
                    maxLength={255}
                    autoComplete="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="voce@empresa.com"
                  />
                </label>
                <label className="f" htmlFor="password">
                  Senha
                  <input
                    id="password"
                    className="field"
                    type="password"
                    required
                    maxLength={72}
                    autoComplete="current-password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                  />
                </label>
                <button className="btn blue wide" type="submit" disabled={loading}>
                  {loading ? "Entrando..." : "Entrar"}
                </button>
                <p className={"msg" + (error ? " err" : "")} role="status" aria-live="polite">
                  {error}
                </p>
              </form>
              <p className="fine">
                Ainda não tem conta? <Link to="/cadastro">Cadastre-se grátis</Link>
              </p>
            </section>

            <aside style={{ display: "grid", gap: 16, alignContent: "start" }}>
              <p className="kick">Meus Hábitos</p>
              <h2 className="h-big">Sua rotina de leitura, medida de verdade.</h2>
              <ul className="ticks">
                <li>Tempo de leitura por dia e por semana</li>
                <li>Metas semanais de matérias e minutos</li>
                <li>Sequência de dias lendo sem falhar</li>
                <li>Editorias que você mais acompanha</li>
              </ul>
            </aside>
          </div>
        </div>
      </main>
      <SiteFooter />
    </>
  );
}
