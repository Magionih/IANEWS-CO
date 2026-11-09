/* Inscrições das páginas da estratégia de monetização: /lista100, /aula, /conselho e /projetos.
   Validação compartilhada entre o navegador e o servidor (/api/public/inscricao). Tudo cai no CRM por um
   gatilho no banco (site_inscricoes → site_inscricao_para_crm). */

import { maskPhone, normalizeInstagram, normalizeUrl, phoneDigits } from "@/lib/pauta-validate";

export const CANAL_URL = "https://chat.whatsapp.com/Is5edILjICj0D2MMHUmGbL";
export const CONTATO = "ianewscomercial@gmail.com";

/** Aula ao vivo em cartaz. Os lembretes do CRM leem a mesma data em auto_config (chave aula_atual). */
export const AULA = {
  numero: 1,
  inicio: "2026-11-25T19:00:00-03:00",
  dataLonga: "quarta-feira, 25 de novembro",
  dataCurta: "25/11",
  hora: "19h",
  duracao: "60 minutos",
  titulo: "Como empresas brasileiras estão colocando IA para vender",
  onde: "Online e gratuita, ao vivo no YouTube",
};

export const LISTA = {
  fecha: "07/12",
  fechaIso: "2026-12-07T23:59:00-03:00",
  avaliacao: "08 a 12/12",
  anuncio: "16/12",
};

export const CATEGORIAS_LISTA: { value: string; label: string; hint: string }[] = [
  { value: "aplica", label: "Empresas que aplicam IA", hint: "Negócios de qualquer setor com IA rodando na operação, nas vendas ou no atendimento" },
  { value: "fornecedor", label: "Fornecedores, agências e consultorias", hint: "Quem implementa IA para outras empresas" },
  { value: "startup", label: "Startups e produtos de IA", hint: "Empresas que criaram um produto de IA usado por clientes" },
  { value: "criador", label: "Criadores e educadores", hint: "Quem ensina IA e muda a forma como as empresas aprendem" },
  { value: "executivo", label: "Líderes de IA em grandes empresas", hint: "Executivos que levaram IA para dentro de empresas grandes" },
];

/** Categoria da Lista → perfil do CRM */
export const PERFIL_DA_CATEGORIA: Record<string, string> = {
  aplica: "empresario",
  fornecedor: "fornecedor",
  startup: "startup",
  criador: "criador",
  executivo: "executivo",
};

export const PERFIS: { value: string; label: string }[] = [
  { value: "fornecedor", label: "Implemento IA para outras empresas" },
  { value: "startup", label: "Tenho um produto ou startup de IA" },
  { value: "criador", label: "Ensino ou crio conteúdo sobre IA" },
  { value: "empresario", label: "Uso IA na minha empresa" },
  { value: "executivo", label: "Lidero IA numa empresa grande" },
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
  "Alimentação e restaurantes",
  "Outro",
];

export const PORTES = ["Só eu", "2 a 10", "11 a 50", "51 a 200", "Mais de 200"];
export const PRAZOS = ["Agora, nos próximos 30 dias", "Em 1 a 3 meses", "Ainda estou pesquisando"];
export const INVESTIMENTOS = ["Até R$ 5 mil", "R$ 5 mil a R$ 20 mil", "R$ 20 mil a R$ 50 mil", "Acima de R$ 50 mil", "Ainda não sei"];

export type Tipo = "lista100" | "indicacao" | "aula" | "conselho" | "projeto";

export type Indicado = { nome: string; empresa: string; contato: string };

export type Inscricao = {
  tipo: Tipo;
  nome: string;
  empresa: string;
  cargo: string;
  whatsapp: string;
  email: string;
  perfil: string;
  instagram: string;
  linkedin: string;
  categoria: string;
  caso: string;
  resultado: string;
  setor: string;
  porte: string;
  problema: string;
  prazo: string;
  investimento: string;
  horario: string;
  materia: string;
  indicados: Indicado[];
  consentimento: boolean;
};

export type Erros = Partial<Record<keyof Inscricao | `indicado${number}`, string>>;

export const VAZIA: Inscricao = {
  tipo: "lista100",
  nome: "",
  empresa: "",
  cargo: "",
  whatsapp: "",
  email: "",
  perfil: "",
  instagram: "",
  linkedin: "",
  categoria: "",
  caso: "",
  resultado: "",
  setor: "",
  porte: "",
  problema: "",
  prazo: "",
  investimento: "",
  horario: "",
  materia: "",
  indicados: [],
  consentimento: false,
};

export const MAX = { caso: 600, resultado: 300, problema: 800 };
export const MAX_INDICADOS = 5;

const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]{2,}$/;
const t = (v: unknown, max: number) => (typeof v === "string" ? v.trim().slice(0, max) : "");
const um = (v: string, lista: string[]) => (lista.includes(v) ? v : "");

/** Contato de um indicado: e-mail, WhatsApp com DDD ou @ do Instagram. */
export function contatoValido(v: string): boolean {
  const c = v.trim();
  if (!c) return false;
  if (EMAIL_RE.test(c)) return true;
  if (!/[A-Za-z]/.test(c) && phoneDigits(c).length >= 10) return true;
  return normalizeInstagram(c) !== null;
}

