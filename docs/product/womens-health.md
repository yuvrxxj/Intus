# Women's health module: plan

Written 12 Oct 2026 for INT-16, revised the same day after review: **the range printed on the person's own report is the range Intus uses.** Every lab prints its range next to each result, already chosen for the person's sex and age (and for the cycle phase, where the lab does that), so Intus does not need its own clinical range tables and no specialist has to write them.

The rule from the Sprint 2 plan holds throughout: **ranges and flags are data in code and in the database; a model may explain a result but never decides one.** No phase below adds a score, a diagnosis, a fertility prediction or a dose.

## What is true today

- Onboarding asks sex (`profile.sex`, male or female) and age. Screening rules already gate on sex (`src/lib/screening.ts`).
- `biomarkers` holds **one** reference range per marker (`ref_low`, `ref_high`), with no sex, age or cycle phase. Several of the stored ranges are male ranges (haemoglobin 13.5 to 17.5 g/dL, testosterone 300 to 1000 ng/dL), so a woman entering results today is flagged against them. This is the most urgent gap, and it is not specific to the women's module: INT-63 (per-age and per-sex reference ranges) is the same work.
- None of oestradiol, progesterone, LH, FSH, prolactin, AMH or SHBG is in the marker list.
- No cycle data is stored. Apple Health and Health Connect both carry menstrual flow and cycle data, but reading them needs the phone app (INT-6).

## Phases

### Phase 0: the printed range on every result (do first; with INT-63)

1. Store the lab's printed range with each result (`biomarker_readings.ref_low`, `ref_high`). The PDF upload (INT-76) reads it off the report; manual entry has two optional fields for it.
2. A result is flagged against its own printed range when it has one. That is the person's own lab, sex, age and, where the lab does it, phase.
3. Without a printed range, the marker's stored default range is used only when it applies to the person. Defaults that are sex-specific are marked as such (`biomarkers.ref_sex`), and a woman's result is never flagged against a male default: it shows "no range" instead. A wrong "low" is worse than none.
4. Hide male-only items for women (the prostate screening rows already are).

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
- **PCOS and PCOD:** "PCOD" is a term used mainly in India for what international guidelines call PCOS or polycystic ovarian morphology. Store one condition, PCOS, and show the label the person chose. Decided: one condition, with the person's own label.
- **Pregnancy pauses interpretation.** Many ranges change in pregnancy (haemoglobin, thyroid, creatinine, ALP and more). While "pregnant" is set, results are shown and charted with the lab's printed range only, and no Intus range flag, critical-value banner change, or trend label is shown for markers that pregnancy moves. Labs that print pregnancy or trimester ranges on the report are used as printed.
- **Menopause:** after menopause, hormone ranges switch to the postmenopausal set, and the cycle card switches off.
- Conditions change nothing on their own except which range set applies and which items are shown. They never produce advice.

### Phase 4: explanations (optional, after the lab exercise gate)

Only if the ten-panel lab exercise (`lab-panel-exercise.md`) passes. A small model may write a plain-language explanation from facts code has already computed: the result, the range used, the phase it was taken in, and which range set applied. The same rubric applies: no diagnosis, no dose, no reassurance about an out-of-range result.

## Data model

Phase 0 (built with INT-63 and INT-104):

```sql
alter table public.biomarker_readings add column ref_low numeric, add column ref_high numeric;  -- as printed on the report
alter table public.biomarkers add column ref_sex text check (ref_sex in ('female', 'male'));       -- the default range is for one sex only
```

Range picking is pure code (`src/lib/ranges.ts`, with tests): the reading's printed range if it has one; otherwise the marker's default if it applies to the person's sex; otherwise no range and no flag.

Later phases:

```sql
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

**Critical limits stay out of this.** Critical values are a separate safety rule (`src/lib/safety.ts`) and do not change with the printed range, phase or condition.

## Where a lab prints one range for the whole cycle

Some labs print a single range for oestradiol, progesterone, LH or FSH, or several ranges side by side (one per phase) that a text reader cannot pick between. Then Intus shows the printed text and the value, and adds no flag of its own unless the person's recorded phase matches one of the printed phase ranges. Intus never writes phase ranges itself.

## Safety rules for the module

- No fertility, ovulation or contraception predictions, ever, without regulatory advice (INT-36 and INT-46).
- No "normal for your cycle" reassurance about a result outside the lab's printed range.
- Pregnancy pauses Intus flags on the markers it moves; the lab's own range is still shown.
- Cycle data is health data in every market, and sensitive in several jurisdictions (reproductive health data in some US states in particular). It stays in the person's own rows, is deleted with the account (`delete_my_account()` must be extended to the new tables, with a test), is included in data export, and is never used for anything but the person's own screens.

## Built (12 Oct 2026)

- Phase 0: printed range on each result, sex-specific defaults never used for the other sex (`src/lib/ranges.ts`).
- Phase 1: cycle days, typed in, with the summary and no predictions (`src/features/cycle/`). Import from Apple Health and Health Connect is still to come, through the phone app.
- Phase 2: the reproductive hormones (oestradiol, progesterone, LH, FSH, prolactin, SHBG) as markers with no usual range, so they are flagged only against printed ranges; each blood result shows its cycle day. A recorded phase per draw was left out: the cycle day is worked out from the logged days instead.
- Phase 3: conditions on the profile; pregnancy switches to printed ranges only.

## Decisions (12 Oct 2026)

1. Phase 0 is done together with INT-63.
2. No specialist: the printed range on the report is the source. INT-105 is cancelled.
3. PCOS and PCOD: one condition, the person's own label.
4. Markets and contraception detail follow INT-36.

## Follow-up issues

In Linear, project Intus: INT-104 (phase 0, with INT-63), INT-76 (PDF upload, which reads the printed ranges), INT-106 (phase 1, cycle tracking), INT-107 (phases 2 and 3).
