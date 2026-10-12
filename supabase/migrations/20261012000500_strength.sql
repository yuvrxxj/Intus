-- Strength training: workouts and the sets in them (INT-58, "a strength logger that never loses data").
--
-- Every set is written the moment it is entered. Its id is made on the device, so the app can keep a set in a local
-- queue until the database confirms it and resend it safely (an upsert on the id) after a dropped connection or a
-- closed tab. Nothing about a workout is derived and stored: totals and bests are worked out when reading.
--
-- Both tables are per person from the start, own rows only, and cascade from auth.users. A set also cascades from its
-- workout, and must belong to a workout of the same person. Safe to run twice.

create table if not exists public.workouts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  started_at timestamptz not null default now(),
  ended_at timestamptz,
  notes text check (notes is null or char_length(notes) <= 500),
  created_at timestamptz not null default now(),
  constraint workouts_ends_after_start check (ended_at is null or ended_at >= started_at),
  -- (id, user_id) is unique so a set can point at a workout of its own owner only
  constraint workouts_id_user_key unique (id, user_id)
);

create table if not exists public.workout_sets (
  id uuid primary key,
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  workout_id uuid not null,
  exercise text not null check (char_length(btrim(exercise)) between 1 and 60),
  position integer not null default 0 check (position between 0 and 10000),
  weight_kg numeric check (weight_kg is null or (weight_kg >= 0 and weight_kg <= 1000)),
  reps integer not null check (reps between 0 and 1000),
  rpe numeric check (rpe is null or (rpe >= 1 and rpe <= 10 and rpe * 2 = floor(rpe * 2))),
  notes text check (notes is null or char_length(notes) <= 200),
  created_at timestamptz not null default now(),
  constraint workout_sets_own_workout foreign key (workout_id, user_id) references public.workouts (id, user_id) on delete cascade
);

alter table public.workouts enable row level security;
alter table public.workout_sets enable row level security;

do $$
begin
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'workouts' and policyname = 'own_rows') then
    create policy own_rows on public.workouts for all to authenticated
      using (user_id = (select auth.uid()))
      with check (user_id = (select auth.uid()));
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'workout_sets' and policyname = 'own_rows') then
    create policy own_rows on public.workout_sets for all to authenticated
      using (user_id = (select auth.uid()))
      with check (user_id = (select auth.uid()));
  end if;
end
$$;

revoke all on public.workouts from anon;
revoke all on public.workout_sets from anon;

create index if not exists workouts_user_started_idx on public.workouts (user_id, started_at desc);
create index if not exists workout_sets_workout_idx on public.workout_sets (workout_id, position);
