-- Ecossistema 100%: fila por perfil, funis Evento/Implementação/Nutrição na lista, radar externo de
-- leads, carrossel de notícias automático, publicação no Instagram por API, leituras por matéria
-- e resumo diário da operação.

-- ---------------------------------------------------------------------
-- 1. Fila por perfil (A fornecedor, B criador, C empresário, D marca, E rede)
-- ---------------------------------------------------------------------
alter table public.crm_modelos add column if not exists perfil text check (perfil in ('A', 'B', 'C', 'D', 'E'));

-- Perfil do negócio pela etiqueta "Perfil X · ..."
create or replace function public.auto_perfil(p_negocio uuid)
returns text language sql stable set search_path = public as $$
  select substring(tg.nome from '^Perfil ([A-E]) ')
    from crm_negocios n
    join crm_tags tg on tg.id = any (coalesce(n.tags, '{}'))
   where n.id = p_negocio and tg.nome like 'Perfil _ %'
   limit 1;
$$;

-- Modelo por passo e canal, preferindo o do perfil; sem perfil, o padrão
create or replace function public.auto_modelo(p_passo text, p_canal text, p_perfil text)
returns text language sql stable security definer set search_path = public as $$
  select texto from crm_modelos
   where ativo and passo_auto = p_passo and (perfil is null or perfil = p_perfil)
   order by (perfil = p_perfil) desc nulls last, (canal = p_canal) desc, ordem
   limit 1;
$$;
create or replace function public.auto_modelo(p_passo text, p_canal text)
returns text language sql stable security definer set search_path = public as $$
  select public.auto_modelo(p_passo, p_canal, null);
$$;

-- ---------------------------------------------------------------------
-- 2. Radar externo: empresas brasileiras de IA achadas na web pela IA
-- ---------------------------------------------------------------------
insert into public.auto_config (chave, valor, descricao) values
  ('radar_segmentos', '["agência de automação com IA para empresas", "startup brasileira de agentes de IA", "consultoria de inteligência artificial para PMEs", "empresa de IA para saúde", "empresa de IA para varejo e e-commerce", "empresa de IA para advogados e escritórios", "startup de IA para RH e recrutamento", "empresa de IA para educação", "software de IA para clínicas e consultórios", "startup de IA para agronegócio", "empresa de IA para marketing e conteúdo", "startup de IA para finanças e crédito", "empresa de chatbot e atendimento com IA", "estúdio de vídeo e avatar com IA", "empresa de dados e IA para indústria"]', 'Segmentos que o radar externo pesquisa, um por rodada, em rodízio'),
  ('radar_cidades', '["Brasil", "São Paulo", "Belo Horizonte", "Rio de Janeiro", "Curitiba", "Florianópolis", "Porto Alegre", "Recife", "Campinas", "Goiânia", "Brasília", "Salvador", "Fortaleza"]', 'Cidades que o radar externo combina com os segmentos'),
  ('radar_por_rodada', '8', 'Quantas empresas novas o radar externo tenta trazer por rodada'),
  ('instagram_api_publicar', 'false', 'Publicar carrosséis de notícia no Instagram pela API (curtidas visíveis). Destaques de lead continuam manuais.'),
  ('resumo_diario_emails', '["ianewscomercial@gmail.com"]', 'Quem recebe o resumo diário da operação por e-mail'),
  ('resumo_diario_whatsapp', '[]', 'Números (com DDI) que recebem o resumo diário pelo WhatsApp, quando a API estiver ligada')
on conflict (chave) do nothing;

create table if not exists public.auto_radar_rodadas (
  id uuid primary key default gen_random_uuid(),
  segmento text not null,
  cidade text not null,
  encontradas integer not null default 0,
  novas integer not null default 0,
  erro text,
  created_at timestamptz not null default now()
);
alter table public.auto_radar_rodadas enable row level security;
drop policy if exists auto_radar_rodadas_equipe on public.auto_radar_rodadas;
create policy auto_radar_rodadas_equipe on public.auto_radar_rodadas for select to authenticated using (crm_tem_acesso());

-- Próximo segmento/cidade do rodízio (o par menos pesquisado, mais antigo)
create or replace function public.auto_radar_proximo()
returns table (segmento text, cidade text) language sql stable security definer set search_path = public as $$
  with seg as (select value as segmento, ordinality as o from jsonb_array_elements_text(coalesce(auto_cfg('radar_segmentos'), '[]'::jsonb)) with ordinality),
       cid as (select value as cidade, ordinality as o from jsonb_array_elements_text(coalesce(auto_cfg('radar_cidades'), '[]'::jsonb)) with ordinality),
       pares as (select s.segmento, c.cidade, s.o as so, c.o as co from seg s cross join cid c)
  select p.segmento, p.cidade
    from pares p
    left join lateral (select max(created_at) ultimo, count(*) n from auto_radar_rodadas r where r.segmento = p.segmento and r.cidade = p.cidade) r on true
   order by r.n nulls first, r.ultimo nulls first, p.so, p.co
   limit 1;
$$;

-- Registra as empresas achadas: empresa + fundador + negócio no funil de matéria (perfil A), sem duplicar
create or replace function public.auto_radar_registrar(p_segmento text, p_cidade text, p_empresas jsonb, p_erro text default null)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  e jsonb; v_emp uuid; v_pes uuid; v_neg uuid; n_enc integer := 0; n_nov integer := 0;
  v_etapa uuid := (select id from crm_etapas where funil_id = 'materia' and nome = 'Novo');
  v_nome text; v_ig text; v_existia boolean;
