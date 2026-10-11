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
-- and the same for functions: a new function can be called by the signed-out role unless the migration revokes that.
alter default privileges in schema public grant all on functions to anon, authenticated, service_role;

-- Supabase Storage: the two tables and the helper the policies use. Real Storage keeps the file itself outside the
-- database, so deleting a storage.objects row with SQL leaves the file behind; the tests only see the rows.
create schema storage;
create table storage.buckets (
  id text primary key,
  name text not null unique,
  public boolean default false,
  file_size_limit bigint,
  allowed_mime_types text[]
);
create table storage.objects (
  id uuid primary key default gen_random_uuid(),
  bucket_id text references storage.buckets (id),
  name text,
  owner_id text,
  created_at timestamptz default now(),
  unique (bucket_id, name)
);
alter table storage.objects enable row level security;
create function storage.foldername(name text) returns text[] language plpgsql as $$
declare _parts text[];
begin
  select string_to_array(name, '/') into _parts;
  return _parts[1:array_length(_parts, 1) - 1];
end
$$;
grant usage on schema storage to anon, authenticated, service_role;
grant all on all tables in schema storage to anon, authenticated, service_role;
