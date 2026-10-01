-- The parts of a Supabase project the policies depend on: the API roles, auth.users and auth.uid().
-- PostgREST sets request.jwt.claim.sub from the caller's token, and auth.uid() reads it back.
create role anon nologin;
create role authenticated nologin;
create role service_role nologin bypassrls;

create schema auth;
create table auth.users (id uuid primary key default gen_random_uuid(), email text unique);
create function auth.uid() returns uuid language sql stable
  as $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;

grant usage on schema public, auth to anon, authenticated, service_role;
-- Supabase hands every API role full table privileges and relies on row level security.
alter default privileges in schema public grant all on tables to anon, authenticated, service_role;
