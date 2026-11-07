-- Entradas automáticas da máquina comercial: briefing por link, leads das pautas do site,
-- mensagens do WhatsApp oficial e cobranças. Todas as funções rodam só com a chave de serviço
-- (rotas do site); o navegador nunca chama nenhuma delas.

-- Fotos do briefing: bucket privado, só o servidor gera links de envio e de leitura.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('briefings', 'briefings', false, 10485760, array['image/jpeg', 'image/png', 'image/webp', 'image/svg+xml'])
on conflict (id) do nothing;

-- ---------------------------------------------------------------------
-- Briefing
-- ---------------------------------------------------------------------
create or replace function public.auto_briefing_get(p_token uuid)
returns jsonb language sql stable security definer set search_path = public as $$
  select jsonb_build_object(
    'id', b.id, 'status', b.status, 'tipo', b.tipo, 'dados', b.dados, 'fotos', b.fotos,
    'previa_url', b.previa_url, 'enviado_em', b.enviado_em,
    'pessoa', p.nome, 'empresa', e.nome)
    from auto_briefings b
    left join crm_pessoas p on p.id = b.pessoa_id
    left join crm_empresas e on e.id = b.empresa_id
   where b.token = p_token;
$$;

create or replace function public.auto_briefing_salvar(p_token uuid, p_dados jsonb, p_enviar boolean)
returns jsonb language plpgsql security definer set search_path = public as $$
declare b auto_briefings%rowtype; v_dono uuid;
begin
  select * into b from auto_briefings where token = p_token for update;
  if b.id is null then raise exception 'Briefing não encontrado.'; end if;
  if b.status not in ('aberto', 'enviado', 'ajuste') then
    return jsonb_build_object('ok', false, 'erro', 'Este briefing já está em produção.');
  end if;
  update auto_briefings set dados = coalesce(p_dados, '{}'::jsonb), updated_at = now(),
         status = case when p_enviar then 'enviado' else status end,
         enviado_em = case when p_enviar then now() else enviado_em end
   where id = b.id;
  if p_enviar and b.status <> 'enviado' then
    select dono_id into v_dono from crm_negocios where id = b.negocio_id;
    insert into crm_atividades (tipo, canal, texto, negocio_id, empresa_id, pessoa_id)
    values ('sistema', 'site', 'Briefing recebido pelo formulário (' || coalesce(array_length(b.fotos, 1), 0) || ' fotos).',
            b.negocio_id, b.empresa_id, b.pessoa_id);
    insert into crm_tarefas (titulo, descricao, vence_em, automatica, chave, responsavel_id, empresa_id, pessoa_id, negocio_id)
    values ('Produzir matéria · briefing recebido',
            'O briefing chegou pelo formulário. Gere o rascunho, revise e envie a prévia (status "previa" com o link).',
            crm_hoje() + 1, true, 'briefing-recebido:' || b.id, v_dono, b.empresa_id, b.pessoa_id, b.negocio_id)
    on conflict do nothing;
  end if;
  return jsonb_build_object('ok', true);
end $$;

create or replace function public.auto_briefing_foto(p_token uuid, p_path text, p_remover boolean default false)
returns jsonb language plpgsql security definer set search_path = public as $$
declare b auto_briefings%rowtype;
begin
  select * into b from auto_briefings where token = p_token for update;
  if b.id is null then raise exception 'Briefing não encontrado.'; end if;
  if p_path is null or p_path not like b.id::text || '/%' then raise exception 'Arquivo inválido.'; end if;
  if p_remover then
    update auto_briefings set fotos = array_remove(fotos, p_path), updated_at = now() where id = b.id;
  elsif not (p_path = any (b.fotos)) then
    if coalesce(array_length(b.fotos, 1), 0) >= 10 then raise exception 'Limite de 10 arquivos.'; end if;
    update auto_briefings set fotos = array_append(fotos, p_path), updated_at = now() where id = b.id;
  end if;
  return jsonb_build_object('ok', true);
