import { createHmac } from "crypto";

/* Cliente mínimo da API do Asaas (cobranças do Palco IA News Online).
   A chave fica em ASAAS_API_KEY na Vercel; chave de produção começa com "$aact_prod_", a de testes com "$aact_hmlg_".
   Sem chave, o checkout cai no link de pagamento fixo (PALCO_PAGAMENTO_URL). */

export function asaasKey(): string | null {
  const k = process.env.ASAAS_API_KEY?.trim();
  return k ? k : null;
}

function asaasBase(key: string) {
  return key.includes("_hmlg_") ? "https://api-sandbox.asaas.com/v3" : "https://api.asaas.com/v3";
}

export async function asaas<T = Record<string, any>>(path: string, init: { method?: string; body?: unknown } = {}): Promise<T> {
  const key = asaasKey();
  if (!key) throw new Error("ASAAS_API_KEY ausente.");
  const res = await fetch(`${asaasBase(key)}${path}`, {
    method: init.method ?? "GET",
    headers: { access_token: key, "content-type": "application/json", "user-agent": "IANews-Palco" },
    body: init.body ? JSON.stringify(init.body) : undefined,
  });
  const json = (await res.json().catch(() => ({}))) as Record<string, any>;
  if (!res.ok) {
    const msg = Array.isArray(json.errors) ? json.errors.map((e: any) => e.description).join(" ") : `HTTP ${res.status}`;
    throw new Error(msg || `Asaas respondeu ${res.status}`);
  }
  return json as T;
}

/* Token que o Asaas manda no cabeçalho "asaas-access-token" do webhook, sem exigir mais uma variável na Vercel;
   a rota /api/public/hooks/asaas-setup registra o webhook com ele. */
export function asaasWebhookToken(): string | null {
  const proprio = process.env.ASAAS_WEBHOOK_TOKEN?.trim();
  if (proprio) return proprio;
  // Derivado da própria chave do Asaas (ou do CRON_SECRET, se a chave faltar). Se a chave mudar, rode /api/public/hooks/asaas-setup de novo.
  const s = asaasKey() || process.env.CRON_SECRET;
  return s ? createHmac("sha256", s).update("ianews-asaas-webhook").digest("hex") : null;
}

export const PAGO = new Set(["RECEIVED", "CONFIRMED", "RECEIVED_IN_CASH"]);

export function soDigitos(v: string) {
  return v.replace(/\D+/g, "");
}

export function cpfValido(v: string) {
  const c = soDigitos(v);
  if (c.length !== 11 || /^(\d)\1{10}$/.test(c)) return false;
  const dv = (n: number) => {
    let s = 0;
    for (let i = 0; i < n; i++) s += Number(c[i]) * (n + 1 - i);
    const r = (s * 10) % 11;
    return r === 10 ? 0 : r;
  };
  return dv(9) === Number(c[9]) && dv(10) === Number(c[10]);
}

export function cnpjValido(v: string) {
  const c = soDigitos(v);
  if (c.length !== 14 || /^(\d)\1{13}$/.test(c)) return false;
  const calc = (len: number) => {
    const pesos = len === 12 ? [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2] : [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
    const s = pesos.reduce((acc, p, i) => acc + Number(c[i]) * p, 0);
    const r = s % 11;
    return r < 2 ? 0 : 11 - r;
  };
  return calc(12) === Number(c[12]) && calc(13) === Number(c[13]);
}
