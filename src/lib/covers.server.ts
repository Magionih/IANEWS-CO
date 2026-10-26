// Capas das matérias guardadas no próprio site (Supabase Storage, bucket público "covers").
// Assim a imagem não expira (Instagram) nem quebra por bloqueio de hotlink de outros sites.
import { createHash } from "node:crypto";

import { supabaseAdmin } from "@/integrations/supabase/client.server";

const BUCKET = "covers";
const UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0 Safari/537.36";
const MAX_BYTES = 10 * 1024 * 1024;
const MIN_BYTES = 4 * 1024;

export type CoverRequest = {
  slug: string;
  /** Endereço direto da imagem. */
  image_url?: string | null;
  /** Página (matéria da fonte, post do Instagram): usa og:image / twitter:image. */
  page_url?: string | null;
  /** Crédito exibido na legenda (ex.: "Foto: Reprodução/NeoFeed"). */
  credit?: string | null;
  /** Substitui a capa mesmo se já houver uma no nosso storage. */
  force?: boolean;
};

export type CoverResult = { slug: string; ok: boolean; url?: string; error?: string; from?: string };

function isHttps(u: string | null | undefined): u is string {
  return !!u && /^https:\/\//i.test(u);
}

export function isOwnCover(url: string | null | undefined) {
  return !!url && url.includes(`/storage/v1/object/public/${BUCKET}/`);
}

function decodeEntities(s: string) {
  return s.replace(/&amp;/g, "&").replace(/&#x2F;/gi, "/").replace(/&#47;/g, "/").replace(/&quot;/g, '"');
}

/** Lê og:image / twitter:image de uma página. */
export async function findPageImage(pageUrl: string): Promise<string | null> {
  const res = await fetch(pageUrl, {
    headers: { "user-agent": UA, accept: "text/html,application/xhtml+xml", "accept-language": "pt-BR,pt;q=0.9" },
    redirect: "follow",
    signal: AbortSignal.timeout(20000),
  });
  if (!res.ok) throw new Error(`Página respondeu ${res.status}`);
  const html = (await res.text()).slice(0, 600_000);
  const patterns = [
    /<meta[^>]+property=["']og:image(?::secure_url)?["'][^>]*content=["']([^"']+)["']/i,
    /<meta[^>]+content=["']([^"']+)["'][^>]*property=["']og:image(?::secure_url)?["']/i,
    /<meta[^>]+name=["']twitter:image(?::src)?["'][^>]*content=["']([^"']+)["']/i,
    /<meta[^>]+content=["']([^"']+)["'][^>]*name=["']twitter:image(?::src)?["']/i,
  ];
  for (const re of patterns) {
    const m = html.match(re);
    if (m?.[1]) {
      const abs = new URL(decodeEntities(m[1].trim()), res.url || pageUrl).toString();
      if (/^https?:\/\//i.test(abs)) return abs.replace(/^http:/i, "https:");
    }
  }
  return null;
}

async function download(imageUrl: string, referer?: string) {
  const res = await fetch(imageUrl, {
    headers: { "user-agent": UA, accept: "image/avif,image/webp,image/*,*/*;q=0.8", ...(referer ? { referer } : {}) },
    redirect: "follow",
    signal: AbortSignal.timeout(25000),
  });
  if (!res.ok) throw new Error(`Imagem respondeu ${res.status}`);
  const type = (res.headers.get("content-type") ?? "").split(";")[0]!.trim().toLowerCase();
  if (!type.startsWith("image/") || type === "image/svg+xml") throw new Error(`Não é imagem (${type || "sem tipo"})`);
  const buf = Buffer.from(await res.arrayBuffer());
  if (buf.length > MAX_BYTES) throw new Error("Imagem acima de 10 MB");
  if (buf.length < MIN_BYTES) throw new Error("Imagem pequena demais (provável ícone)");
  return { buf, type };
}

const EXT: Record<string, string> = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp", "image/gif": "gif", "image/avif": "avif" };

/** Baixa a imagem, guarda no storage do site e grava como capa da matéria. */
export async function saveCover(req: CoverRequest): Promise<CoverResult> {
  const slug = String(req.slug ?? "").trim();
  if (!/^[a-z0-9-]{3,200}$/.test(slug)) return { slug, ok: false, error: "slug inválido" };

  const { data: art } = await supabaseAdmin
    .from("articles")
    .select("id, cover_image_url, sources")
    .eq("slug", slug)
    .maybeSingle();
  if (!art) return { slug, ok: false, error: "matéria não encontrada" };
  const row = art as { id: string; cover_image_url: string | null; sources: unknown };
  if (isOwnCover(row.cover_image_url) && !req.force) return { slug, ok: true, url: row.cover_image_url!, from: "já estava no storage" };

  // Ordem: imagem informada → og:image da página → capa externa atual (rehospedar).
  const candidates: { url: string; referer?: string; from: string }[] = [];
  if (isHttps(req.image_url)) candidates.push({ url: req.image_url, from: "image_url" });
  if (isHttps(req.page_url)) {
    try {
      const og = await findPageImage(req.page_url);
      if (og) candidates.push({ url: og, referer: req.page_url, from: "og:image" });
    } catch (err) {
      candidates.push({ url: "", from: `página: ${err instanceof Error ? err.message : String(err)}` });
    }
  }
  if (isHttps(row.cover_image_url) && !isOwnCover(row.cover_image_url)) candidates.push({ url: row.cover_image_url, from: "capa atual" });

  const errors: string[] = [];
  for (const c of candidates) {
    if (!c.url) {
      errors.push(c.from);
      continue;
    }
    try {
      const { buf, type } = await download(c.url, c.referer);
      const hash = createHash("sha1").update(buf).digest("hex").slice(0, 12);
      const path = `${slug}/${hash}.${EXT[type] ?? "jpg"}`;
      const up = await supabaseAdmin.storage.from(BUCKET).upload(path, buf, { contentType: type, upsert: true, cacheControl: "31536000" });
      if (up.error) throw new Error(`storage: ${up.error.message}`);
      const publicUrl = supabaseAdmin.storage.from(BUCKET).getPublicUrl(path).data.publicUrl;

      const patch: Record<string, unknown> = { cover_image_url: publicUrl };
      if (req.credit) {
        const sources = Array.isArray(row.sources) ? (row.sources as Record<string, unknown>[]) : [];
        const others = sources.filter((s) => s?.kind !== "foto");
        patch.sources = [...others, { name: req.credit.slice(0, 200), url: req.page_url ?? c.url, kind: "foto" }];
      }
      const { error } = await supabaseAdmin.from("articles").update(patch as never).eq("id", row.id);
      if (error) throw new Error(`banco: ${error.message}`);
      return { slug, ok: true, url: publicUrl, from: c.from };
    } catch (err) {
      errors.push(`${c.from}: ${err instanceof Error ? err.message : String(err)}`);
    }
  }
  return { slug, ok: false, error: errors.join(" | ") || "nenhuma imagem informada" };
}
