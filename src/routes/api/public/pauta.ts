import { createFileRoute } from "@tanstack/react-router";
import { createHash } from "crypto";

import { validatePauta, type PautaInput } from "@/lib/pauta-validate";

/* Recebe o formulário da página /pauta. Revalida tudo, descarta robôs (campo isca),
   limita 3 envios por hora por IP ou e-mail, grava em pauta_leads e avisa o comercial. */

const NOTIFY_TO = ["comercial@ianews.site", "magionih@gmail.com"];
const LIMIT_PER_HOUR = 3;

const str = (v: unknown, max = 1000) => (typeof v === "string" ? v.slice(0, max) : "");
const optional = (v: unknown, max = 300) => {
  const t = str(v, max).trim();
  return t ? t : null;
};

export const Route = createFileRoute("/api/public/pauta")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        let body: Record<string, unknown>;
        try {
          body = (await request.json()) as Record<string, unknown>;
        } catch {
          return Response.json({ ok: false, error: "Envio inválido." }, { status: 400 });
        }

        // Campo isca: robô preenche, pessoa não vê. Responde sucesso e não grava.
        if (str(body["empresa_site"]).trim()) return Response.json({ ok: true });

        const input: PautaInput = {
          nome: str(body["nome"], 200),
          cargo: str(body["cargo"], 200),
          empresa: str(body["empresa"], 200),
          site: str(body["site"], 300),
          instagram: str(body["instagram"], 300),
          linkedin: str(body["linkedin"], 300),
          whatsapp: str(body["whatsapp"], 40),
          email: str(body["email"], 300),
          descricao: str(body["descricao"], 2000),
          link_noticia: str(body["link_noticia"], 300),
          consentimento: body["consentimento"] === true,
        };
        const { errors, clean } = validatePauta(input);
        if (Object.keys(errors).length) {
          return Response.json({ ok: false, errors }, { status: 422 });
        }

        const ua = request.headers.get("user-agent") ?? "";
        const ip =
          request.headers.get("x-real-ip") ??
          request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
          "sem-ip";
        const ipHash = createHash("sha256").update(`${ip}|ianews-pauta`).digest("hex").slice(0, 40);

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const db = supabaseAdmin as any;

        const since = new Date(Date.now() - 60 * 60 * 1000).toISOString();
        const recent = (col: "ip_hash" | "email", value: string) =>
          db.from("pauta_leads").select("id", { count: "exact", head: true }).gte("created_at", since).eq(col, value);
        const [byIp, byEmail] = await Promise.all([recent("ip_hash", ipHash), recent("email", clean.email)]);
        if (Math.max(byIp.count ?? 0, byEmail.count ?? 0) >= LIMIT_PER_HOUR) {
          return Response.json(
            { ok: false, error: "Recebemos várias pautas suas na última hora. Tente de novo mais tarde ou escreva para comercial@ianews.site." },
            { status: 429 },
          );
        }

        const origemPath = optional(body["origem_path"], 300);
        const articleSlug = optional(body["article_slug"], 200);
        const device = /mobi|android|iphone|ipad/i.test(ua) ? "celular" : "computador";

        const row = {
          nome: clean.nome,
          cargo: clean.cargo,
          empresa: clean.empresa,
          site: clean.site || null,
          instagram: clean.instagram || null,
          linkedin: clean.linkedin || null,
          whatsapp: clean.whatsapp,
          email: clean.email,
          descricao: clean.descricao,
          link_noticia: clean.link_noticia || null,
          consentimento: true,
          origem_path: origemPath,
          article_slug: articleSlug && /^[a-z0-9-]{3,200}$/.test(articleSlug) ? articleSlug : null,
          utm_source: optional(body["utm_source"], 80),
          utm_medium: optional(body["utm_medium"], 80),
          utm_campaign: optional(body["utm_campaign"], 120),
          device,
          ip_hash: ipHash,
        };

        const { error } = await db.from("pauta_leads").insert(row);
        if (error) {
          console.error("[pauta] insert error", error.message);
          return Response.json(
            { ok: false, error: "Não conseguimos enviar agora. Tente de novo ou escreva para comercial@ianews.site." },
            { status: 500 },
          );
        }

        // Avisos por e-mail: não bloqueiam a resposta se o envio falhar.
        try {
          const { sendTemplateEmail } = await import("@/lib/email-templates/send-email");
          await Promise.allSettled([
            ...NOTIFY_TO.map((to) => sendTemplateEmail("pauta-notification", to, { templateData: row, replyTo: row.email })),
            sendTemplateEmail("pauta-confirmation", row.email, {
              templateData: { nome: row.nome, empresa: row.empresa },
              replyTo: "comercial@ianews.site",
            }),
          ]);
        } catch (err) {
          console.error("[pauta] notify failed", err instanceof Error ? err.message : err);
        }

        return Response.json({ ok: true });
      },
    },
  },
});
