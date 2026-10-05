-- Which days of the week a supplement is taken, so the Today checklist shows only what is due that day.
-- 0 is Sunday through 6 is Saturday, the numbering JavaScript's getDay() and Postgres's extract(dow ...) both use.
--
-- doses_per_day already exists on the table and carries the "how many times a day" half of a schedule, so this
-- adds only the days, plus checks that keep both halves sensible. Nothing is dropped or rewritten, it does not
-- depend on the per-user migrations, and it is safe to apply while the current app is live: the new column has a
-- default, so the old app's inserts and updates carry on working.

alter table public.medications
  add column if not exists days_of_week smallint[] not null default '{0,1,2,3,4,5,6}';

do $$
begin
  if not exists (select 1 from pg_constraint where conrelid = 'public.medications'::regclass and conname = 'medications_days_of_week_valid') then
    alter table public.medications add constraint medications_days_of_week_valid
      check (cardinality(days_of_week) between 1 and 7 and days_of_week <@ array[0, 1, 2, 3, 4, 5, 6]::smallint[]);
  end if;

  if not exists (select 1 from pg_constraint where conrelid = 'public.medications'::regclass and conname = 'medications_doses_per_day_valid') then
    alter table public.medications add constraint medications_doses_per_day_valid
      check (doses_per_day is null or (doses_per_day between 1 and 6 and doses_per_day = trunc(doses_per_day)));
  end if;
end
$$;
