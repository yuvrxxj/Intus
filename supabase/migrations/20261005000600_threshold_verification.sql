-- Critical-limit sign-off. The critical_low / critical_high numbers on public.biomarkers have never been checked
-- by a clinician, so the app now treats them as unverified and raises no critical alert from them.
--
-- A marker's limits only start to alert once a clinician has reviewed them and someone with database access
-- records that here. Until then threshold_verified_at is null, and the app shows "unverified" for that marker
-- instead of "critical" or "ok".
--
-- Safe to apply while the current app is live: both columns are nullable and the old app ignores them. The new
-- app reads a missing or null value as "not verified", so it is also safe to deploy before this runs.
--
-- Nothing here marks any marker verified. Do that deliberately, per marker, after review, for example:
--   update public.biomarkers
--      set threshold_verified_at = now(),
--          threshold_verified_by = 'Dr Name, registration number, what was checked and against which source'
--    where code = 'potassium';
-- The biomarkers table is read-only through the API (see 20261005000100_per_user_data.sql), so this can only be
-- done by the project owner in the SQL editor or with the service role, never by a signed-in app user.

alter table public.biomarkers
  add column if not exists threshold_verified_at timestamptz,
  add column if not exists threshold_verified_by text;

comment on column public.biomarkers.threshold_verified_at is
  'When a clinician signed off critical_low / critical_high. Null means unverified: the app raises no critical alert from them.';
comment on column public.biomarkers.threshold_verified_by is
  'Who signed off the limits and what they checked them against. Free text; required in practice whenever threshold_verified_at is set.';

-- a sign-off without a name is worthless, so refuse it
alter table public.biomarkers
  drop constraint if exists biomarkers_verified_needs_reviewer,
  add constraint biomarkers_verified_needs_reviewer
    check (threshold_verified_at is null or (threshold_verified_by is not null and btrim(threshold_verified_by) <> ''));
