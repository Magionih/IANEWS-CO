import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";

import { SiteHeader } from "@/components/site/header";
import { SiteFooter } from "@/components/site/footer";
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
        content:
          "Crie sua conta e acompanhe seus hábitos de leitura sobre inteligência artificial.",
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
  const [error, setError] = useState("");

  function set(key: keyof typeof form, value: string) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    const name = form.name.trim();
    const email = form.email.trim();
    const phone = form.phone.trim();

    if (name.length < 2 || name.length > 120) {
      setError("Informe seu nome completo.");
      return;
    }
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email) || email.length > 255) {
      setError("Informe um e-mail válido.");
      return;
    }
    if (phone.replace(/\D/g, "").length < 10) {
      setError("Informe um telefone com DDD.");
      return;
    }
    if (form.password.length < 8) {
      setError("A senha precisa ter ao menos 8 caracteres.");
      return;
    }
    if (form.password.length > 72) {
      setError("A senha pode ter no máximo 72 caracteres.");
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
      setError(
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

  const field = (
    key: keyof typeof form,
    label: string,
    props: React.InputHTMLAttributes<HTMLInputElement>,
  ) => (
    <label className="f" htmlFor={key}>
      {label}
      <input
        id={key}
        className="field"
        required
        value={form[key]}
        onChange={(e) => set(key, e.target.value)}
        {...props}
      />
    </label>
  );

  return (
    <>
      <SiteHeader />
      <main id="main">
        <div className="wrap">
          <div className="page-head">
            <p className="kick">Grátis para sempre</p>
            <h1>Cadastre-se</h1>
            <p className="sub">
              Crie sua conta para acompanhar metas, tempo de leitura e a edição diária.
            </p>
          </div>

          <div className="two-col" style={{ paddingBottom: 64 }}>
            <section
              className="panel-form"
              style={{ padding: 28, boxShadow: "var(--p-shadow)", maxWidth: 560 }}
            >
              <form noValidate style={{ display: "grid", gap: 14 }} onSubmit={onSubmit}>
                {field("name", "Nome completo", {
                  maxLength: 120,
                  autoComplete: "name",
                  placeholder: "Maria Silva",
                })}
                <div className="two">
                  {field("email", "E-mail", {
                    type: "email",
                    inputMode: "email",
                    maxLength: 255,
                    autoComplete: "email",
                    placeholder: "voce@empresa.com",
                  })}
                  {field("phone", "Telefone (WhatsApp)", {
                    type: "tel",
                    maxLength: 30,
                    autoComplete: "tel",
                    placeholder: "(11) 99999-0000",
                  })}
                </div>
                {field("password", "Senha", {
                  type: "password",
                  minLength: 8,
                  maxLength: 72,
                  autoComplete: "new-password",
                  placeholder: "Mínimo de 8 caracteres",
                })}
                <button className="btn blue wide" type="submit" disabled={loading}>
                  {loading ? "Criando conta..." : "Criar minha conta"}
                </button>
                <p className={"msg" + (error ? " err" : "")} role="status" aria-live="polite">
                  {error}
                </p>
              </form>
              <p className="fine">
                Já tem conta? <Link to="/auth">Entrar</Link>
              </p>
            </section>

            <aside style={{ display: "grid", gap: 16, alignContent: "start" }}>
              <h2 className="h-big">O que você desbloqueia agora</h2>
              <div className="cols3" style={{ gridTemplateColumns: "1fr", gap: 14 }}>
                <div>
                  <h3>Meus Hábitos</h3>
                  <p>Tempo de leitura, metas semanais e sequência de dias.</p>
                </div>
                <div>
                  <h3>Histórico</h3>
                  <p>Tudo o que você leu, organizado por editoria.</p>
                </div>
                <div>
                  <h3>Edição diária</h3>
                  <p>O resumo do dia antes das 8h.</p>
                </div>
                <div>
                  <h3>Ranking IA</h3>
                  <p>O placar dos modelos atualizado a cada edição.</p>
                </div>
              </div>
            </aside>
          </div>
        </div>
      </main>
      <SiteFooter />
    </>
  );
}
