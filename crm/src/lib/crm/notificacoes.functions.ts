import { createServerFn } from "@tanstack/react-start";

import { checar, requireCrmAccess, texto } from "./access";

/* Avisos do CRM: sino com as novidades (vendas, pautas, material, matéria no ar, resumos do dia)
   e o push no celular. O banco cria os avisos; o site entrega o push a cada minuto. */

export type Aviso = {
  id: string;
  tipo: string;
  titulo: string;
  corpo: string;
  url: string;
  criado_em: string;
  lido_em: string | null;
};

/** Tabela ainda não criada no banco (o CRM segue funcionando sem os avisos). */
const semTabela = (e: { code?: string; message?: string } | null) =>
  !!e &&
  (e.code === "42P01" ||
    e.code === "PGRST205" ||
    /does not exist|schema cache/i.test(e.message ?? ""));

export const getAvisos = createServerFn({ method: "GET" })
  .middleware([requireCrmAccess])
  .handler(
    async ({ context }): Promise<{ disponivel: boolean; naoLidos: number; itens: Aviso[] }> => {
      const { data, error } = await context.db
        .from("crm_notificacoes")
        .select("id, tipo, titulo, corpo, url, criado_em, lido_em")
        .order("criado_em", { ascending: false })
        .limit(40);
      if (semTabela(error)) return { disponivel: false, naoLidos: 0, itens: [] };
      const itens = (checar({ data, error }) ?? []) as Aviso[];
      return { disponivel: true, naoLidos: itens.filter((a) => !a.lido_em).length, itens };
    },
  );

export const marcarAvisosLidos = createServerFn({ method: "POST" })
  .middleware([requireCrmAccess])
  .inputValidator((input: { ids?: string[] }) => ({
    ids: Array.isArray(input?.ids)
      ? input.ids.filter((x) => typeof x === "string" && /^[0-9a-f-]{36}$/i.test(x)).slice(0, 100)
      : [],
  }))
  .handler(async ({ data, context }) => {
    let q = context.db
      .from("crm_notificacoes")
      .update({ lido_em: new Date().toISOString() })
      .is("lido_em", null);
    if (data.ids.length) q = q.in("id", data.ids);
    const { error } = await q;
    if (semTabela(error)) return { ok: false };
    checar({ data: null, error });
    return { ok: true };
  });

export const getPushConfig = createServerFn({ method: "GET" })
  .middleware([requireCrmAccess])
  .handler(
    async ({
      context,
    }): Promise<{ disponivel: boolean; vapid: string | null; aparelhos: number }> => {
      const [chave, insc] = await Promise.all([
        context.db
          .from("crm_config_publica")
          .select("valor")
          .eq("chave", "vapid_public_key")
          .maybeSingle(),
        context.db
          .from("crm_push_inscricoes")
          .select("id", { count: "exact", head: true })
          .eq("user_id", context.userId)
          .eq("ativo", true),
      ]);
      if (semTabela(chave.error) || semTabela(insc.error))
        return { disponivel: false, vapid: null, aparelhos: 0 };
      const vapid = (chave.data as { valor?: string } | null)?.valor ?? null;
      return { disponivel: true, vapid, aparelhos: insc.count ?? 0 };
    },
  );

const B64URL = /^[A-Za-z0-9_-]+={0,2}$/;

/** Só aceita endereços dos serviços de push dos navegadores (Apple, Google, Mozilla, Microsoft):
 *  o servidor do site faz POST nesses endereços, então nada de URL livre. */
function servicoDePushConhecido(endpoint: string) {
  try {
    const u = new URL(endpoint);
    if (u.protocol !== "https:" || u.port) return false;
    const h = u.hostname.toLowerCase();
    return (
      h === "fcm.googleapis.com" ||
      h === "android.googleapis.com" ||
      h === "web.push.apple.com" ||
      h.endsWith(".push.apple.com") ||
      h.endsWith(".push.services.mozilla.com") ||
      h.endsWith(".notify.windows.com")
    );
  } catch {
    return false;
  }
}

export const salvarPush = createServerFn({ method: "POST" })
  .middleware([requireCrmAccess])
  .inputValidator(
    (input: { endpoint: string; p256dh: string; auth: string; aparelho?: string }) => {
      const endpoint = texto(input?.endpoint, 1000) ?? "";
      if (!servicoDePushConhecido(endpoint)) throw new Error("Inscrição inválida.");
      const p256dh = texto(input?.p256dh, 200) ?? "";
      const auth = texto(input?.auth, 100) ?? "";
      if (!B64URL.test(p256dh) || !B64URL.test(auth)) throw new Error("Inscrição inválida.");
      return { endpoint, p256dh, auth, aparelho: texto(input?.aparelho, 120) };
    },
  )
  .handler(async ({ data, context }) => {
    checar(
      await context.db.from("crm_push_inscricoes").upsert(
        {
          user_id: context.userId,
          endpoint: data.endpoint,
          p256dh: data.p256dh,
          auth: data.auth,
          aparelho: data.aparelho,
          ativo: true,
          falhas: 0,
        },
        { onConflict: "endpoint" },
      ),
    );
    return { ok: true };
  });

export const removerPush = createServerFn({ method: "POST" })
  .middleware([requireCrmAccess])
  .inputValidator((input: { endpoint: string }) => ({
    endpoint: texto(input?.endpoint, 1000) ?? "",
  }))
  .handler(async ({ data, context }) => {
    checar(
      await context.db
        .from("crm_push_inscricoes")
        .delete()
        .eq("user_id", context.userId)
        .eq("endpoint", data.endpoint),
    );
    return { ok: true };
  });

export const testarPush = createServerFn({ method: "POST" })
  .middleware([requireCrmAccess])
  .handler(async ({ context }) => {
    checar(await context.db.rpc("crm_notificacao_teste"));
    return { ok: true };
  });
