import { createFileRoute } from "@tanstack/react-router";
import { createHash } from "crypto";

import { validatePalco, validateQualificacao, type PalcoInput, type Qualificacao } from "@/lib/palco-validate";
import { PALCO_CAPI, enviarCapi, lerMetaCtx } from "@/lib/meta-capi.server";

/* Recebe a inscrição da página /palco. Revalida tudo, descarta robôs (campo isca), limita 3 envios por hora
   por IP ou e-mail, não duplica quem já está na lista e grava em palco_inscricoes. Um gatilho no banco leva a
   pessoa para o CRM (funil "Palco IA News Online · 16/12", etapa Na lista) com perfil e papel. */

const NOTIFY_TO = ["ianewscomercial@gmail.com"];
const LIMIT_PER_HOUR = 3;
const FAIL = "Não conseguimos guardar sua inscrição agora. Tente de novo ou escreva para ianewscomercial@gmail.com.";

const str = (v: unknown, max = 1000) => (typeof v === "string" ? v.slice(0, max) : "");
const optional = (v: unknown, max = 300) => {
  const t = str(v, max).trim();
  return t ? t : null;
};

export const Route = createFileRoute("/api/public/palco")({
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

        const input: PalcoInput = {
          nome: str(body["nome"], 200),
          empresa: str(body["empresa"], 200),
          cargo: str(body["cargo"], 200),
          whatsapp: str(body["whatsapp"], 40),
          email: str(body["email"], 300),
          papel: str(body["papel"], 20) as PalcoInput["papel"],
          setor: str(body["setor"], 60),
          funcionarios: str(body["funcionarios"], 30),
          desafio: str(body["desafio"], 600),
          consentimento: body["consentimento"] === true,
        };
        const { errors, clean } = validatePalco(input);
        if (Object.keys(errors).length) {
          return Response.json({ ok: false, errors }, { status: 422 });
        }

        // Checkout da FGIA: qualificação obrigatória antes do pagamento (empresa, cargo, perfil, segmento, tamanho, faturamento).
        const fgia = body["qualificacao"] === "fgia";
        const qualif: Qualificacao | null = fgia
          ? {
              empresa: clean.empresa,
              cargo: clean.cargo,
              papel: str(body["papel"], 20),
              setor: clean.setor,
              funcionarios: clean.funcionarios,
              faturamento: str(body["faturamento"], 60),
              desafio: clean.desafio,
            }
          : null;
        if (qualif) {
          const qErr = validateQualificacao(qualif);
          if (Object.keys(qErr).length) return Response.json({ ok: false, errors: qErr }, { status: 422 });
        }
        // Inscrição feita no checkout da FGIA (com ou sem qualificação): o e-mail leva de volta para lá.
        const viaFgia = fgia || body["checkout"] === "fgia";
        const checkoutUrl = (id: string, token: string) =>
          viaFgia ? `https://fgiaeducacao.com.br/ingresso?i=${id}&t=${token}` : `https://ianewsbr.com/palco/checkout?i=${id}&t=${token}`;

        const ua = request.headers.get("user-agent") ?? "";
        const ip =
          request.headers.get("x-real-ip") ??
          request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
          "sem-ip";
        const ipHash = createHash("sha256").update(`${ip}|ianews-palco`).digest("hex").slice(0, 40);

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const db = supabaseAdmin as any;

        // Quem já está na lista não entra de novo.
        // Quem já está inscrito volta para o checkout do próprio pedido (ou vê que já pagou).
        const already = await db
          .from("palco_inscricoes")
          .select("id, checkout_token, status")
          .eq("email", clean.email)
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle();
        if (already.data) {
          const a = already.data as { id: string; checkout_token: string; status: string };
          if (qualif) {
            // Quem volta pelo checkout da FGIA atualiza os dados da empresa e a qualificação vai para o CRM.
            await db
              .from("palco_inscricoes")
              .update({
                empresa: clean.empresa,
                cargo: clean.cargo || null,
                papel: clean.papel,
                setor: clean.setor || null,
                funcionarios: clean.funcionarios || null,
                desafio: clean.desafio || null,
              })
              .eq("id", a.id);
            await registrarQualificacao(db, a.id, clean, qualif, body);
          }
          return Response.json({ ok: true, already: true, id: a.id, token: a.checkout_token, pago: a.status === "pago" || a.status === "cortesia" });
        }

        const since = new Date(Date.now() - 60 * 60 * 1000).toISOString();
        const recent = (col: "ip_hash" | "email", value: string) =>
          db.from("palco_inscricoes").select("id", { count: "exact", head: true }).gte("created_at", since).eq(col, value);
        const [byIp, byEmail] = await Promise.all([recent("ip_hash", ipHash), recent("email", clean.email)]);
        if (Math.max(byIp.count ?? 0, byEmail.count ?? 0) >= LIMIT_PER_HOUR) {
          return Response.json(
            { ok: false, error: "Recebemos várias inscrições deste acesso na última hora. Tente de novo mais tarde." },
            { status: 429 },
          );
        }

        const row = {
          nome: clean.nome,
          empresa: clean.empresa,
          cargo: clean.cargo || null,
          whatsapp: clean.whatsapp,
          email: clean.email,
          papel: clean.papel,
          setor: clean.setor || null,
          funcionarios: clean.funcionarios || null,
          desafio: clean.desafio || null,
          consentimento: true,
          origem_path: optional(body["origem_path"], 300),
          utm_source: optional(body["utm_source"], 80),
          utm_medium: optional(body["utm_medium"], 80),
          utm_campaign: optional(body["utm_campaign"], 120),
          device: /mobi|android|iphone|ipad/i.test(ua) ? "celular" : "computador",
          ip_hash: ipHash,
          meta_ctx: lerMetaCtx(body["meta"], request),
        };

        const { data: criado, error } = await db.from("palco_inscricoes").insert(row).select("id, checkout_token").single();
        if (error || !criado) {
          console.error("[palco] insert error", error?.message);
          return Response.json({ ok: false, error: FAIL }, { status: 500 });
        }

        if (qualif) await registrarQualificacao(db, criado.id, clean, qualif, body);

        // API de Conversões: mesmo event_id do Pixel (lead-<id>), a Meta deduplica. Só com consentimento.
        await enviarCapi("Lead", `lead-${criado.id}`, { email: row.email, phone: row.whatsapp, nome: row.nome, externalId: criado.id }, row.meta_ctx, PALCO_CAPI);

        // Avisos por e-mail: não bloqueiam a resposta se o envio falhar.
        try {
          const { sendTemplateEmail } = await import("@/lib/email-templates/send-email");
          await Promise.allSettled([
            ...NOTIFY_TO.map((to) => sendTemplateEmail("palco-notification", to, { templateData: qualif ? { ...row, faturamento: qualif.faturamento } : row, replyTo: row.email })),
            sendTemplateEmail("palco-confirmation", row.email, {
              templateData: { nome: row.nome, checkout: checkoutUrl(criado.id, criado.checkout_token) },
              replyTo: "ianewscomercial@gmail.com",
            }),
          ]);
        } catch (err) {
          console.error("[palco] notify failed", err instanceof Error ? err.message : err);
        }

        return Response.json({ ok: true, id: criado.id, token: criado.checkout_token });
      },
    },
  },
});

