/* Mini chat da Renata no Direct da @ianews.co.
   Cada comentário com palavra-chave, resposta a story ou mensagem no Direct entra aqui. O motor guarda o passo
   de cada pessoa (ig_conversas), entrega o que foi prometido, coleta um contato próprio e leva ao CRM
   (ig_lead_crm). Regras do Instagram: comentário gera UMA resposta privada; só depois que a pessoa responde
   abrem-se 24 horas de conversa. Por isso a primeira mensagem sempre termina com botões ou uma pergunta. */

import { AULA } from "@/lib/inscricao";

export type Botao = { titulo: string; payload: string };
export type Saida = { texto: string; botoes?: Botao[] };
export type Entrada = {
  tipo: "comentario" | "mensagem" | "mencao";
  igsid: string;
  username?: string | null;
  texto?: string | null;
  payload?: string | null;
  comentarioId?: string | null;
  mediaId?: string | null;
};

/** Como o motor fala com o Instagram. Em produção, a Graph API; no teste, um coletor. */
export interface Canal {
  respostaPrivada(comentarioId: string, s: Saida): Promise<void>;
  direct(igsid: string, s: Saida): Promise<void>;
  responderComentario(comentarioId: string, texto: string): Promise<void>;
  perfil(igsid: string): Promise<{ username?: string; name?: string; segue?: boolean } | null>;
  pausa(ms: number): Promise<void>;
}

type Conversa = {
  igsid: string;
  username: string | null;
  nome: string | null;
  pessoa_id: string | null;
  fluxo: string | null;
  passo: string | null;
  dados: Record<string, any>;
  pontos: number;
  segue: boolean | null;
  humano_ate: string | null;
  optout: boolean;
  menu_em: string | null;
};

const SITE = "https://ianewsbr.com";
const CANAL = "https://chat.whatsapp.com/Is5edILjICj0D2MMHUmGbL";
const utm = (path: string, fluxo: string) =>
  `${SITE}${path}${path.includes("?") ? "&" : "?"}utm_source=instagram&utm_medium=direct&utm_campaign=minichat-${fluxo}`;

const PONTOS: Record<string, number> = {
  noticias: 5, radar: 10, lista: 20, aula: 15, palco: 15, conselho: 30, projeto: 40, anunciar: 30, pauta: 10, menu: 0,
};

export const norm = (s: string) =>
  s.normalize("NFD").replace(/[̀-ͯ]/g, "").toUpperCase().replace(/[^A-Z0-9 ]/g, " ").trim();
const primeiro = (c: Conversa) => (c.nome ?? "").trim().split(/\s+/)[0] || (c.username ? `@${c.username}` : "");
const oi = (c: Conversa) => (primeiro(c) ? `Oi, ${primeiro(c)}!` : "Oi!");
const EMAIL_RE = /[^@\s]+@[^@\s]+\.[^@\s]{2,}/;

const MENU: Botao[] = [
  { titulo: "Notícias às 7h", payload: "F:noticias" },
  { titulo: "IA no meu setor", payload: "F:radar" },
  { titulo: "Lista 100", payload: "F:lista" },
  { titulo: "Aula ao vivo", payload: "F:aula" },
  { titulo: "Palco 16/12", payload: "F:palco" },
  { titulo: "Conselho", payload: "F:conselho" },
  { titulo: "IA na minha empresa", payload: "F:projeto" },
  { titulo: "Anunciar", payload: "F:anunciar" },
  { titulo: "Falar com a equipe", payload: "F:humano" },
];

const SETORES: { titulo: string; termos: string[] }[] = [
  { titulo: "Saúde", termos: ["saude", "clinica", "hospital", "medic"] },
  { titulo: "Varejo", termos: ["varejo", "e-commerce", "ecommerce", "loja"] },
  { titulo: "Serviços", termos: ["servico", "atendimento", "agencia"] },
  { titulo: "Indústria", termos: ["industria", "fabrica", "manufatura"] },
  { titulo: "Educação", termos: ["educacao", "escola", "ensino"] },
  { titulo: "Outro", termos: [] },
];

const PORTES = ["Só eu", "2 a 10", "11 a 50", "51 a 200", "Mais de 200"];

function dataAula(): { data: string; hora: string } {
  const d = new Date(AULA.inicio);
  const f = (o: Intl.DateTimeFormatOptions) => new Intl.DateTimeFormat("pt-BR", { timeZone: "America/Sao_Paulo", ...o }).format(d);
  return { data: `${f({ weekday: "long" })}, ${f({ day: "2-digit", month: "2-digit" })}`, hora: AULA.hora };
}

