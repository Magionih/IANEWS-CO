import { createFileRoute } from "@tanstack/react-router";
import { createHash } from "crypto";

const EVENTS = new Set(["request", "impression", "viewable", "unfilled", "click", "blocked"]);
const isBot = (ua: string) =>
  /bot|crawler|spider|crawling|preview|lighthouse|headless|pingdom|slurp/i.test(ua);

const str = (v: unknown, max: number, fallback = "") =>
  v === undefined || v === null ? fallback : String(v).slice(0, max);

export const Route = createFileRoute("/api/public/ad-metrics")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        try {
          const ua = request.headers.get("user-agent") ?? "";
          if (isBot(ua)) return Response.json({ ok: true, skipped: "bot" });

          const body = (await request.json()) as Record<string, unknown>;
          const events = Array.isArray(body["events"]) ? body["events"] : [body];

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

          const rows = (events as Record<string, unknown>[])
            .filter((e) => EVENTS.has(String(e["event"] ?? "")))
            .slice(0, 40)
            .map((e) => {
              const rawPath = str(e["path"], 300, "/");
              let utmSource: string | null = null;
              let utmMedium: string | null = null;
              let utmCampaign: string | null = null;
              try {
                const full = new URL(rawPath, "https://ianewsbr.com");
                utmSource = full.searchParams.get("utm_source");
                utmMedium = full.searchParams.get("utm_medium");
                utmCampaign = full.searchParams.get("utm_campaign");
              } catch {
                /* ignore */
              }
              let referrerHost: string | null = null;
              if (e["referrer"]) {
                try {
                  referrerHost = new URL(String(e["referrer"])).hostname.slice(0, 120);
                } catch {
                  referrerHost = null;
                }
              }
              return {
                event: String(e["event"]),
                ad_name: str(e["name"], 80, "desconhecido"),
                page: str(e["page"], 60, "desconhecida"),
                slot_id: str(e["slotId"], 40),
                path: rawPath.split("?")[0]!.slice(0, 300),
                article_slug: e["articleSlug"] ? str(e["articleSlug"], 200) : null,
                category: e["category"] ? str(e["category"], 80) : null,
                session_id: str(e["sessionId"], 60),
                visitor_hash: visitorHash,
                device: str(e["device"], 20, "desktop"),
                country: country && country !== "XX" ? country.slice(0, 4) : null,
                referrer_host: referrerHost,
                utm_source: utmSource,
                utm_medium: utmMedium,
                utm_campaign: utmCampaign,
                visible_ms: Math.max(0, Math.min(3_600_000, Number(e["visibleMs"] ?? 0) || 0)),
                visible_pct: Math.max(0, Math.min(100, Number(e["visiblePct"] ?? 0) || 0)),
              };
            });

          if (!rows.length) return Response.json({ ok: true, skipped: "empty" });

          const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
          const { error } = await supabaseAdmin.from("ad_events").insert(rows as never);
          if (error) console.error("[ad-metrics] insert", error.message);
          return Response.json({ ok: !error });
        } catch (err) {
          console.error("[ad-metrics] failed", err instanceof Error ? err.message : String(err));
          return Response.json({ ok: false });
        }
      },
    },
  },
});
