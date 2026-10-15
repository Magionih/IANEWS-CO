// Proteção das rotinas agendadas (/api/public/hooks/*).
// A Vercel envia "Authorization: Bearer <CRON_SECRET>" nas chamadas de cron.
import { timingSafeEqual } from "node:crypto";

export function cronUnauthorized(request: Request): Response | null {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    return Response.json({ ok: false, error: "CRON_SECRET não configurado." }, { status: 503 });
  }
  if (secret.length < 16) {
    return Response.json({ ok: false, error: "CRON_SECRET muito curto (mínimo 16 caracteres)." }, { status: 503 });
  }
  const header = request.headers.get("authorization") ?? "";
  const expected = Buffer.from(`Bearer ${secret}`);
  const got = Buffer.from(header);
  if (got.length !== expected.length || !timingSafeEqual(got, expected)) {
    return Response.json({ ok: false, error: "Não autorizado." }, { status: 401 });
  }
  return null;
}

/** Envio de e-mails para a base só acontece com NEWSLETTER_ENABLED=true. */
export function emailSendingEnabled(): boolean {
  return process.env.NEWSLETTER_ENABLED === "true";
}

export async function readJson<T extends object>(request: Request): Promise<Partial<T>> {
  if (request.method !== "POST") return {};
  try {
    return ((await request.json()) ?? {}) as Partial<T>;
  } catch {
    return {};
  }
}
