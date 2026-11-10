-- Mini chat da Renata no Direct do Instagram (10/11/2026).
-- Conversas por pessoa (estado do fluxo), palavras-chave editáveis, log de eventos e a função que leva cada
-- contato coletado ao CRM, no funil do fluxo.

create table if not exists ig_conversas (
  igsid text primary key,
  username text,
  nome text,
  pessoa_id uuid references crm_pessoas(id),
  fluxo text,
  passo text,
  dados jsonb not null default '{}'::jsonb,
  pontos int not null default 0,
  segue boolean,
  humano_ate timestamptz,
  optout boolean not null default false,
  menu_em timestamptz,
  ultima_entrada timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table ig_conversas enable row level security;

create table if not exists ig_palavras (
  palavra text primary key,
  fluxo text not null,
  media_id text,
  ativo boolean not null default true,
  created_at timestamptz not null default now()
);
alter table ig_palavras enable row level security;

insert into ig_palavras (palavra, fluxo) values
  ('7H', 'noticias'), ('NEWS', 'noticias'), ('NOTICIAS', 'noticias'), ('NEWSLETTER', 'noticias'),
  ('RADAR', 'radar'), ('SETOR', 'radar'),
  ('LISTA', 'lista'), ('LISTA100', 'lista'),
  ('AULA', 'aula'),
  ('PALCO', 'palco'), ('EVENTO', 'palco'),
  ('CONSELHO', 'conselho'),
  ('PROJETO', 'projeto'),
  ('ANUNCIAR', 'anunciar'), ('MIDIAKIT', 'anunciar'), ('PUBLICIDADE', 'anunciar'),
  ('PAUTA', 'pauta'), ('DESTAQUE', 'pauta'),
  ('MENU', 'menu'), ('OI', 'menu'), ('OLA', 'menu'),
  ('FALAR', 'humano'), ('ATENDIMENTO', 'humano'),
  ('SAIR', 'sair'), ('PARAR', 'sair')
on conflict (palavra) do nothing;

create table if not exists ig_eventos (
  id bigserial primary key,
  created_at timestamptz not null default now(),
  chave text unique,
  igsid text,
  tipo text,
  texto text,
  fluxo text,
  resultado text,
  erro text
);
alter table ig_eventos enable row level security;
create index if not exists ig_eventos_igsid_idx on ig_eventos (igsid, created_at desc);

-- Leva o contato do Direct ao CRM. p: {igsid, username, nome, email, whatsapp, fluxo, nota, setor, perfil, pontos}
create or replace function ig_lead_crm(p jsonb) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_user text := nullif(lower(regexp_replace(coalesce(p->>'username', ''), '^@', '')), '');
  v_nome text := coalesce(nullif(trim(p->>'nome'), ''), nullif(p->>'username', ''), 'Contato do Instagram');
  v_email text := nullif(lower(trim(coalesce(p->>'email', ''))), '');
  v_wpp text := nullif(trim(coalesce(p->>'whatsapp', '')), '');
  v_fluxo text := p->>'fluxo';
  v_pessoa uuid := nullif(p->>'pessoa_id', '')::uuid;
  v_neg uuid;
  v_tags uuid[] := crm_tag_perfil(p->>'perfil');
  v_titulo text;
begin
  perform set_config('crm.sem_tarefa_auto', 'on', true);
  if v_pessoa is null and v_user is not null then
    select id into v_pessoa from crm_pessoas
     where lower(regexp_replace(regexp_replace(coalesce(instagram, ''), '^https?://(www\.)?instagram\.com/', '', 'i'), '^@|/.*$', '', 'g')) = v_user
     order by created_at limit 1;
  end if;
  if v_pessoa is null then
    v_pessoa := crm_pessoa_por_contato(v_nome, v_email, v_wpp, 'instagram_direct', true, p->>'nota');
  else
    update crm_pessoas
       set email = coalesce(email, v_email),
           whatsapp = coalesce(whatsapp, v_wpp),
           consentimento = true,
           consentimento_em = coalesce(consentimento_em, now()),
           notas = case when nullif(p->>'nota', '') is null then notas else concat_ws(E'\n', notas, p->>'nota') end
     where id = v_pessoa;
  end if;
  if v_user is not null then
    update crm_pessoas set instagram = coalesce(instagram, '@' || v_user) where id = v_pessoa;
  end if;

  -- Newsletter: quem pediu por e-mail entra direto (pediu na conversa)
  if v_email is not null and v_fluxo in ('noticias', 'radar') then
    insert into leads (email, full_name, source, is_active, confirmed_at, utm_source, utm_medium, utm_campaign)
    select v_email, v_nome, 'instagram_direct', true, now(), 'instagram', 'direct', v_fluxo
     where not exists (select 1 from leads where lower(email) = v_email);
  end if;

  v_titulo := split_part(v_nome, ' ', 1);
  v_neg := case v_fluxo
    when 'noticias' then crm_negocio_no_funil('nutricao', 'No canal ou newsletter', 'Canal e newsletter · ' || v_nome, v_pessoa, null, v_tags, 'instagram_direct', null, null, true)
    when 'radar' then crm_negocio_no_funil('nutricao', 'No canal ou newsletter', 'Radar do setor · ' || v_nome, v_pessoa, null, v_tags, 'instagram_direct', 'Enviar o Radar de ' || coalesce(p->>'setor', 'setor'), null, true)
    when 'conselho' then crm_negocio_no_funil('conselho', 'Candidato', 'Conselho IA News · ' || v_nome, v_pessoa, null, v_tags, 'instagram_direct', 'Marcar a conversa de 15 minutos (veio do Direct)', crm_hoje(), true)
    when 'projeto' then crm_negocio_no_funil('implementacao', 'Lead', 'Balcão de Projetos · ' || v_nome, v_pessoa, null, crm_tag_perfil('empresario'), 'instagram_direct', 'Responder em até 24 h e marcar a conversa de 20 minutos', crm_hoje(), false)
    when 'anunciar' then crm_negocio_no_funil('publicidade', 'Conversa', 'Publicidade · ' || coalesce(nullif(p->>'empresa', ''), v_nome), v_pessoa, null, crm_tag_perfil('marca'), 'instagram_direct', 'Henrique: responder com a proposta (pediu o mídia kit no Direct)', crm_hoje(), true)
    when 'palco_marca' then crm_negocio_no_funil('publicidade', 'Conversa', 'Patrocínio Palco · ' || coalesce(nullif(p->>'empresa', ''), v_nome), v_pessoa, null, crm_tag_perfil('marca'), 'instagram_direct', 'Enviar as cotas do Palco', crm_hoje(), true)
    when 'humano' then null
    else null end;

  if v_fluxo = 'humano' then
    insert into crm_tarefas (titulo, descricao, vence_em, automatica, chave, pessoa_id)
    values ('Responder no Direct · ' || coalesce('@' || v_user, v_nome),
            'Pediu atendimento humano no Direct da @ianews.co. ' || coalesce(p->>'nota', ''),
            crm_hoje(), true, 'ig_humano:' || coalesce(p->>'igsid', v_user) || ':' || to_char(now(), 'YYYYMMDD'), v_pessoa)
    on conflict (chave) where chave is not null do nothing;
  end if;

  insert into crm_atividades (tipo, canal, texto, pessoa_id, negocio_id)
  values ('mensagem_recebida', 'instagram', 'Direct (mini chat, fluxo ' || coalesce(v_fluxo, '?') || ')' || coalesce(': ' || nullif(p->>'nota', ''), ''), v_pessoa, v_neg);

  return jsonb_build_object('pessoa_id', v_pessoa, 'negocio_id', v_neg);
end $$;
revoke all on function ig_lead_crm(jsonb) from public, anon, authenticated;

-- Lead em conversa comercial ou cliente: o robô não interrompe, passa para a Renata
create or replace function ig_em_conversa(p_username text) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from crm_pessoas p
      join crm_negocios n on n.pessoa_id = p.id and n.ativo
      join crm_etapas e on e.id = n.etapa_id
     where lower(regexp_replace(regexp_replace(coalesce(p.instagram, ''), '^https?://(www\.)?instagram\.com/', '', 'i'), '^@|/.*$', '', 'g')) = lower(regexp_replace(p_username, '^@', ''))
       and ((n.funil_id = 'materia' and e.nome in ('Respondeu', 'Briefing', 'Aprovado', 'Proposta', 'Follow-up', 'Fechado', 'Publicado'))
         or (n.funil_id = 'conselho' and e.nome in ('Conversa marcada', 'Proposta', 'Membro'))
         or (n.funil_id = 'publicidade' and e.nome in ('Conversa', 'Proposta', 'Negociação', 'Fechado', 'Em veiculação'))
         or n.status_pagamento = 'pago')
  )
$$;
revoke all on function ig_em_conversa(text) from public, anon, authenticated;
