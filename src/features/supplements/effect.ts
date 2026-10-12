import type { CardioLog } from '../../db/cardio.ts';
import type { EffectLog } from '../../db/dailyLogs.ts';
import type { Habit } from '../../db/habits.ts';
import type { Medication } from '../../db/medications.ts';
import type { Biomarker, BiomarkerReading } from '../../db/queries.ts';
import { dayNumber, isoDay } from '../../lib/dates.ts';
import { toNumberOrNull } from '../../lib/numbers.ts';
import { rangeStatus, type RangeContext, type RangeStatus } from '../bloodwork/model.ts';
import { isKind, parseEntries } from '../habits/model.ts';

/*
 * "What changed since I started" for a supplement. This is two periods set side by side, not an experiment:
 * nothing here can say the supplement caused a change, and the screen says so. The rules are deliberately
 * cautious, because a confident-looking chart built on a few noisy days teaches people things that are not true.
 *
 *   before: the 28 days before the start date.
 *   after:  from day 8 after the start (the first week is ramp-up) for up to 56 days, never past the end date or today.
 *   A verdict needs at least 10 logged days in each period. Fewer than that and the row says so and nothing more.
 *   "Higher" or "lower" needs a medium-sized shift (0.5 pooled standard deviations) that is also more than two
 *   standard errors of the difference. Anything smaller is "no clear change", which includes "too small to tell
 *   apart from an ordinary run of days".
 */

export const BEFORE_DAYS = 28;
export const RAMP_DAYS = 7;
export const AFTER_MAX_DAYS = 56;
export const MIN_DAYS = 10;
export const MIN_EFFECT_SIZE = 0.5;
/** Roughly the 95% point for these sample sizes. Daily data is autocorrelated, so this is if anything generous. */
export const SE_MULTIPLE = 2;
/** A blood result drawn sooner than this after starting says little about the supplement. */
export const BLOOD_MIN_DAYS_ON = 14;

/** Where a row comes from, so the screen can group them: the daily log's own numbers, your habits, or heart readings. */
export type MetricGroup = 'log' | 'habit' | 'cardio';

export interface MetricDef {
  id: string;
  label: string;
  unit: string;
  read: (log: EffectLog) => unknown;
}

/** The numbers a person logs each day. None is called good or bad: whether up is better depends on the person's goal. */
export const METRICS: readonly MetricDef[] = [
  { id: 'weight', label: 'Weight', unit: 'kg', read: (l) => l.weight },
  { id: 'mood', label: 'Mood', unit: '', read: (l) => l.mood },
  { id: 'steps', label: 'Steps', unit: 'steps', read: (l) => l.steps },
  { id: 'calories', label: 'Calories eaten', unit: 'kcal', read: (l) => l.total_cals },
  { id: 'protein', label: 'Protein', unit: 'g', read: (l) => l.protein },
  { id: 'water', label: 'Water', unit: 'ml', read: (l) => l.water_ml },
  { id: 'active', label: 'Active calories', unit: 'kcal', read: (l) => l.active_kcal },
];

/** A yes or no habit is shown as the share of logged days it was a yes, so its average reads as a percentage. */
export const YES_NO_UNIT = '% of days';

/**
 * One row per habit, archived ones included (a habit dropped since the start can still have a before period).
 * A yes or no habit counts a yes as 100 and a no as 0; a count or an amount is its number. A day with no entry for
 * the habit is not a logged day for it, which is not the same as a no or a zero.
 */
export function habitMetrics(habits: readonly Pick<Habit, 'id' | 'name' | 'kind' | 'unit'>[]): MetricDef[] {
  return habits
    .filter((h) => isKind(h.kind))
    .map((h) => ({
      id: `habit:${h.id}`,
      label: h.name,
      unit: h.kind === 'yesno' ? YES_NO_UNIT : (h.unit ?? '').trim(),
      read: (log: EffectLog) => {
        const entry = parseEntries(log.habits)[h.id];
        if (entry === undefined) return null;
        if (h.kind === 'yesno') return entry.value === true || (typeof entry.value === 'number' && entry.value > 0) ? 100 : 0;
        return typeof entry.value === 'number' ? entry.value : null;
      },
    }));
}

