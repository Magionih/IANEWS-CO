-- Produção que anda sozinha: o negócio do funil Matéria acompanha a matéria no site.
-- 1) Matéria agendada no site → etiqueta "Status · Agendada" (com data e hora em agendado_para)
-- 2) Matéria no ar → etapa "Publicado" (dispara as tarefas de pós-venda que já existem)
-- 3) Material recebido / prévia enviada / prévia aprovada (páginas de briefing e prévia) → etiqueta de status
-- 4) Pagamento confirmado num negócio ainda aberto → etapa ganha do funil (Fechado)

alter table public.crm_negocios add column if not exists materia_id uuid references public.articles(id) on delete set null;
alter table public.crm_negocios add column if not exists agendado_para timestamptz;
create index if not exists crm_negocios_materia_idx on public.crm_negocios(materia_id);

create or replace function public.crm_avancar_producao()
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  e_pub   uuid := (select id from crm_etapas where funil_id = 'materia' and nome = 'Publicado');
  e_fech  uuid := (select id from crm_etapas where funil_id = 'materia' and nome = 'Fechado');
  t_prod  uuid := (select id from crm_tags where nome = 'Status · Produzir matéria');
  t_fotos uuid := (select id from crm_tags where nome = 'Status · Faltam fotos');
  t_valid uuid := (select id from crm_tags where nome = 'Status · Em validação');
  t_aprov uuid := (select id from crm_tags where nome = 'Status · Aprovado, agendar');
  t_agend uuid := (select id from crm_tags where nome = 'Status · Agendada');
  st uuid[];
  r record;
  v_alvo uuid;
  n_pub int := 0; n_agend int := 0; n_status int := 0; n_erros int := 0;
begin
  st := array_remove(array[t_prod, t_fotos, t_valid, t_aprov, t_agend], null);

  -- 1 e 2: a matéria do negócio no site (pela ligação, pela menção de protagonista ou pelo nome no título).
  for r in
    select n.id, n.tags, n.titulo, n.materia_id, n.agendado_para, a.id as art, a.published_at, a.slug,
           coalesce(p.nome, emp.nome, n.titulo) as quem
      from crm_negocios n
      join crm_etapas e on e.id = n.etapa_id
      left join crm_pessoas p on p.id = n.pessoa_id
      left join crm_empresas emp on emp.id = n.empresa_id
      join lateral (
        select a.id, a.published_at, a.slug
          from articles a
         where a.status = 'published'
           and a.published_at >= n.created_at - interval '2 days'
           and a.published_at <= now() + interval '60 days'
           and (a.id = n.materia_id
             or a.id = n.article_id
             or exists (select 1 from crm_mencoes m
                         where m.article_id = a.id and m.ativo and m.papel = 'protagonista'
                           and ((n.pessoa_id is not null and m.pessoa_id = n.pessoa_id)
                             or (n.empresa_id is not null and m.empresa_id = n.empresa_id)))
             or (p.nome is not null and length(p.nome) >= 8 and p.nome ~ '\S\s+\S'
                 and a.title ilike '%' || p.nome || '%'))
         order by (a.published_at <= now()) desc, a.published_at desc
         limit 1
      ) a on true
     where n.ativo and n.funil_id = 'materia'
       and e.tipo <> 'perdida' and e.nome <> 'Publicado'
       and (e.nome in ('Briefing', 'Aprovado', 'Fechado') or n.tags && st)
  loop
    begin
      if r.published_at <= now() then
        update crm_negocios
           set etapa_id = e_pub,
               materia_id = r.art,
               agendado_para = r.published_at,
               publicado_em = coalesce(publicado_em, r.published_at),
               tags = array(select x from unnest(coalesce(tags, '{}')) x where not (x = any(st)))
         where id = r.id;
        -- Prazos do pós-venda contados da data em que a matéria saiu.
        update crm_tarefas set vence_em = greatest(crm_hoje(), (r.published_at at time zone 'America/Sao_Paulo')::date + 7)
         where chave = 'selo7:' || r.id and not feita and not cancelada;
        update crm_tarefas set vence_em = greatest(crm_hoje(), (r.published_at at time zone 'America/Sao_Paulo')::date + 30)
         where chave = 'posvenda:' || r.id and not feita and not cancelada;
        if to_regprocedure('public.crm_notificar(text,text,text,text,text,uuid,boolean,text,jsonb)') is not null then
          perform crm_notificar('publicada', 'No ar: matéria de ' || r.quem,
            'Envie o link para o cliente e peça o collab no Instagram.',
            '/operacao', 'equipe', null, false, 'publicada:' || r.id, jsonb_build_object('negocio_id', r.id, 'slug', r.slug));
        end if;
        n_pub := n_pub + 1;
      elsif t_agend is not null
        and (not (coalesce(r.tags, '{}') @> array[t_agend])
             or r.materia_id is distinct from r.art
             or r.agendado_para is distinct from r.published_at) then
        update crm_negocios
           set materia_id = r.art,
               agendado_para = r.published_at,
               tags = array(select x from unnest(coalesce(tags, '{}')) x where not (x = any(st))) || t_agend
         where id = r.id;
        n_agend := n_agend + 1;
      end if;
    exception when others then
      n_erros := n_erros + 1;
      raise warning 'crm_avancar_producao (matéria) %: %', r.id, sqlerrm;
    end;
  end loop;

  -- 3: o que o cliente fez nas páginas de briefing e prévia.
  for r in
    select n.id, n.tags, n.tipo, n.valor, e.nome as etapa, e.tipo as etapa_tipo,
           b.enviado_em, b.previa_url, b.aprovado_em,
           coalesce(p.nome, emp.nome, n.titulo) as quem
      from crm_negocios n
      join crm_etapas e on e.id = n.etapa_id
      join auto_briefings b on b.negocio_id = n.id
      left join crm_pessoas p on p.id = n.pessoa_id
      left join crm_empresas emp on emp.id = n.empresa_id
     where n.ativo and n.funil_id = 'materia'
       and e.tipo <> 'perdida' and e.nome <> 'Publicado'
       and not (coalesce(n.tags, '{}') && array_remove(array[t_agend], null))
       and (b.enviado_em is not null or b.previa_url is not null or b.aprovado_em is not null)
  loop
    v_alvo := case
      when r.aprovado_em is not null then t_aprov
      when r.previa_url is not null then t_valid
      when r.enviado_em is not null then t_prod
    end;
    continue when v_alvo is null or coalesce(r.tags, '{}') @> array[v_alvo];
    begin
      update crm_negocios
         set tags = array(select x from unnest(coalesce(tags, '{}')) x where not (x = any(st))) || v_alvo,
             -- Material recebido: o negócio entra em produção (Fechado), se o valor permitir.
             etapa_id = case
               when r.etapa_tipo = 'aberta' and e_fech is not null
                and (coalesce(r.tipo, '') not in ('destaque_pago', 'publicidade') or coalesce(r.valor, 0) > 0)
               then e_fech else etapa_id end
       where id = r.id;
      if to_regprocedure('public.crm_notificar(text,text,text,text,text,uuid,boolean,text,jsonb)') is not null then
        perform crm_notificar(
          case when v_alvo = t_aprov then 'previa' else 'material' end,
          case when v_alvo = t_aprov then 'Prévia aprovada: ' || r.quem
               when v_alvo = t_valid then 'Prévia enviada: ' || r.quem
               else 'Material recebido: ' || r.quem end,
          case when v_alvo = t_aprov then 'Agende a matéria no calendário.'
               when v_alvo = t_valid then 'Aguardando a aprovação do cliente.'
               else 'Pode produzir a matéria.' end,
          '/operacao', 'equipe', null, false, 'status:' || r.id || ':' || v_alvo, jsonb_build_object('negocio_id', r.id));
      end if;
      n_status := n_status + 1;
    exception when others then
      n_erros := n_erros + 1;
      raise warning 'crm_avancar_producao (briefing) %: %', r.id, sqlerrm;
    end;
  end loop;

  return jsonb_build_object('ok', true, 'publicados', n_pub, 'agendados', n_agend, 'status', n_status, 'erros', n_erros);