/* ---------------- Fluxos ----------------
   Cada fluxo tem uma abertura (primeira mensagem, que pode ser a resposta privada a um comentário) e passos.
   Um passo recebe a resposta da pessoa e devolve as próximas mensagens e o próximo passo (null = fim). */

type Resultado = {
  saidas: Saida[];
  passo: string | null;
  dados?: Record<string, any>;
  lead?: Record<string, unknown>;
  /** Mensagens finais que passam pelo pedido de seguir a @ianews.co antes de sair */
  entregarComPortao?: boolean;
};

function abertura(fluxo: string, c: Conversa): Resultado {
  switch (fluxo) {
    case "noticias":
      return {
        saidas: [
          {
            texto: `${oi(c)} Aqui é a Renata, da IA News. Todo dia, às 7h, mandamos no WhatsApp as notícias de IA que importam para quem tem negócio, em 3 minutos de leitura: ${CANAL}\n\nQuer receber também a newsletter por e-mail?`,
            botoes: [
              { titulo: "Quero por e-mail", payload: "N:email" },
              { titulo: "Só o WhatsApp", payload: "N:wpp" },
            ],
          },
        ],
        passo: "noticias.escolha",
      };
    case "radar":
      return {
        saidas: [
          {
            texto: `${oi(c)} Aqui é a Renata, da IA News. Te mando o que está acontecendo de IA no seu setor. Qual é o seu?`,
            botoes: SETORES.map((s) => ({ titulo: s.titulo, payload: `S:${s.titulo}` })),
          },
        ],
        passo: "radar.setor",
      };
    case "lista":
      return {
        saidas: [
          {
            texto: `${oi(c)} Aqui é a Renata, da IA News. A Lista IA News 100 vai reunir os 100 nomes que estão fazendo IA de verdade nos negócios no Brasil. Ninguém paga para entrar, e o anúncio é no Palco IA News, em 16/12. Você quer:`,
            botoes: [
              { titulo: "Me candidatar", payload: "L:cand" },
              { titulo: "Indicar alguém", payload: "L:ind" },
            ],
          },
        ],
        passo: "lista.escolha",
      };
    case "aula": {
      const a = dataAula();
      return {
        saidas: [
          {
            texto: `${oi(c)} Aqui é a Renata, da IA News. A próxima Aula ao vivo é ${a.data}, às ${a.hora}: "${AULA.titulo}". São 60 minutos com empresários mostrando casos reais, e é gratuita. Quer que eu faça sua inscrição por aqui?`,
            botoes: [
              { titulo: "Quero", payload: "A:sim" },
              { titulo: "Agora não", payload: "A:nao" },
            ],
          },
        ],
        passo: "aula.quer",
      };
    }
    case "palco":
      return {
        saidas: [
          {
            texto: `${oi(c)} Aqui é a Renata, da IA News. O Palco IA News é em 16/12, em Belo Horizonte: só sobe ao palco quem já colocou IA para trabalhar numa empresa. Você vai como:`,
            botoes: [
              { titulo: "Empresário", payload: "P:empresario" },
              { titulo: "Fornecedor de IA", payload: "P:fornecedor" },
              { titulo: "Marca/patrocinador", payload: "P:marca" },
            ],
          },
        ],
        passo: "palco.perfil",
      };
    case "conselho":
      return {
        saidas: [
          {
            texto: `${oi(c)} Aqui é a Renata, da IA News. O Conselho IA News é o grupo de quem coloca IA para trabalhar de verdade no Brasil: voz na IA News, vitrine para novos projetos e uma mesa mensal com quem faz. A entrada é por candidatura. Me conta em uma frase: o que você faz com IA?`,
          },
        ],
        passo: "conselho.caso",
      };
    case "projeto":
      return {
        saidas: [
          {
            texto: `${oi(c)} Aqui é a Renata, da IA News. Se você quer colocar IA para trabalhar na sua empresa, a gente encontra quem faz, sem custo para você. Me conta: o que você quer resolver?`,
          },
        ],
        passo: "projeto.problema",
      };
    case "anunciar":
      return {
        saidas: [
          {
            texto: `${oi(c)} Aqui é a Renata, da IA News. Que bom que você quer falar com quem decide sobre IA nas empresas. Qual é a sua empresa? Te mando o mídia kit com os formatos.`,
          },
        ],
        passo: "anunciar.empresa",
      };
    case "pauta":
      return {
        saidas: [
          {
            texto: `${oi(c)} Aqui é a Renata, da IA News. A redação lê todas as pautas. Conta a sua história aqui: ${utm("/pauta", "pauta")}\n\nSe fizer sentido, a gente te chama.`,
          },
        ],
        passo: null,
        lead: { fluxo: "pauta" },
      };
    case "humano":
      return {
        saidas: [{ texto: `${oi(c)} Vou te responder pessoalmente em instantes. Pode ir me contando por aqui.` }],
        passo: null,
        lead: { fluxo: "humano", nota: "Pediu para falar com a equipe" },
      };
    case "sair":
      return { saidas: [{ texto: "Combinado, não te mando mais mensagens automáticas. Se precisar, é só escrever MENU." }], passo: null };
    default:
      return {
        saidas: [{ texto: `${oi(c)} Aqui é a Renata, da IA News. Como posso te ajudar?`, botoes: MENU }],
        passo: "menu",
      };
  }
}

