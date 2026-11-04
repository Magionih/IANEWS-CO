-- Etapas de Follow-up e Remarketing nos três funis e tags estratégicas nos negócios.
--  * Follow-up: entre a proposta/conversa e o fechamento (lead esperando retorno).
--  * Remarketing: área de reaquecimento (lead frio, sem resposta ou perdido que vale retomar).
--  * Tags: catálogo editável pelo admin (Configuração), aplicado aos negócios; cada mudança
--    de tag fica no histórico do negócio, com data e autor.

-- ---------------------------------------------------------------------
-- 1. Etapas novas (as etapas de ganho andam uma posição para dar lugar ao Follow-up)
-- ---------------------------------------------------------------------
update public.crm_etapas set ordem = ordem + 1
 where funil_id = 'materia' and ordem between 7 and 8
   and not exists (select 1 from public.crm_etapas where funil_id = 'materia' and nome = 'Follow-up');
update public.crm_etapas set ordem = ordem + 1
 where funil_id = 'publicidade' and ordem between 6 and 8
   and not exists (select 1 from public.crm_etapas where funil_id = 'publicidade' and nome = 'Follow-up');
update public.crm_etapas set ordem = ordem + 1
 where funil_id = 'parcerias' and ordem between 3 and 5
   and not exists (select 1 from public.crm_etapas where funil_id = 'parcerias' and nome = 'Follow-up');

insert into public.crm_etapas (funil_id, nome, ordem, prazo_dias, acao_padrao, tipo, criterio_entrada) values
  ('materia', 'Follow-up', 7, 2, 'Fazer follow-up (nova mensagem ou ligação)', 'aberta',
   'Proposta enviada e aguardando retorno'),
  ('materia', 'Remarketing', 97, 15, 'Reenviar conteúdo novo ou nova oferta', 'aberta',
   'Lead frio, sem resposta ou perdido que vale reaquecer'),
  ('publicidade', 'Follow-up', 6, 2, 'Fazer follow-up da proposta', 'aberta',
   'Proposta ou negociação aguardando retorno'),
  ('publicidade', 'Remarketing', 97, 15, 'Reenviar mídia kit ou case novo', 'aberta',
   'Anunciante frio ou perdido que vale reaquecer'),
  ('parcerias', 'Follow-up', 3, 3, 'Retomar a conversa', 'aberta',
   'Conversa iniciada aguardando retorno'),
  ('parcerias', 'Remarketing', 97, 20, 'Propor nova ação conjunta', 'aberta',
   'Parceiro frio ou parceria encerrada que vale retomar')
on conflict (funil_id, nome) do nothing;

insert into public.crm_modelos (nome, canal, etapa_id, texto, ordem) values
  ('Follow-up · Retomar conversa', 'whatsapp',
   (select id from public.crm_etapas where funil_id = 'materia' and nome = 'Follow-up'),
   E'Oi, {nome}! Tudo bem? Passando para saber se você conseguiu avaliar a proposta da matéria da {empresa}. Se quiser, te explico rapidinho por aqui ou por ligação.\n\nRenata, da IA News', 65),
  ('Remarketing · Conteúdo novo', 'direct',
   (select id from public.crm_etapas where funil_id = 'materia' and nome = 'Remarketing'),
   E'Oi, {nome}! Tudo bem? Lembrei da {empresa} quando publicamos este conteúdo e achei que você ia gostar: {link_materia}\n\nSe ainda fizer sentido contar a história de vocês na IA News, me chama por aqui.\n\nRenata, da IA News', 85),
  ('Publicidade · Follow-up', 'email',
   (select id from public.crm_etapas where funil_id = 'publicidade' and nome = 'Follow-up'),
   E'Oi, {nome}! Tudo bem? Conseguiu avaliar a proposta de mídia da {empresa} na IA News? Posso ajustar o pacote ao momento de vocês.\n\nRenata, da IA News', 115)
on conflict (nome) do nothing;

-- Rotina diária: Follow-up sem resposta também vai para "Sem resposta".
do $$
declare d text; novo text;
begin
  d := pg_get_functiondef('public.crm_rotina_diaria()'::regprocedure);
  novo := replace(d, $q$e.nome in ('Contatado', 'Proposta')$q$, $q$e.nome in ('Contatado', 'Proposta', 'Follow-up')$q$);
  if novo = d and position($q$'Follow-up')$q$ in d) = 0 then
    raise exception 'crm_rotina_diaria: trecho esperado não encontrado';
  end if;
  execute novo;
end $$;

-- Campanha no ar: compara com a posição de "Em veiculação" (não mais com o número fixo 7).
do $$
declare d text; novo text;
begin
  d := pg_get_functiondef('public.crm_campanhas_antes()'::regprocedure);
  novo := replace(d, 'ordem_atual < 7',
                  'ordem_atual < (select ordem from crm_etapas where id = etapa_vei)');
  if novo = d and position('where id = etapa_vei)' in d) = 0 then
    raise exception 'crm_campanhas_antes: trecho esperado não encontrado';
  end if;
  execute novo;
end $$;

