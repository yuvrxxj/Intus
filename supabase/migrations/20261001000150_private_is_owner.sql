-- Move is_owner() out of the API-exposed "public" schema into "private", so it cannot be called
-- through /rest/v1/rpc. Row-level security policies can still call it.

create schema if not exists private;
grant usage on schema private to authenticated;

create or replace function private.is_owner()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.app_owner where user_id = (select auth.uid())
  );
$$;

revoke all on function private.is_owner() from public, anon;
grant execute on function private.is_owner() to authenticated;

drop function if exists public.is_owner();