async function continuar(db: any, c: Conversa, e: Entrada): Promise<Resultado | null> {
  const p = e.payload ?? "";
  const t = (e.texto ?? "").trim();
  const d = c.dados ?? {};
  switch (c.passo) {
    case "menu":
      if (p.startsWith("F:")) return { ...abertura(p.slice(2), c), dados: { ...d, fluxo_menu: p.slice(2) } };
      return null;

    case "noticias.escolha":
      if (p === "N:email" || /mail/i.test(t)) return { saidas: [{ texto: "Me manda o seu melhor e-mail que eu cadastro agora." }], passo: "noticias.email" };
      if (p === "N:wpp" || /whats|so o|só o/i.test(t))
        return { saidas: [{ texto: "Combinado! Te vejo amanhã às 7h no canal. Se quiser outra coisa, é só escrever MENU." }], passo: null, lead: { fluxo: "noticias" } };
      return null;
    case "noticias.email": {
      const m = t.match(EMAIL_RE)?.[0];
      if (!m) return { saidas: [{ texto: "Acho que esse e-mail veio incompleto. Pode mandar de novo?" }], passo: "noticias.email" };
      return {
        saidas: [{ texto: `Pronto, ${primeiro(c) || "tudo certo"}: cadastrado. A próxima newsletter chega cedinho. Pode deixar, uso só para te mandar o que você pediu.` }],
        passo: null,
        lead: { fluxo: "noticias", email: m },
      };
    }

    case "radar.setor": {
      const setor = SETORES.find((s) => p === `S:${s.titulo}` || norm(t) === norm(s.titulo)) ?? (t ? SETORES[5] : null);
      if (!setor) return null;
      const lista = await materiasDoSetor(db, setor.termos);
      const corpo = lista.length
        ? lista.map((a, i) => `${i + 1}. ${a.title}\n${SITE}/materia/${a.slug}?utm_source=instagram&utm_medium=direct&utm_campaign=minichat-radar`).join("\n\n")
        : `As últimas matérias estão em ${utm("/", "radar")}`;
      return {
        saidas: [
          { texto: `O que saiu de IA em ${setor.titulo === "Outro" ? "negócios" : setor.titulo.toLowerCase()} nos últimos dias:\n\n${corpo}` },
          {
            texto: "Quer receber o Radar do seu setor por e-mail toda semana?",
            botoes: [
              { titulo: "Quero", payload: "R:sim" },
              { titulo: "Agora não", payload: "R:nao" },
            ],
          },
        ],
        passo: "radar.quer",
        dados: { ...d, setor: setor.titulo },
        entregarComPortao: true,
      };
    }
    case "radar.quer":
      if (p === "R:sim" || /^sim|quero/i.test(t)) return { saidas: [{ texto: "Me manda o seu melhor e-mail." }], passo: "radar.email" };
      return { saidas: [{ texto: "Tudo bem! Se mudar de ideia, é só escrever RADAR." }], passo: null, lead: { fluxo: "radar", setor: d.setor } };
    case "radar.email": {
      const m = t.match(EMAIL_RE)?.[0];
      if (!m) return { saidas: [{ texto: "Acho que esse e-mail veio incompleto. Pode mandar de novo?" }], passo: "radar.email" };
      return {
        saidas: [{ texto: `Pronto! O Radar de ${String(d.setor ?? "IA").toLowerCase()} chega no seu e-mail. Uso só para isso.` }],
        passo: null,
        lead: { fluxo: "radar", email: m, setor: d.setor, nota: `Radar do setor: ${d.setor}` },
      };
    }

    case "lista.escolha": {
      const ind = p === "L:ind" || /indic/i.test(t);
      const cand = p === "L:cand" || /candid|eu|mim/i.test(t);
      if (!ind && !cand) return null;
      return {
        saidas: [
          {
            texto: ind
              ? `Que bom! Indique aqui (até 5 pessoas) e a gente convida contando que foi você: ${utm("/lista100?modo=indicar", "lista")}\n\nAs indicações vão até 07/12.`
              : `Candidate-se aqui, leva 3 minutos: ${utm("/lista100", "lista")}\n\nConte o seu caso de IA com um resultado. As inscrições vão até 07/12.`,
          },
        ],
        passo: null,
        lead: { fluxo: "lista", nota: ind ? "Lista 100: quer indicar (Direct)" : "Lista 100: quer se candidatar (Direct)" },
        entregarComPortao: true,
      };
    }

    case "aula.quer":
      if (p === "A:nao" || /^n[aã]o|depois/i.test(t))
        return { saidas: [{ texto: "Tudo bem! Se mudar de ideia, é só escrever AULA." }], passo: null };
      if ((p === "A:sim" || /^sim|quero/i.test(t)) && d.email && d.whatsapp) {
        await inscreverAula(db, c, String(d.email), String(d.whatsapp));
        return { saidas: [{ texto: `Inscrição feita com o seu e-mail e WhatsApp, ${primeiro(c) || "tudo certo"}! O link chega 1 hora antes.` }], passo: null, entregarComPortao: true };
      }
      if (p === "A:sim" || /^sim|quero/i.test(t))
        return { saidas: [{ texto: "Ótimo! Qual é o seu e-mail? Mando a confirmação e o link para salvar na agenda." }], passo: "aula.email", entregarComPortao: true };
      return null;
    case "aula.email": {
      const m = t.match(EMAIL_RE)?.[0];
      if (!m) return { saidas: [{ texto: "Acho que esse e-mail veio incompleto. Pode mandar de novo?" }], passo: "aula.email" };
      return { saidas: [{ texto: "E o seu WhatsApp com DDD? Te mando o link da aula 1 hora antes." }], passo: "aula.wpp", dados: { ...d, email: m } };
    }
    case "aula.wpp": {
      const w = whatsapp(t);
      if (!w) return { saidas: [{ texto: "Me manda o número com DDD, por exemplo (31) 99999-0000." }], passo: "aula.wpp" };
      await inscreverAula(db, c, String(d.email), w);
      const a = dataAula();
      return {
        saidas: [{ texto: `Inscrição feita, ${primeiro(c) || "tudo certo"}! A aula é ${a.data}, às ${a.hora}. A confirmação foi para o seu e-mail, e o link chega por WhatsApp 1 hora antes.` }],
        passo: null,
        dados: { ...d, whatsapp: w },
      };
    }

    case "palco.perfil": {
      const perfil = p.startsWith("P:") ? p.slice(2) : /marca|patroc/i.test(t) ? "marca" : /fornec/i.test(t) ? "fornecedor" : /empres/i.test(t) ? "empresario" : null;
      if (!perfil) return null;
      if (perfil === "marca")
        return { saidas: [{ texto: "Perfeito. Qual é a empresa e o seu melhor e-mail? Te mando as cotas de patrocínio." }], passo: "palco.marca", dados: { ...d, perfil } };
      return {
        saidas: [{ texto: `A programação e a lista antecipada estão aqui: ${utm(`/palco?papel=${perfil}`, "palco")}\n\nO 1º lote é o mais em conta e vai até 30/11.` }],
        passo: null,
        lead: { fluxo: "palco", perfil, nota: `Palco: interesse como ${perfil} (Direct)` },
        entregarComPortao: true,
      };
    }
    case "palco.marca": {
      const m = t.match(EMAIL_RE)?.[0];
      if (!m) return { saidas: [{ texto: "Me manda também o e-mail, por favor, para eu enviar as cotas." }], passo: "palco.marca" };
      const empresa = t.replace(m, "").replace(/[,;\-–]+/g, " ").trim().slice(0, 120);
      return {
        saidas: [{ texto: "Anotado! Henrique Magioni te manda as cotas por e-mail hoje mesmo." }],
        passo: null,
        lead: { fluxo: "palco_marca", email: m, empresa, perfil: "marca", nota: `Cotas do Palco: ${empresa}` },
      };
    }

    case "conselho.caso":
      if (t.length < 8) return { saidas: [{ texto: "Me conta um pouco mais: o que você faz com IA e para quem?" }], passo: "conselho.caso" };
      if (d.whatsapp)
        return {
          saidas: [{ texto: `Muito bom. Escolha o horário da conversa de 15 minutos aqui: ${utm("/conselho#candidatura", "conselho")}\n\nSe preferir, a gente te chama no WhatsApp em até 1 dia útil.` }],
          passo: null,
          lead: { fluxo: "conselho", whatsapp: d.whatsapp, nota: `Conselho (Direct): ${t.slice(0, 500)}` },
          entregarComPortao: true,
        };
      return { saidas: [{ texto: "Muito bom. E o seu WhatsApp com DDD? A gente marca 15 minutos para conversar." }], passo: "conselho.wpp", dados: { ...d, caso: t.slice(0, 500) } };
    case "conselho.wpp": {
      const w = whatsapp(t);
      if (!w) return { saidas: [{ texto: "Me manda o número com DDD, por exemplo (31) 99999-0000." }], passo: "conselho.wpp" };
      return {
        saidas: [{ texto: `Recebido! Se quiser, já escolha o horário da conversa aqui: ${utm("/conselho#candidatura", "conselho")}\n\nSe preferir, a gente te chama no WhatsApp em até 1 dia útil.` }],
        passo: null,
        lead: { fluxo: "conselho", whatsapp: w, nota: `Conselho (Direct): ${d.caso}` },
        entregarComPortao: true,
      };
    }

    case "projeto.problema":
      if (t.length < 8) return { saidas: [{ texto: "Me conta um pouco mais: o que você quer resolver na empresa?" }], passo: "projeto.problema" };
      return {
        saidas: [{ texto: "Entendi. Quantas pessoas tem na empresa?", botoes: PORTES.map((x) => ({ titulo: x, payload: `T:${x}` })) }],
        passo: "projeto.porte",
        dados: { ...d, problema: t.slice(0, 800) },
      };
    case "projeto.porte": {
      const porte = p.startsWith("T:") ? p.slice(2) : t.slice(0, 40);
      if (!porte) return null;
      if (d.whatsapp)
        return {
          saidas: [{ texto: "Recebido! Vamos entender o seu caso e apresentar 2 ou 3 especialistas que já fizeram projetos parecidos. A gente te chama no WhatsApp em até 1 dia útil." }],
          passo: null,
          lead: { fluxo: "projeto", whatsapp: d.whatsapp, nota: `Balcão (Direct): ${d.problema} · Porte: ${porte}` },
        };
      return { saidas: [{ texto: "Qual é o seu WhatsApp com DDD? Alguém da IA News te chama em até 1 dia útil." }], passo: "projeto.wpp", dados: { ...d, porte } };
    }
    case "projeto.wpp": {
      const w = whatsapp(t);
      if (!w) return { saidas: [{ texto: "Me manda o número com DDD, por exemplo (31) 99999-0000." }], passo: "projeto.wpp" };
      return {
        saidas: [{ texto: "Recebido! Vamos entender o seu caso e apresentar 2 ou 3 especialistas que já fizeram projetos parecidos. Para você, isso não tem custo." }],
        passo: null,
        lead: { fluxo: "projeto", whatsapp: w, nota: `Balcão (Direct): ${d.problema} · Porte: ${d.porte}` },
      };
    }

    case "anunciar.empresa":
      if (t.length < 2) return null;
      return { saidas: [{ texto: "E o seu melhor e-mail? Mando o mídia kit por lá também." }], passo: "anunciar.email", dados: { ...d, empresa: t.slice(0, 120) } };
    case "anunciar.email": {
      const m = t.match(EMAIL_RE)?.[0];
      if (!m) return { saidas: [{ texto: "Acho que esse e-mail veio incompleto. Pode mandar de novo?" }], passo: "anunciar.email" };
      return {
        saidas: [{ texto: `Aqui está o mídia kit com os formatos: ${utm("/anuncie", "anunciar")}\n\nHenrique Magioni, responsável comercial, te escreve ainda hoje.` }],
        passo: null,
        lead: { fluxo: "anunciar", email: m, empresa: d.empresa, perfil: "marca", nota: `Publicidade (Direct): ${d.empresa}` },
      };
    }

    case "portao": {
      // Respondeu ao pedido para seguir: entrega o que estava guardado, siga ou não
      const pend = (d.pendente ?? []) as Saida[];
      return { saidas: pend, passo: d.pendente_passo ?? null, dados: { ...d, pendente: null, pendente_passo: null, portao_feito: true } };
    }
  }
  return null;
}

