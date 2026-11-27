import { useEffect, useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { Loader2, Lock, ScanFace } from "lucide-react";
import { z } from "zod";

import logo from "@/assets/ianews-logo-white.png";
import {
  confirmarFaceId,
  erroFaceId,
  listarFaceId,
  suportaFaceId,
  type FatorFaceId,
} from "@/components/crm/faceid";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";

/* Login do CRM. A conta é a mesma do Supabase da IANews, mas só entra quem tem papel
   admin, comercial ou editorial (o banco recusa os demais). Contas novas são criadas pelo
   administrador (convite), não aqui. Quem ativou a verificação em duas etapas digita o código
   do aplicativo autenticador depois da senha. */

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

/** A conta tem autenticador ativo e a sessão ainda não foi confirmada pelo código. */
async function precisaCodigo(): Promise<boolean> {
  const { data } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
  return data?.nextLevel === "aal2" && data.currentLevel !== "aal2";
}

function LoginPage() {
  const navigate = useNavigate();
  const { volta } = Route.useSearch();
  const [modo, setModo] = useState<"entrar" | "codigo" | "esqueci" | "nova">("entrar");
  const [codigo, setCodigo] = useState("");
  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [ocupado, setOcupado] = useState(false);
  const [erro, setErro] = useState("");
  const [aviso, setAviso] = useState("");
  // Segunda etapa: Face ID (passkey) quando a conta tem um ativo; o código fica como reserva.
  const [faceId, setFaceId] = useState<FatorFaceId | null>(null);
  const [usarCodigo, setUsarCodigo] = useState(false);

  async function irParaSegundaEtapa() {
    const lista = suportaFaceId() ? await listarFaceId().catch(() => []) : [];
    setFaceId(lista[0] ?? null);
    setUsarCodigo(!lista.length);
    setModo("codigo");
  }

  function entrou() {
    try {
      sessionStorage.setItem("crm:faceid-ok", String(Date.now()));
    } catch {
      /* sem armazenamento */
    }
    window.location.replace(destinoSeguro(volta));
  }

  async function entrarComFaceId() {
    if (!faceId) return;
    setErro("");
    setOcupado(true);
    try {
      await confirmarFaceId(faceId.id);
      entrou();
    } catch (e) {
      setErro(erroFaceId(e));
    } finally {
      setOcupado(false);
    }
  }

  useEffect(() => {
    // Link de "esqueci a senha": o Supabase abre uma sessão de recuperação; pede a nova senha.
    const recuperando = /type=(recovery|invite)/.test(window.location.hash);
    if (recuperando) setModo("nova");
    const { data: sub } = supabase.auth.onAuthStateChange((evento) => {
      if (evento === "PASSWORD_RECOVERY") setModo("nova");
    });
    if (!recuperando) {
      supabase.auth.getSession().then(async ({ data }) => {
        if (!data.session) return;
        if (await precisaCodigo()) await irParaSegundaEtapa();
        else window.location.replace(destinoSeguro(volta));
      });
    }
    return () => sub.subscription.unsubscribe();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [volta]);

  async function enviar(e: React.FormEvent) {
    e.preventDefault();
    setErro("");
    setAviso("");
    const mail = email.trim().toLowerCase();
    if (modo === "codigo") {
      const c = codigo.replace(/\D/g, "");
      if (c.length !== 6) return setErro("Digite os 6 números do aplicativo autenticador.");
      setOcupado(true);
      try {
        const { data: fatores, error: e1 } = await supabase.auth.mfa.listFactors();
        const fator = fatores?.totp?.find((f) => f.status === "verified");
        if (e1 || !fator) return setErro("Não encontramos o autenticador desta conta.");
        const { error } = await supabase.auth.mfa.challengeAndVerify({
          factorId: fator.id,
          code: c,
        });
        if (error) return setErro("Código incorreto ou expirado. Tente o próximo código.");
        entrou();
      } finally {
        setOcupado(false);
      }
      return;
    }
    if (modo === "nova") {
      if (senha.length < 12) return setErro("A nova senha precisa ter pelo menos 12 caracteres.");
      setOcupado(true);
      const { error } = await supabase.auth.updateUser({ password: senha });
      setOcupado(false);
      if (error) return setErro(error.message);
      navigate({ to: "/", replace: true });
      return;
    }
    if (!EMAIL_RE.test(mail)) return setErro("Informe um e-mail válido.");
    if (modo === "entrar" && !senha) return setErro("Informe a senha.");
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
        if (await precisaCodigo()) {
          setSenha("");
          await irParaSegundaEtapa();
          return;
        }
        navigate({ to: destinoSeguro(volta), replace: true });
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
    <div className="safe-top relative flex min-h-[100dvh] flex-col items-center justify-center overflow-hidden bg-nav px-4 py-10">
      {/* Grade discreta de fundo, só decorativa. */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 opacity-[0.35] [background-image:linear-gradient(rgb(255_255_255/0.04)_1px,transparent_1px),linear-gradient(90deg,rgb(255_255_255/0.04)_1px,transparent_1px)] [background-size:44px_44px] [mask-image:radial-gradient(ellipse_at_center,black,transparent_70%)]"
      />
      <div className="relative mb-6 flex items-center gap-3">
        <img src="/icon-192.png" alt="" className="h-10 w-10 rounded-xl" />
        <div>
          <img src={logo} alt="IA News" className="h-[18px] w-auto" />
          <p className="mt-1 text-xs font-medium text-white/55">
            CRM · operação comercial e editorial
          </p>
        </div>
      </div>
      <div className="relative w-full max-w-sm rounded-2xl border border-white/10 bg-card p-6 shadow-[0_30px_80px_-20px_rgb(0_0_0/0.6)] sm:p-7">
        <h1 className="text-xl font-semibold tracking-[-0.02em]">
          {modo === "entrar"
            ? "Entrar no CRM"
            : modo === "codigo"
              ? "Verificação em duas etapas"
              : modo === "nova"
                ? "Nova senha"
                : "Recuperar senha"}
        </h1>
        <p className="mt-1 flex items-center gap-1.5 text-xs text-muted-foreground">
          <Lock className="h-3.5 w-3.5" /> Acesso restrito à equipe da IA News.
        </p>

        {modo === "codigo" && faceId && !usarCodigo ? (
          <div className="mt-5 space-y-3">
            <Button
              type="button"
              className="h-12 w-full text-[15px] font-semibold"
              onClick={entrarComFaceId}
              disabled={ocupado}
              autoFocus
            >
              {ocupado ? (
                <Loader2 className="mr-2 h-5 w-5 animate-spin" />
              ) : (
                <ScanFace className="mr-2 h-5 w-5" />
              )}
              Entrar com Face ID
            </Button>
            <p className="text-center text-[12px] text-muted-foreground">
              Em outro computador, o navegador mostra um QR code: aponte a câmera do celular.
            </p>
            {erro ? <p className="text-sm text-destructive">{erro}</p> : null}
            <button
              type="button"
              className="w-full text-center text-[13px] font-medium text-primary hover:underline"
              onClick={() => {
                setErro("");
                setUsarCodigo(true);
              }}
            >
              Usar o código de 6 números
            </button>
          </div>
        ) : null}

        <form
          onSubmit={enviar}
          className={modo === "codigo" && faceId && !usarCodigo ? "hidden" : "mt-5 space-y-3"}
        >
          {modo === "codigo" ? (
            <div className="space-y-1.5">
              <Label htmlFor="codigo">Código do aplicativo autenticador</Label>
              <Input
                id="codigo"
                inputMode="numeric"
                autoComplete="one-time-code"
                maxLength={6}
                value={codigo}
                onChange={(e) => setCodigo(e.target.value.replace(/\D/g, "").slice(0, 6))}
                autoFocus
                className="tabular text-center text-lg tracking-[0.4em]"
              />
            </div>
          ) : null}
          {modo !== "nova" && modo !== "codigo" ? (
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
          {modo === "entrar" || modo === "nova" ? (
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
          <Button type="submit" className="h-11 w-full font-semibold" disabled={ocupado}>
            {ocupado ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
            {modo === "entrar"
              ? "Entrar"
              : modo === "codigo"
                ? "Confirmar"
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
              onClick={async () => {
                if (modo === "codigo") await supabase.auth.signOut();
                setModo("entrar");
              }}
            >
              {modo === "codigo" ? "Entrar com outra conta" : "Voltar para o login"}
            </button>
          ) : (
            <>
              <span className="text-muted-foreground">Conta nova: peça ao administrador.</span>
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
      <p className="relative mt-6 text-[11px] text-white/40">
        No iPhone: Compartilhar → Adicionar à Tela de Início
      </p>
    </div>
  );
}
