// Somente servidor. Integrações oficiais da Meta (WhatsApp Cloud API e Instagram Messaging).
// Nada aqui inicia conversa fria: só responde quem escreveu primeiro (janela de 24 horas)
// ou quem comentou com a palavra-chave (uma resposta privada por comentário).
import { createHmac, timingSafeEqual } from "node:crypto";

const GRAPH = `https://graph.facebook.com/${process.env.META_GRAPH_VERSION ?? "v21.0"}`;

/** Endereço da API do Instagram. Token do "Login do Instagram" (começa com IG) só funciona em
    graph.instagram.com; token de página do Facebook, em graph.facebook.com. META_GRAPH_HOST força um deles. */
export function graphInstagram(): string {
  const host =
    process.env.META_GRAPH_HOST ??
    (process.env.INSTAGRAM_TOKEN?.trim().startsWith("IG") ? "graph.instagram.com" : "graph.facebook.com");
  return `https://${host}/${process.env.META_GRAPH_VERSION ?? "v21.0"}`;
}

/** Assinatura do webhook: vale o segredo do app do Facebook ou o do Instagram (Login do Instagram). */
export function assinaturaMetaValida(corpo: string, assinatura: string | null): boolean {
  return [process.env.META_APP_SECRET, process.env.INSTAGRAM_APP_SECRET].some(
    (seg) => !!seg && assinaturaValida(corpo, assinatura, seg),
  );
}

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
  const res = await fetch(`${graphInstagram()}/${process.env.INSTAGRAM_USER_ID}/messages`, {
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

/** Publica um carrossel no Instagram pela API oficial (até 3 collabs). Devolve o id da mídia e o link. */
export async function publicarCarrosselInstagram(
  imagens: string[],
  legenda: string,
  collabs: string[],
): Promise<{ mediaId: string; url: string | null }> {
  const token = process.env.INSTAGRAM_TOKEN;
  const userId = process.env.INSTAGRAM_USER_ID;
  if (!token || !userId) throw new Error("INSTAGRAM_TOKEN ou INSTAGRAM_USER_ID ausente.");
  const auth = { Authorization: `Bearer ${token}`, "Content-Type": "application/json" };
  const post = async (path: string, body: Record<string, unknown>) => {
    const res = await fetch(`${graphInstagram()}/${path}`, {
      method: "POST",
      headers: auth,
      body: JSON.stringify(body),
    });
    const json = (await res.json().catch(() => ({}))) as Record<string, unknown> & {
      error?: { message?: string };
    };
    if (!res.ok)
      throw new Error(
        `Instagram ${res.status}: ${json.error?.message ?? JSON.stringify(json).slice(0, 200)}`,
      );
    return json;
  };
  // 1. Um contêiner por imagem
  const filhos: string[] = [];
  for (const url of imagens.slice(0, 10)) {
    const r = await post(`${userId}/media`, { image_url: url, is_carousel_item: true });
    filhos.push(String(r.id));
  }
  // 2. Contêiner do carrossel (com legenda e colaboradores)
  const carrossel = await post(`${userId}/media`, {
    media_type: "CAROUSEL",
    children: filhos,
    caption: legenda.slice(0, 2200),
    ...(collabs.length ? { collaborators: collabs.slice(0, 3) } : {}),
  });
  // 3. Espera o processamento e publica
  for (let i = 0; i < 10; i++) {
    const st = await fetch(`${graphInstagram()}/${carrossel.id}?fields=status_code`, { headers: auth });
    const sj = (await st.json().catch(() => ({}))) as { status_code?: string };
    if (sj.status_code === "FINISHED") break;
    if (sj.status_code === "ERROR") throw new Error("Instagram: contêiner com erro.");
    await new Promise((r) => setTimeout(r, 3000));
  }
  const pub = await post(`${userId}/media_publish`, { creation_id: carrossel.id });
  const mediaId = String(pub.id);
  const info = await fetch(`${graphInstagram()}/${mediaId}?fields=permalink`, { headers: auth });
  const ij = (await info.json().catch(() => ({}))) as { permalink?: string };
  return { mediaId, url: ij.permalink ?? null };
}