interface CardioDef {
  id: string;
  label: string;
  unit: string;
  read: (row: CardioLog) => unknown;
}

/** Heart readings from a watch or a phone. Several readings on one day are averaged into that day's value. */
export const CARDIO_METRICS: readonly CardioDef[] = [
  { id: 'hrv', label: 'Heart rate variability', unit: 'ms', read: (r) => r.hrv_ms },
  { id: 'resting_hr', label: 'Resting heart rate', unit: 'bpm', read: (r) => r.resting_hr },
];

export interface Windows {
  beforeFrom: number;
  beforeTo: number;
  afterFrom: number;
  /** can be before afterFrom, which means there is nothing in the period yet */
  afterTo: number;
}

/** Day numbers for both periods, or null when the supplement has no start date to measure from. */
export function windowsFor(item: Pick<Medication, 'start_date' | 'end_date'>, today: string): Windows | null {
  if (item.start_date == null) return null;
  const start = dayNumber(item.start_date);
  const afterFrom = start + RAMP_DAYS + 1;
  const stop = Math.min(item.end_date != null ? dayNumber(item.end_date) : Infinity, dayNumber(today), afterFrom + AFTER_MAX_DAYS - 1);
  return { beforeFrom: start - BEFORE_DAYS, beforeTo: start - 1, afterFrom, afterTo: stop };
}

export interface WindowStats {
  /** days with a logged value */
  n: number;
  mean: number | null;
  /** sample standard deviation; null with fewer than two days */
  sd: number | null;
}

export function statsOf(values: readonly number[]): WindowStats {
  const n = values.length;
  if (n === 0) return { n, mean: null, sd: null };
  const mean = values.reduce((a, b) => a + b, 0) / n;
  if (n < 2) return { n, mean, sd: null };
  const variance = values.reduce((a, b) => a + (b - mean) ** 2, 0) / (n - 1);
  return { n, mean, sd: Math.sqrt(variance) };
}

export type Verdict = 'insufficient_data' | 'no_clear_change' | 'higher' | 'lower';

export interface Comparison {
  diff: number | null;
  /** null when the before average is zero, because a percentage of zero means nothing */
  percent: number | null;
  /** difference in pooled standard deviations; null when it cannot be worked out */
  effectSize: number | null;
  verdict: Verdict;
}

export function compare(before: WindowStats, after: WindowStats): Comparison {
  if (before.n < MIN_DAYS || after.n < MIN_DAYS || before.mean === null || after.mean === null || before.sd === null || after.sd === null) {
    return { diff: null, percent: null, effectSize: null, verdict: 'insufficient_data' };
  }
  const diff = after.mean - before.mean;
  const percent = before.mean === 0 ? null : (diff / Math.abs(before.mean)) * 100;
  const pooled = Math.sqrt(((before.n - 1) * before.sd ** 2 + (after.n - 1) * after.sd ** 2) / (before.n + after.n - 2));
  const se = Math.sqrt(before.sd ** 2 / before.n + after.sd ** 2 / after.n);
  const direction: Verdict = diff > 0 ? 'higher' : 'lower';

  if (diff === 0) return { diff, percent, effectSize: pooled === 0 ? null : 0, verdict: 'no_clear_change' };
  // both periods flat but at different levels: the shift is real in the data, though a ratio to zero spread is meaningless
  if (pooled === 0) return { diff, percent, effectSize: null, verdict: direction };
  const effectSize = diff / pooled;
  const shifted = Math.abs(effectSize) >= MIN_EFFECT_SIZE && Math.abs(diff) > SE_MULTIPLE * se;
  return { diff, percent, effectSize, verdict: shifted ? direction : 'no_clear_change' };
}

export interface MetricEffect extends Comparison {
  id: string;
  label: string;
  unit: string;
  group: MetricGroup;
  before: WindowStats;
  after: WindowStats;
}