begin
  for e in select * from jsonb_array_elements(coalesce(p_empresas, '[]'::jsonb)) loop
    v_nome := trim(coalesce(e->>'nome', ''));
    continue when v_nome = '' or coalesce(e->>'brasileira', 'true') = 'false';
    n_enc := n_enc + 1;
    v_ig := lower(regexp_replace(regexp_replace(coalesce(e->>'instagram', ''), '^https?://(www\.)?instagram\.com/', ''), '^@|/.*$', '', 'g'));
    if v_ig !~ '^[a-z0-9._]{2,30}$' then v_ig := null; end if;
    continue when v_ig is null and coalesce(e->>'linkedin', '') = '' and coalesce(e->>'site', '') = '';
    v_existia := exists (select 1 from crm_empresas x where lower(trim(x.nome)) = lower(v_nome)
                           or (v_ig is not null and lower(regexp_replace(coalesce(x.instagram, ''), '^@', '')) = v_ig)
                           or (coalesce(e->>'site', '') <> '' and x.dominio is not null and (e->>'site') ilike '%' || x.dominio || '%'));
    v_emp := crm_achar_ou_criar_empresa(v_nome, nullif(e->>'site', ''), v_ig, nullif(e->>'linkedin', ''), 'radar_externo');
    continue when v_emp is null;
    if exists (select 1 from auto_exclusoes x where x.empresa_id = v_emp) then continue; end if;
    update crm_empresas set
      cidade = coalesce(cidade, nullif(e->>'cidade', '')), setor = coalesce(setor, nullif(e->>'setor', '')),
      descricao = coalesce(descricao, nullif(e->>'descricao', '')), brasileira = coalesce(brasileira, true),
      seguidores_instagram = coalesce(seguidores_instagram, nullif(e->>'seguidores_instagram', '')::integer)
    where id = v_emp;
    if coalesce(e->>'fundador', '') <> '' then
      select pe.id into v_pes from crm_pessoas pe join crm_empresa_pessoas ep on ep.pessoa_id = pe.id
       where ep.empresa_id = v_emp and lower(trim(pe.nome)) = lower(trim(e->>'fundador')) limit 1;
      if v_pes is null then
        insert into crm_pessoas (nome, instagram, linkedin, origem)
        values (trim(e->>'fundador'), nullif(regexp_replace(coalesce(e->>'fundador_instagram', ''), '^@', ''), ''), nullif(e->>'fundador_linkedin', ''), 'radar_externo')
        returning id into v_pes;
      end if;
      perform crm_ligar_pessoa_empresa(v_emp, v_pes, nullif(e->>'fundador_cargo', ''));
      update crm_empresa_pessoas set decisor = true where empresa_id = v_emp and pessoa_id = v_pes;
    end if;
    if not v_existia and v_etapa is not null
       and not exists (select 1 from crm_negocios n join crm_etapas et on et.id = n.etapa_id where n.empresa_id = v_emp and n.ativo and et.tipo = 'aberta') then
      insert into crm_negocios (titulo, funil_id, etapa_id, etapa_desde, empresa_id, pessoa_id, tipo, origem, canal_origem, ativo, tags)
      values ('Radar · ' || v_nome, 'materia', v_etapa, now(), v_emp, v_pes, 'destaque_cortesia', 'radar_externo', 'crm', true,
              (select coalesce(array_agg(id), '{}') from crm_tags where nome = 'Perfil A · Fornecedor de IA'))
      returning id into v_neg;
      insert into crm_atividades (tipo, canal, texto, empresa_id, pessoa_id, negocio_id)
      values ('sistema', 'interno', 'Achada pelo radar externo (' || p_segmento || ', ' || p_cidade || '). Fontes: ' || left(coalesce(e->>'fontes', ''), 400), v_emp, v_pes, v_neg);
      n_nov := n_nov + 1;
    end if;
    v_pes := null;
  end loop;
  insert into auto_radar_rodadas (segmento, cidade, encontradas, novas, erro) values (p_segmento, p_cidade, n_enc, n_nov, p_erro);
  return jsonb_build_object('ok', p_erro is null, 'segmento', p_segmento, 'cidade', p_cidade, 'encontradas', n_enc, 'novas', n_nov, 'erro', p_erro);
end $$;

