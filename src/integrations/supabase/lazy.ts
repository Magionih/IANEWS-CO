/* Carrega o cliente do Supabase (login) só quando é preciso.
   Leitores sem login não baixam a biblioteca de autenticação: as páginas públicas
   usam funções do servidor, e o cliente só entra quando há sessão salva ou numa tela de login. */
import type { supabase as Client } from "./client";

let loading: Promise<typeof Client> | null = null;

export function loadSupabase(): Promise<typeof Client> {
  if (!loading) loading = import("./client").then((m) => m.supabase);
  return loading;
}

/** Há sessão do Supabase guardada neste navegador? (chave padrão sb-<projeto>-auth-token) */
export function hasStoredSession(): boolean {
  if (typeof window === "undefined") return false;
  try {
    for (let i = 0; i < window.localStorage.length; i++) {
      const k = window.localStorage.key(i);
      if (k && /^sb-.+-auth-token$/.test(k)) return true;
    }
  } catch {
    /* armazenamento bloqueado */
  }
  return false;
}

/** Token de acesso atual, sem baixar o cliente quando não há sessão. */
export async function getAccessToken(): Promise<string | null> {
  if (!hasStoredSession()) return null;
  const sb = await loadSupabase();
  const { data } = await sb.auth.getSession();
  return data.session?.access_token ?? null;
}
