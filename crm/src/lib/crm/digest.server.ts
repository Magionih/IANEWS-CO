// Rotinas agendadas do CRM. Só servidor (usa a chave de serviço do Supabase e o Resend).
//  - diária (8h): automações (lead aquecido, sem resposta) + e-mail para a equipe comercial;
//  - semanal (segunda): resumo para o admin.
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { emailSendingEnabled } from "@/lib/cron-auth.server";

import type { CrmDb } from "./access";
import { montarPainelHoje } from "./hoje.functions";
import type { Relatorios } from "./indicadores.functions";
import type { CrmMembro } from "./types";
import { fmtDiaCurto, fmtMoeda, hojeBR, labelDe, ORIGENS, prazoRelativo, somarDias } from "./utils";

const db = supabaseAdmin as unknown as CrmDb;
/** Endereço do CRM (projeto próprio na Vercel), usado nos links dos e-mails. */
const CRM_URL = (process.env.CRM_URL || process.env.VERCEL_PROJECT_PRODUCTION_URL || "")
  .replace(/\/$/, "")
  .replace(/^(?!https?:\/\/)(.+)$/, "https://$1");
const MAX_ITENS = 12;

async function equipe(): Promise<CrmMembro[]> {
  const { data, error } = await db.rpc("crm_equipe");
  if (error) throw new Error(error.message);
  return (data ?? []) as CrmMembro[];
}

async function enviar(
  template: string,
  to: string,
  templateData: Record<string, unknown>,
  chave: string,
) {
  const { sendTemplateEmail } = await import("@/lib/email-templates/send-email");
  return sendTemplateEmail(template, to, { templateData, idempotencyKey: chave });
}

export async function runCrmDaily(opts: { enviarEmail?: boolean } = {}) {
  const { data: rotina, error } = await db.rpc("crm_rotina_diaria");
  if (error) throw new Error(`crm_rotina_diaria: ${error.message}`);

  if (opts.enviarEmail === false || !emailSendingEnabled()) {
    return { ok: true, rotina, enviados: 0, skipped: "Envio de e-mails desligado." };
  }

  const painel = await montarPainelHoje(db);
  const hoje = hojeBR();
  const membros = (await equipe()).filter((m) =>
    m.papeis.some((p) => p === "admin" || p === "comercial"),
  );
  const negocioLink = () => `${CRM_URL}/negocios`;
  const item = (titulo: string, detalhe?: string | null, href?: string | null) => ({
    titulo,
    detalhe,
    href,
  });

  let enviados = 0;
  const falhas: string[] = [];
  for (const m of membros) {
    // Cada pessoa recebe as próprias tarefas e as sem responsável.
    const minhas = painel.tarefas.filter(
      (t) => !t.responsavel_id || t.responsavel_id === m.user_id,
    );
    const dados = {
      crmUrl: CRM_URL,
      nome: m.nome.split(" ")[0],
      data: fmtDiaCurto(hoje),
      tarefasTotal: minhas.length,
      tarefas: minhas
        .slice(0, MAX_ITENS)
        .map((t) =>
          item(
            t.titulo,
            `${prazoRelativo(t.vence_em, hoje)}${t.empresa_nome ? ` · ${t.empresa_nome}` : ""}`,
            `${CRM_URL}/tarefas`,
          ),
        ),
      novos: painel.novos
        .slice(0, MAX_ITENS)
        .map((n) => item(n.titulo, n.etapa_nome, negocioLink())),
      atrasados: painel.atrasados
        .slice(0, MAX_ITENS)
        .map((n) =>
          item(
            n.titulo,
            `${n.proxima_acao ?? "sem ação"} · ${prazoRelativo(n.proxima_acao_em, hoje)}`,
            negocioLink(),
          ),
        ),
      semResposta: painel.semResposta
        .slice(0, MAX_ITENS)
        .map((n) => item(n.titulo, n.etapa_nome, negocioLink())),
      aquecidos: painel.aquecidos
        .slice(0, MAX_ITENS)
        .map((p) => item(p.nome, p.email, `${CRM_URL}/pessoas/${p.id}`)),
      viraramPauta: painel.viraramPauta
        .slice(0, MAX_ITENS)
        .map((f) =>
          item(f.nome, `grupo ${f.grupo ?? "—"} · ${f.article_title ?? "post"}`, `${CRM_URL}`),
        ),
      semana: { ...painel.semana, receita: fmtMoeda(painel.semana.receita) },
    };
    try {
      await enviar("crm-daily", m.email, dados, `crm-daily:${hoje}:${m.user_id}`);
      enviados++;
    } catch (err) {
      falhas.push(`${m.email}: ${err instanceof Error ? err.message : String(err)}`);
    }
  }
  return { ok: falhas.length === 0, rotina, enviados, falhas };
}

