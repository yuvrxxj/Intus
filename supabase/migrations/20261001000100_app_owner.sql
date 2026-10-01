-- Step 1 of 2: record who owns the data. Additive only, changes no existing access.
--
-- app_owner holds the user ids allowed to read and write health data. Nobody can reach the table
-- through the API (RLS on, no policies). The only way in is private.is_owner() (see the next migration), which answers true or false
-- for the signed-in user.

create table if not exists public.app_owner (
  user_id uuid primary key references auth.users (id) on delete cascade,
  created_at timestamptz not null default now()
);

alter table public.app_owner enable row level security;
revoke all on table public.app_owner from anon, authenticated;

create or replace function public.is_owner()
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

revoke all on function public.is_owner() from public, anon;
grant execute on function public.is_owner() to authenticated;
