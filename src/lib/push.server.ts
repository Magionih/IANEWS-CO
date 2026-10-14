import { ApplicationServerKeys, generatePushHTTPRequest } from "webpush-webcrypto";

const SITE_URL = "https://ianews.site";

type SubscriptionRow = {
  id: string;
  endpoint: string;
  p256dh: string;
  auth: string;
};

async function loadKeys() {
  const publicKey = process.env["VAPID_PUBLIC_KEY"];
  const privateKey = process.env["VAPID_PRIVATE_KEY"];
  if (!publicKey || !privateKey) throw new Error("Chaves VAPID não configuradas.");
  return ApplicationServerKeys.fromJSON({ publicKey, privateKey });
}

export function getPushPublicKeyServer() {
  return process.env["VAPID_PUBLIC_KEY"] ?? "";
}

/** Dispara uma notificação para todos os aparelhos ativos. */
export async function sendPushToAll(input: {
  title: string;
  body: string;
  url: string;
  articleSlug?: string | null;
  image?: string | null;
  triggeredBy?: string;
}) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const keys = await loadKeys();
  const contact = process.env["VAPID_CONTACT_EMAIL"] ?? "contato@ianews.site";

  const { data } = await supabaseAdmin
    .from("push_subscriptions")
    .select("id, endpoint, p256dh, auth")
    .eq("is_active", true)
    .limit(5000);

  const subs = (data ?? []) as SubscriptionRow[];
  const payload = JSON.stringify({
    title: input.title,
    body: input.body,
    url: input.url,
    image: input.image ?? undefined,
    tag: input.articleSlug ?? "ianews-daily",
  });

  let delivered = 0;
  let failed = 0;
  const dead: string[] = [];

  for (const sub of subs) {
    try {
      const { headers, body, endpoint } = await generatePushHTTPRequest({
        applicationServerKeys: keys,
        payload,
        target: { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
        adminContact: contact,
        ttl: 12 * 3600,
        urgency: "normal",
      });
      const res = await fetch(endpoint, { method: "POST", headers, body });
      if (res.ok) {
        delivered += 1;
      } else {
        failed += 1;
        if (res.status === 404 || res.status === 410) dead.push(sub.id);
      }
    } catch (err) {
      failed += 1;
      console.error("[push] falha no envio", err instanceof Error ? err.message : err);
    }
  }

  if (dead.length) {
    await supabaseAdmin
      .from("push_subscriptions")
      .update({ is_active: false } as never)
      .in("id", dead);
  }
  if (delivered) {
    await supabaseAdmin
      .from("push_subscriptions")
      .update({ last_sent_at: new Date().toISOString() } as never)
      .eq("is_active", true);
  }

  await supabaseAdmin.from("push_sends").insert({
    title: input.title,
    body: input.body,
    url: input.url,
    article_slug: input.articleSlug ?? null,
    recipients_count: subs.length,
    delivered_count: delivered,
    failed_count: failed,
    triggered_by: input.triggeredBy ?? "cron",
  } as never);

  return { ok: true, recipients: subs.length, delivered, failed };
}

/** Notificação diária com a matéria mais recente das últimas 24h. */
export async function runDailyPush(triggeredBy = "cron") {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data } = await supabaseAdmin
    .from("articles")
    .select("slug, title, dek, cover_image_url, published_at")
    .order("published_at", { ascending: false })
    .limit(3);

  const rows = (data ?? []) as {
    slug: string;
    title: string;
    dek: string | null;
    cover_image_url: string | null;
  }[];
  if (!rows.length) return { ok: false, error: "Sem matérias para enviar." };

  const top = rows[0]!;
  const extra = rows.length > 1 ? ` +${rows.length - 1} novas análises no IA News.` : "";

  return sendPushToAll({
    title: top.title.slice(0, 90),
    body: `${(top.dek ?? "Leia a análise completa.").slice(0, 140)}${extra}`,
    url: `${SITE_URL}/materia/${top.slug}?utm_source=push&utm_medium=notification&utm_campaign=diaria`,
    articleSlug: top.slug,
    image: top.cover_image_url,
    triggeredBy,
  });
}

/** Salva/atualiza um aparelho inscrito. */
export async function savePushSubscriptionServer(input: {
  endpoint: string;
  p256dh: string;
  auth: string;
  device?: string;
  browser?: string;
  visitorHash?: string;
  country?: string | null;
}) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { error } = await supabaseAdmin.from("push_subscriptions").upsert(
    {
      endpoint: input.endpoint,
      p256dh: input.p256dh,
      auth: input.auth,
      device: input.device ?? "desconhecido",
      browser: input.browser ?? "desconhecido",
      visitor_hash: input.visitorHash ?? "",
      country: input.country ?? null,
      is_active: true,
      failure_count: 0,
    } as never,
    { onConflict: "endpoint" },
  );
  if (error) throw new Error(error.message);
  return { ok: true };
}