function whatsapp(t: string): string | null {
  const dig = t.replace(/\D/g, "");
  const n = dig.startsWith("55") && dig.length >= 12 ? dig.slice(2) : dig;
  return n.length === 10 || n.length === 11 ? `(${n.slice(0, 2)}) ${n.slice(2, n.length - 4)}-${n.slice(-4)}` : null;
}

async function materiasDoSetor(db: any, termos: string[]): Promise<{ title: string; slug: string }[]> {
  let q = db
    .from("articles")
    .select("title, slug")
    .lte("published_at", new Date().toISOString())
    .not("published_at", "is", null)
    .order("published_at", { ascending: false })
    .limit(3);
  if (termos.length) q = q.or(termos.map((x) => `title.ilike.%${x}%,category.ilike.%${x}%,dek.ilike.%${x}%`).join(","));
  const { data } = await q;
  return (data ?? []) as { title: string; slug: string }[];
}

async function inscreverAula(db: any, c: Conversa, email: string, w: string) {
  const row = {
    tipo: "aula",
    nome: c.nome || c.username || "Contato do Instagram",
    whatsapp: w,
    email: email.toLowerCase(),
    perfil: null,
    dados: { aula: AULA.inicio, instagram: c.username ? `@${c.username}` : null },
    consentimento: true,
    origem_path: "instagram_direct",
    utm_source: "instagram",
    utm_medium: "direct",
    utm_campaign: "minichat-aula",
    device: "celular",
  };
  const ja = await db.from("site_inscricoes").select("id", { count: "exact", head: true }).eq("tipo", "aula").eq("status", "recebido").ilike("email", row.email);
  if ((ja.count ?? 0) > 0) return;
  const { error } = await db.from("site_inscricoes").insert(row);
  if (error) throw new Error(`aula: ${error.message}`);
  try {
    const { sendTemplateEmail } = await import("@/lib/email-templates/send-email");
    await sendTemplateEmail("inscricao-confirmation", row.email, {
      templateData: { tipo: "aula", nome: row.nome },
      replyTo: "ianewscomercial@gmail.com",
    });
  } catch {
    /* e-mail é bônus; a inscrição já está no CRM */
  }
}