export async function runCrmWeekly() {
  if (!emailSendingEnabled())
    return { ok: true, enviados: 0, skipped: "Envio de e-mails desligado." };
  const fim = somarDias(hojeBR(), -1);
  const inicio = somarDias(fim, -6);
  const { data, error } = await db.rpc("crm_relatorios", { p_inicio: inicio, p_fim: fim });
  if (error) throw new Error(`crm_relatorios: ${error.message}`);
  const r = data as Relatorios;

  const [propostas, pendentesGrupo] = await Promise.all([
    db
      .from("crm_negocios_resumo")
      .select("id", { count: "exact", head: true })
      .eq("ativo", true)
      .eq("etapa_nome", "Proposta"),
    db
      .from("crm_empresas")
      .select("id", { count: "exact", head: true })
      .eq("ativo", true)
      .is("grupo", null),
  ]);

  const origens = new Map<string, number>();
  for (const o of r.novos_por_origem) origens.set(o.origem, (origens.get(o.origem) ?? 0) + o.total);
  const totalNovos = [...origens.values()].reduce((s, n) => s + n, 0);

  const dados = {
    crmUrl: CRM_URL,
    periodo: `${fmtDiaCurto(inicio)} a ${fmtDiaCurto(fim)}`,
    numeros: [
      { rotulo: "Novos leads", valor: String(totalNovos) },
      { rotulo: "Negócios fechados", valor: String(r.fechados.quantidade ?? 0) },
      { rotulo: "Receita (pagos)", valor: fmtMoeda(r.fechados.receita ?? 0) },
      { rotulo: "Ticket médio", valor: fmtMoeda(r.fechados.ticket_medio ?? 0) },
      { rotulo: "Cortesias", valor: String(r.fechados.cortesias ?? 0) },
      { rotulo: "Dias médios até fechar", valor: String(r.fechados.dias_medios_ate_fechar ?? 0) },
      {
        rotulo: "Negócios abertos",
        valor: `${r.abertos.quantidade} (${fmtMoeda(r.abertos.valor)})`,
      },
      { rotulo: "Atrasados", valor: String(r.abertos.atrasados) },
    ],
    origens: [...origens.entries()]
      .sort((a, b) => b[1] - a[1])
      .map(([o, n]) => ({ rotulo: labelDe(ORIGENS, o), valor: String(n) })),
    etapas: r.passagem_etapas
      .filter((e) => e.chegaram > 0)
      .map((e) => ({ rotulo: `${e.funil} · ${e.etapa}`, valor: String(e.chegaram) })),
    perdas: r.motivos_perda.map((m) => ({ rotulo: m.motivo, valor: String(m.total) })),
    pendencias: [
      { rotulo: "Negócios em Proposta", valor: String(propostas.count ?? 0) },
      { rotulo: "Negócios sem próxima ação", valor: String(r.abertos.sem_proxima_acao) },
      { rotulo: "Empresas sem grupo", valor: String(pendentesGrupo.count ?? 0) },
    ],
  };

  const admins = (await equipe()).filter((m) => m.papeis.includes("admin"));
  let enviados = 0;
  const falhas: string[] = [];
  for (const a of admins) {
    try {
      await enviar("crm-weekly", a.email, dados, `crm-weekly:${fim}:${a.user_id}`);
      enviados++;
    } catch (err) {
      falhas.push(`${a.email}: ${err instanceof Error ? err.message : String(err)}`);
    }
  }
  return { ok: falhas.length === 0, enviados, falhas };
}
