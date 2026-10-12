-- The range printed on the report, stored with each result, and which default ranges are for one sex only.
--
-- Every lab prints its own reference range next to each result, already chosen for the person's sex and age (and
-- cycle phase, where the lab does that). The app reads a result against that printed range first. Without one it
-- falls back to the marker's default range, but only when that range applies to the person: several of the stored
-- defaults are men's ranges, and a woman's result must never be flagged against them. See src/lib/ranges.ts and
-- docs/product/womens-health.md.
--
-- Safe to run twice.

alter table public.biomarker_readings add column if not exists ref_low numeric;
alter table public.biomarker_readings add column if not exists ref_high numeric;

alter table public.biomarkers add column if not exists ref_sex text;

do $$
begin
  if not exists (select 1 from pg_constraint where conrelid = 'public.biomarker_readings'::regclass and conname = 'biomarker_readings_printed_range_order') then
    alter table public.biomarker_readings add constraint biomarker_readings_printed_range_order
      check (ref_low is null or ref_high is null or ref_low <= ref_high);
  end if;
  if not exists (select 1 from pg_constraint where conrelid = 'public.biomarkers'::regclass and conname = 'biomarkers_ref_sex_check') then
    alter table public.biomarkers add constraint biomarkers_ref_sex_check check (ref_sex is null or ref_sex in ('male', 'female'));
  end if;
end
$$;

-- The stored defaults that are men's ranges. Women's ranges for these differ enough that a man's range would flag
-- ordinary results (haemoglobin 13.5 to 17.5 g/dL, testosterone 300 to 1000 ng/dL, and the rest below).
update public.biomarkers set ref_sex = 'male'
where code in ('hemoglobin', 'testosterone', 'creatinine', 'uric_acid', 'serum_iron', 'ferritin', 'hdl')
  and ref_sex is null;
