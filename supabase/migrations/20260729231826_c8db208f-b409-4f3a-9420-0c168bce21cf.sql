
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  is_first boolean;
begin
  insert into public.profiles (user_id, full_name, email, phone)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'full_name', ''),
    coalesce(new.email, ''),
    nullif(new.raw_user_meta_data ->> 'phone', '')
  )
  on conflict do nothing;

  select not exists (select 1 from public.user_roles) into is_first;

  insert into public.user_roles (user_id, role)
  values (new.id, case when is_first then 'admin'::public.app_role else 'reader'::public.app_role end)
  on conflict do nothing;

  return new;
end;
$$;

revoke execute on function public.handle_new_user() from anon, authenticated, public;
