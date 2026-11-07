-- Máquina comercial da IA News (plano de automação, 06/11/2026).
-- Tudo aditivo: tabelas auto_*, funções auto_* e duas rotinas no pg_cron.
-- Regra central: o sistema monta a fila e escreve as mensagens; o primeiro contato frio no
-- Direct e no LinkedIn sai com um clique humano, dentro do limite diário de cada canal.

-- ---------------------------------------------------------------------
-- 1. Configuração (limites, nota de corte, sequência)
-- ---------------------------------------------------------------------
create table if not exists public.auto_config (
  chave text primary key,
  valor jsonb not null,
  descricao text,
  updated_at timestamptz not null default now()
);

insert into public.auto_config (chave, valor, descricao) values
  ('pausado', 'false', 'true pausa a montagem da fila e todos os envios automáticos'),
  ('limites', '{"email": 25, "direct": 20, "linkedin": 15, "whatsapp": 0}',
   'Primeiros contatos (D0) por dia, por canal. WhatsApp frio é sempre 0.'),
  ('nota_corte', '50', 'Nota mínima da empresa (0 a 100) para entrar na fila de primeiro contato'),
  ('reenvio_minimo_dias', '90', 'Dias sem contato antes de uma pessoa poder voltar à fila'),
  ('sequencia', '[{"passo":"D3","dias":3},{"passo":"D7","dias":7},{"passo":"D15","dias":15,"troca_canal":true},{"passo":"D21","dias":21}]',
   'Follow-ups depois do D0, em dias corridos desde o envio do D0'),
  ('email_frio_ativo', 'false', 'true liga o envio automático do e-mail frio (precisa do domínio de prospecção)'),
  ('email_rejeicao_max', '0.03', 'Taxa de rejeição de e-mail que pausa o envio automático')
on conflict (chave) do nothing;

create or replace function public.auto_cfg(p_chave text)
returns jsonb language sql stable security definer set search_path = public as $$
  select valor from auto_config where chave = p_chave;
$$;

-- ---------------------------------------------------------------------
-- 2. Lista de exclusão (nunca contatar)
-- ---------------------------------------------------------------------
create table if not exists public.auto_exclusoes (
  id uuid primary key default gen_random_uuid(),
  pessoa_id uuid references public.crm_pessoas(id) on delete cascade,
  empresa_id uuid references public.crm_empresas(id) on delete cascade,
  instagram text,
  email text,
  motivo text not null default 'pedido',
  created_at timestamptz not null default now()
);
create index if not exists auto_exclusoes_pessoa on public.auto_exclusoes (pessoa_id);
create index if not exists auto_exclusoes_empresa on public.auto_exclusoes (empresa_id);

-- ---------------------------------------------------------------------
-- 3. Fila diária de contatos
-- ---------------------------------------------------------------------
create table if not exists public.auto_fila (
  id uuid primary key default gen_random_uuid(),
  dia date not null default public.crm_hoje(),
  canal text not null check (canal in ('email', 'direct', 'linkedin', 'whatsapp')),
  passo text not null check (passo in ('D0', 'D3', 'D7', 'D15', 'D21')),
  negocio_id uuid not null references public.crm_negocios(id) on delete cascade,
  empresa_id uuid references public.crm_empresas(id) on delete set null,
  pessoa_id uuid references public.crm_pessoas(id) on delete set null,
  nota integer,
  destino text,
  link text,
  assunto text,
  mensagem text not null,
  status text not null default 'pendente'
    check (status in ('pendente', 'enviado', 'pulado', 'respondeu', 'falhou', 'expirado')),
  automatico boolean not null default false,
  enviado_em timestamptz,
  enviado_por uuid,
  motivo text,
  created_at timestamptz not null default now(),
  unique (negocio_id, passo)
);
create index if not exists auto_fila_dia on public.auto_fila (dia, canal, status);
create index if not exists auto_fila_pessoa on public.auto_fila (pessoa_id);

-- Modelo de mensagem usado em cada passo da sequência
alter table public.crm_modelos add column if not exists passo_auto text;

