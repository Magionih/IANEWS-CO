import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Fingerprint, Loader2, Lock, ScanFace, Smartphone, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { supabase } from "@/integrations/supabase/client";
import { fmtDataHora } from "@/lib/crm/utils";

/* Face ID no CRM (passkey, padrão WebAuthn):
   - Ativar: cria a chave de acesso no aparelho (Face ID, Touch ID ou a digital).
   - Entrar: depois da senha, o CRM pede o Face ID no lugar do código de 6 números.
     Em outro computador, o navegador mostra um QR code: aponte a câmera do celular e use o Face ID.
   - Trava ao abrir: com a opção ligada, o app pede o Face ID ao abrir e ao voltar depois de
     alguns minutos em segundo plano (os dados ficam escondidos até confirmar). */

export type FatorFaceId = {
  id: string;
  friendly_name?: string;
  created_at: string;
  status: string;
};

const CHAVE_TRAVA = "crm:trava-faceid";
const MINUTOS_PARA_TRAVAR = 5;

export function suportaFaceId() {
  return typeof window !== "undefined" && "PublicKeyCredential" in window;
}

export async function listarFaceId(): Promise<FatorFaceId[]> {
  const { data } = await supabase.auth.mfa.listFactors();
  const lista = ((data as unknown as { webauthn?: FatorFaceId[] } | null)?.webauthn ?? []).filter(
    (f) => f.status === "verified",
  );
  return lista;
}

/** Mensagem clara para os erros do WebAuthn e do servidor. */
export function erroFaceId(e: unknown): string {
  const msg = e instanceof Error ? e.message : String((e as { message?: string })?.message ?? e);
  if (/NotAllowed|cancel|abort|timed out/i.test(msg))
    return "Face ID cancelado. Toque em tentar de novo.";
  if (/disabled|not enabled|webauthn.*(enroll|verify)|mfa_webauthn/i.test(msg))
    return "O Face ID ainda não foi liberado no servidor de login. Use o código de 6 números por enquanto.";
  if (/InvalidState|already registered|excludeCredentials/i.test(msg))
    return "Este aparelho já tem Face ID ativo no CRM.";
  if (/aal2|AAL2|insufficient/i.test(msg))
    return "Entre de novo com o código de 6 números para ativar o Face ID.";
  return msg || "Não foi possível usar o Face ID agora.";
}

/** Confirma o Face ID (sobe a sessão para o nível de duas etapas). */
export async function confirmarFaceId(factorId: string) {
  // As opções extras completam as do servidor (o desafio vem de lá).
  const extras = { userVerification: "required", timeout: 60_000 } as unknown as Parameters<
    typeof supabase.auth.mfa.webauthn.authenticate
  >[1];
  const { error } = await supabase.auth.mfa.webauthn.authenticate(
    { factorId, webauthn: {} },
    extras,
  );
  if (error) throw error;
}

export function travaLigada() {
  try {
    return window.localStorage.getItem(CHAVE_TRAVA) === "1";
  } catch {
    return false;
  }
}

function setTrava(v: boolean) {
  try {
    if (v) window.localStorage.setItem(CHAVE_TRAVA, "1");
    else window.localStorage.removeItem(CHAVE_TRAVA);
  } catch {
    /* sem armazenamento */
  }
}

