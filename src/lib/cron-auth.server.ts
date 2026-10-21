// Proteção das rotinas agendadas (/api/public/hooks/*).
// Aceita duas origens:
//  1. Vercel Cron: "Authorization: Bearer <CRON_SECRET>".
//  2. pg_cron do Supabase: "x-ianews-cron-token: <token>", cujo SHA-256 fica em public.cron_tokens
//     (o token em si fica só no Vault do banco).
import { createHash, timingSafeEqual } from "node:crypto";

function safeEqual(a: string, b: string) {
  const x = Buffer.from(a);
  const y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
}

let tokenHashCache: { hash: string | null; at: number } | null = null;

async function dbTokenHash(): Promise<string | null> {
  if (tokenHashCache && Date.now() - tokenHashCache.at < 5 * 60 * 1000) return tokenHashCache.hash;
  try {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data } = await supabaseAdmin
      .from("cron_tokens" as never)
      .select("token_sha256")
      .eq("name", "pg_cron")
      .maybeSingle();
    const hash = (data as { token_sha256?: string } | null)?.token_sha256 ?? null;
    tokenHashCache = { hash, at: Date.now() };
    return hash;
  } catch {
    return null;
  }
}

export async function cronUnauthorized(request: Request): Promise<Response | null> {
  const dbToken = request.headers.get("x-ianews-cron-token");
  if (dbToken && dbToken.length >= 32) {
    const expected = await dbTokenHash();
    const got = createHash("sha256").update(dbToken).digest("hex");
    if (expected && safeEqual(got, expected)) return null;
    return Response.json({ ok: false, error: "Não autorizado." }, { status: 401 });
  }

  const secret = process.env.CRON_SECRET;
  if (!secret || secret.length < 16) {
    return Response.json({ ok: false, error: "Não autorizado." }, { status: 401 });
  }
  const header = request.headers.get("authorization") ?? "";
  if (!safeEqual(header, `Bearer ${secret}`)) {
    return Response.json({ ok: false, error: "Não autorizado." }, { status: 401 });
  }
  return null;
}

/** Quem disparou a rotina (para registro). */
export function cronSource(request: Request): "pg_cron" | "vercel" {
  return request.headers.get("x-ianews-cron-token") ? "pg_cron" : "vercel";
}

/**
 * Envio de e-mails para a base. Ligado por padrão quando há chave do Resend;
 * pode ser desligado com NEWSLETTER_ENABLED=false.
 */
export function emailSendingEnabled(): boolean {
  if (process.env.NEWSLETTER_ENABLED === "false") return false;
  return Boolean(process.env.RESEND_API_KEY);
}

export async function readJson<T extends object>(request: Request): Promise<Partial<T>> {
  if (request.method !== "POST") return {};
  try {
    return ((await request.json()) ?? {}) as Partial<T>;
  } catch {
    return {};
  }
}
