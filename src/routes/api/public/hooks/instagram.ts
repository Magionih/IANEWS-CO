import { createFileRoute } from "@tanstack/react-router";

import {
  assinaturaValida,
  instagramConfigurado,
  responderComentarioNoDirect,
  verificarWebhook,
} from "@/lib/automacao/meta.server";

/* Webhook do Instagram (comentários da @ianews.co).
   Quem comenta a palavra-chave recebe a resposta privada no Direct, pela API oficial:
   é a pessoa que fala primeiro, então não conta como mensagem fria. */

const RESPOSTAS: Record<string, string> = {
  PAUTA:
    "Oi! Aqui é da IA News. Que bom que você quer contar a sua história com IA. Envie a sua pauta neste link e a redação responde em até 2 dias úteis: https://ianewsbr.com/pauta",
  RADAR:
    "Oi! Aqui é da IA News. O resumo das notícias de IA sai todo dia às 7h no nosso canal do WhatsApp: https://whatsapp.com/channel/0029Vb9A9F559PwIVAJ7fi2S",
};

type Payload = {
  entry?: {
    changes?: {
      field?: string;
      value?: { id?: string; text?: string; from?: { username?: string } };
    }[];
  }[];
};

export const Route = createFileRoute("/api/public/hooks/instagram")({
  server: {
    handlers: {
      GET: ({ request }) =>
        verificarWebhook(
          request,
          process.env.META_VERIFY_TOKEN ?? process.env.WHATSAPP_VERIFY_TOKEN,
        ),
      POST: async ({ request }) => {
        const corpo = await request.text();
        if (
          !assinaturaValida(
            corpo,
            request.headers.get("x-hub-signature-256"),
            process.env.META_APP_SECRET,
          )
        ) {
          return new Response("Assinatura inválida.", { status: 401 });
        }
        if (!instagramConfigurado())
          return Response.json({ ok: true, ignorado: "Instagram não configurado" });
        const payload = JSON.parse(corpo) as Payload;
        for (const entry of payload.entry ?? []) {
          for (const ch of entry.changes ?? []) {
            if (ch.field !== "comments" || !ch.value?.id) continue;
            const palavra = (ch.value.text ?? "")
              .trim()
              .toUpperCase()
              .replace(/[^A-Z]/g, "");
            const texto = RESPOSTAS[palavra];
            if (!texto) continue;
            try {
              await responderComentarioNoDirect(ch.value.id, texto);
            } catch (err) {
              console.error(
                "[instagram] resposta privada falhou",
                err instanceof Error ? err.message : err,
              );
            }
          }
        }
        return Response.json({ ok: true });
      },
    },
  },
});
