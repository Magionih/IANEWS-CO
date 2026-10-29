import { useEffect, useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { Loader2, Lock } from "lucide-react";
import { z } from "zod";

import logo from "@/assets/ianews-logo.png";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";

/* Login do CRM. A conta é a mesma do Supabase da IANews, mas só entra quem tem papel
   admin, comercial ou editorial (o banco recusa os demais). */

export const Route = createFileRoute("/login")({
  ssr: false,
  validateSearch: z.object({ volta: z.string().optional() }),
  component: LoginPage,
});

const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

/** Só volta para endereços deste mesmo site (evita redirecionamento para fora). */
function destinoSeguro(volta?: string) {
  if (!volta) return "/";
  try {
    const url = new URL(volta, window.location.origin);
    return url.origin === window.location.origin ? `${url.pathname}${url.search}` : "/";
  } catch {
    return "/";
  }
}

function LoginPage() {
  const navigate = useNavigate();
  const { volta } = Route.useSearch();
  const [modo, setModo] = useState<"entrar" | "criar" | "esqueci" | "nova">("entrar");
  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [nome, setNome] = useState("");
  const [ocupado, setOcupado] = useState(false);
  const [erro, setErro] = useState("");
  const [aviso, setAviso] = useState("");

  useEffect(() => {
    // Link de "esqueci a senha": o Supabase abre uma sessão de recuperação; pede a nova senha.
    const recuperando = window.location.hash.includes("type=recovery");
    if (recuperando) setModo("nova");
    const { data: sub } = supabase.auth.onAuthStateChange((evento) => {
      if (evento === "PASSWORD_RECOVERY") setModo("nova");
    });
    if (!recuperando) {
      supabase.auth.getSession().then(({ data }) => {
        if (data.session) window.location.replace(destinoSeguro(volta));
      });
    }
    return () => sub.subscription.unsubscribe();
  }, [volta]);

  async function enviar(e: React.FormEvent) {
    e.preventDefault();
    setErro("");
    setAviso("");
    const mail = email.trim().toLowerCase();
    if (modo === "nova") {
      if (senha.length < 8) return setErro("A senha precisa ter pelo menos 8 caracteres.");
      setOcupado(true);
      const { error } = await supabase.auth.updateUser({ password: senha });
      setOcupado(false);
      if (error) return setErro(error.message);
      navigate({ to: "/", replace: true });
      return;
    }
    if (!EMAIL_RE.test(mail)) return setErro("Informe um e-mail válido.");
    if (modo !== "esqueci" && senha.length < 8)
      return setErro("A senha precisa ter pelo menos 8 caracteres.");
    setOcupado(true);
    try {
      if (modo === "entrar") {
        const { error } = await supabase.auth.signInWithPassword({ email: mail, password: senha });
        if (error) {
          setErro(
            error.message.includes("Invalid login")
              ? "E-mail ou senha incorretos."
              : error.message.toLowerCase().includes("not confirmed")
                ? "Confirme seu e-mail antes de entrar (veja a caixa de entrada)."
                : error.message,
          );
          return;
        }
        navigate({ to: destinoSeguro(volta), replace: true });
      } else if (modo === "criar") {
        const { data, error } = await supabase.auth.signUp({
          email: mail,
          password: senha,
          options: {
            data: { full_name: nome.trim() },
            emailRedirectTo: `${window.location.origin}/login`,
          },
        });
        if (error) return setErro(error.message);
        if (data.session) navigate({ to: "/", replace: true });
        else
          setAviso(
            "Conta criada. Confirme pelo link enviado ao seu e-mail e depois entre aqui. O acesso ao CRM é liberado pelo administrador.",
          );
      } else {
        const { error } = await supabase.auth.resetPasswordForEmail(mail, {
          redirectTo: `${window.location.origin}/login`,
        });
        if (error) return setErro(error.message);
        setAviso("Se o e-mail tiver conta, você vai receber um link para criar uma nova senha.");
      }
    } finally {
      setOcupado(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-[#0D1117] px-4 py-10">
      <div className="w-full max-w-sm rounded-2xl bg-card p-7 shadow-xl">
        <div className="flex items-center gap-2">
          <img src={logo} alt="IANews" className="h-6 w-auto" />
          <span className="rounded bg-primary px-1.5 py-0.5 text-[11px] font-bold tracking-wide text-primary-foreground">
            CRM
          </span>
        </div>
        <h1 className="mt-5 text-xl font-extrabold">
          {modo === "entrar"
            ? "Entrar no CRM"
            : modo === "criar"
              ? "Criar conta"
              : modo === "nova"
                ? "Nova senha"
                : "Recuperar senha"}
        </h1>
        <p className="mt-1 flex items-center gap-1.5 text-xs text-muted-foreground">
          <Lock className="h-3.5 w-3.5" /> Acesso restrito à equipe da IANews.
        </p>

        <form onSubmit={enviar} className="mt-5 space-y-3">
          {modo === "criar" ? (
            <div className="space-y-1.5">
              <Label htmlFor="nome">Nome</Label>
              <Input
                id="nome"
                value={nome}
                onChange={(e) => setNome(e.target.value)}
                autoComplete="name"
              />
            </div>
          ) : null}
          {modo !== "nova" ? (
            <div className="space-y-1.5">
              <Label htmlFor="email">E-mail</Label>
              <Input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                autoComplete="email"
                autoFocus
              />
            </div>
          ) : null}
          {modo !== "esqueci" ? (
            <div className="space-y-1.5">
              <Label htmlFor="senha">Senha</Label>
              <Input
                id="senha"
                type="password"
                value={senha}
                onChange={(e) => setSenha(e.target.value)}
                autoComplete={modo === "entrar" ? "current-password" : "new-password"}
              />
            </div>
          ) : null}
          {erro ? <p className="text-sm text-destructive">{erro}</p> : null}
          {aviso ? <p className="text-sm text-primary">{aviso}</p> : null}
          <Button type="submit" className="h-11 w-full font-bold" disabled={ocupado}>
            {ocupado ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
            {modo === "entrar"
              ? "Entrar"
              : modo === "criar"
                ? "Criar conta"
                : modo === "nova"
                  ? "Salvar senha"
                  : "Enviar link"}
          </Button>
        </form>

        <div className="mt-4 flex flex-wrap justify-between gap-2 text-xs">
          {modo !== "entrar" ? (
            <button
              type="button"
              className="text-primary hover:underline"
              onClick={() => setModo("entrar")}
            >
              Já tenho conta
            </button>
          ) : (
            <>
              <button
                type="button"
                className="text-primary hover:underline"
                onClick={() => setModo("criar")}
              >
                Criar conta
              </button>
              <button
                type="button"
                className="text-muted-foreground hover:underline"
                onClick={() => setModo("esqueci")}
              >
                Esqueci a senha
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
