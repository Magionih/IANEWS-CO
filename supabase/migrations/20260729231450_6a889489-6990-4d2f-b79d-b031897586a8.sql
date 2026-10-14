
-- 1. Roles
create type public.app_role as enum ('admin', 'editor', 'reader');

create table public.user_roles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  role public.app_role not null default 'reader',
  created_at timestamptz not null default now(),
  unique (user_id, role)
);

grant select on public.user_roles to authenticated;
grant all on public.user_roles to service_role;

alter table public.user_roles enable row level security;

create or replace function public.has_role(_user_id uuid, _role public.app_role)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.user_roles where user_id = _user_id and role = _role
  )
$$;

create policy "Users read own roles" on public.user_roles
for select to authenticated using (auth.uid() = user_id);

create policy "Admins read all roles" on public.user_roles
for select to authenticated using (public.has_role(auth.uid(), 'admin'));

create policy "Admins manage roles" on public.user_roles
for all to authenticated
using (public.has_role(auth.uid(), 'admin'))
with check (public.has_role(auth.uid(), 'admin'));

-- 2. Auto-create profile + reader role on signup
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
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
  values (new.id, 'reader')
  on conflict do nothing;

  return new;
end;
$$;

create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_user();

-- 3. Admin access across app tables
create policy "Admins read all profiles" on public.profiles
for select to authenticated using (public.has_role(auth.uid(), 'admin'));

create policy "Admins update all profiles" on public.profiles
for update to authenticated
using (public.has_role(auth.uid(), 'admin'))
with check (public.has_role(auth.uid(), 'admin'));

create policy "Admins read all reading events" on public.reading_events
for select to authenticated using (public.has_role(auth.uid(), 'admin'));

create policy "Admins read all goals" on public.reading_goals
for select to authenticated using (public.has_role(auth.uid(), 'admin'));

grant select, insert, update, delete on public.articles to authenticated;

create policy "Admins insert articles" on public.articles
for insert to authenticated with check (public.has_role(auth.uid(), 'admin') or public.has_role(auth.uid(), 'editor'));

create policy "Admins update articles" on public.articles
for update to authenticated
using (public.has_role(auth.uid(), 'admin') or public.has_role(auth.uid(), 'editor'))
with check (public.has_role(auth.uid(), 'admin') or public.has_role(auth.uid(), 'editor'));

create policy "Admins delete articles" on public.articles
for delete to authenticated using (public.has_role(auth.uid(), 'admin'));

grant select on public.ingest_runs to authenticated;

create policy "Admins read ingest runs" on public.ingest_runs
for select to authenticated using (public.has_role(auth.uid(), 'admin'));