/* ---------------- Motor ---------------- */

/** Palavra-chave na mensagem. Comentário: vale em qualquer posição das 8 primeiras palavras.
    Direct: só a mensagem inteira (ou até 3 palavras), e durante uma pergunta em andamento só a palavra exata,
    para que uma resposta como "agentes de atendimento" não vire pedido de atendimento. */
async function palavraDe(db: any, texto: string, mediaId: string | null | undefined, modo: "comentario" | "direct" | "resposta"): Promise<string | null> {
  const todos = norm(texto).split(/\s+/).filter(Boolean);
  if (!todos.length) return null;
  if (modo === "resposta" && todos.length > 1) return null;
  if (modo === "direct" && todos.length > 3) return null;
  const tokens = modo === "comentario" ? todos.slice(0, 8) : todos;
  const juntos = tokens.join("");
  const { data } = await db.from("ig_palavras").select("palavra, fluxo, media_id").eq("ativo", true);
  const lista = (data ?? []) as { palavra: string; fluxo: string; media_id: string | null }[];
  const candidatas = [...lista.filter((l) => l.media_id && l.media_id === mediaId), ...lista.filter((l) => !l.media_id)];
  for (const l of candidatas) if (tokens.includes(l.palavra) || juntos === l.palavra) return l.fluxo;
  return null;
}

