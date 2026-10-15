-- Housekeeping after the 5 Oct per-person data change, and the leftovers of the Screening feature that was removed
-- from the app (INT-67). Everything below is permanent, so it was checked read-only against the live project on
-- 15 Oct 2026 first:
--
--   * nothing live depends on any of it: no policy, view, trigger or function body uses app_owner, is_owner(), the
--     screening tables, the backup schema or the columns dropped here (the one exception, daily_logs.steps, is
--     removed from the app in the same pull request);
--   * screening_history has no rows, and every profile row has all three screening answers at false;
--   * no medication has a paracetamol dose;
--   * every row in the backup schema's tables is still in the live table with the same id.
--
-- The only data that needs carrying first is the old daily_logs.cardio value that the one-off habits seed could not
-- map. The seed turned 'yes', 'bad' and 'no' into a Cardio habit entry, but the live owner has one day (19 Jun) with
-- the word 'stairs', so that day has no Cardio entry. It is written as a yes with the word as the note, the same way
-- the seed kept 'Stairmaster' and 'Badminton'. A day that already has a Cardio entry keeps it.
--
-- Every statement uses "if exists" so the file can be run twice, like the migrations before it.

do $$
begin
  if exists (select 1 from information_schema.columns
              where table_schema = 'public' and table_name = 'daily_logs' and column_name = 'cardio') then
    update public.daily_logs l
       set habits = l.habits || jsonb_build_object(
         h.id::text, jsonb_build_object('value', true, 'note', initcap(btrim(l.cardio))))
      from (
        select distinct on (user_id) id, user_id
          from public.habits
         where name = 'Cardio' and kind = 'yesno'
         order by user_id, archived_at nulls first, created_at
      ) h
     where h.user_id = l.user_id
       and l.cardio is not null
       and lower(btrim(l.cardio)) not in ('', 'yes', 'bad', 'no')
       and not (l.habits ? h.id::text);
  end if;
end
$$;

-- The Screening feature: history first, it points at the rules.
drop table if exists public.screening_history;
drop table if exists public.screening_rules;

alter table public.profile
  drop column if exists family_colorectal_cancer,
  drop column if exists family_prostate_cancer,
  drop column if exists noise_or_blast_exposure;

-- The medicine checks were removed on 5 Oct.
alter table public.medications
  drop column if exists paracetamol_mg_per_dose;

-- The old activity columns. Their values live in daily_logs.habits (the one that did not is carried above).
alter table public.daily_logs
  drop column if exists lift,
  drop column if exists core,
  drop column if exists cardio,
  drop column if exists cigs,
  drop column if exists steps;

-- The owner-only rules were replaced by per-person rules on 5 Oct. The check, then the table it reads.
drop function if exists private.is_owner();
drop table if exists public.app_owner;

-- A private copy of all 16 tables from before the per-person change, kept for a week or two. It is due.
drop schema if exists backup_20261005 cascade;
