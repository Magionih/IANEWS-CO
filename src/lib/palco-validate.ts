/* Validação da inscrição no Palco IA News, compartilhada entre o navegador e o servidor (/api/public/palco). */

import { maskPhone, phoneDigits } from "@/lib/pauta-validate";

/* Link de pagamento do ingresso do Palco IA News Online (Asaas: Pix, cartão ou boleto). */
export const PALCO_PAGAMENTO_URL = "https://www.asaas.com/000/c/lpcqp7cryd6i4zzg";

export type PalcoPapel = "empresario" | "fornecedor" | "criador" | "marca";

export type PalcoInput = {
  nome: string;
  empresa: string;
  cargo: string;
  whatsapp: string;
  email: string;
  papel: PalcoPapel | "";
  setor: string;
  funcionarios: string;
  desafio: string;
  consentimento: boolean;
};

export type PalcoErrors = Partial<Record<keyof PalcoInput, string>>;

export const PAPEIS: { value: PalcoPapel; label: string; hint: string }[] = [
  { value: "empresario", label: "Empresário", hint: "Quero colocar IA para trabalhar na minha empresa" },
  { value: "fornecedor", label: "Fornecedor de IA", hint: "Vendo soluções, agentes ou consultoria de IA" },
  { value: "criador", label: "Criador ou educador", hint: "Ensino ou produzo conteúdo sobre IA" },
  { value: "marca", label: "Empresa ou marca", hint: "Quero patrocinar o evento" },
];

export const SETORES = [
  "Saúde",
  "Varejo e e-commerce",
  "Serviços",
  "Indústria",
  "Educação",
  "Finanças e seguros",
  "Imobiliário e construção",
  "Tecnologia",
  "Agro",
  "Outro",
];

export const PORTES = ["Só eu", "2 a 10", "11 a 50", "51 a 200", "Mais de 200"];

export const DESAFIO_MAX = 500;

const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]{2,}$/;
const PAPEL_VALUES = PAPEIS.map((p) => p.value) as string[];

export function validatePalco(p: PalcoInput): { errors: PalcoErrors; clean: PalcoInput } {
  const errors: PalcoErrors = {};
  const empty = "Preencha este campo.";
  const clean: PalcoInput = {
    nome: p.nome.trim().slice(0, 160),
    empresa: p.empresa.trim().slice(0, 160),
    cargo: p.cargo.trim().slice(0, 120),
    whatsapp: p.whatsapp.trim(),
    email: p.email.trim().toLowerCase().slice(0, 254),
    papel: PAPEL_VALUES.includes(p.papel) ? p.papel : "",
    setor: SETORES.includes(p.setor) ? p.setor : "",
    funcionarios: PORTES.includes(p.funcionarios) ? p.funcionarios : "",
    desafio: p.desafio.trim().slice(0, DESAFIO_MAX),
    consentimento: p.consentimento === true,
  };

  if (!clean.nome) errors.nome = empty;
  else if (clean.nome.length < 3) errors.nome = "Informe o nome completo.";

  if (!clean.empresa) errors.empresa = empty;

  const digits = phoneDigits(clean.whatsapp);
  if (!clean.whatsapp) errors.whatsapp = empty;
  else if (digits.length < 10 || digits.length > 11) errors.whatsapp = "Confira o número com DDD.";
  else clean.whatsapp = maskPhone(digits);

  if (!clean.email) errors.email = empty;
  else if (!EMAIL_RE.test(clean.email)) errors.email = "Confira o e-mail.";

  if (!clean.papel) errors.papel = "Escolha a opção que mais combina com você.";

  if (!clean.consentimento) errors.consentimento = "Marque para podermos guardar o seu lugar na lista.";

  return { errors, clean };
}
