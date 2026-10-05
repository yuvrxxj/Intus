-- Habits a person chooses to track: cigarettes, drinks, lifting, cardio, steps, anything else.
--
-- A habit is one of three kinds:
--   count  : a tally for the day (cigarettes, drinks).
--   yesno  : did you or didn't you (lifted, core, drank today).
--   amount : a number against a daily goal, with a unit (steps, litres of water).
-- better says which way is good: higher (lifted, steps) or lower (cigarettes, drank today).
--
-- What a person logged on a given day lives on that day's daily_logs row, in a new jsonb column keyed by habit id
-- ({"<habit id>": {"value": 3, "note": "stairmaster"}}), so saving a day stays one write.
--
-- This only creates a table and adds a column, nothing is dropped or rewritten, and it does not depend on the
-- per-user migrations: the table is per person from the start, with the same own-rows policy they use.

create table if not exists public.habits (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  name text not null check (char_length(btrim(name)) between 1 and 60),
  kind text not null check (kind in ('count', 'yesno', 'amount')),
  unit text check (unit is null or char_length(btrim(unit)) between 1 and 20),
  goal numeric check (goal is null or (goal >= 0 and goal <= 100000)),
  better text not null default 'higher' check (better in ('higher', 'lower')),
  sort_order integer not null default 0,
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  -- a yes or no has no unit and no goal
  constraint habits_yesno_has_no_goal check (kind <> 'yesno' or (unit is null and goal is null))
);

alter table public.habits enable row level security;

do $$
begin
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'habits' and policyname = 'own_rows') then
    create policy own_rows on public.habits for all to authenticated
      using (user_id = (select auth.uid()))
      with check (user_id = (select auth.uid()));
  end if;
end
$$;

revoke all on public.habits from anon;

create index if not exists habits_user_order_idx on public.habits (user_id, sort_order, created_at);

alter table public.daily_logs
  add column if not exists habits jsonb not null default '{}'::jsonb;

do $$
begin
  if not exists (select 1 from pg_constraint where conrelid = 'public.daily_logs'::regclass and conname = 'daily_logs_habits_is_object') then
    alter table public.daily_logs add constraint daily_logs_habits_is_object check (jsonb_typeof(habits) = 'object');
  end if;
end
$$;