/** Configuração › Segurança: ativar o Face ID, ver os aparelhos e ligar a trava ao abrir o app. */
export function CartaoFaceId() {
  const [fatores, setFatores] = useState<FatorFaceId[] | null>(null);
  const [ocupado, setOcupado] = useState(false);
  const [trava, setTravaEstado] = useState(false);
  const [erro, setErro] = useState("");

  const carregar = useCallback(async () => {
    setFatores(await listarFaceId());
    setTravaEstado(travaLigada());
  }, []);
  useEffect(() => {
    void carregar();
  }, [carregar]);

  async function ativar() {
    setErro("");
    setOcupado(true);
    try {
      const nome = `${/iPhone/.test(navigator.userAgent) ? "iPhone" : /Mac/.test(navigator.userAgent) ? "Mac" : "Aparelho"} · ${new Date().toLocaleDateString("pt-BR")}`;
      const { error } = await supabase.auth.mfa.webauthn.register(
        { friendlyName: nome, webauthn: {} },
        {
          authenticatorSelection: {
            userVerification: "required",
            residentKey: "preferred",
            requireResidentKey: false,
          },
          timeout: 60_000,
        },
      );
      if (error) throw error;
      setTrava(true);
      toast.success("Face ID ativado. No próximo login ele substitui o código.");
      await carregar();
    } catch (e) {
      setErro(erroFaceId(e));
    } finally {
      setOcupado(false);
    }
  }

  async function remover(f: FatorFaceId) {
    if (!window.confirm(`Remover o Face ID "${f.friendly_name ?? "aparelho"}" do CRM?`)) return;
    setOcupado(true);
    const { error } = await supabase.auth.mfa.unenroll({ factorId: f.id });
    setOcupado(false);
    if (error) return setErro("Não foi possível remover agora.");
    toast.success("Face ID removido.");
    await carregar();
  }

  return (
    <section className="rounded-xl border bg-card">
      <header className="flex flex-wrap items-center gap-3.5 px-4 pt-4 sm:px-5">
        <span className="flex h-10 w-10 items-center justify-center rounded-[11px] bg-[#EEF3FF] text-primary">
          <ScanFace className="h-5 w-5" />
        </span>
        <div className="min-w-0 flex-1">
          <h2 className="text-[14.5px] font-semibold">Entrar com Face ID</h2>
          <p className="text-[12.5px] text-muted-foreground">
            Depois da senha, o CRM pede o Face ID do celular no lugar do código de 6 números.
          </p>
        </div>
        {suportaFaceId() ? (
          <Button onClick={ativar} disabled={ocupado || fatores == null} className="h-9">
            {ocupado ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Fingerprint className="h-4 w-4" />
            )}
            {fatores?.length ? "Ativar em outro aparelho" : "Ativar neste aparelho"}
          </Button>
        ) : null}
      </header>
      <div className="space-y-3 px-4 pb-4 pt-3 sm:px-5 sm:pb-5">
        {erro ? <p className="text-[13px] text-destructive">{erro}</p> : null}
        {fatores?.length ? (
          <ul className="divide-y rounded-lg border">
            {fatores.map((f) => (
              <li key={f.id} className="flex items-center gap-3 px-3.5 py-2.5">
                <Smartphone className="h-4 w-4 shrink-0 text-muted-foreground" />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[13.5px] font-semibold">
                    {f.friendly_name || "Aparelho"}
                  </span>
                  <span className="block text-[12px] text-muted-foreground">
                    ativado em {fmtDataHora(f.created_at)}
                  </span>
                </span>
                <button
                  type="button"
                  onClick={() => remover(f)}
                  aria-label="Remover este Face ID"
                  className="rounded-md p-1.5 text-muted-foreground transition hover:bg-muted hover:text-destructive"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </li>
            ))}
          </ul>
        ) : fatores ? (
          <p className="text-[12.5px] text-muted-foreground">
            Ative no celular (no app instalado ou no Safari). Em outros computadores, o navegador
            mostra um QR code: aponte a câmera do celular e confirme com o Face ID.
          </p>
        ) : null}
        {fatores?.length ? (
          <label className="flex items-center justify-between gap-4 rounded-lg bg-background px-3.5 py-3">
            <span className="min-w-0">
              <span className="block text-[13.5px] font-semibold">
                Pedir Face ID ao abrir o app
              </span>
              <span className="block text-[12px] text-muted-foreground">
                Neste aparelho, o CRM trava ao abrir e depois de {MINUTOS_PARA_TRAVAR} minutos fora.
              </span>
            </span>
            <Switch
              checked={trava}
              onCheckedChange={(v) => {
                setTrava(v);
                setTravaEstado(v);
              }}
            />
          </label>
        ) : null}
      </div>
    </section>
  );
}

