/**
 * Utilitários de proteção das ferramentas MCP: cache em memória (TTL curto)
 * e limitação de chamadas por janela deslizante.
 *
 * Observação: o estado vive na instância do worker que atende a requisição,
 * portanto os limites são por instância (defesa contra abuso simples), não
 * um rate limit distribuído.
 */

type CacheEntry = { value: unknown; expiresAt: number };

const CACHE_TTL_MS = 60_000;
const CACHE_MAX_ENTRIES = 200;
const cache = new Map<string, CacheEntry>();

export async function cached<T>(key: string, load: () => Promise<T>, ttlMs = CACHE_TTL_MS): Promise<T> {
  const now = Date.now();
  const hit = cache.get(key);
  if (hit && hit.expiresAt > now) return hit.value as T;
  const value = await load();
  if (cache.size >= CACHE_MAX_ENTRIES) {
    for (const [k, v] of cache) if (v.expiresAt <= now) cache.delete(k);
    if (cache.size >= CACHE_MAX_ENTRIES) {
      const oldest = cache.keys().next().value;
      if (oldest !== undefined) cache.delete(oldest);
    }
  }
  cache.set(key, { value, expiresAt: now + ttlMs });
  return value;
}

const WINDOW_MS = 60_000;
const MAX_CALLS_PER_WINDOW = 60;
const buckets = new Map<string, number[]>();

/** Retorna false quando o limite de chamadas por minuto foi excedido. */
export function allowCall(bucket: string, max = MAX_CALLS_PER_WINDOW): boolean {
  const now = Date.now();
  const hits = (buckets.get(bucket) ?? []).filter((t) => now - t < WINDOW_MS);
  if (hits.length >= max) {
    buckets.set(bucket, hits);
    return false;
  }
  hits.push(now);
  buckets.set(bucket, hits);
  if (buckets.size > 500) {
    for (const [k, v] of buckets) if (v.every((t) => now - t >= WINDOW_MS)) buckets.delete(k);
  }
  return true;
}

export const RATE_LIMITED = {
  content: [
    {
      type: "text" as const,
      text: "Limite de chamadas atingido (60 por minuto). Tente novamente em instantes.",
    },
  ],
  isError: true as const,
};

/** Campos essenciais e públicos de uma matéria. */
export type PublicArticle = { title: string; summary: string; url: string };

export function toPublicArticle(
  row: { slug: string; title: string; dek?: string | null },
  siteUrl: string,
): PublicArticle {
  return {
    title: row.title,
    summary: row.dek ?? "",
    url: `${siteUrl}/materia/${row.slug}`,
  };
}
