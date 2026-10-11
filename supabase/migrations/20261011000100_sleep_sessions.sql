-- Sleep: one row per stretch of sleep that one source reported.
--
-- A person's sleep can come from several places for the same night (what they type in, an Apple Watch, an Android
-- phone), and those must never be added together, so each source's record is kept as it was and the numbers are worked
-- out when reading (see docs/product/sleep-tracker.md). Nothing derived is stored.
--
-- start_at and end_at are instants (timestamptz). The offsets are minutes east of UTC at each end, so the local clock
-- time and the date the person woke up can be rebuilt without guessing a time zone. For a diary entry start_at is when
-- they got into bed; a device that has no in-bed time sets start_is_in_bed to false and efficiency is not worked out.
--
-- stages holds a device's stage segments as [{"s": epoch ms, "e": epoch ms, "t": "light"}], with t one of asleep, light,
-- deep, rem, awake. A diary entry has none. The app checks the segments' shape when importing; the database only keeps
-- it a bounded array, because it is the person's own data and nobody else can read it.
--
-- Same shape as habits: a new table, per person from the start, with the same own-rows policy as the others, and it
-- cascades from auth.users so deleting an account deletes it.

create table if not exists public.sleep_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  source_kind text not null default 'manual'
    check (source_kind in ('manual', 'apple_health_export', 'healthkit', 'health_connect', 'other')),
  -- the device or app ("Apple Watch"); empty for a diary entry
  source_name text not null default '' check (char_length(source_name) <= 80),
  -- the source's own id for the record, so importing the same thing again updates it instead of duplicating it
  external_id text check (external_id is null or char_length(external_id) between 1 and 200),
  start_at timestamptz not null,
  end_at timestamptz not null,
  start_offset_min smallint not null check (start_offset_min between -720 and 840),
  end_offset_min smallint not null check (end_offset_min between -720 and 840),
  tz_id text check (tz_id is null or char_length(tz_id) between 1 and 64),
  -- the person's own estimates (or a source's), in whole minutes
  latency_min smallint check (latency_min is null or latency_min between 0 and 600),
  awake_min smallint check (awake_min is null or awake_min between 0 and 720),
  stages jsonb not null default '[]'::jsonb
    check (jsonb_typeof(stages) = 'array' and jsonb_array_length(stages) <= 3000),
  start_is_in_bed boolean not null default true,
  notes text check (notes is null or char_length(notes) <= 200),
  -- when the source wrote the record, to break ties between sources
  recorded_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  constraint sleep_sessions_ends_after_start check (end_at > start_at),
  -- no shorter than 15 minutes, no longer than 20 hours: outside that it is almost always a wrong AM or PM or date
  constraint sleep_sessions_plausible_length check (end_at - start_at between interval '15 minutes' and interval '20 hours'),
  constraint sleep_sessions_not_before_2000 check (start_at >= timestamptz '2000-01-01 00:00:00+00'),
  -- the estimates have to fit inside the time in bed
  constraint sleep_sessions_estimates_fit check (
    coalesce(latency_min, 0) + coalesce(awake_min, 0) < extract(epoch from (end_at - start_at)) / 60
  )
);

alter table public.sleep_sessions enable row level security;

do $$
begin
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'sleep_sessions' and policyname = 'own_rows') then
    create policy own_rows on public.sleep_sessions for all to authenticated
      using (user_id = (select auth.uid()))
      with check (user_id = (select auth.uid()));
  end if;
end
$$;

revoke all on public.sleep_sessions from anon;

-- a source's record arrives once, so importing again updates it. Rows with no external id (a diary entry) are all
-- distinct, because Postgres treats nulls as different from each other in a unique constraint.
do $$
begin
  if not exists (select 1 from pg_constraint where conrelid = 'public.sleep_sessions'::regclass and conname = 'sleep_sessions_source_record_key') then
    alter table public.sleep_sessions add constraint sleep_sessions_source_record_key
      unique (user_id, source_kind, source_name, external_id);
  end if;
end
$$;

create index if not exists sleep_sessions_user_end_idx on public.sleep_sessions (user_id, end_at desc);
