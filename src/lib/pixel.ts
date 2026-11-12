/* Eventos do Pixel da Meta (o script é carregado em __root.tsx quando VITE_META_PIXEL_ID existe).
   Seguro no servidor e sem Pixel: vira um no-op. O eventID permite deduplicar com a API de Conversões depois. */

type Fbq = (cmd: "track" | "trackCustom", event: string, params?: Record<string, unknown>, opts?: { eventID?: string }) => void;

export function pixel(event: string, params?: Record<string, unknown>, eventID?: string) {
  if (typeof window === "undefined") return;
  const fbq = (window as unknown as { fbq?: Fbq }).fbq;
  if (typeof fbq !== "function") return;
  try {
    fbq("track", event, params, eventID ? { eventID } : undefined);
  } catch {
    /* nunca quebra a página por causa do Pixel */
  }
}

/* Dispara uma vez por navegador (ex.: Purchase de um pedido), mesmo se a página recarregar. */
export function pixelOnce(key: string, event: string, params?: Record<string, unknown>, eventID?: string) {
  if (typeof window === "undefined") return;
  try {
    const k = `px:${key}`;
    if (window.localStorage.getItem(k)) return;
    window.localStorage.setItem(k, "1");
  } catch {
    /* sem localStorage: dispara mesmo assim */
  }
  pixel(event, params, eventID);
}

/* Contexto para a API de Conversões (vai no corpo dos formulários, campo "meta"). Só leva os cookies da Meta
   de quem aceitou a medição; sem consentimento, o servidor não envia nada à Meta. */
export function metaCtx(eventId?: string) {
  if (typeof window === "undefined") return { consent: false };
  let consent = false;
  try {
    consent = window.localStorage.getItem("ianews-consent-v1") === "all";
  } catch {
    consent = false;
  }
  if (!consent) return { consent: false };
  const cookie = (n: string) => document.cookie.match(new RegExp(`(?:^|; )${n}=([^;]*)`))?.[1] ?? null;
  let fbc = cookie("_fbc");
  if (!fbc) {
    const clid = new URLSearchParams(window.location.search).get("fbclid");
    if (clid) fbc = `fb.1.${Date.now()}.${clid}`;
  }
  return { consent: true, fbp: cookie("_fbp"), fbc, url: window.location.href.split("#")[0], event_id: eventId ?? null };
}

export function novoEventId(prefixo: string) {
  const r = typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : `${Date.now()}${Math.random().toString(16).slice(2)}`;
  return `${prefixo}-${r}`;
}

export const PALCO_PIXEL = { content_name: "Palco IA News Online 16/12", content_category: "evento", currency: "BRL", value: 97 };
