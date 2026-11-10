import { createServerFn } from "@tanstack/react-start";

import { checar, exigirAdmin, requireCrmAccess, texto } from "./access";

/* Mini chat da Renata no Direct do Instagram: conversas, palavras-chave e registro de eventos. */

export type ConversaDirect = {
  igsid: string;
  username: string | null;
  nome: string | null;
  pessoa_id: string | null;
  fluxo: string | null;
  passo: string | null;
  pontos: number;
  segue: boolean | null;
  humano_ate: string | null;
  optout: boolean;
  dados: { email?: string; whatsapp?: string; setor?: string };
  updated_at: string;
};

export type EventoDirect = {
  id: number;
  created_at: string;
  igsid: string | null;
  tipo: string | null;
  texto: string | null;
  fluxo: string | null;
  resultado: string | null;
  erro: string | null;
};

export type PalavraDirect = { palavra: string; fluxo: string; media_id: string | null; ativo: boolean };

export const FLUXOS = ["noticias", "radar", "lista", "aula", "palco", "conselho", "projeto", "anunciar", "pauta", "menu", "humano", "sair"] as const;

export const painelDirect = createServerFn({ method: "GET" })
  .middleware([requireCrmAccess])
  .handler(async ({ context }): Promise<{ conversas: ConversaDirect[]; eventos: EventoDirect[]; palavras: PalavraDirect[]; resumo: Record<string, number> }> => {
    const { db } = context;
    const brutas = checar(
      await db.from("ig_conversas").select("*").order("updated_at", { ascending: false }).limit(150),
    ) as (Omit<ConversaDirect, "dados"> & { dados: Record<string, any> | null })[];
    const conversas: ConversaDirect[] = brutas.map((c) => ({
      ...c,
      dados: { email: c.dados?.email ?? undefined, whatsapp: c.dados?.whatsapp ?? undefined, setor: c.dados?.setor ?? undefined },
    }));
    const eventos = checar(
      await db.from("ig_eventos").select("*").order("created_at", { ascending: false }).limit(80),
    ) as EventoDirect[];
    const palavras = checar(await db.from("ig_palavras").select("*").order("fluxo").order("palavra")) as PalavraDirect[];
    const desde = new Date(Date.now() - 7 * 864e5).toISOString();
    const semana = eventos.filter((e) => e.created_at >= desde);
    return {
      conversas,
      eventos,
      palavras,
      resumo: {
        conversas: conversas.length,
        semana: semana.length,
        erros: semana.filter((e) => e.erro).length,
        humano: conversas.filter((c) => c.humano_ate && Date.parse(c.humano_ate) > Date.now()).length,
        com_contato: conversas.filter((c) => c.dados?.email || c.dados?.whatsapp).length,
      },
    };
  });

export const salvarPalavra = createServerFn({ method: "POST" })
  .middleware([requireCrmAccess])
  .inputValidator((input: { palavra: string; fluxo: string; media_id?: string | null; ativo?: boolean }) => {
    const palavra = (texto(input?.palavra, 30) ?? "")
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "")
      .toUpperCase()
      .replace(/[^A-Z0-9]/g, "");
    if (palavra.length < 2) throw new Error("Use uma palavra com pelo menos 2 letras.");
    if (!(FLUXOS as readonly string[]).includes(input?.fluxo)) throw new Error("Escolha o fluxo.");
    const media = texto(input?.media_id ?? null, 60);
    return { palavra, fluxo: input.fluxo, media_id: media && /^\d{5,}$/.test(media) ? media : null, ativo: input?.ativo !== false };
  })
  .handler(async ({ data, context }) => {
    exigirAdmin(context.isAdmin);
    return checar(await context.db.from("ig_palavras").upsert(data).select("palavra"));
  });

export const liberarRobo = createServerFn({ method: "POST" })
  .middleware([requireCrmAccess])
  .inputValidator((input: { igsid: string }) => ({ igsid: texto(input?.igsid, 60) ?? "" }))
  .handler(async ({ data, context }) => {
    // A Renata terminou o atendimento: o robô volta a responder essa pessoa
    return checar(
      await context.db.from("ig_conversas").update({ humano_ate: null, fluxo: null, passo: null }).eq("igsid", data.igsid).select("igsid"),
    );
  });
