-- Tempo real no CRM: as telas abertas recarregam sozinhas quando estas tabelas mudam.
-- O Realtime respeita a RLS: cada pessoa só recebe o que já pode ler.
do $$
declare t text;
begin
  foreach t in array array[
    'crm_negocios', 'crm_tarefas', 'crm_atividades', 'crm_lancamentos', 'crm_notificacoes',
    'auto_briefings', 'auto_lista_diaria', 'auto_fila', 'pauta_leads', 'contact_messages', 'leads', 'articles'
  ] loop
    if to_regclass('public.' || t) is not null and not exists (
      select 1 from pg_publication_tables
       where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = t
    ) then
      execute format('alter publication supabase_realtime add table public.%I', t);
    end if;
  end loop;
end $$;
