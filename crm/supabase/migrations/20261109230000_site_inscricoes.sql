-- Páginas de coleta da estratégia de monetização (09/11/2026):
-- /lista100 (candidatura e indicação), /aula (Aula ao vivo), /conselho (candidatura + conversa de 15 min)
-- e /projetos (Balcão de Projetos). Tudo grava em site_inscricoes; um gatilho leva cada envio ao CRM.

-- 1. Funis novos ---------------------------------------------------------------------------------
insert into crm_funis (id, nome, ordem, ativo) values
  ('lista100', 'Lista IA News 100', 7, true),
  ('aula', 'Aula ao vivo', 8, true),
  ('conselho', 'Conselho IA News', 9, true)
on conflict (id) do update set nome = excluded.nome, ativo = true;

insert into crm_etapas (funil_id, nome, ordem, prazo_dias, tipo, acao_padrao, criterio_entrada, ativo)
select v.funil_id, v.nome, v.ordem, v.prazo, v.tipo, v.acao, v.criterio, true
from (values
  ('lista100', 'Indicado', 1, 3, 'aberta', 'Convidar o indicado a se candidatar à Lista 100 (modelo "Indicação · E")', 'Alguém indicou pela página /lista100'),
  ('lista100', 'Candidato', 2, 7, 'aberta', 'Aguardar o júri; responder dúvidas no mesmo dia', 'Enviou a candidatura pela página'),
  ('lista100', 'Em avaliação', 3, 5, 'aberta', 'Júri avalia de 08 a 12/12', 'Candidatura completa, com caso e resultado'),
  ('lista100', 'Listado', 4, null, 'ganha', null, 'Escolhido pelo júri'),
  ('lista100', 'Não listado', 99, null, 'perdida', null, 'Não escolhido nesta edição'),
  ('aula', 'Inscrito', 1, null, 'aberta', 'Lembretes saem sozinhos na véspera e 1 hora antes', 'Inscreveu-se pela página /aula'),
  ('aula', 'Presente', 2, null, 'ganha', null, 'Assistiu ao vivo'),
  ('aula', 'Faltou', 99, null, 'perdida', null, 'Não apareceu: recebe o replay'),
  ('conselho', 'Convidado', 1, 3, 'aberta', 'Convite pessoal da Renata (modelo "Conselho · 1")', 'Convidado pela equipe'),
  ('conselho', 'Candidato', 2, 1, 'aberta', 'Marcar a conversa de 15 minutos', 'Candidatou-se sem escolher horário'),
  ('conselho', 'Conversa marcada', 3, 1, 'aberta', 'Fazer a conversa de 15 minutos e apresentar a proposta', 'Escolheu um horário na página /conselho'),
  ('conselho', 'Proposta', 4, 3, 'aberta', 'Enviar o link de adesão e acompanhar', 'Recebeu a proposta'),
  ('conselho', 'Membro', 5, null, 'ganha', null, 'Pagou a adesão'),
  ('conselho', 'Não agora', 99, null, 'perdida', null, 'Não entrou nesta turma')
) v(funil_id, nome, ordem, prazo, tipo, acao, criterio)
where not exists (select 1 from crm_etapas e where e.funil_id = v.funil_id and e.nome = v.nome);

-- 2. Fila: lembretes e boas-vindas ---------------------------------------------------------------
alter table auto_fila drop constraint if exists auto_fila_passo_check;
alter table auto_fila add constraint auto_fila_passo_check
  check (passo = any (array['D0','D3','D7','D15','D21','previa','data','publicado','resposta','lembrete']));

-- 3. Configuração ---------------------------------------------------------------------------------
insert into auto_config (chave, valor) values
  ('aula_atual', '{"numero": 1, "inicio": "2026-11-25T19:00:00-03:00", "titulo": "Como empresas brasileiras estão colocando IA para vender", "link": null}'::jsonb),
  ('conselho_agenda', '{"dias_semana": [1,2,3,4,5], "inicio": "10:00", "fim": "18:00", "passo_min": 30, "antecedencia_h": 3, "dias_frente": 10}'::jsonb)
