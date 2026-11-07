-- Lista diária de 200 leads por prioridade, leads das matérias só pela protagonista,
-- e métricas da operação (conteúdo por canal, fila, briefings, negócios).

-- ---------------------------------------------------------------------
-- 1. Leads das matérias: só a empresa protagonista vira negócio.
--    Veículos de imprensa não entram; big techs e instituições viram só menção.
-- ---------------------------------------------------------------------
create or replace function public.auto_registrar_pauta(p_article uuid, p_empresas jsonb, p_pessoas jsonb)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  e jsonb; p jsonb;
  v_emp uuid; v_pes uuid; v_neg uuid;
  v_papel text;
  v_etapa uuid := (select id from crm_etapas where funil_id = 'materia' and nome = 'Novo');
  v_titulo text := (select title from articles where id = p_article);
  n_emp integer := 0; n_neg integer := 0;
begin
  for e in select * from jsonb_array_elements(coalesce(p_empresas, '[]'::jsonb)) loop
    v_papel := coalesce(e->>'papel', 'citada');
    continue when coalesce(e->>'nome', '') = '' or v_papel = 'veiculo';
    continue when (e->>'brasileira') = 'false' and v_papel <> 'protagonista';
    v_emp := crm_achar_ou_criar_empresa(e->>'nome', null, null, null, 'pauta_auto');
    continue when v_emp is null;
    update crm_empresas
       set brasileira = coalesce(brasileira, nullif(e->>'brasileira', '')::boolean),
           noticia_recente_em = greatest(coalesce(noticia_recente_em, crm_hoje()), crm_hoje())
     where id = v_emp;
    insert into crm_mencoes (article_id, empresa_id, papel, ativo)
    values (p_article, v_emp, case when v_papel = 'protagonista' then 'protagonista' else 'citada' end, true)
    on conflict do nothing;
    n_emp := n_emp + 1;
    -- Negócio só para a protagonista brasileira (ou sem país informado), sem negócio aberto e que não seja cliente
    if v_papel = 'protagonista' and coalesce(e->>'brasileira', 'null') <> 'false'
       and not exists (select 1 from crm_negocios n join crm_etapas et on et.id = n.etapa_id
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
    insert into crm_mencoes (article_id, empresa_id, pessoa_id, papel, ativo)
    values (p_article, v_emp, v_pes, case when (p->>'protagonista') = 'true' then 'protagonista' else 'citada' end, true)
    on conflict do nothing;
    update crm_negocios set pessoa_id = v_pes where empresa_id = v_emp and pessoa_id is null and ativo and origem = 'pauta';
  end loop;

  insert into auto_artigos_processados (article_id, empresas) values (p_article, n_emp)
  on conflict (article_id) do update set empresas = excluded.empresas, processado_em = now();
  return jsonb_build_object('ok', true, 'artigo', v_titulo, 'empresas', n_emp, 'negocios', n_neg);
end $$;

-- ---------------------------------------------------------------------
-- 2. Lista diária: até 200 leads por dia, em blocos de prioridade.
-- ---------------------------------------------------------------------
create table if not exists public.auto_lista_diaria (
  id uuid primary key default gen_random_uuid(),
  dia date not null,
  posicao integer not null,
  prioridade integer not null,              -- 1 quente … 6 radar
  bloco text not null,                      -- rótulo do bloco
  funil_id text,
  negocio_id uuid references public.crm_negocios(id) on delete cascade,
  empresa_id uuid references public.crm_empresas(id) on delete set null,
  pessoa_id uuid references public.crm_pessoas(id) on delete set null,
  nota integer,
  canal text,                               -- canal sugerido
  motivo text,
  status text not null default 'listado' check (status in ('listado', 'na_fila', 'contatado', 'respondeu', 'descartado')),
  fila_id uuid references public.auto_fila(id) on delete set null,
  created_at timestamptz not null default now(),
  unique (dia, negocio_id)
);
create index if not exists auto_lista_diaria_dia_idx on public.auto_lista_diaria (dia, posicao);
alter table public.auto_lista_diaria enable row level security;
drop policy if exists auto_lista_diaria_equipe on public.auto_lista_diaria;
create policy auto_lista_diaria_equipe on public.auto_lista_diaria for all to authenticated
  using (crm_tem_acesso()) with check (crm_tem_acesso());

insert into public.auto_config (chave, valor, descricao) values
  ('lista_tamanho', '200', 'Quantos leads entram na lista diária'),
  ('lista_blocos', '{"quentes":40,"pauta":60,"inbound":20,"publicidade":30,"parcerias":10,"radar":40}', 'Vagas por bloco da lista diária (o que sobra vai para o próximo bloco)'),
  ('lista_abrir_negocios_radar', 'true', 'Abrir negócio no funil de matéria para empresas do radar que entram na lista'),
  ('horario_destaque_lead', '"15:00"', 'Hora (Brasília) do destaque de lead no Instagram e no site'),
  ('max_destaques_dia', '1', 'Quantos destaques de lead por dia')
on conflict (chave) do nothing;

-- Último contato (enviado ou recebido) com a pessoa/empresa/negócio
create or replace function public.auto_ultimo_contato(p_negocio uuid, p_pessoa uuid, p_empresa uuid)
returns timestamptz language sql stable set search_path = public as $$
  select max(a.created_at) from crm_atividades a
   where a.tipo in ('mensagem_enviada', 'mensagem_recebida')
     and (a.negocio_id = p_negocio or (p_pessoa is not null and a.pessoa_id = p_pessoa)
          or (p_empresa is not null and a.empresa_id = p_empresa));
$$;

create or replace function public.auto_montar_lista(p_dia date default null)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_dia date := coalesce(p_dia, crm_hoje());
  v_total integer := coalesce((auto_cfg('lista_tamanho'))::text::integer, 200);
  v_blocos jsonb := coalesce(auto_cfg('lista_blocos'), '{}'::jsonb);
  v_corte integer := coalesce((auto_cfg('nota_corte'))::text::integer, 50);
  v_reenvio integer := coalesce((auto_cfg('reenvio_minimo_dias'))::text::integer, 90);
  v_abrir boolean := coalesce((auto_cfg('lista_abrir_negocios_radar'))::text, 'true') = 'true';
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
     where c.funil_id = 'materia' and c.virou_pauta
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
     where c.funil_id = 'publicidade' and c.nota >= v_corte
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
       and coalesce(e.pontuacao, 0) >= v_corte
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

-- A fila do dia atualiza o status da lista (na_fila → contatado → respondeu)
create or replace function public.auto_lista_sincronizar()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  update auto_lista_diaria l
     set status = case when new.status = 'respondeu' then 'respondeu'
                       when new.status = 'enviado' then 'contatado'
                       when new.status in ('pulado', 'falhou', 'expirado') then l.status
                       else 'na_fila' end,
         fila_id = new.id
   where l.negocio_id = new.negocio_id and l.dia >= new.dia - 7 and l.status <> 'descartado';
  return new;
end $$;
drop trigger if exists auto_lista_sincronizar on public.auto_fila;
create trigger auto_lista_sincronizar after insert or update of status on public.auto_fila
  for each row execute function public.auto_lista_sincronizar();

-- Resumo da lista do dia
create or replace function public.auto_lista_resumo(p_dia date default null)
returns jsonb language sql stable security definer set search_path = public as $$
  with d as (select coalesce(p_dia, crm_hoje()) as dia)
  select jsonb_build_object(
    'dia', (select dia from d),
    'total', (select count(*) from auto_lista_diaria l, d where l.dia = d.dia),
    'por_bloco', (select coalesce(jsonb_object_agg(bloco, n), '{}'::jsonb) from (
        select bloco, count(*) n from auto_lista_diaria l, d where l.dia = d.dia group by bloco) x),
    'por_status', (select coalesce(jsonb_object_agg(status, n), '{}'::jsonb) from (
        select status, count(*) n from auto_lista_diaria l, d where l.dia = d.dia group by status) x),
    'por_canal', (select coalesce(jsonb_object_agg(canal, n), '{}'::jsonb) from (
        select coalesce(canal, '-') canal, count(*) n from auto_lista_diaria l, d where l.dia = d.dia group by canal) x)
  );
$$;

-- ---------------------------------------------------------------------
-- 3. Métricas da operação, dia a dia (conteúdo, newsletter, fila, briefings, negócios)
-- ---------------------------------------------------------------------
create or replace function public.auto_metricas(p_dias integer default 14, p_futuro integer default 30)
returns jsonb language sql stable security definer set search_path = public as $$
  with dias as (
    select d::date as dia from generate_series(crm_hoje() - make_interval(days => greatest(p_dias, 1) - 1), crm_hoje() + make_interval(days => greatest(p_futuro, 0)), interval '1 day') d
  ),
  art as (
    select (published_at at time zone 'America/Sao_Paulo')::date as dia,
           count(*) filter (where status = 'published') as materias,
           count(*) filter (where status = 'published' and origin = 'instagram') as de_instagram,
           count(*) filter (where status = 'published' and origin = 'newsletter') as de_newsletter,
           count(*) filter (where status = 'draft') as rascunhos,
           count(*) filter (where status = 'published' and (cover_image_url is null or cover_image_url not like '%/covers/%')) as sem_capa,
           jsonb_agg(jsonb_build_object('hora', to_char(published_at at time zone 'America/Sao_Paulo', 'HH24:MI'), 'titulo', left(title, 80), 'slug', slug) order by published_at)
             filter (where status = 'published' and published_at > now()) as agenda
      from articles
     where published_at >= crm_hoje() - make_interval(days => p_dias) and published_at < crm_hoje() + make_interval(days => p_futuro + 1)
     group by 1
  ),
  cont as (
    select (publicado_em at time zone 'America/Sao_Paulo')::date as dia,
           jsonb_object_agg(canal, n) as por_canal
      from (select canal, publicado_em, count(*) n from crm_conteudos where ativo and publicado_em is not null
             and publicado_em >= crm_hoje() - make_interval(days => p_dias) group by canal, publicado_em) c
     group by 1
  ),
  news as (
    select edition_date as dia, sum(recipients_count) as destinatarios, sum(delivered_count) as entregues, count(*) as envios
      from newsletter_sends where edition_date >= crm_hoje() - make_interval(days => p_dias) group by 1
  ),
  fila as (
    select dia,
           count(*) filter (where passo = 'D0') as primeiros,
           count(*) filter (where passo <> 'D0') as followups,
           count(*) filter (where status = 'enviado') as enviados,
           count(*) filter (where status = 'respondeu') as respondeu,
           (select jsonb_object_agg(canal, n) from (select canal, count(*) n from auto_fila f2 where f2.dia = f.dia group by canal) z) as por_canal
      from auto_fila f
     where dia >= crm_hoje() - make_interval(days => p_dias)
     group by 1
  ),
  brief as (
    select d.dia,
           (select count(*) from auto_briefings b where (b.created_at at time zone 'America/Sao_Paulo')::date = d.dia) as criados,
           (select count(*) from auto_briefings b where (b.enviado_em at time zone 'America/Sao_Paulo')::date = d.dia) as enviados,
           (select count(*) from auto_briefings b where (b.aprovado_em at time zone 'America/Sao_Paulo')::date = d.dia) as aprovados
      from dias d
  ),
  neg as (
    select (created_at at time zone 'America/Sao_Paulo')::date as dia, jsonb_object_agg(funil_id, n) as por_funil, sum(n) as total
      from (select funil_id, created_at, count(*) n from crm_negocios where created_at >= crm_hoje() - make_interval(days => p_dias) group by 1, 2) x
     group by 1
  ),
  lista as (
    select dia, count(*) as total, count(*) filter (where status in ('contatado', 'respondeu')) as contatados,
           count(*) filter (where status = 'respondeu') as responderam
      from auto_lista_diaria where dia >= crm_hoje() - make_interval(days => p_dias) group by 1
  )
  select jsonb_build_object(
    'hoje', crm_hoje(),
    'dias', (select jsonb_agg(jsonb_build_object(
        'dia', d.dia,
        'futuro', d.dia > crm_hoje(),
        'materias', coalesce(a.materias, 0), 'de_instagram', coalesce(a.de_instagram, 0), 'de_newsletter', coalesce(a.de_newsletter, 0),
        'rascunhos', coalesce(a.rascunhos, 0), 'sem_capa', coalesce(a.sem_capa, 0), 'agenda', coalesce(a.agenda, '[]'::jsonb),
        'posts', coalesce(c.por_canal, '{}'::jsonb),
        'newsletter', jsonb_build_object('envios', coalesce(n.envios, 0), 'destinatarios', coalesce(n.destinatarios, 0), 'entregues', coalesce(n.entregues, 0)),
        'fila', jsonb_build_object('primeiros', coalesce(f.primeiros, 0), 'followups', coalesce(f.followups, 0), 'enviados', coalesce(f.enviados, 0), 'respondeu', coalesce(f.respondeu, 0), 'por_canal', coalesce(f.por_canal, '{}'::jsonb)),
        'briefings', jsonb_build_object('criados', coalesce(b.criados, 0), 'enviados', coalesce(b.enviados, 0), 'aprovados', coalesce(b.aprovados, 0)),
        'negocios', jsonb_build_object('total', coalesce(g.total, 0), 'por_funil', coalesce(g.por_funil, '{}'::jsonb)),
        'lista', jsonb_build_object('total', coalesce(l.total, 0), 'contatados', coalesce(l.contatados, 0), 'responderam', coalesce(l.responderam, 0))
      ) order by d.dia)
      from dias d
      left join art a on a.dia = d.dia
      left join cont c on c.dia = d.dia
      left join news n on n.dia = d.dia
      left join fila f on f.dia = d.dia
      left join brief b on b.dia = d.dia
      left join neg g on g.dia = d.dia
      left join lista l on l.dia = d.dia),
    'totais', jsonb_build_object(
      'materias_publicadas', (select count(*) from articles where status = 'published' and published_at <= now()),
      'materias_agendadas', (select count(*) from articles where status = 'published' and published_at > now()),
      'rascunhos', (select count(*) from articles where status = 'draft'),
      'assinantes_ativos', (select count(*) from leads where is_active),
      'negocios_abertos', (select count(*) from crm_negocios n join crm_etapas e on e.id = n.etapa_id where n.ativo and e.tipo = 'aberta'),
      'briefings_aguardando', (select count(*) from auto_briefings where status in ('enviado', 'em_producao')),
      'previas_aguardando', (select count(*) from auto_briefings where status = 'previa'),
      'empresas', (select count(*) from crm_empresas where ativo),
      'pessoas', (select count(*) from crm_pessoas where ativo)
    )
  );
$$;

do $$ declare f text; begin
  foreach f in array array['auto_montar_lista(date)', 'auto_lista_resumo(date)', 'auto_metricas(integer, integer)', 'auto_ultimo_contato(uuid, uuid, uuid)'] loop
    execute format('revoke execute on function public.%s from public, anon', f);
    execute format('grant execute on function public.%s to authenticated, service_role', f);
  end loop;
end $$;
revoke execute on function public.auto_lista_sincronizar() from public, anon, authenticated;

-- 7h em Brasília, todo dia: lista de 200 (a fila das 7h20 sai dela nos dias úteis)
select cron.unschedule(jobid) from cron.job where jobname = 'ianews-auto-lista';
select cron.schedule('ianews-auto-lista', '0 10 * * *', $$select public.auto_montar_lista()$$);
