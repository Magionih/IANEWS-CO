-- Notificações do CRM no celular (web push no app instalado) e central de avisos.
-- O banco cria o aviso; o site (que já tem as chaves VAPID) entrega a cada minuto.
-- Vendas chegam a qualquer hora; os demais avisos só das 7h às 22h (horário de Brasília).

-- Aparelhos inscritos (cada pessoa da equipe só vê e mexe nos seus).
create table if not exists public.crm_push_inscricoes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  -- Só serviços de push dos navegadores (o servidor do site faz POST nesses endereços).
  endpoint text not null unique check (
    length(endpoint) <= 1000
    and endpoint ~ '^https://(fcm\.googleapis\.com|android\.googleapis\.com|web\.push\.apple\.com|[a-z0-9.-]+\.push\.apple\.com|[a-z0-9.-]+\.push\.services\.mozilla\.com|[a-z0-9.-]+\.notify\.windows\.com)/'
  ),
  p256dh text not null check (length(p256dh) between 20 and 200),
  auth text not null check (length(auth) between 8 and 100),
  aparelho text check (aparelho is null or length(aparelho) <= 120),
  ativo boolean not null default true,
  falhas integer not null default 0,
  criado_em timestamptz not null default now(),
  ultimo_envio_em timestamptz
);
create index if not exists crm_push_inscricoes_user_idx on public.crm_push_inscricoes(user_id) where ativo;
alter table public.crm_push_inscricoes enable row level security;
create policy crm_push_ler on public.crm_push_inscricoes for select to authenticated
  using (user_id = (select auth.uid()) and (select crm_tem_acesso()));
create policy crm_push_inserir on public.crm_push_inscricoes for insert to authenticated
  with check (user_id = (select auth.uid()) and (select crm_tem_acesso()));
create policy crm_push_editar on public.crm_push_inscricoes for update to authenticated
  using (user_id = (select auth.uid()) and (select crm_tem_acesso()))
  with check (user_id = (select auth.uid()));
create policy crm_push_apagar on public.crm_push_inscricoes for delete to authenticated
  using (user_id = (select auth.uid()));

-- Avisos (também aparecem no sino do CRM).
create table if not exists public.crm_notificacoes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade,
  publico text not null default 'admin' check (publico in ('admin', 'equipe', 'usuario')),
  tipo text not null check (length(tipo) <= 40),
  titulo text not null check (length(titulo) <= 140),
  corpo text not null default '' check (length(corpo) <= 400),
  url text not null default '/' check (url ~ '^/' and length(url) <= 300),
  urgente boolean not null default false,
  dados jsonb not null default '{}',
  chave text unique,
  criado_em timestamptz not null default now(),
  enviado_em timestamptz,
  entregues integer,
  lido_em timestamptz
);
create index if not exists crm_notificacoes_criado_idx on public.crm_notificacoes(criado_em desc);
create index if not exists crm_notificacoes_pendentes_idx on public.crm_notificacoes(criado_em) where enviado_em is null;
alter table public.crm_notificacoes enable row level security;
create policy crm_notif_ler on public.crm_notificacoes for select to authenticated
  using ((select crm_tem_acesso()) and (
    user_id = (select auth.uid())
    or (user_id is null and (publico = 'equipe' or (publico = 'admin' and (select crm_e_admin()))))));
create policy crm_notif_marcar on public.crm_notificacoes for update to authenticated
  using ((select crm_tem_acesso()) and (
    user_id = (select auth.uid())
    or (user_id is null and (publico = 'equipe' or (publico = 'admin' and (select crm_e_admin()))))))
  with check ((select crm_tem_acesso()));
-- A equipe só marca como lido; criar e entregar é com o banco e o servidor.
revoke insert, update, delete on public.crm_notificacoes from anon, authenticated;
grant select on public.crm_notificacoes to authenticated;
grant update (lido_em) on public.crm_notificacoes to authenticated;

-- Configuração pública que o CRM precisa ler (chave pública VAPID, gravada pelo site).
create table if not exists public.crm_config_publica (
  chave text primary key check (length(chave) <= 60),
  valor text not null check (length(valor) <= 2000),
  atualizado_em timestamptz not null default now()
);
alter table public.crm_config_publica enable row level security;
create policy crm_config_publica_ler on public.crm_config_publica for select to authenticated
  using ((select crm_tem_acesso()));