on conflict (chave) do nothing;

-- 4. Tabela de inscrições ------------------------------------------------------------------------
create table if not exists site_inscricoes (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  tipo text not null check (tipo in ('lista100', 'indicacao', 'aula', 'conselho', 'projeto')),
  nome text not null,
  empresa text,
  cargo text,
  whatsapp text,
  email text not null,
  perfil text,
  dados jsonb not null default '{}'::jsonb,
  indicados jsonb not null default '[]'::jsonb,
  agendado_em timestamptz,
  consentimento boolean not null default false,
  status text not null default 'recebido' check (status in ('recebido', 'cancelado', 'teste')),
  origem_path text,
  utm_source text,
  utm_medium text,
  utm_campaign text,
  device text,
  ip_hash text,
  pessoa_id uuid references crm_pessoas(id),
  negocio_id uuid references crm_negocios(id)
);
alter table site_inscricoes enable row level security;
create index if not exists site_inscricoes_tipo_idx on site_inscricoes (tipo, created_at desc);
create index if not exists site_inscricoes_email_idx on site_inscricoes (lower(email));
-- Um horário do Conselho só pode ser reservado uma vez
create unique index if not exists site_inscricoes_horario_unico
  on site_inscricoes (agendado_em) where tipo = 'conselho' and agendado_em is not null and status = 'recebido';

-- 5. Auxiliares ----------------------------------------------------------------------------------
create or replace function crm_pessoa_por_contato(p_nome text, p_email text, p_whatsapp text, p_origem text,
                                                  p_consent boolean, p_notas text)
returns uuid language plpgsql security definer set search_path = public as $$
declare
  v_wpp text := nullif(regexp_replace(coalesce(p_whatsapp, ''), '\D', '', 'g'), '');
  v_email text := nullif(lower(trim(coalesce(p_email, ''))), '');
  v_id uuid;
begin
  select id into v_id from crm_pessoas
   where (v_email is not null and lower(email) = v_email)
      or (v_wpp is not null and length(v_wpp) >= 10 and regexp_replace(coalesce(whatsapp, ''), '\D', '', 'g') = v_wpp)
   order by (v_email is not null and lower(email) = v_email) desc nulls last, created_at
   limit 1;
  if v_id is null then
    insert into crm_pessoas (nome, email, whatsapp, consentimento, consentimento_em, origem, notas, ativo)
    values (trim(p_nome), v_email, nullif(trim(coalesce(p_whatsapp, '')), ''), coalesce(p_consent, false),
            case when p_consent then now() end, p_origem, nullif(p_notas, ''), true)
    returning id into v_id;
  else
    update crm_pessoas
       set whatsapp = coalesce(whatsapp, nullif(trim(coalesce(p_whatsapp, '')), '')),
           email = coalesce(email, v_email),
           consentimento = coalesce(consentimento, false) or coalesce(p_consent, false),
           consentimento_em = coalesce(consentimento_em, case when p_consent then now() end),
           notas = case when nullif(p_notas, '') is null then notas else concat_ws(E'\n', notas, p_notas) end
     where id = v_id;
  end if;
  return v_id;
end $$;

create or replace function crm_empresa_por_nome(p_nome text, p_pessoa uuid, p_cargo text, p_origem text, p_setor text)
returns uuid language plpgsql security definer set search_path = public as $$
declare v_id uuid;
begin
  if nullif(trim(coalesce(p_nome, '')), '') is null then return null; end if;
  select id into v_id from crm_empresas where lower(nome) = lower(trim(p_nome)) order by created_at limit 1;
  if v_id is null then
    insert into crm_empresas (nome, setor, origem, ativo)
    values (trim(p_nome), nullif(trim(coalesce(p_setor, '')), ''), p_origem, true)
    returning id into v_id;
  end if;
  if p_pessoa is not null then
    insert into crm_empresa_pessoas (empresa_id, pessoa_id, cargo)
    values (v_id, p_pessoa, nullif(trim(coalesce(p_cargo, '')), ''))
    on conflict do nothing;
  end if;
  return v_id;
