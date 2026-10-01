-- Stand-in for the live schema as it is before the lockdown migration: same tables and columns, with
-- the open policy the dashboard has been running on (anyone holding the anon key can read and write).
create table public.biomarkers (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  name text not null,
  unit text not null,
  category text not null,
  organ_systems text[] not null default '{}',
  ref_low numeric, ref_high numeric, optimal_low numeric, optimal_high numeric,
  description text,
  sort_order integer default 0,
  created_at timestamptz not null default now(),
  critical_low numeric, critical_high numeric, threshold_source text
);

create table public.biomarker_readings (
  id uuid primary key default gen_random_uuid(),
  biomarker_id uuid not null references public.biomarkers (id),
  value numeric not null,
  measured_at date not null,
  notes text,
  created_at timestamptz not null default now(),
  status text,
  source text default 'seed_demo'
);

create table public.daily_logs (
  id uuid primary key default gen_random_uuid(),
  log_date date not null unique,
  weight double precision, total_cals integer, protein integer, carbs integer, fat integer,
  lift text, core text, cardio text, cigs integer default 0, mood integer, mood_notes text,
  supplements jsonb, saved_at timestamptz default now(), steps integer, water_ml integer default 0,
  active_kcal integer, rings jsonb
);

create table public.body_composition (
  id uuid primary key default gen_random_uuid(),
  measured_at date not null,
  weight_kg numeric, body_fat_pct numeric, lean_mass_kg numeric, muscle_mass_kg numeric,
  visceral_fat numeric, bone_mass_kg numeric, water_pct numeric, bmi numeric,
  created_at timestamptz not null default now()
);

create table public.cardio_metrics (
  id uuid primary key default gen_random_uuid(),
  measured_at date not null,
  vo2_max numeric, resting_hr integer, hrv_ms integer, max_hr integer, recovery_hr integer,
  created_at timestamptz not null default now()
);

create table public.profile (
  id uuid primary key default gen_random_uuid(),
  name text, initials text, age integer, sex text, height_cm numeric, blood_type text,
  start_weight numeric, goal_weight numeric, start_date date, goal_date date,
  bf_start numeric, bf_goal numeric, calorie_target integer, protein_target integer,
  carb_target integer, fat_target integer, water_target integer, step_target integer,
  sleep_goal numeric, onboarded boolean default false, updated_at timestamptz default now(),
  family_colorectal_cancer boolean not null default false,
  family_prostate_cancer boolean not null default false,
  noise_or_blast_exposure boolean not null default false
);

create table public.meals (
  id uuid primary key default gen_random_uuid(),
  log_date date not null default current_date,
  meal text not null, name text not null,
  kcal integer, protein integer, carbs integer, fat integer, emoji text,
  logged_at timestamptz default now()
);

create table public.supplement_catalog (
  id text primary key, name text not null, dose text, tag text, when_taken text,
  daily boolean default true, sunday_only boolean default false, sort_order integer default 0
);

create table public.action_items (
  id text primary key, text text not null, category text, priority text,
  done boolean default false, sort_order integer default 0
);

create table public.devices (
  id text primary key, name text not null, kind text, status text default 'available', last_sync text
);

create table public.photo_log (
  id uuid primary key default gen_random_uuid(),
  log_date date not null, weight numeric, label text, photo_url text
);

create table public.medications (
  id uuid primary key default gen_random_uuid(),
  name text not null, dosage text, frequency text, start_date date, end_date date,
  active boolean generated always as (end_date is null) stored,
  notes text, created_at timestamptz not null default now(),
  paracetamol_mg_per_dose numeric, doses_per_day numeric
);

create table public.diagnoses (
  id uuid primary key default gen_random_uuid(),
  condition text not null,
  status text not null default 'active' check (status in ('active', 'resolved', 'monitoring')),
  diagnosed_date date, notes text, created_at timestamptz not null default now()
);

create table public.screening_rules (
  code text primary key, label text not null, min_age integer, max_age integer,
  sex text check (sex in ('male', 'female')), interval_years integer, requires_flag text,
  rationale text, sort_order integer not null default 0
);

create table public.screening_history (
  id uuid primary key default gen_random_uuid(),
  screening_code text not null references public.screening_rules (code),
  done_date date not null, notes text, created_at timestamptz not null default now()
);

do $$
declare t record;
begin
  for t in select tablename from pg_tables where schemaname = 'public' loop
    execute format('alter table public.%I enable row level security', t.tablename);
    execute format('create policy allow_all on public.%I for all using (true) with check (true)', t.tablename);
  end loop;
end $$;
