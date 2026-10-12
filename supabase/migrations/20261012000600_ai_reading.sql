-- Reading lab reports with an AI model (INT-108): the limits that keep the bill at zero, and a record of every call.
--
-- Everything that decides whether a call may happen lives here, not in the app or the Edge Function, so it can be
-- changed in the Supabase dashboard without a deploy and cannot be talked round by a caller:
--   ai_settings   one row. Off until the owner turns it on. The daily and monthly limits, the provider and model, and its prices.
--                 A free model has prices of 0, and the daily limits are then what keeps it inside the free allowance.
--   ai_usage      one row per call: who, when, tokens, and what it cost. Never any report text.
--   ai_take_slot  checks every limit and reserves the worst-case cost of a call, in one step under a lock.
--   ai_finish     replaces the reserved cost with the real one once Gemini has answered.
--   ai_status     what the upload screen needs to know: is it on, and how many has this person left today.
--
-- Only the Edge Function (service role) can run the three functions or touch ai_settings. A signed-in person can
-- read their own ai_usage rows and nothing else. Safe to run twice.

create table if not exists public.ai_settings (
  id boolean primary key default true check (id),
  enabled boolean not null default false,
  per_user_daily integer not null default 3 check (per_user_daily between 0 and 1000),
  global_daily integer not null default 30 check (global_daily between 0 and 100000),
  monthly_budget_usd numeric(8, 2) not null default 5 check (monthly_budget_usd >= 0),
  -- which service reads the report, the model on it, and how it is asked to answer ('schema' asks for JSON matching
  -- a schema, 'object' for any JSON, for models that cannot do the first)
  provider text not null default 'gemini' check (provider in ('gemini', 'openrouter')),
  model text not null default 'gemini-flash-lite-latest' check (char_length(btrim(model)) between 1 and 80),
  json_mode text not null default 'schema' check (json_mode in ('schema', 'object')),
  -- what a million tokens cost on that model. The defaults are deliberately high, so the estimate errs towards
  -- stopping early. Set them to the model's real prices.
  input_usd_per_million numeric(8, 4) not null default 0.50 check (input_usd_per_million >= 0),
  output_usd_per_million numeric(8, 4) not null default 3.00 check (output_usd_per_million >= 0),
  max_input_chars integer not null default 200000 check (max_input_chars between 1000 and 1000000),
  max_output_tokens integer not null default 16384 check (max_output_tokens between 256 and 65536),
  updated_at timestamptz not null default now()
);

insert into public.ai_settings (id) values (true) on conflict (id) do nothing;

create table if not exists public.ai_usage (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  created_at timestamptz not null default now(),
  status text not null default 'reserved' check (status in ('reserved', 'done', 'failed')),
  -- the worst case while the call is running, the real cost once it has finished
  cost_usd numeric(10, 6) not null default 0 check (cost_usd >= 0),
  input_tokens integer check (input_tokens is null or input_tokens >= 0),
  output_tokens integer check (output_tokens is null or output_tokens >= 0)
);

create index if not exists ai_usage_created_idx on public.ai_usage (created_at);
create index if not exists ai_usage_user_created_idx on public.ai_usage (user_id, created_at);

-- ai_settings has row level security and no policy: the API cannot read or change it at all.
alter table public.ai_settings enable row level security;
alter table public.ai_usage enable row level security;

do $$
begin
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'ai_usage' and policyname = 'read_own') then
    create policy read_own on public.ai_usage for select to authenticated
      using (user_id = (select auth.uid()));
  end if;
end
$$;

revoke all on public.ai_settings from anon, authenticated;
revoke all on public.ai_usage from anon;
revoke insert, update, delete on public.ai_usage from authenticated;

