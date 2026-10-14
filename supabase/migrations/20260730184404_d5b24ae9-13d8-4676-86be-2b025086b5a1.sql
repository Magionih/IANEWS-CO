-- 1. Somente a conta magionih@gmail.com pode ser administradora
DELETE FROM public.user_roles ur
USING auth.users u
WHERE ur.user_id = u.id
  AND ur.role = 'admin'
  AND lower(u.email) <> 'magionih@gmail.com';

INSERT INTO public.user_roles (user_id, role)
SELECT u.id, 'admin'::public.app_role
FROM auth.users u
WHERE lower(u.email) = 'magionih@gmail.com'
ON CONFLICT DO NOTHING;

-- 2. Novos cadastros nunca recebem admin automaticamente
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
begin
  insert into public.profiles (user_id, full_name, email, phone)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'full_name', ''),
    coalesce(new.email, ''),
    nullif(new.raw_user_meta_data ->> 'phone', '')
  )
  on conflict do nothing;

  insert into public.user_roles (user_id, role)
  values (
    new.id,
    case when lower(coalesce(new.email, '')) = 'magionih@gmail.com'
      then 'admin'::public.app_role
      else 'reader'::public.app_role
    end
  )
  on conflict do nothing;

  return new;
end;
$function$;

-- 3. Trava no banco: qualquer tentativa de conceder admin a outra conta é bloqueada
CREATE OR REPLACE FUNCTION public.enforce_single_admin()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
declare
  target_email text;
begin
  if new.role = 'admin'::public.app_role then
    select lower(email) into target_email from auth.users where id = new.user_id;
    if target_email is distinct from 'magionih@gmail.com' then
      raise exception 'Apenas a conta magionih@gmail.com pode ter acesso administrativo.';
    end if;
  end if;
  return new;
end;
$function$;

DROP TRIGGER IF EXISTS enforce_single_admin_trg ON public.user_roles;
CREATE TRIGGER enforce_single_admin_trg
BEFORE INSERT OR UPDATE ON public.user_roles
FOR EACH ROW EXECUTE FUNCTION public.enforce_single_admin();