-- =====================================================================
-- CRM interno IANews — base de dados (fases 1 a 5)
--
-- Tudo novo começa com crm_. As tabelas que já existem (articles, leads,
-- pauta_leads, contact_messages, site_visits...) não mudam: o CRM aponta
-- para elas e é alimentado por gatilhos.
--
-- Regras:
--   * RLS ligada em todas as tabelas; só admin, comercial e editorial
--     (o papel "editor" já existente conta como editorial) leem e gravam.
--   * Funis, etapas e modelos só são alterados por admin.
--   * Nenhuma política de delete: registro descartado vira etapa Perdido
--     ou fica inativo (ativo = false). Exclusão por LGPD é feita só pelo
--     administrador, direto no banco.
--   * Nenhuma métrica digitada à mão: pontuação, grupo e indicadores são
--     calculados a partir do banco.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. Papéis
-- ---------------------------------------------------------------------
alter type public.app_role add value if not exists 'comercial';
alter type public.app_role add value if not exists 'editorial';

create or replace function public.crm_tem_acesso()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.user_roles r
    where r.user_id = auth.uid()
      and r.role::text in ('admin', 'comercial', 'editorial', 'editor')
  );
$$;

create or replace function public.crm_e_admin()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.user_roles r
    where r.user_id = auth.uid() and r.role::text = 'admin'
  );
$$;

revoke execute on function public.crm_tem_acesso() from public, anon;
revoke execute on function public.crm_e_admin() from public, anon;
grant execute on function public.crm_tem_acesso() to authenticated, service_role;
grant execute on function public.crm_e_admin() to authenticated, service_role;

-- Data de hoje no horário de Brasília (prazos e vencimentos usam o dia local).
create or replace function public.crm_hoje()
returns date language sql stable set search_path = public as $$
  select (now() at time zone 'America/Sao_Paulo')::date;
$$;

create or replace function public.crm_slug(p text)
returns text language sql immutable set search_path = public as $$
  select nullif(
    trim(both '-' from regexp_replace(
      lower(translate(coalesce(p, ''),
        'ÁÀÂÃÄáàâãäÉÈÊËéèêëÍÌÎÏíìîïÓÒÔÕÖóòôõöÚÙÛÜúùûüÇçÑñ',
        'AAAAAaaaaaEEEEeeeeIIIIiiiiOOOOOoooooUUUUuuuuCcNn')),
      '[^a-z0-9]+', '-', 'g')),
    '');
$$;

-- Domínio a partir de site ou e-mail ("https://www.acme.com.br/x" -> "acme.com.br").
create or replace function public.crm_dominio(p text)
returns text language sql immutable set search_path = public as $$
  select nullif(
    regexp_replace(
      regexp_replace(lower(trim(coalesce(p, ''))), '^(https?://)?(www\.)?|^[^@]*@', ''),
      '[/?#:].*$', ''),
    '');
$$;

-- Domínios de e-mail pessoal: não identificam empresa.
create or replace function public.crm_dominio_pessoal(p text)
returns boolean language sql immutable set search_path = public as $$
  select coalesce(p, '') = '' or p in (
    'gmail.com','googlemail.com','hotmail.com','hotmail.com.br','outlook.com','outlook.com.br',
    'live.com','msn.com','yahoo.com','yahoo.com.br','icloud.com','me.com','mac.com','uol.com.br',
    'bol.com.br','terra.com.br','ig.com.br','globo.com','globomail.com','proton.me','protonmail.com',
    'aol.com','zoho.com','gmx.com','r7.com'
  );
$$;

create or replace function public.crm_set_updated_at()
returns trigger language plpgsql set search_path = public as $$
begin
  new.updated_at := now();
  return new;
end $$;

