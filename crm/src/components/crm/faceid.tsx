import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Fingerprint, Loader2, ScanFace, ShieldCheck, X } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { supabase } from "@/integrations/supabase/client";

/* Face ID no CRM (chave de acesso do próprio aparelho, padrão WebAuthn).
   - Ativar: no celular, o CRM cria uma chave de acesso protegida pelo Face ID (ou Touch ID,
     digital, Windows Hello). Ela fica no aparelho; a parte pública fica guardada neste navegador.
   - Entrar: com a trava ligada, o CRM pede o Face ID sempre que é aberto e quando volta depois
     de alguns minutos fora. Os dados ficam escondidos até confirmar. A assinatura do Face ID é
     conferida aqui (desafio novo a cada vez, origem, site, verificação biométrica e assinatura).
   - Com o Face ID ativo, o CRM não desconecta depois de 2 horas sem uso: ele trava e pede o
     Face ID de novo (assim não é preciso digitar senha e código toda vez).
   - Em outro aparelho, o primeiro acesso continua sendo senha + código de 6 números. */

const CHAVE = "crm:faceid:v2";
const CHAVE_TRAVA = "crm:faceid:trava";
const CHAVE_OK = "crm:faceid-ok";
const CHAVE_DISPENSA = "crm:faceid:dispensado";
const MINUTOS_PARA_TRAVAR = 5;

type JwkPublica = {
  kty: "EC" | "RSA";
  crv?: string;
  x?: string;
  y?: string;
  n?: string;
  e?: string;
};
export type RegistroFaceId = {
  userId: string;
  credId: string;
  alg: -7 | -257;
  jwk: JwkPublica;
  criadoEm: string;
  aparelho: string;
};

// ---------- utilidades ----------

const b64url = (buf: ArrayBuffer | Uint8Array) => {
  const bytes = buf instanceof Uint8Array ? buf : new Uint8Array(buf);
  let s = "";
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
};
const deB64url = (s: string) => {
  const b = atob(s.replace(/-/g, "+").replace(/_/g, "/") + "===".slice((s.length + 3) % 4));
  return Uint8Array.from(b, (c) => c.charCodeAt(0));
};
const iguais = (a: Uint8Array, b: Uint8Array) =>
  a.length === b.length && a.every((v, i) => v === b[i]);
const sha256 = async (dados: Uint8Array | string) =>
  new Uint8Array(
    await crypto.subtle.digest(
      "SHA-256",
      typeof dados === "string" ? new TextEncoder().encode(dados) : new Uint8Array(dados),
    ),
  );
const aleatorio = (n = 32) => crypto.getRandomValues(new Uint8Array(n));

/** CBOR mínimo (o que o WebAuthn usa: números, bytes, textos, listas, mapas). */
function lerCbor(buf: Uint8Array, pos = 0): [unknown, number] {
  const ini = buf[pos]!;
  const tipo = ini >> 5;
  const info = ini & 31;
  pos += 1;
  let val: number;
  if (info < 24) val = info;
  else if (info === 24) {
    val = buf[pos]!;
    pos += 1;
  } else if (info === 25) {
    val = (buf[pos]! << 8) | buf[pos + 1]!;
    pos += 2;
  } else if (info === 26) {
    val = buf[pos]! * 2 ** 24 + (buf[pos + 1]! << 16) + (buf[pos + 2]! << 8) + buf[pos + 3]!;
    pos += 4;
  } else throw new Error("Formato da chave não suportado.");
  switch (tipo) {
    case 0:
      return [val, pos];
    case 1:
      return [-1 - val, pos];
    case 2:
      return [buf.slice(pos, pos + val), pos + val];
    case 3:
      return [new TextDecoder().decode(buf.slice(pos, pos + val)), pos + val];
    case 4: {
      const lista: unknown[] = [];
      for (let i = 0; i < val; i++) {
        const [v, p] = lerCbor(buf, pos);
        lista.push(v);
        pos = p;
      }
      return [lista, pos];
    }
    case 5: {
      const mapa = new Map<unknown, unknown>();
      for (let i = 0; i < val; i++) {
        const [k, p1] = lerCbor(buf, pos);
        const [v, p2] = lerCbor(buf, p1);
        mapa.set(k, v);
        pos = p2;
      }
      return [mapa, pos];
    }
    case 7:
      return [info === 21 ? true : info === 20 ? false : null, pos];
    default:
      throw new Error("Formato da chave não suportado.");
  }
}

