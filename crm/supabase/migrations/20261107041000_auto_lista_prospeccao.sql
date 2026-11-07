-- Lista diária: bloco de prospecção (fundadores sem menção) e nota mínima própria da lista.
insert into public.auto_config (chave, valor, descricao) values
  ('lista_nota_minima', '40', 'Nota mínima para entrar na lista diária (a fila usa nota_corte)')
on conflict (chave) do nothing;
update public.auto_config set valor = '{"quentes":40,"pauta":40,"prospeccao":40,"inbound":20,"publicidade":30,"parcerias":10,"radar":20}'
 where chave = 'lista_blocos';

create or replace function public.auto_montar_lista(p_dia date default null)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_dia date := coalesce(p_dia, crm_hoje());
  v_total integer := coalesce((auto_cfg('lista_tamanho'))::text::integer, 200);
  v_blocos jsonb := coalesce(auto_cfg('lista_blocos'), '{}'::jsonb);
  v_corte integer := coalesce((auto_cfg('nota_corte'))::text::integer, 50);
  v_reenvio integer := coalesce((auto_cfg('reenvio_minimo_dias'))::text::integer, 90);
  v_abrir boolean := coalesce((auto_cfg('lista_abrir_negocios_radar'))::text, 'true') = 'true';
  v_minima integer := coalesce((auto_cfg('lista_nota_minima'))::text::integer, 40);
  v_etapa uuid := (select id from crm_etapas where funil_id = 'materia' and nome = 'Novo');
  v_pos integer := 0;
  v_vaga integer;
  r record;
  v_neg uuid;
  n_blocos jsonb := '{}'::jsonb;
