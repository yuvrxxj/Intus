import type { EffectLog } from '../../db/dailyLogs.ts';
import type { Medication } from '../../db/medications.ts';
import type { Biomarker, BiomarkerReading } from '../../db/queries.ts';
import { dayNumber, isoDay } from '../../lib/dates.ts';
import { toNumberOrNull } from '../../lib/numbers.ts';
import { rangeStatus, type RangeStatus } from '../bloodwork/model.ts';

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
  before: WindowStats;
  after: WindowStats;
}

/** One value per calendar day. A day whose value is missing or not a finite number is left out rather than read as zero. */
function seriesOf(logs: readonly EffectLog[], metric: MetricDef): Map<number, number> {
  const out = new Map<number, number>();
  for (const log of logs) {
    let value: number | null;
    try {
      value = toNumberOrNull(metric.read(log), metric.id);
    } catch {
      continue;
    }
    if (value === null) continue;
    try {
      out.set(dayNumber(log.log_date), value);
    } catch {
      // a log with an unreadable date cannot be placed in either period
    }
  }
  return out;
}

function within(series: ReadonlyMap<number, number>, from: number, to: number): number[] {
  const values: number[] = [];
  for (const [day, value] of series) if (day >= from && day <= to) values.push(value);
  return values;
}

/** Only metrics with at least one logged day in either period are returned; the rest have nothing to show. */
export function metricEffects(item: Pick<Medication, 'start_date' | 'end_date'>, logs: readonly EffectLog[], today: string): MetricEffect[] {
  const w = windowsFor(item, today);
  if (!w) return [];
  const out: MetricEffect[] = [];
  for (const metric of METRICS) {
    const series = seriesOf(logs, metric);
    const before = statsOf(within(series, w.beforeFrom, w.beforeTo));
    const after = statsOf(within(series, w.afterFrom, w.afterTo));
    if (before.n === 0 && after.n === 0) continue;
    out.push({ id: metric.id, label: metric.label, unit: metric.unit, before, after, ...compare(before, after) });
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

function rangeOrNone(biomarker: Biomarker, value: number): RangeStatus {
  try {
    return rangeStatus(biomarker, value);
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
): BloodPair[] {
  if (item.start_date == null) return [];
  const start = dayNumber(item.start_date);
  const end = item.end_date != null ? dayNumber(item.end_date) : Infinity;
  const byMarker = new Map<string, { day: number; at: string; value: number }[]>();
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
    list.push({ day, at: r.measured_at.slice(0, 10), value });
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
      before: { measured_at: before.at, value: before.value, range: rangeOrNone(biomarker, before.value) },
      after: { measured_at: after.at, value: after.value, range: rangeOrNone(biomarker, after.value) },
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
    metrics: metricEffects(item, logs, today),
    blood: bloodPairs(item, biomarkers, readings),
    overlaps: concurrentChanges(item, all, today),
    earliestVerdict,
  };
}
