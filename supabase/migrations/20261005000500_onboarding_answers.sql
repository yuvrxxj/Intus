-- Answers from the first-run questions that have no home yet: how active someone is, whether they eat meat, how
-- often they work out, what their cardio is like, and what a regular day looks like against the one they want.
-- Smoking, drinking, lifting, cardio and steps become habits instead, so they are not stored here.
--
-- Only adds nullable columns and checks. Nothing is dropped or rewritten, it does not depend on the other
-- migrations, and the app keeps working before and after it is applied.

alter table public.profile
  add column if not exists activity_level text,
  add column if not exists diet text,
  add column if not exists workout_days_per_week smallint,
  add column if not exists cardio_notes text,
  add column if not exists typical_day text,
  add column if not exists desired_day text;

do $$
begin
  if not exists (select 1 from pg_constraint where conrelid = 'public.profile'::regclass and conname = 'profile_activity_level_valid') then
    alter table public.profile add constraint profile_activity_level_valid
      check (activity_level is null or activity_level in ('sedentary', 'light', 'moderate', 'active', 'very_active'));
  end if;
  if not exists (select 1 from pg_constraint where conrelid = 'public.profile'::regclass and conname = 'profile_diet_valid') then
    alter table public.profile add constraint profile_diet_valid
      check (diet is null or diet in ('vegetarian', 'non_vegetarian', 'vegan', 'other'));
  end if;
  if not exists (select 1 from pg_constraint where conrelid = 'public.profile'::regclass and conname = 'profile_workout_days_valid') then
    alter table public.profile add constraint profile_workout_days_valid
      check (workout_days_per_week is null or workout_days_per_week between 0 and 7);
  end if;
  if not exists (select 1 from pg_constraint where conrelid = 'public.profile'::regclass and conname = 'profile_free_text_short') then
    alter table public.profile add constraint profile_free_text_short
      check (char_length(cardio_notes) <= 200 and char_length(typical_day) <= 1000 and char_length(desired_day) <= 1000);
  end if;
end
$$;
