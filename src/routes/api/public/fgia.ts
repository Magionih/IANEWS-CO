import { createFileRoute } from "@tanstack/react-router";

import { FGIA_TIPOS, validateFgia, type FgiaInput } from "@/lib/fgia";

/* Formulários do site da FGIA Educação (fgiaeducacao.com.br): lista de espera do Palco BH, candidatura a
   palestrante e interesse em patrocínio. Tudo cai no CRM central: pessoa (sem duplicar por e-mail ou WhatsApp),
   empresa, negócio no funil certo, atividade com o que a pessoa escreveu e tarefa para a equipe. */

const FAIL = "Não conseguimos guardar seu envio agora. Tente de novo ou fale com a gente no Direct da @fgiaeducacao.";
const ORIGEM = "fgiaeducacao.com.br";

const str = (v: unknown, max = 1000) => (typeof v === "string" ? v.slice(0, max) : "");

export const Route = createFileRoute("/api/public/fgia")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        let body: Record<string, unknown>;
        try {
          body = (await request.json()) as Record<string, unknown>;
        } catch {
          return Response.json({ ok: false, error: "Envio inválido." }, { status: 400 });
        }

        // Campo isca: robô preenche, pessoa não vê.
        if (str(body["site"]).trim()) return Response.json({ ok: true });

        const input: FgiaInput = {
          tipo: str(body["tipo"], 20) as FgiaInput["tipo"],
          nome: str(body["nome"], 200),
          whatsapp: str(body["whatsapp"], 40),
          email: str(body["email"], 300),
          empresa: str(body["empresa"], 200),
          cargo: str(body["cargo"], 200),
          instagram: str(body["instagram"], 80),
          mensagem: str(body["mensagem"], 900),
          consentimento: body["consentimento"] === true,
        };
        const { errors, clean } = validateFgia(input);
        if (Object.keys(errors).length) return Response.json({ ok: false, errors }, { status: 422 });

        const cfg = FGIA_TIPOS[clean.tipo];
        const utm = ["utm_source", "utm_medium", "utm_campaign"]
          .map((k) => {
            const v = str(body[k], 80).trim();
            return v ? `${k.replace("utm_", "")}=${v}` : "";
          })
          .filter(Boolean)
          .join(" · ");

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const db = supabaseAdmin as any;

        try {
          const notas = `${cfg.rotulo}${clean.instagram ? ` · Instagram @${clean.instagram}` : ""}`;
          const { data: pessoa, error: ePessoa } = await db.rpc("crm_pessoa_por_contato", {
            p_nome: clean.nome,
            p_email: clean.email,
            p_whatsapp: clean.whatsapp,
            p_origem: ORIGEM,
            p_consent: clean.consentimento,
            p_notas: notas,
          });
          if (ePessoa || !pessoa) throw new Error(ePessoa?.message ?? "pessoa");

          if (clean.instagram) {
            await db.from("crm_pessoas").update({ instagram: clean.instagram }).eq("id", pessoa).is("instagram", null);
          }

          let empresa: string | null = null;
          if (clean.empresa) {
            const r = await db.rpc("crm_empresa_por_nome", {
              p_nome: clean.empresa,
              p_pessoa: pessoa,
              p_cargo: clean.cargo || null,
              p_origem: ORIGEM,
              p_setor: null,
            });
            empresa = r.data ?? null;
          }

          const texto = [
            `${cfg.rotulo} (site fgiaeducacao.com.br)`,
            `Nome: ${clean.nome}`,
            `WhatsApp: ${clean.whatsapp}`,
            `E-mail: ${clean.email}`,
            clean.empresa ? `Empresa: ${clean.empresa}${clean.cargo ? ` · ${clean.cargo}` : ""}` : "",
            clean.instagram ? `Instagram: @${clean.instagram}` : "",
            clean.mensagem ? `Mensagem: ${clean.mensagem}` : "",
            utm ? `Origem: ${utm}` : "",
          ]
            .filter(Boolean)
            .join("\n");

          // Quem já tem negócio aberto deste tipo no funil não ganha outro: só registra o novo envio.
          const { data: aberto } = await db
            .from("crm_negocios")
            .select("id")
            .eq("pessoa_id", pessoa)
            .eq("funil_id", cfg.funil)
            .eq("titulo", `${cfg.titulo} · ${clean.nome}`)
            .eq("ativo", true)
            .limit(1)
            .maybeSingle();

          if (aberto?.id) {
            await db.from("crm_atividades").insert({
              tipo: "mensagem_recebida",
              canal: "site",
              texto,
              pessoa_id: pessoa,
              empresa_id: empresa,
              negocio_id: aberto.id,
            });
          } else {
            const { error: eNeg } = await db.rpc("crm_registrar_entrada", {
              p_empresa: empresa,
              p_pessoa: pessoa,
              p_funil: cfg.funil,
              p_etapa: cfg.etapa,
              p_titulo: `${cfg.titulo} · ${clean.nome}`,
              p_origem: ORIGEM,
              p_canal: "site",
              p_article: null,
              p_texto: texto,
              p_tarefa: `${cfg.tarefa}: ${clean.nome}`,
              p_pauta: null,
              p_contato: null,
            });
            if (eNeg) throw new Error(eNeg.message);
          }

          try {
            const { sendTemplateEmail } = await import("@/lib/email-templates/send-email");
            await sendTemplateEmail("contact-notification", "magionih@gmail.com", {
              templateData: {
                kind: cfg.rotulo,
                full_name: clean.nome,
                email: clean.email,
                phone: clean.whatsapp,
                company: clean.empresa || null,
                subject: cfg.titulo,
                message: texto,
              },
              replyTo: clean.email,
            });
          } catch (err) {
            console.error("[fgia] aviso por e-mail falhou", err instanceof Error ? err.message : err);
          }

          return Response.json({ ok: true });
        } catch (err) {
          console.error("[fgia] erro ao gravar no CRM", err instanceof Error ? err.message : err);
          return Response.json({ ok: false, error: FAIL }, { status: 500 });
        }
      },
    },
  },
});
