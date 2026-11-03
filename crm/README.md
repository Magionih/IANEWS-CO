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
| `CRON_SECRET` | sim | Protege `/api/hooks/*` (mínimo 16 caracteres; a Vercel envia nas rotinas) |
| `SUPABASE_SERVICE_ROLE_KEY` | só para e-mails | Monta os resumos por e-mail (o CRM em si não usa chave mestra) |
| `RESEND_API_KEY` | só para e-mails | Resumo diário às 8h e semanal de segunda |
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

## Rotinas
- No banco (pg_cron), 10:50 UTC: `crm_rotina_diaria()` — lead aquecido e "Sem resposta".
- Vercel Cron (`vercel.json`), 11:00 UTC (8h em Brasília): `/api/hooks/crm-daily` — e-mail da equipe comercial.
- Vercel Cron, segunda 11:10 UTC: `/api/hooks/crm-weekly` — resumo para o admin.
- Os e-mails só saem com `SUPABASE_SERVICE_ROLE_KEY` e `RESEND_API_KEY` no projeto do CRM.

## Segurança
O CRM roda só com a chave **pública** do Supabase e a sessão de quem entrou. Tudo o que é restrito
(tabelas `crm_*`, contas e papéis, dados da newsletter, indicadores) é liberado por RLS e por funções
do banco que conferem o papel de quem chama.

- **Cabeçalhos** (`vercel.json`): Content-Security-Policy (só o próprio CRM e o Supabase da IANews;
  sem iframes, sem scripts ou imagens de terceiros), HSTS, X-Frame-Options DENY, nosniff,
  Referrer-Policy no-referrer, COOP/CORP same-origin, Permissions-Policy fechada e noindex.
- **Sem terceiros no navegador**: fontes servidas pelo próprio CRM (nada de Google Fonts).
- **Sessão**: sai sozinho depois de 4h sem uso (em todas as abas) e limpa os dados da memória ao sair.
- **Servidor**: confere a assinatura do token em toda chamada; o banco aplica a RLS em toda consulta.
- **Código**: nenhum segredo vai para o navegador (só a chave pública); sem source maps em produção.
- **Recomendado no Supabase** (Authentication → Providers/Policies): ligar *Leaked password
  protection* e senha mínima de 8 caracteres.

## Desempenho
- Funções da Vercel em **São Paulo (`gru1`)**, a mesma região do banco (`sa-east-1`): cada consulta
  sai do servidor e chega ao banco em poucos milissegundos.
- Token conferido localmente (chaves públicas em memória) e papéis guardados por 30s.
- Cache das telas (react-query, 30s): voltar a uma tela é instantâneo; salvar algo recarrega em
  segundo plano só as telas abertas.
- Código de cada tela carregado ao passar o mouse no menu; arquivos com hash em cache por 1 ano.

## Desenvolvimento
```
cd crm
npm install
npm run dev
```
