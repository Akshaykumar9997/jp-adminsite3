do $block$
begin
  if not exists (select 1 from pg_roles where rolname = 'anon') then create role anon nologin; end if;
  if not exists (select 1 from pg_roles where rolname = 'authenticated') then create role authenticated nologin; end if;
  if not exists (select 1 from pg_roles where rolname = 'service_role') then create role service_role nologin bypassrls; end if;
end
$block$;
create schema auth;
create schema identity;
create schema crm;
create schema catalog;
create schema quoting;
create schema projects;
create schema workforce;
create schema storage;
create schema supabase_migrations;

create function auth.uid() returns uuid language sql stable set search_path = '' as $$
  select (nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'sub')::uuid
$$;
grant usage on schema auth to anon, authenticated, service_role;
grant execute on function auth.uid() to anon, authenticated, service_role;
create table identity.profiles(id uuid primary key, role text not null, access_revoked_at timestamptz);
create function public.is_admin() returns boolean language sql stable security definer set search_path = '' as $$
  select exists (select 1 from identity.profiles where id = auth.uid() and role = 'admin' and access_revoked_at is null)
$$;
revoke all on function public.is_admin() from public, anon;
grant execute on function public.is_admin() to authenticated;

create table storage.buckets(id text primary key, name text not null, public boolean not null default false);
create table storage.objects(id uuid primary key default gen_random_uuid(), bucket_id text not null references storage.buckets(id), name text not null);
alter table storage.objects enable row level security;
grant usage on schema storage to anon, authenticated, service_role;
grant select, insert, update, delete on storage.objects to anon, authenticated;
insert into storage.buckets values ('existing-business-bucket','existing-business-bucket',false), ('showcase-media','showcase-media',false);
create policy existing_business_storage_policy on storage.objects for select to authenticated using (bucket_id = 'existing-business-bucket');

create table supabase_migrations.schema_migrations(version text primary key);
insert into supabase_migrations.schema_migrations values ('existing_001'), ('existing_002');

create table crm.sentinel(id integer primary key);
alter table crm.sentinel enable row level security;
grant usage on schema crm to authenticated;
grant select on crm.sentinel to authenticated;
create policy existing_crm_policy on crm.sentinel for select to authenticated using (true);
