// HealthKit samples to the rows Intus stores. Pure: no React Native, no network, no clock, so the web repo's tests run it.
//
// Sleep: Apple writes a night as many samples (in bed, asleep, and the core, deep and REM stages), one per stretch.
// They are grouped per source into sessions, kept as the source reported them (the web app merges and chooses between
// sources when it reads, never here), and stored in sleep_sessions with the source's own id so a second sync updates
// rather than duplicates. See supabase/migrations/20261011000100_sleep_sessions.sql and docs/product/sleep-tracker.md.
//
// Heart: heart rate variability (SDNN, ms) and resting heart rate (beats a minute) become one cardio_metrics row per
// local day for the source 'healthkit'. HRV is the mean of that day's readings; resting heart rate is the day's last
// reading, because Apple writes one a day and revises it. Both are whole numbers in the table.

/** HKCategoryValueSleepAnalysis, as numbers so this file needs nothing from the HealthKit library. */
export const SLEEP_VALUE = { inBed: 0, asleepUnspecified: 1, awake: 2, asleepCore: 3, asleepDeep: 4, asleepREM: 5 } as const;

export type Stage = 'asleep' | 'light' | 'deep' | 'rem' | 'awake';

/** Apple's core sleep is what the web app calls light, matching how the research notes map it. */
const STAGE_OF: Record<number, Stage | undefined> = {
  [SLEEP_VALUE.asleepUnspecified]: 'asleep',
  [SLEEP_VALUE.awake]: 'awake',
  [SLEEP_VALUE.asleepCore]: 'light',
  [SLEEP_VALUE.asleepDeep]: 'deep',
  [SLEEP_VALUE.asleepREM]: 'rem',
};

export interface SleepSampleIn {
  uuid: string;
  start: Date;
  end: Date;
  /** an HKCategoryValueSleepAnalysis value */
  value: number;
  /** the app or device that wrote it, for example "Apple Watch" */
  sourceName: string;
}

export interface QuantitySampleIn {
  uuid: string;
  start: Date;
  end: Date;
  value: number;
  sourceName: string;
}

/** Matches the sleep_sessions columns the sync writes. */
export interface SleepRow {
  source_kind: 'healthkit';
  source_name: string;
  external_id: string;
  start_at: string;
  end_at: string;
  start_offset_min: number;
  end_offset_min: number;
  tz_id: string | null;
  stages: { s: number; e: number; t: Stage }[];
  start_is_in_bed: boolean;
  recorded_at: string;
}

export interface CardioRow {
  measured_at: string;
  hrv_ms: number | null;
  resting_hr: number | null;
  source: 'healthkit';
}

/** Same-source samples closer than this are one session. The web app merges up to an hour when it reads. */
export const GROUP_GAP_MIN = 30;
/** The database's limits on one session, and on the stage list. */
export const MIN_SESSION_MIN = 15;
export const MAX_SESSION_MIN = 20 * 60;
export const MAX_STAGES = 3000;
export const MAX_SOURCE_NAME = 80;
/** Readings outside these are a sensor glitch, not a person. */
export const HRV_RANGE = { min: 1, max: 300 } as const;
export const RESTING_HR_RANGE = { min: 25, max: 220 } as const;

const MINUTE = 60_000;

/** Minutes east of UTC at an instant, as the phone's time zone rules give it. */
export type OffsetAt = (at: Date) => number;
export const deviceOffset: OffsetAt = (at) => -at.getTimezoneOffset();

/** The local calendar day of an instant, as 'YYYY-MM-DD'. */
export function localDay(at: Date, offsetAt: OffsetAt = deviceOffset): string {
  return new Date(at.getTime() + offsetAt(at) * MINUTE).toISOString().slice(0, 10);
}

/**
 * Groups one source's samples into sessions and turns each into a row. A session's external id is the uuid of its
 * earliest sample, so the same night synced again lands on the same row even if later samples were added to it.
 * Sessions outside the database's length limits are dropped and counted, never stored half-right.
 */