/** Assinatura ECDSA do WebAuthn vem em DER; o WebCrypto quer r||s (64 bytes). */
function derParaBruto(der: Uint8Array): Uint8Array<ArrayBuffer> {
  let p = 2;
  if (der[1]! & 0x80) p = 2 + (der[1]! & 0x7f);
  const ler = () => {
    if (der[p] !== 0x02) throw new Error("Assinatura inválida.");
    const len = der[p + 1]!;
    let v = der.slice(p + 2, p + 2 + len);
    p += 2 + len;
    while (v.length > 32 && v[0] === 0) v = v.slice(1);
    const saida = new Uint8Array(32);
    saida.set(v, 32 - v.length);
    return saida;
  };
  const r = ler();
  const s = ler();
  const bruto = new Uint8Array(64);
  bruto.set(r, 0);
  bruto.set(s, 32);
  return bruto;
}

function nomeAparelho() {
  const ua = navigator.userAgent;
  const base = /iPhone/.test(ua)
    ? "iPhone"
    : /iPad/.test(ua)
      ? "iPad"
      : /Android/.test(ua)
        ? "Android"
        : /Mac/.test(ua)
          ? "Mac"
          : /Windows/.test(ua)
            ? "Windows"
            : "Aparelho";
  return `${base} · ${new Date().toLocaleDateString("pt-BR")}`;
}

// ---------- estado no aparelho ----------

function lerRegistro(): RegistroFaceId | null {
  try {
    const r = JSON.parse(localStorage.getItem(CHAVE) ?? "null") as RegistroFaceId | null;
    return r && r.credId && r.jwk && r.userId ? r : null;
  } catch {
    return null;
  }
}

export function travaLigada() {
  try {
    return localStorage.getItem(CHAVE_TRAVA) !== "0";
  } catch {
    return true;
  }
}

function setTrava(v: boolean) {
  try {
    localStorage.setItem(CHAVE_TRAVA, v ? "1" : "0");
  } catch {
    /* sem armazenamento */
  }
}

/** Face ID ativo neste aparelho para quem está logado e com a trava ligada. */
export function faceIdLigadoNoAparelho(userId?: string | null) {
  const r = lerRegistro();
  return !!r && (!userId || r.userId === userId) && travaLigada();
}

export function marcarDesbloqueado() {
  try {
    sessionStorage.setItem(CHAVE_OK, String(Date.now()));
  } catch {
    /* sem armazenamento */
  }
}

async function suportaFaceId(): Promise<boolean> {
  try {
    if (typeof window === "undefined" || !("PublicKeyCredential" in window)) return false;
    return await PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable();
  } catch {
    return false;
  }
}

/** Mensagem clara para os erros do WebAuthn. */
export function erroFaceId(e: unknown): string {
  const nome = (e as { name?: string })?.name ?? "";
  const msg = e instanceof Error ? e.message : String(e ?? "");
  if (nome === "NotAllowedError" || /cancel|abort|timed out|not allowed/i.test(msg))
    return "Face ID cancelado ou não reconhecido. Toque para tentar de novo.";
  if (nome === "InvalidStateError") return "Este aparelho já tem o Face ID ativo no CRM.";
  if (nome === "SecurityError") return "O Face ID só funciona no endereço oficial do CRM.";
  if (nome === "NotSupportedError") return "Este aparelho não oferece Face ID para o navegador.";
  return msg || "Não foi possível usar o Face ID agora.";
}

// ---------- cerimônias ----------