export function validar(p: Inscricao): { erros: Erros; limpa: Inscricao } {
  const erros: Erros = {};
  const vazio = "Preencha este campo.";
  const limpa: Inscricao = {
    tipo: p.tipo,
    nome: t(p.nome, 160),
    empresa: t(p.empresa, 160),
    cargo: t(p.cargo, 120),
    whatsapp: t(p.whatsapp, 30),
    email: t(p.email, 254).toLowerCase(),
    perfil: um(p.perfil, PERFIS.map((x) => x.value)),
    instagram: t(p.instagram, 120),
    linkedin: t(p.linkedin, 300),
    categoria: um(p.categoria, CATEGORIAS_LISTA.map((x) => x.value)),
    caso: t(p.caso, MAX.caso),
    resultado: t(p.resultado, MAX.resultado),
    setor: um(p.setor, SETORES),
    porte: um(p.porte, PORTES),
    problema: t(p.problema, MAX.problema),
    prazo: um(p.prazo, PRAZOS),
    investimento: um(p.investimento, INVESTIMENTOS),
    horario: t(p.horario, 40),
    materia: t(p.materia, 200).replace(/[^a-z0-9-]/g, ""),
    indicados: (Array.isArray(p.indicados) ? p.indicados : [])
      .slice(0, MAX_INDICADOS)
      .map((i) => ({ nome: t(i?.nome, 160), empresa: t(i?.empresa, 160), contato: t(i?.contato, 160) }))
      .filter((i) => i.nome || i.contato || i.empresa),
    consentimento: p.consentimento === true,
  };

  if (!limpa.nome) erros.nome = vazio;
  else if (limpa.nome.length < 3) erros.nome = "Informe o nome completo.";

  if (!limpa.email) erros.email = vazio;
  else if (!EMAIL_RE.test(limpa.email)) erros.email = "Confira o e-mail.";

  const d = phoneDigits(limpa.whatsapp);
  if (!limpa.whatsapp) erros.whatsapp = vazio;
  else if (d.length < 10 || d.length > 11) erros.whatsapp = "Confira o número com DDD.";
  else limpa.whatsapp = maskPhone(d);

  if (limpa.instagram) {
    const ig = normalizeInstagram(limpa.instagram);
    if (ig === null) erros.instagram = "Use o @ do perfil.";
    else limpa.instagram = ig;
  }
  if (limpa.linkedin) {
    const li = normalizeUrl(limpa.linkedin);
    if (li === null) erros.linkedin = "Confira o link.";
    else limpa.linkedin = li;
  }

  const precisaEmpresa = limpa.tipo !== "indicacao" && limpa.tipo !== "aula";
  if (precisaEmpresa && !limpa.empresa) erros.empresa = vazio;

  if (limpa.tipo === "lista100") {
    if (!limpa.categoria) erros.categoria = "Escolha a categoria.";
    if (limpa.caso.length < 40) erros.caso = "Conte o caso em pelo menos duas frases: o que a IA faz e onde.";
    if (limpa.resultado.length < 10) erros.resultado = "Diga o resultado, de preferência com um número.";
  }
  if (limpa.tipo === "conselho") {
    if (!limpa.perfil) erros.perfil = "Escolha a opção que mais combina com você.";
    if (limpa.caso.length < 40) erros.caso = "Conte em duas frases o que você faz com IA e um resultado.";
    if (limpa.horario && Number.isNaN(Date.parse(limpa.horario))) erros.horario = "Escolha um horário da lista.";
  }
  if (limpa.tipo === "projeto") {
    if (limpa.problema.length < 30) erros.problema = "Conte em duas frases o que você quer resolver.";
    if (!limpa.porte) erros.porte = "Escolha o tamanho da empresa.";
    if (!limpa.prazo) erros.prazo = "Escolha o prazo.";
  }
  if (limpa.tipo === "aula" && !limpa.perfil) erros.perfil = "Escolha a opção que mais combina com você.";

  limpa.indicados.forEach((i, n) => {
    if (!i.nome || !contatoValido(i.contato)) {
      erros[`indicado${n}`] = !i.nome ? "Informe o nome de quem você indica." : "Informe o @ do Instagram, o WhatsApp ou o e-mail.";
    }
  });
  if (limpa.tipo === "indicacao" && limpa.indicados.length === 0) erros.indicados = "Indique pelo menos uma pessoa.";

  if (!limpa.consentimento) erros.consentimento = "Marque para podermos falar com você.";

  return { erros, limpa };
}

/** Rótulo de um horário do Conselho no fuso de Brasília: "ter 10/11 · 10h30". */
export function rotuloHorario(iso: string): { dia: string; hora: string; chave: string } {
  const d = new Date(iso);
  const f = (o: Intl.DateTimeFormatOptions) => new Intl.DateTimeFormat("pt-BR", { timeZone: "America/Sao_Paulo", ...o }).format(d);
  const dia = `${f({ weekday: "short" }).replace(".", "")} ${f({ day: "2-digit", month: "2-digit" })}`;
  const hora = f({ hour: "2-digit", minute: "2-digit" }).replace(":00", "h").replace(":", "h");
  return { dia, hora, chave: f({ year: "numeric", month: "2-digit", day: "2-digit" }) };
}
