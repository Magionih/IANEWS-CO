/** Formata telefone brasileiro: (11) 99999-0000 */
export function formatPhoneBR(raw: string) {
  const d = raw.replace(/\D/g, "").slice(0, 11);
  if (d.length <= 2) return d.length ? `(${d}` : "";
  if (d.length <= 6) return `(${d.slice(0, 2)}) ${d.slice(2)}`;
  if (d.length <= 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
  return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
}

export const EMAIL_DOMAINS = [
  "gmail.com",
  "hotmail.com",
  "outlook.com",
  "yahoo.com.br",
  "icloud.com",
  "live.com",
  "bol.com.br",
  "uol.com.br",
  "terra.com.br",
];

/** Sugestões de domínio a partir do que o leitor digitou depois do @ */
export function emailSuggestions(value: string, limit = 4) {
  const at = value.indexOf("@");
  if (at < 1) return [];
  const local = value.slice(0, at);
  const typed = value.slice(at + 1).toLowerCase();
  if (typed.includes(".") && EMAIL_DOMAINS.includes(typed)) return [];
  return EMAIL_DOMAINS.filter((d) => d.startsWith(typed))
    .slice(0, limit)
    .map((d) => `${local}@${d}`);
}
