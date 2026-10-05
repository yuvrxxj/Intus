-- Multi-user: each person's health data belongs to them alone.
--
-- Until now one question decided access to everything: "is this the owner?" (private.is_owner()). From here every
-- personal row carries the user who owns it, and the database only shows a person their own rows.
--
--   personal tables   daily_logs, biomarker_readings, medications, profile, screening_history
--                     -> a user_id column, and a policy that matches it against the signed-in user
--   reference tables  biomarkers, screening_rules
--                     -> shared by everyone, read-only through the API
--   unused tables     action_items, body_composition, cardio_metrics, devices, diagnoses, meals, photo_log,
--                     supplement_catalog -> locked to everyone until a feature needs them (no policy means no access)
--
-- Rows that exist today are handed to the owner in app_owner. The migration stops if there are rows and no owner,
-- rather than leave rows nobody can see.
--
-- This does not open sign-ups. That is a switch in the Supabase dashboard (Authentication > Sign In / Providers),
-- along with email confirmation, a real SMTP sender and CAPTCHA. Do those with the sign-up screen, not before.
--
-- The app must ship with this: saveLog upserts on (user_id, log_date) now, not on log_date alone.

do $$
declare
  t text;
  owner_id uuid;
  n bigint;
  total bigint := 0;
begin
  select user_id into owner_id from public.app_owner order by created_at limit 1;

  foreach t in array array['biomarker_readings', 'daily_logs', 'medications', 'profile', 'screening_history']
  loop
    execute format('alter table public.%I add column if not exists user_id uuid references auth.users (id) on delete cascade', t);
    execute format('select count(*) from public.%I where user_id is null', t) into n;
    total := total + n;
  end loop;

  if total > 0 and owner_id is null then
    raise exception 'there are % rows and app_owner is empty: add the owner first, or nobody could see them', total;
  end if;

  foreach t in array array['biomarker_readings', 'daily_logs', 'medications', 'profile', 'screening_history']
  loop
    execute format('update public.%I set user_id = $1 where user_id is null', t) using owner_id;
    execute format('alter table public.%I alter column user_id set default auth.uid()', t);
    execute format('alter table public.%I alter column user_id set not null', t);
  end loop;
end
$$;

-- One log per person per day (it was one per day for the whole database).
do $$
declare
  r record;
begin
  for r in
    select i.indexrelid::regclass::text as idx, con.conname
    from pg_index i
    left join pg_constraint con on con.conindid = i.indexrelid and con.contype = 'u'
    where i.indrelid = 'public.daily_logs'::regclass
      and i.indisunique
      and not i.indisprimary
      and i.indnatts = 1
      and i.indkey[0] = (select attnum from pg_attribute where attrelid = 'public.daily_logs'::regclass and attname = 'log_date')
  loop
    if r.conname is not null then
      execute format('alter table public.daily_logs drop constraint %I', r.conname);
    else
      execute format('drop index %s', r.idx);
    end if;
  end loop;
end
$$;

alter table public.daily_logs add constraint daily_logs_user_id_log_date_key unique (user_id, log_date);

-- One profile per person.
alter table public.profile add constraint profile_user_id_key unique (user_id);

-- Every personal query now filters on user_id, so each table gets an index that starts with it.
create index if not exists biomarker_readings_user_measured_idx on public.biomarker_readings (user_id, measured_at desc);
create index if not exists medications_user_idx on public.medications (user_id);
create index if not exists screening_history_user_done_idx on public.screening_history (user_id, done_date desc);

-- Personal tables: your rows, and only yours.
do $$
declare
  t text;
begin
  foreach t in array array['biomarker_readings', 'daily_logs', 'medications', 'profile', 'screening_history']
  loop
    execute format('drop policy if exists owner_only on public.%I', t);
    execute format('drop policy if exists own_rows on public.%I', t);
    execute format(
      'create policy own_rows on public.%I for all to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()))',
      t
    );
  end loop;
end
$$;

-- Reference tables: everyone signed in may read them, nobody may change them through the API.
do $$
declare
  t text;
begin
  foreach t in array array['biomarkers', 'screening_rules']
  loop
    execute format('drop policy if exists owner_only on public.%I', t);
    execute format('drop policy if exists read_reference on public.%I', t);
    execute format('create policy read_reference on public.%I for select to authenticated using (true)', t);
    execute format('revoke insert, update, delete, truncate on table public.%I from authenticated', t);
  end loop;
end
$$;

-- Tables nothing uses yet: no policy, and no grant either, so they are not even visible through the API.
do $$
declare
  t text;
begin
  foreach t in array array[
    'action_items', 'body_composition', 'cardio_metrics', 'devices', 'diagnoses', 'meals', 'photo_log', 'supplement_catalog'
  ]
  loop
    execute format('drop policy if exists owner_only on public.%I', t);
    execute format('revoke all on table public.%I from authenticated', t);
  end loop;
end
$$;
