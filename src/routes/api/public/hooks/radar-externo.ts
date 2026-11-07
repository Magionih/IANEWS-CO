import { createFileRoute } from "@tanstack/react-router";

import { cronUnauthorized } from "@/lib/cron-auth.server";

/* Motor de leads, fonte 3: radar externo. A cada rodada, o Claude pesquisa na web um segmento
   (em rodízio) e traz empresas brasileiras de IA com fundador e canais oficiais. Elas entram no
   CRM como empresa + pessoa + negócio no funil de matéria (perfil A), prontas para a lista do dia. */

const SITE = process.env.NEWSLETTER_SITE_URL?.trim() || "https://ianewsbr.com";

type EmpresaRadar = {
  nome: string;
  site: string | null;
  instagram: string | null;
  linkedin: string | null;
  cidade: string | null;
  setor: string | null;
  descricao: string | null;
  brasileira: boolean;
  fundador: string | null;
  fundador_cargo: string | null;
  fundador_instagram: string | null;
  fundador_linkedin: string | null;
  seguidores_instagram: number | null;
  fontes: string;
};

function extrairJson(texto: string): { empresas?: unknown[] } | null {
  const m = texto.match(/\{[\s\S]*\}/);
  if (!m) return null;
  try {
    return JSON.parse(m[0]) as { empresas?: unknown[] };
  } catch {
    return null;
  }
}

async function pesquisar(
  segmento: string,
  cidade: string,
  quantas: number,
  jaTemos: string[],
): Promise<EmpresaRadar[]> {
  const { chaveAnthropic } = await import("@/lib/automacao/ia.server");
  const apiKey = chaveAnthropic();
  if (!apiKey) throw new Error("ANTHROPIC_API_KEY ausente.");
  const prompt = [
    "Você é pesquisador comercial da IA News (mídia brasileira sobre IA e negócios). Use a busca na web para listar empresas REAIS e ATIVAS.",
    `Segmento: ${segmento}. Região: ${cidade}.`,
    `Quero ${quantas} empresas brasileiras (sede no Brasil) desse segmento que tenham fundador(a) identificável e presença no Instagram ou LinkedIn. Priorize empresas pequenas e médias com fundador ativo nas redes (perfil de quem aceitaria ser destaque numa matéria). Evite big techs, multinacionais, veículos de imprensa e empresas que já estão nesta lista: ${jaTemos.slice(0, 80).join("; ") || "(nenhuma)"}.`,
    "Só informe um dado se encontrou na busca (site oficial, perfil no Instagram/LinkedIn, imprensa). Se não achar o @ exato, deixe null; nunca invente.",
    "Responda SOMENTE com JSON neste formato:",
    JSON.stringify({
      empresas: [
        {
          nome: "",
          site: "url ou null",
          instagram: "handle sem @ ou null",
          linkedin: "url linkedin.com/company/... ou null",
          cidade: "cidade/UF ou null",
          setor: "2 a 4 palavras",
          descricao: "1 frase",
          brasileira: true,
          fundador: "nome ou null",
          fundador_cargo: "cargo ou null",
          fundador_instagram: "handle ou null",
          fundador_linkedin: "url ou null",
          seguidores_instagram: "número aproximado ou null",
          fontes: "urls separadas por espaço",
        },
      ],
    }),
  ].join("\n");
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 150_000);
  try {
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      signal: controller.signal,
      headers: {
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: process.env.ANTHROPIC_MODEL ?? "claude-sonnet-5-5",
        max_tokens: 6000,
        messages: [{ role: "user", content: prompt }],
        tools: [{ type: "web_search_20250305", name: "web_search", max_uses: 8 }],
      }),
    });
    if (!res.ok) throw new Error(`Claude ${res.status}: ${(await res.text()).slice(0, 200)}`);
    const json = (await res.json()) as { content?: { type: string; text?: string }[] };
    const texto = (json.content ?? [])
      .filter((c) => c.type === "text")
      .map((c) => c.text ?? "")
      .join("\n");
    const obj = extrairJson(texto);
    if (!obj?.empresas) throw new Error("Claude não devolveu a lista.");
    const s = (v: unknown, n = 200) =>
      typeof v === "string" && v.trim() ? v.trim().slice(0, n) : null;
    return (obj.empresas as Record<string, unknown>[])
      .slice(0, quantas + 4)
      .map((e) => {
        const seg = Number(e.seguidores_instagram);
        return {
          nome: s(e.nome, 120) ?? "",
          site: s(e.site, 300),
          instagram: s(e.instagram, 60),
          linkedin: s(e.linkedin, 300),
          cidade: s(e.cidade, 80),
          setor: s(e.setor, 60),
          descricao: s(e.descricao, 300),
          brasileira: e.brasileira !== false && e.brasileira !== "false",
          fundador: s(e.fundador, 120),
          fundador_cargo: s(e.fundador_cargo, 80),
          fundador_instagram: s(e.fundador_instagram, 60),
          fundador_linkedin: s(e.fundador_linkedin, 300),
          seguidores_instagram: Number.isFinite(seg) && seg > 0 ? Math.round(seg) : null,
          fontes: s(e.fontes, 600) ?? "",
        };
      })
      .filter((e) => e.nome);
  } finally {
    clearTimeout(timer);
  }
}

async function handle(request: Request) {
  const denied = await cronUnauthorized(request);
  if (denied) return denied;
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const db = supabaseAdmin as any;
  let segmento = "",
    cidade = "";
  try {
    const { data: prox, error } = await db.rpc("auto_radar_proximo");
    if (error) throw new Error(error.message);
    const p = (prox ?? [])[0] as { segmento: string; cidade: string } | undefined;
    if (!p)
      return Response.json(
        { ok: false, error: "Sem segmentos configurados (auto_config.radar_segmentos)." },
        { status: 500 },
      );
    segmento = p.segmento;
    cidade = p.cidade;
    const { data: cfg } = await db
      .from("auto_config")
      .select("valor")
      .eq("chave", "radar_por_rodada")
      .maybeSingle();
    const quantas = Math.min(Math.max(Number(cfg?.valor ?? 8) || 8, 3), 15);
    const { data: existentes } = await db
      .from("crm_empresas")
      .select("nome")
      .eq("ativo", true)
      .ilike("setor", `%${(segmento.split(" ")[0] ?? "").slice(0, 12)}%`)
      .limit(80);
    const jaTemos = ((existentes ?? []) as { nome: string }[]).map((x) => x.nome);
    const empresas = await pesquisar(segmento, cidade, quantas, jaTemos);
    const { data, error: e2 } = await db.rpc("auto_radar_registrar", {
      p_segmento: segmento,
      p_cidade: cidade,
      p_empresas: empresas,
      p_erro: null,
    });
    if (e2) throw new Error(e2.message);
    return Response.json({ ok: true, ...data, site: SITE });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[radar-externo] falhou", message);
    if (segmento) {
      try {
        await db.rpc("auto_radar_registrar", {
          p_segmento: segmento,
          p_cidade: cidade,
          p_empresas: [],
          p_erro: message.slice(0, 300),
        });
      } catch {
        /* registro da falha é opcional */
      }
    }
    return Response.json({ ok: false, error: message }, { status: 500 });
  }
}

export const Route = createFileRoute("/api/public/hooks/radar-externo")({
  server: {
    handlers: { GET: ({ request }) => handle(request), POST: ({ request }) => handle(request) },
  },
});
