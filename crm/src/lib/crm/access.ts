import { createMiddleware } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

/* Acesso ao CRM: só admin, comercial e editorial (o papel "editor" já existente conta como editorial).
   As consultas usam o token de quem está logado, então a RLS das tabelas crm_* vale sempre;
   esta verificação só dá uma mensagem clara e libera as ações de admin.

   Desempenho: a assinatura do token é conferida localmente com as chaves públicas do Supabase
   (guardadas em memória pela instância) e os papéis ficam 30s em memória. Assim cada clique faz
   só as consultas da tela, sem idas extras ao banco para conferir quem é o usuário. */

export const CRM_PAPEIS = ["admin", "comercial", "editorial", "editor"] as const;

// As tabelas crm_* ainda não estão nos tipos gerados do Supabase.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type CrmDb = SupabaseClient<any, "public", any>;

const SEM_SESSAO = { storage: undefined, persistSession: false, autoRefreshToken: false };

function configSupabase() {
  const url = process.env.SUPABASE_URL;
  const chave = process.env.SUPABASE_PUBLISHABLE_KEY;
  if (!url || !chave) throw new Error("Configuração do Supabase ausente no servidor do CRM.");
  return { url, chave };
}

// Cliente só para conferir tokens: reaproveitado entre chamadas, guarda as chaves públicas (JWKS).
let verificador: CrmDb | undefined;
function getVerificador(): CrmDb {
  if (!verificador) {
    const { url, chave } = configSupabase();
    verificador = createClient(url, chave, { auth: SEM_SESSAO }) as CrmDb;
  }
  return verificador;
}

const PAPEIS_TTL_MS = 30_000;
const cachePapeis = new Map<string, { papeis: string[]; ate: number }>();

async function papeisDo(db: CrmDb, userId: string): Promise<string[]> {
  const agora = Date.now();
  const guardado = cachePapeis.get(userId);
  if (guardado && guardado.ate > agora) return guardado.papeis;
  const { data, error } = await db.from("user_roles").select("role").eq("user_id", userId);
  if (error) throw new Error(error.message);
  const papeis = ((data ?? []) as { role: string }[]).map((r) => r.role);
  if (cachePapeis.size > 500) cachePapeis.clear();
  cachePapeis.set(userId, { papeis, ate: agora + PAPEIS_TTL_MS });
  return papeis;
}

const JWT = /^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/;

export const requireCrmAccess = createMiddleware({ type: "function" }).server(async ({ next }) => {
  const auth = getRequest()?.headers.get("authorization") ?? "";
  const token = auth.startsWith("Bearer ") ? auth.slice(7).trim() : "";
  if (!token || token.length > 8192 || !JWT.test(token)) {
    throw new Error("Sessão inválida. Entre novamente no CRM.");
  }

  const { data, error } = await getVerificador().auth.getClaims(token);
  const userId = data?.claims?.sub;
  if (error || !userId) throw new Error("Sessão expirada. Entre novamente no CRM.");

  const { url, chave } = configSupabase();
  const db = createClient(url, chave, {
    global: { headers: { Authorization: `Bearer ${token}` } },
    auth: SEM_SESSAO,
  }) as CrmDb;

  const papeis = await papeisDo(db, userId);
  if (!papeis.some((p) => (CRM_PAPEIS as readonly string[]).includes(p))) {
    throw new Error("Acesso restrito à equipe do CRM (admin, comercial ou editorial).");
  }
  return next({
    context: { db, userId, papeis, isAdmin: papeis.includes("admin") },
  });
});

export function exigirAdmin(isAdmin: boolean) {
  if (!isAdmin) throw new Error("Só o administrador pode fazer esta alteração.");
}

/** Lança a mensagem do banco (gatilhos do CRM devolvem mensagens em português). */
export function checar<T>(res: { data: T; error: { message: string; code?: string } | null }): T {
  if (res.error) {
    if (res.error.code === "23505")
      throw new Error("Já existe um cadastro com esse nome ou e-mail.");
    throw new Error(res.error.message);
  }
  return res.data;
}

