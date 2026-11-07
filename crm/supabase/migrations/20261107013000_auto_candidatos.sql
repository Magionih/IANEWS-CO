-- Candidatos ao primeiro contato: inclui os leads de fundador sem empresa cadastrada (a maior parte do
-- funil de matéria) e usa o perfil da empresa só quando não há contato da pessoa.

-- Nota de um lead sem empresa (0 a 100). Com empresa, vale a pontuação da empresa.
create or replace function public.auto_nota_pessoa(
  p_instagram text, p_linkedin text, p_email text, p_whatsapp text,
  p_seguidores integer, p_consentimento boolean, p_aquecido timestamptz)
returns integer language sql stable set search_path = public as $$
  select least(100,
      30
    + case when coalesce(p_instagram, '') <> '' then 15 else 0 end
    + case when coalesce(p_linkedin, '') <> '' then 10 else 0 end
    + case when coalesce(p_email, '') <> '' or coalesce(p_whatsapp, '') <> '' then 15 else 0 end
    + case when coalesce(p_seguidores, 0) >= 10000 then 15
           when coalesce(p_seguidores, 0) >= 3000 then 8 else 0 end
    + case when coalesce(p_consentimento, false) or p_aquecido >= now() - interval '30 days' then 15 else 0 end);
$$;

