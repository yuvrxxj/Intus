-- Daily activity: steps and active calories, one row per person, day and source (INT-147).
--
-- A phone or watch reports these as a total for each calendar day, so there is one row per day and source, not one
-- row per reading. The iPhone sync (Apple Health) writes source 'healthkit'; the Android sync (Health Connect) will
-- write 'health_connect' into this same table. Two sources for one day stay two rows: nothing here adds them
-- together or picks between them, the same rule as sleep_sessions and cardio_metrics.
--
-- day is the person's own local calendar day, worked out on the phone. steps is a whole number. active_kcal is the
-- energy burned by activity, in kilocalories to one decimal; it is not resting energy. At least one of the two has
-- to be there, because a row with neither says nothing. Totals outside the checks are a sensor glitch, and the app
-- leaves them out instead of storing them. Today's row is overwritten by each sync until the day is over.
--
-- Same shape as sleep_sessions: per person from the start, the same own-rows policy as the other personal tables,
-- no access for the signed-out role, and it cascades from auth.users so deleting an account deletes it.
--
-- Safe to run twice.

create table if not exists public.activity_days (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  day date not null,
  steps integer check (steps is null or steps between 0 and 200000),
  active_kcal numeric(7, 1) check (active_kcal is null or active_kcal between 0 and 20000),
  -- same words as cardio_metrics.source
  source text not null default 'manual' check (source in ('manual', 'healthkit', 'health_connect', 'other')),
  created_at timestamptz not null default now(),
  constraint activity_days_has_a_value check (steps is not null or active_kcal is not null),
  constraint activity_days_not_before_2000 check (day >= date '2000-01-01')
);

alter table public.activity_days enable row level security;

do $$
begin
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'activity_days' and policyname = 'own_rows') then
    create policy own_rows on public.activity_days for all to authenticated
      using (user_id = (select auth.uid()))
      with check (user_id = (select auth.uid()));
  end if;
end
$$;

revoke all on public.activity_days from anon;

-- one row per person, day and source, so syncing the same day again updates it
do $$
begin
  if not exists (select 1 from pg_constraint where conrelid = 'public.activity_days'::regclass and conname = 'activity_days_day_source_key') then
    alter table public.activity_days add constraint activity_days_day_source_key unique (user_id, day, source);
  end if;
end
$$;
