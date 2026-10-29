/* Funções puras do CRM (sem acesso ao banco): rótulos, datas, modelos de mensagem, links e CSV. */

import type { CrmAtividadeTipo, CrmCampanhaStatus, CrmGrupo, CrmStatusPagamento } from "./types";

export const SITE_URL = "https://ianewsbr.com";
const TZ = "America/Sao_Paulo";

// ---------- Rótulos ----------

export const TIPOS_NEGOCIO: { value: string; label: string; funil?: string }[] = [
  { value: "destaque_pago", label: "Destaque pago", funil: "materia" },
  { value: "destaque_cortesia", label: "Destaque cortesia com collab", funil: "materia" },
  { value: "materia_paga", label: "Matéria paga", funil: "materia" },
  { value: "pacote_publicidade", label: "Pacote de publicidade", funil: "publicidade" },
  { value: "publicidade_personalizada", label: "Publicidade personalizada", funil: "publicidade" },
  { value: "parceria", label: "Parceria / collab", funil: "parcerias" },
  { value: "evento", label: "Evento", funil: "parcerias" },
  { value: "co_marketing", label: "Co-marketing", funil: "parcerias" },
];

export const ORIGENS: { value: string; label: string }[] = [
  { value: "prospeccao", label: "Prospecção" },
  { value: "virou_pauta", label: "Virou pauta" },
  { value: "pauta", label: "Página /pauta" },
  { value: "contato", label: "Formulário de contato" },
  { value: "indicacao", label: "Indicação" },
  { value: "newsletter", label: "Newsletter" },
  { value: "ranking", label: "Ranking IA" },
  { value: "outro", label: "Outro" },
];

export const CANAIS: { value: string; label: string }[] = [
  { value: "direct", label: "Direct (Instagram)" },
  { value: "whatsapp", label: "WhatsApp" },
  { value: "linkedin", label: "LinkedIn" },
  { value: "email", label: "E-mail" },
  { value: "telefone", label: "Telefone" },
  { value: "site", label: "Site" },
];

export const ATIVIDADE_LABEL: Record<CrmAtividadeTipo, string> = {
  mensagem_enviada: "Mensagem enviada",
  mensagem_recebida: "Mensagem recebida",
  ligacao: "Ligação",
  reuniao: "Reunião",
  nota: "Nota",
  mudanca_etapa: "Mudança de etapa",
  email: "E-mail",
  proposta: "Proposta",
  pagamento: "Pagamento",
  sistema: "Sistema",
};

/** Tipos que a equipe registra à mão (os demais o sistema grava sozinho). */
export const ATIVIDADES_MANUAIS: CrmAtividadeTipo[] = [
  "mensagem_enviada",
  "mensagem_recebida",
  "ligacao",
  "reuniao",
  "nota",
  "email",
  "proposta",
  "pagamento",
];

export const PAGAMENTO_LABEL: Record<CrmStatusPagamento, string> = {
  pendente: "Pendente",
  pago: "Pago",
  cortesia: "Cortesia",
  cancelado: "Cancelado",
};

export const CAMPANHA_LABEL: Record<CrmCampanhaStatus, string> = {
  planejada: "Planejada",
  em_veiculacao: "Em veiculação",
  concluida: "Concluída",
  cancelada: "Cancelada",
};

export const PORTES = [
  { value: "startup", label: "Startup" },
  { value: "pme", label: "PME" },
  { value: "grande", label: "Grande empresa" },
  { value: "global", label: "Global" },
];

export const CANAIS_CONTEUDO = [
  { value: "instagram", label: "Instagram" },
  { value: "facebook", label: "Facebook" },
  { value: "linkedin", label: "LinkedIn" },
  { value: "threads", label: "Threads" },
  { value: "newsletter", label: "Newsletter" },
  { value: "site", label: "Site" },
];

export const FORMATOS_CONTEUDO = ["post", "carrossel", "reels", "stories"];
export const FORMATOS_ENTREGA = ["post", "stories", "reels", "newsletter", "banner", "matéria"];

export const labelDe = (list: { value: string; label: string }[], v?: string | null) =>
  (v && list.find((i) => i.value === v)?.label) || v || "—";

export const GRUPO_DESCRICAO: Record<CrmGrupo, string> = {
  A: "70 ou mais: contato em até 2 dias, mensagem personalizada",
  B: "40 a 69: cadência padrão",
  C: "abaixo de 40: base para publicidade e parcerias, sem cadência ativa",
};

/** Regra de seguidores: menos de 10 mil = destaque pago; 10 mil ou mais = cortesia com collab. Só sugestão. */
export function sugestaoTipoNegocio(
  seguidores?: number | null,
): { tipo: string; motivo: string } | null {
  if (seguidores == null) return null;
  return seguidores >= 10_000
    ? {
        tipo: "destaque_cortesia",
        motivo: `${fmtNum(seguidores)} seguidores (10 mil ou mais): cortesia com collab`,
      }
    : {
        tipo: "destaque_pago",
        motivo: `${fmtNum(seguidores)} seguidores (menos de 10 mil): destaque pago`,
      };
}

