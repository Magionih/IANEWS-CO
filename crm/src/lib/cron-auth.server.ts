// Proteção das rotinas agendadas do CRM (/api/hooks/*).
// O Vercel Cron envia "Authorization: Bearer <CRON_SECRET>"; qualquer outra chamada é recusada.
import { timingSafeEqual } from "node:crypto";

function safeEqual(a: string, b: string) {
  const x = Buffer.from(a);
  const y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
}

export function cronUnauthorized(request: Request): Response | null {
  const secret = process.env.CRON_SECRET;
  const header = request.headers.get("authorization") ?? "";
  if (!secret || secret.length < 16 || !safeEqual(header, `Bearer ${secret}`)) {
    return Response.json({ ok: false, error: "Não autorizado." }, { status: 401 });
  }
  return null;
}

/** E-mails ligados quando há chave do Resend; CRM_EMAILS=false desliga. */
export function emailSendingEnabled(): boolean {
  if (process.env.CRM_EMAILS === "false") return false;
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
