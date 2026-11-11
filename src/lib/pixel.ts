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

export const PALCO_PIXEL = { content_name: "Palco IA News Online 16/12", content_category: "evento", currency: "BRL", value: 97 };