/** Lead já em conversa comercial ou cliente: o robô não interrompe, passa para a Renata. */
async function emConversa(db: any, username: string | null): Promise<boolean> {
  if (!username) return false;
  const { data } = await db.rpc("ig_em_conversa", { p_username: username });
  return data === true;
}

async function salvar(db: any, c: Conversa) {
  await db.from("ig_conversas").upsert({ ...c, updated_at: new Date().toISOString(), ultima_entrada: new Date().toISOString() });
}

export async function processar(db: any, canal: Canal, e: Entrada): Promise<{ fluxo: string | null; saidas: Saida[]; nota?: string }> {
  const { data: atual } = await db.from("ig_conversas").select("*").eq("igsid", e.igsid).maybeSingle();
  const c: Conversa = atual ?? {
    igsid: e.igsid, username: e.username ?? null, nome: null, pessoa_id: null, fluxo: null, passo: null,
    dados: {}, pontos: 0, segue: null, humano_ate: null, optout: false, menu_em: null,
  };
  if (e.username && !c.username) c.username = e.username;

  // Nome e se segue: só disponível depois que a pessoa falou no Direct
  if (e.tipo !== "comentario" && (!c.nome || c.segue !== true)) {
    const pf = await canal.perfil(e.igsid).catch(() => null);
    if (pf) {
      c.nome = c.nome ?? pf.name ?? null;
      c.username = c.username ?? pf.username ?? null;
      if (typeof pf.segue === "boolean") c.segue = pf.segue;
    }
  }

  const texto = e.texto ?? "";
  const fluxoPalavra = e.payload?.startsWith("F:")
    ? e.payload.slice(2)
    : await palavraDe(db, texto, e.mediaId, e.tipo === "comentario" ? "comentario" : c.passo ? "resposta" : "direct");
  const agora = Date.now();

  if (fluxoPalavra === "sair") {
    c.optout = true;
    c.fluxo = null;
    c.passo = null;
    const r = abertura("sair", c);
    await enviar(canal, e, r.saidas);
    await salvar(db, c);
    return { fluxo: "sair", saidas: r.saidas };
  }
  if (c.optout && !fluxoPalavra) return { fluxo: null, saidas: [], nota: "optout" };
  if (c.optout && fluxoPalavra) c.optout = false;

  // Em atendimento humano: o robô só volta se a pessoa usar uma palavra-chave
  if (c.humano_ate && Date.parse(c.humano_ate) > agora && !fluxoPalavra) {
    await salvar(db, c);
    return { fluxo: "humano", saidas: [], nota: "em atendimento humano" };
  }

  let r: Resultado | null = null;
  let fluxo = c.fluxo;

  // 1. Resposta a um passo em andamento (só no Direct)
  if (e.tipo === "mensagem" && c.passo && !fluxoPalavra) {
    // Resposta numérica aos botões (quando o Instagram não mostrou os botões)
    if (/^\s*\d{1,2}\s*$/.test(texto) && Array.isArray(c.dados.botoes)) {
      const b = c.dados.botoes[Number(texto.trim()) - 1] as Botao | undefined;
      if (b) e = { ...e, payload: b.payload };
    }
    if (c.passo === "menu" && e.payload?.startsWith("F:")) fluxo = e.payload.slice(2);
    r = await continuar(db, c, e);
  }

  // 2. Palavra-chave: começa o fluxo
  if (!r && fluxoPalavra) {
    fluxo = fluxoPalavra;
    // O mesmo fluxo em menos de 7 dias: manda direto o atalho do menu, sem refazer perguntas já respondidas
    r = abertura(fluxoPalavra, c);
    // Guarda o que já sabemos da pessoa entre fluxos, para não perguntar de novo
    const d0 = c.dados ?? {};
    c.dados = { pontos_por: d0.pontos_por ?? {}, email: d0.email, whatsapp: d0.whatsapp, setor: d0.setor };
  }

  // 3. Mensagem solta
  if (!r && e.tipo !== "comentario") {
    const ocupado = await emConversa(db, c.username);
    const menuRecente = c.menu_em && agora - Date.parse(c.menu_em) < 24 * 3600 * 1000;
    const pergunta = texto.includes("?") || texto.trim().split(/\s+/).length >= 6;
    if (ocupado || menuRecente || pergunta || e.tipo === "mencao") {
      if (e.tipo === "mencao") {
        r = { saidas: [{ texto: `${oi(c)} Obrigada por marcar a IA News! Se quiser, posso te ajudar com alguma destas:`, botoes: MENU }], passo: "menu" };
        fluxo = "menu";
      } else {
        fluxo = "humano";
        r = abertura("humano", c);
        if (r.lead) r.lead.nota = `Mensagem: ${texto.slice(0, 400)}`;
      }
    } else {
      fluxo = "menu";
      r = abertura("menu", c);
    }
  }
  if (!r) return { fluxo: null, saidas: [], nota: "sem ação" };

  // Pedido para seguir antes de entregar o que foi prometido
  let saidas = r.saidas;
  let passo = r.passo;
  let dados = { ...(c.dados ?? {}), ...(r.dados ?? {}) };
  if (r.entregarComPortao && c.segue === false && !dados.portao_feito) {
    dados = { ...dados, pendente: saidas, pendente_passo: passo };
    saidas = [
      {
        texto: "Antes, uma coisa rápida: você já segue a @ianews.co? É por lá que saem as matérias e os convites.",
        botoes: [
          { titulo: "Já sigo", payload: "G:ok" },
          { titulo: "Vou seguir agora", payload: "G:ok" },
        ],
      },
    ];
    passo = "portao";
  }

  // Botões da última mensagem ficam guardados para a resposta numérica
  const ultima = saidas[saidas.length - 1];
  dados.botoes = ultima?.botoes ?? null;

  await enviar(canal, e, saidas);

  // Lead no CRM
  if (r.lead) {
    const lead = { ...dados, ...r.lead, igsid: c.igsid, username: c.username, nome: c.nome, pessoa_id: c.pessoa_id };
    const { data: res, error } = await db.rpc("ig_lead_crm", { p: lead });
    if (error) console.error("[minichat] crm", error.message);
    else if (res?.pessoa_id) c.pessoa_id = res.pessoa_id;
    if (r.lead.email) dados.email = r.lead.email;
    if (r.lead.whatsapp) dados.whatsapp = r.lead.whatsapp;
  }

  const f = fluxo ?? "menu";
  const ja = (dados.pontos_por ?? {}) as Record<string, boolean>;
  if (!ja[f] && PONTOS[f]) {
    c.pontos += PONTOS[f];
    dados.pontos_por = { ...ja, [f]: true };
  }
  c.fluxo = passo ? f : null;
  c.passo = passo;
  c.dados = dados;
  if (f === "menu") c.menu_em = new Date().toISOString();
  if (f === "humano") c.humano_ate = new Date(agora + 24 * 3600 * 1000).toISOString();
  await salvar(db, c);
  return { fluxo: f, saidas };
}

