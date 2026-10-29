# CRM interno IANews

Site **separado** do portal ianewsbr.com: outro projeto na Vercel, outro endereço, sem link no site
público e sem indexação. Usa o mesmo banco Supabase da IANews (projeto `hgydwvuowxxkdgtlqrdy`), porque
o CRM liga as matérias, a newsletter e os formulários do site; quem pode ver o quê é decidido no banco
(RLS por papel: `admin`, `comercial`, `editorial`).

## Publicar na Vercel (uma vez)
1. Vercel → **Add New → Project** → importe o repositório `Magionih/IANEWS-CO`.
2. Em **Root Directory**, escolha `crm`. Framework: **Other** (o `vercel.json` já define build e rotinas).
3. Em **Environment Variables**, cadastre:

| Variável | Obrigatória | Para quê |
|---|---|---|
| `SUPABASE_SERVICE_ROLE_KEY` | sim | Lista contas e papéis na Configuração e roda as rotinas (só servidor) |
| `CRON_SECRET` | sim | Protege `/api/hooks/*` (mínimo 16 caracteres; a Vercel envia nas rotinas) |
| `RESEND_API_KEY` | para e-mails | Resumo diário às 8h e semanal de segunda |
| `EMAIL_FROM` | não | Remetente, ex.: `IA News <crm@ianewsbr.com>` |
| `CRM_URL` | não | Endereço do CRM usado nos links dos e-mails (padrão: domínio de produção da Vercel) |
| `AI_API_KEY` | não | Sugestão de menções por IA na tela Pautas |
| `CRM_EMAILS` | não | `false` desliga os e-mails do CRM |

Os valores **públicos** do Supabase já estão em `crm/.env`.

4. Depois do primeiro deploy, no Supabase → **Authentication → URL Configuration**, adicione o
   endereço do CRM (ex.: `https://ianews-crm.vercel.app/**`) em **Redirect URLs**, para os links de
   confirmação de e-mail e de "esqueci a senha" voltarem para o CRM.

## Acesso
- Entre em `/login`. A conta é a do Supabase da IANews; sem papel de equipe, o CRM mostra "Acesso restrito".
- O admin libera a equipe em **Configuração → Usuários e papéis**.

## Banco
`supabase/migrations/` tem o esquema do CRM (`crm_*`), as regras de acesso, gatilhos, indicadores e a carga
inicial. As tabelas do site não mudam; o CRM só aponta para elas.

## Rotinas (Vercel Cron, `vercel.json`)
- 11:00 UTC (8h em Brasília): `/api/hooks/crm-daily` — lead aquecido, "Sem resposta" e e-mail da equipe comercial.
- Segunda, 11:10 UTC: `/api/hooks/crm-weekly` — resumo para o admin.

## Desenvolvimento
```
cd crm
npm install
npm run dev
```