async function ativarFaceId(user: { id: string; email: string; nome: string }) {
  const desafio = aleatorio();
  const cred = (await navigator.credentials.create({
    publicKey: {
      challenge: desafio,
      rp: { name: "IA News CRM", id: location.hostname },
      user: {
        id: new TextEncoder().encode(user.id),
        name: user.email,
        displayName: user.nome || user.email,
      },
      pubKeyCredParams: [
        { type: "public-key", alg: -7 },
        { type: "public-key", alg: -257 },
      ],
      authenticatorSelection: {
        authenticatorAttachment: "platform",
        userVerification: "required",
        residentKey: "preferred",
      },
      timeout: 60_000,
      attestation: "none",
    },
  })) as PublicKeyCredential | null;
  if (!cred) throw new Error("Face ID cancelado.");
  const resp = cred.response as AuthenticatorAttestationResponse;

  // Confere o que o aparelho devolveu.
  const cliente = JSON.parse(new TextDecoder().decode(resp.clientDataJSON)) as {
    type: string;
    challenge: string;
    origin: string;
  };
  if (cliente.type !== "webauthn.create" || cliente.challenge !== b64url(desafio))
    throw new Error("Resposta do Face ID inválida.");
  if (cliente.origin !== location.origin) throw new Error("Origem inválida.");
  const [att] = lerCbor(new Uint8Array(resp.attestationObject)) as [Map<string, unknown>, number];
  const auth = att.get("authData") as Uint8Array;
  if (!iguais(auth.slice(0, 32), await sha256(location.hostname)))
    throw new Error("Site inválido.");
  const flags = auth[32]!;
  if (!(flags & 0x01) || !(flags & 0x04) || !(flags & 0x40))
    throw new Error("O aparelho não confirmou a biometria.");
  const lenId = (auth[53]! << 8) | auth[54]!;
  const credId = auth.slice(55, 55 + lenId);
  if (!iguais(credId, new Uint8Array(cred.rawId))) throw new Error("Chave inválida.");
  const [cose] = lerCbor(auth, 55 + lenId) as [Map<number, unknown>, number];
  const kty = cose.get(1);
  const alg = cose.get(3) as number;
  let jwk: JwkPublica;
  if (kty === 2 && alg === -7) {
    jwk = {
      kty: "EC",
      crv: "P-256",
      x: b64url(cose.get(-2) as Uint8Array),
      y: b64url(cose.get(-3) as Uint8Array),
    };
  } else if (kty === 3 && alg === -257) {
    jwk = {
      kty: "RSA",
      n: b64url(cose.get(-1) as Uint8Array),
      e: b64url(cose.get(-2) as Uint8Array),
    };
  } else throw new Error("Tipo de chave não suportado neste aparelho.");

  const reg: RegistroFaceId = {
    userId: user.id,
    credId: b64url(credId),
    alg: alg as -7 | -257,
    jwk,
    criadoEm: new Date().toISOString(),
    aparelho: nomeAparelho(),
  };
  localStorage.setItem(CHAVE, JSON.stringify(reg));
  setTrava(true);
  marcarDesbloqueado();
  return reg;
}