/**
 * Explica a pontuação da empresa com as mesmas regras da função crm_pontuacao_empresa do banco
 * (o número exibido é sempre o calculado pelo banco; esta lista só mostra o porquê).
 */
export function explicarPontuacao(d: {
  brasileira: boolean | null;
  origem: string | null;
  interagiu: boolean;
  noticia_recente_em: string | null;
  pessoas: {
    decisor: boolean;
    ativo: boolean;
    instagram: string | null;
    linkedin: string | null;
    whatsapp: string | null;
    email: string | null;
    aquecido_em: string | null;
  }[];
  mencoes: number;
  recebeuMensagem: boolean;
  collabAceito: boolean;
  hoje?: string;
}): { criterio: string; pontos: number; ok: boolean }[] {
  const hoje = d.hoje ?? hojeBR();
  const ativas = d.pessoas.filter((p) => p.ativo);
  const decisores = ativas.filter((p) => p.decisor);
  const brasileira = d.brasileira !== false;
  const semContato = !ativas.some((p) => p.whatsapp || p.email || p.instagram || p.linkedin);
  const aquecido = d.pessoas.some(
    (p) => p.aquecido_em && Date.now() - new Date(p.aquecido_em).getTime() <= 30 * 86_400_000,
  );
  return [
    {
      criterio: brasileira
        ? "Empresa brasileira ou com operação no Brasil"
        : "Estrangeira sem operação no Brasil",
      pontos: brasileira ? 20 : -20,
      ok: true,
    },
    {
      criterio: "Fundador/executivo identificado com Instagram ou LinkedIn",
      pontos: 15,
      ok: decisores.some((p) => p.instagram || p.linkedin),
    },
    {
      criterio: "WhatsApp ou e-mail direto do decisor",
      pontos: 15,
      ok: decisores.some((p) => p.whatsapp || p.email),
    },
    { criterio: "Já apareceu em conteúdo da IANews", pontos: 15, ok: d.mencoes > 0 },
    {
      criterio: "Interagiu com o conteúdo (collab, comentário, resposta)",
      pontos: 15,
      ok: d.interagiu || d.recebeuMensagem || d.collabAceito,
    },
    {
      criterio: "Rodada, lançamento ou notícia recente (90 dias)",
      pontos: 10,
      ok: !!d.noticia_recente_em && diasEntre(d.noticia_recente_em, hoje) <= 90,
    },
    {
      criterio: "Veio por formulário (/pauta ou contato)",
      pontos: 10,
      ok: ["pauta", "formulario", "contato"].includes(d.origem ?? ""),
    },
    {
      criterio: "Lead aquecido (3+ leituras em 7 dias, últimos 30 dias)",
      pontos: 10,
      ok: aquecido,
    },
    { criterio: "Sem nenhum contato direto", pontos: -10, ok: semContato },
  ];
}

// ---------- Datas e números ----------

/** Data de hoje (AAAA-MM-DD) no horário de Brasília. */
export function hojeBR(base = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(base);
}

