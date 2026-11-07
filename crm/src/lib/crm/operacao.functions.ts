import { createServerFn } from "@tanstack/react-start";

import { checar, dia, exigirAdmin, requireCrmAccess, texto, uuidObrigatorio } from "./access";

/* Operação automática: lista diária de leads, produções (destaques) e painel de métricas. */

export type ListaItem = {
  id: string;
  dia: string;
  posicao: number;
  prioridade: number;
  bloco: string;
  funil_id: string | null;
  negocio_id: string | null;
  empresa_id: string | null;
  pessoa_id: string | null;
  nota: number | null;
  canal: string | null;
  motivo: string | null;
  status: "listado" | "na_fila" | "contatado" | "respondeu" | "descartado";
  pessoa_nome: string | null;
  empresa_nome: string | null;
  instagram: string | null;
  email: string | null;
  linkedin: string | null;
};

export type ListaResumo = {
  dia: string;
  total: number;
  por_bloco: Record<string, number>;
  por_status: Record<string, number>;
  por_canal: Record<string, number>;
};

export const listLista = createServerFn({ method: "GET" })
  .middleware([requireCrmAccess])
  .inputValidator((input: { dia?: string | null }) => ({ dia: dia(input?.dia) }))
  .handler(async ({ data, context }): Promise<{ itens: ListaItem[]; resumo: ListaResumo }> => {
    const { db } = context;
    const resumo = checar(await db.rpc("auto_lista_resumo", { p_dia: data.dia })) as ListaResumo;
    const rows = checar(
      await db
        .from("auto_lista_diaria")
        .select(
          "*, pessoa:crm_pessoas(nome, instagram, email, linkedin), empresa:crm_empresas(nome, instagram, linkedin)",
        )
        .eq("dia", resumo.dia)
        .order("posicao")
        .limit(400),
    ) as (ListaItem & {
      pessoa: {
        nome: string;
        instagram: string | null;
        email: string | null;
        linkedin: string | null;
      } | null;
      empresa: { nome: string; instagram: string | null; linkedin: string | null } | null;
    })[];
    return {
      resumo,
      itens: rows.map(({ pessoa, empresa, ...r }) => ({
        ...r,
        pessoa_nome: pessoa?.nome ?? null,
        empresa_nome: empresa?.nome ?? null,
        instagram: pessoa?.instagram ?? empresa?.instagram ?? null,
        email: pessoa?.email ?? null,
        linkedin: pessoa?.linkedin ?? empresa?.linkedin ?? null,
      })),
    };
  });

export const montarLista = createServerFn({ method: "POST" })
  .middleware([requireCrmAccess])
  .handler(async ({ context }) => {
    const res = checar(await context.db.rpc("auto_montar_lista", {})) as {
      ok?: boolean;
      total?: number;
      blocos?: Record<string, number>;
    };
    // A lista refeita apaga o bloco do Palco IA News (montado às 7h05); remonta com a chave de serviço,
    // porque a função do Palco não é exposta a usuários. O acesso já foi conferido pelo requireCrmAccess.
    try {
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
      const palco = checar(await (supabaseAdmin as any).rpc("palco_lista_do_dia", {})) as { palco?: number };
      if (palco?.palco) {
        res.total = (res.total ?? 0) + palco.palco;
        res.blocos = { ...(res.blocos ?? {}), "Palco IA News": palco.palco };
      }
    } catch (err) {
      console.error("[lista] palco_lista_do_dia", err instanceof Error ? err.message : err);
    }
    return res;
  });

export const descartarDaLista = createServerFn({ method: "POST" })
  .middleware([requireCrmAccess])
  .inputValidator((input: { id: string; voltar?: boolean }) => ({
    id: uuidObrigatorio(input?.id, "o item da lista"),
    voltar: input?.voltar === true,
  }))
  .handler(async ({ data, context }) => {
    return checar(
      await context.db
        .from("auto_lista_diaria")
        .update({ status: data.voltar ? "listado" : "descartado" })
        .eq("id", data.id)
        .select("id"),
    );
  });

export type Producao = {
  id: string;
  status: string;
  versao: number;
  data_publicacao: string | null;
  publicado_em: string | null;
  social_url: string | null;
  telas: string[];
  capa_url: string | null;
  collabs: string[];
  erro: string | null;
  updated_at: string;
  titulo: string | null;
  legenda: string | null;
  token: string;
  briefing_status: string;
  tipo: string;
  ajuste_pedido: string | null;
  slug: string | null;
  pessoa: string | null;
  empresa: string | null;
  negocio_id: string | null;
};

export const listProducoes = createServerFn({ method: "GET" })
  .middleware([requireCrmAccess])
  .handler(async ({ context }): Promise<Producao[]> => {
    return checar(
      await context.db
        .from("auto_producoes_painel")
        .select("*")
        .order("updated_at", { ascending: false })
        .limit(200),
    ) as Producao[];
  });