-- ---------------------------------------------------------------------
-- 2. Empresas
-- ---------------------------------------------------------------------
create table if not exists public.crm_empresas (
  id uuid primary key default gen_random_uuid(),
  nome text not null check (length(trim(nome)) between 1 and 200),
  slug text unique,
  site text,
  dominio text,
  instagram text,
  linkedin text,
  setor text,
  cidade text,
  pais text default 'Brasil',
  brasileira boolean default true,
  porte text check (porte in ('startup', 'pme', 'grande', 'global')),
  seguidores_instagram integer check (seguidores_instagram is null or seguidores_instagram >= 0),
  descricao text,
  pontuacao integer not null default 0,
  grupo text check (grupo in ('A', 'B', 'C')),
  grupo_manual boolean not null default false,
  motivo_grupo text,
  interagiu boolean not null default false,
  noticia_recente_em date,
  e_cliente boolean not null default false,
  e_anunciante boolean not null default false,
  origem text,            -- pauta, prospeccao, formulario, contato, indicacao, ranking, materia
  dono_id uuid references auth.users(id),
  ai_tool_id uuid references public.ai_tools(id),
  ativo boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index if not exists crm_empresas_nome_uq on public.crm_empresas (lower(trim(nome)));
create index if not exists crm_empresas_dominio_idx on public.crm_empresas (dominio);
create index if not exists crm_empresas_grupo_idx on public.crm_empresas (grupo, pontuacao desc);

-- ---------------------------------------------------------------------
-- 3. Pessoas
-- ---------------------------------------------------------------------
create table if not exists public.crm_pessoas (
  id uuid primary key default gen_random_uuid(),
  nome text not null check (length(trim(nome)) between 1 and 200),
  instagram text,
  linkedin text,
  whatsapp text,
  email text,
  seguidores_instagram integer check (seguidores_instagram is null or seguidores_instagram >= 0),
  consentimento boolean not null default false,
  consentimento_em timestamptz,
  origem text,
  newsletter_lead_id uuid references public.leads(id),
  aquecido_em timestamptz,
  notas text,
  dono_id uuid references auth.users(id),
  ativo boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
-- Uma pessoa por e-mail (sem diferença de maiúsculas).
create unique index if not exists crm_pessoas_email_uq on public.crm_pessoas (lower(email))
  where email is not null and email <> '';
create index if not exists crm_pessoas_nome_idx on public.crm_pessoas (lower(nome));

create table if not exists public.crm_empresa_pessoas (
  empresa_id uuid not null references public.crm_empresas(id) on delete cascade,
  pessoa_id uuid not null references public.crm_pessoas(id) on delete cascade,
  cargo text,
  decisor boolean not null default false,
  created_at timestamptz not null default now(),
  primary key (empresa_id, pessoa_id)
);
create index if not exists crm_empresa_pessoas_pessoa_idx on public.crm_empresa_pessoas (pessoa_id);

-- ---------------------------------------------------------------------
-- 4. Funis e etapas (configuráveis no painel)
-- ---------------------------------------------------------------------
create table if not exists public.crm_funis (
  id text primary key,      -- materia, publicidade, parcerias
  nome text not null,
  ordem integer not null default 0,
  ativo boolean not null default true
);

create table if not exists public.crm_etapas (
  id uuid primary key default gen_random_uuid(),
  funil_id text not null references public.crm_funis(id),
  nome text not null,
  ordem integer not null,
  prazo_dias integer check (prazo_dias is null or prazo_dias between 0 and 365),
  acao_padrao text,
  criterio_entrada text,
  tipo text not null default 'aberta' check (tipo in ('aberta', 'ganha', 'perdida')),
  ativo boolean not null default true,
  unique (funil_id, nome)
);
create index if not exists crm_etapas_funil_idx on public.crm_etapas (funil_id, ordem);

-- ---------------------------------------------------------------------
-- 5. Conteúdos nas redes (antes de negócios: negócio pode nascer de um conteúdo)
-- ---------------------------------------------------------------------
create table if not exists public.crm_conteudos (
  id uuid primary key default gen_random_uuid(),
  article_id uuid references public.articles(id),
  canal text not null check (canal in ('instagram', 'facebook', 'linkedin', 'threads', 'newsletter', 'site')),
  formato text,             -- post, carrossel, reels, stories
  titulo text,
  url text,
  publicado_em timestamptz,
  collab_aceito boolean,
  created_by uuid references auth.users(id) default auth.uid(),
  ativo boolean not null default true,
  created_at timestamptz not null default now()
);
create index if not exists crm_conteudos_article_idx on public.crm_conteudos (article_id);

-- ---------------------------------------------------------------------
-- 6. Negócios
-- ---------------------------------------------------------------------
create table if not exists public.crm_negocios (
  id uuid primary key default gen_random_uuid(),
  titulo text not null check (length(trim(titulo)) between 1 and 300),
  funil_id text not null references public.crm_funis(id),
  etapa_id uuid references public.crm_etapas(id),
  etapa_desde timestamptz not null default now(),
  empresa_id uuid references public.crm_empresas(id),
  pessoa_id uuid references public.crm_pessoas(id),
  tipo text,                -- destaque_pago, destaque_cortesia, materia_paga, pacote_publicidade, parceria...
  valor numeric(12, 2) check (valor is null or valor >= 0),
  status_pagamento text not null default 'pendente'
    check (status_pagamento in ('pendente', 'pago', 'cortesia', 'cancelado')),
  origem text,              -- pauta, contato, prospeccao, virou_pauta, indicacao, newsletter
  canal_origem text,        -- instagram, linkedin, whatsapp, site, email
  article_id uuid references public.articles(id),   -- matéria que originou
  conteudo_id uuid references public.crm_conteudos(id),
  pauta_lead_id uuid unique references public.pauta_leads(id),
  contact_message_id uuid unique references public.contact_messages(id),
  dono_id uuid references auth.users(id),
  proxima_acao text,
  proxima_acao_em date,
  motivo_perda text,
  fechado_em timestamptz,
  ativo boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists crm_negocios_etapa_idx on public.crm_negocios (funil_id, etapa_id);
create index if not exists crm_negocios_acao_idx on public.crm_negocios (proxima_acao_em);
create index if not exists crm_negocios_empresa_idx on public.crm_negocios (empresa_id);
create index if not exists crm_negocios_pessoa_idx on public.crm_negocios (pessoa_id);

-- ---------------------------------------------------------------------
-- 7. Atividades (linha do tempo)
-- ---------------------------------------------------------------------
create table if not exists public.crm_atividades (
  id uuid primary key default gen_random_uuid(),
  tipo text not null check (tipo in (
    'mensagem_enviada', 'mensagem_recebida', 'ligacao', 'reuniao', 'nota',
    'mudanca_etapa', 'email', 'proposta', 'pagamento', 'sistema')),
  canal text,               -- direct, whatsapp, linkedin, email, telefone, site
  texto text,
  empresa_id uuid references public.crm_empresas(id),
  pessoa_id uuid references public.crm_pessoas(id),
  negocio_id uuid references public.crm_negocios(id),
  etapa_de uuid references public.crm_etapas(id),
  etapa_para uuid references public.crm_etapas(id),
  modelo_id uuid,
  autor_id uuid references auth.users(id) default auth.uid(),
  created_at timestamptz not null default now()
);
create index if not exists crm_atividades_negocio_idx on public.crm_atividades (negocio_id, created_at desc);
create index if not exists crm_atividades_empresa_idx on public.crm_atividades (empresa_id, created_at desc);
create index if not exists crm_atividades_pessoa_idx on public.crm_atividades (pessoa_id, created_at desc);
create index if not exists crm_atividades_data_idx on public.crm_atividades (created_at desc);

-- ---------------------------------------------------------------------
-- 8. Tarefas
-- ---------------------------------------------------------------------
create table if not exists public.crm_tarefas (
  id uuid primary key default gen_random_uuid(),
  titulo text not null check (length(trim(titulo)) between 1 and 300),
  descricao text,
  vence_em date,
  feita boolean not null default false,
  feita_em timestamptz,
  cancelada boolean not null default false,
  automatica boolean not null default false,
  chave text,               -- evita tarefa automática repetida
  responsavel_id uuid references auth.users(id),
  empresa_id uuid references public.crm_empresas(id),
  pessoa_id uuid references public.crm_pessoas(id),
  negocio_id uuid references public.crm_negocios(id),
  created_by uuid references auth.users(id) default auth.uid(),
  created_at timestamptz not null default now()
);
create unique index if not exists crm_tarefas_chave_uq on public.crm_tarefas (chave) where chave is not null;
create index if not exists crm_tarefas_abertas_idx on public.crm_tarefas (vence_em) where not feita and not cancelada;
create index if not exists crm_tarefas_negocio_idx on public.crm_tarefas (negocio_id);
create index if not exists crm_tarefas_resp_idx on public.crm_tarefas (responsavel_id, vence_em);

-- ---------------------------------------------------------------------
-- 9. Menções (matérias e conteúdos -> empresas e pessoas citadas)
-- ---------------------------------------------------------------------
create table if not exists public.crm_mencoes (
  id uuid primary key default gen_random_uuid(),
  article_id uuid references public.articles(id),
  conteudo_id uuid references public.crm_conteudos(id),
  empresa_id uuid references public.crm_empresas(id),
  pessoa_id uuid references public.crm_pessoas(id),
  papel text not null default 'citada' check (papel in ('protagonista', 'citada', 'colaboradora')),
  ativo boolean not null default true,
  created_by uuid references auth.users(id) default auth.uid(),
  created_at timestamptz not null default now(),
  check (article_id is not null or conteudo_id is not null),
  check (empresa_id is not null or pessoa_id is not null),
  unique nulls not distinct (article_id, conteudo_id, empresa_id, pessoa_id)
);
create index if not exists crm_mencoes_empresa_idx on public.crm_mencoes (empresa_id);
create index if not exists crm_mencoes_pessoa_idx on public.crm_mencoes (pessoa_id);
create index if not exists crm_mencoes_article_idx on public.crm_mencoes (article_id);

-- ---------------------------------------------------------------------
-- 10. Publicidade
-- ---------------------------------------------------------------------
create table if not exists public.crm_campanhas (
  id uuid primary key default gen_random_uuid(),
  negocio_id uuid references public.crm_negocios(id),
  nome text not null check (length(trim(nome)) between 1 and 200),
  inicio date,
  fim date,
  status text not null default 'planejada'
    check (status in ('planejada', 'em_veiculacao', 'concluida', 'cancelada')),
  relatorio_url text,
  relatorio_enviado_em timestamptz,
  notas text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (fim is null or inicio is null or fim >= inicio)
);
create index if not exists crm_campanhas_negocio_idx on public.crm_campanhas (negocio_id);

create table if not exists public.crm_entregas (
  id uuid primary key default gen_random_uuid(),
  campanha_id uuid not null references public.crm_campanhas(id) on delete cascade,
  formato text,             -- post, stories, reels, newsletter, banner
  canal text,
  titulo text,
  agendado_para timestamptz,
  url text,
  entregue boolean not null default false,
  entregue_em timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists crm_entregas_campanha_idx on public.crm_entregas (campanha_id, agendado_para);

-- ---------------------------------------------------------------------
-- 11. Modelos de mensagem
-- ---------------------------------------------------------------------
create table if not exists public.crm_modelos (
  id uuid primary key default gen_random_uuid(),
  nome text not null,
  canal text,               -- direct, whatsapp, linkedin, email
  etapa_id uuid references public.crm_etapas(id),
  texto text not null,      -- variáveis: {nome}, {empresa}, {link_materia}, {link_post}, {valor}
  ordem integer not null default 0,
  ativo boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (nome)
);

-- ---------------------------------------------------------------------
-- 12. Segurança: só equipe autorizada, sem delete
-- ---------------------------------------------------------------------
do $$
declare t text;
begin
  foreach t in array array[
    'crm_empresas', 'crm_pessoas', 'crm_empresa_pessoas', 'crm_funis', 'crm_etapas',
    'crm_negocios', 'crm_atividades', 'crm_tarefas', 'crm_conteudos', 'crm_mencoes',
    'crm_campanhas', 'crm_entregas', 'crm_modelos'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('revoke all on table public.%I from anon', t);
    execute format('revoke delete, truncate on table public.%I from authenticated', t);
    execute format('drop policy if exists crm_ler on public.%I', t);
    execute format('drop policy if exists crm_inserir on public.%I', t);
    execute format('drop policy if exists crm_editar on public.%I', t);
    execute format('create policy crm_ler on public.%I for select to authenticated using (public.crm_tem_acesso())', t);
    if t in ('crm_funis', 'crm_etapas', 'crm_modelos') then
      -- Configuração: só admin altera.
      execute format('create policy crm_inserir on public.%I for insert to authenticated with check (public.crm_e_admin())', t);
      execute format('create policy crm_editar on public.%I for update to authenticated using (public.crm_e_admin()) with check (public.crm_e_admin())', t);
    else
      execute format('create policy crm_inserir on public.%I for insert to authenticated with check (public.crm_tem_acesso())', t);
      execute format('create policy crm_editar on public.%I for update to authenticated using (public.crm_tem_acesso()) with check (public.crm_tem_acesso())', t);
    end if;
  end loop;
end $$;

-- ---------------------------------------------------------------------
-- 13. Pontuação 0-100 e grupos A/B/C
-- ---------------------------------------------------------------------
create or replace function public.crm_pontuacao_empresa(
  p_id uuid, p_brasileira boolean, p_origem text, p_interagiu boolean, p_noticia date)
returns integer language plpgsql stable security definer set search_path = public as $$
declare
  pts integer := 0;
  tem_contato boolean;
begin
  -- Empresa brasileira ou com operação no Brasil / estrangeira sem operação no Brasil
  if coalesce(p_brasileira, true) then pts := pts + 20; else pts := pts - 20; end if;

  -- Fundador ou executivo identificado com Instagram ou LinkedIn
  if exists (
    select 1 from crm_empresa_pessoas ep join crm_pessoas p on p.id = ep.pessoa_id
    where ep.empresa_id = p_id and p.ativo and ep.decisor
      and (coalesce(p.instagram, '') <> '' or coalesce(p.linkedin, '') <> '')
  ) then pts := pts + 15; end if;

  -- WhatsApp ou e-mail direto do decisor
  if exists (
    select 1 from crm_empresa_pessoas ep join crm_pessoas p on p.id = ep.pessoa_id
    where ep.empresa_id = p_id and p.ativo and ep.decisor
      and (coalesce(p.whatsapp, '') <> '' or coalesce(p.email, '') <> '')
  ) then pts := pts + 15; end if;

  -- Já apareceu em conteúdo da IANews
  if exists (select 1 from crm_mencoes m where m.empresa_id = p_id and m.ativo) then
    pts := pts + 15;
  end if;

  -- Interagiu com o conteúdo (collab aceito, comentou, compartilhou, respondeu)
  if coalesce(p_interagiu, false)
     or exists (select 1 from crm_atividades a where a.empresa_id = p_id and a.tipo = 'mensagem_recebida')
     or exists (
       select 1 from crm_mencoes m join crm_conteudos c on c.id = m.conteudo_id
       where m.empresa_id = p_id and m.ativo and c.collab_aceito)
  then pts := pts + 15; end if;

  -- Rodada de investimento, lançamento ou notícia recente (últimos 90 dias)
  if p_noticia is not null and p_noticia >= crm_hoje() - 90 then pts := pts + 10; end if;

  -- Veio por formulário (/pauta ou contato)
  if coalesce(p_origem, '') in ('pauta', 'formulario', 'contato') then pts := pts + 10; end if;

  -- Lead aquecido (pessoa da empresa leu 3+ matérias em 7 dias, nos últimos 30 dias)
  if exists (
    select 1 from crm_empresa_pessoas ep join crm_pessoas p on p.id = ep.pessoa_id
    where ep.empresa_id = p_id and p.aquecido_em >= now() - interval '30 days'
  ) then pts := pts + 10; end if;

  -- Sem nenhum contato direto
  select exists (
    select 1 from crm_empresa_pessoas ep join crm_pessoas p on p.id = ep.pessoa_id
    where ep.empresa_id = p_id and p.ativo
      and (coalesce(p.whatsapp, '') <> '' or coalesce(p.email, '') <> ''
           or coalesce(p.instagram, '') <> '' or coalesce(p.linkedin, '') <> '')
  ) into tem_contato;
  if not tem_contato then pts := pts - 10; end if;

  return greatest(0, least(100, pts));
end $$;

create or replace function public.crm_grupo_por_pontuacao(p integer)
returns text language sql immutable set search_path = public as $$
  select case when p >= 70 then 'A' when p >= 40 then 'B' else 'C' end;
$$;

create or replace function public.crm_empresas_antes()
returns trigger language plpgsql security definer set search_path = public as $$
declare base text; n integer := 1;
begin
  new.nome := regexp_replace(trim(new.nome), '\s+', ' ', 'g');
  new.instagram := nullif(regexp_replace(trim(coalesce(new.instagram, '')), '^@', ''), '');
  new.site := nullif(trim(coalesce(new.site, '')), '');
  if coalesce(new.dominio, '') = '' and new.site is not null then
    new.dominio := crm_dominio(new.site);
  end if;
  if tg_op = 'INSERT' or new.nome is distinct from old.nome or new.slug is null then
    base := coalesce(crm_slug(new.nome), 'empresa');
    new.slug := base;
    while exists (select 1 from crm_empresas e where e.slug = new.slug and e.id <> new.id) loop
      n := n + 1;
      new.slug := base || '-' || n;
    end loop;
  end if;
  if tg_op = 'UPDATE' and new.grupo_manual and not old.grupo_manual and coalesce(new.motivo_grupo, '') = '' then
    raise exception 'Informe o motivo para trocar o grupo manualmente.';
  end if;
  new.pontuacao := crm_pontuacao_empresa(new.id, new.brasileira, new.origem, new.interagiu, new.noticia_recente_em);
  if not new.grupo_manual or new.grupo is null then
    new.grupo := crm_grupo_por_pontuacao(new.pontuacao);
  end if;
  new.updated_at := now();
  return new;
end $$;

drop trigger if exists crm_empresas_antes on public.crm_empresas;
create trigger crm_empresas_antes before insert or update on public.crm_empresas
  for each row execute function public.crm_empresas_antes();

-- Recalcula a pontuação de uma empresa (o gatilho "antes" faz a conta).
create or replace function public.crm_recalcular_empresa(p_id uuid)
returns void language sql security definer set search_path = public as $$
  update crm_empresas set updated_at = now() where id = p_id;
$$;

create or replace function public.crm_tocar_empresas()
returns trigger language plpgsql security definer set search_path = public as $$
declare r record;
begin
  if tg_table_name = 'crm_empresa_pessoas' then
    if tg_op <> 'DELETE' then perform crm_recalcular_empresa(new.empresa_id); end if;
    if tg_op <> 'INSERT' then perform crm_recalcular_empresa(old.empresa_id); end if;
  elsif tg_table_name = 'crm_pessoas' then
    for r in select empresa_id from crm_empresa_pessoas where pessoa_id = new.id loop
      perform crm_recalcular_empresa(r.empresa_id);
    end loop;
  elsif tg_table_name = 'crm_mencoes' then
    if new.empresa_id is not null then perform crm_recalcular_empresa(new.empresa_id); end if;
    if tg_op = 'UPDATE' and old.empresa_id is distinct from new.empresa_id and old.empresa_id is not null then
      perform crm_recalcular_empresa(old.empresa_id);
    end if;
  elsif tg_table_name = 'crm_conteudos' then
    for r in select distinct empresa_id from crm_mencoes where conteudo_id = new.id and empresa_id is not null loop
      perform crm_recalcular_empresa(r.empresa_id);
    end loop;
  elsif tg_table_name = 'crm_atividades' then
    if new.empresa_id is not null and new.tipo = 'mensagem_recebida' then
      perform crm_recalcular_empresa(new.empresa_id);
    end if;
  end if;
  return null;
end $$;

drop trigger if exists crm_ep_pontuacao on public.crm_empresa_pessoas;
create trigger crm_ep_pontuacao after insert or update or delete on public.crm_empresa_pessoas
  for each row execute function public.crm_tocar_empresas();
drop trigger if exists crm_pessoas_pontuacao on public.crm_pessoas;
create trigger crm_pessoas_pontuacao after update of instagram, linkedin, whatsapp, email, ativo, aquecido_em
  on public.crm_pessoas for each row execute function public.crm_tocar_empresas();
drop trigger if exists crm_mencoes_pontuacao on public.crm_mencoes;
create trigger crm_mencoes_pontuacao after insert or update on public.crm_mencoes
  for each row execute function public.crm_tocar_empresas();
drop trigger if exists crm_conteudos_pontuacao on public.crm_conteudos;
create trigger crm_conteudos_pontuacao after update of collab_aceito, ativo on public.crm_conteudos
  for each row execute function public.crm_tocar_empresas();
drop trigger if exists crm_atividades_pontuacao on public.crm_atividades;
create trigger crm_atividades_pontuacao after insert on public.crm_atividades
  for each row execute function public.crm_tocar_empresas();

-- ---------------------------------------------------------------------
-- 14. Pessoas: normalização e ligação com a newsletter
-- ---------------------------------------------------------------------
create or replace function public.crm_pessoas_antes()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  new.nome := regexp_replace(trim(new.nome), '\s+', ' ', 'g');
  new.email := nullif(lower(trim(coalesce(new.email, ''))), '');
  new.instagram := nullif(regexp_replace(trim(coalesce(new.instagram, '')), '^@', ''), '');
  new.whatsapp := nullif(regexp_replace(coalesce(new.whatsapp, ''), '[^0-9+]', '', 'g'), '');
  if new.consentimento and new.consentimento_em is null then new.consentimento_em := now(); end if;
  if new.email is not null and new.newsletter_lead_id is null then
    select l.id into new.newsletter_lead_id from leads l where lower(l.email) = new.email limit 1;
  end if;
  new.updated_at := now();
  return new;
end $$;

drop trigger if exists crm_pessoas_antes on public.crm_pessoas;
create trigger crm_pessoas_antes before insert or update on public.crm_pessoas
  for each row execute function public.crm_pessoas_antes();

-- ---------------------------------------------------------------------
-- 15. Negócios: etapa, histórico e cadências
-- ---------------------------------------------------------------------
create or replace function public.crm_criar_tarefa_etapa(p_negocio public.crm_negocios, p_etapa public.crm_etapas)
returns void language plpgsql security definer set search_path = public as $$
begin
  if p_etapa.acao_padrao is null or p_etapa.prazo_dias is null then return; end if;
  if current_setting('crm.sem_tarefa_auto', true) = 'on' then return; end if;
  insert into crm_tarefas (titulo, vence_em, automatica, chave, responsavel_id, empresa_id, pessoa_id, negocio_id, created_by)
  values (
    p_etapa.acao_padrao || ' · ' || p_negocio.titulo,
    crm_hoje() + p_etapa.prazo_dias,
    true,
    'etapa:' || p_negocio.id || ':' || p_etapa.id || ':' || to_char(now(), 'YYYYMMDDHH24MISSUS'),
    p_negocio.dono_id, p_negocio.empresa_id, p_negocio.pessoa_id, p_negocio.id, auth.uid())
  on conflict do nothing;
end $$;

create or replace function public.crm_negocios_antes()
returns trigger language plpgsql security definer set search_path = public as $$
declare e crm_etapas;
begin
  if new.etapa_id is null then
    select * into e from crm_etapas where funil_id = new.funil_id and ativo order by ordem limit 1;
    new.etapa_id := e.id;
  else
    select * into e from crm_etapas where id = new.etapa_id;
  end if;
  if e.id is null then raise exception 'Funil sem etapas cadastradas.'; end if;
  if e.funil_id <> new.funil_id then raise exception 'A etapa escolhida não pertence a este funil.'; end if;

  if tg_op = 'INSERT' or new.etapa_id is distinct from old.etapa_id then
    new.etapa_desde := now();
    if e.tipo = 'perdida' and coalesce(trim(new.motivo_perda), '') = '' then
      raise exception 'Informe o motivo da perda.';
    end if;
    if e.tipo = 'aberta' then
      new.fechado_em := null;
    elsif new.fechado_em is null then
      new.fechado_em := now();
    end if;
    -- A próxima ação passa a ser a ação padrão da nova etapa.
    if e.tipo = 'perdida' then
      new.proxima_acao := null;
      new.proxima_acao_em := null;
    elsif e.acao_padrao is not null and (tg_op = 'UPDATE' or new.proxima_acao is null) then
      new.proxima_acao := e.acao_padrao;
      new.proxima_acao_em := case when e.prazo_dias is null then null else crm_hoje() + e.prazo_dias end;
    end if;
  end if;
  if new.status_pagamento = 'cortesia' and new.tipo is null then new.tipo := 'destaque_cortesia'; end if;
  new.updated_at := now();
  return new;
end $$;

drop trigger if exists crm_negocios_antes on public.crm_negocios;
create trigger crm_negocios_antes before insert or update on public.crm_negocios
  for each row execute function public.crm_negocios_antes();

create or replace function public.crm_negocios_depois()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  e crm_etapas;
  de crm_etapas;
  funil text;
begin
  select * into e from crm_etapas where id = new.etapa_id;
  select nome into funil from crm_funis where id = new.funil_id;

  if tg_op = 'INSERT' then
    insert into crm_atividades (tipo, texto, empresa_id, pessoa_id, negocio_id, etapa_para, autor_id)
    values ('sistema', 'Negócio criado em ' || funil || ' · ' || e.nome, new.empresa_id, new.pessoa_id, new.id, e.id, auth.uid());
    perform crm_criar_tarefa_etapa(new, e);
  elsif new.etapa_id is distinct from old.etapa_id then
    select * into de from crm_etapas where id = old.etapa_id;
    insert into crm_atividades (tipo, texto, empresa_id, pessoa_id, negocio_id, etapa_de, etapa_para, autor_id)
    values ('mudanca_etapa',
            coalesce(de.nome, '—') || ' → ' || e.nome
              || case when e.tipo = 'perdida' then ' (motivo: ' || coalesce(new.motivo_perda, '') || ')' else '' end,
            new.empresa_id, new.pessoa_id, new.id, old.etapa_id, new.etapa_id, auth.uid());
    -- Tarefas automáticas da etapa anterior deixam de valer.
    update crm_tarefas set cancelada = true
      where negocio_id = new.id and automatica and not feita and not cancelada
        and chave like 'etapa:%';
    perform crm_criar_tarefa_etapa(new, e);
    -- Publicado: pós-venda 30 dias depois.
    if new.funil_id = 'materia' and e.nome = 'Publicado' then
      insert into crm_tarefas (titulo, descricao, vence_em, automatica, chave, responsavel_id, empresa_id, pessoa_id, negocio_id)
      values ('Pós-venda · ' || new.titulo,
              'Oferecer nova matéria, publicidade ou indicação.',
              crm_hoje() + 30, true, 'posvenda:' || new.id,
              new.dono_id, new.empresa_id, new.pessoa_id, new.id)
      on conflict do nothing;
    end if;
  elsif new.dono_id is distinct from old.dono_id then
    -- Reatribuição: tarefas abertas do negócio seguem o novo dono.
    update crm_tarefas set responsavel_id = new.dono_id
      where negocio_id = new.id and not feita and not cancelada
        and (responsavel_id is null or responsavel_id = old.dono_id);
  end if;

  -- Empresa sem dono herda o dono do negócio.
  if new.empresa_id is not null and new.dono_id is not null then
    update crm_empresas set dono_id = new.dono_id where id = new.empresa_id and dono_id is null;
  end if;

  -- Fechado/ganho marca a empresa como cliente ou anunciante.
  if e.tipo = 'ganha' and new.empresa_id is not null then
    update crm_empresas set
      e_cliente = e_cliente or new.funil_id = 'materia',
      e_anunciante = e_anunciante or new.funil_id = 'publicidade'
    where id = new.empresa_id;
  end if;
  return null;
end $$;

drop trigger if exists crm_negocios_depois on public.crm_negocios;
create trigger crm_negocios_depois after insert or update on public.crm_negocios
  for each row execute function public.crm_negocios_depois();

-- Tarefa concluída registra a data.
create or replace function public.crm_tarefas_antes()
returns trigger language plpgsql set search_path = public as $$
begin
  if new.feita and (tg_op = 'INSERT' or not old.feita) then new.feita_em := coalesce(new.feita_em, now()); end if;
  if not new.feita then new.feita_em := null; end if;
  return new;
end $$;

drop trigger if exists crm_tarefas_antes on public.crm_tarefas;
create trigger crm_tarefas_antes before insert or update on public.crm_tarefas
  for each row execute function public.crm_tarefas_antes();

-- ---------------------------------------------------------------------
-- 16. Publicidade: entregas e renovação
-- ---------------------------------------------------------------------
create or replace function public.crm_entregas_antes()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.entregue and (tg_op = 'INSERT' or not old.entregue) then
    new.entregue_em := coalesce(new.entregue_em, now());
    update crm_campanhas set status = 'em_veiculacao'
      where id = new.campanha_id and status = 'planejada';
  end if;
  if not new.entregue then new.entregue_em := null; end if;
  return new;
end $$;

drop trigger if exists crm_entregas_antes on public.crm_entregas;
create trigger crm_entregas_antes before insert or update on public.crm_entregas
  for each row execute function public.crm_entregas_antes();

create or replace function public.crm_campanhas_antes()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  n crm_negocios;
  etapa_rel uuid;
  etapa_vei uuid;
  ordem_atual integer;
begin
  new.updated_at := now();
  if new.negocio_id is not null then
    select * into n from crm_negocios where id = new.negocio_id;
    select ordem into ordem_atual from crm_etapas where id = n.etapa_id;
    -- Primeira peça no ar: negócio vai para "Em veiculação".
    if new.status = 'em_veiculacao' and (tg_op = 'INSERT' or old.status <> 'em_veiculacao') and n.funil_id = 'publicidade' then
      select id into etapa_vei from crm_etapas where funil_id = 'publicidade' and nome = 'Em veiculação';
      if etapa_vei is not null and ordem_atual < 7 then
        update crm_negocios set etapa_id = etapa_vei where id = n.id;
      end if;
    end if;
  end if;

  -- Relatório anexado: campanha concluída e renovação em 30 dias.
  if coalesce(new.relatorio_url, '') <> '' and (tg_op = 'INSERT' or coalesce(old.relatorio_url, '') = '') then
    new.relatorio_enviado_em := coalesce(new.relatorio_enviado_em, now());
    if new.status in ('planejada', 'em_veiculacao') then new.status := 'concluida'; end if;
    if n.id is not null then
      select id into etapa_rel from crm_etapas where funil_id = 'publicidade' and nome = 'Relatório entregue';
      if n.funil_id = 'publicidade' and etapa_rel is not null and n.etapa_id <> etapa_rel then
        -- A etapa "Relatório entregue" cria a tarefa "Oferecer renovação" em 30 dias.
        update crm_negocios set etapa_id = etapa_rel where id = n.id;
      else
        insert into crm_tarefas (titulo, vence_em, automatica, chave, responsavel_id, empresa_id, pessoa_id, negocio_id)
        values ('Oferecer renovação · ' || new.nome, crm_hoje() + 30, true, 'renovacao:' || new.id,
                n.dono_id, n.empresa_id, n.pessoa_id, n.id)
        on conflict do nothing;
      end if;
      insert into crm_atividades (tipo, texto, empresa_id, pessoa_id, negocio_id, autor_id)
      values ('sistema', 'Relatório da campanha "' || new.nome || '" entregue: ' || new.relatorio_url,
              n.empresa_id, n.pessoa_id, n.id, auth.uid());
    end if;
  end if;
  return new;
end $$;

drop trigger if exists crm_campanhas_antes on public.crm_campanhas;
create trigger crm_campanhas_antes before insert or update on public.crm_campanhas
  for each row execute function public.crm_campanhas_antes();

drop trigger if exists crm_modelos_updated on public.crm_modelos;
create trigger crm_modelos_updated before update on public.crm_modelos
  for each row execute function public.crm_set_updated_at();

-- ---------------------------------------------------------------------
-- 17. Entrada automática de leads
-- ---------------------------------------------------------------------
create or replace function public.crm_achar_ou_criar_empresa(
  p_nome text, p_site text, p_instagram text, p_linkedin text, p_origem text)
returns uuid language plpgsql security definer set search_path = public as $$
declare v_id uuid;
begin
  if coalesce(trim(p_nome), '') = '' then return null; end if;
  select id into v_id from crm_empresas where lower(trim(nome)) = lower(regexp_replace(trim(p_nome), '\s+', ' ', 'g'));
  if v_id is null then
    insert into crm_empresas (nome, site, instagram, linkedin, origem)
    values (p_nome, nullif(p_site, ''), nullif(p_instagram, ''), nullif(p_linkedin, ''), p_origem)
    on conflict do nothing
    returning id into v_id;
    if v_id is null then
      select id into v_id from crm_empresas where lower(trim(nome)) = lower(regexp_replace(trim(p_nome), '\s+', ' ', 'g'));
    end if;
  else
    update crm_empresas set
      site = coalesce(site, nullif(p_site, '')),
      instagram = coalesce(instagram, nullif(p_instagram, '')),
      linkedin = coalesce(linkedin, nullif(p_linkedin, '')),
      origem = coalesce(origem, p_origem)
    where id = v_id;
  end if;
  return v_id;
end $$;

create or replace function public.crm_achar_ou_criar_pessoa(
  p_nome text, p_email text, p_whatsapp text, p_instagram text, p_linkedin text,
  p_origem text, p_consentimento boolean)
returns uuid language plpgsql security definer set search_path = public as $$
declare v_id uuid; v_email text := nullif(lower(trim(coalesce(p_email, ''))), '');
begin
  if v_email is not null then
    select id into v_id from crm_pessoas where lower(email) = v_email;
  end if;
  if v_id is null then
    insert into crm_pessoas (nome, email, whatsapp, instagram, linkedin, origem, consentimento)
    values (coalesce(nullif(trim(p_nome), ''), v_email, 'Sem nome'), v_email, nullif(p_whatsapp, ''),
            nullif(p_instagram, ''), nullif(p_linkedin, ''), p_origem, coalesce(p_consentimento, false))
    returning id into v_id;
  else
    update crm_pessoas set
      whatsapp = coalesce(whatsapp, nullif(p_whatsapp, '')),
      instagram = coalesce(instagram, nullif(p_instagram, '')),
      linkedin = coalesce(linkedin, nullif(p_linkedin, '')),
      consentimento = consentimento or coalesce(p_consentimento, false)
    where id = v_id;
  end if;
  return v_id;
end $$;

create or replace function public.crm_cargo_decisor(p_cargo text)
returns boolean language sql immutable set search_path = public as $$
  select coalesce(p_cargo, '') ~* '(fundador|fundadora|founder|co-?founder|ceo|cto|coo|cfo|cmo|s[oó]ci|diretor|diretora|presidente|head|dono|dona|propriet|c-level|gerente geral|vp|vice)';
$$;

create or replace function public.crm_ligar_pessoa_empresa(p_empresa uuid, p_pessoa uuid, p_cargo text)
returns void language plpgsql security definer set search_path = public as $$
begin
  if p_empresa is null or p_pessoa is null then return; end if;
  insert into crm_empresa_pessoas (empresa_id, pessoa_id, cargo, decisor)
  values (p_empresa, p_pessoa, nullif(trim(coalesce(p_cargo, '')), ''), crm_cargo_decisor(p_cargo))
  on conflict (empresa_id, pessoa_id) do update set
    cargo = coalesce(crm_empresa_pessoas.cargo, excluded.cargo),
    decisor = crm_empresa_pessoas.decisor or excluded.decisor;
end $$;

-- Núcleo comum: cria (ou reaproveita) o negócio aberto e registra a mensagem recebida.
create or replace function public.crm_registrar_entrada(
  p_empresa uuid, p_pessoa uuid, p_funil text, p_etapa text, p_titulo text,
  p_origem text, p_canal text, p_article uuid, p_texto text, p_tarefa text,
  p_pauta uuid, p_contato uuid)
returns uuid language plpgsql security definer set search_path = public as $$
declare
  v_neg uuid;
  v_etapa uuid;
  v_dono uuid;
begin
  select id into v_etapa from crm_etapas where funil_id = p_funil and nome = p_etapa;
  if p_empresa is not null then
    select dono_id into v_dono from crm_empresas where id = p_empresa;
    -- Sem duplicar: se a empresa já tem negócio aberto neste funil, usa o mesmo.
    select n.id into v_neg from crm_negocios n join crm_etapas e on e.id = n.etapa_id
      where n.empresa_id = p_empresa and n.funil_id = p_funil and n.ativo and e.tipo = 'aberta'
      order by n.created_at desc limit 1;
  end if;

  if v_neg is null then
    perform set_config('crm.sem_tarefa_auto', 'on', true);
    insert into crm_negocios (titulo, funil_id, etapa_id, empresa_id, pessoa_id, origem, canal_origem,
                              article_id, dono_id, pauta_lead_id, contact_message_id)
    values (p_titulo, p_funil, v_etapa, p_empresa, p_pessoa, p_origem, p_canal,
            p_article, v_dono, p_pauta, p_contato)
    returning id into v_neg;
    perform set_config('crm.sem_tarefa_auto', 'off', true);
  else
    update crm_negocios set
      pessoa_id = coalesce(pessoa_id, p_pessoa),
      pauta_lead_id = coalesce(pauta_lead_id, p_pauta),
      contact_message_id = coalesce(contact_message_id, p_contato)
    where id = v_neg;
  end if;

  insert into crm_atividades (tipo, canal, texto, empresa_id, pessoa_id, negocio_id, autor_id)
  values ('mensagem_recebida', 'site', p_texto, p_empresa, p_pessoa, v_neg, null);

  insert into crm_tarefas (titulo, vence_em, automatica, chave, responsavel_id, empresa_id, pessoa_id, negocio_id, created_by)
  values (p_tarefa, crm_hoje(), true,
          coalesce('pauta:' || p_pauta, 'contato:' || p_contato, 'entrada:' || gen_random_uuid()),
          v_dono, p_empresa, p_pessoa, v_neg, null)
  on conflict do nothing;
  return v_neg;
end $$;

create or replace function public.crm_ingerir_pauta(p public.pauta_leads)
returns uuid language plpgsql security definer set search_path = public as $$
declare v_emp uuid; v_pes uuid; v_art uuid;
begin
  -- Já entrou (negócio próprio ou tarefa de resposta em negócio reaproveitado).
  if exists (select 1 from crm_negocios where pauta_lead_id = p.id)
     or exists (select 1 from crm_tarefas where chave = 'pauta:' || p.id) then
    return null;
  end if;
  v_emp := crm_achar_ou_criar_empresa(p.empresa, p.site, p.instagram, null, 'pauta');
  v_pes := crm_achar_ou_criar_pessoa(p.nome, p.email, p.whatsapp, null, p.linkedin, 'pauta', p.consentimento);
  perform crm_ligar_pessoa_empresa(v_emp, v_pes, p.cargo);
  if p.article_slug is not null then select id into v_art from articles where slug = p.article_slug; end if;
  return crm_registrar_entrada(
    v_emp, v_pes, 'materia', 'Respondeu',
    'Pauta · ' || coalesce(p.empresa, p.nome),
    'pauta', 'site', v_art,
    'Pauta enviada pelo site (' || coalesce(p.cargo, '') || '): ' || coalesce(p.descricao, '')
      || case when p.link_noticia is not null then E'\nNotícia: ' || p.link_noticia else '' end,
    'Responder pauta · ' || coalesce(p.empresa, p.nome),
    p.id, null);
end $$;

create or replace function public.crm_ingerir_contato(c public.contact_messages)
returns uuid language plpgsql security definer set search_path = public as $$
declare
  v_emp uuid; v_pes uuid;
  v_pub boolean := c.kind = 'anuncie' or coalesce(trim(c.budget), '') <> ''
                   or coalesce(c.subject, '') ~* '(publicidade|anunci|m[ií]dia ?kit|patroc)';
begin
  if exists (select 1 from crm_negocios where contact_message_id = c.id)
     or exists (select 1 from crm_tarefas where chave = 'contato:' || c.id) then
    return null;
  end if;
  v_emp := crm_achar_ou_criar_empresa(c.company, null, null, null, 'contato');
  v_pes := crm_achar_ou_criar_pessoa(c.full_name, c.email, c.phone, null, null, 'contato', false);
  perform crm_ligar_pessoa_empresa(v_emp, v_pes, null);
  return crm_registrar_entrada(
    v_emp, v_pes,
    case when v_pub then 'publicidade' else 'materia' end,
    case when v_pub then 'Prospect' else 'Respondeu' end,
    'Contato · ' || coalesce(c.company, c.full_name),
    'contato', 'site', null,
    'Formulário de ' || c.kind || coalesce(' · ' || c.subject, '') || coalesce(' · orçamento: ' || c.budget, '')
      || E'\n' || coalesce(c.message, ''),
    case when v_pub then 'Responder contato e enviar mídia kit · ' else 'Responder e classificar contato · ' end
      || coalesce(c.company, c.full_name),
    null, c.id);
end $$;

-- Gatilhos de entrada: nunca bloqueiam o formulário do site. Se algo falhar no CRM,
-- o envio é gravado mesmo assim e o erro fica no log do banco.
create or replace function public.crm_pauta_leads_entrada()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  begin
    perform crm_ingerir_pauta(new);
  exception when others then
    raise warning '[crm] pauta_leads % não entrou no CRM: %', new.id, sqlerrm;
  end;
  return null;
end $$;

drop trigger if exists crm_pauta_leads_entrada on public.pauta_leads;
create trigger crm_pauta_leads_entrada after insert on public.pauta_leads
  for each row execute function public.crm_pauta_leads_entrada();

create or replace function public.crm_contact_messages_entrada()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  begin
    perform crm_ingerir_contato(new);
  exception when others then
    raise warning '[crm] contact_messages % não entrou no CRM: %', new.id, sqlerrm;
  end;
  return null;
end $$;

drop trigger if exists crm_contact_messages_entrada on public.contact_messages;
create trigger crm_contact_messages_entrada after insert on public.contact_messages
  for each row execute function public.crm_contact_messages_entrada();

-- Novo assinante da newsletter: liga à pessoa e avisa o dono da empresa do domínio.
create or replace function public.crm_leads_entrada()
returns trigger language plpgsql security definer set search_path = public as $$
declare v_dom text; emp record;
begin
  begin
    update crm_pessoas set newsletter_lead_id = new.id
      where lower(email) = lower(new.email) and newsletter_lead_id is null;
    v_dom := crm_dominio(new.email);
    if not crm_dominio_pessoal(v_dom) then
      for emp in
        select e.id, e.nome,
               coalesce(e.dono_id, (select n.dono_id from crm_negocios n
                                     where n.empresa_id = e.id and n.dono_id is not null
                                     order by n.updated_at desc limit 1)) as dono_id
          from crm_empresas e where e.dominio = v_dom and e.ativo
      loop
        insert into crm_tarefas (titulo, descricao, vence_em, automatica, chave, responsavel_id, empresa_id)
        values ('Novo assinante da newsletter na ' || emp.nome,
                new.email || ' assinou a newsletter (origem: ' || coalesce(new.source, '—') || ').',
                crm_hoje() + 2, true, 'assinante:' || new.id || ':' || emp.id, emp.dono_id, emp.id)
        on conflict do nothing;
        insert into crm_atividades (tipo, texto, empresa_id, autor_id)
        values ('sistema', new.email || ' assinou a newsletter.', emp.id, null);
      end loop;
    end if;
  exception when others then
    raise warning '[crm] leads % não entrou no CRM: %', new.id, sqlerrm;
  end;
  return null;
end $$;

drop trigger if exists crm_leads_entrada on public.leads;
create trigger crm_leads_entrada after insert on public.leads
  for each row execute function public.crm_leads_entrada();

-- ---------------------------------------------------------------------
-- 18. Rotina diária (chamada pela rotina agendada das 8h, só pelo servidor)
--   * lead aquecido: pessoa cadastrada que leu 3+ matérias em 7 dias;
--   * sem resposta: depois de 1 follow-up sem retorno, o negócio vai para
--     "Sem resposta" (volta para a fila em 30 dias, pela tarefa da etapa).
-- ---------------------------------------------------------------------
create or replace function public.crm_rotina_diaria()
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  r record;
  aquecidos integer := 0;
  sem_resposta integer := 0;
  v_sem uuid;
begin
  for r in
    with leituras as (
      select lower(v.lead_email) as email, ce.article_slug
        from content_engagement ce
        join (select distinct visitor_hash, lead_email from cta_events
              where lead_email is not null and visitor_hash is not null) v on v.visitor_hash = ce.visitor_hash
       where ce.created_at >= now() - interval '7 days' and ce.article_slug is not null
      union
      select lower(pr.email), re.article_slug
        from reading_events re join profiles pr on pr.user_id = re.user_id
       where re.read_at >= now() - interval '7 days' and re.article_slug is not null
    ), contagem as (
      select email, count(distinct article_slug) as n from leituras group by email having count(distinct article_slug) >= 3
    )
    select p.id, p.nome, p.dono_id, c.n,
           (select ep.empresa_id from crm_empresa_pessoas ep where ep.pessoa_id = p.id limit 1) as empresa_id
      from contagem c join crm_pessoas p on lower(p.email) = c.email
     where p.ativo and (p.aquecido_em is null or p.aquecido_em < now() - interval '7 days')
  loop
    update crm_pessoas set aquecido_em = now() where id = r.id;
    insert into crm_tarefas (titulo, descricao, vence_em, automatica, chave, responsavel_id, empresa_id, pessoa_id)
    values ('Lead aquecido · ' || r.nome,
            r.nome || ' leu ' || r.n || ' matérias nos últimos 7 dias.',
            crm_hoje(), true, 'aquecido:' || r.id || ':' || crm_hoje(),
            coalesce(r.dono_id, (select dono_id from crm_empresas where id = r.empresa_id)), r.empresa_id, r.id)
    on conflict do nothing;
    insert into crm_atividades (tipo, texto, empresa_id, pessoa_id, autor_id)
    values ('sistema', 'Lead aquecido: leu ' || r.n || ' matérias em 7 dias.', r.empresa_id, r.id, null);
    aquecidos := aquecidos + 1;
  end loop;

  select id into v_sem from crm_etapas where funil_id = 'materia' and nome = 'Sem resposta';
  if v_sem is not null then
    for r in
      select n.id from crm_negocios n join crm_etapas e on e.id = n.etapa_id
       where n.ativo and n.funil_id = 'materia' and e.nome in ('Contatado', 'Proposta')
         and (select count(*) from crm_atividades a where a.negocio_id = n.id
                and a.tipo in ('mensagem_enviada', 'email') and a.created_at >= n.etapa_desde) >= 2
         and not exists (select 1 from crm_atividades a where a.negocio_id = n.id
                and a.tipo = 'mensagem_recebida' and a.created_at >= n.etapa_desde)
         and (select max(a.created_at) from crm_atividades a where a.negocio_id = n.id
                and a.tipo in ('mensagem_enviada', 'email')) < now() - interval '3 days'
    loop
      update crm_negocios set etapa_id = v_sem where id = r.id;
      sem_resposta := sem_resposta + 1;
    end loop;
  end if;

  return jsonb_build_object('aquecidos', aquecidos, 'sem_resposta', sem_resposta);
end $$;

revoke execute on function public.crm_rotina_diaria() from public, anon, authenticated;
grant execute on function public.crm_rotina_diaria() to service_role;

-- Funções internas de entrada não são chamadas pelo navegador.
revoke execute on function public.crm_ingerir_pauta(public.pauta_leads) from public, anon, authenticated;
revoke execute on function public.crm_ingerir_contato(public.contact_messages) from public, anon, authenticated;
revoke execute on function public.crm_registrar_entrada(uuid, uuid, text, text, text, text, text, uuid, text, text, uuid, uuid) from public, anon, authenticated;
revoke execute on function public.crm_achar_ou_criar_empresa(text, text, text, text, text) from public, anon, authenticated;
revoke execute on function public.crm_achar_ou_criar_pessoa(text, text, text, text, text, text, boolean) from public, anon, authenticated;
revoke execute on function public.crm_ligar_pessoa_empresa(uuid, uuid, text) from public, anon, authenticated;
revoke execute on function public.crm_criar_tarefa_etapa(public.crm_negocios, public.crm_etapas) from public, anon, authenticated;
revoke execute on function public.crm_recalcular_empresa(uuid) from public, anon;
revoke execute on function public.crm_pontuacao_empresa(uuid, boolean, text, boolean, date) from public, anon;

-- ---------------------------------------------------------------------
-- 19. Equipe do CRM (para responsáveis e donos)
-- ---------------------------------------------------------------------
create or replace function public.crm_equipe()
returns table (user_id uuid, nome text, email text, papeis text[])
language plpgsql stable security definer set search_path = public as $$
begin
  if not crm_tem_acesso() and coalesce(auth.role(), '') <> 'service_role' then
    raise exception 'Acesso restrito à equipe do CRM.';
  end if;
  return query
    select u.id,
           coalesce(nullif(pr.full_name, ''), nullif(u.raw_user_meta_data->>'full_name', ''), split_part(u.email, '@', 1))::text,
           u.email::text,
           array_agg(distinct r.role::text order by r.role::text)
      from auth.users u
      join user_roles r on r.user_id = u.id and r.role::text in ('admin', 'comercial', 'editorial', 'editor')
      left join profiles pr on pr.user_id = u.id
     group by u.id, pr.full_name, u.raw_user_meta_data, u.email
     order by 2;
end $$;

revoke execute on function public.crm_equipe() from public, anon;
grant execute on function public.crm_equipe() to authenticated, service_role;

-- ---------------------------------------------------------------------
-- 20. Indicadores (calculados do banco, nunca digitados)
-- ---------------------------------------------------------------------
create or replace function public.crm_audiencia(p_inicio date, p_fim date)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare
  ini timestamptz := (p_inicio::timestamp at time zone 'America/Sao_Paulo');
  fim timestamptz := ((p_fim + 1)::timestamp at time zone 'America/Sao_Paulo');
  res jsonb;
begin
  if not crm_tem_acesso() and coalesce(auth.role(), '') <> 'service_role' then
    raise exception 'Acesso restrito à equipe do CRM.';
  end if;
  select jsonb_build_object(
    'assinantes_ativos', (select count(*) from leads where is_active and unsubscribed_at is null),
    'assinantes_confirmados', (select count(*) from leads where is_active and unsubscribed_at is null and confirmed_at is not null),
    'novos_periodo', (select count(*) from leads where created_at >= ini and created_at < fim),
    'confirmados_periodo', (select count(*) from leads where confirmed_at >= ini and confirmed_at < fim),
    'descadastros_periodo', (select count(*) from leads where unsubscribed_at >= ini and unsubscribed_at < fim),
    'novos_por_dia', coalesce((
      select jsonb_agg(jsonb_build_object('dia', d, 'novos', n, 'confirmados', c) order by d)
      from (select (created_at at time zone 'America/Sao_Paulo')::date d, count(*) n,
                   count(*) filter (where confirmed_at is not null) c
              from leads where created_at >= ini and created_at < fim group by 1) x), '[]'::jsonb),
    'origem_assinantes', coalesce((
      select jsonb_agg(jsonb_build_object('origem', o, 'total', n) order by n desc)
      from (select coalesce(nullif(utm_source, ''), nullif(source, ''), 'direto') o, count(*) n
              from leads where created_at >= ini and created_at < fim group by 1) x), '[]'::jsonb),
    'envios', coalesce((
      select jsonb_agg(jsonb_build_object('id', id, 'assunto', subject, 'tipo', kind, 'data', coalesce(started_at, created_at),
                                          'destinatarios', recipients_count, 'entregues', delivered_count,
                                          'falhas', failed_count, 'status', status) order by coalesce(started_at, created_at) desc)
      from (select * from newsletter_sends where coalesce(started_at, created_at) >= ini and coalesce(started_at, created_at) < fim
            order by coalesce(started_at, created_at) desc limit 60) s), '[]'::jsonb),
    'entregas_periodo', (
      select jsonb_build_object(
        'edicoes', count(*),
        'destinatarios', coalesce(sum(recipients_count), 0),
        'entregues', coalesce(sum(delivered_count), 0),
        'falhas', coalesce(sum(failed_count), 0))
      from newsletter_sends where coalesce(started_at, created_at) >= ini and coalesce(started_at, created_at) < fim),
    'visitas', (select count(*) from site_visits where visited_at >= ini and visited_at < fim),
    'visitantes', (select count(distinct visitor_hash) from site_visits where visited_at >= ini and visited_at < fim),
    'visitas_por_dia', coalesce((
      select jsonb_agg(jsonb_build_object('dia', d, 'visitas', n, 'visitantes', v) order by d)
      from (select (visited_at at time zone 'America/Sao_Paulo')::date d, count(*) n, count(distinct visitor_hash) v
              from site_visits where visited_at >= ini and visited_at < fim group by 1) x), '[]'::jsonb),
    'origem_visitas', coalesce((
      select jsonb_agg(jsonb_build_object('origem', o, 'total', n) order by n desc)
      from (select coalesce(nullif(utm_source, ''), nullif(referrer_host, ''), 'direto') o, count(*) n
              from site_visits where visited_at >= ini and visited_at < fim group by 1 order by 2 desc limit 15) x), '[]'::jsonb),
    'materias_mais_lidas', coalesce((
      select jsonb_agg(jsonb_build_object('slug', slug, 'titulo', titulo, 'visitas', visitas, 'leituras', leituras,
                                          'concluidas', concluidas, 'segundos_medios', segundos) order by visitas desc, leituras desc)
      from (select * from (
        select a.slug, a.title titulo,
               (select count(*) from site_visits v where v.path = '/materia/' || a.slug and v.visited_at >= ini and v.visited_at < fim) visitas,
               (select count(*) from content_engagement c where c.article_slug = a.slug and c.created_at >= ini and c.created_at < fim) leituras,
               (select count(*) from content_engagement c where c.article_slug = a.slug and c.completed and c.created_at >= ini and c.created_at < fim) concluidas,
               (select coalesce(round(avg(c.seconds)), 0) from content_engagement c where c.article_slug = a.slug and c.created_at >= ini and c.created_at < fim) segundos
          from articles a
         where a.status = 'published'
      ) t where visitas > 0 or leituras > 0
      order by visitas desc, leituras desc
      limit 20) x), '[]'::jsonb),
    'push_ativos', (select count(*) from push_subscriptions where is_active),
    'push_novos_periodo', (select count(*) from push_subscriptions where created_at >= ini and created_at < fim)
  ) into res;
  return res;
end $$;

create or replace function public.crm_relatorios(p_inicio date, p_fim date)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare
  ini timestamptz := (p_inicio::timestamp at time zone 'America/Sao_Paulo');
  fim timestamptz := ((p_fim + 1)::timestamp at time zone 'America/Sao_Paulo');
  res jsonb;
begin
  if not crm_tem_acesso() and coalesce(auth.role(), '') <> 'service_role' then
    raise exception 'Acesso restrito à equipe do CRM.';
  end if;
  select jsonb_build_object(
    'novos_por_origem', coalesce((
      select jsonb_agg(jsonb_build_object('origem', o, 'funil', f, 'total', n) order by n desc)
      from (select coalesce(origem, 'sem origem') o, funil_id f, count(*) n from crm_negocios
             where created_at >= ini and created_at < fim group by 1, 2) x), '[]'::jsonb),
    -- Passagem entre etapas: quantos negócios chegaram a cada etapa (pelo histórico) no período.
    'passagem_etapas', coalesce((
      select jsonb_agg(jsonb_build_object('funil', e.funil_id, 'etapa', e.nome, 'ordem', e.ordem, 'tipo', e.tipo,
                                          'chegaram', coalesce(c.n, 0)) order by e.funil_id, e.ordem)
      from crm_etapas e
      left join (
        select etapa_para, count(distinct negocio_id) n from crm_atividades
         where etapa_para is not null and created_at >= ini and created_at < fim
         group by 1) c on c.etapa_para = e.id
      where e.ativo), '[]'::jsonb),
    'fechados', coalesce((
      select jsonb_build_object(
        'quantidade', count(*),
        'receita', coalesce(sum(valor) filter (where status_pagamento = 'pago'), 0),
        'receita_prevista', coalesce(sum(valor) filter (where status_pagamento = 'pendente'), 0),
        'ticket_medio', coalesce(round(avg(valor) filter (where status_pagamento = 'pago' and valor > 0), 2), 0),
        'cortesias', count(*) filter (where status_pagamento = 'cortesia'),
        'dias_medios_ate_fechar', coalesce(round(avg(extract(epoch from (fechado_em - created_at)) / 86400)::numeric, 1), 0))
      from crm_negocios n join crm_etapas e on e.id = n.etapa_id
      where e.tipo = 'ganha' and n.fechado_em >= ini and n.fechado_em < fim), '{}'::jsonb),
    'receita_por_funil', coalesce((
      select jsonb_agg(jsonb_build_object('funil', f, 'quantidade', q, 'receita', r) order by r desc)
      from (select n.funil_id f, count(*) q, coalesce(sum(n.valor) filter (where n.status_pagamento = 'pago'), 0) r
              from crm_negocios n join crm_etapas e on e.id = n.etapa_id
             where e.tipo = 'ganha' and n.fechado_em >= ini and n.fechado_em < fim group by 1) x), '[]'::jsonb),
    'motivos_perda', coalesce((
      select jsonb_agg(jsonb_build_object('motivo', m, 'total', n) order by n desc)
      from (select coalesce(nullif(trim(motivo_perda), ''), 'sem motivo') m, count(*) n
              from crm_negocios n join crm_etapas e on e.id = n.etapa_id
             where e.tipo = 'perdida' and n.fechado_em >= ini and n.fechado_em < fim group by 1) x), '[]'::jsonb),
    'pautas_que_geraram', coalesce((
      select jsonb_agg(jsonb_build_object('slug', x.slug, 'titulo', x.title, 'leads', x.leads, 'vendas', x.vendas, 'receita', x.receita) order by x.leads desc)
      from (select a.slug, a.title, g.* from (
        select n.article_id, count(*) leads,
               count(*) filter (where e.tipo = 'ganha') vendas,
               coalesce(sum(n.valor) filter (where e.tipo = 'ganha' and n.status_pagamento = 'pago'), 0) receita
          from crm_negocios n join crm_etapas e on e.id = n.etapa_id
         where n.article_id is not null and n.created_at >= ini and n.created_at < fim
         group by 1) g join articles a on a.id = g.article_id
      order by g.leads desc
      limit 20) x), '[]'::jsonb),
    'collab', (
      select jsonb_build_object(
        'com_resposta', count(*) filter (where collab_aceito is not null),
        'aceitos', count(*) filter (where collab_aceito))
      from crm_conteudos where ativo and coalesce(publicado_em, created_at) >= ini and coalesce(publicado_em, created_at) < fim),
    'equipe', coalesce((
      select jsonb_agg(jsonb_build_object('user_id', uid, 'tarefas_feitas', feitas, 'no_prazo', prazo,
                                          'mensagens', msgs) order by feitas desc)
      from (
        select uid, sum(feitas) feitas, sum(prazo) prazo, sum(msgs) msgs from (
          select responsavel_id uid, count(*) feitas,
                 count(*) filter (where vence_em is null or (feita_em at time zone 'America/Sao_Paulo')::date <= vence_em) prazo,
                 0 msgs
            from crm_tarefas where feita and feita_em >= ini and feita_em < fim and responsavel_id is not null group by 1
          union all
          select autor_id, 0, 0, count(*) from crm_atividades
           where tipo in ('mensagem_enviada', 'email', 'ligacao', 'reuniao') and created_at >= ini and created_at < fim
             and autor_id is not null group by 1
        ) u group by uid) y), '[]'::jsonb),
    'abertos', (
      select jsonb_build_object('quantidade', count(*), 'valor', coalesce(sum(valor), 0),
                                'atrasados', count(*) filter (where proxima_acao_em < crm_hoje()),
                                'sem_proxima_acao', count(*) filter (where proxima_acao_em is null))
      from crm_negocios n join crm_etapas e on e.id = n.etapa_id where n.ativo and e.tipo = 'aberta')
  ) into res;
  return res;
end $$;

revoke execute on function public.crm_audiencia(date, date) from public, anon;
revoke execute on function public.crm_relatorios(date, date) from public, anon;
grant execute on function public.crm_audiencia(date, date) to authenticated, service_role;
grant execute on function public.crm_relatorios(date, date) to authenticated, service_role;

-- ---------------------------------------------------------------------
-- 21. Visões de apoio (security_invoker: respeitam a RLS de quem consulta)
-- ---------------------------------------------------------------------
create or replace view public.crm_negocios_resumo with (security_invoker = true) as
select n.*,
       e.nome as etapa_nome, e.tipo as etapa_tipo, e.ordem as etapa_ordem,
       (select max(a.created_at) from public.crm_atividades a where a.negocio_id = n.id) as ultima_atividade_em,
       (select max(a.created_at) from public.crm_atividades a
         where a.negocio_id = n.id and a.tipo in ('mensagem_enviada', 'email')) as ultima_enviada_em,
       (select max(a.created_at) from public.crm_atividades a
         where a.negocio_id = n.id and a.tipo = 'mensagem_recebida') as ultima_recebida_em
  from public.crm_negocios n
  join public.crm_etapas e on e.id = n.etapa_id;

-- Fila "Viraram pauta": empresas citadas em matéria ou post depois do último negócio
-- (ou que nunca tiveram negócio) e sem negócio aberto.
create or replace view public.crm_viraram_pauta with (security_invoker = true) as
select e.id as empresa_id, e.nome, e.grupo, e.pontuacao, e.dono_id, e.instagram, e.brasileira,
       count(*) as mencoes,
       max(coalesce(a.published_at, c.publicado_em, m.created_at)) as ultima_mencao_em,
       (array_agg(a.id order by a.published_at desc nulls last) filter (where a.id is not null))[1] as article_id,
       (array_agg(a.slug order by a.published_at desc nulls last) filter (where a.slug is not null))[1] as article_slug,
       (array_agg(a.title order by a.published_at desc nulls last) filter (where a.title is not null))[1] as article_title,
       (array_agg(c.url order by c.publicado_em desc nulls last) filter (where c.url is not null))[1] as post_url
  from public.crm_empresas e
  join public.crm_mencoes m on m.empresa_id = e.id and m.ativo
  left join public.articles a on a.id = m.article_id
  left join public.crm_conteudos c on c.id = m.conteudo_id and c.ativo
 where e.ativo
   and not exists (
     select 1 from public.crm_negocios n join public.crm_etapas et on et.id = n.etapa_id
      where n.empresa_id = e.id and n.ativo and et.tipo = 'aberta')
   and not exists (
     select 1 from public.crm_negocios n where n.empresa_id = e.id and n.created_at >= m.created_at)
 group by e.id;

revoke all on public.crm_negocios_resumo from anon;
revoke all on public.crm_viraram_pauta from anon;
grant select on public.crm_negocios_resumo to authenticated, service_role;
grant select on public.crm_viraram_pauta to authenticated, service_role;

-- ---------------------------------------------------------------------
-- 22. Dados iniciais: funis, etapas e modelos de mensagem
-- ---------------------------------------------------------------------
insert into public.crm_funis (id, nome, ordem) values
  ('materia', 'Matéria paga e destaque', 1),
  ('publicidade', 'Publicidade', 2),
  ('parcerias', 'Parcerias', 3)
on conflict (id) do nothing;

insert into public.crm_etapas (funil_id, nome, ordem, prazo_dias, acao_padrao, tipo, criterio_entrada) values
  ('materia', 'Novo', 1, 2, 'Enviar 1ª mensagem da Renata', 'aberta', 'Lead cadastrado com empresa e pessoa'),
  ('materia', 'Contatado', 2, 3, 'Follow-up curto', 'aberta', '1ª mensagem enviada (Direct, LinkedIn ou e-mail)'),
  ('materia', 'Respondeu', 3, 0, '2 mensagens no WhatsApp', 'aberta', 'Respondeu e passou o WhatsApp'),
  ('materia', 'Briefing', 4, 3, 'Cobrar informações do briefing', 'aberta', 'PDF de briefing enviado'),
  ('materia', 'Aprovado', 5, 0, 'Enviar 3ª mensagem com o valor', 'aberta', 'Matéria aprovada pelo lead'),
  ('materia', 'Proposta', 6, 2, 'Follow-up da proposta', 'aberta', 'Valor enviado'),
  ('materia', 'Fechado', 7, 1, 'Produzir e agendar', 'ganha', 'Pago, ou cortesia com collab confirmada'),
  ('materia', 'Publicado', 8, 1, 'Enviar links e pós-venda', 'ganha', 'Matéria e posts no ar'),
  ('materia', 'Sem resposta', 98, 30, 'Mensagem de reativação', 'aberta', 'Sem retorno depois de 1 follow-up'),
  ('materia', 'Perdido', 99, null, null, 'perdida', 'Saiu do funil (motivo registrado)'),
  ('publicidade', 'Prospect', 1, 3, 'Enviar mídia kit', 'aberta', 'Empresa identificada como possível anunciante'),
  ('publicidade', 'Mídia kit enviado', 2, 3, 'Marcar conversa', 'aberta', 'Mídia kit entregue ao contato certo'),
  ('publicidade', 'Conversa', 3, 2, 'Montar proposta', 'aberta', 'Reunião ou troca de mensagens sobre objetivos'),
  ('publicidade', 'Proposta', 4, 3, 'Follow-up', 'aberta', 'Proposta com pacote, datas e valor enviada'),
  ('publicidade', 'Negociação', 5, 2, 'Fechar ajustes', 'aberta', 'Ajustes de escopo ou valor'),
  ('publicidade', 'Fechado', 6, 1, 'Agendar peças', 'ganha', 'Aceite e pagamento (ou contrato)'),
  ('publicidade', 'Em veiculação', 7, null, 'Acompanhar entregas', 'ganha', 'Peças agendadas ou publicadas'),
  ('publicidade', 'Relatório entregue', 8, 30, 'Oferecer renovação', 'ganha', 'Relatório com o que foi publicado enviado'),
  ('publicidade', 'Perdido', 99, null, null, 'perdida', 'Saiu do funil (motivo registrado)'),
  ('parcerias', 'Identificada', 1, 5, 'Primeiro contato', 'aberta', 'Oportunidade registrada'),
  ('parcerias', 'Em conversa', 2, 5, 'Definir termos', 'aberta', 'Primeiro contato feito'),
  ('parcerias', 'Acordo', 3, 3, 'Iniciar', 'aberta', 'Termos combinados'),
  ('parcerias', 'Ativa', 4, 30, 'Revisar resultado', 'ganha', 'Parceria em andamento'),
  ('parcerias', 'Encerrada', 5, null, null, 'ganha', 'Parceria concluída, com resultado anotado'),
  ('parcerias', 'Perdido', 99, null, null, 'perdida', 'Saiu do funil (motivo registrado)')
on conflict (funil_id, nome) do nothing;

-- Modelos da Renata. Regras: assinatura "Renata, da IA News" (sempre no feminino);
-- 1ª mensagem igual para todos e sem valor; valor só na 3ª mensagem, depois da aprovação;
-- reativação só pergunta se ainda tem interesse; "viraram pauta" sem métricas e sem preço.
insert into public.crm_modelos (nome, canal, etapa_id, texto, ordem) values
  ('1ª mensagem · Direct', 'direct',
   (select id from public.crm_etapas where funil_id = 'materia' and nome = 'Novo'),
   E'Oi, {nome}! Tudo bem?\n\nAqui é a Renata, da IA News. Acompanhamos o trabalho da {empresa} e achamos que a história de vocês combina muito com o nosso público de empreendedores e líderes que usam inteligência artificial nos negócios.\n\nEstamos selecionando empresas para aparecer no portal e nas nossas redes. Se fizer sentido para você, posso te enviar os detalhes? Qual o melhor WhatsApp para falarmos?\n\nRenata, da IA News', 10),
  ('1ª mensagem · E-mail', 'email',
   (select id from public.crm_etapas where funil_id = 'materia' and nome = 'Novo'),
   E'Oi, {nome}! Tudo bem?\n\nAqui é a Renata, da IA News (ianewsbr.com). Acompanhamos o trabalho da {empresa} e achamos que a história de vocês combina muito com o nosso público de empreendedores e líderes que usam inteligência artificial nos negócios.\n\nEstamos selecionando empresas para aparecer no portal e nas nossas redes. Se fizer sentido para você, posso te enviar os detalhes? Se preferir, me passe seu WhatsApp.\n\nRenata, da IA News', 11),
  ('Follow-up curto', 'direct',
   (select id from public.crm_etapas where funil_id = 'materia' and nome = 'Contatado'),
   E'Oi, {nome}! Passando só para saber se você viu minha mensagem sobre a {empresa} na IA News. Se fizer sentido para você, me passa seu WhatsApp que te envio os detalhes.\n\nRenata, da IA News', 20),
  ('WhatsApp · 1ª mensagem', 'whatsapp',
   (select id from public.crm_etapas where funil_id = 'materia' and nome = 'Respondeu'),
   E'Oi, {nome}! Aqui é a Renata, da IA News. Que bom falar com você por aqui! Já te mando como funciona.', 30),
  ('WhatsApp · 2ª mensagem (como funciona)', 'whatsapp',
   (select id from public.crm_etapas where funil_id = 'materia' and nome = 'Respondeu'),
   E'A IA News é um portal e newsletter sobre inteligência artificial nos negócios, com conteúdo diário no site, na newsletter e nas redes (Instagram, Facebook, LinkedIn e Threads).\n\nA ideia é contar a história da {empresa}: quem são vocês, o que fazem com IA e o que vem pela frente. Para isso, te envio um briefing rápido em PDF com algumas perguntas. Assim que você responder, nossa equipe monta a matéria e te mostra antes de publicar.\n\nRenata, da IA News', 31),
  ('Cobrar briefing', 'whatsapp',
   (select id from public.crm_etapas where funil_id = 'materia' and nome = 'Briefing'),
   E'Oi, {nome}! Tudo certo com o briefing da {empresa}? Se ficou alguma dúvida, me chama que eu te ajudo a responder.\n\nRenata, da IA News', 40),
  ('3ª mensagem · Valor', 'whatsapp',
   (select id from public.crm_etapas where funil_id = 'materia' and nome = 'Aprovado'),
   E'{nome}, que bom que você gostou da matéria da {empresa}!\n\nPara publicar no site e nas nossas redes, o investimento é de {valor}. Assim que confirmar, já agendamos a publicação e te envio os links.\n\nRenata, da IA News', 50),
  ('Follow-up da proposta', 'whatsapp',
   (select id from public.crm_etapas where funil_id = 'materia' and nome = 'Proposta'),
   E'Oi, {nome}! Conseguiu ver a proposta da matéria da {empresa}? Fico à disposição para qualquer dúvida.\n\nRenata, da IA News', 60),
  ('Pós-venda · Links publicados', 'whatsapp',
   (select id from public.crm_etapas where funil_id = 'materia' and nome = 'Publicado'),
   E'{nome}, a matéria da {empresa} já está no ar!\n\nSite: {link_materia}\nPost: {link_post}\n\nObrigada pela parceria. Se quiser compartilhar, é só usar os links acima.\n\nRenata, da IA News', 70),
  ('Reativação', 'direct',
   (select id from public.crm_etapas where funil_id = 'materia' and nome = 'Sem resposta'),
   E'Oi, {nome}! Tudo bem? Passando para saber se ainda faz sentido conversarmos sobre a {empresa} na IA News.\n\nRenata, da IA News', 80),
  ('Viraram pauta · 1º contato', 'direct', null,
   E'Oi, {nome}! Tudo bem?\n\nAqui é a Renata, da IA News. A {empresa} apareceu no nosso conteúdo e quis te mandar em primeira mão:\n\nMatéria no site: {link_materia}\nPost: {link_post}\n\nSe fizer sentido para você, posso te enviar os detalhes de como seguir contando a história de vocês. Qual o melhor WhatsApp para falarmos?\n\nRenata, da IA News', 90),
  ('LinkedIn · Convite sem pitch', 'linkedin', null,
   E'Oi, {nome}! Acompanho o trabalho da {empresa} e gostaria de me conectar por aqui.', 100),
  ('LinkedIn · Depois de aceitar', 'linkedin', null,
   E'Obrigado por aceitar, {nome}! Publicamos conteúdos sobre empresas que usam IA nos negócios. Este pode te interessar: {link_materia}', 101),
  ('Publicidade · Mídia kit', 'email',
   (select id from public.crm_etapas where funil_id = 'publicidade' and nome = 'Prospect'),
   E'Oi, {nome}! Tudo bem?\n\nAqui é a Renata, da IA News. Seguem os detalhes de como a {empresa} pode aparecer para o nosso público de empreendedores e líderes que usam IA: site, newsletter diária e redes sociais.\n\nO pacote de entrada inclui 3 conteúdos (post, stories e reels). Te envio o mídia kit completo? Se preferir, marcamos uma conversa rápida.\n\nRenata, da IA News', 110),
  ('Publicidade · Renovação', 'email',
   (select id from public.crm_etapas where funil_id = 'publicidade' and nome = 'Relatório entregue'),
   E'Oi, {nome}! Espero que o relatório da campanha da {empresa} tenha sido útil. Quer conversar sobre os próximos conteúdos?\n\nRenata, da IA News', 120)
on conflict (nome) do nothing;

-- ---------------------------------------------------------------------
-- 23. Carga inicial: formulários que ainda não estão no CRM
--     (pautas de teste já descartadas ficam de fora)
-- ---------------------------------------------------------------------
do $$
declare p public.pauta_leads; c public.contact_messages;
begin
  for p in select * from public.pauta_leads where status <> 'descartado' order by created_at loop
    perform public.crm_ingerir_pauta(p);
  end loop;
  for c in select * from public.contact_messages where status in ('nova', 'andamento') order by created_at loop
    perform public.crm_ingerir_contato(c);
  end loop;
end $$;

-- ---------------------------------------------------------------------
-- 24. Funções de gatilho e de cálculo interno não são chamadas pela API
--     (alerta do Supabase "SECURITY DEFINER executável"); os gatilhos continuam funcionando.
-- ---------------------------------------------------------------------
do $$
declare f text;
begin
  foreach f in array array[
    'crm_campanhas_antes()', 'crm_contact_messages_entrada()', 'crm_empresas_antes()', 'crm_entregas_antes()',
    'crm_leads_entrada()', 'crm_negocios_antes()', 'crm_negocios_depois()', 'crm_pauta_leads_entrada()',
    'crm_pessoas_antes()', 'crm_tocar_empresas()', 'crm_tarefas_antes()', 'crm_set_updated_at()',
    'crm_pontuacao_empresa(uuid, boolean, text, boolean, date)', 'crm_recalcular_empresa(uuid)'] loop
    execute format('revoke execute on function public.%s from public, anon, authenticated', f);
    execute format('grant execute on function public.%s to service_role', f);
  end loop;
end $$;