end $$;

revoke all on function public.crm_avancar_producao() from public, anon, authenticated;

-- 4: pagamento confirmado leva o negócio para a etapa ganha (Fechado) do funil.
create or replace function public.crm_pago_avanca()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $$
declare e crm_etapas; f crm_etapas;
begin
  if new.status_pagamento = 'pago' and old.status_pagamento is distinct from 'pago'
     and new.etapa_id is not distinct from old.etapa_id
     and new.funil_id in ('materia', 'publicidade', 'implementacao') then
    select * into e from crm_etapas where id = new.etapa_id;
    if e.tipo = 'aberta' then
      select * into f from crm_etapas
       where funil_id = new.funil_id and tipo = 'ganha' and ativo
       order by ordem limit 1;
      if f.id is not null then
        if coalesce(new.valor, 0) <= 0 and coalesce(new.valor_proposto, 0) > 0 then
          new.valor := new.valor_proposto;
        end if;
        if coalesce(new.valor, 0) > 0 or coalesce(new.tipo, '') not in ('destaque_pago', 'publicidade') then
          new.etapa_id := f.id;
        end if;
      end if;
    end if;
  end if;
  return new;
end $$;

revoke all on function public.crm_pago_avanca() from public, anon, authenticated;

-- O nome começa com "crm_negocios_0" para rodar antes de crm_negocios_antes (ordem alfabética):
-- assim a troca de etapa já registra data, tarefa e histórico normalmente.
create or replace trigger crm_negocios_0_pago
  before update of status_pagamento on public.crm_negocios
  for each row execute function public.crm_pago_avanca();

-- Roda a cada 10 minutos (matéria que entra no ar sai da fila de produção sozinha).
select cron.schedule('ianews-crm-producao', '*/10 * * * *', 'select public.crm_avancar_producao()');