async function enviar(canal: Canal, e: Entrada, saidas: Saida[]) {
  for (const [i, s] of saidas.entries()) {
    if (i === 0 && e.tipo === "comentario" && e.comentarioId) {
      await canal.respostaPrivada(e.comentarioId, s);
    } else {
      if (i > 0) await canal.pausa(1200);
      await canal.direct(e.igsid, s);
    }
    // Comentário só permite UMA resposta privada: o resto espera a pessoa responder
    if (e.tipo === "comentario") break;
  }
}

const RESPOSTAS_PUBLICAS = ["Te mandei no Direct!", "Acabei de te enviar, confere lá", "Chegou no seu Direct!", "Enviado no Direct, dá uma olhada"];
export const respostaPublica = () => RESPOSTAS_PUBLICAS[Math.floor(Math.random() * RESPOSTAS_PUBLICAS.length)];

/* ---------------- Canal real (Graph API) ---------------- */

const GRAPH = `https://${process.env.META_GRAPH_HOST ?? "graph.facebook.com"}/${process.env.META_GRAPH_VERSION ?? "v21.0"}`;

function corpoMensagem(s: Saida, comBotoes: boolean) {
  if (comBotoes && s.botoes?.length) {
    return {
      text: s.texto,
      quick_replies: s.botoes.slice(0, 13).map((b) => ({ content_type: "text", title: b.titulo.slice(0, 20), payload: b.payload })),
    };
  }
  const lista = s.botoes?.length ? `\n\n${s.botoes.map((b, i) => `${i + 1}. ${b.titulo}`).join("\n")}\n\nResponda com o número.` : "";
  return { text: `${s.texto}${lista}`.slice(0, 1000) };
}

