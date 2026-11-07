// Somente servidor. Integrações oficiais da Meta (WhatsApp Cloud API e Instagram Messaging).
// Nada aqui inicia conversa fria: só responde quem escreveu primeiro (janela de 24 horas)
// ou quem comentou com a palavra-chave (uma resposta privada por comentário).
import { createHmac, timingSafeEqual } from "node:crypto";

const GRAPH = `https://graph.facebook.com/${process.env.META_GRAPH_VERSION ?? "v21.0"}`;

/** Confere a assinatura X-Hub-Signature-256 com o segredo do app da Meta. */
export function assinaturaValida(
  corpo: string,
  assinatura: string | null,
  segredo?: string,
): boolean {
  if (!segredo || !assinatura?.startsWith("sha256=")) return false;
  const esperado = "sha256=" + createHmac("sha256", segredo).update(corpo).digest("hex");
  const a = Buffer.from(esperado);
  const b = Buffer.from(assinatura);
  return a.length === b.length && timingSafeEqual(a, b);
}

/** Resposta ao desafio de verificação do webhook (GET hub.challenge). */
export function verificarWebhook(request: Request, tokenEsperado?: string): Response {
  const u = new URL(request.url);
  const ok =
    !!tokenEsperado &&
    u.searchParams.get("hub.mode") === "subscribe" &&
    u.searchParams.get("hub.verify_token") === tokenEsperado;
  return ok
    ? new Response(u.searchParams.get("hub.challenge") ?? "", { status: 200 })
    : new Response("Não autorizado.", { status: 403 });
}

export function whatsappConfigurado(): boolean {
  return Boolean(process.env.WHATSAPP_TOKEN && process.env.WHATSAPP_PHONE_NUMBER_ID);
}

/** Envia texto livre pelo WhatsApp oficial (só dentro da janela de 24 horas). */
export async function enviarWhatsApp(para: string, texto: string): Promise<void> {
  const res = await fetch(`${GRAPH}/${process.env.WHATSAPP_PHONE_NUMBER_ID}/messages`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.WHATSAPP_TOKEN}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      messaging_product: "whatsapp",
      to: para.replace(/\D/g, ""),
      type: "text",
      text: { body: texto.slice(0, 4000), preview_url: true },
    }),
  });
  if (!res.ok) throw new Error(`WhatsApp ${res.status}: ${(await res.text()).slice(0, 300)}`);
}

export function instagramConfigurado(): boolean {
  return Boolean(process.env.INSTAGRAM_TOKEN && process.env.INSTAGRAM_USER_ID);
}

/** Resposta privada a um comentário (permitida uma vez por comentário, em até 7 dias). */
export async function responderComentarioNoDirect(
  comentarioId: string,
  texto: string,
): Promise<void> {
  const res = await fetch(`${GRAPH}/${process.env.INSTAGRAM_USER_ID}/messages`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.INSTAGRAM_TOKEN}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      recipient: { comment_id: comentarioId },
      message: { text: texto.slice(0, 1000) },
    }),
  });
  if (!res.ok) throw new Error(`Instagram ${res.status}: ${(await res.text()).slice(0, 300)}`);
}