revoke insert, update, delete on public.crm_config_publica from anon, authenticated;

-- Cria um aviso (sem duplicar pela chave).
create or replace function public.crm_notificar(
  p_tipo text, p_titulo text, p_corpo text default '', p_url text default '/',
  p_publico text default 'admin', p_user uuid default null, p_urgente boolean default false,
  p_chave text default null, p_dados jsonb default '{}')
returns uuid
language plpgsql
security definer
set search_path to 'public'
as $$
declare v_id uuid;
begin
  insert into crm_notificacoes (tipo, titulo, corpo, url, publico, user_id, urgente, chave, dados)
  values (left(p_tipo, 40), left(p_titulo, 140), left(coalesce(p_corpo, ''), 400),
          case when coalesce(p_url, '') ~ '^/' then left(p_url, 300) else '/' end,
          coalesce(p_publico, 'admin'), p_user, coalesce(p_urgente, false), p_chave, coalesce(p_dados, '{}'))
  on conflict (chave) do nothing
  returning id into v_id;
  return v_id;
end $$;
revoke all on function public.crm_notificar(text, text, text, text, text, uuid, boolean, text, jsonb) from public, anon, authenticated;

-- O site pega os avisos prontos para entregar (marca como enviados na mesma operação, sem duplicar).
create or replace function public.crm_reivindicar_notificacoes(p_limite integer default 30)
returns setof public.crm_notificacoes
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_hora integer := extract(hour from now() at time zone 'America/Sao_Paulo');
  v_silencio boolean := v_hora < 7 or v_hora >= 22;
begin
  return query
  with prontos as (
    select n.id from crm_notificacoes n
     where n.enviado_em is null
       and n.criado_em > now() - interval '12 hours'
       and (n.urgente or not v_silencio)
     order by n.criado_em
     limit greatest(1, least(p_limite, 100))
     for update skip locked
  )
  update crm_notificacoes n set enviado_em = now()
    from prontos where n.id = prontos.id
  returning n.*;
end $$;
revoke all on function public.crm_reivindicar_notificacoes(integer) from public, anon, authenticated;

-- A cada minuto: se houver aviso para entregar, chama o site (que envia o push).
create or replace function public.crm_entregar_notificacoes()
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_hora integer := extract(hour from now() at time zone 'America/Sao_Paulo');
  v_silencio boolean := v_hora < 7 or v_hora >= 22;
  v_pend integer;
begin
  select count(*) into v_pend from crm_notificacoes n
   where n.enviado_em is null and n.criado_em > now() - interval '12 hours'
     and (n.urgente or not v_silencio);
  if v_pend = 0 or not exists (select 1 from crm_push_inscricoes where ativo) then
    -- Sem aparelho inscrito: os avisos ficam só no sino do CRM.
    if v_pend > 0 then
      update crm_notificacoes set enviado_em = now(), entregues = 0
       where enviado_em is null and criado_em > now() - interval '12 hours' and (urgente or not v_silencio);
    end if;
    return jsonb_build_object('ok', true, 'pendentes', v_pend, 'chamou', false);
  end if;
  perform call_site_hook('/api/public/hooks/crm-notificar', '{}'::jsonb);
  return jsonb_build_object('ok', true, 'pendentes', v_pend, 'chamou', true);
end $$;
revoke all on function public.crm_entregar_notificacoes() from public, anon, authenticated;

-- ---------- Avisos por evento ----------

-- Venda: pagamento confirmado (a qualquer hora) e negócio fechado.
create or replace function public.crm_notif_negocio()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_quem text;
  v_valor numeric := coalesce(new.valor, new.valor_proposto, 0);
  v_etapa crm_etapas;
  v_brl text;
