import { createHash } from "crypto";

/* API de Conversões da Meta: o servidor manda os mesmos eventos do Pixel (Lead, InitiateCheckout, Purchase)
   com o mesmo event_id, e a Meta deduplica. Serve para as conversões que o navegador perde (bloqueador de anúncio,
   aba fechada antes de o Pix compensar). Só envia para quem aceitou os cookies de medição ("Aceitar tudo").

   Variáveis na Vercel:
   - META_CAPI_TOKEN      token gerado no Gerenciador de Eventos (obrigatória; sem ela tudo vira no-op)
   - META_CAPI_TEST_CODE  opcional: código da aba "Testar eventos", para conferir sem afetar a otimização
   - META_PIXEL_ID        opcional; por padrão usa VITE_META_PIXEL_ID */

const GRAPH = "https://graph.facebook.com/v21.0";

export type MetaCtx = {
  consent?: boolean;
  fbp?: string | null;
  fbc?: string | null;
  url?: string | null;
  event_id?: string | null;
  ua?: string | null;
  ip?: string | null;
};

export type MetaUser = { email?: string | null; phone?: string | null; nome?: string | null; externalId?: string | null };

function pixelId(): string | null {
  const v = (process.env.META_PIXEL_ID || process.env.VITE_META_PIXEL_ID || import.meta.env?.VITE_META_PIXEL_ID || "").toString();
  const id = v.replace(/[^0-9]/g, "");
  return id || null;
}

function token(): string | null {
  const t = process.env.META_CAPI_TOKEN?.trim();
  return t ? t : null;
}

export function capiAtiva() {
  return !!(token() && pixelId());
}

const sha = (v: string) => createHash("sha256").update(v).digest("hex");
const limpa = (v: unknown, max = 300) => (typeof v === "string" ? v.trim().slice(0, max) : "");

/** Lê o contexto que o navegador mandou no corpo (campo "meta") e completa com IP e user agent da requisição. */
export function lerMetaCtx(raw: unknown, request?: Request | null): MetaCtx | null {
  const m = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  if (m.consent !== true) return null;
  const headers = request?.headers;
  const ip = headers?.get("x-real-ip") ?? headers?.get("x-forwarded-for")?.split(",")[0]?.trim() ?? null;
  return {
    consent: true,
    fbp: /^fb\.\d\.\d+\.\d+$/.test(limpa(m.fbp, 120)) ? limpa(m.fbp, 120) : null,
    fbc: /^fb\.\d\.\d+\./.test(limpa(m.fbc, 500)) ? limpa(m.fbc, 500) : null,
    url: /^https:\/\//.test(limpa(m.url, 500)) ? limpa(m.url, 500) : null,
    event_id: /^[\w:-]{6,80}$/.test(limpa(m.event_id, 80)) ? limpa(m.event_id, 80) : null,
    ua: headers?.get("user-agent")?.slice(0, 400) ?? null,
    ip,
  };
}

function userData(u: MetaUser, ctx: MetaCtx) {
  const d: Record<string, unknown> = { country: [sha("br")] };
  const email = limpa(u.email).toLowerCase();
  if (email.includes("@")) d.em = [sha(email)];
  let fone = limpa(u.phone, 40).replace(/\D+/g, "");
  if (fone) {
    if (fone.length <= 11) fone = `55${fone}`;
    d.ph = [sha(fone)];
  }
  const partes = limpa(u.nome, 200).toLowerCase().split(/\s+/).filter(Boolean);
  if (partes[0]) d.fn = [sha(partes[0])];
  if (partes.length > 1) d.ln = [sha(partes[partes.length - 1])];
  if (u.externalId) d.external_id = [sha(String(u.externalId))];
  if (ctx.fbp) d.fbp = ctx.fbp;
  if (ctx.fbc) d.fbc = ctx.fbc;
  if (ctx.ip) d.client_ip_address = ctx.ip;
  if (ctx.ua) d.client_user_agent = ctx.ua;
  return d;
}

/** Envia um evento. Nunca lança erro: devolve true se a Meta aceitou. */
export async function enviarCapi(
  evento: string,
  eventId: string,
  user: MetaUser,
  ctx: MetaCtx | null,
  customData?: Record<string, unknown>,
): Promise<boolean> {
  const t = token();
  const px = pixelId();
  if (!t || !px || !ctx?.consent) return false;
  const payload: Record<string, unknown> = {
    data: [
      {
        event_name: evento,
        event_time: Math.floor(Date.now() / 1000),
        event_id: eventId,
        action_source: "website",
        event_source_url: ctx.url ?? "https://ianewsbr.com/",
        user_data: userData(user, ctx),
        custom_data: customData ?? {},
      },
    ],
  };
  const teste = process.env.META_CAPI_TEST_CODE?.trim();
  if (teste) payload.test_event_code = teste;
  try {
    const res = await fetch(`${GRAPH}/${px}/events?access_token=${encodeURIComponent(t)}`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      const j = (await res.json().catch(() => ({}))) as { error?: { message?: string } };
      console.error("[capi]", evento, res.status, j.error?.message ?? "");
      return false;
    }
    return true;
  } catch (err) {
    console.error("[capi]", evento, err instanceof Error ? err.message : err);
    return false;
  }
}

export const PALCO_CAPI = { content_name: "Palco IA News Online 16/12", content_category: "evento", currency: "BRL", value: 97 };

/** Compra do Palco: manda uma vez só por inscrição (marca capi_compra_em antes de enviar). */
export async function capiCompraPalco(db: any, id: string) {
  if (!capiAtiva()) return;
  const { data } = await db
    .from("palco_inscricoes")
    .update({ capi_compra_em: new Date().toISOString() })
    .eq("id", id)
    .is("capi_compra_em", null)
    .eq("status", "pago")
    .not("meta_ctx", "is", null)
    .select("id, nome, email, whatsapp, meta_ctx, pagamento_valor")
    .maybeSingle();
  if (!data) return;
  const r = data as { id: string; nome: string; email: string; whatsapp: string; meta_ctx: MetaCtx; pagamento_valor: number | null };
  await enviarCapi(
    "Purchase",
    `purchase-${r.id}`,
    { email: r.email, phone: r.whatsapp, nome: r.nome, externalId: r.id },
    { ...r.meta_ctx, url: "https://ianewsbr.com/palco/checkout" },
    { ...PALCO_CAPI, value: Number(r.pagamento_valor) || PALCO_CAPI.value, order_id: r.id },
  );
}
