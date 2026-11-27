-- Chaves do push do CRM (VAPID) guardadas no cofre do banco (Vault).
-- O servidor do site cria o par na primeira entrega e reaproveita depois; só o servidor lê.
create or replace function public.crm_push_chaves()
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $$
declare v_pub text; v_priv text;
begin
  select decrypted_secret into v_pub from vault.decrypted_secrets where name = 'crm_vapid_publica';
  select decrypted_secret into v_priv from vault.decrypted_secrets where name = 'crm_vapid_privada';
  if v_pub is null or v_priv is null then
    return null;
  end if;
  return jsonb_build_object('publica', v_pub, 'privada', v_priv);
end $$;
revoke all on function public.crm_push_chaves() from public, anon, authenticated;

create or replace function public.crm_push_chaves_guardar(p_publica text, p_privada text)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $$
begin
  if coalesce(p_publica, '') !~ '^[A-Za-z0-9_-]{80,100}$'
     or coalesce(p_privada, '') !~ '^[A-Za-z0-9_-]{150,260}$' then
    raise exception 'Chaves inválidas.';
  end if;
  -- Duas entregas ao mesmo tempo: só a primeira grava; a outra recebe o par já guardado.
  perform pg_advisory_xact_lock(hashtext('crm_vapid'));
  if not exists (select 1 from vault.secrets where name = 'crm_vapid_publica') then
    perform vault.create_secret(p_publica, 'crm_vapid_publica', 'Chave pública VAPID do push do CRM');
    perform vault.create_secret(p_privada, 'crm_vapid_privada', 'Chave privada VAPID do push do CRM');
  end if;
  return crm_push_chaves();
end $$;
revoke all on function public.crm_push_chaves_guardar(text, text) from public, anon, authenticated;
