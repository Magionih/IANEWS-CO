-- Revisão de segurança do CRM (27/11).
-- 1) Perfil do assinante: só o servidor do site (service role) define. Antes, qualquer visitante
--    podia chamar a função direto pela API e descobrir se um e-mail assinou na última hora.
revoke execute on function public.lead_definir_perfil(text, text) from public, anon, authenticated;

-- 2) Função sem search_path fixo (aviso do linter de segurança).
alter function public.capa_boa(integer, integer) set search_path = public, pg_temp;

-- 3) Desempenho: chaves estrangeiras usadas nas telas do CRM sem índice (aviso do linter).
create index if not exists crm_negocios_etapa_idx on public.crm_negocios (etapa_id);
create index if not exists auto_producoes_article_idx on public.auto_producoes (article_id);
create index if not exists newsletter_recipients_lead_idx on public.newsletter_recipients (lead_id);
