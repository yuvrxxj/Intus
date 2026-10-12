-- Heart readings from a phone: one row per person, day and source.
--
-- cardio_metrics had no screen and no key beyond its id, so syncing the same day again from Apple Health would add a
-- second row. This adds where a row came from and makes (person, day, source) unique, so the iOS sync companion can
-- upsert. Existing rows were typed in or imported by hand and become 'manual'. Two sources for one day stay two rows;
-- nothing here blends them.
--
-- Safe to run twice.

alter table public.cardio_metrics add column if not exists source text not null default 'manual';

do $$
begin
  if not exists (select 1 from pg_constraint where conrelid = 'public.cardio_metrics'::regclass and conname = 'cardio_metrics_source_check') then
    alter table public.cardio_metrics add constraint cardio_metrics_source_check
      check (source in ('manual', 'healthkit', 'health_connect', 'other'));
  end if;
  if not exists (select 1 from pg_constraint where conrelid = 'public.cardio_metrics'::regclass and conname = 'cardio_metrics_day_source_key') then
    alter table public.cardio_metrics add constraint cardio_metrics_day_source_key unique (user_id, measured_at, source);
  end if;
end
$$;
