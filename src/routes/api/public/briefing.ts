import { createFileRoute } from "@tanstack/react-router";

/* API do briefing por link (/briefing/<token>). O token é um UUID aleatório e só existe no link
   enviado ao lead. Tudo passa por funções do banco com a chave de serviço; as fotos vão para um
   bucket privado com links de envio assinados. */

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const CAMPOS = [
  "nome",
  "cargo",
  "empresa",
  "como_aparecer",
  "trajetoria",
  "ia_entrou",
  "resultados",
  "frase",
  "instagram",
  "instagram_empresa",
  "site",
  "linkedin",
  "observacoes",
  "autorizacao",
] as const;
const MAX: Record<string, number> = {
  trajetoria: 4000,
  resultados: 3000,
  ia_entrou: 2000,
  observacoes: 2000,
};
const TIPOS = new Set(["image/jpeg", "image/png", "image/webp", "image/svg+xml"]);

function limpar(dados: unknown) {
  const d = (dados ?? {}) as Record<string, unknown>;
  const out: Record<string, string | boolean> = {};
  for (const k of CAMPOS) {
    if (k === "autorizacao") out[k] = d[k] === true;
    else if (typeof d[k] === "string") out[k] = (d[k] as string).slice(0, MAX[k] ?? 300);
  }
  return out;
}

const erro = (msg: string, status = 400) => Response.json({ ok: false, error: msg }, { status });

export const Route = createFileRoute("/api/public/briefing")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        let body: Record<string, unknown>;
        try {
          body = (await request.json()) as Record<string, unknown>;
        } catch {
          return erro("Envio inválido.");
        }
        const token = typeof body.token === "string" ? body.token : "";
        if (!UUID.test(token)) return erro("Link inválido.", 404);
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const db = supabaseAdmin as any;

        const { data: b, error: e0 } = await db.rpc("auto_briefing_get", { p_token: token });
        if (e0) return erro("Não foi possível abrir o briefing.", 500);
        if (!b) return erro("Este link não existe ou expirou.", 404);

        try {
          switch (body.acao) {
            case "ler": {
              const fotos = (b.fotos ?? []) as string[];
              let urls: { path: string; url: string }[] = [];
              if (fotos.length) {
                const { data } = await db.storage.from("briefings").createSignedUrls(fotos, 3600);
                urls = (data ?? []).map((x: { path: string; signedUrl: string }) => ({
                  path: x.path,
                  url: x.signedUrl,
                }));
              }
              return Response.json({ ok: true, briefing: { ...b, id: undefined, fotos: urls } });
            }
            case "salvar":
            case "enviar": {
              const dados = limpar(body.dados);
              if (body.acao === "enviar") {
                const faltando = ["nome", "cargo", "empresa", "trajetoria", "resultados"].filter(
                  (k) => !String(dados[k] ?? "").trim(),
                );
                if (faltando.length)
                  return erro("Preencha os campos obrigatórios antes de enviar.");
                if (!dados.autorizacao)
                  return erro("Confirme a autorização de uso das informações e imagens.");
                if ((b.fotos ?? []).length < 1) return erro("Envie pelo menos uma foto.");
              }
              const { data, error } = await db.rpc("auto_briefing_salvar", {
                p_token: token,
                p_dados: dados,
                p_enviar: body.acao === "enviar",
              });
              if (error) throw new Error(error.message);
              return Response.json(data);
            }
            case "upload": {
              const tipo = String(body.tipo ?? "");
              if (!TIPOS.has(tipo)) return erro("Envie imagens JPG, PNG, WebP ou SVG.");
              const nome = String(body.nome ?? "foto")
                .toLowerCase()
                .normalize("NFD")
                .replace(/[^a-z0-9.]+/g, "-")
                .slice(-60);
              const path = `${b.id}/${Date.now()}-${nome}`;
              const { data, error } = await db.storage
                .from("briefings")
                .createSignedUploadUrl(path);
              if (error) throw new Error(error.message);
              return Response.json({ ok: true, path, token: data.token });
            }
            case "foto":
            case "remover": {
              const path = String(body.path ?? "");
              const { error } = await db.rpc("auto_briefing_foto", {
                p_token: token,
                p_path: path,
                p_remover: body.acao === "remover",
              });
              if (error) throw new Error(error.message);
              if (body.acao === "remover") await db.storage.from("briefings").remove([path]);
              return Response.json({ ok: true });
            }
            case "previa": {
              const { data, error } = await db.rpc("auto_previa_get", { p_token: token });
              if (error) throw new Error(error.message);
              return Response.json({ ok: true, previa: data });
            }
            case "aprovar":
            case "ajuste": {
              const { data, error } = await db.rpc("auto_briefing_decidir", {
                p_token: token,
                p_aprovar: body.acao === "aprovar",
                p_ajuste: typeof body.ajuste === "string" ? body.ajuste.slice(0, 3000) : null,
              });
              if (error) throw new Error(error.message);
              return Response.json(data);
            }
            default:
              return erro("Ação inválida.");
          }
        } catch (err) {
          console.error("[briefing] falhou", err instanceof Error ? err.message : err);
          return erro(err instanceof Error ? err.message : "Não foi possível salvar.", 500);
        }
      },
    },
  },
});
