-- Lista de espera da FGIA Educação (eventos da IA News).
-- O formulário de ianewsbr.com/eventos grava aqui; um gatilho leva cada inscrição ao CRM:
-- pessoa (e empresa, se informada) + negócio no funil "Evento IANews", etapa "Na lista",
-- etiqueta "FGIA · Lista de espera" e uma atividade com os interesses.

create table if not exists public.evento_lista_espera (
  id uuid primary key default gen_random_uuid(),
  evento text not null default 'fgia-2026-12-17',
  nome text not null,
  email text not null,
  whatsapp text not null,
  empresa text,
  cargo text,
  instagram text,
  interesses text[] not null default '{}',
  consentimento boolean not null default false,
  newsletter boolean not null default false,
  origem_path text,
  utm_source text,
  utm_medium text,
  utm_campaign text,
  device text,
  ip_hash text,
  created_at timestamptz not null default now()
);

create index if not exists evento_lista_espera_created_idx on public.evento_lista_espera (created_at desc);
create index if not exists evento_lista_espera_email_idx on public.evento_lista_espera (lower(email));
create index if not exists evento_lista_espera_ip_idx on public.evento_lista_espera (ip_hash, created_at desc);

-- Só o servidor do site (service role) lê e grava. Sem políticas públicas.
alter table public.evento_lista_espera enable row level security;

insert into public.crm_tags (nome, cor, descricao, ordem)
select 'FGIA · Lista de espera', 'amarelo',
       'Entrou na lista de espera dos eventos da FGIA Educação (site, comentário ou direct).', 150
where not exists (select 1 from public.crm_tags where nome = 'FGIA · Lista de espera');

create or replace function public.crm_ingerir_lista_espera(l public.evento_lista_espera)
returns uuid
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_emp uuid; v_pes uuid; v_neg uuid; v_etapa uuid; v_tag uuid; v_txt text;
begin
  v_emp := crm_achar_ou_criar_empresa(l.empresa, null, null, null, 'fgia');
  v_pes := crm_achar_ou_criar_pessoa(l.nome, l.email, l.whatsapp, l.instagram, null, 'fgia', l.consentimento);
  perform crm_ligar_pessoa_empresa(v_emp, v_pes, l.cargo);

  select id into v_etapa from crm_etapas where funil_id = 'evento' and nome = 'Na lista';
  select id into v_tag from crm_tags where nome = 'FGIA · Lista de espera';

  select n.id into v_neg
    from crm_negocios n join crm_etapas e on e.id = n.etapa_id
   where n.pessoa_id = v_pes and n.funil_id = 'evento' and n.ativo and e.tipo = 'aberta'
   order by n.created_at desc limit 1;

  v_txt := 'Entrou na lista de espera da FGIA pelo site'
        || case when cardinality(l.interesses) > 0 then ' · interesse: ' || array_to_string(l.interesses, ', ') else '' end
        || coalesce(' · ' || nullif(l.cargo, ''), '')
        || coalesce(' · ' || nullif(l.empresa, ''), '')
        || case when l.newsletter then ' · pediu a newsletter' else '' end
        || '.';

  if v_neg is null then
    perform set_config('crm.sem_tarefa_auto', 'on', true);
    insert into crm_negocios (titulo, funil_id, etapa_id, empresa_id, pessoa_id, origem, canal_origem, tags)
    values ('Lista de espera FGIA · ' || coalesce(nullif(l.empresa, ''), l.nome), 'evento', v_etapa, v_emp, v_pes,
            'fgia-lista-espera', 'site', case when v_tag is null then '{}'::uuid[] else array[v_tag] end)
    returning id into v_neg;
    perform set_config('crm.sem_tarefa_auto', 'off', true);
  else
    update crm_negocios n set
      etapa_id = case when (select e.ordem from crm_etapas e where e.id = n.etapa_id)
                           < (select e2.ordem from crm_etapas e2 where e2.id = v_etapa)
                      then v_etapa else n.etapa_id end,
      tags = case when v_tag is null or v_tag = any(n.tags) then n.tags else n.tags || v_tag end
    where n.id = v_neg;
  end if;

  insert into crm_atividades (tipo, canal, texto, empresa_id, pessoa_id, negocio_id, autor_id)
  values ('mensagem_recebida', 'site', v_txt, v_emp, v_pes, v_neg, null);
  return v_neg;
end $$;

create or replace function public.crm_lista_espera_entrada()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $$
begin
  begin
    perform crm_ingerir_lista_espera(new);
  exception when others then
    raise warning '[crm] evento_lista_espera % não entrou no CRM: %', new.id, sqlerrm;
  end;
  return null;
end $$;

drop trigger if exists crm_lista_espera_entrada on public.evento_lista_espera;
create trigger crm_lista_espera_entrada
  after insert on public.evento_lista_espera
  for each row execute function public.crm_lista_espera_entrada();

revoke all on function public.crm_ingerir_lista_espera(public.evento_lista_espera) from public, anon, authenticated;
