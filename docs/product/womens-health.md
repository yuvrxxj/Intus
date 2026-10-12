# Women's health module: plan

Written 12 Oct 2026 for INT-16. This is a plan, not a build. Nothing here changes the app or the database yet.

The rule from the Sprint 2 plan holds throughout: **ranges and flags are data in code and in the database; a model may explain a result but never decides one.** No phase below adds a score, a diagnosis, a fertility prediction or a dose.

## What is true today

- Onboarding asks sex (`profile.sex`, male or female) and age. Screening rules already gate on sex (`src/lib/screening.ts`).
- `biomarkers` holds **one** reference range per marker (`ref_low`, `ref_high`), with no sex, age or cycle phase. Several of the stored ranges are male ranges (haemoglobin 13.5 to 17.5 g/dL, testosterone 300 to 1000 ng/dL), so a woman entering results today is flagged against them. This is the most urgent gap, and it is not specific to the women's module: INT-63 (per-age and per-sex reference ranges) is the same work.
- None of oestradiol, progesterone, LH, FSH, prolactin, AMH or SHBG is in the marker list.
- No cycle data is stored. Apple Health and Health Connect both carry menstrual flow and cycle data, but reading them needs the phone app (INT-6).

## Phases

### Phase 0: stop flagging women against male ranges (small, do first)

1. Add sex-specific reference ranges as rows, not columns (data model below), starting with the markers where the difference is large and well documented: haemoglobin, ferritin, serum iron, creatinine, uric acid, HDL, testosterone, and the full blood count once it is added.
2. Until a marker has a range for the person's sex, show the result with **no range flag** rather than the other sex's flag. "No range for you yet" is honest; a wrong "low" is not.
3. Hide male-only items for women (the prostate screening rows already are; check the knowledge base and any copy that assumes a male reader).
4. One line in the Bloodwork section's empty space, not a warning: "Cycle-aware ranges are coming." (The README's rule of one footer disclaimer stays; this is a feature note, not a caveat.)

### Phase 1: cycle tracking

- A **Cycle** card in Goals and habits, or its own section if it grows: period start and end days, flow (light, medium, heavy), and optional symptoms from a short fixed list. Entered by hand first.
- Derived and shown, never stored: cycle day, cycle length history (median and range over the last 6 cycles, nothing under 3), period length. No ovulation or fertile-window prediction: that is a contraception claim, and a regulated one in most markets.
- Later, imported from HealthKit (`HKCategoryTypeIdentifierMenstrualFlow`) and Health Connect (`MenstruationPeriodRecord`, `MenstruationFlowRecord`) through the phone app, with the same one-source-per-day rule as sleep: never blend two sources, show which one was used.

### Phase 2: the cycle phase on each blood draw

- When a woman enters a result, record the cycle day if known (from Phase 1 data or typed in), and a phase: menstrual, follicular, ovulatory, luteal, or "not cycling" (pregnancy, menopause, hormonal contraception that suppresses cycling, or unknown).
- Add the reproductive hormones to the marker list: oestradiol, progesterone, LH, FSH, and later prolactin, SHBG and AMH.
- Phase-aware ranges for those hormones, from the range table below. A hormone result with no phase recorded is shown with the lab's printed range only and no Intus flag, because a single range across the cycle is wrong for most of the month.

### Phase 3: conditions and life stages on the profile

- Optional profile fields: PCOS, endometriosis, thyroid condition, hormonal contraception (type), pregnant (with due date), breastfeeding, perimenopause, menopause (with date of last period).
- **PCOS and PCOD:** "PCOD" is a term used mainly in India for what international guidelines call PCOS or polycystic ovarian morphology. Store one condition, PCOS, and show the label the person chose. Ask a specialist whether to keep both labels (open question 3).
- **Pregnancy pauses interpretation.** Many ranges change in pregnancy (haemoglobin, thyroid, creatinine, ALP and more). While "pregnant" is set, results are shown and charted with the lab's printed range only, and no Intus range flag, critical-value banner change, or trend label is shown for markers that pregnancy moves. A pregnancy-specific range set can come later, from a specialist.
- **Menopause:** after menopause, hormone ranges switch to the postmenopausal set, and the cycle card switches off.
- Conditions change nothing on their own except which range set applies and which items are shown. They never produce advice.

### Phase 4: explanations (optional, after the lab exercise gate)

Only if the ten-panel lab exercise (`lab-panel-exercise.md`) passes. A small model may write a plain-language explanation from facts code has already computed: the result, the range used, the phase it was taken in, and which range set applied. The same rubric applies: no diagnosis, no dose, no reassurance about an out-of-range result.

## Data model (proposal, for review; no migration yet)

Ranges move from columns on `biomarkers` to a table of rows, so a marker can carry as many ranges as it needs and each says where it came from.

