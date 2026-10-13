-- The exact date of birth, so a person's age (and everything that reads it: the sleep range for their age, lab
-- reference ranges by age, the doctor's report) goes up on their birthday without anyone editing anything.
--
-- Adds one nullable column and a sanity check. Nothing is dropped or rewritten, and the app keeps working before and
-- after it is applied. The old `age` column stays: people who have not given a date yet keep the age they typed, and
-- the app works the age out from the date whenever there is one. Being an adult (18 or over) is checked by the app,
-- because a date check against today's date cannot live in a table constraint.

alter table public.profile
  add column if not exists date_of_birth date;

do $$
begin
  if not exists (select 1 from pg_constraint where conrelid = 'public.profile'::regclass and conname = 'profile_date_of_birth_plausible') then
    alter table public.profile add constraint profile_date_of_birth_plausible
      check (date_of_birth is null or date_of_birth >= date '1900-01-01');
  end if;
end
$$;