/** Busca todas as linhas, de 1000 em 1000 (limite do Supabase por consulta). */
export async function todas<T>(
  montar: (
    de: number,
    ate: number,
  ) => PromiseLike<{ data: unknown; error: { message: string } | null }>,
  maximo = 20_000,
): Promise<T[]> {
  const saida: T[] = [];
  for (let de = 0; de < maximo; de += 1000) {
    const { data, error } = await montar(de, de + 999);
    if (error) throw new Error(error.message);
    const lote = (data ?? []) as T[];
    saida.push(...lote);
    if (lote.length < 1000) break;
  }
  return saida;
}

/** Busca linhas por id em lotes (evita URLs gigantes no filtro "in"). */
export async function porIds<T extends { id: string }>(
  db: CrmDb,
  tabela: string,
  colunas: string,
  ids: (string | null | undefined)[],
): Promise<Map<string, T>> {
  const unicos = [...new Set(ids.filter((v): v is string => !!v))];
  const mapa = new Map<string, T>();
  for (let i = 0; i < unicos.length; i += 150) {
    const { data, error } = await db
      .from(tabela)
      .select(colunas)
      .in("id", unicos.slice(i, i + 150));
    if (error) throw new Error(error.message);
    for (const row of (data ?? []) as unknown as T[]) mapa.set(row.id, row);
  }
  return mapa;
}

// ---------- Validação simples de entrada ----------

export const texto = (v: unknown, max = 500): string | null => {
  if (v == null) return null;
  const t = String(v).trim().slice(0, max);
  return t ? t : null;
};

export const obrigatorio = (v: unknown, campo: string, max = 300): string => {
  const t = texto(v, max);
  if (!t) throw new Error(`Informe ${campo}.`);
  return t;
};

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export const uuid = (v: unknown): string | null =>
  typeof v === "string" && UUID.test(v) ? v : null;
export const uuidObrigatorio = (v: unknown, campo = "o registro"): string => {
  const id = uuid(v);
  if (!id) throw new Error(`Identificador inválido para ${campo}.`);
  return id;
};

export const inteiro = (v: unknown, min = 0, max = 1_000_000_000): number | null => {
  if (v === "" || v == null) return null;
  const n = Math.round(Number(v));
  if (!Number.isFinite(n)) return null;
  return Math.max(min, Math.min(max, n));
};

export const dinheiro = (v: unknown): number | null => {
  if (v === "" || v == null) return null;
  const n = typeof v === "number" ? v : Number(String(v).replace(/\./g, "").replace(",", "."));
  if (!Number.isFinite(n) || n < 0) throw new Error("Valor inválido.");
  return Math.round(n * 100) / 100;
};

export const dia = (v: unknown): string | null => {
  if (!v) return null;
  const s = String(v).slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s) || Number.isNaN(new Date(`${s}T12:00:00Z`).getTime())) {
    throw new Error("Data inválida.");
  }
  return s;
};

export const instante = (v: unknown): string | null => {
  if (!v) return null;
  const d = new Date(String(v));
  if (Number.isNaN(d.getTime())) throw new Error("Data e hora inválidas.");
  return d.toISOString();
};

export const url = (v: unknown): string | null => {
  const t = texto(v, 1000);
  if (!t) return null;
  const comProtocolo = /^https?:\/\//i.test(t) ? t : `https://${t}`;
  try {
    return new URL(comProtocolo).toString();
  } catch {
    throw new Error(`Link inválido: ${t}`);
  }
};

export const email = (v: unknown): string | null => {
  const t = texto(v, 255)?.toLowerCase() ?? null;
  if (t && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(t)) throw new Error("E-mail inválido.");
  return t;
};

export const umDe = <T extends string>(
  v: unknown,
  opcoes: readonly T[],
  campo: string,
): T | null => {
  if (v == null || v === "") return null;
  if (!opcoes.includes(v as T)) throw new Error(`${campo} inválido.`);
  return v as T;
};

/** Lista de ids (uuid) sem repetição, com limite. */
export const listaIds = (v: unknown, max = 20): string[] => {
  if (!Array.isArray(v)) return [];
  const ids = [...new Set(v.map((x) => uuid(x)).filter((x): x is string => !!x))];
  if (ids.length > max) throw new Error(`Use no máximo ${max} tags por negócio.`);
  return ids;
};

export const bool = (v: unknown): boolean => v === true || v === "true";
