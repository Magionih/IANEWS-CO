import { createFileRoute } from "@tanstack/react-router";
import { createHash } from "crypto";

const EVENTS = new Set(["impression", "click", "convert"]);
const isBot = (ua: string) =>
  /bot|crawler|spider|crawling|preview|lighthouse|headless|pingdom|slurp/i.test(ua);

export const Route = createFileRoute("/api/public/cta")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        try {
          const ua = request.headers.get("user-agent") ?? "";
          if (isBot(ua)) return Response.json({ ok: true, skipped: "bot" });

          const body = (await request.json()) as Record<string, unknown>;
          const event = String(body["event"] ?? "");
          if (!EVENTS.has(event)) return Response.json({ ok: false }, { status: 400 });

          const path = String(body["path"] ?? "/").slice(0, 300);
          let utmSource: string | null = null;
          let utmMedium: string | null = null;
          let utmCampaign: string | null = null;
          try {
            const full = new URL(path, "https://ianews.site");
            utmSource = full.searchParams.get("utm_source");
            utmMedium = full.searchParams.get("utm_medium");
            utmCampaign = full.searchParams.get("utm_campaign");
          } catch {
            /* ignore */
          }

          let referrerHost: string | null = null;
          if (body["referrer"]) {
            try {
              referrerHost = new URL(String(body["referrer"])).hostname.slice(0, 120);
            } catch {
              referrerHost = null;
            }
          }

          const country =
            request.headers.get("cf-ipcountry") ??
            request.headers.get("x-vercel-ip-country") ??
            null;

          const ip =
            request.headers.get("cf-connecting-ip") ??
            request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
            "";
          const visitorHash = createHash("sha256")
            .update(`${ip}|${ua}|ianews-visits`)
            .digest("hex")
            .slice(0, 40);

          const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
          const { error } = await supabaseAdmin.from("cta_events").insert({
            event,
            placement: String(body["placement"] ?? "desconhecido").slice(0, 80),
            variant: String(body["variant"] ?? "default").slice(0, 60),
            path: path.split("?")[0]!.slice(0, 300),
            article_slug: body["articleSlug"] ? String(body["articleSlug"]).slice(0, 200) : null,
            session_id: String(body["sessionId"] ?? "").slice(0, 60),
            visitor_hash: visitorHash,
            utm_source: utmSource,
            utm_medium: utmMedium,
            utm_campaign: utmCampaign,
            referrer_host: referrerHost,
            country: country && country !== "XX" ? country.slice(0, 4) : null,
            device: String(body["device"] ?? "desktop").slice(0, 20),
            lead_email: body["leadEmail"] ? String(body["leadEmail"]).slice(0, 255) : null,
          });

          if (error) console.error("[cta] insert", error.message);
          return Response.json({ ok: !error });
        } catch (err) {
          console.error("[cta] failed", err instanceof Error ? err.message : String(err));
          return Response.json({ ok: false });
        }
      },
    },
  },
});
