-- LOCAL TESTING ONLY. Recreates the small part of a Supabase project that the migrations rely on
-- (roles, auth.uid(), auth.users, storage tables, Supabase's default table grants) so the migrations and
-- tests can run against a throwaway Postgres. Never run this against a real Supabase project.
-- roles are cluster-wide, so create them only when missing (lets this file be re-run on a fresh database)
do $$ begin
  if not exists (select 1 from pg_roles where rolname = 'anon') then create role anon nologin; end if;
  if not exists (select 1 from pg_roles where rolname = 'authenticated') then create role authenticated nologin; end if;
  if not exists (select 1 from pg_roles where rolname = 'service_role') then create role service_role nologin bypassrls; end if;
end $$;

create schema auth;
create table auth.users (
  id uuid primary key default gen_random_uuid(),
  email text,
  email_confirmed_at timestamptz
);
create function auth.uid() returns uuid language sql stable as
  $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;

create schema storage;
create table storage.buckets (id text primary key, name text, public boolean, file_size_limit bigint, allowed_mime_types text[]);
create table storage.objects (id uuid primary key default gen_random_uuid(), bucket_id text, name text);
alter table storage.objects enable row level security;

grant usage on schema public, auth, storage to anon, authenticated, service_role;
-- Supabase gives its API roles broad default privileges on new tables; the migrations must narrow them.
alter default privileges in schema public grant all on tables to anon, authenticated, service_role;
grant all on all tables in schema storage to anon, authenticated, service_role;