begin
  select coalesce(p.nome, e.nome, new.titulo) into v_quem
    from (select 1) x
    left join crm_pessoas p on p.id = new.pessoa_id
    left join crm_empresas e on e.id = new.empresa_id;
  v_brl := 'R$ ' || to_char(round(v_valor), 'FM999G999G999');
  v_brl := replace(v_brl, ',', '.');

  if new.status_pagamento = 'pago' and old.status_pagamento is distinct from 'pago' then
    perform crm_notificar('venda',
      'Venda confirmada · ' || case when v_valor > 0 then v_brl else coalesce(v_quem, 'cliente') end,
      coalesce(v_quem, new.titulo) || coalesce(' · ' || nullif(new.forma_pagamento, ''), '') || '. Hora de pedir o material e produzir.',
      '/financeiro', 'admin', null, true, 'venda:' || new.id,
      jsonb_build_object('negocio_id', new.id, 'valor', v_valor));
  elsif new.etapa_id is distinct from old.etapa_id then
    select * into v_etapa from crm_etapas where id = new.etapa_id;
    if v_etapa.tipo = 'ganha' and v_etapa.nome = 'Fechado' and new.status_pagamento <> 'pago'
       and new.status_pagamento <> 'cortesia' and v_valor > 0 then
      perform crm_notificar('fechado',
        'Negócio fechado · ' || v_brl,
        coalesce(v_quem, new.titulo) || '. Envie o link de pagamento hoje.',
        '/financeiro', 'admin', null, false, 'fechado:' || new.id,
        jsonb_build_object('negocio_id', new.id, 'valor', v_valor));
    end if;
  end if;
  return null;
end $$;
revoke all on function public.crm_notif_negocio() from public, anon, authenticated;

create or replace trigger crm_notif_negocio
  after update of status_pagamento, etapa_id on public.crm_negocios
  for each row execute function public.crm_notif_negocio();

-- Pauta enviada pelo site.
create or replace function public.crm_notif_pauta()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $$
begin
  perform crm_notificar('pauta',
    'Nova pauta: ' || coalesce(nullif(trim(new.empresa), ''), trim(new.nome)),
    trim(new.nome) || coalesce(' · ' || nullif(trim(new.cargo), ''), '') || '. Responda em até 2 dias úteis.',
    '/pautas', 'equipe', null, false, 'pauta:' || new.id, jsonb_build_object('pauta_id', new.id));
  return null;
end $$;
revoke all on function public.crm_notif_pauta() from public, anon, authenticated;
create or replace trigger crm_notif_pauta
  after insert on public.pauta_leads
  for each row execute function public.crm_notif_pauta();

-- Pedido de mídia kit, contato de empresas e demais formulários do site.
create or replace function public.crm_notif_contato()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $$
declare v_titulo text;
begin
  v_titulo := case
    when new.kind ilike '%anunc%' or new.kind ilike '%midia%' or new.kind ilike '%kit%' then 'Pedido de mídia kit: '
    when new.kind ilike '%empresa%' or new.kind ilike '%solu%' then 'Empresa quer IA na operação: '
    else 'Novo contato pelo site: ' end;
  perform crm_notificar('contato',
    v_titulo || coalesce(nullif(trim(new.company), ''), trim(new.full_name)),
    trim(new.full_name) || coalesce(' · ' || nullif(trim(new.budget), ''), '') || '. Responda hoje.',
    '/negocios', 'equipe', null, false, 'contato:' || new.id, jsonb_build_object('contato_id', new.id, 'tipo', new.kind));
  return null;
end $$;
revoke all on function public.crm_notif_contato() from public, anon, authenticated;
create or replace trigger crm_notif_contato
  after insert on public.contact_messages
  for each row execute function public.crm_notif_contato();

-- Ingresso do Palco pago.
create or replace function public.crm_notif_palco()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $$
begin
  if new.status = 'pago' and old.status is distinct from 'pago' then
    perform crm_notificar('venda',
      'Ingresso vendido · Palco IA News',
      trim(new.nome) || coalesce(' · ' || nullif(trim(new.empresa), ''), '')
        || coalesce(' · R$ ' || to_char(round(new.pagamento_valor), 'FM999G999'), ''),
      '/negocios', 'admin', null, true, 'palco:' || new.id, jsonb_build_object('inscricao_id', new.id));
  end if;
  return null;
end $$;
revoke all on function public.crm_notif_palco() from public, anon, authenticated;
create or replace trigger crm_notif_palco
  after update of status on public.palco_inscricoes
  for each row execute function public.crm_notif_palco();

-- ---------- Resumos estratégicos do dia (8h, 12h30 e 18h30) ----------

