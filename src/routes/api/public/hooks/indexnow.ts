import { createFileRoute } from "@tanstack/react-router";
import { cronUnauthorized, readJson } from "@/lib/cron-auth.server";

/* IndexNow: avisa Bing (que alimenta a busca do ChatGPT e o Copilot), Yandex e outros buscadores
   sempre que matérias são publicadas ou atualizadas. O pg_cron chama de hora em hora.
   Corpo opcional: { hours?: number; urls?: string[]; all_pages?: boolean }.
   A chave é pública por definição do protocolo: fica em /<chave>.txt na raiz do site. */

const HOST = "ianewsbr.com";
const BASE = `https://${HOST}`;
const KEY = "24ff951fb230a4164192310135b7a00c";

const PAGES = [
  "/",
  "/noticias",
  "/ranking",
  "/gente",
  "/eventos",
  "/palco",
  "/aula",
  "/pauta",
  "/lista100",
  "/newsletter",
  "/guias/agentes-de-ia",
  "/guias/ferramentas-de-ia",
  "/guias/lideres-de-ia-no-brasil",
  "/guias/regulamentacao-da-ia-no-brasil",
  "/guias/ia-para-pequenas-empresas",
  "/guias/ia-no-atendimento-ao-cliente",
  "/artigos/inteligencia-artificial-nas-empresas",
];

async function handle(request: Request) {
  const denied = await cronUnauthorized(request);
  if (denied) return denied;
  const body = await readJson<{ hours: number; urls: string[]; all_pages: boolean }>(request);
  const hours = Math.min(Math.max(Number(body.hours) || 2, 1), 24 * 30);

  const urls = new Set<string>();
  for (const u of Array.isArray(body.urls) ? body.urls : []) {
    if (typeof u === "string" && u.startsWith(BASE)) urls.add(u);
  }
  if (body.all_pages === true) for (const p of PAGES) urls.add(BASE + p);

  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const now = new Date();
  const since = new Date(now.getTime() - hours * 3600 * 1000).toISOString();
  const { data, error } = await (supabaseAdmin as any)
    .from("articles")
    .select("slug")
    .eq("status", "published")
    .lte("published_at", now.toISOString())
    .or(`published_at.gte.${since},updated_at.gte.${since}`)
    .limit(5000);
  if (error) return Response.json({ ok: false, error: error.message }, { status: 500 });
  for (const r of (data ?? []) as { slug: string }[]) urls.add(`${BASE}/materia/${encodeURIComponent(r.slug)}`);

  // Matéria nova muda a home e as listas: avisa junto.
  if ((data ?? []).length > 0) for (const p of ["/", "/noticias"]) urls.add(BASE + p);

  const list = [...urls].slice(0, 10000);
  if (!list.length) return Response.json({ ok: true, sent: 0 });

  const res = await fetch("https://api.indexnow.org/indexnow", {
    method: "POST",
    headers: { "Content-Type": "application/json; charset=utf-8" },
    body: JSON.stringify({ host: HOST, key: KEY, keyLocation: `${BASE}/${KEY}.txt`, urlList: list }),
  });
  return Response.json({ ok: res.ok || res.status === 202, status: res.status, sent: list.length });
}

export const Route = createFileRoute("/api/public/hooks/indexnow")({
  server: { handlers: { POST: ({ request }) => handle(request) } },
});
