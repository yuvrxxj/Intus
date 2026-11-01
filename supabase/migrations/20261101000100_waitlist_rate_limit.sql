-- Shared rate limit for the waitlist function (INT-152). The function used to count joins in memory, one count per
-- edge instance, so a burst that landed on several instances slipped past the limit (seven joins in a minute were all
-- accepted on the live function). The count now lives here, so every instance sees the same one.
--
-- waitlist_attempts holds one row per allowed attempt, keyed by a SHA-256 hash the function computes from the caller's
-- address and a server-side secret. The raw address is never sent to the database. Rows older than the window are
-- deleted on each call, so the table stays tiny.
--
-- waitlist_allow_join(key, limit, window) answers true and records the attempt, or false and records nothing (a
-- refused caller does not extend their own lockout). A transaction-scoped advisory lock on the key makes the
-- count-then-insert atomic, so two calls at the same instant cannot both take the last slot. p_now exists so the tests
-- can move the clock; the function always passes the default (now()).
--
-- Row level security is forced and there is no policy; only the service role can touch the table or call the function.
--
-- Safe to run twice.

create table if not exists public.waitlist_attempts (
  id bigint generated always as identity primary key,
  key_hash text not null check (key_hash ~ '^[0-9a-f]{64}$'),
  attempted_at timestamptz not null default now()
);

create index if not exists waitlist_attempts_key_idx on public.waitlist_attempts (key_hash, attempted_at);
create index if not exists waitlist_attempts_at_idx on public.waitlist_attempts (attempted_at);

alter table public.waitlist_attempts enable row level security;
alter table public.waitlist_attempts force row level security;

revoke all on table public.waitlist_attempts from public, anon, authenticated;
grant select, insert, delete on table public.waitlist_attempts to service_role;

create or replace function public.waitlist_allow_join(
  p_key_hash text,
  p_limit integer,
  p_window_seconds integer,
  p_now timestamptz default now()
) returns boolean
language plpgsql
set search_path = public, pg_temp
as $$
declare
  recent integer;
begin
  if p_key_hash is null or p_key_hash !~ '^[0-9a-f]{64}$' or p_limit < 1 or p_window_seconds < 1 then
    raise exception 'waitlist_allow_join: bad arguments' using errcode = 'invalid_parameter_value';
  end if;

  -- One caller at a time per key, until this transaction ends.
  perform pg_advisory_xact_lock(hashtextextended(p_key_hash, 0));

  -- Forget everything outside the window, for every key.
  delete from public.waitlist_attempts
  where attempted_at <= p_now - make_interval(secs => p_window_seconds);

  select count(*) into recent from public.waitlist_attempts where key_hash = p_key_hash;
  if recent >= p_limit then
    return false;
  end if;

  insert into public.waitlist_attempts (key_hash, attempted_at) values (p_key_hash, p_now);
  return true;
end;
$$;

revoke all on function public.waitlist_allow_join(text, integer, integer, timestamptz) from public, anon, authenticated;
grant execute on function public.waitlist_allow_join(text, integer, integer, timestamptz) to service_role;

comment on table public.waitlist_attempts is
  'Allowed waitlist join attempts in the last rate-limit window, keyed by a salted hash of the caller address. Service role only. Pruned by waitlist_allow_join.';
comment on function public.waitlist_allow_join(text, integer, integer, timestamptz) is
  'Atomic sliding-window check for the join-waitlist function: true and records the attempt, or false. Service role only.';
