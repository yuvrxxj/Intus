import {
  SdkAvailabilityStatus,
  aggregateGroupByPeriod,
  getSdkStatus,
  initialize,
  readRecords,
  requestPermission,
} from 'react-native-health-connect';
import type { QuantitySampleIn, SleepSampleIn } from './sync/mapping';
import {
  hrvSamples,
  restingHrSamples,
  sleepSamples,
  type HcDayTotalIn,
} from './sync/healthConnectMapping';

/**
 * Android's counterpart to healthkit.ts, with the same function names. Read only: Intus never writes to Health Connect.
 * Which of the two is bundled is decided by Metro's platform extensions (health/provider.ts and provider.android.ts), so the
 * iPhone build never loads this file and the Android build never loads HealthKit.
 */
export const READ_PERMISSIONS = [
  { accessType: 'read', recordType: 'SleepSession' },
  { accessType: 'read', recordType: 'HeartRateVariabilityRmssd' },
  { accessType: 'read', recordType: 'RestingHeartRate' },
  { accessType: 'read', recordType: 'Steps' },
  { accessType: 'read', recordType: 'ActiveCaloriesBurned' },
] as const;

/**
 * Health Connect only lets an app read back 30 days unless this one is also granted, and Google reviews it. The first
 * sync asks for 90 days, so it is requested next to the others. Declined is fine: the sync still returns what it can.
 */
const HISTORY_PERMISSION = { accessType: 'read', recordType: 'ReadHealthDataHistory' } as const;

/**
 * Synchronous on purpose: screens call this while rendering. Whether Health Connect is actually installed (Android 13 and
 * below need the Play Store app) is found out by askToRead(), which reports it as a plain failure the status screen explains.
 */
export const available = (): boolean => true;

/**
 * Shows Android's Health Connect permission sheet. Returns true when reading sleep was allowed. Like iOS, a person can
 * allow some types and refuse others, and refused types simply return no records.
 */
export async function askToRead(): Promise<boolean> {
  const status = await getSdkStatus();
  if (status !== SdkAvailabilityStatus.SDK_AVAILABLE) return false;
  if (!(await initialize())) return false;
  const granted = await requestPermission([...READ_PERMISSIONS, HISTORY_PERMISSION]);
  return granted.some((p) => p.recordType === 'SleepSession');
}

const range = (from: Date) => ({ operator: 'between' as const, startTime: from.toISOString(), endTime: new Date().toISOString() });

/** Health Connect hands records out a page at a time. */
async function pages<T>(first: (token: string | undefined) => Promise<{ records: T[]; pageToken?: string }>): Promise<T[]> {
  const all: T[] = [];
  let token: string | undefined;
  do {
    const page = await first(token);
    all.push(...page.records);
    token = page.pageToken;
  } while (token);
  return all;
}

export async function readSleep(from: Date): Promise<SleepSampleIn[]> {
  const records = await pages((pageToken) => readRecords('SleepSession', { timeRangeFilter: range(from), ascendingOrder: true, pageSize: 500, pageToken }));
  return sleepSamples(records);
}

/** RMSSD, in milliseconds. HealthKit's is SDNN: see HRV_KIND in sync/mapping.ts, and never average the two. */
export async function readHrv(from: Date): Promise<QuantitySampleIn[]> {
  const records = await pages((pageToken) => readRecords('HeartRateVariabilityRmssd', { timeRangeFilter: range(from), ascendingOrder: true, pageSize: 1000, pageToken }));
  return hrvSamples(records);
}

export async function readRestingHr(from: Date): Promise<QuantitySampleIn[]> {
  const records = await pages((pageToken) => readRecords('RestingHeartRate', { timeRangeFilter: range(from), ascendingOrder: true, pageSize: 1000, pageToken }));
  return restingHrSamples(records);
}

/**
 * Daily steps and active energy. Health Connect's own aggregation is used, not a sum of records, because a phone and a
 * watch often both write steps for the same minutes and the aggregation de-duplicates them by the person's app priority.
 * Not called by the sync yet: see TODO(INT-147) in sync/run.ts.
 */
export async function readDailyActivity(from: Date): Promise<{ steps: HcDayTotalIn[]; activeKcal: HcDayTotalIn[] }> {
  const timeRangeFilter = range(from);
  const timeRangeSlicer = { period: 'DAYS' as const, length: 1 };
  const [steps, kcal] = await Promise.all([
    aggregateGroupByPeriod({ recordType: 'Steps', timeRangeFilter, timeRangeSlicer }),
    aggregateGroupByPeriod({ recordType: 'ActiveCaloriesBurned', timeRangeFilter, timeRangeSlicer }),
  ]);
  return {
    steps: steps.map((g) => ({ startTime: g.startTime, value: g.result.COUNT_TOTAL })),
    activeKcal: kcal.map((g) => ({ startTime: g.startTime, value: g.result.ACTIVE_CALORIES_TOTAL.inKilocalories })),
  };
}
