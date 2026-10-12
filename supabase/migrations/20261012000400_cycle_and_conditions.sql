-- Women's health, phases 1 to 3 (docs/product/womens-health.md): cycle days, conditions on the profile, and the
-- reproductive hormones as markers.
--
-- cycle_days: one row per person, day and source. A day of bleeding (flow) and optional symptoms from a short fixed
-- list. Everything else (cycle day, cycle lengths) is worked out when reading, never stored, and nothing predicts
-- ovulation or fertile days. Like sleep, a phone import later becomes its own source and is never blended with what
-- the person typed.
--
-- profile_conditions: optional conditions and life stages the person chooses to record. They change only which ranges
-- apply (pregnancy: printed ranges only) and what is shown, never produce advice. label keeps the person's own word
-- for it, for example PCOD for PCOS.
--
-- The hormone markers have no usual range on purpose: their ranges depend on the cycle phase, so a result is flagged
-- only against the range printed on the person's own report.
--
-- Both tables are per person from the start, with the own-rows policy and the cascade from auth.users that every
-- personal table has, so deleting an account deletes them. Safe to run twice.

create table if not exists public.cycle_days (
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  day date not null,
  flow text not null check (flow in ('spotting', 'light', 'medium', 'heavy')),
  symptoms text[] not null default '{}'
    check (symptoms <@ array['cramps', 'headache', 'bloating', 'tender_breasts', 'mood', 'tiredness', 'acne', 'back_pain']::text[]),
  source text not null default 'manual' check (source in ('manual', 'healthkit', 'health_connect')),
  created_at timestamptz not null default now(),
  primary key (user_id, day, source),
  constraint cycle_days_not_before_1950 check (day >= date '1950-01-01')
);

create table if not exists public.profile_conditions (
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  condition text not null check (condition in ('pcos', 'endometriosis', 'thyroid', 'hormonal_contraception', 'pregnant', 'breastfeeding', 'perimenopause', 'menopause')),
  label text check (label is null or char_length(btrim(label)) between 1 and 40),
  since date,
  created_at timestamptz not null default now(),
  primary key (user_id, condition)
);

alter table public.cycle_days enable row level security;
alter table public.profile_conditions enable row level security;

do $$
begin
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'cycle_days' and policyname = 'own_rows') then
    create policy own_rows on public.cycle_days for all to authenticated
      using (user_id = (select auth.uid()))
      with check (user_id = (select auth.uid()));
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'profile_conditions' and policyname = 'own_rows') then
    create policy own_rows on public.profile_conditions for all to authenticated
      using (user_id = (select auth.uid()))
      with check (user_id = (select auth.uid()));
  end if;
end
$$;

revoke all on public.cycle_days from anon;
revoke all on public.profile_conditions from anon;

-- the reproductive hormones, with no usual range (see above)
insert into public.biomarkers (code, name, unit, category, organ_systems, sort_order)
select v.code, v.name, v.unit, 'hormonal', array['reproductive'], v.sort_order
from (values
  ('oestradiol', 'Oestradiol', 'pg/mL', 200),
  ('progesterone', 'Progesterone', 'ng/mL', 201),
  ('lh', 'LH', 'mIU/mL', 202),
  ('fsh', 'FSH', 'mIU/mL', 203),
  ('prolactin', 'Prolactin', 'ng/mL', 204),
  ('shbg', 'SHBG', 'nmol/L', 205)
) as v(code, name, unit, sort_order)
where not exists (select 1 from public.biomarkers b where b.code = v.code);
