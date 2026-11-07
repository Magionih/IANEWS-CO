/* Lista de espera da FGIA Educação: validação compartilhada entre o navegador e o servidor
   (/api/public/lista-espera). Usa os mesmos ajustes de telefone e Instagram da página /pauta. */

import { maskPhone, normalizeInstagram, phoneDigits } from "@/lib/pauta-validate";

export { maskPhone };

export const INTERESSES = [
  { id: "primeiro-encontro", label: "Primeiro encontro (17/12)" },
  { id: "mesa-ianews", label: "Mesa IANews (online)" },
  { id: "in-company", label: "Palestra na minha empresa" },
  { id: "palestrar", label: "Quero palestrar" },
] as const;

export type ListaInput = {
  nome: string;
  email: string;
  whatsapp: string;
  empresa: string;
  cargo: string;
  instagram: string;
  interesses: string[];
  newsletter: boolean;
  consentimento: boolean;
};

export type ListaErrors = Partial<Record<keyof ListaInput, string>>;

const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]{2,}$/;
const IDS = new Set<string>(INTERESSES.map((i) => i.id));

export function validateLista(p: ListaInput): { errors: ListaErrors; clean: ListaInput } {
  const errors: ListaErrors = {};
  const empty = "Preencha este campo.";
  const clean: ListaInput = {
    nome: p.nome.trim().replace(/\s+/g, " ").slice(0, 160),
    email: p.email.trim().toLowerCase().slice(0, 254),
    whatsapp: p.whatsapp.trim(),
    empresa: p.empresa.trim().replace(/\s+/g, " ").slice(0, 160),
    cargo: p.cargo.trim().replace(/\s+/g, " ").slice(0, 120),
    instagram: p.instagram.trim(),
    interesses: Array.from(new Set((p.interesses ?? []).filter((i) => IDS.has(i)))),
    newsletter: p.newsletter === true,
    consentimento: p.consentimento === true,
  };

  if (!clean.nome) errors.nome = empty;
  else if (clean.nome.length < 3) errors.nome = "Informe o nome completo.";

  if (!clean.email) errors.email = empty;
  else if (!EMAIL_RE.test(clean.email)) errors.email = "Confira o e-mail.";

  const digits = phoneDigits(clean.whatsapp);
  if (!clean.whatsapp) errors.whatsapp = empty;
  else if (digits.length < 10 || digits.length > 11) errors.whatsapp = "Confira o número com DDD.";
  else clean.whatsapp = maskPhone(digits);

  if (!clean.empresa) errors.empresa = empty;
  if (!clean.cargo) errors.cargo = empty;

  const ig = normalizeInstagram(clean.instagram);
  if (ig === null) errors.instagram = "Use @perfil ou o link do Instagram.";
  else clean.instagram = ig;

  if (!clean.interesses.length) errors.interesses = "Escolha pelo menos uma opção.";
  if (!clean.consentimento) errors.consentimento = "Marque para podermos avisar você.";

  return { errors, clean };
}
