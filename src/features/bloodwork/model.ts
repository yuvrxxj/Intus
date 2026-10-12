import type { Biomarker, BiomarkerReading } from '../../db/queries.ts';
import { dayNumber } from '../../lib/dates.ts';
import { toNumber } from '../../lib/numbers.ts';
import {
  checkCritical, criticalFindings, type CriticalFinding, type CriticalResult,
} from '../../lib/safety.ts';
import { chooseRange, statusIn, type ChosenRange, type PrintedRange, type RangeStatus } from '../../lib/ranges.ts';
import { trendOfReadings, TREND, type TrendResult } from '../../lib/trends.ts';

/** Where a value sits against the range chosen for it (see src/lib/ranges.ts). */
export type { RangeStatus } from '../../lib/ranges.ts';

export type ChangeDirection = 'up' | 'down' | 'flat';

export interface Point {
  id: string;
  measured_at: string;
  day: number;
  value: number;
  source: string | null;
  notes: string | null;
  /** the range this result was read against: its printed one, or the marker's default when that applies */
  rangeUsed: ChosenRange;
  range: RangeStatus;
}

/** Movement from the previous result to the latest one. This is a comparison of two numbers, not a statistical trend. */
export interface Change {
  direction: ChangeDirection;
  delta: number;
  /** null when the previous value was zero, because a percentage of zero means nothing */
  percent: number | null;
  days: number;
  from: Point;
}

export interface MarkerRow {
  biomarker: Biomarker;
  /** oldest first */
  points: Point[];
  latest: Point;
  previous: Point | null;
  range: RangeStatus;
  /** the range the latest result was read against, and where it came from */
  rangeUsed: ChosenRange;
  refLow: number | null;
  refHigh: number | null;
  critical: CriticalResult;
  change: Change | null;
  /** Mann-Kendall over all results; insufficient_data until there are five */
  trend: TrendResult;
}

export interface Group {
  category: string;
  rows: MarkerRow[];
}

export interface BloodworkView {
  groups: Group[];
  /** newest result date across everything, or null when there are no results */
  latestDate: string | null;
  readingCount: number;
  dateCount: number;
  /** critical findings that belong to a marker's most recent result */
  currentCritical: CriticalFinding[];
  /** critical findings from older results, newest first */
  pastCritical: CriticalFinding[];
  /** biomarkers that have no results yet */
  noResults: string[];
  /** how many markers have enough results for a statistical trend */
  trendable: number;
}

/** Who the result belongs to (for a default range that is for one sex only) and the range printed with it, if any. */
export interface RangeContext {
  sex: string | null | undefined;
  printed?: PrintedRange | null;
}

function toPoint(reading: BiomarkerReading, biomarker: Biomarker | undefined, sex: string | null | undefined): Point {
  const label = biomarker?.code ?? 'biomarker';
  const value = toNumber(reading.value, `${label} value`);
  const rangeUsed: ChosenRange = biomarker ? chooseRange(biomarker, reading, sex) : { low: null, high: null, source: 'none', reason: 'none_set' };
  return {
    id: reading.id,
    measured_at: reading.measured_at,
    day: dayNumber(reading.measured_at),
    value,
    source: reading.source,
    notes: reading.notes,
    rangeUsed,
    range: statusIn(rangeUsed, value),
  };
}

/** Where a value sits, against the range printed with it, else the marker's default when it applies to the person. */
export function rangeStatus(biomarker: Biomarker, value: number, ctx: RangeContext): RangeStatus {
  return statusIn(chooseRange(biomarker, ctx.printed, ctx.sex), value);
}

export function changeBetween(previous: Point, latest: Point): Change {
  const delta = latest.value - previous.value;
  return {
    direction: delta > 0 ? 'up' : delta < 0 ? 'down' : 'flat',
    delta,
    percent: previous.value === 0 ? null : (delta / Math.abs(previous.value)) * 100,
    days: latest.day - previous.day,
    from: previous,
  };
}

function byTime(a: Point, b: Point): number {
  return a.day - b.day;
}

/**
 * Everything the Bloodwork screen shows, derived from two table reads. It throws on data it cannot trust
 * (a reading with no biomarker, a threshold that is not a number, an inverted range) rather than skipping it,
 * because a skipped reading could be the dangerous one.
 */
export function buildBloodworkView(input: {
  biomarkers: readonly Biomarker[];
  readings: readonly BiomarkerReading[];
  /** the person's sex from their profile, so a default range for the other sex is never used */
  sex: string | null | undefined;
}): BloodworkView {
  const { biomarkers, readings, sex } = input;

  // Throws for any reading whose biomarker is missing, so orphans surface here and never get dropped below.
  const allFindings = criticalFindings(biomarkers, readings);

  const markerById = new Map(biomarkers.map((b) => [b.id, b]));

  const pointsByMarker = new Map<string, Point[]>();
  for (const reading of readings) {
    const point = toPoint(reading, markerById.get(reading.biomarker_id), sex);
    const list = pointsByMarker.get(reading.biomarker_id) ?? [];
    list.push(point);
    pointsByMarker.set(reading.biomarker_id, list);
  }

  const groups: Group[] = [];
  const noResults: string[] = [];
  let trendable = 0;
  const latestDayByMarker = new Map<string, string>();

  for (const biomarker of biomarkers) {
    const points = [...(pointsByMarker.get(biomarker.id) ?? [])].sort(byTime);
    if (points.length === 0) {
      noResults.push(biomarker.name);
      continue;
    }
    const latest = points[points.length - 1];
    const previous = points.length > 1 ? points[points.length - 2] : null;
    const trend = trendOfReadings(points.map((p) => ({ measured_at: p.measured_at, value: p.value })));
    if (trend.direction !== TREND.INSUFFICIENT_DATA) trendable++;
    latestDayByMarker.set(biomarker.id, latest.measured_at);

    const row: MarkerRow = {
      biomarker,
      points,
      latest,
      previous,
      range: latest.range,
      rangeUsed: latest.rangeUsed,
      refLow: latest.rangeUsed.low,
      refHigh: latest.rangeUsed.high,
      critical: checkCritical(biomarker, latest.value),
      change: previous ? changeBetween(previous, latest) : null,
      trend,
    };

    let group = groups.find((g) => g.category === biomarker.category);
    if (!group) {
      group = { category: biomarker.category, rows: [] };
      groups.push(group);
    }
    group.rows.push(row);
  }

  const currentCritical = allFindings.filter((f) => latestDayByMarker.get(f.biomarker_id) === f.measured_at);
  const pastCritical = allFindings.filter((f) => latestDayByMarker.get(f.biomarker_id) !== f.measured_at);

  const days = new Set(readings.map((r) => r.measured_at));
  const latestDate = days.size === 0 ? null : [...days].sort((a, b) => dayNumber(a) - dayNumber(b)).at(-1) ?? null;

  return {
    groups,
    latestDate,
    readingCount: readings.length,
    dateCount: days.size,
    currentCritical,
    pastCritical,
    noResults,
    trendable,
  };
}