/** Pede o Face ID e confere a assinatura com a chave guardada. */
export async function confirmarFaceId(reg: RegistroFaceId) {
  const desafio = aleatorio();
  const cred = (await navigator.credentials.get({
    publicKey: {
      challenge: desafio,
      rpId: location.hostname,
      allowCredentials: [
        { type: "public-key", id: deB64url(reg.credId), transports: ["internal"] },
      ],
      userVerification: "required",
      timeout: 60_000,
    },
  })) as PublicKeyCredential | null;
  if (!cred) throw new Error("Face ID cancelado.");
  const resp = cred.response as AuthenticatorAssertionResponse;
  const clienteBytes = new Uint8Array(resp.clientDataJSON);
  const cliente = JSON.parse(new TextDecoder().decode(clienteBytes)) as {
    type: string;
    challenge: string;
    origin: string;
  };
  if (cliente.type !== "webauthn.get" || cliente.challenge !== b64url(desafio))
    throw new Error("Resposta do Face ID inválida.");
  if (cliente.origin !== location.origin) throw new Error("Origem inválida.");
  if (b64url(cred.rawId) !== reg.credId) throw new Error("Chave diferente da ativada.");
  const auth = new Uint8Array(resp.authenticatorData);
  if (!iguais(auth.slice(0, 32), await sha256(location.hostname)))
    throw new Error("Site inválido.");
  const flags = auth[32]!;
  if (!(flags & 0x01) || !(flags & 0x04)) throw new Error("O aparelho não confirmou a biometria.");
  const hashCliente = await sha256(clienteBytes);
  const assinado = new Uint8Array(auth.length + hashCliente.length);
  assinado.set(auth, 0);
  assinado.set(hashCliente, auth.length);
  const assinatura = new Uint8Array(resp.signature);
  let ok = false;
  if (reg.alg === -7) {
    const chave = await crypto.subtle.importKey(
      "jwk",
      { ...reg.jwk, ext: true },
      { name: "ECDSA", namedCurve: "P-256" },
      false,
      ["verify"],
    );
    ok = await crypto.subtle.verify(
      { name: "ECDSA", hash: "SHA-256" },
      chave,
      derParaBruto(assinatura),
      assinado,
    );
  } else {
    const chave = await crypto.subtle.importKey(
      "jwk",
      { ...reg.jwk, alg: "RS256", ext: true },
      { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
      false,
      ["verify"],
    );
    ok = await crypto.subtle.verify("RSASSA-PKCS1-v1_5", chave, assinatura, assinado);
  }
  if (!ok) throw new Error("A assinatura do Face ID não confere.");
  marcarDesbloqueado();
}

function desativarFaceId() {
  try {
    localStorage.removeItem(CHAVE);
    localStorage.removeItem(CHAVE_TRAVA);
  } catch {
    /* sem armazenamento */
  }
}

async function usuarioAtual() {
  const { data } = await supabase.auth.getSession();
  const u = data.session?.user;
  if (!u) return null;
  const meta = (u.user_metadata ?? {}) as { full_name?: string; name?: string };
  return { id: u.id, email: u.email ?? "", nome: meta.full_name ?? meta.name ?? "" };
}

// ---------- telas ----------

function useFaceId() {
  const [suporta, setSuporta] = useState<boolean | null>(null);
  const [reg, setReg] = useState<RegistroFaceId | null>(null);
  const [trava, setTravaEstado] = useState(true);
  const carregar = useCallback(async () => {
    const [s, u] = await Promise.all([suportaFaceId(), usuarioAtual()]);
    const r = lerRegistro();
    setSuporta(s);
    setReg(r && u && r.userId === u.id ? r : null);
    setTravaEstado(travaLigada());
  }, []);
  useEffect(() => {
    void carregar();
  }, [carregar]);
  return { suporta, reg, trava, setTravaEstado, carregar };
}

/** Minha conta: ativar o Face ID neste aparelho e ligar a trava ao abrir o app. */
export function CartaoFaceId({ compacto }: { compacto?: boolean }) {
  const { suporta, reg, trava, setTravaEstado, carregar } = useFaceId();
  const [ocupado, setOcupado] = useState(false);
  const [erro, setErro] = useState("");
  const [dispensado, setDispensado] = useState(() => {
    if (!compacto) return false;
    try {
      return Date.now() - Number(localStorage.getItem(CHAVE_DISPENSA) ?? 0) < 14 * 86_400_000;
    } catch {
      return false;
    }
  });

  async function ativar() {
    setErro("");
    setOcupado(true);
    try {
      const u = await usuarioAtual();
      if (!u) throw new Error("Entre de novo para ativar o Face ID.");
      await ativarFaceId(u);
      toast.success("Face ID ativado. O CRM vai pedir o Face ID sempre que for aberto.");
      await carregar();
    } catch (e) {
      setErro(erroFaceId(e));
    } finally {
      setOcupado(false);
    }
  }

  async function testar() {
    if (!reg) return;
    setErro("");
    setOcupado(true);
    try {
      await confirmarFaceId(reg);
      toast.success("Face ID conferido.");
    } catch (e) {
      setErro(erroFaceId(e));
    } finally {
      setOcupado(false);
    }
  }

  function desativar() {
    if (!window.confirm("Desativar o Face ID neste aparelho?")) return;
    desativarFaceId();
    toast.success("Face ID desativado neste aparelho.");
    void carregar();
  }

  if (suporta == null) return null;

  if (compacto) {
    if (!suporta || reg || dispensado) return null;
    return (
      <section className="flex flex-wrap items-center gap-3 rounded-xl border bg-card px-4 py-3.5 sm:px-5">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[10px] bg-[#EEF3FF] text-primary">
          <ScanFace className="h-5 w-5" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-[13.5px] font-semibold">Entrar com Face ID neste aparelho</p>
          <p className="text-[12.5px] text-muted-foreground">
            O CRM pede o Face ID ao abrir, sem senha e código toda vez.
          </p>
          {erro ? <p className="mt-1 text-[12.5px] text-destructive">{erro}</p> : null}
        </div>
        <Button className="h-9" onClick={ativar} disabled={ocupado}>
          {ocupado ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Fingerprint className="h-4 w-4" />
          )}
          Ativar
        </Button>
        <button
          type="button"
          aria-label="Agora não"
          title="Agora não (lembra de novo em 14 dias)"
          onClick={() => {
            try {
              localStorage.setItem(CHAVE_DISPENSA, String(Date.now()));
            } catch {
              /* sem armazenamento */
            }
            setDispensado(true);
          }}
          className="flex h-9 w-9 items-center justify-center rounded-lg text-muted-foreground transition hover:bg-muted hover:text-foreground"
        >
          <X className="h-4 w-4" />
        </button>
      </section>
    );
  }

  return (
    <section className="rounded-xl border bg-card">
      <header className="flex flex-wrap items-center gap-3.5 px-4 pt-4 sm:px-5">
        <span className="flex h-10 w-10 items-center justify-center rounded-[11px] bg-[#EEF3FF] text-primary">
          <ScanFace className="h-5 w-5" />
        </span>
        <div className="min-w-0 flex-1">
          <h2 className="text-[14.5px] font-semibold">Face ID</h2>
          <p className="text-[12.5px] text-muted-foreground">
            {reg
              ? `Ativo neste aparelho (${reg.aparelho}).`
              : "Ative no celular: o CRM passa a pedir o Face ID sempre que for aberto."}
          </p>
        </div>
        {suporta && !reg ? (
          <Button onClick={ativar} disabled={ocupado} className="h-9">
            {ocupado ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Fingerprint className="h-4 w-4" />
            )}
            Ativar neste aparelho
          </Button>
        ) : null}
      </header>
      <div className="space-y-3 px-4 pb-4 pt-3 sm:px-5 sm:pb-5">
        {erro ? <p className="text-[13px] text-destructive">{erro}</p> : null}
        {!suporta ? (
          <p className="text-[12.5px] text-muted-foreground">
            Este navegador não oferece Face ID ou biometria. No iPhone, abra o CRM pelo ícone na
            Tela de Início (ou no Safari) e ative por aqui.
          </p>
        ) : reg ? (
          <>
            <label className="flex items-center justify-between gap-4 rounded-lg bg-background px-3.5 py-3">
              <span className="min-w-0">
                <span className="block text-[13.5px] font-semibold">
                  Pedir Face ID ao abrir o app
                </span>
                <span className="block text-[12px] text-muted-foreground">
                  Trava ao abrir, depois de {MINUTOS_PARA_TRAVAR} minutos fora e no lugar de
                  desconectar por falta de uso.
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
            <div className="flex flex-wrap gap-2">
              <Button variant="outline" className="h-9" onClick={testar} disabled={ocupado}>
                {ocupado ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <ShieldCheck className="h-4 w-4" />
                )}
                Testar Face ID
              </Button>
              <Button variant="ghost" className="h-9" onClick={desativar} disabled={ocupado}>
                Desativar neste aparelho
              </Button>
            </div>
          </>
        ) : (
          <p className="text-[12.5px] text-muted-foreground">
            O primeiro acesso em cada aparelho continua com senha e código. Depois disso, o Face ID
            abre o CRM.
          </p>
        )}
      </div>
    </section>
  );
}

