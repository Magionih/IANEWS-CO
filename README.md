# IANews — site (ianewsbr.com)

Site da IANews em TanStack Start, hospedado na **Vercel** com banco **Supabase** (projeto `hgydwvuowxxkdgtlqrdy`) e e-mails pelo **Resend**.

## Rodar localmente
```
npm install
npm run dev
```

## Variáveis de ambiente (Vercel → Settings → Environment Variables)
| Variável | Obrigatória | Para quê |
|---|---|---|
| `SUPABASE_SERVICE_ROLE_KEY` | sim | Acesso administrativo ao banco (só servidor) |
| `CRON_SECRET` | sim | Protege as rotinas agendadas (`/api/public/hooks/*`) |
| `AI_API_KEY` | para a automação de notícias | Chave da API do Google Gemini (ou outro provedor compatível com OpenAI) |
| `RESEND_API_KEY` | para e-mails | Confirmação de inscrição e newsletter |
| `NEWSLETTER_ENABLED` | não | `true` liga o envio da newsletter diária/semanal e lembretes |
| `EMAIL_FROM` | não | Remetente, ex.: `IA News <newsletter@ianewsbr.com>` |
| `VAPID_PUBLIC_KEY` / `VAPID_PRIVATE_KEY` | não | Notificações push |
| `AI_BASE_URL`, `AI_WRITER_MODEL`, `AI_FAST_MODEL` | não | Trocar provedor/modelos de IA |

Os valores públicos do Supabase (URL e chave publicável) já estão no `.env`.

## Rotinas agendadas (vercel.json)
- 07:00 (BRT) — ingestão de notícias com curadoria por IA
- 07:50 — push diário
- 08:00 dias úteis — newsletter diária (só envia com `NEWSLETTER_ENABLED=true`)
- 11:00 — follow-up de leads (idem)
- segunda 08:00 — ranking semanal (idem)
