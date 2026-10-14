// Envio de e-mail via Resend (substitui o serviço de e-mail do Lovable).
// Somente servidor: lê RESEND_API_KEY. Nunca importe em componentes do cliente.

export class EmailAPIError extends Error {
  code: string;
  status: number;
  retryAfterSeconds?: number;
  constructor(message: string, code: string, status: number) {
    super(message);
    this.name = "EmailAPIError";
    this.code = code;
    this.status = status;
  }
}

export type SendEmailParams = {
  to: string;
  from: string;
  subject: string;
  html: string;
  text?: string;
  reply_to?: string;
  idempotency_key?: string;
  /** Mantidos por compatibilidade com o código antigo; ignorados pelo Resend. */
  sender_domain?: string;
  purpose?: string;
  label?: string;
  headers?: Record<string, string>;
};

const RESEND_URL = "https://api.resend.com/emails";
// O plano gratuito do Resend aceita ~2 requisições por segundo.
const MIN_INTERVAL_MS = 550;
let lastSendAt = 0;

async function throttle() {
  const wait = lastSendAt + MIN_INTERVAL_MS - Date.now();
  if (wait > 0) await new Promise((r) => setTimeout(r, wait));
  lastSendAt = Date.now();
}

export function emailConfigured(): boolean {
  return Boolean(process.env.RESEND_API_KEY);
}

export async function sendEmail(params: SendEmailParams, opts: { apiKey?: string } = {}): Promise<{ id: string | null }> {
  const apiKey = opts.apiKey ?? process.env.RESEND_API_KEY;
  if (!apiKey) throw new EmailAPIError("RESEND_API_KEY não configurada.", "missing_api_key", 500);

  await throttle();
  const headers: Record<string, string> = {
    Authorization: `Bearer ${apiKey}`,
    "Content-Type": "application/json",
  };
  if (params.idempotency_key) headers["Idempotency-Key"] = params.idempotency_key.slice(0, 256);

  const body: Record<string, unknown> = {
    from: params.from,
    to: [params.to],
    subject: params.subject,
    html: params.html,
  };
  if (params.text) body.text = params.text;
  if (params.reply_to) body.reply_to = params.reply_to;
  if (params.headers) body.headers = params.headers;
  if (params.label) body.tags = [{ name: "label", value: params.label.replace(/[^a-zA-Z0-9_-]/g, "_").slice(0, 256) }];

  let res: Response;
  try {
    res = await fetch(RESEND_URL, { method: "POST", headers, body: JSON.stringify(body) });
  } catch (err) {
    throw new EmailAPIError(err instanceof Error ? err.message : String(err), "network_error", 0);
  }

  if (res.ok) {
    const data = (await res.json().catch(() => ({}))) as { id?: string };
    return { id: data.id ?? null };
  }

  const data = (await res.json().catch(() => ({}))) as { name?: string; message?: string };
  const message = data.message ?? `Resend respondeu ${res.status}`;
  let code = data.name ?? "send_failed";
  if (res.status === 403 && /domain/i.test(message)) code = "domain_not_verified";
  if (res.status === 429) code = /quota/i.test(message) ? "quota_exceeded" : "rate_limited";
  throw new EmailAPIError(message, code, res.status);
}

/** Alias para manter a assinatura usada pelo código herdado. */
export const sendLovableEmail = sendEmail;