/** What else, beyond the daily log's own numbers, the comparison can read. Both are optional. */
export interface EffectExtras {
  habits?: readonly Pick<Habit, 'id' | 'name' | 'kind' | 'unit'>[];
  cardio?: readonly CardioLog[];
  /** the person's sex, for the blood results' ranges */
  sex?: string | null;
  pregnant?: boolean;
}

/** One value per calendar day. A day whose value is missing or not a finite number is left out rather than read as zero. */
function seriesOf<T>(rows: readonly T[], dateOf: (row: T) => string, read: (row: T) => unknown, label: string): Map<number, number> {
  const sums = new Map<number, { total: number; n: number }>();
  for (const row of rows) {
    let value: number | null;
    let day: number;
    try {
      value = toNumberOrNull(read(row), label);
      day = dayNumber(dateOf(row));
    } catch {
      // an unreadable value, or a date that cannot be placed in either period
      continue;
    }
    if (value === null) continue;
    const sum = sums.get(day) ?? { total: 0, n: 0 };
    sum.total += value;
    sum.n += 1;
    sums.set(day, sum);
  }
  const out = new Map<number, number>();
  for (const [day, { total, n }] of sums) out.set(day, total / n);
  return out;
}

function within(series: ReadonlyMap<number, number>, from: number, to: number): number[] {
  const values: number[] = [];
  for (const [day, value] of series) if (day >= from && day <= to) values.push(value);
  return values;
}

/**
 * The daily log's numbers first, then habits, then heart readings. Only metrics with at least one logged day in either
 * period are returned; the rest have nothing to show.
 */
export function metricEffects(
  item: Pick<Medication, 'start_date' | 'end_date'>,
  logs: readonly EffectLog[],
  today: string,
  extras: EffectExtras = {},
): MetricEffect[] {
  const w = windowsFor(item, today);
  if (!w) return [];
  const sources: { id: string; label: string; unit: string; group: MetricGroup; series: Map<number, number> }[] = [
    ...METRICS.map((m) => ({ ...m, group: 'log' as const, series: seriesOf(logs, (l) => l.log_date, m.read, m.id) })),
    ...habitMetrics(extras.habits ?? []).map((m) => ({ ...m, group: 'habit' as const, series: seriesOf(logs, (l) => l.log_date, m.read, m.id) })),
    ...CARDIO_METRICS.map((m) => ({ ...m, group: 'cardio' as const, series: seriesOf(extras.cardio ?? [], (r) => r.measured_at, m.read, m.id) })),
  ];
  const out: MetricEffect[] = [];
  for (const { id, label, unit, group, series } of sources) {
    const before = statsOf(within(series, w.beforeFrom, w.beforeTo));
    const after = statsOf(within(series, w.afterFrom, w.afterTo));
    if (before.n === 0 && after.n === 0) continue;
    out.push({ id, label, unit, group, before, after, ...compare(before, after) });
  }
  return out;
}

export interface BloodPair {
  biomarker: Biomarker;
  before: { measured_at: string; value: number; range: RangeStatus };
  after: { measured_at: string; value: number; range: RangeStatus };
  delta: number;
  percent: number | null;
  /** days between the start date and the after result */
  daysOn: number;
}

function rangeOrNone(biomarker: Biomarker, value: number, ctx: RangeContext): RangeStatus {
  try {
    return rangeStatus(biomarker, value, ctx);
  } catch {
    return 'no_range';
  }
}

/**
 * For each marker: the last result on or before the start date, and the latest result at least two weeks in that is
 * not past the end date. Two numbers, not a trend, and lab-to-lab and day-to-day variation alone moves many markers
 * by several percent. A reading that cannot be read as a number is skipped here, unlike on the Bloodwork screen,
 * because this view only ever compares and never decides whether something is dangerous.
 */