/** Chave da sessão do Supabase guardada no aparelho (para saber de quem é, sem ir ao servidor). */
const CHAVE_SESSAO = (() => {
  try {
    const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
    return `sb-${url ? new URL(url).hostname.split(".")[0] : "hgydwvuowxxkdgtlqrdy"}-auth-token`;
  } catch {
    return "sb-hgydwvuowxxkdgtlqrdy-auth-token";
  }
})();

function usuarioSalvo(): string | null {
  try {
    const s = JSON.parse(localStorage.getItem(CHAVE_SESSAO) ?? "null") as {
      user?: { id?: string };
    } | null;
    return s?.user?.id ?? null;
  } catch {
    return null;
  }
}

/** Decide na hora (sem esperar o servidor) se o app abre travado: assim nenhum dado aparece antes. */
function precisaTravar(forcar: boolean): RegistroFaceId | null {
  if (typeof window === "undefined") return null;
  const r = lerRegistro();
  if (!r || !travaLigada()) return null;
  const uid = usuarioSalvo();
  if (uid && uid !== r.userId) return null;
  if (!forcar) {
    try {
      const ok = Number(sessionStorage.getItem(CHAVE_OK) ?? 0);
      if (ok && Date.now() - ok < 60_000) return null;
    } catch {
      /* sem armazenamento */
    }
  }
  return r;
}