begin
  if auth.uid() is not null and not crm_tem_acesso() then
    raise exception 'Acesso restrito à equipe do CRM.';
  end if;
  delete from auto_lista_diaria where dia = v_dia and status = 'listado';

  -- Bloco 1 · Quentes: respondeu nos últimos 10 dias, ação prevista até hoje, briefing/prévia aguardando
  v_vaga := coalesce((v_blocos->>'quentes')::integer, 40);
  for r in
    select n.id as negocio_id, n.funil_id, n.empresa_id, n.pessoa_id, c.nota,
           case when b.status in ('enviado', 'em_producao') then 'Briefing recebido: produzir e enviar a prévia'
                when b.status = 'previa' then 'Prévia enviada: cobrar a aprovação'
                when b.status = 'aberto' and b.enviado_em is null then 'Briefing aberto: lembrar de preencher'
                when n.proxima_acao_em <= v_dia then coalesce('Ação prevista: ' || n.proxima_acao, 'Ação prevista para hoje')
                else 'Respondeu há pouco: continuar a conversa' end as motivo,
           case when p.whatsapp is not null then 'whatsapp' when p.instagram is not null then 'direct'
                when p.email is not null then 'email' else 'linkedin' end as canal
      from crm_negocios n
      join crm_etapas et on et.id = n.etapa_id and et.tipo = 'aberta'
      left join crm_pessoas p on p.id = n.pessoa_id
      left join auto_briefings b on b.negocio_id = n.id
      left join lateral (select nota from auto_candidatos c where c.negocio_id = n.id limit 1) c on true
     where n.ativo
       and (n.proxima_acao_em <= v_dia
            or b.status in ('enviado', 'em_producao', 'previa')
            or (b.status = 'aberto' and b.created_at < now() - interval '2 days')
            or exists (select 1 from crm_atividades a where a.tipo = 'mensagem_recebida' and a.negocio_id = n.id
                         and a.created_at >= now() - interval '10 days'))
       and not exists (select 1 from auto_exclusoes x where x.pessoa_id = n.pessoa_id or x.empresa_id = n.empresa_id)
     order by (b.status in ('enviado', 'em_producao')) desc, n.proxima_acao_em nulls last, n.updated_at desc
     limit v_vaga
  loop
    v_pos := v_pos + 1;
    insert into auto_lista_diaria (dia, posicao, prioridade, bloco, funil_id, negocio_id, empresa_id, pessoa_id, nota, canal, motivo)
    values (v_dia, v_pos, 1, 'Quentes', r.funil_id, r.negocio_id, r.empresa_id, r.pessoa_id, r.nota, r.canal, r.motivo)
    on conflict (dia, negocio_id) do nothing;
  end loop;
  n_blocos := n_blocos || jsonb_build_object('quentes', v_pos);

  -- Bloco 2 · Virou pauta: protagonistas das matérias, ainda sem contato (oferta de cortesia/destaque)
  v_vaga := coalesce((v_blocos->>'pauta')::integer, 60) + greatest(0, coalesce((v_blocos->>'quentes')::integer, 40) - v_pos);
  for r in
    select c.negocio_id, c.funil_id, c.empresa_id, c.pessoa_id, c.nota,
           'Citada em matéria da IA News em ' || to_char(c.noticia_recente_em, 'DD/MM') || ': oferecer destaque' as motivo,
           case when c.instagram is not null then 'direct' when c.email is not null then 'email' else 'linkedin' end as canal
      from auto_candidatos c
     where c.funil_id = 'materia' and c.virou_pauta and c.nota >= v_minima
       and (c.instagram is not null or c.email is not null or c.linkedin is not null)
       and not exists (select 1 from auto_lista_diaria l where l.dia = v_dia and l.negocio_id = c.negocio_id)
       and not exists (select 1 from auto_fila f where f.negocio_id = c.negocio_id and f.status in ('pendente', 'enviado', 'respondeu'))
       and not exists (select 1 from auto_exclusoes x where x.pessoa_id = c.pessoa_id or x.empresa_id = c.empresa_id)
       and coalesce(auto_ultimo_contato(c.negocio_id, c.pessoa_id, c.empresa_id), '2000-01-01') < now() - make_interval(days => v_reenvio)
     order by c.nota desc, c.noticia_recente_em desc nulls last, c.created_at desc
     limit v_vaga
  loop
    v_pos := v_pos + 1;
    insert into auto_lista_diaria (dia, posicao, prioridade, bloco, funil_id, negocio_id, empresa_id, pessoa_id, nota, canal, motivo)
    values (v_dia, v_pos, 2, 'Virou pauta', r.funil_id, r.negocio_id, r.empresa_id, r.pessoa_id, r.nota, r.canal, r.motivo)
    on conflict (dia, negocio_id) do nothing;
  end loop;
  n_blocos := n_blocos || jsonb_build_object('pauta', v_pos - (n_blocos->>'quentes')::integer);

  -- Bloco 2b · Prospecção: funil de matéria sem menção (listas de fundadores), da maior nota para a menor
  v_vaga := coalesce((v_blocos->>'prospeccao')::integer, 40) + greatest(0, v_vaga - (n_blocos->>'pauta')::integer);
  for r in
    select c.negocio_id, c.funil_id, c.empresa_id, c.pessoa_id, c.nota,
           'Prospecção (nota ' || c.nota || coalesce(', ' || nullif(c.enome, ''), '') || '): oferecer destaque' as motivo,
           case when c.instagram is not null then 'direct' when c.email is not null then 'email' else 'linkedin' end as canal
      from auto_candidatos c
     where c.funil_id = 'materia' and not c.virou_pauta and c.nota >= v_minima
       and (c.instagram is not null or c.email is not null or c.linkedin is not null)
       and not exists (select 1 from auto_lista_diaria l where l.dia = v_dia and l.negocio_id = c.negocio_id)
       and not exists (select 1 from auto_fila f where f.negocio_id = c.negocio_id and f.status in ('pendente', 'enviado', 'respondeu'))
       and not exists (select 1 from auto_exclusoes x where x.pessoa_id = c.pessoa_id or x.empresa_id = c.empresa_id)
       and coalesce(auto_ultimo_contato(c.negocio_id, c.pessoa_id, c.empresa_id), '2000-01-01') < now() - make_interval(days => v_reenvio)
     order by c.nota desc, c.created_at desc
     limit v_vaga
  loop
    v_pos := v_pos + 1;
    insert into auto_lista_diaria (dia, posicao, prioridade, bloco, funil_id, negocio_id, empresa_id, pessoa_id, nota, canal, motivo)
    values (v_dia, v_pos, 2, 'Prospecção', r.funil_id, r.negocio_id, r.empresa_id, r.pessoa_id, r.nota, r.canal, r.motivo)
    on conflict (dia, negocio_id) do nothing;
  end loop;

  -- Bloco 3 · Inbound: veio pelo site (formulário de pauta, contato, newsletter) e ainda não foi respondido
  v_vaga := coalesce((v_blocos->>'inbound')::integer, 20);
  for r in
    select n.id as negocio_id, n.funil_id, n.empresa_id, n.pessoa_id, c.nota,
           case when n.pauta_lead_id is not null then 'Pediu pauta pelo site'
                when n.contact_message_id is not null then 'Mandou mensagem pelo site'
                else 'Veio da newsletter' end || ': responder hoje' as motivo,
           case when p.whatsapp is not null then 'whatsapp' when p.email is not null then 'email'
                when p.instagram is not null then 'direct' else 'linkedin' end as canal
      from crm_negocios n
      join crm_etapas et on et.id = n.etapa_id and et.tipo = 'aberta' and et.ordem <= 2
      left join crm_pessoas p on p.id = n.pessoa_id
      left join lateral (select nota from auto_candidatos c where c.negocio_id = n.id limit 1) c on true
     where n.ativo and (n.pauta_lead_id is not null or n.contact_message_id is not null or n.origem in ('newsletter', 'site', 'formulario'))
       and not exists (select 1 from crm_atividades a where a.tipo = 'mensagem_enviada' and a.negocio_id = n.id)
       and not exists (select 1 from auto_lista_diaria l where l.dia = v_dia and l.negocio_id = n.id)
       and not exists (select 1 from auto_exclusoes x where x.pessoa_id = n.pessoa_id or x.empresa_id = n.empresa_id)
     order by n.created_at desc
     limit v_vaga
  loop
    v_pos := v_pos + 1;
    insert into auto_lista_diaria (dia, posicao, prioridade, bloco, funil_id, negocio_id, empresa_id, pessoa_id, nota, canal, motivo)
    values (v_dia, v_pos, 3, 'Inbound', r.funil_id, r.negocio_id, r.empresa_id, r.pessoa_id, r.nota, r.canal, r.motivo)
    on conflict (dia, negocio_id) do nothing;
  end loop;

  -- Bloco 4 · Publicidade: funil de publicidade, sem contato recente
  v_vaga := coalesce((v_blocos->>'publicidade')::integer, 30);
  for r in
    select c.negocio_id, c.funil_id, c.empresa_id, c.pessoa_id, c.nota,
           'Potencial anunciante (' || coalesce(e.setor, 'setor não informado') || '): enviar mídia kit' as motivo,
           case when c.email is not null then 'email' when c.linkedin is not null then 'linkedin' else 'direct' end as canal
      from auto_candidatos c
      left join crm_empresas e on e.id = c.empresa_id
     where c.funil_id = 'publicidade' and c.nota >= v_minima
       and (c.instagram is not null or c.email is not null or c.linkedin is not null)
       and not exists (select 1 from auto_lista_diaria l where l.dia = v_dia and l.negocio_id = c.negocio_id)
       and not exists (select 1 from auto_fila f where f.negocio_id = c.negocio_id and f.status in ('pendente', 'enviado', 'respondeu'))
       and not exists (select 1 from auto_exclusoes x where x.pessoa_id = c.pessoa_id or x.empresa_id = c.empresa_id)
       and coalesce(auto_ultimo_contato(c.negocio_id, c.pessoa_id, c.empresa_id), '2000-01-01') < now() - make_interval(days => v_reenvio)
     order by c.nota desc, c.created_at desc
     limit v_vaga
  loop
    v_pos := v_pos + 1;
    insert into auto_lista_diaria (dia, posicao, prioridade, bloco, funil_id, negocio_id, empresa_id, pessoa_id, nota, canal, motivo)
    values (v_dia, v_pos, 4, 'Publicidade', r.funil_id, r.negocio_id, r.empresa_id, r.pessoa_id, r.nota, r.canal, r.motivo)
    on conflict (dia, negocio_id) do nothing;
  end loop;

  -- Bloco 5 · Parcerias: funil de parcerias na primeira etapa
  v_vaga := coalesce((v_blocos->>'parcerias')::integer, 10);
  for r in
    select n.id as negocio_id, n.funil_id, n.empresa_id, n.pessoa_id, e.pontuacao as nota,
           'Parceria identificada: primeiro contato' as motivo,
           case when p.email is not null then 'email' when p.instagram is not null or e.instagram is not null then 'direct' else 'linkedin' end as canal
      from crm_negocios n
      join crm_etapas et on et.id = n.etapa_id and et.tipo = 'aberta' and et.ordem = 1
      left join crm_empresas e on e.id = n.empresa_id
      left join crm_pessoas p on p.id = n.pessoa_id
     where n.ativo and n.funil_id = 'parcerias'
       and not exists (select 1 from crm_atividades a where a.tipo = 'mensagem_enviada' and a.negocio_id = n.id and a.created_at > now() - make_interval(days => v_reenvio))
       and not exists (select 1 from auto_lista_diaria l where l.dia = v_dia and l.negocio_id = n.id)
     order by e.pontuacao desc nulls last, n.created_at desc
     limit v_vaga
  loop
    v_pos := v_pos + 1;
    insert into auto_lista_diaria (dia, posicao, prioridade, bloco, funil_id, negocio_id, empresa_id, pessoa_id, nota, canal, motivo)
    values (v_dia, v_pos, 5, 'Parcerias', r.funil_id, r.negocio_id, r.empresa_id, r.pessoa_id, r.nota, r.canal, r.motivo)
    on conflict (dia, negocio_id) do nothing;
  end loop;

  -- Bloco 6 · Radar: completa até o total com empresas brasileiras do banco sem negócio aberto e com contato
  v_vaga := greatest(0, v_total - v_pos);
  for r in
    select e.id as empresa_id, e.pontuacao as nota, e.nome,
           p.id as pessoa_id,
           'Radar (grupo ' || coalesce(e.grupo, '-') || ', ' || coalesce(e.setor, 'setor não informado') || '): abrir conversa' as motivo,
           case when coalesce(p.instagram, e.instagram) is not null then 'direct'
                when coalesce(p.email, '') <> '' then 'email' else 'linkedin' end as canal
      from crm_empresas e
      left join lateral (
        select p1.* from crm_pessoas p1 join crm_empresa_pessoas ep on ep.pessoa_id = p1.id
         where ep.empresa_id = e.id and p1.ativo order by ep.decisor desc nulls last, p1.created_at limit 1
      ) p on true
     where e.ativo and coalesce(e.brasileira, true) and not e.e_cliente and not e.e_anunciante
       and coalesce(e.pontuacao, 0) >= v_minima
       and (coalesce(e.instagram, '') <> '' or coalesce(e.linkedin, '') <> '' or coalesce(p.instagram, '') <> '' or coalesce(p.email, '') <> '')
       and not exists (select 1 from crm_negocios n join crm_etapas et on et.id = n.etapa_id
                        where n.empresa_id = e.id and n.ativo and et.tipo = 'aberta')
       and not exists (select 1 from auto_exclusoes x where x.empresa_id = e.id or (p.id is not null and x.pessoa_id = p.id))
       and coalesce(auto_ultimo_contato(null, p.id, e.id), '2000-01-01') < now() - make_interval(days => v_reenvio)
     order by e.pontuacao desc, e.noticia_recente_em desc nulls last, e.created_at desc
     limit v_vaga
  loop
    v_neg := null;
    if v_abrir and v_etapa is not null then
      insert into crm_negocios (titulo, funil_id, etapa_id, etapa_desde, empresa_id, pessoa_id, tipo, origem, canal_origem, ativo)
      values ('Radar · ' || r.nome, 'materia', v_etapa, now(), r.empresa_id, r.pessoa_id, 'destaque_cortesia', 'radar', 'crm', true)
      returning id into v_neg;
    end if;
    v_pos := v_pos + 1;
    insert into auto_lista_diaria (dia, posicao, prioridade, bloco, funil_id, negocio_id, empresa_id, pessoa_id, nota, canal, motivo)
    values (v_dia, v_pos, 6, 'Radar', 'materia', v_neg, r.empresa_id, r.pessoa_id, r.nota, r.canal, r.motivo);
  end loop;

  return jsonb_build_object('ok', true, 'dia', v_dia, 'total', v_pos, 'blocos',
    (select jsonb_object_agg(bloco, n) from (select bloco, count(*) n from auto_lista_diaria where dia = v_dia group by bloco) b));
end $$;