const PERFIL: Record<string, string> = {
  empresario: "Empresário",
  fornecedor: "Fornecedor de IA",
  criador: "Criador ou educador",
  marca: "Empresa ou marca",
};

/* Grava a qualificação do checkout da FGIA no CRM: uma nota completa no negócio do Palco, e o faturamento e o
   segmento na empresa (só quando ainda estão vazios). Uma falha aqui não impede o pagamento. */
async function registrarQualificacao(db: any, inscricaoId: string, clean: PalcoInput, q: Qualificacao, body: Record<string, unknown>) {
  try {
    const { data: insc } = await db.from("palco_inscricoes").select("pessoa_id, negocio_id").eq("id", inscricaoId).maybeSingle();
    if (!insc?.pessoa_id) return;
    const { data: neg } = insc.negocio_id
      ? await db.from("crm_negocios").select("empresa_id").eq("id", insc.negocio_id).maybeSingle()
      : { data: null };
    let empresaId: string | null = neg?.empresa_id ?? null;
    if (!empresaId) {
      const { data: emp } = await db.from("crm_empresas").select("id").ilike("nome", q.empresa.trim()).limit(1).maybeSingle();
      empresaId = emp?.id ?? null;
      if (empresaId && insc.negocio_id) {
        await db.from("crm_negocios").update({ empresa_id: empresaId }).eq("id", insc.negocio_id).is("empresa_id", null);
      }
    }
    if (empresaId) {
      // porte aceita só startup, pme, grande ou global; a faixa exata de faturamento fica na nota abaixo.
      const porte = q.faturamento === "Ainda não fatura" ? "startup" : q.faturamento === "Acima de R$ 5 milhões por mês" ? "grande" : "pme";
      await db.from("crm_empresas").update({ porte }).eq("id", empresaId).is("porte", null);
      await db.from("crm_empresas").update({ setor: q.setor }).eq("id", empresaId).is("setor", null);
    }
    const origem = ["utm_source", "utm_medium", "utm_campaign"]
      .map((k) => (typeof body[k] === "string" && body[k] ? `${k.replace("utm_", "")}=${String(body[k]).slice(0, 80)}` : ""))
      .filter(Boolean)
      .join(" · ");
    const texto = [
      "Qualificação no checkout da FGIA (fgiaeducacao.com.br/ingresso), antes do pagamento",
      `Nome: ${clean.nome}`,
      `WhatsApp: ${clean.whatsapp}`,
      `E-mail: ${clean.email}`,
      `Empresa: ${q.empresa}`,
      `Cargo: ${q.cargo}`,
      `Perfil: ${PERFIL[q.papel] ?? q.papel}`,
      `Segmento: ${q.setor}`,
      `Funcionários: ${q.funcionarios}`,
      `Faturamento: ${q.faturamento}`,
      q.desafio ? `Quer resolver com IA: ${q.desafio}` : "",
      origem ? `Origem: ${origem}` : "",
    ]
      .filter(Boolean)
      .join("\n");
    await db.from("crm_atividades").insert({
      tipo: "nota",
      canal: "site",
      texto,
      pessoa_id: insc.pessoa_id,
      empresa_id: empresaId,
      negocio_id: insc.negocio_id ?? null,
    });
  } catch (err) {
    console.error("[palco] qualificação no CRM falhou", err instanceof Error ? err.message : err);
  }
}