end $$;

create or replace function crm_tag_perfil(p_perfil text) returns uuid[] language sql stable set search_path = public as $$
  select coalesce(array_agg(id), '{}'::uuid[]) from crm_tags
   where nome = case p_perfil
     when 'fornecedor' then 'Perfil A · Fornecedor de IA'
     when 'startup' then 'Perfil A · Fornecedor de IA'
     when 'criador' then 'Perfil B · Criador de IA'
     when 'empresario' then 'Perfil C · Empresário'
     when 'executivo' then 'Perfil C · Empresário'
     when 'marca' then 'Perfil D · Empresa e marca'
     else null end
$$;

-- Abre (ou avança) o negócio da pessoa num funil. Devolve o id.
create or replace function crm_negocio_no_funil(p_funil text, p_etapa text, p_titulo text, p_pessoa uuid, p_empresa uuid,
                                                p_tags uuid[], p_origem text, p_acao text, p_acao_em date, p_avancar boolean)
returns uuid language plpgsql security definer set search_path = public as $$
declare
  v_etapa uuid := (select id from crm_etapas where funil_id = p_funil and nome = p_etapa);
  v_neg uuid;
  v_ordem_atual int;
  v_ordem_nova int := (select ordem from crm_etapas where id = v_etapa);
begin
  select n.id, e.ordem into v_neg, v_ordem_atual from crm_negocios n left join crm_etapas e on e.id = n.etapa_id
   where n.funil_id = p_funil and n.ativo and n.pessoa_id = p_pessoa
   order by n.created_at limit 1;
  if v_neg is null then
    insert into crm_negocios (titulo, funil_id, etapa_id, empresa_id, pessoa_id, origem, canal_origem, tags,
                              proxima_acao, proxima_acao_em, ativo)
    values (p_titulo, p_funil, v_etapa, p_empresa, p_pessoa, p_origem, 'site', coalesce(p_tags, '{}'),
            p_acao, p_acao_em, true)
    returning id into v_neg;
  else
    update crm_negocios
       set etapa_id = case when p_avancar and coalesce(v_ordem_atual, 0) < v_ordem_nova then v_etapa else etapa_id end,
           empresa_id = coalesce(empresa_id, p_empresa),
           tags = (select array(select distinct x from unnest(coalesce(tags, '{}') || coalesce(p_tags, '{}')) x)),
           proxima_acao = coalesce(p_acao, proxima_acao),
           proxima_acao_em = coalesce(p_acao_em, proxima_acao_em)
     where id = v_neg;
  end if;
  return v_neg;
end $$;

-- 6. Gatilho: inscrição → CRM ---------------------------------------------------------------------
create or replace function site_inscricao_para_crm() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  v_origem text := 'site_' || new.tipo;
  v_pessoa uuid;
  v_empresa uuid;
  v_neg uuid;
  v_tags uuid[] := crm_tag_perfil(new.perfil);
  v_tag_ind uuid := (select id from crm_tags where nome = 'Indicação');
  v_notas text;
  v_ind jsonb;
  v_ind_nome text;
  v_ind_contato text;
  v_ind_pessoa uuid;
  v_ind_neg uuid;
  v_ind_email text;
  v_ind_wpp text;
  v_ind_ig text;
  v_primeiro text := split_part(trim(new.nome), ' ', 1);
  v_aula jsonb;
