import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const getPushPublicKey = createServerFn({ method: "GET" }).handler(async () => {
  const { getPushPublicKeyServer } = await import("@/lib/push.server");
  return { key: getPushPublicKeyServer() };
});

export const savePushSubscription = createServerFn({ method: "POST" })
  .inputValidator(
    (input: {
      endpoint: string;
      p256dh: string;
      auth: string;
      device?: string;
      browser?: string;
      visitorHash?: string;
    }) => {
      if (!input?.endpoint || !input.p256dh || !input.auth) throw new Error("Inscrição inválida.");
      return input;
    },
  )
  .handler(async ({ data }) => {
    const { savePushSubscriptionServer } = await import("@/lib/push.server");
    return savePushSubscriptionServer(data);
  });

async function assertAdmin(supabase: any, userId: string) {
  const { data, error } = await supabase.from("user_roles").select("role").eq("user_id", userId);
  if (error) throw new Error(error.message);
  if (!(data ?? []).some((r: { role: string }) => r.role === "admin")) {
    throw new Error("Acesso restrito a administradores.");
  }
}

export const sendDailyPushNow = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context.supabase, context.userId);
    const { runDailyPush } = await import("@/lib/push.server");
    return runDailyPush("admin");
  });

export type PushStats = {
  activeDevices: number;
  totalDevices: number;
  lastSends: {
    id: string;
    title: string;
    delivered: number;
    failed: number;
    createdAt: string;
    triggeredBy: string;
  }[];
};

export const getPushStats = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<PushStats> => {
    const { supabase, userId } = context;
    await assertAdmin(supabase, userId);
    const [subs, sends] = await Promise.all([
      supabase.from("push_subscriptions").select("is_active").limit(10000),
      supabase
        .from("push_sends")
        .select("id, title, delivered_count, failed_count, created_at, triggered_by")
        .order("created_at", { ascending: false })
        .limit(10),
    ]);
    const rows = (subs.data ?? []) as { is_active: boolean }[];
    return {
      activeDevices: rows.filter((r) => r.is_active).length,
      totalDevices: rows.length,
      lastSends: ((sends.data ?? []) as any[]).map((s) => ({
        id: s.id,
        title: s.title,
        delivered: s.delivered_count,
        failed: s.failed_count,
        createdAt: s.created_at,
        triggeredBy: s.triggered_by,
      })),
    };
  });