export function somarDias(dia: string, dias: number): string {
  const d = new Date(`${dia}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + dias);
  return d.toISOString().slice(0, 10);
}

export function diasEntre(de: string, ate: string): number {
  return Math.round(
    (new Date(`${ate}T12:00:00Z`).getTime() - new Date(`${de}T12:00:00Z`).getTime()) / 86_400_000,
  );
}

export const fmtNum = (n?: number | null) => (n ?? 0).toLocaleString("pt-BR");

export const fmtMoeda = (n?: number | null) =>
  n == null ? "—" : Number(n).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

export const fmtDia = (v?: string | null) => {
  if (!v) return "—";
  const d = v.length === 10 ? new Date(`${v}T12:00:00Z`) : new Date(v);
  return d.toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    timeZone: TZ,
  });
};

export const fmtDiaCurto = (v?: string | null) => {
  if (!v) return "—";
  const d = v.length === 10 ? new Date(`${v}T12:00:00Z`) : new Date(v);
  return d.toLocaleDateString("pt-BR", { day: "2-digit", month: "short", timeZone: TZ });
};

export const fmtDataHora = (v?: string | null) =>
  v
    ? new Date(v).toLocaleString("pt-BR", {
        day: "2-digit",
        month: "short",
        hour: "2-digit",
        minute: "2-digit",
        timeZone: TZ,
      })
    : "—";

/** "há 3 dias", "hoje", "em 2 dias" para datas AAAA-MM-DD. */
export function prazoRelativo(dia?: string | null, hoje = hojeBR()): string {
  if (!dia) return "sem data";
  const d = diasEntre(hoje, dia);
  if (d === 0) return "hoje";
  if (d === 1) return "amanhã";
  if (d === -1) return "ontem";
  return d < 0 ? `há ${-d} dias` : `em ${d} dias`;
}

export const atrasado = (dia?: string | null, hoje = hojeBR()) => !!dia && dia < hoje;

/** ISO -> valor de <input type="datetime-local"> no fuso do navegador. */
export function paraInputLocal(iso?: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  return new Date(d.getTime() - d.getTimezoneOffset() * 60_000).toISOString().slice(0, 16);
}

/** Valor de <input type="datetime-local"> (fuso do navegador) -> ISO. */
export const deInputLocal = (v?: string | null) => (v ? new Date(v).toISOString() : null);

// ---------- Mensagens ----------

export type VariaveisModelo = {
  nome?: string | null;
  empresa?: string | null;
  link_materia?: string | null;
  link_post?: string | null;
  valor?: number | string | null;
};

export const VARIAVEIS_MODELO = ["{nome}", "{empresa}", "{link_materia}", "{link_post}", "{valor}"];

const primeiroNome = (nome?: string | null) => (nome ?? "").trim().split(/\s+/)[0] ?? "";

/** Preenche {nome}, {empresa}, {link_materia}, {link_post} e {valor}. Variável sem dado fica visível como [falta ...]. */
export function preencherModelo(texto: string, v: VariaveisModelo): string {
  const valor = typeof v.valor === "number" ? fmtMoeda(v.valor) : v.valor;
  const mapa: Record<string, string | null | undefined> = {
    nome: primeiroNome(v.nome),
    empresa: v.empresa,
    link_materia: v.link_materia,
    link_post: v.link_post,
    valor,
  };
  return texto.replace(/\{(nome|empresa|link_materia|link_post|valor)\}/g, (_, k: string) => {
    const val = mapa[k];
    return val && String(val).trim() ? String(val) : `[falta ${k.replace("_", " ")}]`;
  });
}

export const faltaVariavel = (texto: string) => /\[falta [a-z ]+\]/.test(texto);

export const linkMateria = (slug?: string | null) => (slug ? `${SITE_URL}/materia/${slug}` : null);

// ---------- Links ----------

export function soDigitos(v?: string | null) {
  return (v ?? "").replace(/\D/g, "");
}

/** Link wa.me (assume Brasil quando falta o código do país). */
export function linkWhatsApp(telefone?: string | null, texto?: string): string | null {
  let d = soDigitos(telefone);
  if (!d) return null;
  if (d.length <= 11) d = `55${d}`;
  return `https://wa.me/${d}${texto ? `?text=${encodeURIComponent(texto)}` : ""}`;
}

export function linkInstagram(v?: string | null): string | null {
  if (!v) return null;
  if (/^https?:\/\//i.test(v)) return v;
  return `https://www.instagram.com/${v.replace(/^@/, "").trim()}/`;
}

export function linkLinkedIn(v?: string | null): string | null {
  if (!v) return null;
  if (/^https?:\/\//i.test(v)) return v;
  return `https://www.linkedin.com/in/${v.trim()}`;
}

export function linkSite(v?: string | null): string | null {
  if (!v) return null;
  return /^https?:\/\//i.test(v) ? v : `https://${v}`;
}

// ---------- CSV ----------

export type CsvColuna<T> = { titulo: string; valor: (row: T) => unknown };

function celula(v: unknown): string {
  if (v == null) return "";
  const s = Array.isArray(v)
    ? v.join(", ")
    : typeof v === "boolean"
      ? v
        ? "sim"
        : "não"
      : String(v);
  return /[";\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

const BOM = String.fromCharCode(0xfeff);

/** CSV com ";" (abre direto no Excel em português) e BOM UTF-8. */
export function gerarCsv<T>(linhas: T[], colunas: CsvColuna<T>[]): string {
  const cabecalho = colunas.map((c) => celula(c.titulo)).join(";");
  const corpo = linhas.map((l) => colunas.map((c) => celula(c.valor(l))).join(";"));
  return `${BOM}${[cabecalho, ...corpo].join("\r\n")}`;
}

export function baixarCsv<T>(nome: string, linhas: T[], colunas: CsvColuna<T>[]) {
  const blob = new Blob([gerarCsv(linhas, colunas)], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${nome}-${hojeBR()}.csv`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

// ---------- Texto ----------

export function normalizar(s?: string | null) {
  return (s ?? "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();
}

export function contem(alvo: (string | null | undefined)[], busca: string) {
  const q = normalizar(busca);
  if (!q) return true;
  return alvo.some((v) => normalizar(v).includes(q));
}