-- Checks every limit and, if the call may go ahead, writes a row that reserves its worst-case cost. The lock makes
-- two calls at the same moment queue up, so they cannot both squeeze under a limit.
-- reason: off, too_big, user_limit (this person's day), busy (everyone's day), budget (the month's money).
create or replace function public.ai_take_slot(p_user uuid, p_input_chars integer)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  s public.ai_settings;
  day_start timestamptz := date_trunc('day', now() at time zone 'utc') at time zone 'utc';
  month_start timestamptz := date_trunc('month', now() at time zone 'utc') at time zone 'utc';
  used_user integer;
  used_global integer;
  month_spend numeric;
  reserve numeric;
  new_id uuid;
begin
  perform pg_advisory_xact_lock(hashtext('ai_take_slot'));
  select * into s from public.ai_settings where id;
  if not found or not s.enabled then
    return jsonb_build_object('ok', false, 'reason', 'off');
  end if;
  if p_user is null or p_input_chars is null or p_input_chars < 1 or p_input_chars > s.max_input_chars then
    return jsonb_build_object('ok', false, 'reason', 'too_big');
  end if;

  select count(*) into used_user from public.ai_usage where user_id = p_user and created_at >= day_start;
  if used_user >= s.per_user_daily then
    return jsonb_build_object('ok', false, 'reason', 'user_limit');
  end if;
  select count(*) into used_global from public.ai_usage where created_at >= day_start;
  if used_global >= s.global_daily then
    return jsonb_build_object('ok', false, 'reason', 'busy');
  end if;

  -- worst case for this call: a token for every two characters sent, and the whole output allowance used
  reserve := (p_input_chars / 2.0 / 1000000.0) * s.input_usd_per_million
           + (s.max_output_tokens / 1000000.0) * s.output_usd_per_million;
  select coalesce(sum(cost_usd), 0) into month_spend from public.ai_usage where created_at >= month_start;
  if month_spend + reserve > s.monthly_budget_usd then
    return jsonb_build_object('ok', false, 'reason', 'budget');
  end if;

  insert into public.ai_usage (user_id, cost_usd) values (p_user, round(reserve, 6)) returning id into new_id;
  return jsonb_build_object(
    'ok', true, 'usage_id', new_id, 'provider', s.provider, 'model', s.model, 'json_mode', s.json_mode,
    'max_output_tokens', s.max_output_tokens,
    'used_today', used_user + 1, 'per_user_daily', s.per_user_daily);
end
$$;

-- Replaces the reserved cost with the real one. With no token counts (the call failed before Gemini answered) a
-- failed call costs nothing; a call that worked but reported no counts keeps its reserved cost. Runs once per call.
create or replace function public.ai_finish(p_id uuid, p_input_tokens integer, p_output_tokens integer, p_ok boolean)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.ai_usage u
     set status = case when p_ok then 'done' else 'failed' end,
         input_tokens = p_input_tokens,
         output_tokens = p_output_tokens,
         cost_usd = case
           when p_input_tokens is null and p_output_tokens is null then case when p_ok then u.cost_usd else 0 end
           else round(coalesce(p_input_tokens, 0) / 1000000.0 * s.input_usd_per_million
                    + coalesce(p_output_tokens, 0) / 1000000.0 * s.output_usd_per_million, 6)
         end
    from public.ai_settings s
   where u.id = p_id and u.status = 'reserved';
end
$$;

-- What the upload screen asks before it offers the option: is it on, is there room today, and how many are left.
create or replace function public.ai_status(p_user uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  s public.ai_settings;
  day_start timestamptz := date_trunc('day', now() at time zone 'utc') at time zone 'utc';
  month_start timestamptz := date_trunc('month', now() at time zone 'utc') at time zone 'utc';
  used_user integer;
  used_global integer;
  month_spend numeric;
begin
  select * into s from public.ai_settings where id;
  if not found or not s.enabled then
    return jsonb_build_object('available', false, 'provider', null, 'used_today', 0, 'per_user_daily', 0);
  end if;
  select count(*) into used_user from public.ai_usage where user_id = p_user and created_at >= day_start;
  select count(*) into used_global from public.ai_usage where created_at >= day_start;
  select coalesce(sum(cost_usd), 0) into month_spend from public.ai_usage where created_at >= month_start;
  return jsonb_build_object(
    'available', used_user < s.per_user_daily and used_global < s.global_daily and month_spend < s.monthly_budget_usd,
    'provider', s.provider,
    'used_today', used_user,
    'per_user_daily', s.per_user_daily);
end
$$;

revoke all on function public.ai_take_slot(uuid, integer) from public, anon, authenticated;
revoke all on function public.ai_finish(uuid, integer, integer, boolean) from public, anon, authenticated;
revoke all on function public.ai_status(uuid) from public, anon, authenticated;
grant execute on function public.ai_take_slot(uuid, integer) to service_role;
grant execute on function public.ai_finish(uuid, integer, integer, boolean) to service_role;
grant execute on function public.ai_status(uuid) to service_role;
