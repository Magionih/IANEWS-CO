-- Enriquecimento de leads (Instagram, LinkedIn, site) pela IA com busca do Google.
create table if not exists public.auto_enriquecimentos (
  empresa_id uuid primary key references public.crm_empresas(id) on delete cascade,
  pessoa_id uuid references public.crm_pessoas(id) on delete set null,
  tentativas integer not null default 0,
  ultimo_em timestamptz,
  confianca text,
  fontes text[],
  achou_instagram boolean,
  created_at timestamptz not null default now()
);
alter table public.auto_enriquecimentos enable row level security;
drop policy if exists auto_enriquecimentos_equipe on public.auto_enriquecimentos;
create policy auto_enriquecimentos_equipe on public.auto_enriquecimentos for select to authenticated using (crm_tem_acesso());

-- Quem precisa de enriquecimento: empresa brasileira (ou sem país) com negócio aberto ou citada nos últimos 30 dias,
-- sem Instagram nem LinkedIn (nem na empresa nem na pessoa ligada), no máximo 2 tentativas, 14 dias entre elas.
create or replace function public.auto_enriquecer_pendentes(p_limite integer default 6)
returns table (empresa_id uuid, empresa text, site text, pessoa_id uuid, pessoa text, cargo text, contexto text)
language sql stable security definer set search_path = public as $$
  select e.id, e.nome, e.site, p.id, p.nome, ep.cargo,
         (select string_agg(a.title, ' | ') from crm_mencoes m join articles a on a.id = m.article_id
           where m.empresa_id = e.id and m.ativo limit 1)
    from crm_empresas e
    left join auto_enriquecimentos x on x.empresa_id = e.id
    left join lateral (
      select p1.*, ep1.cargo as _cargo from crm_pessoas p1 join crm_empresa_pessoas ep1 on ep1.pessoa_id = p1.id
       where ep1.empresa_id = e.id and p1.ativo order by ep1.decisor desc nulls last, p1.created_at limit 1
    ) p on true
    left join crm_empresa_pessoas ep on ep.empresa_id = e.id and ep.pessoa_id = p.id
   where e.ativo and coalesce(e.brasileira, true) and not e.e_cliente and not e.e_anunciante
     and coalesce(e.instagram, '') = '' and coalesce(e.linkedin, '') = ''
     and coalesce(p.instagram, '') = '' and coalesce(p.linkedin, '') = ''
     and (exists (select 1 from crm_negocios n join crm_etapas et on et.id = n.etapa_id where n.empresa_id = e.id and n.ativo and et.tipo = 'aberta')
          or e.noticia_recente_em >= crm_hoje() - 30)
     and coalesce(x.tentativas, 0) < 2
     and (x.ultimo_em is null or x.ultimo_em < now() - interval '14 days')
   order by e.noticia_recente_em desc nulls last, e.pontuacao desc nulls last, e.created_at desc
   limit greatest(1, least(p_limite, 15));
$$;

create or replace function public.auto_enriquecer_salvar(p_empresa uuid, p_pessoa uuid, p_dados jsonb)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  e jsonb := p_dados->'empresa'; p jsonb := p_dados->'pessoa';
  v_conf text := p_dados->>'confianca';
  v_ok boolean := p_dados is not null and v_conf in ('alta', 'media');
  n_campos integer := 0;
begin
  insert into auto_enriquecimentos (empresa_id, pessoa_id, tentativas, ultimo_em, confianca, fontes, achou_instagram)
  values (p_empresa, p_pessoa, 1, now(), v_conf,
          (select array_agg(x) from jsonb_array_elements_text(coalesce(p_dados->'fontes', '[]'::jsonb)) x),
          coalesce(e->>'instagram', p->>'instagram') is not null)
  on conflict (empresa_id) do update
    set tentativas = auto_enriquecimentos.tentativas + 1, ultimo_em = now(), confianca = excluded.confianca,
        fontes = excluded.fontes, achou_instagram = excluded.achou_instagram, pessoa_id = coalesce(excluded.pessoa_id, auto_enriquecimentos.pessoa_id);
  if not v_ok then
    return jsonb_build_object('ok', false, 'motivo', coalesce('confiança ' || v_conf, 'sem resposta'));
  end if;
  update crm_empresas set
    instagram = coalesce(instagram, nullif(e->>'instagram', '')),
    linkedin = coalesce(linkedin, nullif(e->>'linkedin', '')),
    site = coalesce(site, nullif(e->>'site', '')),
    cidade = coalesce(cidade, nullif(e->>'cidade', '')),
    setor = coalesce(setor, nullif(e->>'setor', '')),
    brasileira = coalesce(brasileira, nullif(e->>'brasileira', '')::boolean),
    seguidores_instagram = coalesce(seguidores_instagram, nullif(e->>'seguidores_instagram', '')::integer),
    descricao = coalesce(descricao, nullif(e->>'descricao', ''))
  where id = p_empresa;
  n_campos := (coalesce(e->>'instagram', '') <> '')::int + (coalesce(e->>'linkedin', '') <> '')::int + (coalesce(e->>'site', '') <> '')::int;
  if p_pessoa is not null and p is not null then
    update crm_pessoas set
      instagram = coalesce(instagram, nullif(p->>'instagram', '')),
      linkedin = coalesce(linkedin, nullif(p->>'linkedin', ''))
    where id = p_pessoa;
    update crm_empresa_pessoas set cargo = coalesce(cargo, nullif(p->>'cargo', '')) where empresa_id = p_empresa and pessoa_id = p_pessoa;
    n_campos := n_campos + (coalesce(p->>'instagram', '') <> '')::int + (coalesce(p->>'linkedin', '') <> '')::int;
  end if;
  insert into crm_atividades (tipo, canal, texto, empresa_id, pessoa_id)
  values ('sistema', 'interno', 'Enriquecido pela IA (' || v_conf || '): ' ||
          concat_ws(', ', 'IG ' || coalesce(e->>'instagram', p->>'instagram'), 'LinkedIn ' || coalesce(e->>'linkedin', p->>'linkedin')), p_empresa, p_pessoa);
  return jsonb_build_object('ok', true, 'campos', n_campos, 'instagram', coalesce(e->>'instagram', p->>'instagram'));
end $$;

do $$ declare f text; begin
  foreach f in array array['auto_enriquecer_pendentes(integer)', 'auto_enriquecer_salvar(uuid, uuid, jsonb)'] loop
    execute format('revoke execute on function public.%s from public, anon, authenticated', f);
    execute format('grant execute on function public.%s to service_role', f);
  end loop;
end $$;

-- 6h50, 13h e 19h em Brasília: enriquece 6 leads por rodada (antes da lista das 7h)
select cron.unschedule(jobid) from cron.job where jobname = 'ianews-auto-enriquecer';
select cron.schedule('ianews-auto-enriquecer', '50 9,16,22 * * *', $$select public.call_site_hook('/api/public/hooks/enriquecer', '{"limite":6}')$$);