-- ---------------------------------------------------------------------
-- 2. Tags estratégicas
-- ---------------------------------------------------------------------
create table if not exists public.crm_tags (
  id uuid primary key default gen_random_uuid(),
  nome text not null check (length(trim(nome)) between 1 and 40),
  cor text not null default 'azul'
    check (cor in ('azul', 'verde', 'amarelo', 'laranja', 'vermelho', 'roxo', 'cinza')),
  descricao text check (descricao is null or length(descricao) <= 300),
  ordem integer not null default 0,
  ativo boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (nome)
);

alter table public.crm_tags enable row level security;
revoke all on table public.crm_tags from anon;
revoke delete, truncate on table public.crm_tags from authenticated;
drop policy if exists crm_ler on public.crm_tags;
drop policy if exists crm_inserir on public.crm_tags;
drop policy if exists crm_editar on public.crm_tags;
create policy crm_ler on public.crm_tags for select to authenticated using (public.crm_tem_acesso());
create policy crm_inserir on public.crm_tags for insert to authenticated with check (public.crm_e_admin());
create policy crm_editar on public.crm_tags for update to authenticated
  using (public.crm_e_admin()) with check (public.crm_e_admin());

insert into public.crm_tags (nome, cor, descricao, ordem) values
  ('Quente', 'vermelho', 'Interesse alto: responder no mesmo dia', 10),
  ('Morno', 'laranja', 'Interesse, mas sem urgência', 20),
  ('Frio', 'cinza', 'Pouco interesse no momento', 30),
  ('Prioridade', 'roxo', 'Conta estratégica para a IA News', 40),
  ('Decisor no contato', 'verde', 'Estamos falando com quem decide', 50),
  ('Pediu preço', 'azul', 'Perguntou valores ou condições', 60),
  ('Orçamento curto', 'amarelo', 'Quer, mas tem pouca verba', 70),
  ('Aguardando material', 'azul', 'Falta briefing, fotos ou aprovação do cliente', 80),
  ('Retomar depois', 'cinza', 'Pediu para voltar a falar mais tarde', 90),
  ('Cliente recorrente', 'verde', 'Já comprou e pode comprar de novo', 100),
  ('Indicação', 'verde', 'Chegou por indicação', 110),
  ('Upsell publicidade', 'roxo', 'Pode virar anunciante', 120)
on conflict (nome) do nothing;

alter table public.crm_negocios add column if not exists tags uuid[] not null default '{}';
alter table public.crm_negocios drop constraint if exists crm_negocios_tags_max;
alter table public.crm_negocios add constraint crm_negocios_tags_max check (cardinality(tags) <= 20);
create index if not exists crm_negocios_tags_idx on public.crm_negocios using gin (tags);

-- Resumo dos negócios passa a trazer as tags.
do $$
declare d text; novo text;
begin
  d := pg_get_viewdef('public.crm_negocios_resumo'::regclass);
  if position('n.tags' in d) > 0 then return; end if;
  novo := replace(d, E'\n   FROM (crm_negocios n', E',\n    n.tags\n   FROM (crm_negocios n');
  if novo = d then raise exception 'crm_negocios_resumo: trecho esperado não encontrado'; end if;
  execute 'create or replace view public.crm_negocios_resumo with (security_invoker = true) as ' || novo;
end $$;

-- Histórico: cada mudança de tag vira uma linha na linha do tempo do negócio.
do $$
declare d text; novo text;
begin
  d := pg_get_functiondef('public.crm_negocios_depois()'::regprocedure);
  if position('Tags:' in d) > 0 then return; end if;
  -- Ponto de inserção: antes do bloco "empresa sem dono herda o dono do negócio".
  novo := replace(d, '  if new.empresa_id is not null and new.dono_id is not null then', $q$  if tg_op = 'UPDATE' and new.tags is distinct from old.tags then
    insert into crm_atividades (tipo, texto, empresa_id, pessoa_id, negocio_id, autor_id)
    select 'sistema',
           'Tags: ' || concat_ws(' · ',
             (select '+ ' || string_agg(t.nome, ', ' order by t.ordem) from crm_tags t
               where t.id = any(new.tags) and not (t.id = any(old.tags))),
             (select '− ' || string_agg(t.nome, ', ' order by t.ordem) from crm_tags t
               where t.id = any(old.tags) and not (t.id = any(new.tags)))),
           new.empresa_id, new.pessoa_id, new.id, auth.uid();
  end if;

  if new.empresa_id is not null and new.dono_id is not null then$q$);
  if novo = d then raise exception 'crm_negocios_depois: trecho esperado não encontrado'; end if;
  execute novo;
end $$;

-- Só guarda tags que existem no catálogo (sem repetição).
do $$
declare d text; novo text;
begin
  d := pg_get_functiondef('public.crm_negocios_antes()'::regprocedure);
  if position('crm_tags' in d) > 0 then return; end if;
  novo := replace(d,
    $q$  if new.status_pagamento = 'cortesia' and new.tipo is null then new.tipo := 'destaque_cortesia'; end if;$q$,
    $q$  if new.status_pagamento = 'cortesia' and new.tipo is null then new.tipo := 'destaque_cortesia'; end if;
  if tg_op = 'INSERT' or new.tags is distinct from old.tags then
    new.tags := coalesce(array(select distinct x from unnest(new.tags) x
                                where exists (select 1 from crm_tags t where t.id = x)), '{}');
  end if;$q$);
  if novo = d then raise exception 'crm_negocios_antes: trecho esperado não encontrado'; end if;
  execute novo;
end $$;
