import type { Biomarker, BiomarkerReading, Medication } from '../../db/queries.ts';
import { dayNumber } from '../../lib/dates.ts';
import { biotinWarnings, type BiotinWarning } from '../../lib/drugChecks.ts';
import { toNumber, toNumberOrNull } from '../../lib/numbers.ts';
import { checkCritical, criticalFindings, type CriticalFinding, type CriticalResult } from '../../lib/safety.ts';
import { trendOfReadings, TREND, type TrendResult } from '../../lib/trends.ts';

/** Where a value sits against the lab reference range stored on the biomarker. */
export type RangeStatus = 'in_range' | 'below' | 'above' | 'no_range';

export type ChangeDirection = 'up' | 'down' | 'flat';

export interface Point {
  id: string;
  measured_at: string;
  day: number;
  value: number;
  source: string | null;
  notes: string | null;
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
  refLow: number | null;
  refHigh: number | null;
  critical: CriticalResult;
  change: Change | null;
  /** Mann-Kendall over all results; insufficient_data until there are five */
  trend: TrendResult;
  /** biotin warnings for any of this marker's results, matched to readings by id */
  biotin: BiotinWarning[];
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
  /** biomarkers with no critical limit at all, so a critical value could never be flagged for them */
  unwatched: string[];
  /** biomarkers that have no results yet */
  noResults: string[];
  /** how many markers have enough results for a statistical trend */
  trendable: number;
}

function toPoint(reading: BiomarkerReading, label: string): Point {
  return {
    id: reading.id,
    measured_at: reading.measured_at,
    day: dayNumber(reading.measured_at),
    value: toNumber(reading.value, `${label} value`),
    source: reading.source,
    notes: reading.notes,
  };
}

export function rangeStatus(biomarker: Biomarker, value: number): RangeStatus {
  const label = biomarker.code;
  const low = toNumberOrNull(biomarker.ref_low, `${label} ref_low`);
  const high = toNumberOrNull(biomarker.ref_high, `${label} ref_high`);
  if (low === null && high === null) return 'no_range';
  if (low !== null && high !== null && low > high) {
    throw new RangeError(`${label}: ref_low (${low}) must not be above ref_high (${high})`);
  }
  if (low !== null && value < low) return 'below';
  if (high !== null && value > high) return 'above';
  return 'in_range';
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
 * Everything the Bloodwork screen shows, derived from three table reads. It throws on data it cannot trust
 * (a reading with no biomarker, a threshold that is not a number, an inverted range) rather than skipping it,
 * because a skipped reading could be the dangerous one.
 */
export function buildBloodworkView(input: {
  biomarkers: readonly Biomarker[];
  readings: readonly BiomarkerReading[];
  medications: readonly Medication[];
}): BloodworkView {
  const { biomarkers, readings, medications } = input;

  // Throws for any reading whose biomarker is missing, so orphans surface here and never get dropped below.
  const allFindings = criticalFindings(biomarkers, readings);

  const readingById = new Map(readings.map((r) => [r.id, r]));
  const markerById = new Map(biomarkers.map((b) => [b.id, b]));

  const biotin = biotinWarnings({ medications, readings, biomarkers });
  const biotinByMarker = new Map<string, BiotinWarning[]>();
  for (const warning of biotin) {
    const reading = warning.reading_id === null ? undefined : readingById.get(warning.reading_id);
    if (!reading) continue;
    const list = biotinByMarker.get(reading.biomarker_id) ?? [];
    list.push(warning);
    biotinByMarker.set(reading.biomarker_id, list);
  }

  const pointsByMarker = new Map<string, Point[]>();
  for (const reading of readings) {
    const point = toPoint(reading, markerById.get(reading.biomarker_id)?.code ?? 'biomarker');
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
      range: rangeStatus(biomarker, latest.value),
      refLow: toNumberOrNull(biomarker.ref_low, `${biomarker.code} ref_low`),
      refHigh: toNumberOrNull(biomarker.ref_high, `${biomarker.code} ref_high`),
      critical: checkCritical(biomarker, latest.value),
      change: previous ? changeBetween(previous, latest) : null,
      trend,
      biotin: biotinByMarker.get(biomarker.id) ?? [],
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

  const unwatched = biomarkers
    .filter((b) => b.critical_low == null && b.critical_high == null)
    .map((b) => b.name);

  return {
    groups,
    latestDate,
    readingCount: readings.length,
    dateCount: days.size,
    currentCritical,
    pastCritical,
    unwatched,
    noResults,
    trendable,
  };
}
