/* FGIA Educação (fgiaeducacao.com.br): o palco da IA News. Dados da página e validação dos formulários,
   compartilhados entre o navegador e o servidor (/api/public/fgia). */

import { maskPhone, phoneDigits } from "@/lib/pauta-validate";

export const FGIA_SITE = "https://fgiaeducacao.com.br";
/* Checkout próprio da FGIA (src/routes/ingresso.tsx): cobra pelo Asaas e grava a inscrição no CRM. */
export const FGIA_INGRESSO_URL = "/ingresso";
/* Link de pagamento da FGIA no Asaas ("FGIA Educação · Palco 16/12"). Só aparece se a cobrança pela API falhar. */
export const FGIA_PAGAMENTO_URL = "https://www.asaas.com/000/c/dwneovujmpf3h4qd";
export const FGIA_DIRECT_URL = "https://ig.me/m/fgiaeducacao";
export const FGIA_INSTAGRAM = "https://www.instagram.com/fgiaeducacao/";
export const FGIA_ONLINE_INICIO = "2026-12-16T19:00:00-03:00";

/** O domínio próprio da FGIA mostra a landing na raiz. */
export function isFgiaHost(host: string | null | undefined): boolean {
  return !!host && /(^|\.)fgiaeducacao\.com\.br$/i.test(host.split(":")[0]);
}

export const FGIA_PROGRAMA = [
  { t: "19h00", s: "Abertura com Henrique Magioni" },
  { t: "19h05", s: "Raio-X IA News 2026" },
  { t: "19h25", s: "Três cases com números: quem faz, ensina" },
  { t: "19h50", s: "Playbook IA 2027" },
  { t: "20h05", s: "Anúncio da Lista IA News 100" },
  { t: "20h15", s: "Mesa IA News: perguntas ao vivo" },
  { t: "20h25", s: "Encerramento e o que vem em BH" },
];

export const FGIA_FAQ = [
  {
    q: "É online ou presencial?",
    a: "Os dois, em datas diferentes. 16.12 é online e ao vivo, das 19h às 20h30. 11.02.27 é presencial, em Belo Horizonte.",
  },
  {
    q: "Quanto custa?",
    a: "O online custa R$ 97. Os valores do presencial serão anunciados em breve, e quem for ao online usa os R$ 97 como crédito.",
  },
  {
    q: "Vai ter gravação?",
    a: "Sim. Quem compra o online assiste à gravação por 30 dias e recebe os slides do Raio-X e o Playbook IA 2027.",
  },
  { q: "Como eu pago?", a: "Pix, cartão ou boleto, na página de inscrição do Palco online." },
  {
    q: "Como envio uma pergunta para o Henrique?",
    a: "Mande no Direct da @fgiaeducacao. As melhores perguntas são respondidas ao vivo na Mesa IA News.",
  },
];

export type FgiaTipo = "lista_bh" | "palestrar" | "patrocinio";

export const FGIA_TIPOS: Record<FgiaTipo, { funil: string; etapa: string; titulo: string; tarefa: string; rotulo: string }> = {
  lista_bh: {
    funil: "presencial",
    etapa: "Lista de espera",
    titulo: "Lista de espera · Palco BH",
    tarefa: "Boas-vindas à lista de espera do Palco BH (WhatsApp)",
    rotulo: "FGIA · Lista de espera BH",
  },
  palestrar: {
    funil: "presencial",
    etapa: "Interessado",
    titulo: "Candidato a palestrante · Palco BH",
    tarefa: "Avaliar o case do candidato a palestrante",
    rotulo: "FGIA · Candidato a palestrante",
  },
  patrocinio: {
    funil: "publicidade",
    etapa: "Conversa",
    titulo: "Patrocínio · Palco BH",
    tarefa: "Responder o interesse em patrocínio do Palco BH",
    rotulo: "FGIA · Patrocínio",
  },
};

export type FgiaInput = {
  tipo: FgiaTipo | "";
  nome: string;
  whatsapp: string;
  email: string;
  empresa: string;
  cargo: string;
  instagram: string;
  mensagem: string;
  consentimento: boolean;
};

export type FgiaErrors = Partial<Record<keyof FgiaInput, string>>;

const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]{2,}$/;

export function validateFgia(p: FgiaInput): { errors: FgiaErrors; clean: FgiaInput & { tipo: FgiaTipo } } {
  const errors: FgiaErrors = {};
  const empty = "Preencha este campo.";
  const tipo = (["lista_bh", "palestrar", "patrocinio"].includes(p.tipo) ? p.tipo : "lista_bh") as FgiaTipo;
  const clean = {
    tipo,
    nome: p.nome.trim().slice(0, 160),
    whatsapp: p.whatsapp.trim(),
    email: p.email.trim().toLowerCase().slice(0, 254),
    empresa: p.empresa.trim().slice(0, 160),
    cargo: p.cargo.trim().slice(0, 120),
    instagram: p.instagram.trim().replace(/^@/, "").slice(0, 60),
    mensagem: p.mensagem.trim().slice(0, 800),
    consentimento: p.consentimento === true,
  };

  if (!clean.nome) errors.nome = empty;
  else if (clean.nome.length < 3) errors.nome = "Informe o nome completo.";

  const digits = phoneDigits(clean.whatsapp);
  if (!clean.whatsapp) errors.whatsapp = empty;
  else if (digits.length < 10 || digits.length > 11) errors.whatsapp = "Confira o número com DDD.";
  else clean.whatsapp = maskPhone(digits);

  if (!clean.email) errors.email = empty;
  else if (!EMAIL_RE.test(clean.email)) errors.email = "Confira o e-mail.";

  if ((tipo === "palestrar" || tipo === "patrocinio") && !clean.empresa) errors.empresa = empty;
  if (tipo === "palestrar" && clean.mensagem.length < 20) errors.mensagem = "Conte o case em pelo menos uma frase.";
  if (!clean.consentimento) errors.consentimento = "Precisamos do seu ok para falar com você.";

  return { errors, clean };
}