/** Tela de bloqueio: com a trava ligada, o CRM pede o Face ID ao abrir e ao voltar de outro app. */
export function TravaFaceId({ children }: { children: ReactNode }) {
  const qc = useQueryClient();
  const [travado, setTravado] = useState(false);
  const [fator, setFator] = useState<FatorFaceId | null>(null);
  const [ocupado, setOcupado] = useState(false);
  const [erro, setErro] = useState("");
  const saiuEm = useRef<number | null>(null);
  const conferido = useRef(false);

  // Ao abrir o app: trava se a opção estiver ligada neste aparelho e houver Face ID ativo.
  useEffect(() => {
    if (conferido.current || !travaLigada() || !suportaFaceId()) return;
    conferido.current = true;
    void listarFaceId().then((l) => {
      if (!l.length) return;
      setFator(l[0]);
      // Acabou de entrar com o Face ID ou o código: não pede de novo.
      const recente = sessionStorage.getItem("crm:faceid-ok");
      if (recente && Date.now() - Number(recente) < 60_000) return;
      setTravado(true);
    });
  }, []);

  // Ao voltar depois de alguns minutos fora: trava de novo.
  useEffect(() => {
    const aoMudar = () => {
      if (!travaLigada()) return;
      if (document.visibilityState === "hidden") {
        saiuEm.current = Date.now();
      } else if (saiuEm.current && Date.now() - saiuEm.current > MINUTOS_PARA_TRAVAR * 60_000) {
        void listarFaceId().then((l) => {
          if (!l.length) return;
          setFator(l[0]);
          setTravado(true);
        });
      }
    };
    document.addEventListener("visibilitychange", aoMudar);
    return () => document.removeEventListener("visibilitychange", aoMudar);
  }, []);

  async function desbloquear() {
    if (!fator) return;
    setErro("");
    setOcupado(true);
    try {
      await confirmarFaceId(fator.id);
      sessionStorage.setItem("crm:faceid-ok", String(Date.now()));
      setTravado(false);
      saiuEm.current = null;
      void qc.invalidateQueries({ queryKey: ["crm"], refetchType: "active" });
    } catch (e) {
      setErro(erroFaceId(e));
    } finally {
      setOcupado(false);
    }
  }

  async function sair() {
    qc.clear();
    await supabase.auth.signOut();
    window.location.replace("/login");
  }

  if (!travado) return <>{children}</>;
  return (
    <div className="safe-top flex min-h-[100dvh] flex-col items-center justify-center bg-nav px-6 text-center">
      <span className="flex h-16 w-16 items-center justify-center rounded-2xl bg-[#EEF3FF] text-primary">
        <Lock className="h-7 w-7" />
      </span>
      <h1 className="mt-5 text-[20px] font-semibold">CRM travado</h1>
      <p className="mt-1 max-w-xs text-[14px] text-muted-foreground">
        Confirme com o Face ID para ver os dados da IA News.
      </p>
      <Button
        className="mt-6 h-12 w-full max-w-xs text-[15px]"
        onClick={desbloquear}
        disabled={ocupado}
      >
        {ocupado ? <Loader2 className="h-5 w-5 animate-spin" /> : <ScanFace className="h-5 w-5" />}
        Desbloquear com Face ID
      </Button>
      {erro ? <p className="mt-3 max-w-xs text-[13px] text-destructive">{erro}</p> : null}
      <button
        type="button"
        onClick={sair}
        className="mt-5 text-[13px] font-medium text-muted-foreground hover:text-foreground"
      >
        Sair e entrar com senha
      </button>
    </div>
  );
}