begin
  if new.status = 'teste' then return new; end if;

  v_notas := case new.tipo
    when 'lista100' then concat_ws(' · ', 'Lista 100: ' || coalesce(new.dados->>'categoria', ''),
                                   'Caso: ' || nullif(new.dados->>'caso', ''), 'Resultado: ' || nullif(new.dados->>'resultado', ''))
    when 'conselho' then concat_ws(' · ', 'Conselho: ' || nullif(new.dados->>'caso', ''), 'Porte: ' || nullif(new.dados->>'porte', ''))
    when 'projeto' then concat_ws(' · ', 'Projeto: ' || nullif(new.dados->>'problema', ''), 'Prazo: ' || nullif(new.dados->>'prazo', ''),
                                  'Investimento: ' || nullif(new.dados->>'investimento', ''), 'Matéria: ' || nullif(new.dados->>'materia', ''))
    else null end;

  v_pessoa := crm_pessoa_por_contato(new.nome, new.email, new.whatsapp, v_origem, new.consentimento, v_notas);
  if nullif(new.dados->>'instagram', '') is not null then
    update crm_pessoas set instagram = coalesce(instagram, new.dados->>'instagram') where id = v_pessoa;
  end if;
  if nullif(new.dados->>'linkedin', '') is not null then
    update crm_pessoas set linkedin = coalesce(linkedin, new.dados->>'linkedin') where id = v_pessoa;
  end if;
  v_empresa := crm_empresa_por_nome(new.empresa, v_pessoa, new.cargo, v_origem, new.dados->>'setor');

  if new.tipo = 'lista100' then
    perform set_config('crm.sem_tarefa_auto', 'on', true);
    v_neg := crm_negocio_no_funil('lista100', 'Candidato', 'Lista 100 · ' || trim(new.nome), v_pessoa, v_empresa, v_tags,
                                  'lista100', null, null, true);
  elsif new.tipo = 'aula' then
    perform set_config('crm.sem_tarefa_auto', 'on', true);
    v_aula := (select valor from auto_config where chave = 'aula_atual');
    v_neg := crm_negocio_no_funil('aula', 'Inscrito', 'Aula ao vivo nº ' || coalesce(v_aula->>'numero', '1') || ' · ' || trim(new.nome),
                                  v_pessoa, v_empresa, v_tags, 'aula', null, null, false);
  elsif new.tipo = 'conselho' then
    v_neg := crm_negocio_no_funil('conselho', case when new.agendado_em is not null then 'Conversa marcada' else 'Candidato' end,
                                  'Conselho IA News · ' || trim(new.nome), v_pessoa, v_empresa, v_tags, 'conselho',
                                  case when new.agendado_em is not null
                                       then 'Conversa de 15 min às ' || to_char(new.agendado_em at time zone 'America/Sao_Paulo', 'HH24:MI') || ' (WhatsApp ' || coalesce(new.whatsapp, '') || ')'
                                       else 'Marcar a conversa de 15 minutos' end,
                                  coalesce((new.agendado_em at time zone 'America/Sao_Paulo')::date, crm_hoje()), true);
  elsif new.tipo = 'projeto' then
    v_neg := crm_negocio_no_funil('implementacao', 'Lead', 'Balcão de Projetos · ' || coalesce(nullif(trim(new.empresa), ''), trim(new.nome)),
                                  v_pessoa, v_empresa, crm_tag_perfil('empresario'), 'balcao_projetos',
                                  'Responder em até 24 h e marcar a conversa de 20 minutos', crm_hoje(), false);
  end if;

  -- Indicações (candidatos e quem só indica): cada indicado vira negócio na Lista 100, etapa Indicado
  if jsonb_typeof(new.indicados) = 'array' then
    for v_ind in select * from jsonb_array_elements(new.indicados) loop
      v_ind_nome := nullif(trim(coalesce(v_ind->>'nome', '')), '');
      v_ind_contato := nullif(trim(coalesce(v_ind->>'contato', '')), '');
      continue when v_ind_nome is null or v_ind_contato is null;
      v_ind_email := case when v_ind_contato ~ '^[^@\s]+@[^@\s]+\.[^@\s]{2,}$' then lower(v_ind_contato) end;
      v_ind_wpp := case when v_ind_email is null and length(regexp_replace(v_ind_contato, '\D', '', 'g')) between 10 and 13
                        and v_ind_contato !~ '[A-Za-z]' then v_ind_contato end;
      v_ind_ig := case when v_ind_email is null and v_ind_wpp is null
                       then lower(regexp_replace(regexp_replace(v_ind_contato, '^https?://(www\.)?instagram\.com/', '', 'i'), '^@|[/?#].*$', '', 'g')) end;
      v_ind_pessoa := null;
      if v_ind_ig is not null then
        select id into v_ind_pessoa from crm_pessoas where lower(regexp_replace(coalesce(instagram, ''), '^@', '')) = v_ind_ig limit 1;
      end if;
      if v_ind_pessoa is null then
        v_ind_pessoa := crm_pessoa_por_contato(v_ind_nome, v_ind_email, v_ind_wpp, 'indicacao', false,
                          'Indicado para a Lista 100 por ' || trim(new.nome) || coalesce(' (' || nullif(trim(new.empresa), '') || ')', ''));
        if v_ind_ig is not null then
          update crm_pessoas set instagram = coalesce(instagram, '@' || v_ind_ig) where id = v_ind_pessoa;
        end if;
      end if;
      perform set_config('crm.sem_tarefa_auto', 'on', true);
      v_ind_neg := crm_negocio_no_funil('lista100', 'Indicado', 'Lista 100 · ' || v_ind_nome, v_ind_pessoa,
                     crm_empresa_por_nome(v_ind->>'empresa', v_ind_pessoa, null, 'indicacao', null),
                     case when v_tag_ind is null then '{}'::uuid[] else array[v_tag_ind] end, 'indicacao',
                     'Convidar para a Lista 100: indicado por ' || v_primeiro, crm_hoje() + 1, false);
      insert into crm_atividades (tipo, canal, texto, pessoa_id, negocio_id)
      values ('nota', 'site', 'Indicado para a Lista 100 por ' || trim(new.nome) || ' (' || coalesce(new.email, '') || ')', v_ind_pessoa, v_ind_neg);
    end loop;
  end if;

  insert into crm_atividades (tipo, canal, texto, empresa_id, pessoa_id, negocio_id)
  values ('nota', 'site',
          case new.tipo
            when 'lista100' then 'Candidatura à Lista IA News 100 pela página'
            when 'indicacao' then 'Indicou ' || jsonb_array_length(new.indicados) || ' nome(s) para a Lista IA News 100'
            when 'aula' then 'Inscrição na Aula ao vivo pela página'
            when 'conselho' then 'Candidatura ao Conselho IA News' || coalesce(', conversa em ' || to_char(new.agendado_em at time zone 'America/Sao_Paulo', 'DD/MM às HH24:MI'), '')
            when 'projeto' then 'Pedido no Balcão de Projetos' || coalesce(' (veio da matéria ' || nullif(new.dados->>'materia', '') || ')', '')
          end,
          v_empresa, v_pessoa, v_neg);

  new.pessoa_id := v_pessoa;
  new.negocio_id := v_neg;
  return new;
