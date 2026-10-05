-- Per-user data: every person sees only their own rows. Replaces the single-owner rule from
-- 20261001000200_owner_lockdown.sql, which let exactly one account in.
--
-- This is the "expand" half. It is safe to apply while the current app is live:
--   * every existing row is assigned to the one registered owner, so the owner still sees everything;
--   * daily_logs keeps its old unique(log_date) until 20261005000200 drops it, so the current app's
--     save (upsert on log_date) keeps working until the new app is deployed.
--
-- Apply order (see supabase/README.md): 1) this file, 2) deploy the new app, 3) 20261005000200.
--
-- Refuses to run unless exactly one owner is registered, because the existing rows need an owner to
-- be assigned to.

do $$
declare
  owners integer;
begin
  select count(*) into owners from public.app_owner;
  if owners <> 1 then
    raise exception 'expected exactly one row in app_owner to receive the existing data, found %', owners;
  end if;
end
$$;

do $$
declare
  owner_id uuid;
  t text;
  -- tables that hold one person's data
  personal text[] := array[
    'action_items', 'biomarker_readings', 'body_composition', 'cardio_metrics', 'daily_logs',
    'devices', 'diagnoses', 'meals', 'medications', 'photo_log', 'profile', 'screening_history',
    'supplement_catalog'
  ];
  -- tables shared by everyone and read-only through the API
  reference text[] := array['biomarkers', 'screening_rules'];
  pk_cols text[];
begin
  select user_id into owner_id from public.app_owner;

  foreach t in array personal
  loop
    -- the column: filled in automatically from the signed-in user, removed with the account
    execute format(
      'alter table public.%I add column if not exists user_id uuid references auth.users (id) on delete cascade default auth.uid()',
      t
    );
    execute format('update public.%I set user_id = $1 where user_id is null', t) using owner_id;
    execute format('alter table public.%I alter column user_id set not null', t);

    -- text primary keys (action_items, devices, supplement_catalog) are only unique per person now
    select array_agg(a.attname order by k.ord) into pk_cols
      from pg_constraint c
      cross join lateral unnest(c.conkey) with ordinality as k(attnum, ord)
      join pg_attribute a on a.attrelid = c.conrelid and a.attnum = k.attnum
     where c.conrelid = format('public.%I', t)::regclass and c.contype = 'p';
    if t in ('action_items', 'devices', 'supplement_catalog') and pk_cols = array['id'] then
      execute format('alter table public.%I drop constraint %I', t, t || '_pkey');
      execute format('alter table public.%I add primary key (user_id, id)', t);
    end if;

    execute format('alter table public.%I enable row level security', t);
    execute format('drop policy if exists owner_only on public.%I', t);
    execute format('drop policy if exists own_rows on public.%I', t);
    execute format(
      'create policy own_rows on public.%I for all to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()))',
      t
    );
    execute format('revoke all on table public.%I from anon', t);
    execute format('create index if not exists %I on public.%I (user_id)', t || '_user_id_idx', t);
  end loop;

  foreach t in array reference
  loop
    execute format('alter table public.%I enable row level security', t);
    execute format('drop policy if exists owner_only on public.%I', t);
    execute format('drop policy if exists read_reference on public.%I', t);
    execute format('create policy read_reference on public.%I for select to authenticated using (true)', t);
    execute format('revoke all on table public.%I from anon', t);
    -- reading only: even a mistaken policy later could not let the API change reference data
    execute format('revoke insert, update, delete, truncate on table public.%I from authenticated', t);
  end loop;
end
$$;

-- one log per person per day, and one profile per person
alter table public.daily_logs
  drop constraint if exists daily_logs_user_date_key,
  add constraint daily_logs_user_date_key unique (user_id, log_date);
alter table public.profile
  drop constraint if exists profile_user_key,
  add constraint profile_user_key unique (user_id);

create index if not exists biomarker_readings_user_marker_idx
  on public.biomarker_readings (user_id, biomarker_id, measured_at desc);

-- tables created from now on start closed to the signed-out role (Supabase otherwise opens them)
alter default privileges in schema public revoke all on tables from anon;
