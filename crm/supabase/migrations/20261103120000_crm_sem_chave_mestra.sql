-- CRM sem chave mestra: o site do CRM só usa a chave pública do Supabase.
-- O que antes exigia a service role passa a ser feito por funções do banco, com checagem de papel:
--   * crm_usuarios / crm_definir_papel: Configuração → Usuários e papéis (só admin);
--   * crm_newsletter_da_pessoa: dados da newsletter na ficha da pessoa (equipe do CRM);
--   * a rotina diária (lead aquecido e "Sem resposta") roda no próprio banco pelo pg_cron.

create or replace function public.crm_usuarios()
returns table (user_id uuid, nome text, email text, papeis text[], created_at timestamptz)
language plpgsql stable security definer set search_path = public as $$
begin
  if not crm_e_admin() then
    raise exception 'Só o administrador pode ver as contas.';
  end if;
  return query
    select u.id,
           coalesce(nullif(pr.full_name, ''), nullif(u.raw_user_meta_data->>'full_name', ''), split_part(u.email, '@', 1))::text,
           u.email::text,
           coalesce(array_agg(r.role::text order by r.role::text) filter (where r.role is not null), array['reader']),
           u.created_at
      from auth.users u
      left join user_roles r on r.user_id = u.id
      left join profiles pr on pr.user_id = u.id
     group by u.id, pr.full_name, u.raw_user_meta_data, u.email, u.created_at
     order by u.created_at desc;
end $$;

create or replace function public.crm_definir_papel(p_user uuid, p_papel text)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not crm_e_admin() then
    raise exception 'Só o administrador pode mudar papéis.';
  end if;
  if p_papel not in ('admin', 'comercial', 'editorial', 'reader') then
    raise exception 'Papel inválido.';
  end if;
  if p_user = auth.uid() and p_papel <> 'admin' then
    raise exception 'Você não pode remover seu próprio acesso de administrador.';
  end if;
  if not exists (select 1 from auth.users where id = p_user) then
    raise exception 'Conta não encontrada.';
  end if;
  delete from user_roles where user_id = p_user;
  insert into user_roles (user_id, role) values (p_user, p_papel::app_role);
end $$;

create or replace function public.crm_newsletter_da_pessoa(p_pessoa uuid)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare res jsonb;
begin
  if not crm_tem_acesso() then
    raise exception 'Acesso restrito à equipe do CRM.';
  end if;
  select jsonb_build_object('email', l.email, 'is_active', l.is_active, 'confirmed_at', l.confirmed_at,
                            'source', l.source, 'created_at', l.created_at)
    into res
    from crm_pessoas p join leads l on l.id = p.newsletter_lead_id
   where p.id = p_pessoa;
  return res;
end $$;

revoke execute on function public.crm_usuarios() from public, anon;
revoke execute on function public.crm_definir_papel(uuid, text) from public, anon;
revoke execute on function public.crm_newsletter_da_pessoa(uuid) from public, anon;
grant execute on function public.crm_usuarios() to authenticated, service_role;
grant execute on function public.crm_definir_papel(uuid, text) to authenticated, service_role;
grant execute on function public.crm_newsletter_da_pessoa(uuid) to authenticated, service_role;

-- Rotina diária no banco: 10:50 UTC (7h50 em Brasília), antes do e-mail das 8h.
select cron.schedule('ianews-crm-rotina-diaria', '50 10 * * *', $$select public.crm_rotina_diaria()$$);
