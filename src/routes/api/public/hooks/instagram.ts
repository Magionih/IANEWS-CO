import { createFileRoute } from "@tanstack/react-router";

import { assinaturaValida, instagramConfigurado, verificarWebhook } from "@/lib/automacao/meta.server";
import { canalInstagram, processar, respostaPublica, type Entrada } from "@/lib/automacao/minichat.server";

/* Webhook do Instagram da @ianews.co: comentários, mensagens no Direct, respostas e menções em stories.
   Tudo passa pelo mini chat da Renata (src/lib/automacao/minichat.server.ts). Cada evento é registrado em
   ig_eventos com uma chave única, para que a Meta, ao reenviar o mesmo aviso, não gere resposta dobrada. */

type Mensagem = {
  sender?: { id?: string };
  recipient?: { id?: string };
  message?: {
    mid?: string;
    text?: string;
    is_echo?: boolean;
    quick_reply?: { payload?: string };
    attachments?: { type?: string }[];
    reply_to?: { story?: { id?: string } };
  };
  postback?: { mid?: string; payload?: string; title?: string };
};
type Payload = {
  entry?: {
    id?: string;
    changes?: {
      field?: string;
      value?: { id?: string; text?: string; from?: { id?: string; username?: string }; media?: { id?: string } };
    }[];
    messaging?: Mensagem[];
  }[];
};

async function registrar(db: any, chave: string, ev: Record<string, unknown>): Promise<boolean> {
  const { error } = await db.from("ig_eventos").insert({ chave, ...ev });
  return !error; // conflito = já processado
}

export const Route = createFileRoute("/api/public/hooks/instagram")({
  server: {
    handlers: {
      GET: ({ request }) => verificarWebhook(request, process.env.META_VERIFY_TOKEN ?? process.env.WHATSAPP_VERIFY_TOKEN),
      POST: async ({ request }) => {
        const corpo = await request.text();
        if (!assinaturaValida(corpo, request.headers.get("x-hub-signature-256"), process.env.META_APP_SECRET)) {
          return new Response("Assinatura inválida.", { status: 401 });
        }
        if (!instagramConfigurado()) return Response.json({ ok: true, ignorado: "Instagram não configurado" });
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const db = supabaseAdmin as any;
        const conta = process.env.INSTAGRAM_USER_ID;
        const payload = JSON.parse(corpo) as Payload;

        const entradas: { chave: string; e: Entrada }[] = [];
        for (const entry of payload.entry ?? []) {
          for (const ch of entry.changes ?? []) {
            const v = ch.value;
            if (ch.field !== "comments" || !v?.id || !v.from?.id || v.from.id === conta) continue;
            entradas.push({
              chave: `c:${v.id}`,
              e: { tipo: "comentario", igsid: v.from.id, username: v.from.username, texto: v.text, comentarioId: v.id, mediaId: v.media?.id },
            });
          }
          for (const m of entry.messaging ?? []) {
            const de = m.sender?.id;
            if (!de || de === conta || m.message?.is_echo) continue;
            if (m.postback) {
              entradas.push({ chave: `p:${m.postback.mid ?? `${de}:${m.postback.payload}:${Date.now()}`}`, e: { tipo: "mensagem", igsid: de, payload: m.postback.payload, texto: m.postback.title } });
              continue;
            }
            if (!m.message?.mid) continue;
            const mencao = m.message.attachments?.some((a) => a.type === "story_mention");
            entradas.push({
              chave: `m:${m.message.mid}`,
              e: { tipo: mencao ? "mencao" : "mensagem", igsid: de, texto: m.message.text, payload: m.message.quick_reply?.payload },
            });
          }
        }

        for (const { chave, e } of entradas) {
          if (!(await registrar(db, chave, { igsid: e.igsid, tipo: e.tipo, texto: (e.texto ?? e.payload ?? "").slice(0, 500) }))) continue;
          try {
            const r = await processar(db, canalInstagram, e);
            if (e.tipo === "comentario" && r.saidas.length && e.comentarioId) {
              await canalInstagram.responderComentario(e.comentarioId, respostaPublica()).catch(() => undefined);
            }
            await db.from("ig_eventos").update({ fluxo: r.fluxo, resultado: r.nota ?? `${r.saidas.length} mensagem(ns)` }).eq("chave", chave);
          } catch (err) {
            const msg = err instanceof Error ? err.message : String(err);
            console.error("[instagram] mini chat", msg);
            await db.from("ig_eventos").update({ erro: msg.slice(0, 500) }).eq("chave", chave);
          }
        }
        return Response.json({ ok: true, eventos: entradas.length });
      },
    },
  },
});
