// Android Health Connect records to the same sample shapes the iPhone sync uses, so mapping.ts and run.ts do the rest.
// Pure: no React Native, no network, no clock, so the web repo's tests run it. The records are described by the few fields
// read here rather than imported from react-native-health-connect, so this file needs nothing from that library.
//
// Sleep: Health Connect writes one SleepSession per sleep, with its stages inside. Each stage becomes one sample, in the
// HealthKit stage numbers mapping.ts already understands, so the same grouping, length limits and stage names apply.
// A session without stages becomes one unspecified-sleep sample over the whole session.
//
// Heart: Health Connect reports HRV as RMSSD (HealthKit: SDNN). They are not the same number, so the rows are stored with
// source 'health_connect' and mapping.ts's HRV_KIND says which measure that source means. Never mix them.

import { SLEEP_VALUE, deviceOffset, localDay, type OffsetAt, type QuantitySampleIn, type SleepSampleIn } from './mapping.ts';

/** SleepSessionRecord stage values (Health Connect's SleepSessionRecord.STAGE_TYPE_*). */
export const HC_SLEEP_STAGE = { unknown: 0, awake: 1, sleeping: 2, outOfBed: 3, light: 4, deep: 5, rem: 6, awakeInBed: 7 } as const;

export interface HcMetadata {
  id?: string;
  /** the package name of the app that wrote the record, for example "com.google.android.apps.fitness" */
  dataOrigin?: string;
}

export interface HcSleepSessionIn {
  metadata?: HcMetadata;
  startTime: string;
  endTime: string;
  stages?: readonly { startTime: string; endTime: string; stage: number }[];
}

export interface HcHrvIn {
  metadata?: HcMetadata;
  time: string;
  /** RMSSD in milliseconds */
  heartRateVariabilityMillis: number;
}

export interface HcRestingHrIn {
  metadata?: HcMetadata;
  time: string;
  beatsPerMinute: number;
}

/** One day's total as Health Connect's own aggregation gives it, which already de-duplicates overlapping apps. */
export interface HcDayTotalIn {
  /** start of the day slice, an ISO instant */
  startTime: string;
  value: number;
}

/**
 * Daily steps and active energy for the Android app. Not stored yet: there is no table for it until INT-147 (Apple
 * Health steps and active calories) lands, and the column names here must be matched to that migration before this is
 * switched on. See TODO(INT-147) in run.ts.
 */
export interface ActivityDayRow {
  /** local calendar day, 'YYYY-MM-DD' */
  measured_at: string;
  steps: number | null;
  active_kcal: number | null;
  source: 'health_connect';
}

/** Package names of the common apps that write to Health Connect. Anything else shows its package name. */
const KNOWN_ORIGINS: Record<string, string> = {
  'com.google.android.apps.fitness': 'Google Fit',
  'com.sec.android.app.shealth': 'Samsung Health',
  'com.fitbit.FitbitMobile': 'Fitbit',
  'com.garmin.android.apps.connectmobile': 'Garmin Connect',
  'com.ouraring.oura': 'Oura',
};

export const FALLBACK_SOURCE_NAME = 'Health Connect';

export function sourceNameOf(dataOrigin: string | undefined): string {
  const origin = dataOrigin?.trim();
  if (!origin) return FALLBACK_SOURCE_NAME;
  return KNOWN_ORIGINS[origin] ?? origin;
}

/** A Health Connect stage as the HealthKit sleep value mapping.ts reads, or null for a stage Intus does not know. */
export function sleepValueOf(stage: number): number | null {
  switch (stage) {
    case HC_SLEEP_STAGE.unknown:
    case HC_SLEEP_STAGE.sleeping:
      return SLEEP_VALUE.asleepUnspecified;
    case HC_SLEEP_STAGE.awake:
    case HC_SLEEP_STAGE.outOfBed:
    case HC_SLEEP_STAGE.awakeInBed:
      return SLEEP_VALUE.awake;
    case HC_SLEEP_STAGE.light:
      return SLEEP_VALUE.asleepCore;
    case HC_SLEEP_STAGE.deep:
      return SLEEP_VALUE.asleepDeep;
    case HC_SLEEP_STAGE.rem:
      return SLEEP_VALUE.asleepREM;
    default:
      return null;
  }
}

const valid = (d: Date) => Number.isFinite(d.getTime());

/** The same session gets the same id on every sync: the record's own id, else its origin and start. */
const sessionId = (s: HcSleepSessionIn) => s.metadata?.id ?? `${s.metadata?.dataOrigin ?? 'hc'}:${s.startTime}`;

export function sleepSamples(sessions: readonly HcSleepSessionIn[]): SleepSampleIn[] {
  const out: SleepSampleIn[] = [];
  for (const session of sessions) {
    const id = sessionId(session);
    const sourceName = sourceNameOf(session.metadata?.dataOrigin);
    const stages = session.stages ?? [];
    if (stages.length === 0) {
      const start = new Date(session.startTime);
      const end = new Date(session.endTime);
      if (valid(start) && valid(end)) out.push({ uuid: `${id}#0`, start, end, value: SLEEP_VALUE.asleepUnspecified, sourceName });
      continue;
    }
    stages.forEach((stage, i) => {
      const value = sleepValueOf(stage.stage);
      const start = new Date(stage.startTime);
      const end = new Date(stage.endTime);
      if (value === null || !valid(start) || !valid(end)) return;
      out.push({ uuid: `${id}#${i}`, start, end, value, sourceName });
    });
  }
  return out;
}

export function hrvSamples(records: readonly HcHrvIn[]): QuantitySampleIn[] {
  return records.flatMap((r) => {
    const at = new Date(r.time);
    if (!valid(at)) return [];
    return [{ uuid: r.metadata?.id ?? `hrv:${r.time}`, start: at, end: at, value: r.heartRateVariabilityMillis, sourceName: sourceNameOf(r.metadata?.dataOrigin) }];
  });
}

export function restingHrSamples(records: readonly HcRestingHrIn[]): QuantitySampleIn[] {
  return records.flatMap((r) => {
    const at = new Date(r.time);
    if (!valid(at)) return [];
    return [{ uuid: r.metadata?.id ?? `rhr:${r.time}`, start: at, end: at, value: r.beatsPerMinute, sourceName: sourceNameOf(r.metadata?.dataOrigin) }];
  });
}

/** One row per local day that has either total. Negative or non-numeric totals are dropped, whole numbers are stored. */
export function activityDays(steps: readonly HcDayTotalIn[], activeKcal: readonly HcDayTotalIn[], offsetAt: OffsetAt = deviceOffset): ActivityDayRow[] {
  const days = new Map<string, { steps: number | null; kcal: number | null }>();
  const dayOf = (key: string) => {
    let d = days.get(key);
    if (!d) {
      d = { steps: null, kcal: null };
      days.set(key, d);
    }
    return d;
  };
  const usable = (t: HcDayTotalIn) => Number.isFinite(t.value) && t.value >= 0 && valid(new Date(t.startTime));
  for (const t of steps) if (usable(t)) dayOf(localDay(new Date(t.startTime), offsetAt)).steps = Math.round(t.value);
  for (const t of activeKcal) if (usable(t)) dayOf(localDay(new Date(t.startTime), offsetAt)).kcal = Math.round(t.value);
  return [...days.entries()]
    .sort(([a], [b]) => (a < b ? -1 : 1))
    .map(([day, d]) => ({ measured_at: day, steps: d.steps, active_kcal: d.kcal, source: 'health_connect' as const }));
}