-- ---------------------------------------------------------------------
-- 3. Carrossel de notícias (matérias agendadas viram telas + legenda) e publicação por API
-- ---------------------------------------------------------------------
create table if not exists public.auto_carrosseis (
  id uuid primary key default gen_random_uuid(),
  article_id uuid not null unique references public.articles(id) on delete cascade,
  status text not null default 'pronto' check (status in ('pronto', 'publicando', 'publicado', 'falhou', 'cancelado')),
  telas text[] not null default '{}',
  legenda text,
  collabs text[] not null default '{}',
  publicar_api boolean not null default false,
  ig_media_id text,
  social_url text,
  publicado_em timestamptz,
  erro text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.auto_carrosseis enable row level security;
drop policy if exists auto_carrosseis_equipe on public.auto_carrosseis;
create policy auto_carrosseis_equipe on public.auto_carrosseis for all to authenticated using (crm_tem_acesso()) with check (crm_tem_acesso());

-- Matérias agendadas (próximas 48 h) de notícia, com capa, ainda sem carrossel e que não são destaque de lead
create or replace function public.auto_carrosseis_pendentes(p_limite integer default 3)
returns table (article_id uuid, slug text, title text, dek text, body_markdown text, category text, cover_image_url text, tags text[], published_at timestamptz, sources jsonb)
language sql stable security definer set search_path = public as $$
  select a.id, a.slug, a.title, a.dek, a.body_markdown, a.category, a.cover_image_url, a.tags, a.published_at, a.sources
    from articles a
   where a.status = 'published' and a.published_at > now() and a.published_at < now() + interval '48 hours'
     and a.cover_image_url like '%/storage/v1/object/public/covers/%'
     and not exists (select 1 from auto_carrosseis c where c.article_id = a.id)
     and not exists (select 1 from auto_producoes p where p.article_id = a.id)
   order by a.published_at
   limit greatest(1, least(p_limite, 10));
$$;

create or replace function public.auto_carrossel_salvar(p_article uuid, p_telas text[], p_legenda text, p_collabs text[], p_erro text default null)
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_api boolean := coalesce((auto_cfg('instagram_api_publicar'))::text, 'false') = 'true';
begin
  insert into auto_carrosseis (article_id, status, telas, legenda, collabs, publicar_api, erro)
  values (p_article, case when p_erro is null then 'pronto' else 'falhou' end, coalesce(p_telas, '{}'), p_legenda, coalesce(p_collabs, '{}'), v_api and p_erro is null, p_erro)
  on conflict (article_id) do update set status = excluded.status, telas = excluded.telas, legenda = excluded.legenda,
    collabs = excluded.collabs, erro = excluded.erro, updated_at = now();
  return jsonb_build_object('ok', p_erro is null);
end $$;

-- Carrosséis cuja matéria já entrou no ar e devem ser publicados pela API
create or replace function public.auto_carrosseis_para_publicar(p_limite integer default 3)
returns table (id uuid, article_id uuid, slug text, title text, telas text[], legenda text, collabs text[])
language sql stable security definer set search_path = public as $$
  select c.id, c.article_id, a.slug, a.title, c.telas, c.legenda, c.collabs
    from auto_carrosseis c join articles a on a.id = c.article_id
   where c.status = 'pronto' and c.publicar_api and a.status = 'published' and a.published_at <= now()
     and a.published_at > now() - interval '6 hours' and cardinality(c.telas) >= 2
   order by a.published_at
   limit greatest(1, least(p_limite, 10));
$$;

create or replace function public.auto_carrossel_publicado(p_id uuid, p_media_id text, p_url text, p_erro text default null)
returns jsonb language plpgsql security definer set search_path = public as $$
declare c auto_carrosseis%rowtype;
begin
  update auto_carrosseis set status = case when p_erro is null then 'publicado' else 'falhou' end,
         ig_media_id = coalesce(p_media_id, ig_media_id), social_url = coalesce(p_url, social_url),
         publicado_em = case when p_erro is null then now() else publicado_em end, erro = p_erro, updated_at = now()
   where id = p_id returning * into c;
  if p_erro is null then
    update articles set social_url = coalesce(p_url, social_url) where id = c.article_id;
    insert into crm_conteudos (article_id, canal, formato, titulo, url, publicado_em, ativo)
    select c.article_id, 'instagram', 'carrossel', a.title, p_url, now(), true from articles a where a.id = c.article_id;
  end if;
  return jsonb_build_object('ok', p_erro is null);
end $$;

-- ---------------------------------------------------------------------
-- 4. Leituras por matéria (views_count) a partir do rastreio de visitas
-- ---------------------------------------------------------------------
create or replace function public.article_view(p_slug text)
returns void language sql security definer set search_path = public as $$
  update articles set views_count = coalesce(views_count, 0) + 1 where slug = p_slug;
$$;

-- ---------------------------------------------------------------------
-- 5. Resumo diário da operação (texto pronto para e-mail/WhatsApp)
-- ---------------------------------------------------------------------
create or replace function public.auto_resumo_diario()
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare
  m jsonb := auto_metricas(7, 7); ontem jsonb; hoje jsonb; amanha jsonb; v_lista jsonb; v_fila jsonb; v_prod jsonb; v_radar jsonb; txt text;
  v_hoje date := crm_hoje();
begin
  select d into ontem from jsonb_array_elements(m->'dias') d where (d->>'dia')::date = v_hoje - 1;
  select d into hoje from jsonb_array_elements(m->'dias') d where (d->>'dia')::date = v_hoje;
  select d into amanha from jsonb_array_elements(m->'dias') d where (d->>'dia')::date = v_hoje + 1;
  v_lista := auto_lista_resumo(v_hoje);
  select jsonb_build_object('pendentes', count(*) filter (where status = 'pendente'), 'direct', count(*) filter (where canal = 'direct' and status = 'pendente'),
                            'linkedin', count(*) filter (where canal = 'linkedin' and status = 'pendente'), 'email', count(*) filter (where canal = 'email' and status = 'pendente'),
                            'whatsapp', count(*) filter (where canal = 'whatsapp' and status = 'pendente'))
    into v_fila from auto_fila where dia = v_hoje;
  select jsonb_build_object('previas', count(*) filter (where status = 'previa'), 'agendadas', count(*) filter (where status = 'agendado'),
                            'aguardando_ia', (select count(*) from auto_briefings where status in ('enviado', 'em_producao')),
                            'proxima', (select min(data_publicacao) from auto_producoes where status = 'agendado'))
    into v_prod from auto_producoes;
  select jsonb_build_object('rodadas', count(*), 'novas', coalesce(sum(novas), 0)) into v_radar from auto_radar_rodadas where created_at >= now() - interval '24 hours';
  txt := 'IA News · resumo de ' || to_char(v_hoje, 'DD/MM') || E'\n\n' ||
    '📰 Conteúdo: ontem saíram ' || coalesce(ontem->>'materias', '0') || ' matérias; hoje há ' || coalesce(hoje->>'materias', '0') || ' agendadas e amanhã ' || coalesce(amanha->>'materias', '0') ||
    ' (meta 5/dia). Agendadas no total: ' || (m->'totais'->>'materias_agendadas') || '.' || E'\n' ||
    '📬 Newsletter: ' || (m->'totais'->>'assinantes_ativos') || ' assinantes ativos; ontem ' || coalesce(ontem->'newsletter'->>'entregues', '0') || ' entregas.' || E'\n' ||
    '🎯 Lista do dia: ' || (v_lista->>'total') || ' leads (' || (select string_agg(k || ' ' || v, ', ') from jsonb_each_text(coalesce(v_lista->'por_bloco', '{}'::jsonb)) as x(k, v)) || ').' || E'\n' ||
    '✉️ Fila: ' || coalesce(v_fila->>'pendentes', '0') || ' mensagens para enviar hoje (Direct ' || coalesce(v_fila->>'direct', '0') || ', LinkedIn ' || coalesce(v_fila->>'linkedin', '0') ||
    ', e-mail ' || coalesce(v_fila->>'email', '0') || ', WhatsApp ' || coalesce(v_fila->>'whatsapp', '0') || '). Ontem: ' || coalesce(ontem->'fila'->>'enviados', '0') || ' enviadas, ' || coalesce(ontem->'fila'->>'respondeu', '0') || ' respostas.' || E'\n' ||
    '🧩 Produções: ' || coalesce(v_prod->>'aguardando_ia', '0') || ' briefings para a IA, ' || coalesce(v_prod->>'previas', '0') || ' prévias com o lead, ' || coalesce(v_prod->>'agendadas', '0') || ' destaques agendados' ||
    coalesce(' (próximo ' || to_char((v_prod->>'proxima')::timestamptz at time zone 'America/Sao_Paulo', 'DD/MM HH24"h"MI') || ')', '') || '.' || E'\n' ||
    '📡 Radar externo (24 h): ' || coalesce(v_radar->>'novas', '0') || ' empresas novas em ' || coalesce(v_radar->>'rodadas', '0') || ' rodadas.' || E'\n' ||
    '🏢 Base: ' || (m->'totais'->>'empresas') || ' empresas, ' || (m->'totais'->>'pessoas') || ' pessoas, ' || (m->'totais'->>'negocios_abertos') || ' negócios abertos.' || E'\n\n' ||
    'Painel: https://ianews-crm.vercel.app/painel · Fila: https://ianews-crm.vercel.app/fila';
  return jsonb_build_object('texto', txt, 'emails', coalesce(auto_cfg('resumo_diario_emails'), '[]'::jsonb), 'whatsapp', coalesce(auto_cfg('resumo_diario_whatsapp'), '[]'::jsonb));
end $$;

-- Permissões
do $$ declare f text; begin
  foreach f in array array['auto_radar_proximo()', 'auto_radar_registrar(text, text, jsonb, text)', 'auto_carrosseis_pendentes(integer)',
                          'auto_carrossel_salvar(uuid, text[], text, text[], text)', 'auto_carrosseis_para_publicar(integer)',
                          'auto_carrossel_publicado(uuid, text, text, text)', 'article_view(text)', 'auto_resumo_diario()'] loop
    execute format('revoke execute on function public.%s from public, anon, authenticated', f);
    execute format('grant execute on function public.%s to service_role', f);
  end loop;
  execute 'grant execute on function public.auto_resumo_diario() to authenticated';
  execute 'grant execute on function public.auto_perfil(uuid) to authenticated, service_role';
end $$;

-- Rotinas
select cron.unschedule(jobid) from cron.job where jobname in ('ianews-auto-radar', 'ianews-auto-carrosseis', 'ianews-auto-ig-publicar', 'ianews-auto-resumo');
-- 5h30, 6h e 6h30 em Brasília: três rodadas do radar externo antes da lista das 7h
select cron.schedule('ianews-auto-radar', '30,0 8,9 * * *', $$select public.call_site_hook('/api/public/hooks/radar-externo')$$);
-- A cada hora: carrosséis das matérias que entram no ar nas próximas 48 h
select cron.schedule('ianews-auto-carrosseis', '15 * * * *', $$select public.call_site_hook('/api/public/hooks/carrossel-noticias', '{"limite":3}')$$);
-- A cada 10 minutos: publicar no Instagram pela API o que já entrou no ar (só com a chave ligada)
select cron.schedule('ianews-auto-ig-publicar', '*/10 * * * *', $$select public.call_site_hook('/api/public/hooks/instagram-publicar')$$);
-- 7h30 em Brasília: resumo diário
select cron.schedule('ianews-auto-resumo', '30 10 * * *', $$select public.call_site_hook('/api/public/hooks/resumo-diario')$$);

-- ---------------------------------------------------------------------
-- 6. Fila com modelo por perfil (mesma função, chamando auto_modelo com o perfil do negócio)
-- ---------------------------------------------------------------------
create or replace function public.auto_montar_fila(p_dia date default null)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_dia date := coalesce(p_dia, crm_hoje());
  v_lim jsonb := coalesce(auto_cfg('limites'), '{}'::jsonb);
  v_corte integer := coalesce((auto_cfg('nota_corte'))::text::integer, 50);
  v_reenvio integer := coalesce((auto_cfg('reenvio_minimo_dias'))::text::integer, 90);
  v_seq jsonb := coalesce(auto_cfg('sequencia'), '[]'::jsonb);
  r record;
  s jsonb;
  v_canal text;
  v_texto text;
  v_d record;
  v_resto jsonb := '{}'::jsonb;
  n_follow integer := 0;
  n_d0 integer := 0;
  n_exp integer := 0;
begin
  if auth.uid() is not null and not crm_tem_acesso() then
    raise exception 'Acesso restrito à equipe do CRM.';
  end if;
  if coalesce((auto_cfg('pausado'))::text, 'false') = 'true' then
    return jsonb_build_object('ok', true, 'pausado', true);
  end if;
  if extract(isodow from v_dia) in (6, 7) then
    return jsonb_build_object('ok', true, 'fim_de_semana', true);
  end if;

  -- Pendentes de dias anteriores expiram; o D0 não enviado volta a ser candidato
  update auto_fila set status = 'expirado' where status = 'pendente' and dia < v_dia;
  get diagnostics n_exp = row_count;
  delete from auto_fila where status = 'expirado' and passo = 'D0' and dia < v_dia;

  -- Follow-ups devidos (D3, D7, D15 em outro canal, D21 encerramento)
  for s in select * from jsonb_array_elements(v_seq) loop
    for r in
      select f0.negocio_id, f0.pessoa_id, f0.empresa_id, f0.canal as canal0, f0.nota,
             c.pnome, c.instagram, c.email, c.linkedin, c.enome
        from auto_fila f0
        join crm_negocios n on n.id = f0.negocio_id and n.ativo
        join crm_etapas et on et.id = n.etapa_id and et.tipo = 'aberta' and et.nome not in ('Respondeu', 'Briefing', 'Aprovado', 'Proposta', 'Conversa', 'Negociação')
        left join lateral (
          select p.nome as pnome, coalesce(e.nome, '') as enome,
                 coalesce(nullif(p.instagram, ''), nullif(e.instagram, '')) as instagram,
                 nullif(p.email, '') as email,
                 coalesce(nullif(p.linkedin, ''), nullif(e.linkedin, '')) as linkedin
            from (select 1) x
            left join crm_pessoas p on p.id = f0.pessoa_id
            left join crm_empresas e on e.id = f0.empresa_id
        ) c on true
       where f0.passo = 'D0' and f0.status = 'enviado'
         and f0.enviado_em::date + (s->>'dias')::integer <= v_dia
         and not exists (select 1 from auto_fila x where x.negocio_id = f0.negocio_id and (x.status = 'respondeu' or x.motivo = 'parar'))
         and not exists (select 1 from auto_fila x where x.negocio_id = f0.negocio_id and x.passo = s->>'passo')
         and not exists (select 1 from crm_atividades a where a.tipo = 'mensagem_recebida'
                           and (a.negocio_id = f0.negocio_id or (f0.pessoa_id is not null and a.pessoa_id = f0.pessoa_id))
                           and a.created_at >= f0.enviado_em)
         and not exists (select 1 from auto_exclusoes x where x.pessoa_id = f0.pessoa_id or x.empresa_id = f0.empresa_id)
    loop
      v_canal := r.canal0;
      if coalesce((s->>'troca_canal')::boolean, false) then
        v_canal := case
          when r.canal0 <> 'email' and coalesce(r.email, '') <> '' then 'email'
          when r.canal0 <> 'direct' and coalesce(r.instagram, '') <> '' then 'direct'
          when r.canal0 <> 'linkedin' and coalesce(r.linkedin, '') <> '' then 'linkedin'
          else r.canal0 end;
      end if;
      -- No LinkedIn, D3 e D7 só depois de a pessoa aceitar o convite (a equipe registra a resposta)
      if v_canal = 'linkedin' and (s->>'passo') in ('D3', 'D7') then continue; end if;
      v_texto := auto_modelo(case when (s->>'passo') = 'D15' then 'D0' else s->>'passo' end, v_canal, auto_perfil(r.negocio_id));
      continue when v_texto is null;
      select * into v_d from auto_destino(v_canal, r.instagram, r.email, r.linkedin);
      insert into auto_fila (dia, canal, passo, negocio_id, empresa_id, pessoa_id, nota, destino, link, assunto, mensagem, automatico)
      values (v_dia, v_canal, s->>'passo', r.negocio_id, r.empresa_id, r.pessoa_id, r.nota, v_d.destino, v_d.link,
              case when v_canal = 'email' then 'IA News · ' || coalesce(nullif(r.enome, ''), 'convite') end,
              auto_preencher(v_texto, r.pnome, r.enome),
              v_canal = 'email' and coalesce((auto_cfg('email_frio_ativo'))::text, 'false') = 'true')
      on conflict (negocio_id, passo) do nothing;
      n_follow := n_follow + 1;
    end loop;
  end loop;

  select jsonb_object_agg(k, greatest(0, coalesce((v_lim->>k)::integer, 0) -
           (select count(*) from auto_fila f where f.dia = v_dia and f.canal = k and f.passo = 'D0')))
    into v_resto
    from unnest(array['direct', 'email', 'linkedin']) k;

  -- Primeiros contatos, da maior nota para a menor, até acabar a vaga de cada canal
  for r in
    select c.* from auto_candidatos c
     where c.nota >= v_corte
       and (c.instagram is not null or c.email is not null or c.linkedin is not null)
       and not exists (select 1 from auto_fila f where f.negocio_id = c.negocio_id)
       and not exists (select 1 from auto_exclusoes x where x.pessoa_id = c.pessoa_id or x.empresa_id = c.empresa_id
                         or (x.instagram is not null and lower(x.instagram) = lower(c.instagram))
                         or (x.email is not null and lower(x.email) = lower(c.email)))
       and not exists (select 1 from crm_atividades a where a.tipo in ('mensagem_enviada', 'mensagem_recebida')
                         and (a.pessoa_id = c.pessoa_id or a.empresa_id = c.empresa_id or a.negocio_id = c.negocio_id)
                         and a.created_at >= now() - make_interval(days => v_reenvio))
     order by c.nota desc, c.via_empresa, c.noticia_recente_em desc nulls last, c.created_at
  loop
    v_canal := case
      when r.instagram is not null and (v_resto->>'direct')::integer > 0 then 'direct'
      when r.email is not null and (v_resto->>'email')::integer > 0 then 'email'
      when r.linkedin is not null and (v_resto->>'linkedin')::integer > 0 then 'linkedin'
      else null end;
    continue when v_canal is null;
    v_texto := case when r.virou_pauta and v_canal = 'direct' then auto_modelo('D0_pauta', v_canal, auto_perfil(r.negocio_id)) end;
    v_texto := coalesce(v_texto, auto_modelo('D0', v_canal, auto_perfil(r.negocio_id)));
    continue when v_texto is null;
    select * into v_d from auto_destino(v_canal, r.instagram, r.email, r.linkedin);
    insert into auto_fila (dia, canal, passo, negocio_id, empresa_id, pessoa_id, nota, destino, link, assunto, mensagem, automatico, motivo)
    values (v_dia, v_canal, 'D0', r.negocio_id, r.empresa_id, r.pessoa_id, r.nota, v_d.destino, v_d.link,
            case when v_canal = 'email' then 'IA News · convite para a ' || coalesce(nullif(r.enome, ''), 'sua empresa') end,
            auto_preencher(v_texto, r.pnome, r.enome),
            v_canal = 'email' and coalesce((auto_cfg('email_frio_ativo'))::text, 'false') = 'true',
            case when r.via_empresa and v_canal = 'direct' then 'perfil da empresa: peça o contato do fundador' end)
    on conflict (negocio_id, passo) do nothing;
    v_resto := jsonb_set(v_resto, array[v_canal], to_jsonb((v_resto->>v_canal)::integer - 1));
    n_d0 := n_d0 + 1;
    exit when (v_resto->>'direct')::integer <= 0 and (v_resto->>'email')::integer <= 0 and (v_resto->>'linkedin')::integer <= 0;
  end loop;

  return jsonb_build_object('ok', true, 'dia', v_dia, 'primeiros_contatos', n_d0, 'follow_ups', n_follow,
                            'expirados', n_exp, 'vagas_restantes', v_resto);
end $$;


-- ---------------------------------------------------------------------
-- 7. Lista do dia com os funis Evento, Implementação e Nutrição
-- ---------------------------------------------------------------------
update public.auto_config set valor = '{"quentes":40,"pauta":40,"prospeccao":40,"inbound":20,"publicidade":25,"parcerias":10,"funis":20,"radar":20}' where chave = 'lista_blocos';
create or replace function public.auto_montar_lista(p_dia date default null)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_dia date := coalesce(p_dia, crm_hoje());
  v_total integer := coalesce((auto_cfg('lista_tamanho'))::text::integer, 200);
  v_blocos jsonb := coalesce(auto_cfg('lista_blocos'), '{}'::jsonb);
  v_corte integer := coalesce((auto_cfg('nota_corte'))::text::integer, 50);
  v_reenvio integer := coalesce((auto_cfg('reenvio_minimo_dias'))::text::integer, 90);
  v_abrir boolean := coalesce((auto_cfg('lista_abrir_negocios_radar'))::text, 'true') = 'true';
  v_minima integer := coalesce((auto_cfg('lista_nota_minima'))::text::integer, 40);
  v_etapa uuid := (select id from crm_etapas where funil_id = 'materia' and nome = 'Novo');
  v_pos integer := 0;
  v_vaga integer;
  r record;
  v_neg uuid;
  n_blocos jsonb := '{}'::jsonb;
begin
  if auth.uid() is not null and not crm_tem_acesso() then
    raise exception 'Acesso restrito à equipe do CRM.';
  end if;
  delete from auto_lista_diaria where dia = v_dia and status = 'listado';

  -- Bloco 1 · Quentes: respondeu nos últimos 10 dias, ação prevista até hoje, briefing/prévia aguardando
  v_vaga := coalesce((v_blocos->>'quentes')::integer, 40);
  for r in
    select n.id as negocio_id, n.funil_id, n.empresa_id, n.pessoa_id, c.nota,
           case when b.status in ('enviado', 'em_producao') then 'Briefing recebido: produzir e enviar a prévia'
                when b.status = 'previa' then 'Prévia enviada: cobrar a aprovação'
                when b.status = 'aberto' and b.enviado_em is null then 'Briefing aberto: lembrar de preencher'
                when n.proxima_acao_em <= v_dia then coalesce('Ação prevista: ' || n.proxima_acao, 'Ação prevista para hoje')
                else 'Respondeu há pouco: continuar a conversa' end as motivo,
           case when p.whatsapp is not null then 'whatsapp' when p.instagram is not null then 'direct'
                when p.email is not null then 'email' else 'linkedin' end as canal
      from crm_negocios n
      join crm_etapas et on et.id = n.etapa_id and et.tipo = 'aberta'
      left join crm_pessoas p on p.id = n.pessoa_id
      left join auto_briefings b on b.negocio_id = n.id
      left join lateral (select nota from auto_candidatos c where c.negocio_id = n.id limit 1) c on true
     where n.ativo
       and (n.proxima_acao_em <= v_dia
            or b.status in ('enviado', 'em_producao', 'previa')
            or (b.status = 'aberto' and b.created_at < now() - interval '2 days')
            or exists (select 1 from crm_atividades a where a.tipo = 'mensagem_recebida' and a.negocio_id = n.id
                         and a.created_at >= now() - interval '10 days'))
       and not exists (select 1 from auto_exclusoes x where x.pessoa_id = n.pessoa_id or x.empresa_id = n.empresa_id)
     order by (b.status in ('enviado', 'em_producao')) desc, n.proxima_acao_em nulls last, n.updated_at desc
     limit v_vaga
  loop
    v_pos := v_pos + 1;
    insert into auto_lista_diaria (dia, posicao, prioridade, bloco, funil_id, negocio_id, empresa_id, pessoa_id, nota, canal, motivo)
    values (v_dia, v_pos, 1, 'Quentes', r.funil_id, r.negocio_id, r.empresa_id, r.pessoa_id, r.nota, r.canal, r.motivo)
    on conflict (dia, negocio_id) do nothing;
  end loop;
  n_blocos := n_blocos || jsonb_build_object('quentes', v_pos);

  -- Bloco 2 · Virou pauta: protagonistas das matérias, ainda sem contato (oferta de cortesia/destaque)
  v_vaga := coalesce((v_blocos->>'pauta')::integer, 60) + greatest(0, coalesce((v_blocos->>'quentes')::integer, 40) - v_pos);
  for r in
    select c.negocio_id, c.funil_id, c.empresa_id, c.pessoa_id, c.nota,
           'Citada em matéria da IA News em ' || to_char(c.noticia_recente_em, 'DD/MM') || ': oferecer destaque' as motivo,
           case when c.instagram is not null then 'direct' when c.email is not null then 'email' else 'linkedin' end as canal
      from auto_candidatos c
     where c.funil_id = 'materia' and c.virou_pauta and c.nota >= v_minima
       and (c.instagram is not null or c.email is not null or c.linkedin is not null)
       and not exists (select 1 from auto_lista_diaria l where l.dia = v_dia and l.negocio_id = c.negocio_id)
       and not exists (select 1 from auto_fila f where f.negocio_id = c.negocio_id and f.status in ('pendente', 'enviado', 'respondeu'))
       and not exists (select 1 from auto_exclusoes x where x.pessoa_id = c.pessoa_id or x.empresa_id = c.empresa_id)
       and coalesce(auto_ultimo_contato(c.negocio_id, c.pessoa_id, c.empresa_id), '2000-01-01') < now() - make_interval(days => v_reenvio)
     order by c.nota desc, c.noticia_recente_em desc nulls last, c.created_at desc
     limit v_vaga
  loop
    v_pos := v_pos + 1;
    insert into auto_lista_diaria (dia, posicao, prioridade, bloco, funil_id, negocio_id, empresa_id, pessoa_id, nota, canal, motivo)
    values (v_dia, v_pos, 2, 'Virou pauta', r.funil_id, r.negocio_id, r.empresa_id, r.pessoa_id, r.nota, r.canal, r.motivo)
    on conflict (dia, negocio_id) do nothing;
  end loop;
  n_blocos := n_blocos || jsonb_build_object('pauta', v_pos - (n_blocos->>'quentes')::integer);

  -- Bloco 2b · Prospecção: funil de matéria sem menção (listas de fundadores), da maior nota para a menor
  v_vaga := coalesce((v_blocos->>'prospeccao')::integer, 40) + greatest(0, v_vaga - (n_blocos->>'pauta')::integer);
  for r in
    select c.negocio_id, c.funil_id, c.empresa_id, c.pessoa_id, c.nota,
           'Prospecção (nota ' || c.nota || coalesce(', ' || nullif(c.enome, ''), '') || '): oferecer destaque' as motivo,
           case when c.instagram is not null then 'direct' when c.email is not null then 'email' else 'linkedin' end as canal
      from auto_candidatos c
     where c.funil_id = 'materia' and not c.virou_pauta and c.nota >= v_minima
       and (c.instagram is not null or c.email is not null or c.linkedin is not null)
       and not exists (select 1 from auto_lista_diaria l where l.dia = v_dia and l.negocio_id = c.negocio_id)
       and not exists (select 1 from auto_fila f where f.negocio_id = c.negocio_id and f.status in ('pendente', 'enviado', 'respondeu'))
       and not exists (select 1 from auto_exclusoes x where x.pessoa_id = c.pessoa_id or x.empresa_id = c.empresa_id)
       and coalesce(auto_ultimo_contato(c.negocio_id, c.pessoa_id, c.empresa_id), '2000-01-01') < now() - make_interval(days => v_reenvio)
     order by c.nota desc, c.created_at desc
     limit v_vaga
  loop
    v_pos := v_pos + 1;
    insert into auto_lista_diaria (dia, posicao, prioridade, bloco, funil_id, negocio_id, empresa_id, pessoa_id, nota, canal, motivo)
    values (v_dia, v_pos, 2, 'Prospecção', r.funil_id, r.negocio_id, r.empresa_id, r.pessoa_id, r.nota, r.canal, r.motivo)
    on conflict (dia, negocio_id) do nothing;
  end loop;

  -- Bloco 3 · Inbound: veio pelo site (formulário de pauta, contato, newsletter) e ainda não foi respondido
  v_vaga := coalesce((v_blocos->>'inbound')::integer, 20);
  for r in
    select n.id as negocio_id, n.funil_id, n.empresa_id, n.pessoa_id, c.nota,
           case when n.pauta_lead_id is not null then 'Pediu pauta pelo site'
                when n.contact_message_id is not null then 'Mandou mensagem pelo site'
                else 'Veio da newsletter' end || ': responder hoje' as motivo,
           case when p.whatsapp is not null then 'whatsapp' when p.email is not null then 'email'
                when p.instagram is not null then 'direct' else 'linkedin' end as canal
      from crm_negocios n
      join crm_etapas et on et.id = n.etapa_id and et.tipo = 'aberta' and et.ordem <= 2
      left join crm_pessoas p on p.id = n.pessoa_id
      left join lateral (select nota from auto_candidatos c where c.negocio_id = n.id limit 1) c on true
     where n.ativo and (n.pauta_lead_id is not null or n.contact_message_id is not null or n.origem in ('newsletter', 'site', 'formulario'))
       and not exists (select 1 from crm_atividades a where a.tipo = 'mensagem_enviada' and a.negocio_id = n.id)
       and not exists (select 1 from auto_lista_diaria l where l.dia = v_dia and l.negocio_id = n.id)
       and not exists (select 1 from auto_exclusoes x where x.pessoa_id = n.pessoa_id or x.empresa_id = n.empresa_id)
     order by n.created_at desc
     limit v_vaga
  loop
    v_pos := v_pos + 1;
    insert into auto_lista_diaria (dia, posicao, prioridade, bloco, funil_id, negocio_id, empresa_id, pessoa_id, nota, canal, motivo)
    values (v_dia, v_pos, 3, 'Inbound', r.funil_id, r.negocio_id, r.empresa_id, r.pessoa_id, r.nota, r.canal, r.motivo)
    on conflict (dia, negocio_id) do nothing;
  end loop;

  -- Bloco 4 · Publicidade: funil de publicidade, sem contato recente
  v_vaga := coalesce((v_blocos->>'publicidade')::integer, 30);
  for r in
    select c.negocio_id, c.funil_id, c.empresa_id, c.pessoa_id, c.nota,
           'Potencial anunciante (' || coalesce(e.setor, 'setor não informado') || '): enviar mídia kit' as motivo,
           case when c.email is not null then 'email' when c.linkedin is not null then 'linkedin' else 'direct' end as canal
      from auto_candidatos c
      left join crm_empresas e on e.id = c.empresa_id
     where c.funil_id = 'publicidade' and c.nota >= v_minima
       and (c.instagram is not null or c.email is not null or c.linkedin is not null)
       and not exists (select 1 from auto_lista_diaria l where l.dia = v_dia and l.negocio_id = c.negocio_id)
       and not exists (select 1 from auto_fila f where f.negocio_id = c.negocio_id and f.status in ('pendente', 'enviado', 'respondeu'))
       and not exists (select 1 from auto_exclusoes x where x.pessoa_id = c.pessoa_id or x.empresa_id = c.empresa_id)
       and coalesce(auto_ultimo_contato(c.negocio_id, c.pessoa_id, c.empresa_id), '2000-01-01') < now() - make_interval(days => v_reenvio)
     order by c.nota desc, c.created_at desc
     limit v_vaga
  loop
    v_pos := v_pos + 1;
    insert into auto_lista_diaria (dia, posicao, prioridade, bloco, funil_id, negocio_id, empresa_id, pessoa_id, nota, canal, motivo)
    values (v_dia, v_pos, 4, 'Publicidade', r.funil_id, r.negocio_id, r.empresa_id, r.pessoa_id, r.nota, r.canal, r.motivo)
    on conflict (dia, negocio_id) do nothing;
  end loop;

  -- Bloco 5 · Parcerias: funil de parcerias na primeira etapa
  v_vaga := coalesce((v_blocos->>'parcerias')::integer, 10);
  for r in
    select n.id as negocio_id, n.funil_id, n.empresa_id, n.pessoa_id, e.pontuacao as nota,
           'Parceria identificada: primeiro contato' as motivo,
           case when p.email is not null then 'email' when p.instagram is not null or e.instagram is not null then 'direct' else 'linkedin' end as canal
      from crm_negocios n
      join crm_etapas et on et.id = n.etapa_id and et.tipo = 'aberta' and et.ordem = 1
      left join crm_empresas e on e.id = n.empresa_id
      left join crm_pessoas p on p.id = n.pessoa_id
     where n.ativo and n.funil_id = 'parcerias'
       and not exists (select 1 from crm_atividades a where a.tipo = 'mensagem_enviada' and a.negocio_id = n.id and a.created_at > now() - make_interval(days => v_reenvio))
       and not exists (select 1 from auto_lista_diaria l where l.dia = v_dia and l.negocio_id = n.id)
     order by e.pontuacao desc nulls last, n.created_at desc
     limit v_vaga
  loop
    v_pos := v_pos + 1;
    insert into auto_lista_diaria (dia, posicao, prioridade, bloco, funil_id, negocio_id, empresa_id, pessoa_id, nota, canal, motivo)
    values (v_dia, v_pos, 5, 'Parcerias', r.funil_id, r.negocio_id, r.empresa_id, r.pessoa_id, r.nota, r.canal, r.motivo)
    on conflict (dia, negocio_id) do nothing;
  end loop;

  -- Bloco 5b · Funis próprios: Evento (convidar), Implementação (lead) e Nutrição (convidar), sem contato recente
  v_vaga := coalesce((v_blocos->>'funis')::integer, 20);
  for r in
    select n.id as negocio_id, n.funil_id, n.empresa_id, n.pessoa_id, coalesce(e.pontuacao, 0) as nota,
           case n.funil_id when 'evento' then 'Palco IA News: convidar (' || et.nome || ', ' || coalesce(n.tipo, 'participante') || ')'
                           when 'implementacao' then 'Implementação: ' || coalesce(et.acao_padrao, 'retomar conversa')
                           else 'Nutrição: ' || coalesce(et.acao_padrao, 'convidar para o canal das 7h') end as motivo,
           case when p.whatsapp is not null then 'whatsapp' when p.instagram is not null then 'direct' when p.email is not null then 'email' else 'linkedin' end as canal
      from crm_negocios n
      join crm_etapas et on et.id = n.etapa_id and et.tipo = 'aberta' and et.ordem <= 2
      left join crm_empresas e on e.id = n.empresa_id
      left join crm_pessoas p on p.id = n.pessoa_id
     where n.ativo and n.funil_id in ('evento', 'implementacao', 'nutricao')
       and (p.whatsapp is not null or p.instagram is not null or p.email is not null or p.linkedin is not null or e.instagram is not null)
       and not exists (select 1 from crm_atividades a where a.tipo = 'mensagem_enviada' and a.negocio_id = n.id and a.created_at > now() - interval '14 days')
       and not exists (select 1 from auto_lista_diaria l where l.dia = v_dia and l.negocio_id = n.id)
       and not exists (select 1 from auto_exclusoes x where x.pessoa_id = n.pessoa_id or x.empresa_id = n.empresa_id)
     order by (n.funil_id = 'evento') desc, (n.tipo in ('vip', 'palestrante', 'expositor', 'patrocinador')) desc, e.pontuacao desc nulls last, n.created_at desc
     limit v_vaga
  loop
    v_pos := v_pos + 1;
    insert into auto_lista_diaria (dia, posicao, prioridade, bloco, funil_id, negocio_id, empresa_id, pessoa_id, nota, canal, motivo)
    values (v_dia, v_pos, 5, case r.funil_id when 'evento' then 'Evento' when 'implementacao' then 'Implementação' else 'Nutrição' end,
            r.funil_id, r.negocio_id, r.empresa_id, r.pessoa_id, r.nota, r.canal, r.motivo)
    on conflict (dia, negocio_id) do nothing;
  end loop;

  -- Bloco 6 · Radar: completa até o total com empresas brasileiras do banco sem negócio aberto e com contato
  v_vaga := greatest(0, v_total - v_pos);
  for r in
    select e.id as empresa_id, e.pontuacao as nota, e.nome,
           p.id as pessoa_id,
           'Radar (grupo ' || coalesce(e.grupo, '-') || ', ' || coalesce(e.setor, 'setor não informado') || '): abrir conversa' as motivo,
           case when coalesce(p.instagram, e.instagram) is not null then 'direct'
                when coalesce(p.email, '') <> '' then 'email' else 'linkedin' end as canal
      from crm_empresas e
      left join lateral (
        select p1.* from crm_pessoas p1 join crm_empresa_pessoas ep on ep.pessoa_id = p1.id
         where ep.empresa_id = e.id and p1.ativo order by ep.decisor desc nulls last, p1.created_at limit 1
      ) p on true
     where e.ativo and coalesce(e.brasileira, true) and not e.e_cliente and not e.e_anunciante
       and coalesce(e.pontuacao, 0) >= v_minima
       and (coalesce(e.instagram, '') <> '' or coalesce(e.linkedin, '') <> '' or coalesce(p.instagram, '') <> '' or coalesce(p.email, '') <> '')
       and not exists (select 1 from crm_negocios n join crm_etapas et on et.id = n.etapa_id
                        where n.empresa_id = e.id and n.ativo and et.tipo = 'aberta')
       and not exists (select 1 from auto_exclusoes x where x.empresa_id = e.id or (p.id is not null and x.pessoa_id = p.id))
       and coalesce(auto_ultimo_contato(null, p.id, e.id), '2000-01-01') < now() - make_interval(days => v_reenvio)
     order by e.pontuacao desc, e.noticia_recente_em desc nulls last, e.created_at desc
     limit v_vaga
  loop
    v_neg := null;
    if v_abrir and v_etapa is not null then
      insert into crm_negocios (titulo, funil_id, etapa_id, etapa_desde, empresa_id, pessoa_id, tipo, origem, canal_origem, ativo)
      values ('Radar · ' || r.nome, 'materia', v_etapa, now(), r.empresa_id, r.pessoa_id, 'destaque_cortesia', 'radar', 'crm', true)
      returning id into v_neg;
    end if;
    v_pos := v_pos + 1;
    insert into auto_lista_diaria (dia, posicao, prioridade, bloco, funil_id, negocio_id, empresa_id, pessoa_id, nota, canal, motivo)
    values (v_dia, v_pos, 6, 'Radar', 'materia', v_neg, r.empresa_id, r.pessoa_id, r.nota, r.canal, r.motivo);
  end loop;

  return jsonb_build_object('ok', true, 'dia', v_dia, 'total', v_pos, 'blocos',
    (select jsonb_object_agg(bloco, n) from (select bloco, count(*) n from auto_lista_diaria where dia = v_dia group by bloco) b));
end $$;