create or replace function public.crm_resumo_push(p_momento text)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_hoje date := crm_hoje();
  v_ini timestamptz := (v_hoje::timestamp at time zone 'America/Sao_Paulo');
  v_fim timestamptz := ((v_hoje + 1)::timestamp at time zone 'America/Sao_Paulo');
  v_cobrar_qtd integer; v_cobrar_val numeric;
  v_produzir integer; v_retomar integer;
  v_pub_hoje integer; v_pub_horas text;
  v_tarefas integer; v_atrasadas integer;
  v_vendido_hoje numeric; v_vendas_hoje integer; v_vendido_mes numeric;
  v_respostas integer;
  v_pub_amanha integer;
  v_titulo text; v_corpo text;
  brl text;
begin
  select count(*), coalesce(sum(coalesce(n.valor, n.valor_proposto, 0)), 0)
    into v_cobrar_qtd, v_cobrar_val
    from crm_negocios n join crm_etapas e on e.id = n.etapa_id
   where n.ativo and e.tipo = 'ganha' and n.status_pagamento = 'pendente'
     and coalesce(n.valor, n.valor_proposto, 0) > 0;

  select count(*) into v_produzir
    from crm_negocios n join crm_etapas e on e.id = n.etapa_id
   where n.ativo and n.funil_id = 'materia' and e.nome in ('Briefing', 'Aprovado', 'Fechado');

  select count(*) into v_retomar
    from crm_negocios n join crm_etapas e on e.id = n.etapa_id
   where n.ativo and e.tipo = 'aberta' and n.respondeu_em is not null
     and e.nome not in ('Remarketing', 'Sem resposta')
     and coalesce(n.etapa_desde, n.updated_at) < now() - interval '3 days';

  select count(*), string_agg(to_char(a.published_at at time zone 'America/Sao_Paulo', 'HH24"h"MI'), ', ' order by a.published_at)
    into v_pub_hoje, v_pub_horas
    from articles a where a.status = 'published' and a.published_at >= v_ini and a.published_at < v_fim;

  select count(*) filter (where t.vence_em <= v_hoje), count(*) filter (where t.vence_em < v_hoje)
    into v_tarefas, v_atrasadas
    from crm_tarefas t where not t.feita and not t.cancelada and t.vence_em is not null;

  select coalesce(sum(coalesce(n.valor, 0)), 0), count(*) into v_vendido_hoje, v_vendas_hoje
    from crm_negocios n where n.status_pagamento = 'pago' and n.pago_em >= v_ini and n.pago_em < v_fim;

  select coalesce(sum(coalesce(n.valor, 0)), 0) into v_vendido_mes
    from crm_negocios n where n.status_pagamento = 'pago'
     and n.pago_em >= (date_trunc('month', v_hoje)::timestamp at time zone 'America/Sao_Paulo');

  select count(*) into v_respostas from crm_atividades a
   where a.tipo = 'mensagem_recebida' and a.created_at >= v_ini;

  select count(*) into v_pub_amanha from articles a
   where a.status = 'published' and a.published_at >= v_fim and a.published_at < v_fim + interval '1 day';

  brl := 'R$ ' || replace(to_char(round(v_cobrar_val), 'FM999G999G999'), ',', '.');

  if p_momento = 'manha' then
    v_titulo := case when v_cobrar_qtd > 0 then 'Bom dia! Hoje: ' || brl || ' para cobrar'
                     when v_produzir > 0 then 'Bom dia! ' || v_produzir || ' matérias na produção'
                     else 'Bom dia! O plano de hoje no CRM' end;
    v_corpo := concat_ws(' · ',
      case when v_cobrar_qtd > 0 then 'Cobrar ' || v_cobrar_qtd end,
      case when v_produzir > 0 then 'Produzir ' || v_produzir end,
      case when v_retomar > 0 then 'Retomar ' || v_retomar end,
      case when v_pub_hoje > 0 then v_pub_hoje || ' publicação' || case when v_pub_hoje > 1 then 'ões' else '' end || ' (' || v_pub_horas || ')' end,
      case when v_tarefas > 0 then v_tarefas || ' tarefa' || case when v_tarefas > 1 then 's' else '' end
           || case when v_atrasadas > 0 then ' (' || v_atrasadas || ' atrasada' || case when v_atrasadas > 1 then 's' else '' end || ')' else '' end end);
  elsif p_momento = 'tarde' then
    v_titulo := case when v_vendas_hoje > 0
                     then 'Meio do dia: ' || replace('R$ ' || to_char(round(v_vendido_hoje), 'FM999G999G999'), ',', '.') || ' vendidos hoje'
                     else 'Meio do dia: o que falta fechar' end;
    v_corpo := concat_ws(' · ',
      case when v_respostas > 0 then v_respostas || ' resposta' || case when v_respostas > 1 then 's' else '' end || ' de leads hoje' end,
      case when v_cobrar_qtd > 0 then v_cobrar_qtd || ' cobrança' || case when v_cobrar_qtd > 1 then 's' else '' end || ' abertas (' || brl || ')' end,
      case when v_tarefas > 0 then v_tarefas || ' tarefa' || case when v_tarefas > 1 then 's' else '' end || ' para hoje' end,
      case when v_retomar > 0 then v_retomar || ' negócio' || case when v_retomar > 1 then 's' else '' end || ' esfriando' end);
  else
    v_titulo := 'Fechamento: ' || replace('R$ ' || to_char(round(v_vendido_mes), 'FM999G999G999'), ',', '.') || ' vendidos no mês';
    v_corpo := concat_ws(' · ',
      case when v_vendas_hoje > 0 then v_vendas_hoje || ' venda' || case when v_vendas_hoje > 1 then 's' else '' end || ' hoje' end,
      case when v_pub_amanha > 0 then v_pub_amanha || ' publicaç' || case when v_pub_amanha > 1 then 'ões' else 'ão' end || ' amanhã' end,
      case when v_cobrar_qtd > 0 then 'cobrar ' || brl || ' amanhã cedo' end,
      case when v_atrasadas > 0 then v_atrasadas || ' tarefa' || case when v_atrasadas > 1 then 's' else '' end || ' atrasada' || case when v_atrasadas > 1 then 's' else '' end end);
  end if;

  if coalesce(v_corpo, '') = '' then
    v_corpo := 'Tudo em dia. Abra o CRM para ver os números.';
  end if;

  perform crm_notificar('resumo', v_titulo, v_corpo, '/', 'admin', null, false,
    'resumo:' || p_momento || ':' || v_hoje, '{}'::jsonb);
  return jsonb_build_object('ok', true, 'titulo', v_titulo, 'corpo', v_corpo);