```sql
create table public.reference_ranges (
  id uuid primary key default gen_random_uuid(),
  biomarker_id uuid not null references public.biomarkers (id),
  sex text check (sex in ('female', 'male')),            -- null: applies to both
  age_min int, age_max int,                              -- null: no bound
  phase text check (phase in ('menstrual', 'follicular', 'ovulatory', 'luteal', 'postmenopausal', 'pregnancy_t1', 'pregnancy_t2', 'pregnancy_t3')),
  ref_low numeric, ref_high numeric,
  unit text not null,                                    -- must equal the marker's unit; a check enforces it
  source text not null,                                  -- citation: lab, guideline or specialist, with year
  reviewed_by text, reviewed_on date                     -- who signed it off; null means not yet reviewed
);
-- readable by everyone signed in, written only by migrations, like biomarkers

alter table public.biomarker_readings add column cycle_day int check (cycle_day between 1 and 60);
alter table public.biomarker_readings add column cycle_phase text check (cycle_phase in ('menstrual', 'follicular', 'ovulatory', 'luteal', 'not_cycling', 'unknown'));

create table public.cycle_days (                         -- per user, row-level security like daily_logs
  user_id uuid not null default auth.uid(),
  day date not null,
  flow text check (flow in ('none', 'spotting', 'light', 'medium', 'heavy')),
  symptoms text[] not null default '{}',
  source text not null default 'manual',
  primary key (user_id, day, source)
);

create table public.profile_conditions (                 -- per user
  user_id uuid not null default auth.uid(),
  condition text not null check (condition in ('pcos', 'endometriosis', 'thyroid', 'hormonal_contraception', 'pregnant', 'breastfeeding', 'perimenopause', 'menopause')),
  label text,                                            -- what the person called it, for example PCOD
  since date, until date, detail text,
  primary key (user_id, condition)
);
```

**Choosing a range** (pure code in `src/lib/ranges.ts`, with tests): take the marker's ranges; keep those whose sex, age and phase match the person and the reading (a null field matches anything); prefer the most specific (phase over sex over none); if two equally specific rows match, that is a data error and the screen stops, the same as any other untrusted threshold today. If nothing matches, the result has no range flag. The existing `ref_low` and `ref_high` columns stay as the fallback during the move and are dropped afterwards (with INT-67's cleanup).

**Critical limits stay out of this.** Critical values are a separate safety rule (`src/lib/safety.ts`) and are not changed by phase or condition without a specialist's sign-off.

## The range content: what has to come from a specialist

Phase-specific and pregnancy ranges are clinical content. They are not written here, on purpose. Each row in `reference_ranges` needs a source and a reviewer before it ships.

Where to get them, in order of preference:

1. A women's health specialist (gynaecologist or reproductive endocrinologist) who reviews and signs the table.
2. The printed reference intervals of a large accredited lab in the launch market (for example the lab's own directory of services), cited by lab and year. Ranges differ between assays and labs, which is why the app should always show the lab's printed range next to its own.
3. Published guideline or consensus tables (for example the international evidence-based PCOS guideline for the PCOS-related markers, and trimester-specific thyroid ranges from the relevant thyroid association), cited by edition.

Deliverable for the specialist: a CSV with the columns of `reference_ranges` and one row per marker, sex, age band and phase, which a migration then loads. The same review loop as the clinician scoring sheet in `lab-panels/`.

## Safety rules for the module

- No fertility, ovulation or contraception predictions, ever, without regulatory advice (INT-36 and INT-46).
- No "normal for your cycle" reassurance about a result outside the lab's printed range.
- Pregnancy pauses Intus flags on the markers it moves; the lab's own range is still shown.
- Cycle data is health data in every market, and sensitive in several jurisdictions (reproductive health data in some US states in particular). It stays in the person's own rows, is deleted with the account (`delete_my_account()` must be extended to the new tables, with a test), is included in data export, and is never used for anything but the person's own screens.

## Open questions for you

1. **Order:** Phase 0 is really INT-63. Do Phase 0 and INT-63 together as one piece of work?
2. **Specialist:** who reviews the range table? The lab-panel exercise also needs a clinician (INT-30); one reviewer for both would save time.
3. **PCOS and PCOD:** one condition with the person's own label, or two separate options?
4. **Markets:** cycle tracking and reproductive data carry different legal weight in the US, EU, UK and India. This depends on INT-36 (target markets and regulatory advice).
5. **Contraception:** record only whether it is hormonal and suppresses cycling (affects which ranges apply), or the type as well?

## Follow-up issues

Created in Linear under the Intus project when this plan is approved: Phase 0 (with INT-63), Phase 1 cycle tracking, Phase 2 phase on blood draws and hormone markers, Phase 3 conditions and pregnancy pause, and the specialist range table.