async function graphPost(path: string, body: unknown) {
  const res = await fetch(`${GRAPH}/${path}`, {
    method: "POST",
    headers: { "content-type": "application/json", Authorization: `Bearer ${process.env.INSTAGRAM_TOKEN}` },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`${res.status} ${(await res.text()).slice(0, 300)}`);
}

export const canalInstagram: Canal = {
  async respostaPrivada(comentarioId, s) {
    try {
      await graphPost(`${process.env.INSTAGRAM_USER_ID}/messages`, { recipient: { comment_id: comentarioId }, message: corpoMensagem(s, true) });
    } catch {
      await graphPost(`${process.env.INSTAGRAM_USER_ID}/messages`, { recipient: { comment_id: comentarioId }, message: corpoMensagem(s, false) });
    }
  },
  async direct(igsid, s) {
    try {
      await graphPost(`${process.env.INSTAGRAM_USER_ID}/messages`, { recipient: { id: igsid }, message: corpoMensagem(s, true) });
    } catch {
      await graphPost(`${process.env.INSTAGRAM_USER_ID}/messages`, { recipient: { id: igsid }, message: corpoMensagem(s, false) });
    }
  },
  async responderComentario(comentarioId, texto) {
    await graphPost(`${comentarioId}/replies`, { message: texto });
  },
  async perfil(igsid) {
    const res = await fetch(`${GRAPH}/${igsid}?fields=name,username,is_user_follow_business`, {
      headers: { Authorization: `Bearer ${process.env.INSTAGRAM_TOKEN}` },
    });
    if (!res.ok) return null;
    const j = (await res.json()) as { name?: string; username?: string; is_user_follow_business?: boolean };
    return { name: j.name, username: j.username, segue: j.is_user_follow_business };
  },
  pausa: (ms) => new Promise((r) => setTimeout(r, ms)),
};
