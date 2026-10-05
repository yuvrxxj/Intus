-- The "contract" half of per-user data. Apply this AFTER the new app is deployed.
--
-- daily_logs was unique on log_date alone, which is the one-person rule: a second person could not
-- save a log for a date the first person already had. The per-person rule (user_id, log_date) was added
-- by 20261005000100. This drops the old one so people no longer collide.
--
-- Do not apply before the new app is live: the previous app saves with "on conflict (log_date)", which
-- needs the constraint dropped here.

do $$
begin
  if not exists (
    select 1 from pg_constraint
     where conrelid = 'public.daily_logs'::regclass and conname = 'daily_logs_user_date_key'
  ) then
    raise exception 'daily_logs_user_date_key is missing: apply 20261005000100_per_user_data.sql first';
  end if;
end
$$;

alter table public.daily_logs drop constraint if exists daily_logs_log_date_key;
