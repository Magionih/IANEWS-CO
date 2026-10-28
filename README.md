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

## CRM interno (/admin/crm)
Sistema comercial e editorial dentro do painel, no mesmo banco. Só papéis `admin`, `comercial` e `editorial` acessam (RLS no banco + checagem no servidor).

- **Banco**: `supabase/migrations/20261028120000_crm_base.sql` cria as tabelas `crm_*`, RLS (sem delete), pontuação 0–100 e grupos A/B/C, cadências (tarefa automática ao mudar de etapa, pós-venda, renovação), entrada automática de `pauta_leads`, `contact_messages` e `leads`, e as funções de indicadores (`crm_audiencia`, `crm_relatorios`). `..._crm_agendamentos.sql` agenda as rotinas; `..._crm_carga_inicial.sql` cadastra empresas e pessoas das matérias publicadas.
- **Servidor**: `src/lib/crm/*.functions.ts` (uma por módulo), usando o token de quem está logado.
- **Telas**: `src/routes/_authenticated/admin_.crm.*` e componentes em `src/components/crm/`.
- **Rotinas**: `/api/public/hooks/crm-daily` (8h: lead aquecido, sem resposta e e-mail da equipe) e `/api/public/hooks/crm-weekly` (segunda: resumo para o admin).
- **IA (opcional)**: com `AI_API_KEY`, a tela Pautas sugere menções também pela IA; sem chave, usa regras de texto.