export function sleepRows(
  samples: readonly SleepSampleIn[],
  options: { offsetAt?: OffsetAt; tzId?: string | null; recordedAt: Date },
): { rows: SleepRow[]; skipped: number } {
  const offsetAt = options.offsetAt ?? deviceOffset;
  const bySource = new Map<string, SleepSampleIn[]>();
  for (const s of samples) {
    if (!(s.end.getTime() > s.start.getTime())) continue;
    const name = s.sourceName.trim().slice(0, MAX_SOURCE_NAME);
    const list = bySource.get(name) ?? [];
    list.push(s);
    bySource.set(name, list);
  }

  const rows: SleepRow[] = [];
  let skipped = 0;
  for (const [sourceName, list] of bySource) {
    list.sort((a, b) => a.start.getTime() - b.start.getTime() || a.end.getTime() - b.end.getTime());
    const groups: SleepSampleIn[][] = [];
    let groupEnd = -Infinity;
    for (const s of list) {
      if (groups.length === 0 || s.start.getTime() - groupEnd > GROUP_GAP_MIN * MINUTE) groups.push([]);
      groups[groups.length - 1].push(s);
      groupEnd = Math.max(groupEnd, s.end.getTime());
    }
    for (const group of groups) {
      const start = Math.min(...group.map((s) => s.start.getTime()));
      const end = Math.max(...group.map((s) => s.end.getTime()));
      const minutes = (end - start) / MINUTE;
      const stages = group
        .flatMap((s) => {
          const t = STAGE_OF[s.value];
          return t ? [{ s: s.start.getTime(), e: s.end.getTime(), t }] : [];
        });
      // a group with only in-bed samples has no sleep in it
      if (stages.length === 0 || minutes < MIN_SESSION_MIN || minutes > MAX_SESSION_MIN || stages.length > MAX_STAGES) {
        skipped++;
        continue;
      }
      const firstStage = Math.min(...stages.map((x) => x.s));
      rows.push({
        source_kind: 'healthkit',
        source_name: sourceName,
        external_id: group[0].uuid,
        start_at: new Date(start).toISOString(),
        end_at: new Date(end).toISOString(),
        start_offset_min: offsetAt(new Date(start)),
        end_offset_min: offsetAt(new Date(end)),
        tz_id: options.tzId ?? null,
        stages,
        // the start is a real in-bed time only when an in-bed sample begins it, before any sleep was recorded
        start_is_in_bed: group.some((s) => s.value === SLEEP_VALUE.inBed && s.start.getTime() === start) && start < firstStage,
        recorded_at: options.recordedAt.toISOString(),
      });
    }
  }
  return { rows, skipped };
}

/** One row per local day with either reading. Readings outside a plausible range are dropped. */
export function cardioRows(hrv: readonly QuantitySampleIn[], resting: readonly QuantitySampleIn[], offsetAt: OffsetAt = deviceOffset): CardioRow[] {
  const days = new Map<string, { hrv: number[]; resting: { at: number; value: number } | null }>();
  const dayOf = (key: string) => {
    let d = days.get(key);
    if (!d) {
      d = { hrv: [], resting: null };
      days.set(key, d);
    }
    return d;
  };
  for (const s of hrv) {
    if (!Number.isFinite(s.value) || s.value < HRV_RANGE.min || s.value > HRV_RANGE.max) continue;
    dayOf(localDay(s.start, offsetAt)).hrv.push(s.value);
  }
  for (const s of resting) {
    if (!Number.isFinite(s.value) || s.value < RESTING_HR_RANGE.min || s.value > RESTING_HR_RANGE.max) continue;
    const d = dayOf(localDay(s.start, offsetAt));
    if (d.resting === null || s.end.getTime() >= d.resting.at) d.resting = { at: s.end.getTime(), value: s.value };
  }
  return [...days.entries()]
    .sort(([a], [b]) => (a < b ? -1 : 1))
    .map(([day, d]) => ({
      measured_at: day,
      hrv_ms: d.hrv.length === 0 ? null : Math.round(d.hrv.reduce((a, b) => a + b, 0) / d.hrv.length),
      resting_hr: d.resting === null ? null : Math.round(d.resting.value),
      source: 'healthkit' as const,
    }));
}

/**
 * Where a sync starts: local midnight a number of days back, so every day it touches is read whole and a day's HRV mean
 * is never worked out from half a day. The first sync reads further back than the later ones.
 */
export function syncWindowStart(now: Date, days: number, offsetAt: OffsetAt = deviceOffset): Date {
  const today = localDay(now, offsetAt);
  const midnightUtc = Date.parse(`${today}T00:00:00Z`) - days * 86_400_000;
  // shift from UTC midnight to local midnight using the offset at that moment
  return new Date(midnightUtc - offsetAt(new Date(midnightUtc)) * MINUTE);
}
