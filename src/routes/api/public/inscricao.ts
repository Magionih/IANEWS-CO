import { createFileRoute } from "@tanstack/react-router";
import { createHash } from "crypto";

import { AULA, PERFIL_DA_CATEGORIA, validar, VAZIA, type Inscricao, type Tipo } from "@/lib/inscricao";

/* Recebe as inscrições de /lista100, /aula, /conselho e /projetos. Revalida tudo, descarta robôs (campo isca),
   limita 5 envios por hora por IP ou e-mail e grava em site_inscricoes. Um gatilho no banco leva a pessoa (e os
   indicados) ao CRM. GET ?horarios=conselho devolve os horários livres da conversa de 15 minutos. */

const AVISO_PARA = ["ianewscomercial@gmail.com"];
const LIMITE_HORA = 5;
const FALHA = "Não conseguimos guardar seu envio agora. Tente de novo ou escreva para ianewscomercial@gmail.com.";
const TIPOS: Tipo[] = ["lista100", "indicacao", "aula", "conselho", "projeto"];
/** Um envio por e-mail nestes tipos; os outros (indicação, projeto) podem se repetir. */
const UNICO: Tipo[] = ["lista100", "aula", "conselho"];

const str = (v: unknown, max = 1000) => (typeof v === "string" ? v.slice(0, max) : "");
const opt = (v: unknown, max = 300) => str(v, max).trim() || null;

async function db() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin as any;
}

async function horariosLivres(): Promise<string[]> {
  const { data, error } = await (await db()).rpc("conselho_horarios_livres");
  if (error) throw new Error(error.message);
  return ((data ?? []) as (string | { conselho_horarios_livres: string })[]).map((r) =>
    new Date(typeof r === "string" ? r : r.conselho_horarios_livres).toISOString(),
  );
}

export const Route = createFileRoute("/api/public/inscricao")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const url = new URL(request.url);
        if (url.searchParams.get("horarios") !== "conselho") return Response.json({ ok: false }, { status: 404 });
        try {
          return Response.json(
            { ok: true, horarios: await horariosLivres() },
            { headers: { "cache-control": "no-store" } },
          );
        } catch (err) {
          console.error("[inscricao] horarios", err instanceof Error ? err.message : err);
          return Response.json({ ok: false, horarios: [] }, { status: 500 });
        }
      },

      POST: async ({ request }) => {
        let body: Record<string, unknown>;
        try {
          body = (await request.json()) as Record<string, unknown>;
        } catch {
          return Response.json({ ok: false, error: "Envio inválido." }, { status: 400 });
        }
        if (str(body["empresa_site"]).trim()) return Response.json({ ok: true });

        const tipo = str(body["tipo"], 20) as Tipo;
        if (!TIPOS.includes(tipo)) return Response.json({ ok: false, error: "Envio inválido." }, { status: 400 });

        const entrada: Inscricao = { ...VAZIA };
        for (const k of Object.keys(VAZIA) as (keyof Inscricao)[]) {
          if (k === "indicados") entrada.indicados = Array.isArray(body.indicados) ? (body.indicados as Inscricao["indicados"]) : [];
          else if (k === "consentimento") entrada.consentimento = body.consentimento === true;
          else (entrada as Record<string, unknown>)[k] = str(body[k], 1000);
        }
        entrada.tipo = tipo;
        const { erros, limpa } = validar(entrada);
        if (Object.keys(erros).length) return Response.json({ ok: false, errors: erros }, { status: 422 });

        const base = await db();

        if (UNICO.includes(tipo)) {
          const ja = await base
            .from("site_inscricoes")
            .select("id", { count: "exact", head: true })
            .eq("tipo", tipo)
            .eq("status", "recebido")
            .ilike("email", limpa.email);
          if ((ja.count ?? 0) > 0 && limpa.indicados.length === 0) return Response.json({ ok: true, already: true });
        }

        const ua = request.headers.get("user-agent") ?? "";
        const ip =
          request.headers.get("x-real-ip") ?? request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "sem-ip";
        const ipHash = createHash("sha256").update(`${ip}|ianews-inscricao`).digest("hex").slice(0, 40);
        const desde = new Date(Date.now() - 60 * 60 * 1000).toISOString();
        const recentes = (col: "ip_hash" | "email", v: string) =>
          base.from("site_inscricoes").select("id", { count: "exact", head: true }).gte("created_at", desde).eq(col, v);
        const [porIp, porEmail] = await Promise.all([recentes("ip_hash", ipHash), recentes("email", limpa.email)]);
        if (Math.max(porIp.count ?? 0, porEmail.count ?? 0) >= LIMITE_HORA) {
          return Response.json(
            { ok: false, error: "Recebemos vários envios deste acesso na última hora. Tente de novo mais tarde." },
            { status: 429 },
          );
        }

        // Conselho: o horário escolhido precisa estar livre
        let agendado: string | null = null;
        if (tipo === "conselho" && limpa.horario) {
          const livres = await horariosLivres().catch(() => [] as string[]);
          agendado = new Date(limpa.horario).toISOString();
          if (!livres.includes(agendado)) {
            return Response.json(
              { ok: false, errors: { horario: "Esse horário acabou de ser reservado. Escolha outro." }, refresh: true },
              { status: 409 },
            );
          }
        }

        const perfil = tipo === "lista100" ? PERFIL_DA_CATEGORIA[limpa.categoria] ?? null : limpa.perfil || (tipo === "projeto" ? "empresario" : null);
        const dados: Record<string, string> = {};
        for (const k of ["categoria", "caso", "resultado", "setor", "porte", "problema", "prazo", "investimento", "materia", "instagram", "linkedin"] as const) {
          if (limpa[k]) dados[k] = limpa[k];
        }
        if (tipo === "aula") dados.aula = AULA.inicio;

        const row = {
          tipo,
          nome: limpa.nome,
          empresa: limpa.empresa || null,
          cargo: limpa.cargo || null,
          whatsapp: limpa.whatsapp,
          email: limpa.email,
          perfil,
          dados,
          indicados: limpa.indicados,
          agendado_em: agendado,
          consentimento: true,
          status: str(body["teste"]) === "sim" ? "teste" : "recebido",
          origem_path: opt(body["origem_path"]),
          utm_source: opt(body["utm_source"], 80),
          utm_medium: opt(body["utm_medium"], 80),
          utm_campaign: opt(body["utm_campaign"], 120),
          device: /mobi|android|iphone|ipad/i.test(ua) ? "celular" : "computador",
          ip_hash: ipHash,
        };

        const { error } = await base.from("site_inscricoes").insert(row);
        if (error) {
          if (error.code === "23505") {
            return Response.json(
              { ok: false, errors: { horario: "Esse horário acabou de ser reservado. Escolha outro." }, refresh: true },
              { status: 409 },
            );
          }
          console.error("[inscricao] insert", error.message);
          return Response.json({ ok: false, error: FALHA }, { status: 500 });
        }

        try {
          const { sendTemplateEmail } = await import("@/lib/email-templates/send-email");
          await Promise.allSettled([
            ...AVISO_PARA.map((to) =>
              sendTemplateEmail("inscricao-notification", to, { templateData: row, replyTo: row.email }),
            ),
            sendTemplateEmail("inscricao-confirmation", row.email, {
              templateData: { tipo, nome: row.nome, agendado_em: agendado, indicados: limpa.indicados.length },
              replyTo: "ianewscomercial@gmail.com",
            }),
          ]);
        } catch (err) {
          console.error("[inscricao] e-mail", err instanceof Error ? err.message : err);
        }

        return Response.json({ ok: true, agendado_em: agendado });
      },
    },
  },
});
