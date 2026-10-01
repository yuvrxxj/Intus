-- Step 2 of 2: only the owner can touch the data. Replaces the open "allow_all" policies.
--
-- Do not apply this until the owner exists, or you lock yourself out of your own data:
--   1. Create the login in Supabase: Authentication > Users > Add user (tick auto-confirm).
--   2. insert into public.app_owner (user_id) select id from auth.users where email = '<your email>';
--   3. Deploy the version of index.html that has the sign-in screen.
--   4. Apply this migration.
-- The guard below refuses to run while app_owner is empty.

do $$
begin
  if not exists (select 1 from public.app_owner) then
    raise exception 'app_owner is empty: add the owner first (see the steps at the top of this file), or this would lock everyone out';
  end if;
end
$$;

do $$
declare
  t text;
begin
  foreach t in array array[
    'action_items', 'biomarker_readings', 'biomarkers', 'body_composition', 'cardio_metrics',
    'daily_logs', 'devices', 'diagnoses', 'meals', 'medications', 'photo_log', 'profile',
    'screening_history', 'screening_rules', 'supplement_catalog'
  ]
  loop
    execute format('alter table public.%I enable row level security', t);
    execute format('drop policy if exists allow_all on public.%I', t);
    execute format('drop policy if exists owner_only on public.%I', t);
    execute format(
      'create policy owner_only on public.%I for all to authenticated using ((select private.is_owner())) with check ((select private.is_owner()))',
      t
    );
    -- belt and braces: the signed-out role gets no table privileges at all
    execute format('revoke all on table public.%I from anon', t);
  end loop;
end
$$;
