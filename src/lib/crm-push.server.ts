import { ApplicationServerKeys, generatePushHTTPRequest } from "webpush-webcrypto";

/* Entrega dos avisos do CRM interno (vendas, pautas, material, resumos do dia) como push no
   celular da equipe. O banco cria os avisos e chama este gancho; as chaves VAPID são as mesmas
   do push do site (ficam só no servidor). O CRM é outro domínio: o clique abre a tela certa lá. */

const CRM_URL = "https://ianews-crm.vercel.app";
const PAPEIS_EQUIPE = ["admin", "comercial", "editorial", "editor"];

type Aviso = {
  id: string;
  user_id: string | null;
  publico: "admin" | "equipe" | "usuario";
  tipo: string;
  titulo: string;
  corpo: string;
  url: string;
  urgente: boolean;
};

type Inscricao = {
  id: string;
  user_id: string;
  endpoint: string;
  p256dh: string;
  auth: string;
  falhas: number;
};

/** O envio é um POST do servidor: só para os serviços de push dos navegadores. */
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

async function chaves() {
  const publicKey = process.env["VAPID_PUBLIC_KEY"];
  const privateKey = process.env["VAPID_PRIVATE_KEY"];
  if (!publicKey || !privateKey) throw new Error("Chaves VAPID não configuradas.");
  return { publicKey, keys: await ApplicationServerKeys.fromJSON({ publicKey, privateKey }) };
}

/** Vários avisos do mesmo tipo no mesmo minuto viram um só (ex.: 5 vendas de uma vez). */
function agrupar(avisos: Aviso[]): Aviso[] {
  const porTipo = new Map<string, Aviso[]>();
  for (const a of avisos) {
    const k = `${a.tipo}|${a.publico}|${a.user_id ?? ""}`;
    porTipo.set(k, [...(porTipo.get(k) ?? []), a]);
  }
  const saida: Aviso[] = [];
  for (const grupo of porTipo.values()) {
    if (grupo.length <= 3) {
      saida.push(...grupo);
      continue;
    }
    const base = grupo[0]!;
    const nomes: Record<string, string> = {
      venda: "vendas confirmadas",
      fechado: "negócios fechados",
      pauta: "pautas novas",
      contato: "contatos novos pelo site",
      material: "materiais recebidos",
      previa: "prévias aprovadas",
      publicada: "matérias no ar",
    };
    saida.push({
      ...base,
      titulo: `${grupo.length} ${nomes[base.tipo] ?? "avisos novos"}`,
      corpo: grupo
        .slice(0, 4)
        .map((g) => g.titulo.replace(/^[^:·]+[:·]\s*/, ""))
        .join(" · "),
    });
  }
  return saida;
}

export async function entregarAvisosCrm() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = supabaseAdmin as any;
  const { publicKey, keys } = await chaves();

  // O CRM lê a chave pública daqui para inscrever os aparelhos.
  await db.from("crm_config_publica").upsert({
    chave: "vapid_public_key",
    valor: publicKey,
    atualizado_em: new Date().toISOString(),
  });

  const { data: pegos, error } = await db.rpc("crm_reivindicar_notificacoes", { p_limite: 40 });
  if (error) throw new Error(error.message);
  const avisos = (pegos ?? []) as Aviso[];
  if (!avisos.length) return { ok: true, avisos: 0, entregues: 0 };

  const [{ data: insc }, { data: papeis }] = await Promise.all([
    db
      .from("crm_push_inscricoes")
      .select("id, user_id, endpoint, p256dh, auth, falhas")
      .eq("ativo", true)
      .limit(300),
    db.from("user_roles").select("user_id, role").in("role", PAPEIS_EQUIPE),
  ]);
  const inscricoes = ((insc ?? []) as Inscricao[]).filter((i) =>
    servicoDePushConhecido(i.endpoint),
  );
  const roles = (papeis ?? []) as { user_id: string; role: string }[];
  const admins = new Set(roles.filter((r) => r.role === "admin").map((r) => r.user_id));
  const equipe = new Set(roles.map((r) => r.user_id));
  const contato = process.env["VAPID_CONTACT_EMAIL"] ?? "contato@ianewsbr.com";

  let entregues = 0;
  const mortas = new Set<string>();
  const falhas = new Map<string, number>();
  const usadas = new Set<string>();

  for (const a of agrupar(avisos)) {
    const alvo = inscricoes.filter((i) =>
      a.publico === "usuario"
        ? i.user_id === a.user_id
        : a.publico === "admin"
          ? admins.has(i.user_id)
          : equipe.has(i.user_id),
    );
    let ok = 0;
    const payload = JSON.stringify({
      title: a.titulo,
      body: a.corpo,
      url: `${CRM_URL}${a.url.startsWith("/") ? a.url : "/"}`,
      tag: `crm-${a.tipo}-${a.id}`,
      urgente: a.urgente,
    });
    for (const i of alvo) {
      try {
        const req = await generatePushHTTPRequest({
          applicationServerKeys: keys,
          payload,
          target: { endpoint: i.endpoint, keys: { p256dh: i.p256dh, auth: i.auth } },
          adminContact: contato,
          ttl: a.urgente ? 24 * 3600 : 6 * 3600,
          urgency: a.urgente ? "high" : "normal",
        });
        const res = await fetch(req.endpoint, {
          method: "POST",
          headers: req.headers,
          body: req.body,
        });
        if (res.ok) {
          ok += 1;
          usadas.add(i.id);
        } else if (res.status === 404 || res.status === 410) {
          mortas.add(i.id);
        } else {
          falhas.set(i.id, (falhas.get(i.id) ?? i.falhas) + 1);
        }
      } catch (err) {
        falhas.set(i.id, (falhas.get(i.id) ?? i.falhas) + 1);
        console.error("[crm-push] falha no envio", err instanceof Error ? err.message : err);
      }
    }
    entregues += ok;
    await db.from("crm_notificacoes").update({ entregues: ok }).eq("id", a.id);
  }

  if (mortas.size) {
    await db
      .from("crm_push_inscricoes")
      .update({ ativo: false })
      .in("id", [...mortas]);
  }
  for (const [id, n] of falhas) {
    await db
      .from("crm_push_inscricoes")
      .update({ falhas: n, ativo: n < 10 })
      .eq("id", id);
  }
  if (usadas.size) {
    await db
      .from("crm_push_inscricoes")
      .update({ ultimo_envio_em: new Date().toISOString(), falhas: 0 })
      .in("id", [...usadas]);
  }
  return { ok: true, avisos: avisos.length, entregues, aparelhos: inscricoes.length };
}