update public.crm_modelos set passo_auto = 'D0' where nome in ('1ª mensagem · Direct', '1ª mensagem · E-mail', 'LinkedIn · Convite sem pitch') and passo_auto is null;
update public.crm_modelos set passo_auto = 'D0_pauta' where nome = 'Viraram pauta · 1º contato' and passo_auto is null;
update public.crm_modelos set passo_auto = 'D3' where nome = 'Follow-up curto' and passo_auto is null;
update public.crm_modelos set passo_auto = 'D7' where nome = 'Remarketing · Conteúdo novo' and passo_auto is null;

insert into public.crm_modelos (nome, canal, texto, ordem, ativo, passo_auto)
select 'Encerramento · D21', 'direct',
  E'Oi, {nome}! Tudo bem?\n\nComo não conseguimos conversar, vou encerrar por aqui o convite para a {empresa}. Fica à vontade para me chamar quando fizer sentido: a porta da IA News continua aberta.\n\nUm abraço,\nRenata',
  90, true, 'D21'
where not exists (select 1 from public.crm_modelos where passo_auto = 'D21');

insert into public.crm_modelos (nome, canal, texto, ordem, ativo, passo_auto)
select 'Follow-up curto · E-mail', 'email',
  E'Oi, {nome}! Passando só para saber se você viu minha mensagem sobre a {empresa}. Se fizer sentido, me responde por aqui que eu te envio os detalhes.\n\nRenata · IA News',
  91, true, 'D3'
where not exists (select 1 from public.crm_modelos where passo_auto = 'D3' and canal = 'email');

insert into public.crm_modelos (nome, canal, texto, ordem, ativo, passo_auto)
select 'Encerramento · D21 · E-mail', 'email',
  E'Oi, {nome}! Como não conseguimos conversar, vou encerrar por aqui o convite para a {empresa}. Se em outro momento fizer sentido, é só responder este e-mail.\n\nUm abraço,\nRenata · IA News',
  92, true, 'D21'
where not exists (select 1 from public.crm_modelos where passo_auto = 'D21' and canal = 'email');