end $$;

drop trigger if exists site_inscricao_para_crm on site_inscricoes;
create trigger site_inscricao_para_crm before insert on site_inscricoes
  for each row execute function site_inscricao_para_crm();

-- 7. Horários livres do Conselho ------------------------------------------------------------------
create or replace function conselho_horarios_livres() returns setof timestamptz
language sql stable security definer set search_path = public as $$
  with cfg as (select valor v from auto_config where chave = 'conselho_agenda'),
  dias as (
    select d::date dia from cfg, generate_series((now() at time zone 'America/Sao_Paulo')::date,
                                                  (now() at time zone 'America/Sao_Paulo')::date + coalesce((v->>'dias_frente')::int, 10), interval '1 day') d
     where extract(isodow from d)::int in (select jsonb_array_elements_text(v->'dias_semana')::int)
  ),
  slots as (
    select (t at time zone 'America/Sao_Paulo') h
      from cfg, dias,
           generate_series(dia + (v->>'inicio')::time,
                           dia + (v->>'fim')::time - make_interval(mins => coalesce((v->>'passo_min')::int, 30)),
                           make_interval(mins => coalesce((v->>'passo_min')::int, 30))) t
  )
  select h from slots, cfg
   where h > now() + make_interval(hours => coalesce((v->>'antecedencia_h')::int, 3))
     and not exists (select 1 from site_inscricoes s where s.tipo = 'conselho' and s.status = 'recebido' and s.agendado_em = slots.h)
   order by h