create or replace view public.auto_candidatos with (security_invoker = true) as
select n.id as negocio_id, n.funil_id, e.id as empresa_id, p.id as pessoa_id,
       coalesce(e.pontuacao, public.auto_nota_pessoa(p.instagram, p.linkedin, p.email, p.whatsapp, p.seguidores_instagram, p.consentimento, p.aquecido_em)) as nota,
       p.nome as pnome, coalesce(e.nome, '') as enome,
       coalesce(nullif(p.instagram, ''), nullif(e.instagram, '')) as instagram,
       nullif(p.email, '') as email,
       coalesce(nullif(p.linkedin, ''), nullif(e.linkedin, '')) as linkedin,
       (coalesce(p.instagram, '') = '' and coalesce(e.instagram, '') <> '') as via_empresa,
       exists (select 1 from public.crm_mencoes m where m.empresa_id = e.id and m.ativo) as virou_pauta,
       e.noticia_recente_em, n.created_at
  from public.crm_negocios n
  join public.crm_etapas et on et.id = n.etapa_id and et.ordem = 1 and et.tipo = 'aberta'
  left join public.crm_empresas e on e.id = n.empresa_id
  left join lateral (
    select p1.* from public.crm_pessoas p1
     where p1.ativo and (p1.id = n.pessoa_id
            or (n.pessoa_id is null and p1.id in (select ep.pessoa_id from public.crm_empresa_pessoas ep where ep.empresa_id = e.id)))
     order by (p1.id = n.pessoa_id) desc nulls last, p1.created_at
     limit 1
  ) p on true
 where n.ativo and n.funil_id in ('materia', 'publicidade')
   and (e.id is null or e.ativo)
   and (p.id is not null or e.id is not null);

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

  -- Pendentes de dias anteriores expiram; o D0 não enviado volta a ser candidato
  update auto_fila set status = 'expirado' where status = 'pendente' and dia < v_dia;
  get diagnostics n_exp = row_count;
  delete from auto_fila where status = 'expirado' and passo = 'D0' and dia < v_dia;

  -- Follow-ups devidos (D3, D7, D15 em outro canal, D21 encerramento)
  for s in select * from jsonb_array_elements(v_seq) loop
    for r in
      select f0.negocio_id, f0.pessoa_id, f0.empresa_id, f0.canal as canal0, f0.nota,
             c.pnome, c.instagram, c.email, c.linkedin, c.enome
        from auto_fila f0
        join crm_negocios n on n.id = f0.negocio_id and n.ativo
        join crm_etapas et on et.id = n.etapa_id and et.tipo = 'aberta' and et.nome not in ('Respondeu', 'Briefing', 'Aprovado', 'Proposta', 'Conversa', 'Negociação')
        left join lateral (
          select p.nome as pnome, coalesce(e.nome, '') as enome,
                 coalesce(nullif(p.instagram, ''), nullif(e.instagram, '')) as instagram,
                 nullif(p.email, '') as email,
                 coalesce(nullif(p.linkedin, ''), nullif(e.linkedin, '')) as linkedin
            from (select 1) x
            left join crm_pessoas p on p.id = f0.pessoa_id
            left join crm_empresas e on e.id = f0.empresa_id
        ) c on true
       where f0.passo = 'D0' and f0.status = 'enviado'
         and f0.enviado_em::date + (s->>'dias')::integer <= v_dia
         and not exists (select 1 from auto_fila x where x.negocio_id = f0.negocio_id and (x.status = 'respondeu' or x.motivo = 'parar'))
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
      -- No LinkedIn, D3 e D7 só depois de a pessoa aceitar o convite (a equipe registra a resposta)
      if v_canal = 'linkedin' and (s->>'passo') in ('D3', 'D7') then continue; end if;
      v_texto := auto_modelo(case when (s->>'passo') = 'D15' then 'D0' else s->>'passo' end, v_canal);
      continue when v_texto is null;
      select * into v_d from auto_destino(v_canal, r.instagram, r.email, r.linkedin);
      insert into auto_fila (dia, canal, passo, negocio_id, empresa_id, pessoa_id, nota, destino, link, assunto, mensagem, automatico)
      values (v_dia, v_canal, s->>'passo', r.negocio_id, r.empresa_id, r.pessoa_id, r.nota, v_d.destino, v_d.link,
              case when v_canal = 'email' then 'IA News · ' || coalesce(nullif(r.enome, ''), 'convite') end,
              auto_preencher(v_texto, r.pnome, r.enome),
              v_canal = 'email' and coalesce((auto_cfg('email_frio_ativo'))::text, 'false') = 'true')
      on conflict (negocio_id, passo) do nothing;
      n_follow := n_follow + 1;
    end loop;
  end loop;

  select jsonb_object_agg(k, greatest(0, coalesce((v_lim->>k)::integer, 0) -
           (select count(*) from auto_fila f where f.dia = v_dia and f.canal = k and f.passo = 'D0')))
    into v_resto
    from unnest(array['direct', 'email', 'linkedin']) k;

  -- Primeiros contatos, da maior nota para a menor, até acabar a vaga de cada canal
  for r in
    select c.* from auto_candidatos c
     where c.nota >= v_corte
       and (c.instagram is not null or c.email is not null or c.linkedin is not null)
       and not exists (select 1 from auto_fila f where f.negocio_id = c.negocio_id)
       and not exists (select 1 from auto_exclusoes x where x.pessoa_id = c.pessoa_id or x.empresa_id = c.empresa_id
                         or (x.instagram is not null and lower(x.instagram) = lower(c.instagram))
                         or (x.email is not null and lower(x.email) = lower(c.email)))
       and not exists (select 1 from crm_atividades a where a.tipo in ('mensagem_enviada', 'mensagem_recebida')
                         and (a.pessoa_id = c.pessoa_id or a.empresa_id = c.empresa_id or a.negocio_id = c.negocio_id)
                         and a.created_at >= now() - make_interval(days => v_reenvio))
     order by c.nota desc, c.via_empresa, c.noticia_recente_em desc nulls last, c.created_at
  loop
    v_canal := case
      when r.instagram is not null and (v_resto->>'direct')::integer > 0 then 'direct'
      when r.email is not null and (v_resto->>'email')::integer > 0 then 'email'
      when r.linkedin is not null and (v_resto->>'linkedin')::integer > 0 then 'linkedin'
      else null end;
    continue when v_canal is null;
    v_texto := case when r.virou_pauta and v_canal = 'direct' then auto_modelo('D0_pauta', v_canal) end;
    v_texto := coalesce(v_texto, auto_modelo('D0', v_canal));
    continue when v_texto is null;
    select * into v_d from auto_destino(v_canal, r.instagram, r.email, r.linkedin);
    insert into auto_fila (dia, canal, passo, negocio_id, empresa_id, pessoa_id, nota, destino, link, assunto, mensagem, automatico, motivo)
    values (v_dia, v_canal, 'D0', r.negocio_id, r.empresa_id, r.pessoa_id, r.nota, v_d.destino, v_d.link,
            case when v_canal = 'email' then 'IA News · convite para a ' || coalesce(nullif(r.enome, ''), 'sua empresa') end,
            auto_preencher(v_texto, r.pnome, r.enome),
            v_canal = 'email' and coalesce((auto_cfg('email_frio_ativo'))::text, 'false') = 'true',
            case when r.via_empresa and v_canal = 'direct' then 'perfil da empresa: peça o contato do fundador' end)
    on conflict (negocio_id, passo) do nothing;
    v_resto := jsonb_set(v_resto, array[v_canal], to_jsonb((v_resto->>v_canal)::integer - 1));
    n_d0 := n_d0 + 1;
    exit when (v_resto->>'direct')::integer <= 0 and (v_resto->>'email')::integer <= 0 and (v_resto->>'linkedin')::integer <= 0;
  end loop;

  return jsonb_build_object('ok', true, 'dia', v_dia, 'primeiros_contatos', n_d0, 'follow_ups', n_follow,
                            'expirados', n_exp, 'vagas_restantes', v_resto);
end $$;

-- Painel: elegíveis passam a contar pela mesma regra da fila
create or replace function public.auto_elegiveis()
returns integer language sql stable security definer set search_path = public as $$
  select count(*)::integer from auto_candidatos c
   where c.nota >= coalesce((auto_cfg('nota_corte'))::text::integer, 50)
     and (c.instagram is not null or c.email is not null or c.linkedin is not null)
     and not exists (select 1 from auto_fila f where f.negocio_id = c.negocio_id)
     and not exists (select 1 from crm_atividades a where a.tipo in ('mensagem_enviada', 'mensagem_recebida')
                       and (a.pessoa_id = c.pessoa_id or a.empresa_id = c.empresa_id or a.negocio_id = c.negocio_id)
                       and a.created_at >= now() - interval '90 days');
$$;
revoke execute on function public.auto_elegiveis() from public, anon;
grant execute on function public.auto_elegiveis() to authenticated, service_role;
revoke all on public.auto_candidatos from anon;
