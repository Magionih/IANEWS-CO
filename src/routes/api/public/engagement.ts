import { createFileRoute } from "@tanstack/react-router";
import { createHash } from "crypto";

const isBot = (ua: string) =>
  /bot|crawler|spider|crawling|preview|lighthouse|headless|pingdom|slurp/i.test(ua);

export const Route = createFileRoute("/api/public/engagement")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        try {
          const ua = request.headers.get("user-agent") ?? "";
          if (isBot(ua)) return Response.json({ ok: true, skipped: "bot" });

          const body = (await request.json()) as Record<string, unknown>;
          const slug = String(body["slug"] ?? "").slice(0, 200);
          const sessionId = String(body["sessionId"] ?? "").slice(0, 60);
          if (!slug || !sessionId) return Response.json({ ok: false }, { status: 400 });

          const seconds = Math.max(0, Math.min(7200, Number(body["seconds"]) || 0));
          const scrollPct = Math.max(0, Math.min(100, Number(body["scrollPct"]) || 0));

          let referrerHost: string | null = null;
          if (body["referrer"]) {
            try {
              referrerHost = new URL(String(body["referrer"])).hostname;
            } catch {
              referrerHost = null;
            }
          }

          const ip =
            request.headers.get("cf-connecting-ip") ??
            request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
            "";
          const visitorHash = createHash("sha256")
            .update(`${ip}|${ua}|ianews-visits`)
            .digest("hex")
            .slice(0, 40);

          const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
          const { error } = await supabaseAdmin.from("content_engagement").upsert(
            {
              article_slug: slug,
              article_title: String(body["title"] ?? "").slice(0, 300),
              category: String(body["category"] ?? "").slice(0, 80),
              session_id: sessionId,
              visitor_hash: visitorHash,
              seconds,
              scroll_pct: scrollPct,
              completed: Boolean(body["completed"]),
              device: String(body["device"] ?? "desktop").slice(0, 20),
              referrer_host: referrerHost,
              updated_at: new Date().toISOString(),
            },
            { onConflict: "session_id,article_slug" },
          );
          if (error) console.error("[engagement] upsert", error.message);
          return Response.json({ ok: !error });
        } catch (err) {
          console.error("[engagement] failed", err instanceof Error ? err.message : String(err));
          return Response.json({ ok: false });
        }
      },
    },
  },
});