-- ---------------------------------------------------------------------
-- 4. Eventos de canal (bloqueio, denúncia, rejeição) para as travas
-- ---------------------------------------------------------------------
create table if not exists public.auto_eventos_canal (
  id uuid primary key default gen_random_uuid(),
  dia date not null default public.crm_hoje(),
  canal text not null,
  tipo text not null check (tipo in ('bloqueio', 'denuncia', 'rejeicao_email', 'descadastro', 'sem_interesse', 'restricao_conta')),
  pessoa_id uuid references public.crm_pessoas(id) on delete set null,
  detalhe text,
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------
-- 5. Briefing em formulário (link com token, sem login)
-- ---------------------------------------------------------------------
create table if not exists public.auto_briefings (
  id uuid primary key default gen_random_uuid(),
  token uuid not null unique default gen_random_uuid(),
  negocio_id uuid not null unique references public.crm_negocios(id) on delete cascade,
  pessoa_id uuid references public.crm_pessoas(id) on delete set null,
  empresa_id uuid references public.crm_empresas(id) on delete set null,
  tipo text not null default 'cortesia' check (tipo in ('pago', 'cortesia')),
  status text not null default 'aberto' check (status in ('aberto', 'enviado', 'em_producao', 'previa', 'aprovado', 'ajuste')),
  dados jsonb not null default '{}'::jsonb,
  fotos text[] not null default '{}',
  enviado_em timestamptz,
  lembrete_d2_em timestamptz,
  lembrete_d5_em timestamptz,
  previa_url text,
  aprovado_em timestamptz,
  ajuste_pedido text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------
-- 6. Pagamentos (link de cobrança e baixa automática)
-- ---------------------------------------------------------------------
create table if not exists public.auto_pagamentos (
  id uuid primary key default gen_random_uuid(),
  negocio_id uuid not null references public.crm_negocios(id) on delete cascade,
  valor numeric not null check (valor > 0),
  gateway text not null default 'manual',
  external_id text unique,
  link text,
  forma text,
  status text not null default 'pendente' check (status in ('pendente', 'pago', 'cancelado', 'estornado')),
  pago_em timestamptz,
  payload jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists auto_pagamentos_negocio on public.auto_pagamentos (negocio_id);

-- ---------------------------------------------------------------------
-- 7. Acesso: só a equipe do CRM; configuração só o admin
-- ---------------------------------------------------------------------
alter table public.auto_config enable row level security;
alter table public.auto_exclusoes enable row level security;
alter table public.auto_fila enable row level security;
alter table public.auto_eventos_canal enable row level security;
alter table public.auto_briefings enable row level security;
alter table public.auto_pagamentos enable row level security;

drop policy if exists auto_config_ler on public.auto_config;
create policy auto_config_ler on public.auto_config for select to authenticated using (public.crm_tem_acesso());
drop policy if exists auto_config_admin on public.auto_config;
create policy auto_config_admin on public.auto_config for update to authenticated
  using (public.crm_e_admin()) with check (public.crm_e_admin());

do $$
declare t text;
begin
  foreach t in array array['auto_exclusoes', 'auto_fila', 'auto_eventos_canal', 'auto_briefings', 'auto_pagamentos'] loop
    execute format('drop policy if exists %I on public.%I', t || '_equipe', t);
    execute format('create policy %I on public.%I for all to authenticated using (public.crm_tem_acesso()) with check (public.crm_tem_acesso())', t || '_equipe', t);
  end loop;
end $$;

-- ---------------------------------------------------------------------
-- 8. Funções da fila
-- ---------------------------------------------------------------------
create or replace function public.auto_preencher(p_texto text, p_nome text, p_empresa text, p_link text default null)
returns text language sql immutable set search_path = public as $$
  select replace(replace(replace(replace(coalesce(p_texto, ''),
    '{nome}', coalesce(nullif(split_part(trim(coalesce(p_nome, '')), ' ', 1), ''), nullif(trim(p_empresa), ''), 'tudo bem')),
    '{empresa}', coalesce(nullif(trim(p_empresa), ''), 'sua empresa')),
    '{link_materia}', coalesce(p_link, '')),
    '{link_post}', '');
$$;

create or replace function public.auto_modelo(p_passo text, p_canal text)
returns text language sql stable security definer set search_path = public as $$
  select texto from crm_modelos
   where ativo and passo_auto = p_passo
   order by (canal = p_canal) desc, ordem
   limit 1;
$$;

create or replace function public.auto_destino(p_canal text, p_instagram text, p_email text, p_linkedin text)
returns table (destino text, link text) language sql immutable set search_path = public as $$
  select
    case p_canal
      when 'direct' then '@' || regexp_replace(regexp_replace(p_instagram, '^https?://(www\.)?instagram\.com/', ''), '[/@?].*$|^@', '', 'g')
      when 'email' then p_email
      when 'linkedin' then p_linkedin
    end,
    case p_canal
      when 'direct' then 'https://www.instagram.com/' || regexp_replace(regexp_replace(p_instagram, '^https?://(www\.)?instagram\.com/', ''), '^@|/.*$', '', 'g') || '/'
      when 'email' then 'mailto:' || p_email
      when 'linkedin' then case when p_linkedin ~* '^https?://' then p_linkedin else 'https://' || p_linkedin end
    end;
$$;

-- Monta a fila do dia: primeiro os follow-ups devidos, depois os primeiros contatos até o limite.
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

  -- Pendentes de dias anteriores expiram (voltam a ser elegíveis amanhã)
  update auto_fila set status = 'expirado' where status = 'pendente' and dia < v_dia;
  get diagnostics n_exp = row_count;
  delete from auto_fila where status = 'expirado' and passo = 'D0' and dia < v_dia;

  -- Follow-ups: D0 enviado, sem resposta, passo devido e ainda não criado
  for s in select * from jsonb_array_elements(v_seq) loop
    for r in
      select f0.negocio_id, f0.pessoa_id, f0.empresa_id, f0.canal as canal0, f0.nota,
             p.nome as pnome, p.instagram, p.email, p.linkedin, e.nome as enome
        from auto_fila f0
        join crm_negocios n on n.id = f0.negocio_id and n.ativo
        join crm_etapas et on et.id = n.etapa_id and et.tipo = 'aberta'
        left join crm_pessoas p on p.id = f0.pessoa_id
        left join crm_empresas e on e.id = f0.empresa_id
       where f0.passo = 'D0' and f0.status = 'enviado'
         and f0.enviado_em::date + (s->>'dias')::integer <= v_dia
         and not exists (select 1 from auto_fila x where x.negocio_id = f0.negocio_id and x.status in ('respondeu', 'pulado') and x.motivo = 'parar')
         and not exists (select 1 from auto_fila x where x.negocio_id = f0.negocio_id and x.status = 'respondeu')
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
      -- No LinkedIn o follow-up só faz sentido depois de a pessoa aceitar o convite
      if v_canal = 'linkedin' and (s->>'passo') in ('D3', 'D7') then continue; end if;
      v_texto := auto_modelo(case when (s->>'passo') = 'D15' then 'D0' else s->>'passo' end, v_canal);
      continue when v_texto is null;
      select * into v_d from auto_destino(v_canal, r.instagram, r.email, r.linkedin);
      insert into auto_fila (dia, canal, passo, negocio_id, empresa_id, pessoa_id, nota, destino, link, assunto, mensagem, automatico)
      values (v_dia, v_canal, s->>'passo', r.negocio_id, r.empresa_id, r.pessoa_id, r.nota, v_d.destino, v_d.link,
              case when v_canal = 'email' then 'IA News · ' || coalesce(r.enome, 'convite') end,
              auto_preencher(v_texto, r.pnome, r.enome),
              v_canal = 'email' and coalesce((auto_cfg('email_frio_ativo'))::text, 'false') = 'true')
      on conflict (negocio_id, passo) do nothing;
      n_follow := n_follow + 1;
    end loop;
  end loop;

  -- Vagas restantes de primeiro contato por canal
  select jsonb_object_agg(k, greatest(0, coalesce((v_lim->>k)::integer, 0) -
           (select count(*) from auto_fila f where f.dia = v_dia and f.canal = k and f.passo = 'D0')))
    into v_resto
    from unnest(array['direct', 'email', 'linkedin']) k;

  -- Primeiros contatos: negócio aberto na 1ª etapa, nota acima do corte, canal disponível
  for r in
    select n.id as negocio_id, e.id as empresa_id, p.id as pessoa_id, e.pontuacao as nota,
           p.nome as pnome, e.nome as enome, p.instagram, p.email, p.linkedin,
           exists (select 1 from crm_mencoes m where m.empresa_id = e.id and m.ativo) as virou_pauta
      from crm_negocios n
      join crm_etapas et on et.id = n.etapa_id and et.ordem = 1 and et.tipo = 'aberta'
      join crm_empresas e on e.id = n.empresa_id and e.ativo
      join lateral (
        select p1.* from crm_pessoas p1
         where p1.ativo and (p1.id = n.pessoa_id
                or (n.pessoa_id is null and p1.id in (select ep.pessoa_id from crm_empresa_pessoas ep where ep.empresa_id = e.id)))
         order by (p1.id = n.pessoa_id) desc nulls last, p1.created_at
         limit 1
      ) p on true
     where n.ativo and n.funil_id in ('materia', 'publicidade')
       and coalesce(e.pontuacao, 0) >= v_corte
       and (coalesce(p.instagram, '') <> '' or coalesce(p.email, '') <> '' or coalesce(p.linkedin, '') <> '')
       and not exists (select 1 from auto_fila f where f.negocio_id = n.id)
       and not exists (select 1 from auto_exclusoes x where x.pessoa_id = p.id or x.empresa_id = e.id
                         or (x.instagram is not null and lower(x.instagram) = lower(p.instagram))
                         or (x.email is not null and lower(x.email) = lower(p.email)))
       and not exists (select 1 from crm_atividades a where a.tipo in ('mensagem_enviada', 'mensagem_recebida')
                         and (a.pessoa_id = p.id or a.empresa_id = e.id)
                         and a.created_at >= now() - make_interval(days => v_reenvio))
     order by e.pontuacao desc, e.noticia_recente_em desc nulls last, n.created_at
  loop
    v_canal := case
      when coalesce(r.instagram, '') <> '' and (v_resto->>'direct')::integer > 0 then 'direct'
      when coalesce(r.email, '') <> '' and (v_resto->>'email')::integer > 0 then 'email'
      when coalesce(r.linkedin, '') <> '' and (v_resto->>'linkedin')::integer > 0 then 'linkedin'
      else null end;
    continue when v_canal is null;
    v_texto := case when r.virou_pauta and v_canal = 'direct' then auto_modelo('D0_pauta', v_canal) end;
    v_texto := coalesce(v_texto, auto_modelo('D0', v_canal));
    continue when v_texto is null;
    select * into v_d from auto_destino(v_canal, r.instagram, r.email, r.linkedin);
    insert into auto_fila (dia, canal, passo, negocio_id, empresa_id, pessoa_id, nota, destino, link, assunto, mensagem, automatico)
    values (v_dia, v_canal, 'D0', r.negocio_id, r.empresa_id, r.pessoa_id, r.nota, v_d.destino, v_d.link,
            case when v_canal = 'email' then 'IA News · convite para a ' || coalesce(r.enome, 'sua empresa') end,
            auto_preencher(v_texto, r.pnome, r.enome),
            v_canal = 'email' and coalesce((auto_cfg('email_frio_ativo'))::text, 'false') = 'true')
    on conflict (negocio_id, passo) do nothing;
    v_resto := jsonb_set(v_resto, array[v_canal], to_jsonb((v_resto->>v_canal)::integer - 1));
    n_d0 := n_d0 + 1;
    exit when (v_resto->>'direct')::integer <= 0 and (v_resto->>'email')::integer <= 0 and (v_resto->>'linkedin')::integer <= 0;
  end loop;

  return jsonb_build_object('ok', true, 'dia', v_dia, 'primeiros_contatos', n_d0, 'follow_ups', n_follow, 'expirados', n_exp, 'vagas_restantes', v_resto);
end $$;

-- Marca um item da fila (botões da tela Fila do dia)
create or replace function public.auto_marcar(p_id uuid, p_status text, p_motivo text default null)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  f auto_fila%rowtype;
  v_etapa uuid;
  v_funil text;
  v_canal_atv text;
begin
  if not crm_tem_acesso() and coalesce(auth.role(), '') <> 'service_role' then
    raise exception 'Acesso restrito à equipe do CRM.';
  end if;
  if p_status not in ('enviado', 'pulado', 'respondeu', 'falhou', 'pendente') then
    raise exception 'Status inválido.';
  end if;

  update auto_fila set status = p_status,
         enviado_em = case when p_status = 'enviado' then now() else enviado_em end,
         enviado_por = case when p_status = 'enviado' then auth.uid() else enviado_por end,
         motivo = coalesce(p_motivo, motivo)
   where id = p_id returning * into f;
  if f.id is null then raise exception 'Item da fila não encontrado.'; end if;

  if p_status = 'enviado' then
    v_canal_atv := case f.canal when 'direct' then 'instagram' else f.canal end;
    insert into crm_atividades (tipo, canal, texto, empresa_id, pessoa_id, negocio_id, autor_id)
    values ('mensagem_enviada', v_canal_atv, '[' || f.passo || '] ' || left(f.mensagem, 900), f.empresa_id, f.pessoa_id, f.negocio_id, auth.uid());

    select funil_id into v_funil from crm_negocios where id = f.negocio_id;
    if f.passo = 'D0' then
      select e2.id into v_etapa from crm_negocios n join crm_etapas e1 on e1.id = n.etapa_id
        join crm_etapas e2 on e2.funil_id = n.funil_id and e2.ordem = 2
       where n.id = f.negocio_id and e1.ordem = 1;
    elsif f.passo = 'D21' and v_funil = 'materia' then
      select id into v_etapa from crm_etapas where funil_id = 'materia' and nome = 'Sem resposta';
    end if;
    if v_etapa is not null then
      update crm_negocios set etapa_id = v_etapa, etapa_desde = now() where id = f.negocio_id;
    end if;
  elsif p_status = 'pulado' and p_motivo = 'sem_interesse' then
    insert into auto_exclusoes (pessoa_id, empresa_id, motivo) values (f.pessoa_id, f.empresa_id, 'sem_interesse');
    insert into auto_eventos_canal (canal, tipo, pessoa_id) values (f.canal, 'sem_interesse', f.pessoa_id);
    update auto_fila set status = 'pulado', motivo = 'parar' where negocio_id = f.negocio_id and status = 'pendente';
  elsif p_status = 'respondeu' then
    update auto_fila set status = 'respondeu' where negocio_id = f.negocio_id and status = 'pendente';
  end if;
  return jsonb_build_object('ok', true, 'id', f.id, 'status', p_status);
end $$;

-- Resposta registrada no CRM para a sequência daquele negócio/pessoa
create or replace function public.auto_parar_ao_responder()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.tipo = 'mensagem_recebida' then
    update auto_fila set status = 'respondeu'
     where status = 'pendente'
       and ((new.negocio_id is not null and negocio_id = new.negocio_id)
         or (new.pessoa_id is not null and pessoa_id = new.pessoa_id));
  end if;
  return new;
end $$;
drop trigger if exists auto_parar_ao_responder on public.crm_atividades;
create trigger auto_parar_ao_responder after insert on public.crm_atividades
  for each row execute function public.auto_parar_ao_responder();

-- ---------------------------------------------------------------------
-- 9. Briefing automático ao entrar na etapa Briefing
-- ---------------------------------------------------------------------
create or replace function public.auto_briefing_na_etapa()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if exists (select 1 from crm_etapas where id = new.etapa_id and funil_id = 'materia' and nome = 'Briefing')
     and (tg_op = 'INSERT' or new.etapa_id is distinct from old.etapa_id) then
    insert into auto_briefings (negocio_id, pessoa_id, empresa_id, tipo)
    values (new.id, new.pessoa_id, new.empresa_id, case when new.tipo = 'destaque_pago' then 'pago' else 'cortesia' end)
    on conflict (negocio_id) do nothing;
  end if;
  return new;
end $$;
drop trigger if exists auto_briefing_na_etapa on public.crm_negocios;
create trigger auto_briefing_na_etapa after insert or update of etapa_id on public.crm_negocios
  for each row execute function public.auto_briefing_na_etapa();

-- Negócios que já estão em Briefing ganham o link agora
insert into public.auto_briefings (negocio_id, pessoa_id, empresa_id, tipo)
select n.id, n.pessoa_id, n.empresa_id, case when n.tipo = 'destaque_pago' then 'pago' else 'cortesia' end
  from public.crm_negocios n join public.crm_etapas e on e.id = n.etapa_id
 where n.ativo and e.funil_id = 'materia' and e.nome = 'Briefing'
on conflict (negocio_id) do nothing;

-- Lembretes do briefing (D2 e D5) viram tarefa com a mensagem pronta
create or replace function public.auto_lembretes_briefing()
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  r record;
  n integer := 0;
  v_link text;
begin
  for r in
    select b.*, n.dono_id, n.titulo, p.nome as pnome, e.nome as enome
      from auto_briefings b
      join crm_negocios n on n.id = b.negocio_id and n.ativo
      left join crm_pessoas p on p.id = b.pessoa_id
      left join crm_empresas e on e.id = b.empresa_id
     where b.status = 'aberto'
       and ((b.lembrete_d2_em is null and b.created_at <= now() - interval '2 days')
         or (b.lembrete_d5_em is null and b.created_at <= now() - interval '5 days'))
  loop
    v_link := 'https://ianewsbr.com/briefing/' || r.token;
    insert into crm_tarefas (titulo, descricao, vence_em, automatica, chave, responsavel_id, empresa_id, pessoa_id, negocio_id)
    values ('Lembrar briefing · ' || coalesce(r.pnome, r.titulo),
            auto_preencher(E'Oi, {nome}! Tudo certo? Para a matéria da {empresa} sair, falta só preencher o briefing. Leva uns 10 minutos e o progresso fica salvo: ', r.pnome, r.enome) || v_link,
            crm_hoje(), true, 'briefing:' || r.id || ':' || crm_hoje(), r.dono_id, r.empresa_id, r.pessoa_id, r.negocio_id)
    on conflict do nothing;
    update auto_briefings set
      lembrete_d2_em = coalesce(lembrete_d2_em, now()),
      lembrete_d5_em = case when lembrete_d2_em is not null and created_at <= now() - interval '5 days' then now() else lembrete_d5_em end
     where id = r.id;
    n := n + 1;
  end loop;
  return jsonb_build_object('ok', true, 'lembretes', n);
end $$;

-- ---------------------------------------------------------------------
-- 10. Pagamento confirmado move o negócio sozinho
-- ---------------------------------------------------------------------
create or replace function public.auto_pagamento_baixa()
returns trigger language plpgsql security definer set search_path = public as $$
declare v_fechado uuid;
begin
  new.updated_at := now();
  if new.status = 'pago' and (tg_op = 'INSERT' or old.status is distinct from 'pago') then
    new.pago_em := coalesce(new.pago_em, now());
    select e.id into v_fechado from crm_negocios n join crm_etapas e on e.funil_id = n.funil_id and e.nome = 'Fechado'
     where n.id = new.negocio_id;
    update crm_negocios set status_pagamento = 'pago', valor = new.valor, fechado_em = coalesce(fechado_em, now()),
           etapa_id = coalesce(v_fechado, etapa_id),
           etapa_desde = case when v_fechado is not null and etapa_id is distinct from v_fechado then now() else etapa_desde end
     where id = new.negocio_id;
    insert into crm_atividades (tipo, canal, texto, negocio_id, empresa_id, pessoa_id)
    select 'pagamento', 'interno', 'Pagamento confirmado: R$ ' || to_char(new.valor, 'FM999G999D00') || ' via ' || new.gateway || coalesce(' (' || new.forma || ')', ''),
           n.id, n.empresa_id, n.pessoa_id from crm_negocios n where n.id = new.negocio_id;
  end if;
  return new;
end $$;
drop trigger if exists auto_pagamento_baixa on public.auto_pagamentos;
create trigger auto_pagamento_baixa before insert or update on public.auto_pagamentos
  for each row execute function public.auto_pagamento_baixa();

-- Negócio pago ou de publicidade não fecha sem valor
create or replace function public.auto_exigir_valor_no_fechamento()
returns trigger language plpgsql set search_path = public as $$
begin
  if new.tipo in ('destaque_pago', 'publicidade')
     and exists (select 1 from crm_etapas where id = new.etapa_id and nome = 'Fechado')
     and (tg_op = 'INSERT' or new.etapa_id is distinct from old.etapa_id)
     and coalesce(new.valor, 0) <= 0 then
    raise exception 'Informe o valor antes de mover para Fechado (negócio pago ou de publicidade).';
  end if;
  return new;
end $$;
drop trigger if exists auto_exigir_valor_no_fechamento on public.crm_negocios;
create trigger auto_exigir_valor_no_fechamento before insert or update of etapa_id on public.crm_negocios
  for each row execute function public.auto_exigir_valor_no_fechamento();

-- ---------------------------------------------------------------------
-- 11. Painel diário
-- ---------------------------------------------------------------------
create or replace function public.auto_painel()
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare v_hoje date := crm_hoje();
begin
  if not crm_tem_acesso() and coalesce(auth.role(), '') <> 'service_role' then
    raise exception 'Acesso restrito à equipe do CRM.';
  end if;
  return jsonb_build_object(
    'hoje', v_hoje,
    'pausado', coalesce((auto_cfg('pausado'))::text, 'false') = 'true',
    'limites', auto_cfg('limites'),
    'nota_corte', auto_cfg('nota_corte'),
    'fila', (select coalesce(jsonb_object_agg(canal, x), '{}'::jsonb) from (
               select canal, jsonb_build_object(
                 'total', count(*),
                 'd0', count(*) filter (where passo = 'D0'),
                 'pendente', count(*) filter (where status = 'pendente'),
                 'enviado', count(*) filter (where status = 'enviado'),
                 'pulado', count(*) filter (where status = 'pulado')) x
                 from auto_fila where dia = v_hoje group by canal) t),
    'ultimos_14', jsonb_build_object(
       'enviadas', (select count(*) from crm_atividades where tipo = 'mensagem_enviada' and created_at >= now() - interval '14 days'),
       'recebidas', (select count(*) from crm_atividades where tipo = 'mensagem_recebida' and created_at >= now() - interval '14 days'),
       'pagamentos', (select count(*) from crm_atividades where tipo = 'pagamento' and created_at >= now() - interval '14 days')),
    'receita_mes', (select coalesce(sum(valor), 0) from crm_negocios
                     where status_pagamento = 'pago' and fechado_em >= date_trunc('month', now() at time zone 'America/Sao_Paulo')),
    'pagamentos_pendentes', (select count(*) from auto_pagamentos where status = 'pendente'),
    'briefings', (select jsonb_build_object(
                    'abertos', count(*) filter (where status = 'aberto'),
                    'enviados', count(*) filter (where status = 'enviado'),
                    'em_producao', count(*) filter (where status in ('em_producao', 'previa', 'ajuste'))) from auto_briefings),
    'elegiveis', (select count(*) from crm_negocios n join crm_etapas et on et.id = n.etapa_id and et.ordem = 1
                    join crm_empresas e on e.id = n.empresa_id
                   where n.ativo and n.funil_id in ('materia', 'publicidade')
                     and coalesce(e.pontuacao, 0) >= coalesce((auto_cfg('nota_corte'))::text::integer, 50)),
    'alertas', (select coalesce(jsonb_agg(jsonb_build_object('canal', canal, 'tipo', tipo, 'n', n)), '[]'::jsonb) from (
                  select canal, tipo, count(*) n from auto_eventos_canal
                   where created_at >= now() - interval '7 days' and tipo in ('bloqueio', 'denuncia', 'restricao_conta', 'rejeicao_email')
                   group by 1, 2) a),
    'quentes_sem_resposta', (select count(*) from crm_negocios n join crm_etapas e on e.id = n.etapa_id
                               where n.ativo and e.nome = 'Respondeu' and n.etapa_desde < now() - interval '24 hours')
  );
end $$;

-- ---------------------------------------------------------------------
-- 12. Permissões e rotinas
-- ---------------------------------------------------------------------
revoke execute on function public.auto_montar_fila(date) from public, anon;
revoke execute on function public.auto_lembretes_briefing() from public, anon, authenticated;
revoke execute on function public.auto_marcar(uuid, text, text) from public, anon;
revoke execute on function public.auto_painel() from public, anon;
revoke execute on function public.auto_cfg(text) from public, anon;
revoke execute on function public.auto_modelo(text, text) from public, anon, authenticated;
grant execute on function public.auto_montar_fila(date) to authenticated, service_role;
grant execute on function public.auto_marcar(uuid, text, text) to authenticated, service_role;
grant execute on function public.auto_painel() to authenticated, service_role;
grant execute on function public.auto_cfg(text) to authenticated, service_role;
grant execute on function public.auto_lembretes_briefing() to service_role;

-- 7h20 em Brasília, de segunda a sexta: monta a fila do dia
select cron.unschedule(jobid) from cron.job where jobname in ('ianews-auto-fila', 'ianews-auto-briefing');
select cron.schedule('ianews-auto-fila', '20 10 * * 1-5', $$select public.auto_montar_fila()$$);
-- 9h em Brasília, todos os dias: lembretes de briefing
select cron.schedule('ianews-auto-briefing', '0 12 * * *', $$select public.auto_lembretes_briefing()$$);
