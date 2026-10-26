import { createFileRoute } from "@tanstack/react-router";
import { cronUnauthorized, readJson } from "@/lib/cron-auth.server";
import type { CoverRequest } from "@/lib/covers.server";

// Guarda a capa de matérias no storage do site.
// Corpo: { items: CoverRequest[] } | CoverRequest | { rehost_all: true } (copia para o storage
// todas as capas externas atuais). Só aceita chamadas autorizadas (pg_cron / CRON_SECRET).
async function handle(request: Request) {
  const denied = await cronUnauthorized(request);
  if (denied) return denied;
  const body = await readJson<{ items: CoverRequest[]; rehost_all: boolean; fill_missing: boolean } & CoverRequest>(request);
  const { saveCover, isOwnCover } = await import("@/lib/covers.server");

  let items: CoverRequest[] = [];
  if (Array.isArray(body.items)) items = body.items;
  else if (body.slug) items = [body as CoverRequest];
  // Matérias sem capa: usa a primeira fonte que não seja Instagram (og:image), depois o Instagram.
  if (body.fill_missing === true) {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data } = await supabaseAdmin.from("articles").select("slug, sources").is("cover_image_url", null).limit(100);
    for (const r of (data ?? []) as { slug: string; sources: { url?: string; name?: string; kind?: string }[] | null }[]) {
      if (items.some((i) => i.slug === r.slug)) continue;
      const srcs = (r.sources ?? []).filter((x) => x && typeof x.url === "string" && /^https:\/\//.test(x.url) && x.kind !== "foto");
      const page = srcs.find((x) => !/instagram\.com/i.test(x.url!)) ?? srcs[0];
      if (!page?.url) continue;
      const host = new URL(page.url).host.replace(/^www\./, "");
      items.push({ slug: r.slug, page_url: page.url, credit: `Foto: Reprodução/${page.name && !/instagram/i.test(page.name) ? page.name : host}` });
    }
  }
  if (body.rehost_all === true) {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data } = await supabaseAdmin.from("articles").select("slug, cover_image_url").not("cover_image_url", "is", null).limit(500);
    for (const r of (data ?? []) as { slug: string; cover_image_url: string }[]) {
      if (!isOwnCover(r.cover_image_url) && !items.some((i) => i.slug === r.slug)) items.push({ slug: r.slug });
    }
  }
  items = items.slice(0, 80);

  const results = [];
  for (const it of items) results.push(await saveCover(it));
  return Response.json({ ok: true, done: results.filter((r) => r.ok).length, failed: results.filter((r) => !r.ok).length, results });
}

export const Route = createFileRoute("/api/public/hooks/cover")({
  server: { handlers: { POST: ({ request }) => handle(request) } },
});
