-- Esteira de produção do destaque: briefing enviado → rascunho pela IA → prévia por link →
-- aprovação → agendamento no calendário (site + tarefa de Instagram) → publicado → links ao lead.

create table if not exists public.auto_producoes (
  id uuid primary key default gen_random_uuid(),
  briefing_id uuid not null unique references public.auto_briefings(id) on delete cascade,
  negocio_id uuid references public.crm_negocios(id) on delete set null,
  empresa_id uuid references public.crm_empresas(id) on delete set null,
  pessoa_id uuid references public.crm_pessoas(id) on delete set null,
  article_id uuid references public.articles(id) on delete set null,
  status text not null default 'rascunho' check (status in ('rascunho', 'previa', 'ajuste', 'aprovado', 'agendado', 'publicado', 'cancelado')),
  versao integer not null default 1,
  conteudo jsonb not null default '{}'::jsonb,       -- saída da IA (matéria, legenda, telas)
  telas text[] not null default '{}',                -- URLs públicas dos PNGs
  fotos text[] not null default '{}',                -- URLs públicas das fotos copiadas
  capa_url text,
  collabs text[] not null default '{}',
  data_publicacao timestamptz,
  canais jsonb not null default '["site","instagram","facebook","linkedin","threads","newsletter"]'::jsonb,
  social_url text,
  publicado_em timestamptz,
  erro text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.auto_producoes enable row level security;
drop policy if exists auto_producoes_equipe on public.auto_producoes;
create policy auto_producoes_equipe on public.auto_producoes for all to authenticated
  using (crm_tem_acesso()) with check (crm_tem_acesso());

-- A fila aceita os passos da esteira (aviso de prévia, data marcada, publicado) e o WhatsApp
alter table public.auto_fila drop constraint if exists auto_fila_passo_check;
alter table public.auto_fila add constraint auto_fila_passo_check
  check (passo in ('D0', 'D3', 'D7', 'D15', 'D21', 'previa', 'data', 'publicado', 'resposta'));

-- Bucket público das produções (fotos copiadas e telas em PNG)
insert into storage.buckets (id, name, public) values ('producoes', 'producoes', true)
on conflict (id) do update set public = true;
drop policy if exists producoes_leitura on storage.objects;
create policy producoes_leitura on storage.objects for select to public using (bucket_id = 'producoes');

-- Briefings prontos para produzir (enviados sem produção, ou com ajuste pedido)
create or replace function public.auto_producoes_pendentes(p_limite integer default 2)
returns table (briefing_id uuid, token uuid, tipo text, dados jsonb, fotos text[], ajuste text,
               negocio_id uuid, empresa_id uuid, pessoa_id uuid, empresa text, pessoa text,
               producao_id uuid, conteudo_anterior jsonb, versao integer)
language sql stable security definer set search_path = public as $$
  select b.id, b.token, b.tipo, b.dados, b.fotos,
         case when b.status = 'ajuste' then b.ajuste_pedido end,
         b.negocio_id, b.empresa_id, b.pessoa_id, e.nome, p.nome,
         pr.id, case when b.status = 'ajuste' then pr.conteudo end, coalesce(pr.versao, 0)
    from auto_briefings b
    left join crm_empresas e on e.id = b.empresa_id
    left join crm_pessoas p on p.id = b.pessoa_id
    left join auto_producoes pr on pr.briefing_id = b.id
   where (b.status = 'enviado' and pr.id is null)
      or (b.status = 'ajuste' and pr.status in ('previa', 'ajuste') and pr.versao < 3)
   order by b.enviado_em nulls last, b.updated_at
   limit greatest(1, least(p_limite, 5));
$$;

-- Marca "em produção" para a rodada não ser repetida em paralelo
create or replace function public.auto_producao_iniciar(p_briefing uuid)
returns uuid language plpgsql security definer set search_path = public as $$
declare v_id uuid; b auto_briefings%rowtype;
begin
  select * into b from auto_briefings where id = p_briefing for update;
  insert into auto_producoes (briefing_id, negocio_id, empresa_id, pessoa_id, status)
  values (b.id, b.negocio_id, b.empresa_id, b.pessoa_id, 'rascunho')
  on conflict (briefing_id) do update set status = 'rascunho', updated_at = now()
  returning id into v_id;
  update auto_briefings set status = 'em_producao', updated_at = now() where id = b.id;
  return v_id;
end $$;

create or replace function public.auto_slug(p_texto text)
returns text language sql immutable as $$
  select left(trim(both '-' from regexp_replace(
    translate(lower(coalesce(p_texto, '')), 'áàâãäéèêëíìîïóòôõöúùûüçñ', 'aaaaaeeeeiiiiooooouuuucn'), '[^a-z0-9]+', '-', 'g')), 70);
$$;

-- Salva o rascunho: matéria em rascunho no site, telas, prévia no briefing e aviso ao lead (fila)
create or replace function public.auto_producao_salvar(p_producao uuid, p_conteudo jsonb, p_telas text[], p_fotos text[], p_capa text, p_erro text default null)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  pr auto_producoes%rowtype; b auto_briefings%rowtype;
  v_slug text; v_art uuid; v_pessoa crm_pessoas%rowtype; v_emp crm_empresas%rowtype;
  v_collabs text[] := '{}'; v_url text; v_canal text; v_dest text; v_link text; v_msg text; v_primeiro text;
  v_dono uuid;
begin
  select * into pr from auto_producoes where id = p_producao for update;
  if pr.id is null then raise exception 'Produção não encontrada.'; end if;
  select * into b from auto_briefings where id = pr.briefing_id for update;
  if p_erro is not null then
    update auto_producoes set erro = p_erro, updated_at = now() where id = pr.id;
    update auto_briefings set status = case when b.ajuste_pedido is not null and pr.versao > 0 then 'ajuste' else 'enviado' end, updated_at = now() where id = b.id;
    return jsonb_build_object('ok', false, 'erro', p_erro);
  end if;
  select * into v_pessoa from crm_pessoas where id = pr.pessoa_id;
  select * into v_emp from crm_empresas where id = pr.empresa_id;
  v_primeiro := split_part(coalesce(nullif(b.dados->>'nome', ''), v_pessoa.nome, 'olá'), ' ', 1);

  -- Collabs: pessoa e empresa (briefing primeiro, depois o CRM)
  foreach v_url in array array[b.dados->>'instagram', b.dados->>'instagram_empresa', v_pessoa.instagram, v_emp.instagram] loop
    v_url := lower(regexp_replace(regexp_replace(coalesce(v_url, ''), '^https?://(www\.)?instagram\.com/', ''), '^@|/.*$', '', 'g'));
    if v_url <> '' and not (v_url = any (v_collabs)) and v_url ~ '^[a-z0-9._]{2,30}$' then v_collabs := v_collabs || v_url; end if;
  end loop;

  -- Matéria em rascunho (não aparece até ser agendada)
  v_slug := auto_slug(p_conteudo->>'titulo');
  if v_slug = '' then v_slug := 'destaque-' || left(pr.id::text, 8); end if;
  if pr.article_id is null then
    if exists (select 1 from articles where slug = v_slug) then v_slug := v_slug || '-' || left(pr.id::text, 6); end if;
    insert into articles (slug, title, dek, body_markdown, why_it_matters, category, author, read_minutes, tags, seo_title, seo_description,
                          cover_image_url, sources, published_at, status, origin, scheduled_by)
    values (v_slug, p_conteudo->>'titulo', p_conteudo->>'dek', p_conteudo->>'body_markdown', p_conteudo->>'why_it_matters',
            coalesce(p_conteudo->>'category', 'brasil'), 'Redação IA News',
            greatest(2, ceil(array_length(regexp_split_to_array(coalesce(p_conteudo->>'body_markdown', ''), '\s+'), 1) / 200.0))::int,
            (select array_agg(t) from jsonb_array_elements_text(coalesce(p_conteudo->'tags', '[]'::jsonb)) t),
            p_conteudo->>'seo_title', p_conteudo->>'seo_description', p_capa,
            jsonb_build_array(jsonb_build_object('name', 'Briefing enviado à IA News', 'url', 'https://ianewsbr.com/briefing/' || b.token)),
            now() + interval '30 days', 'draft', 'instagram', 'claude')
    returning id into v_art;
  else
    v_art := pr.article_id;
    update articles set title = p_conteudo->>'titulo', dek = p_conteudo->>'dek', body_markdown = p_conteudo->>'body_markdown',
           why_it_matters = p_conteudo->>'why_it_matters', category = coalesce(p_conteudo->>'category', 'brasil'),
           tags = (select array_agg(t) from jsonb_array_elements_text(coalesce(p_conteudo->'tags', '[]'::jsonb)) t),
           seo_title = p_conteudo->>'seo_title', seo_description = p_conteudo->>'seo_description',
           cover_image_url = coalesce(p_capa, cover_image_url), updated_at = now()
     where id = v_art;
  end if;

  update auto_producoes set status = 'previa', versao = versao + 1, conteudo = p_conteudo, telas = coalesce(p_telas, '{}'),
         fotos = coalesce(p_fotos, '{}'), capa_url = coalesce(p_capa, capa_url), collabs = v_collabs, article_id = v_art, erro = null, updated_at = now()
   where id = pr.id;
  update auto_briefings set status = 'previa', previa_url = 'https://ianewsbr.com/previa/' || b.token, updated_at = now() where id = b.id;
  update crm_tarefas set feita = true, feita_em = now() where negocio_id = b.negocio_id and not feita and (chave like 'briefing-enviado:%' or chave like 'ajuste:%');

  insert into crm_atividades (tipo, canal, texto, negocio_id, empresa_id, pessoa_id)
  values ('sistema', 'site', 'Prévia gerada pela IA (v' || pr.versao + 1 || '): ' || (p_conteudo->>'titulo'), b.negocio_id, b.empresa_id, b.pessoa_id);

  -- Aviso ao lead com o link da prévia: WhatsApp se tiver número, senão Direct; a fila envia ou a Renata cola
  v_msg := 'Oi, ' || v_primeiro || '! Aqui é a Renata, da IA News. A prévia do seu destaque ficou pronta: ' ||
           'https://ianewsbr.com/previa/' || b.token || E'\n\nDá uma olhada na matéria e nas telas do post. Se estiver tudo certo, é só clicar em "Aprovar" na própria página; ' ||
           'se quiser ajustar algo, escreva lá no campo de ajuste. Assim que aprovar, eu te confirmo a data de publicação.';
  if coalesce(v_pessoa.whatsapp, b.dados->>'whatsapp', '') <> '' then
    v_canal := 'whatsapp'; v_dest := coalesce(v_pessoa.whatsapp, b.dados->>'whatsapp');
    v_link := 'https://wa.me/' || regexp_replace(v_dest, '\D', '', 'g') || '?text=' || replace(replace(v_msg, E'\n', '%0A'), ' ', '%20');
  elsif cardinality(v_collabs) > 0 then
    v_canal := 'direct'; v_dest := '@' || v_collabs[1]; v_link := 'https://ig.me/m/' || v_collabs[1];
  else
    v_canal := 'email'; v_dest := coalesce(v_pessoa.email, b.dados->>'email'); v_link := null;
  end if;
  insert into auto_fila (dia, canal, passo, negocio_id, empresa_id, pessoa_id, nota, destino, link, assunto, mensagem, automatico)
  values (crm_hoje(), v_canal, 'previa', b.negocio_id, b.empresa_id, b.pessoa_id, 100, v_dest, v_link, 'IA News · prévia do seu destaque', v_msg, v_canal = 'whatsapp')
  on conflict (negocio_id, passo) do update set dia = crm_hoje(), status = 'pendente', mensagem = excluded.mensagem, link = excluded.link, destino = excluded.destino, enviado_em = null;

  return jsonb_build_object('ok', true, 'producao', pr.id, 'article', v_art, 'slug', v_slug, 'previa', 'https://ianewsbr.com/previa/' || b.token, 'collabs', v_collabs, 'canal_aviso', v_canal);
end $$;

-- Prévia para a página pública (pelo token do briefing)
create or replace function public.auto_previa_get(p_token uuid)
returns jsonb language sql stable security definer set search_path = public as $$
  select jsonb_build_object(
    'status', b.status, 'tipo', b.tipo, 'ajuste_pedido', b.ajuste_pedido, 'aprovado_em', b.aprovado_em,
    'pessoa', coalesce(nullif(b.dados->>'nome', ''), p.nome), 'empresa', coalesce(nullif(b.dados->>'empresa', ''), e.nome),
    'producao', case when pr.id is null then null else jsonb_build_object(
        'status', pr.status, 'versao', pr.versao, 'conteudo', pr.conteudo, 'telas', pr.telas, 'capa', pr.capa_url,
        'collabs', pr.collabs, 'data_publicacao', pr.data_publicacao, 'slug', a.slug, 'social_url', pr.social_url) end)
    from auto_briefings b
    left join crm_pessoas p on p.id = b.pessoa_id
    left join crm_empresas e on e.id = b.empresa_id
    left join auto_producoes pr on pr.briefing_id = b.id
    left join articles a on a.id = pr.article_id
   where b.token = p_token;
$$;

-- Próxima vaga de destaque no calendário: a partir de amanhã, dias com menos destaques que o máximo
create or replace function public.auto_proxima_vaga(p_a_partir date default null)
returns timestamptz language plpgsql stable security definer set search_path = public as $$
declare
  v_hora time := coalesce((auto_cfg('horario_destaque_lead'))::text::time, '15:00'::time);
  v_max integer := coalesce((auto_cfg('max_destaques_dia'))::text::integer, 1);
  v_dia date := coalesce(p_a_partir, crm_hoje() + 1);
  v_tent integer := 0;
begin
  loop
    exit when v_tent > 60;
    if (select count(*) from auto_producoes where status in ('agendado', 'publicado') and (data_publicacao at time zone 'America/Sao_Paulo')::date = v_dia) < v_max
       and not exists (select 1 from articles where status = 'published' and (published_at at time zone 'America/Sao_Paulo') = (v_dia + v_hora)) then
      return (v_dia + v_hora) at time zone 'America/Sao_Paulo';
    end if;
    v_dia := v_dia + 1; v_tent := v_tent + 1;
  end loop;
  return (v_dia + v_hora) at time zone 'America/Sao_Paulo';
end $$;

-- Agenda a produção aprovada: matéria publicada com data futura, tarefa de Instagram, aviso ao lead
create or replace function public.auto_producao_agendar(p_briefing uuid)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  pr auto_producoes%rowtype; b auto_briefings%rowtype; v_quando timestamptz; v_dono uuid;
  v_pessoa crm_pessoas%rowtype; v_slug text; v_primeiro text; v_msg text; v_canal text; v_dest text; v_link text;
  v_quando_txt text;
begin
  select * into pr from auto_producoes where briefing_id = p_briefing for update;
  if pr.id is null or pr.article_id is null then return jsonb_build_object('ok', false, 'erro', 'Sem produção para agendar.'); end if;
  select * into b from auto_briefings where id = p_briefing;
  select dono_id into v_dono from crm_negocios where id = pr.negocio_id;
  select * into v_pessoa from crm_pessoas where id = pr.pessoa_id;
  v_quando := auto_proxima_vaga();
  update articles set status = 'published', published_at = v_quando, updated_at = now() where id = pr.article_id returning slug into v_slug;
  update auto_producoes set status = 'agendado', data_publicacao = v_quando, updated_at = now() where id = pr.id;
  v_quando_txt := to_char(v_quando at time zone 'America/Sao_Paulo', 'DD/MM') || ' às ' || to_char(v_quando at time zone 'America/Sao_Paulo', 'HH24"h"MI');
  update crm_negocios set proxima_acao = 'Publicação agendada para ' || v_quando_txt, proxima_acao_em = (v_quando at time zone 'America/Sao_Paulo')::date where id = pr.negocio_id;

  insert into crm_tarefas (titulo, descricao, vence_em, automatica, chave, responsavel_id, empresa_id, pessoa_id, negocio_id)
  values ('Agendar no Instagram: ' || v_quando_txt,
          'Post do destaque "' || (pr.conteudo->>'titulo') || '". Agendar pelo compositor nativo do Instagram com curtidas ocultas e collab com ' ||
          coalesce(nullif(array_to_string(pr.collabs, ', @'), ''), '(sem @ informado)') || E'.\nTelas (PNG): ' || array_to_string(pr.telas, E'\n') ||
          E'\nLegenda e matéria: https://ianewsbr.com/previa/' || b.token || E'\nMatéria no site entra sozinha: https://ianewsbr.com/materia/' || v_slug ||
          E'\nFacebook (IANews Co) pelo Business Suite, LinkedIn e Threads no mesmo horário.',
          (v_quando at time zone 'America/Sao_Paulo')::date - 1, true, 'agendar-ig:' || pr.id, v_dono, pr.empresa_id, pr.pessoa_id, pr.negocio_id)
  on conflict do nothing;
  update crm_tarefas set feita = true, feita_em = now() where negocio_id = pr.negocio_id and not feita and chave like 'previa-aprovada:%';

  v_primeiro := split_part(coalesce(nullif(b.dados->>'nome', ''), v_pessoa.nome, 'olá'), ' ', 1);
  v_msg := 'Obrigada pela aprovação, ' || v_primeiro || '! Seu destaque sai em ' || v_quando_txt || ' (horário de Brasília) no Instagram @ianews.co, no site ianewsbr.com, no Facebook, no LinkedIn e no Threads, e vai na newsletter da manhã seguinte.' ||
           case when cardinality(pr.collabs) > 0 then E'\n\nVai chegar um convite de colaboração no Instagram ' || '@' || pr.collabs[1] || ': é só aceitar para o post aparecer também no seu perfil.' else '' end ||
           E'\n\nNo dia, eu te mando os links.';
  if coalesce(v_pessoa.whatsapp, b.dados->>'whatsapp', '') <> '' then
    v_canal := 'whatsapp'; v_dest := coalesce(v_pessoa.whatsapp, b.dados->>'whatsapp');
    v_link := 'https://wa.me/' || regexp_replace(v_dest, '\D', '', 'g') || '?text=' || replace(replace(v_msg, E'\n', '%0A'), ' ', '%20');
  elsif cardinality(pr.collabs) > 0 then
    v_canal := 'direct'; v_dest := '@' || pr.collabs[1]; v_link := 'https://ig.me/m/' || pr.collabs[1];
  else
    v_canal := 'email'; v_dest := coalesce(v_pessoa.email, b.dados->>'email'); v_link := null;
  end if;
  insert into auto_fila (dia, canal, passo, negocio_id, empresa_id, pessoa_id, nota, destino, link, assunto, mensagem, automatico)
  values (crm_hoje(), v_canal, 'data', pr.negocio_id, pr.empresa_id, pr.pessoa_id, 100, v_dest, v_link, 'IA News · data do seu destaque', v_msg, v_canal = 'whatsapp')
  on conflict (negocio_id, passo) do update set dia = crm_hoje(), status = 'pendente', mensagem = excluded.mensagem, enviado_em = null;

  insert into crm_atividades (tipo, canal, texto, negocio_id, empresa_id, pessoa_id)
  values ('sistema', 'site', 'Destaque agendado para ' || v_quando_txt || ' (matéria ' || v_slug || ').', pr.negocio_id, pr.empresa_id, pr.pessoa_id);
  return jsonb_build_object('ok', true, 'quando', v_quando, 'slug', v_slug);
end $$;

-- A decisão do lead na prévia agenda sozinha (aprovou) ou manda para a IA reescrever (ajuste)
create or replace function public.auto_briefing_decidir(p_token uuid, p_aprovar boolean, p_ajuste text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare b auto_briefings%rowtype; v_etapa uuid; v_dono uuid; v_tipo text; v_ag jsonb;
begin
  select * into b from auto_briefings where token = p_token for update;
  if b.id is null then raise exception 'Briefing não encontrado.'; end if;
  if b.status <> 'previa' then return jsonb_build_object('ok', false, 'erro', 'Não há prévia aguardando aprovação.'); end if;
  select dono_id, tipo into v_dono, v_tipo from crm_negocios where id = b.negocio_id;
  if p_aprovar then
    update auto_briefings set status = 'aprovado', aprovado_em = now(), updated_at = now() where id = b.id;
    update auto_producoes set status = 'aprovado', updated_at = now() where briefing_id = b.id;
    select id into v_etapa from crm_etapas where funil_id = 'materia' and nome = 'Aprovado';
    update crm_negocios set etapa_id = v_etapa, etapa_desde = now() where id = b.negocio_id and v_etapa is not null;
    insert into crm_atividades (tipo, canal, texto, negocio_id, empresa_id, pessoa_id)
    values ('sistema', 'site', 'Prévia aprovada pelo cliente.', b.negocio_id, b.empresa_id, b.pessoa_id);
    if b.tipo = 'cortesia' or exists (select 1 from crm_negocios n where n.id = b.negocio_id and n.status_pagamento = 'pago') then
      v_ag := auto_producao_agendar(b.id);
    else
      insert into crm_tarefas (titulo, descricao, vence_em, automatica, chave, responsavel_id, empresa_id, pessoa_id, negocio_id)
      values ('Cobrar e agendar publicação', 'Prévia aprovada. O link de pagamento sai sozinho quando o gateway estiver ligado; com a baixa, a publicação é agendada.',
              crm_hoje(), true, 'previa-aprovada:' || b.id, v_dono, b.empresa_id, b.pessoa_id, b.negocio_id)
      on conflict do nothing;
    end if;
  else
    update auto_briefings set status = 'ajuste', ajuste_pedido = left(coalesce(p_ajuste, ''), 3000), updated_at = now() where id = b.id;
    update auto_producoes set status = 'ajuste', updated_at = now() where briefing_id = b.id;
    insert into crm_atividades (tipo, canal, texto, negocio_id, empresa_id, pessoa_id)
    values ('mensagem_recebida', 'site', 'Pedido de ajuste na prévia: ' || left(coalesce(p_ajuste, ''), 900), b.negocio_id, b.empresa_id, b.pessoa_id);
  end if;
  return jsonb_build_object('ok', true, 'agendamento', v_ag);
end $$;

-- Pagamento com baixa de um destaque pago já aprovado: agenda
create or replace function public.auto_pagamento_baixa()
returns trigger language plpgsql security definer set search_path = public as $$
declare v_etapa uuid; v_b uuid;
begin
  if new.status = 'pago' and (old.status is distinct from 'pago') then
    update crm_negocios set status_pagamento = 'pago', valor = coalesce(valor, new.valor) where id = new.negocio_id;
    select id into v_b from auto_briefings where negocio_id = new.negocio_id and status = 'aprovado';
    if v_b is not null then perform auto_producao_agendar(v_b); end if;
    insert into crm_atividades (tipo, canal, texto, negocio_id)
    values ('sistema', 'site', 'Pagamento confirmado (' || coalesce(new.forma, new.gateway) || ').', new.negocio_id);
  end if;
  return new;
end $$;

-- Depois da publicação: marca publicado, registra o conteúdo, move o negócio e avisa o lead com os links
create or replace function public.auto_producoes_publicadas()
returns jsonb language plpgsql security definer set search_path = public as $$
declare pr record; v_etapa uuid; v_pessoa crm_pessoas%rowtype; v_primeiro text; v_msg text; v_canal text; v_dest text; v_link text; n integer := 0; v_dono uuid;
begin
  select id into v_etapa from crm_etapas where funil_id = 'materia' and nome = 'Publicado';
  for pr in
    select p.*, a.slug, a.title, b.dados, b.token from auto_producoes p join articles a on a.id = p.article_id join auto_briefings b on b.id = p.briefing_id
     where p.status = 'agendado' and a.status = 'published' and a.published_at <= now()
  loop
    update auto_producoes set status = 'publicado', publicado_em = now(), updated_at = now() where id = pr.id;
    insert into crm_conteudos (article_id, canal, formato, titulo, url, publicado_em, ativo)
    values (pr.article_id, 'site', 'materia', pr.title, 'https://ianewsbr.com/materia/' || pr.slug, pr.data_publicacao, true);
    if pr.empresa_id is not null or pr.pessoa_id is not null then
      insert into crm_mencoes (article_id, empresa_id, pessoa_id, papel, ativo) values (pr.article_id, pr.empresa_id, pr.pessoa_id, 'protagonista', true) on conflict do nothing;
    end if;
    update crm_negocios set etapa_id = coalesce(v_etapa, etapa_id), etapa_desde = now(), proxima_acao = 'Enviar links e pedir o post no perfil', proxima_acao_em = crm_hoje() where id = pr.negocio_id;
    select dono_id into v_dono from crm_negocios where id = pr.negocio_id;
    select * into v_pessoa from crm_pessoas where id = pr.pessoa_id;
    v_primeiro := split_part(coalesce(nullif(pr.dados->>'nome', ''), v_pessoa.nome, 'olá'), ' ', 1);
    v_msg := 'Saiu, ' || v_primeiro || '! Seu destaque está no ar:' || E'\n' || 'https://ianewsbr.com/materia/' || pr.slug ||
             coalesce(E'\n' || pr.social_url, '') || E'\n\nSe puder, compartilhe nos stories e aceite o convite de collab. Obrigada pela confiança!';
    if coalesce(v_pessoa.whatsapp, pr.dados->>'whatsapp', '') <> '' then
      v_canal := 'whatsapp'; v_dest := coalesce(v_pessoa.whatsapp, pr.dados->>'whatsapp');
      v_link := 'https://wa.me/' || regexp_replace(v_dest, '\D', '', 'g') || '?text=' || replace(replace(v_msg, E'\n', '%0A'), ' ', '%20');
    elsif cardinality(pr.collabs) > 0 then
      v_canal := 'direct'; v_dest := '@' || pr.collabs[1]; v_link := 'https://ig.me/m/' || pr.collabs[1];
    else
      v_canal := 'email'; v_dest := coalesce(v_pessoa.email, pr.dados->>'email'); v_link := null;
    end if;
    insert into auto_fila (dia, canal, passo, negocio_id, empresa_id, pessoa_id, nota, destino, link, assunto, mensagem, automatico)
    values (crm_hoje(), v_canal, 'publicado', pr.negocio_id, pr.empresa_id, pr.pessoa_id, 100, v_dest, v_link, 'IA News · seu destaque está no ar', v_msg, v_canal = 'whatsapp')
    on conflict (negocio_id, passo) do nothing;
    insert into crm_tarefas (titulo, descricao, vence_em, automatica, chave, responsavel_id, empresa_id, pessoa_id, negocio_id)
    values ('Colar o link do post do Instagram', 'O destaque "' || pr.title || '" foi publicado. Registre o link do post no CRM (produção) para o lead receber.',
            crm_hoje(), true, 'link-post:' || pr.id, v_dono, pr.empresa_id, pr.pessoa_id, pr.negocio_id)
    on conflict do nothing;
    n := n + 1;
  end loop;
  return jsonb_build_object('ok', true, 'publicadas', n);
end $$;

-- Registro do link do post (equipe) e painel das produções (CRM)
create or replace function public.auto_producao_link(p_producao uuid, p_url text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare pr auto_producoes%rowtype;
begin
  if auth.uid() is not null and not crm_tem_acesso() then raise exception 'Acesso restrito à equipe do CRM.'; end if;
  update auto_producoes set social_url = p_url, updated_at = now() where id = p_producao returning * into pr;
  update articles set social_url = p_url where id = pr.article_id;
  insert into crm_conteudos (article_id, canal, formato, titulo, url, publicado_em, ativo)
  values (pr.article_id, 'instagram', 'carrossel', pr.conteudo->>'titulo', p_url, coalesce(pr.publicado_em, now()), true);
  update auto_fila set mensagem = mensagem || E'\n' || p_url where negocio_id = pr.negocio_id and passo = 'publicado' and status = 'pendente';
  update crm_tarefas set feita = true, feita_em = now() where chave = 'link-post:' || pr.id and not feita;
  return jsonb_build_object('ok', true);
end $$;

create or replace view public.auto_producoes_painel with (security_invoker = true) as
select pr.id, pr.status, pr.versao, pr.data_publicacao, pr.publicado_em, pr.social_url, pr.telas, pr.capa_url, pr.collabs, pr.erro, pr.updated_at,
       pr.conteudo->>'titulo' as titulo, pr.conteudo->>'legenda' as legenda,
       b.token, b.status as briefing_status, b.tipo, b.ajuste_pedido,
       a.slug, p.nome as pessoa, e.nome as empresa, pr.negocio_id, pr.empresa_id, pr.pessoa_id
  from public.auto_producoes pr
  join public.auto_briefings b on b.id = pr.briefing_id
  left join public.articles a on a.id = pr.article_id
  left join public.crm_pessoas p on p.id = pr.pessoa_id
  left join public.crm_empresas e on e.id = pr.empresa_id;

do $$ declare f text; begin
  foreach f in array array['auto_producoes_pendentes(integer)', 'auto_producao_iniciar(uuid)', 'auto_producao_salvar(uuid, jsonb, text[], text[], text, text)',
                          'auto_previa_get(uuid)', 'auto_producao_agendar(uuid)', 'auto_producoes_publicadas()'] loop
    execute format('revoke execute on function public.%s from public, anon, authenticated', f);
    execute format('grant execute on function public.%s to service_role', f);
  end loop;
  foreach f in array array['auto_producao_link(uuid, text)', 'auto_proxima_vaga(date)'] loop
    execute format('revoke execute on function public.%s from public, anon', f);
    execute format('grant execute on function public.%s to authenticated, service_role', f);
  end loop;
end $$;

-- Rotinas: produção a cada 20 min (8h às 22h), publicadas a cada 15 min
select cron.unschedule(jobid) from cron.job where jobname in ('ianews-auto-producao', 'ianews-auto-publicadas');
select cron.schedule('ianews-auto-producao', '*/20 11-23,0-1 * * *', $$select public.call_site_hook('/api/public/hooks/producao', '{"limite":2}')$$);
select cron.schedule('ianews-auto-publicadas', '*/15 * * * *', $$select public.auto_producoes_publicadas()$$);