end $$;
revoke all on function public.crm_resumo_push(text) from public, anon, authenticated;

-- Limpeza: avisos com mais de 60 dias.
create or replace function public.crm_limpar_notificacoes()
returns void language sql security definer set search_path to 'public' as $$
  delete from crm_notificacoes where criado_em < now() - interval '60 days';
$$;
revoke all on function public.crm_limpar_notificacoes() from public, anon, authenticated;

-- Agenda (horários em UTC; Brasília = UTC-3).
select cron.schedule('ianews-crm-notificar', '* * * * *', 'select public.crm_entregar_notificacoes()');
select cron.schedule('ianews-crm-resumo-manha', '0 11 * * *', $$select public.crm_resumo_push('manha')$$);
select cron.schedule('ianews-crm-resumo-tarde', '30 15 * * *', $$select public.crm_resumo_push('tarde')$$);
select cron.schedule('ianews-crm-resumo-noite', '30 21 * * *', $$select public.crm_resumo_push('noite')$$);
select cron.schedule('ianews-crm-limpar-avisos', '15 6 * * *', 'select public.crm_limpar_notificacoes()');

-- Teste pelo CRM (Configuração › Notificações): um aviso só para quem pediu, entregue na hora.
create or replace function public.crm_notificacao_teste()
returns uuid
language plpgsql
security definer
set search_path to 'public'
as $$
declare v uuid;
begin
  if not crm_tem_acesso() then
    raise exception 'Sem permissão.';
  end if;
  if exists (select 1 from crm_notificacoes where tipo = 'teste' and user_id = auth.uid()
              and criado_em > now() - interval '30 seconds') then
    raise exception 'Aguarde alguns segundos para testar de novo.';
  end if;
  v := crm_notificar('teste', 'Notificações do CRM ativadas',
    'É assim que as vendas e os pontos importantes do dia vão chegar no seu celular.',
    '/', 'usuario', auth.uid(), true, null, '{}'::jsonb);
  perform call_site_hook('/api/public/hooks/crm-notificar', '{}'::jsonb);
  return v;
end $$;
revoke all on function public.crm_notificacao_teste() from public, anon;
grant execute on function public.crm_notificacao_teste() to authenticated;