$$;
revoke all on function conselho_horarios_livres() from public, anon, authenticated;

-- 8. Lembretes da Aula ao vivo (véspera e 1 hora antes) --------------------------------------------
create or replace function aula_lembretes() returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_aula jsonb := (select valor from auto_config where chave = 'aula_atual');
  v_inicio timestamptz := (v_aula->>'inicio')::timestamptz;
  v_tipo text;
  v_assunto text;
  v_n int := 0;
begin
  if v_inicio is null then return jsonb_build_object('ok', false, 'motivo', 'sem aula'); end if;
  if now() between v_inicio - interval '33 hours' and v_inicio - interval '20 hours' then v_tipo := 'vespera';
  elsif now() between v_inicio - interval '90 minutes' and v_inicio - interval '20 minutes' then v_tipo := 'hora';
  else return jsonb_build_object('ok', true, 'lembretes', 0); end if;
  v_assunto := 'Aula ' || to_char(v_inicio at time zone 'America/Sao_Paulo', 'YYYY-MM-DD') || ' · ' || v_tipo;

  insert into auto_fila (canal, passo, negocio_id, empresa_id, pessoa_id, destino, assunto, mensagem, automatico, motivo)
  select 'whatsapp', 'lembrete', n.id, n.empresa_id, p.id, p.whatsapp, v_assunto,
         case v_tipo
           when 'vespera' then 'Oi, ' || split_part(p.nome, ' ', 1) || '! Aqui é a Renata, da IA News. Amanhã, às '
                || to_char(v_inicio at time zone 'America/Sao_Paulo', 'HH24"h"') || ', é a nossa Aula ao vivo: "' || (v_aula->>'titulo')
                || '". São 60 minutos com casos reais. O link chega por aqui 1 hora antes. Te espero lá!'
           else 'Começamos em 1 hora, ' || split_part(p.nome, ' ', 1) || '! '
                || coalesce('O link da Aula ao vivo: ' || nullif(v_aula->>'link', ''), 'Te mando o link em instantes.')
         end,
         true, 'Lembrete da Aula ao vivo (' || v_tipo || ')'
    from crm_negocios n join crm_pessoas p on p.id = n.pessoa_id
    join crm_etapas e on e.id = n.etapa_id
   where n.funil_id = 'aula' and n.ativo and e.nome = 'Inscrito' and nullif(p.whatsapp, '') is not null
     and not exists (select 1 from auto_fila f where f.negocio_id = n.id and f.passo = 'lembrete' and f.assunto = v_assunto);
  get diagnostics v_n = row_count;
  return jsonb_build_object('ok', true, 'tipo', v_tipo, 'lembretes', v_n);
end $$;

do $$ begin
  perform cron.unschedule('ianews-aula-lembretes') where exists (select 1 from cron.job where jobname = 'ianews-aula-lembretes');
  perform cron.schedule('ianews-aula-lembretes', '*/20 * * * *', 'select aula_lembretes()');
end $$;
