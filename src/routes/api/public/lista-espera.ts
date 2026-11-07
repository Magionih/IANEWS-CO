import { createFileRoute } from "@tanstack/react-router";
import { createHash } from "crypto";

import { validateLista, type ListaInput } from "@/lib/lista-espera-validate";

/* Recebe o formulário da página /eventos (lista de espera da FGIA Educação).
   Revalida tudo, descarta robôs (campo isca), limita 3 envios por hora por IP ou e-mail e grava em
   evento_lista_espera. Um gatilho no banco leva a inscrição ao CRM (funil Evento IANews, etapa "Na lista",
   etiqueta "FGIA · Lista de espera"). A confirmação por e-mail não bloqueia a resposta. */

const LIMIT_PER_HOUR = 3;
const FAIL = "Não conseguimos registrar agora. Tente de novo em instantes ou chame a gente no direct do @fgiaeducacao.";

const str = (v: unknown, max = 1000) => (typeof v === "string" ? v.slice(0, max) : "");
const optional = (v: unknown, max = 300) => {
  const t = str(v, max).trim();
  return t ? t : null;
};

export const Route = createFileRoute("/api/public/lista-espera")({
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
        if (str(body["site_empresa"]).trim()) return Response.json({ ok: true });

        const input: ListaInput = {
          nome: str(body["nome"], 200),
          email: str(body["email"], 300),
          whatsapp: str(body["whatsapp"], 40),
          empresa: str(body["empresa"], 200),
          cargo: str(body["cargo"], 200),
          instagram: str(body["instagram"], 300),
          interesses: Array.isArray(body["interesses"])
            ? (body["interesses"] as unknown[]).map((i) => str(i, 40)).slice(0, 8)
            : [],
          newsletter: body["newsletter"] === true,
          consentimento: body["consentimento"] === true,
        };
        const { errors, clean } = validateLista(input);
        if (Object.keys(errors).length) {
          return Response.json({ ok: false, errors }, { status: 422 });
        }

        const ua = request.headers.get("user-agent") ?? "";
        const ip =
          request.headers.get("x-real-ip") ??
          request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
          "sem-ip";
        const ipHash = createHash("sha256").update(`${ip}|fgia-lista`).digest("hex").slice(0, 40);

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const db = supabaseAdmin as any;

        const since = new Date(Date.now() - 60 * 60 * 1000).toISOString();
        const recent = (col: "ip_hash" | "email", value: string) =>
          db.from("evento_lista_espera").select("id", { count: "exact", head: true }).gte("created_at", since).eq(col, value);
        const [byIp, byEmail] = await Promise.all([recent("ip_hash", ipHash), recent("email", clean.email)]);
        if ((byEmail.count ?? 0) > 0) {
          // A mesma pessoa reenviando: já está na lista, não duplica.
          return Response.json({ ok: true, already: true });
        }
        if ((byIp.count ?? 0) >= LIMIT_PER_HOUR) {
          return Response.json(
            { ok: false, error: "Recebemos vários cadastros deste aparelho na última hora. Tente de novo mais tarde." },
            { status: 429 },
          );
        }

        const row = {
          nome: clean.nome,
          email: clean.email,
          whatsapp: clean.whatsapp,
          empresa: clean.empresa,
          cargo: clean.cargo,
          instagram: clean.instagram || null,
          interesses: clean.interesses,
          consentimento: true,
          newsletter: clean.newsletter,
          origem_path: optional(body["origem_path"], 300),
          utm_source: optional(body["utm_source"], 80),
          utm_medium: optional(body["utm_medium"], 80),
          utm_campaign: optional(body["utm_campaign"], 120),
          device: /mobi|android|iphone|ipad/i.test(ua) ? "celular" : "computador",
          ip_hash: ipHash,
        };

        const { error } = await db.from("evento_lista_espera").insert(row);
        if (error) {
          console.error("[lista-espera] insert error", error.message);
          return Response.json({ ok: false, error: FAIL }, { status: 500 });
        }

        try {
          const { sendTemplateEmail } = await import("@/lib/email-templates/send-email");
          await sendTemplateEmail("fgia-lista-confirmation", row.email, {
            templateData: { nome: row.nome },
            replyTo: "ianewscomercial@gmail.com",
          });
        } catch (err) {
          console.error("[lista-espera] confirmation failed", err instanceof Error ? err.message : err);
        }

        return Response.json({ ok: true });
      },
    },
  },
});