end $$;

-- Aprovação da prévia pelo lead (ou pedido de ajuste, uma rodada)
create or replace function public.auto_briefing_decidir(p_token uuid, p_aprovar boolean, p_ajuste text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare b auto_briefings%rowtype; v_etapa uuid; v_dono uuid; v_tipo text;
begin
  select * into b from auto_briefings where token = p_token for update;
  if b.id is null then raise exception 'Briefing não encontrado.'; end if;
  if b.status <> 'previa' then return jsonb_build_object('ok', false, 'erro', 'Não há prévia aguardando aprovação.'); end if;
  select dono_id, tipo into v_dono, v_tipo from crm_negocios where id = b.negocio_id;
  if p_aprovar then
    update auto_briefings set status = 'aprovado', aprovado_em = now(), updated_at = now() where id = b.id;
    select id into v_etapa from crm_etapas where funil_id = 'materia' and nome = 'Aprovado';
    update crm_negocios set etapa_id = v_etapa, etapa_desde = now() where id = b.negocio_id and v_etapa is not null;
    insert into crm_atividades (tipo, canal, texto, negocio_id, empresa_id, pessoa_id)
    values ('sistema', 'site', 'Prévia aprovada pelo cliente.', b.negocio_id, b.empresa_id, b.pessoa_id);
    insert into crm_tarefas (titulo, descricao, vence_em, automatica, chave, responsavel_id, empresa_id, pessoa_id, negocio_id)
    values (case when b.tipo = 'pago' then 'Cobrar e agendar publicação' else 'Agendar publicação em collab' end,
            case when b.tipo = 'pago' then 'Prévia aprovada. O link de pagamento é gerado sozinho quando o gateway estiver ligado; confirme a data das 15h.'
                 else 'Prévia aprovada. Agende o post em collab e a matéria no site às 15h.' end,
            crm_hoje(), true, 'previa-aprovada:' || b.id, v_dono, b.empresa_id, b.pessoa_id, b.negocio_id)
    on conflict do nothing;
  else
    update auto_briefings set status = 'ajuste', ajuste_pedido = left(coalesce(p_ajuste, ''), 3000), updated_at = now() where id = b.id;
    insert into crm_atividades (tipo, canal, texto, negocio_id, empresa_id, pessoa_id)
    values ('mensagem_recebida', 'site', 'Pedido de ajuste na prévia: ' || left(coalesce(p_ajuste, ''), 900), b.negocio_id, b.empresa_id, b.pessoa_id);
    insert into crm_tarefas (titulo, descricao, vence_em, automatica, chave, responsavel_id, empresa_id, pessoa_id, negocio_id)
    values ('Ajustar prévia', left(coalesce(p_ajuste, ''), 3000), crm_hoje(), true, 'ajuste:' || b.id || ':' || now()::date, v_dono, b.empresa_id, b.pessoa_id, b.negocio_id)
    on conflict do nothing;
  end if;
  return jsonb_build_object('ok', true);
end $$;

-- ---------------------------------------------------------------------
-- Leads das pautas do site (empresas e pessoas citadas nas matérias)
-- ---------------------------------------------------------------------
create table if not exists public.auto_artigos_processados (
  article_id uuid primary key references public.articles(id) on delete cascade,
  empresas integer not null default 0,
  processado_em timestamptz not null default now()
);
alter table public.auto_artigos_processados enable row level security;
drop policy if exists auto_artigos_processados_equipe on public.auto_artigos_processados;
create policy auto_artigos_processados_equipe on public.auto_artigos_processados for select to authenticated using (public.crm_tem_acesso());

create or replace function public.auto_artigos_sem_mencao(p_dias integer default 3)
returns table (id uuid, title text, dek text, tags text[], body_markdown text, slug text)
language sql stable security definer set search_path = public as $$
  select a.id, a.title, a.dek, a.tags, a.body_markdown, a.slug from articles a
   where a.status = 'published' and a.published_at >= now() - make_interval(days => p_dias)
     and a.published_at <= now()
     and not exists (select 1 from crm_mencoes m where m.article_id = a.id)
     and not exists (select 1 from auto_artigos_processados x where x.article_id = a.id)
   order by a.published_at desc limit 20;
$$;

create or replace function public.auto_registrar_pauta(p_article uuid, p_empresas jsonb, p_pessoas jsonb)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  e jsonb; p jsonb;
  v_emp uuid; v_pes uuid; v_neg uuid;
  v_etapa uuid := (select id from crm_etapas where funil_id = 'materia' and nome = 'Novo');
  v_titulo text := (select title from articles where id = p_article);
  n_emp integer := 0; n_neg integer := 0;
begin
  for e in select * from jsonb_array_elements(coalesce(p_empresas, '[]'::jsonb)) loop
    continue when coalesce(e->>'nome', '') = '' or (e->>'brasileira') = 'false';
    v_emp := crm_achar_ou_criar_empresa(e->>'nome', null, null, null, 'pauta_auto');
    continue when v_emp is null;
    update crm_empresas set brasileira = coalesce(brasileira, (e->>'brasileira')::boolean),
           noticia_recente_em = greatest(coalesce(noticia_recente_em, crm_hoje()), crm_hoje())
     where id = v_emp;
    insert into crm_mencoes (article_id, empresa_id, papel, ativo) values (p_article, v_emp, 'citada', true)
    on conflict do nothing;
    n_emp := n_emp + 1;
    if not exists (select 1 from crm_negocios n join crm_etapas et on et.id = n.etapa_id
                    where n.empresa_id = v_emp and n.ativo and et.tipo = 'aberta')
       and not exists (select 1 from crm_empresas x where x.id = v_emp and (x.e_cliente or x.e_anunciante)) then
      insert into crm_negocios (titulo, funil_id, etapa_id, etapa_desde, empresa_id, tipo, origem, canal_origem, article_id, ativo)
      values ('Virou pauta · ' || (e->>'nome'), 'materia', v_etapa, now(), v_emp, 'destaque_cortesia', 'pauta', 'site', p_article, true)
      returning id into v_neg;
      n_neg := n_neg + 1;
    end if;
  end loop;

  for p in select * from jsonb_array_elements(coalesce(p_pessoas, '[]'::jsonb)) loop
    continue when coalesce(p->>'nome', '') = '' or coalesce(p->>'empresa', '') = '';
    select id into v_emp from crm_empresas where lower(trim(nome)) = lower(trim(p->>'empresa'));
    continue when v_emp is null;
    select pe.id into v_pes from crm_pessoas pe join crm_empresa_pessoas ep on ep.pessoa_id = pe.id
     where ep.empresa_id = v_emp and lower(trim(pe.nome)) = lower(trim(p->>'nome')) limit 1;
    if v_pes is null then
      insert into crm_pessoas (nome, origem) values (p->>'nome', 'pauta_auto') returning id into v_pes;
    end if;
    perform crm_ligar_pessoa_empresa(v_emp, v_pes, p->>'cargo');
    insert into crm_mencoes (article_id, empresa_id, pessoa_id, papel, ativo) values (p_article, v_emp, v_pes, 'citada', true)
    on conflict do nothing;
    update crm_negocios set pessoa_id = v_pes where empresa_id = v_emp and pessoa_id is null and ativo and origem = 'pauta';
  end loop;

  -- Marca a matéria como processada, mesmo sem empresa, para não reprocessar todo dia
  insert into auto_artigos_processados (article_id, empresas) values (p_article, n_emp)
  on conflict (article_id) do update set empresas = excluded.empresas, processado_em = now();
  return jsonb_build_object('ok', true, 'artigo', v_titulo, 'empresas', n_emp, 'negocios', n_neg);
end $$;

-- ---------------------------------------------------------------------
-- WhatsApp oficial: mensagem recebida vira atividade (e para as sequências)
-- ---------------------------------------------------------------------
create or replace function public.auto_whatsapp_recebido(p_telefone text, p_nome text, p_texto text, p_msg_id text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_dig text := regexp_replace(coalesce(p_telefone, ''), '\D', '', 'g');
  v_pes uuid; v_neg uuid; v_emp uuid; v_dono uuid; v_novo boolean := false;
begin
  if length(v_dig) < 10 then raise exception 'Telefone inválido.'; end if;
  if exists (select 1 from crm_atividades where texto like '%[wa:' || p_msg_id || ']%') then
    return jsonb_build_object('ok', true, 'repetida', true);
  end if;
  select id into v_pes from crm_pessoas
   where right(regexp_replace(coalesce(whatsapp, ''), '\D', '', 'g'), 11) = right(v_dig, 11)
   order by updated_at desc limit 1;
  if v_pes is null then
    insert into crm_pessoas (nome, whatsapp, origem) values (coalesce(nullif(trim(p_nome), ''), '+' || v_dig), '+' || v_dig, 'whatsapp')
    returning id into v_pes;
    v_novo := true;
  end if;
  select n.id, n.empresa_id, n.dono_id into v_neg, v_emp, v_dono from crm_negocios n join crm_etapas e on e.id = n.etapa_id
   where n.pessoa_id = v_pes and n.ativo and e.tipo = 'aberta' order by n.updated_at desc limit 1;
  insert into crm_atividades (tipo, canal, texto, pessoa_id, negocio_id, empresa_id)
  values ('mensagem_recebida', 'whatsapp', left(coalesce(p_texto, ''), 3000) || ' [wa:' || coalesce(p_msg_id, '') || ']', v_pes, v_neg, v_emp);
  return jsonb_build_object('ok', true, 'pessoa_id', v_pes, 'negocio_id', v_neg, 'novo', v_novo, 'dono_id', v_dono);
end $$;

create or replace function public.auto_handoff(p_pessoa uuid, p_negocio uuid, p_titulo text, p_texto text)
returns void language plpgsql security definer set search_path = public as $$
declare v_dono uuid; v_emp uuid;
begin
  select dono_id, empresa_id into v_dono, v_emp from crm_negocios where id = p_negocio;
  insert into crm_tarefas (titulo, descricao, vence_em, automatica, chave, responsavel_id, empresa_id, pessoa_id, negocio_id)
  values (left(p_titulo, 300), left(p_texto, 3000), crm_hoje(), true,
          'handoff:' || coalesce(p_pessoa::text, '') || ':' || crm_hoje(), v_dono, v_emp, p_pessoa, p_negocio)
  on conflict do nothing;
end $$;

create or replace function public.auto_whatsapp_enviado(p_pessoa uuid, p_negocio uuid, p_texto text)
returns void language sql security definer set search_path = public as $$
  insert into crm_atividades (tipo, canal, texto, pessoa_id, negocio_id, empresa_id)
  select 'mensagem_enviada', 'whatsapp', '[agente] ' || left(p_texto, 3000), p_pessoa, p_negocio,
         (select empresa_id from crm_negocios where id = p_negocio);
$$;

-- Histórico curto da conversa para o agente responder com contexto
create or replace function public.auto_conversa(p_pessoa uuid)
returns table (tipo text, texto text, created_at timestamptz)
language sql stable security definer set search_path = public as $$
  select tipo, texto, created_at from (
    select tipo, texto, created_at from crm_atividades
     where pessoa_id = p_pessoa and tipo in ('mensagem_enviada', 'mensagem_recebida')
     order by created_at desc limit 12) t
  order by created_at;
$$;

-- ---------------------------------------------------------------------
-- Cobrança: briefings pagos aprovados sem cobrança e baixa por referência externa
-- ---------------------------------------------------------------------
create or replace function public.auto_cobrancas_pendentes()
returns table (briefing_id uuid, negocio_id uuid, valor numeric, titulo text, pessoa text, empresa text)
language sql stable security definer set search_path = public as $$
  select b.id, n.id, coalesce(n.valor, 280), n.titulo, p.nome, e.nome
    from auto_briefings b join crm_negocios n on n.id = b.negocio_id
    left join crm_pessoas p on p.id = b.pessoa_id left join crm_empresas e on e.id = b.empresa_id
   where b.tipo = 'pago' and b.status = 'aprovado' and n.status_pagamento is distinct from 'pago'
     and not exists (select 1 from auto_pagamentos pg where pg.negocio_id = n.id and pg.status in ('pendente', 'pago'));
$$;

create or replace function public.auto_pagamento_status(p_ref text, p_external text, p_status text, p_valor numeric, p_forma text, p_payload jsonb)
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_id uuid;
begin
  select id into v_id from auto_pagamentos
   where (p_external is not null and external_id = p_external)
      or (p_ref ~ '^[0-9a-f-]{36}$' and id = p_ref::uuid)
   limit 1;
  if v_id is null then return jsonb_build_object('ok', false, 'erro', 'cobrança não encontrada'); end if;
  update auto_pagamentos set status = p_status, forma = coalesce(p_forma, forma),
         valor = coalesce(nullif(p_valor, 0), valor), payload = p_payload
   where id = v_id;
  return jsonb_build_object('ok', true, 'id', v_id);
end $$;

do $$
declare f text;
begin
  foreach f in array array[
    'auto_briefing_get(uuid)', 'auto_briefing_salvar(uuid, jsonb, boolean)', 'auto_briefing_foto(uuid, text, boolean)',
    'auto_briefing_decidir(uuid, boolean, text)', 'auto_artigos_sem_mencao(integer)', 'auto_registrar_pauta(uuid, jsonb, jsonb)',
    'auto_whatsapp_recebido(text, text, text, text)', 'auto_handoff(uuid, uuid, text, text)',
    'auto_whatsapp_enviado(uuid, uuid, text)', 'auto_conversa(uuid)', 'auto_cobrancas_pendentes()',
    'auto_pagamento_status(text, text, text, numeric, text, jsonb)'] loop
    execute format('revoke execute on function public.%s from public, anon, authenticated', f);
    execute format('grant execute on function public.%s to service_role', f);
  end loop;
end $$;

-- Rotinas do site (via call_site_hook, com o token do Vault)
select cron.unschedule(jobid) from cron.job where jobname in ('ianews-auto-leads', 'ianews-auto-email-frio', 'ianews-auto-cobrancas');
-- 6h30 em Brasília: empresas das matérias novas viram leads (antes da fila das 7h20)
select cron.schedule('ianews-auto-leads', '30 9 * * *', $$select public.call_site_hook('/api/public/hooks/auto-leads', '{"dias":3}')$$);
-- De hora em hora, 9h às 17h em Brasília, dias úteis: e-mail frio em lotes pequenos (só se ligado)
select cron.schedule('ianews-auto-email-frio', '5 12-20 * * 1-5', $$select public.call_site_hook('/api/public/hooks/email-frio', '{"lote":4}')$$);
-- A cada 30 minutos: cobranças das prévias aprovadas (só se o gateway estiver ligado)
select cron.schedule('ianews-auto-cobrancas', '*/30 11-23 * * *', $$select public.call_site_hook('/api/public/hooks/cobrancas')$$);

-- Funções de gatilho não são chamadas pela API
revoke execute on function public.auto_briefing_na_etapa() from public, anon, authenticated;
revoke execute on function public.auto_pagamento_baixa() from public, anon, authenticated;
revoke execute on function public.auto_parar_ao_responder() from public, anon, authenticated;
revoke execute on function public.auto_exigir_valor_no_fechamento() from public, anon, authenticated;
