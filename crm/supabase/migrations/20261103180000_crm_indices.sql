-- Índices para as chaves estrangeiras das tabelas do CRM (aviso de desempenho do Supabase).
-- Deixam rápidas as fichas, filtros por responsável e as checagens de exclusão/alteração em cascata
-- quando o volume de empresas, negócios e atividades crescer.
create index if not exists crm_atividades_autor_idx on public.crm_atividades (autor_id);
create index if not exists crm_atividades_etapa_de_idx on public.crm_atividades (etapa_de);
create index if not exists crm_atividades_etapa_para_idx on public.crm_atividades (etapa_para);
create index if not exists crm_conteudos_created_by_idx on public.crm_conteudos (created_by);
create index if not exists crm_empresas_ai_tool_idx on public.crm_empresas (ai_tool_id);
create index if not exists crm_empresas_dono_idx on public.crm_empresas (dono_id);
create index if not exists crm_mencoes_conteudo_idx on public.crm_mencoes (conteudo_id);
create index if not exists crm_mencoes_created_by_idx on public.crm_mencoes (created_by);
create index if not exists crm_modelos_etapa_idx on public.crm_modelos (etapa_id);
create index if not exists crm_negocios_article_idx on public.crm_negocios (article_id);
create index if not exists crm_negocios_conteudo_idx on public.crm_negocios (conteudo_id);
create index if not exists crm_negocios_dono_idx on public.crm_negocios (dono_id);
create index if not exists crm_negocios_etapa_idx on public.crm_negocios (etapa_id);
create index if not exists crm_pessoas_dono_idx on public.crm_pessoas (dono_id);
create index if not exists crm_pessoas_newsletter_lead_idx on public.crm_pessoas (newsletter_lead_id);
create index if not exists crm_tarefas_created_by_idx on public.crm_tarefas (created_by);
create index if not exists crm_tarefas_empresa_idx on public.crm_tarefas (empresa_id);
create index if not exists crm_tarefas_pessoa_idx on public.crm_tarefas (pessoa_id);
-- Painel "Entrada de leads (30 dias)" e contagens da semana.
create index if not exists crm_negocios_created_idx on public.crm_negocios (created_at);
