/* Validação da pauta, compartilhada entre o navegador e o servidor (/api/public/pauta). */

export type PautaInput = {
  nome: string;
  cargo: string;
  empresa: string;
  site: string;
  instagram: string;
  linkedin: string;
  whatsapp: string;
  email: string;
  descricao: string;
  link_noticia: string;
  consentimento: boolean;
};

export type PautaErrors = Partial<Record<keyof PautaInput, string>>;

export const DESC_MIN = 30;
export const DESC_MAX = 800;
export const CONTACT_EMAIL = "ianewscomercial@gmail.com";

const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]{2,}$/;

/** Só dígitos, sem o 55 do país. Aceita fixo (10) e celular (11). */
export function phoneDigits(v: string) {
  let d = v.replace(/\D/g, "");
  if (d.length > 11 && d.startsWith("55")) d = d.slice(2);
  return d;
}

export function maskPhone(v: string) {
  const d = phoneDigits(v).slice(0, 11);
  if (d.length <= 2) return d.length ? `(${d}` : "";
  if (d.length <= 6) return `(${d.slice(0, 2)}) ${d.slice(2)}`;
  if (d.length <= 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
  return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
}

/** Completa https:// e confere se é um endereço válido. Vazio continua vazio. */
export function normalizeUrl(v: string): string | null {
  const t = v.trim();
  if (!t) return "";
  const withProto = /^https?:\/\//i.test(t) ? t : `https://${t}`;
  try {
    const u = new URL(withProto);
    if (!u.hostname.includes(".")) return null;
    return u.toString().slice(0, 300);
  } catch {
    return null;
  }
}

/** Aceita @perfil, perfil ou link do Instagram; devolve @perfil. */
export function normalizeInstagram(v: string): string | null {
  const t = v.trim();
  if (!t) return "";
  const m = t.match(/instagram\.com\/([A-Za-z0-9._]{1,30})/i);
  const handle = (m ? m[1] : t.replace(/^@/, "")).replace(/\/$/, "");
  return /^[A-Za-z0-9._]{1,30}$/.test(handle) ? `@${handle}` : null;
}

export function validatePauta(p: PautaInput): { errors: PautaErrors; clean: PautaInput } {
  const errors: PautaErrors = {};
  const empty = "Preencha este campo.";
  const clean: PautaInput = {
    nome: p.nome.trim().slice(0, 160),
    cargo: p.cargo.trim().slice(0, 120),
    empresa: p.empresa.trim().slice(0, 160),
    site: p.site.trim(),
    instagram: p.instagram.trim(),
    linkedin: p.linkedin.trim(),
    whatsapp: p.whatsapp.trim(),
    email: p.email.trim().toLowerCase().slice(0, 254),
    descricao: p.descricao.trim(),
    link_noticia: p.link_noticia.trim(),
    consentimento: p.consentimento === true,
  };

  if (!clean.nome) errors.nome = empty;
  else if (clean.nome.length < 3) errors.nome = "Informe o nome completo.";
  if (!clean.cargo) errors.cargo = empty;
  if (!clean.empresa) errors.empresa = empty;

  const digits = phoneDigits(clean.whatsapp);
  if (!clean.whatsapp) errors.whatsapp = empty;
  else if (digits.length < 10 || digits.length > 11) errors.whatsapp = "Confira o número com DDD.";
  else clean.whatsapp = maskPhone(digits);

  if (!clean.email) errors.email = empty;
  else if (!EMAIL_RE.test(clean.email)) errors.email = "Confira o e-mail.";

  if (!clean.descricao) errors.descricao = empty;
  else if (clean.descricao.length < DESC_MIN) errors.descricao = `Conte um pouco mais (mínimo ${DESC_MIN} caracteres).`;
  else if (clean.descricao.length > DESC_MAX) errors.descricao = `Use no máximo ${DESC_MAX} caracteres.`;

  const site = normalizeUrl(clean.site);
  if (site === null) errors.site = "Confira o endereço do site.";
  else clean.site = site;

  const ig = normalizeInstagram(clean.instagram);
  if (ig === null) errors.instagram = "Use @perfil ou o link do Instagram.";
  else clean.instagram = ig;

  const li = normalizeUrl(clean.linkedin);
  if (li === null) errors.linkedin = "Confira o link do LinkedIn.";
  else clean.linkedin = li;

  const news = normalizeUrl(clean.link_noticia);
  if (news === null) errors.link_noticia = "Confira o link.";
  else clean.link_noticia = news;

  if (!clean.consentimento) errors.consentimento = "Marque para podermos avaliar sua pauta.";

  return { errors, clean };
}
