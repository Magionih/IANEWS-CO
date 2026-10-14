import { createFileRoute } from "@tanstack/react-router";
import { createHash } from "crypto";

function parseUA(ua: string) {
  const u = ua.toLowerCase();
  const device = /ipad|tablet/.test(u)
    ? "tablet"
    : /mobi|iphone|android/.test(u)
      ? "mobile"
      : "desktop";
  const os = /iphone|ipad|ios/.test(u)
    ? "iOS"
    : /android/.test(u)
      ? "Android"
      : /windows/.test(u)
        ? "Windows"
        : /mac os/.test(u)
          ? "macOS"
          : /linux/.test(u)
            ? "Linux"
            : "desconhecido";
  const browser = /instagram/.test(u)
    ? "Instagram"
    : /fban|fbav/.test(u)
      ? "Facebook"
      : /edg\//.test(u)
        ? "Edge"
        : /chrome|crios/.test(u)
          ? "Chrome"
          : /firefox|fxios/.test(u)
            ? "Firefox"
            : /safari/.test(u)
              ? "Safari"
              : "desconhecido";
  return { device, os, browser };
}

const isBot = (ua: string) =>
  /bot|crawler|spider|crawling|preview|lighthouse|headless|pingdom|slurp/i.test(ua);

export const Route = createFileRoute("/api/public/track")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        try {
          const ua = request.headers.get("user-agent") ?? "";
          if (isBot(ua)) return Response.json({ ok: true, skipped: "bot" });

          const body = (await request.json()) as {
            path?: string;
            title?: string;
            referrer?: string;
            sessionId?: string;
            userId?: string | null;
          };
          const path = (body.path ?? "/").slice(0, 300);
          if (!path.startsWith("/") || path.startsWith("/api")) {
            return Response.json({ ok: true, skipped: "path" });
          }

          const ip =
            request.headers.get("cf-connecting-ip") ??
            request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
            "";
          const country =
            request.headers.get("cf-ipcountry") ??
            request.headers.get("x-vercel-ip-country") ??
            null;
          const visitorHash = createHash("sha256")
            .update(`${ip}|${ua}|ianews-visits`)
            .digest("hex")
            .slice(0, 40);
          const { device, os, browser } = parseUA(ua);

          let referrerHost: string | null = null;
          let utm: Record<string, string | null> = {
            utm_source: null,
            utm_medium: null,
            utm_campaign: null,
          };
          if (body.referrer) {
            try {
              referrerHost = new URL(body.referrer).hostname;
            } catch {
              referrerHost = null;
            }
          }
          try {
            const full = new URL(path, "https://ianewsbr.com");
            utm = {
              utm_source: full.searchParams.get("utm_source"),
              utm_medium: full.searchParams.get("utm_medium"),
              utm_campaign: full.searchParams.get("utm_campaign"),
            };
          } catch {
            /* ignore */
          }

          const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

          const { count } = await supabaseAdmin
            .from("site_visits")
            .select("id", { count: "exact", head: true })
            .eq("visitor_hash", visitorHash);

          const { error } = await supabaseAdmin.from("site_visits").insert({
            path: path.split("?")[0]!.slice(0, 300),
            title: (body.title ?? "").slice(0, 300) || null,
            referrer: (body.referrer ?? "").slice(0, 500) || null,
            referrer_host: referrerHost,
            utm_source: utm['utm_source'],
            utm_medium: utm['utm_medium'],
            utm_campaign: utm['utm_campaign'],
            visitor_hash: visitorHash,
            session_id: (body.sessionId ?? "").slice(0, 60),
            user_id: body.userId ?? null,
            device,
            os,
            browser,
            country,
            is_new_visitor: (count ?? 0) === 0,
          });
          if (error) console.error("[track] insert", error.message);
          return Response.json({ ok: !error });
        } catch (err) {
          console.error("[track] failed", err instanceof Error ? err.message : String(err));
          return Response.json({ ok: false });
        }
      },
    },
  },
});