export function bloodPairs(
  item: Pick<Medication, 'start_date' | 'end_date'>,
  biomarkers: readonly Biomarker[],
  readings: readonly BiomarkerReading[],
  /** the person's sex, so a default range for the other sex is never used; each result's printed range comes first */
  sex: string | null = null,
  pregnant = false,
): BloodPair[] {
  if (item.start_date == null) return [];
  const start = dayNumber(item.start_date);
  const end = item.end_date != null ? dayNumber(item.end_date) : Infinity;
  const byMarker = new Map<string, { day: number; at: string; value: number; reading: BiomarkerReading }[]>();
  for (const r of readings) {
    let value: number;
    let day: number;
    try {
      value = toNumberOrNull(r.value, 'reading') ?? Number.NaN;
      day = dayNumber(r.measured_at);
    } catch {
      continue;
    }
    if (!Number.isFinite(value)) continue;
    const list = byMarker.get(r.biomarker_id) ?? [];
    list.push({ day, at: r.measured_at.slice(0, 10), value, reading: r });
    byMarker.set(r.biomarker_id, list);
  }

  const out: BloodPair[] = [];
  for (const biomarker of biomarkers) {
    const list = (byMarker.get(biomarker.id) ?? []).sort((a, b) => a.day - b.day);
    const before = [...list].reverse().find((p) => p.day <= start);
    const after = [...list].reverse().find((p) => p.day >= start + BLOOD_MIN_DAYS_ON && p.day <= end);
    if (!before || !after) continue;
    const delta = after.value - before.value;
    out.push({
      biomarker,
      before: { measured_at: before.at, value: before.value, range: rangeOrNone(biomarker, before.value, { sex, printed: before.reading, pregnant }) },
      after: { measured_at: after.at, value: after.value, range: rangeOrNone(biomarker, after.value, { sex, printed: after.reading, pregnant }) },
      delta,
      percent: before.value === 0 ? null : (delta / Math.abs(before.value)) * 100,
      daysOn: after.day - start,
    });
  }
  return out;
}

/**
 * Other supplements started or stopped close enough to this comparison that their effects cannot be told apart from
 * this one's. "Close enough" runs from a week before the before-period opens (a start that far back is still ramping
 * up inside it) to the end of the after-period. One taken throughout, unchanged, is not a confounder and is not listed.
 */
export function concurrentChanges(
  item: Pick<Medication, 'id' | 'start_date' | 'end_date'>,
  all: readonly Pick<Medication, 'id' | 'name' | 'start_date' | 'end_date'>[],
  today: string,
): string[] {
  const w = windowsFor(item, today);
  if (!w) return [];
  const from = w.beforeFrom - RAMP_DAYS;
  const to = Math.max(w.afterTo, w.afterFrom);
  const inside = (date: string | null) => date != null && dayNumber(date) >= from && dayNumber(date) <= to;
  return all.filter((o) => o.id !== item.id && (inside(o.start_date) || inside(o.end_date))).map((o) => o.name);
}

export type ReportStatus = 'no_start_date' | 'not_started' | 'ready';

export interface EffectReport {
  status: ReportStatus;
  windows: Windows | null;
  metrics: MetricEffect[];
  blood: BloodPair[];
  overlaps: string[];
  /** when each period could first hold enough days for a verdict, as 'YYYY-MM-DD'; null with no start date */
  earliestVerdict: string | null;
}

export function effectReport(
  item: Medication,
  all: readonly Medication[],
  logs: readonly EffectLog[],
  biomarkers: readonly Biomarker[],
  readings: readonly BiomarkerReading[],
  today: string,
  extras: EffectExtras = {},
): EffectReport {
  const windows = windowsFor(item, today);
  if (!windows || item.start_date == null) {
    return { status: 'no_start_date', windows: null, metrics: [], blood: [], overlaps: [], earliestVerdict: null };
  }
  const start = dayNumber(item.start_date);
  const earliestVerdict = isoDay(start + RAMP_DAYS + MIN_DAYS);
  if (start > dayNumber(today)) {
    return { status: 'not_started', windows, metrics: [], blood: [], overlaps: [], earliestVerdict };
  }
  return {
    status: 'ready',
    windows,
    metrics: metricEffects(item, logs, today, extras),
    blood: bloodPairs(item, biomarkers, readings, extras.sex ?? null, extras.pregnant ?? false),
    overlaps: concurrentChanges(item, all, today),
    earliestVerdict,
  };
}
