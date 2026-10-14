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

export const Route = createFileRoute("/s/$code")({
  server: {
    handlers: {
      GET: async ({ request, params }) => {
        const url = new URL(request.url);
        const code = params.code;
        const fallback = new URL("/noticias", url.origin);

        try {
          const ua = request.headers.get("user-agent") ?? "";
          const ip =
            request.headers.get("cf-connecting-ip") ??
            request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
            "";
          const country =
            request.headers.get("cf-ipcountry") ??
            request.headers.get("x-vercel-ip-country") ??
            null;
          const visitorHash = createHash("sha256")
            .update(`${ip}|${ua}|ianews-share`)
            .digest("hex")
            .slice(0, 40);
          const { device, os, browser } = parseUA(ua);

          const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
          const { data, error } = await supabaseAdmin.rpc("register_share_click", {
            _code: code,
            _visitor_hash: visitorHash,
            _referrer: request.headers.get("referer") ?? "",
            _user_agent: ua.slice(0, 500),
            _device: device,
            _os: os,
            _browser: browser,
            _country: country ?? "",
          });

          if (error) console.error("[share] rpc error", error.message);
          const slug = (data as string | null) ?? null;
          if (!slug) return Response.redirect(fallback.toString(), 302);

          const target = new URL(`/materia/${slug}`, url.origin);
          target.searchParams.set("utm_source", "instagram");
          target.searchParams.set("utm_medium", "stories");
          target.searchParams.set("utm_campaign", code);
          return Response.redirect(target.toString(), 302);
        } catch (err) {
          console.error("[share] failed", err instanceof Error ? err.message : String(err));
          return Response.redirect(fallback.toString(), 302);
        }
      },
    },
  },
});