export const registrarLinkPost = createServerFn({ method: "POST" })
  .middleware([requireCrmAccess])
  .inputValidator((input: { id: string; url: string }) => {
    const url = texto(input?.url, 500) ?? "";
    if (!/^https:\/\/(www\.)?instagram\.com\//.test(url))
      throw new Error("Cole o link do post no Instagram.");
    return { id: uuidObrigatorio(input?.id, "a produção"), url };
  })
  .handler(async ({ data, context }) => {
    return checar(
      await context.db.rpc("auto_producao_link", { p_producao: data.id, p_url: data.url }),
    );
  });

export const briefingsAguardando = createServerFn({ method: "GET" })
  .middleware([requireCrmAccess])
  .handler(async ({ context }) => {
    return checar(
      await context.db
        .from("auto_briefings")
        .select(
          "id, status, tipo, enviado_em, created_at, token, pessoa:crm_pessoas(nome), empresa:crm_empresas(nome)",
        )
        .in("status", ["aberto", "enviado", "em_producao", "ajuste"])
        .order("enviado_em", { ascending: false, nullsFirst: false })
        .limit(100),
    ) as unknown as {
      id: string;
      status: string;
      tipo: string;
      enviado_em: string | null;
      created_at: string;
      token: string;
      pessoa: { nome: string } | null;
      empresa: { nome: string } | null;
    }[];
  });

export type Metricas = {
  hoje: string;
  dias: {
    dia: string;
    futuro: boolean;
    materias: number;
    de_instagram: number;
    de_newsletter: number;
    rascunhos: number;
    sem_capa: number;
    agenda: { hora: string; titulo: string; slug: string }[];
    posts: Record<string, number>;
    newsletter: { envios: number; destinatarios: number; entregues: number };
    fila: {
      primeiros: number;
      followups: number;
      enviados: number;
      respondeu: number;
      por_canal: Record<string, number>;
    };
    briefings: { criados: number; enviados: number; aprovados: number };
    negocios: { total: number; por_funil: Record<string, number> };
    lista: { total: number; contatados: number; responderam: number };
  }[];
  totais: {
    materias_publicadas: number;
    materias_agendadas: number;
    rascunhos: number;
    assinantes_ativos: number;
    negocios_abertos: number;
    briefings_aguardando: number;
    previas_aguardando: number;
    empresas: number;
    pessoas: number;
  };
};

export const painelOperacao = createServerFn({ method: "GET" })
  .middleware([requireCrmAccess])
  .inputValidator((input: { dias?: number; futuro?: number }) => ({
    dias: Math.min(Math.max(Number(input?.dias ?? 14) || 14, 7), 60),
    futuro: Math.min(Math.max(Number(input?.futuro ?? 30) || 30, 0), 60),
  }))
  .handler(async ({ data, context }): Promise<Metricas> => {
    return checar(
      await context.db.rpc("auto_metricas", { p_dias: data.dias, p_futuro: data.futuro }),
    ) as Metricas;
  });

export const salvarConfigLista = createServerFn({ method: "POST" })
  .middleware([requireCrmAccess])
  .inputValidator(
    (input: {
      lista_tamanho?: number;
      lista_nota_minima?: number;
      horario_destaque_lead?: string;
    }) => input ?? {},
  )
  .handler(async ({ data, context }) => {
    exigirAdmin(context.isAdmin);
    const { db } = context;
    const salvar = async (chave: string, valor: unknown) =>
      checar(
        await db
          .from("auto_config")
          .update({ valor, updated_at: new Date().toISOString() })
          .eq("chave", chave)
          .select("chave"),
      );
    if (data.lista_tamanho !== undefined)
      await salvar("lista_tamanho", Math.min(Math.max(Math.round(data.lista_tamanho), 20), 500));
    if (data.lista_nota_minima !== undefined)
      await salvar(
        "lista_nota_minima",
        Math.min(Math.max(Math.round(data.lista_nota_minima), 0), 100),
      );
    if (data.horario_destaque_lead && /^\d{2}:\d{2}$/.test(data.horario_destaque_lead))
      await salvar("horario_destaque_lead", data.horario_destaque_lead);
    return { ok: true };
  });

export type Carrossel = {
  id: string;
  status: string;
  telas: string[];
  legenda: string | null;
  collabs: string[];
  publicar_api: boolean;
  social_url: string | null;
  publicado_em: string | null;
  erro: string | null;
  article: { slug: string; title: string; published_at: string } | null;
};

export const listCarrosseis = createServerFn({ method: "GET" })
  .middleware([requireCrmAccess])
  .handler(async ({ context }): Promise<Carrossel[]> => {
    return checar(
      await context.db
        .from("auto_carrosseis")
        .select(
          "id, status, telas, legenda, collabs, publicar_api, social_url, publicado_em, erro, article:articles(slug, title, published_at)",
        )
        .order("created_at", { ascending: false })
        .limit(60),
    ) as unknown as Carrossel[];
  });

export const salvarConfigInstagram = createServerFn({ method: "POST" })
  .middleware([requireCrmAccess])
  .inputValidator((input: { publicar_api: boolean }) => ({
    publicar_api: input?.publicar_api === true,
  }))
  .handler(async ({ data, context }) => {
    exigirAdmin(context.isAdmin);
    checar(
      await context.db
        .from("auto_config")
        .update({ valor: data.publicar_api, updated_at: new Date().toISOString() })
        .eq("chave", "instagram_api_publicar")
        .select("chave"),
    );
    // Vale também para os carrosséis já prontos e ainda não publicados
    checar(
      await context.db
        .from("auto_carrosseis")
        .update({ publicar_api: data.publicar_api })
        .eq("status", "pronto")
        .select("id"),
    );
    return { ok: true };
  });

export const configInstagram = createServerFn({ method: "GET" })
  .middleware([requireCrmAccess])
  .handler(async ({ context }) => {
    const rows = checar(
      await context.db
        .from("auto_config")
        .select("chave, valor")
        .in("chave", ["instagram_api_publicar"]),
    ) as { chave: string; valor: unknown }[];
    return { publicar_api: rows.find((r) => r.chave === "instagram_api_publicar")?.valor === true };
  });