/** Tela de bloqueio no padrão dos apps de banco: ao abrir o CRM (ou voltar depois de alguns
 *  minutos), o Face ID é pedido na hora, sem botão. Se for cancelado, um toque tenta de novo.
 *  Em segundo plano, uma capa esconde os dados (inclusive no seletor de apps do celular). */
export function TravaFaceId({ children }: { children: ReactNode }) {
  const qc = useQueryClient();
  const [reg, setReg] = useState<RegistroFaceId | null>(() => precisaTravar(false));
  const [pedindo, setPedindo] = useState(false);
  const [erro, setErro] = useState("");
  const [coberto, setCoberto] = useState(false);
  const saiuEm = useRef<number | null>(null);
  const tentou = useRef(false);
  const repetiu = useRef(false);
  const travado = !!reg;

  const travar = useCallback((forcar: boolean) => {
    const r = precisaTravar(forcar);
    if (!r) return;
    tentou.current = false;
    repetiu.current = false;
    setErro("");
    setReg(r);
  }, []);

  const desbloquear = useCallback(async () => {
    const r = lerRegistro();
    if (!r) {
      setReg(null);
      return;
    }
    tentou.current = true;
    setErro("");
    setPedindo(true);
    const inicio = Date.now();
    try {
      await confirmarFaceId(r);
      setReg(null);
      void qc.invalidateQueries({ queryKey: ["crm"], refetchType: "active" });
    } catch (e) {
      // Falhou na hora (app ainda ganhando o foco ao abrir): tenta sozinho mais uma vez.
      if (Date.now() - inicio < 900 && !repetiu.current) {
        repetiu.current = true;
        tentou.current = false;
        window.setTimeout(() => {
          if (!tentou.current && document.visibilityState === "visible") void desbloquear();
        }, 500);
      } else if (Date.now() - inicio >= 900) {
        // O Face ID abriu e foi cancelado ou não reconheceu: mostra o motivo.
        setErro(erroFaceId(e));
      }
      // Recusado na hora de novo (o celular pede um toque antes): fica só o convite para tocar.
    } finally {
      setPedindo(false);
    }
  }, [qc]);

  // Pede o Face ID sozinho assim que o CRM trava e está na tela.
  useEffect(() => {
    if (!travado) return;
    const tentar = () => {
      if (tentou.current || document.visibilityState !== "visible") return;
      void desbloquear();
    };
    const t = window.setTimeout(tentar, 200);
    const aoVoltar = () => {
      if (document.visibilityState === "visible") tentar();
    };
    document.addEventListener("visibilitychange", aoVoltar);
    window.addEventListener("focus", tentar);
    return () => {
      window.clearTimeout(t);
      document.removeEventListener("visibilitychange", aoVoltar);
      window.removeEventListener("focus", tentar);
    };
  }, [travado, desbloquear]);

  // Ao abrir o app: confere com a sessão do servidor (troca de conta, sessão encerrada).
  useEffect(() => {
    if (!travado) return;
    void usuarioAtual().then((u) => {
      const r = lerRegistro();
      if (!u || !r || u.id !== r.userId) setReg(null);
    });
    // Só na abertura.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Segundo plano: capa nos dados; na volta, trava se ficou fora mais de alguns minutos.
  useEffect(() => {
    const aoMudar = () => {
      if (document.visibilityState === "hidden") {
        saiuEm.current = Date.now();
        if (lerRegistro() && travaLigada()) setCoberto(true);
      } else {
        const fora = saiuEm.current ? Date.now() - saiuEm.current : 0;
        saiuEm.current = null;
        if (fora > MINUTOS_PARA_TRAVAR * 60_000) travar(true);
        setCoberto(false);
      }
    };
    const aoPedir = () => travar(true);
    document.addEventListener("visibilitychange", aoMudar);
    window.addEventListener("crm:travar", aoPedir);
    return () => {
      document.removeEventListener("visibilitychange", aoMudar);
      window.removeEventListener("crm:travar", aoPedir);
    };
  }, [travar]);

  async function sair() {
    qc.clear();
    await supabase.auth.signOut();
    window.location.replace("/login");
  }

  const mensagem = pedindo ? "Confirmando com Face ID…" : erro || "Toque para entrar com Face ID";

  return (
    <>
      <div aria-hidden={travado || coberto} className={travado ? "hidden" : undefined}>
        {children}
      </div>
      {travado || coberto ? (
        <div
          role={travado ? "dialog" : undefined}
          aria-modal={travado || undefined}
          aria-label={travado ? "CRM travado" : undefined}
          onClick={() => {
            if (travado && !pedindo) void desbloquear();
          }}
          className="safe-top fixed inset-0 z-[100] flex min-h-[100dvh] select-none flex-col items-center bg-[#0B1220] px-6 text-center"
        >
          <div className="flex flex-1 flex-col items-center justify-center">
            <img
              src="/icon-192.png"
              alt=""
              className="h-[68px] w-[68px] rounded-[18px] shadow-[0_12px_40px_-12px_rgb(31_94_255/0.7)]"
            />
            <p className="mt-4 text-[17px] font-semibold tracking-[-0.01em] text-white">
              IA News CRM
            </p>
            {travado ? (
              <>
                <span
                  className={`mt-12 flex h-[72px] w-[72px] items-center justify-center rounded-full border border-white/15 bg-white/[0.04] text-white transition ${
                    pedindo ? "border-primary/60 bg-primary/15" : ""
                  }`}
                >
                  <ScanFace
                    className={`h-9 w-9 ${pedindo ? "animate-pulse text-white" : "text-white/85"}`}
                  />
                </span>
                <p
                  className={`mt-4 max-w-[260px] text-[14px] leading-snug ${
                    erro && !pedindo ? "text-[#FFB4A8]" : "text-white/70"
                  }`}
                  aria-live="polite"
                >
                  {mensagem}
                </p>
              </>
            ) : null}
          </div>
          {travado ? (
            <div className="flex w-full flex-col items-center gap-3 pb-[calc(env(safe-area-inset-bottom)+28px)]">
              {!pedindo ? (
                <Button
                  className="h-12 w-full max-w-xs text-[15px]"
                  onClick={(e) => {
                    e.stopPropagation();
                    void desbloquear();
                  }}
                >
                  <ScanFace className="h-5 w-5" /> Entrar com Face ID
                </Button>
              ) : null}
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  void sair();
                }}
                className="text-[13px] font-medium text-white/50 hover:text-white"
              >
                Sair e entrar com senha
              </button>
            </div>
          ) : null}
        </div>
      ) : null}
    </>
  );
}
