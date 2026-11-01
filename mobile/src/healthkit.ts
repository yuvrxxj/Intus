import {
  isHealthDataAvailable,
  queryCategorySamples,
  queryQuantitySamples,
  queryStatisticsCollectionForQuantity,
  requestAuthorization,
} from '@kingstinct/react-native-healthkit';
import type { DayTotalIn, QuantitySampleIn, SleepSampleIn } from './sync/mapping';

/** Read only. Intus never writes to Apple Health. */
export const READ_TYPES = [
  'HKCategoryTypeIdentifierSleepAnalysis',
  'HKQuantityTypeIdentifierHeartRateVariabilitySDNN',
  'HKQuantityTypeIdentifierRestingHeartRate',
  'HKQuantityTypeIdentifierStepCount',
  'HKQuantityTypeIdentifierActiveEnergyBurned',
] as const;

export const available = (): boolean => isHealthDataAvailable();

/**
 * Shows Apple's permission sheet. iOS never tells an app whether reading was allowed (so nobody can learn that a
 * person has, say, no sleep data); a refusal simply returns no samples, which the status screen explains.
 */
export const askToRead = (): Promise<boolean> => requestAuthorization({ toRead: READ_TYPES });

const since = (from: Date) => ({ limit: -1, ascending: true, filter: { date: { startDate: from } } });

export async function readSleep(from: Date): Promise<SleepSampleIn[]> {
  const samples = await queryCategorySamples('HKCategoryTypeIdentifierSleepAnalysis', since(from));
  return samples.map((s) => ({ uuid: s.uuid, start: s.startDate, end: s.endDate, value: Number(s.value), sourceName: s.sourceRevision.source.name }));
}

export async function readHrv(from: Date): Promise<QuantitySampleIn[]> {
  const samples = await queryQuantitySamples('HKQuantityTypeIdentifierHeartRateVariabilitySDNN', { ...since(from), unit: 'ms' });
  return samples.map((s) => ({ uuid: s.uuid, start: s.startDate, end: s.endDate, value: s.quantity, sourceName: s.sourceRevision.source.name }));
}

export async function readRestingHr(from: Date): Promise<QuantitySampleIn[]> {
  const samples = await queryQuantitySamples('HKQuantityTypeIdentifierRestingHeartRate', { ...since(from), unit: 'count/min' });
  return samples.map((s) => ({ uuid: s.uuid, start: s.startDate, end: s.endDate, value: s.quantity, sourceName: s.sourceRevision.source.name }));
}

/**
 * A day-by-day total, from `from` (a local midnight) to now. This asks Apple for statistics rather than reading raw
 * samples: Apple counts a step once even when an iPhone and an Apple Watch both recorded it, which adding samples up
 * ourselves would double. The newest bucket is today so far.
 */
async function dailyTotals(
  identifier: 'HKQuantityTypeIdentifierStepCount' | 'HKQuantityTypeIdentifierActiveEnergyBurned',
  unit: 'count' | 'kcal',
  from: Date,
): Promise<DayTotalIn[]> {
  const buckets = await queryStatisticsCollectionForQuantity(identifier, ['cumulativeSum'], from, { day: 1 }, { filter: { date: { startDate: from } }, unit });
  return buckets.flatMap((b) => (b.startDate && b.endDate ? [{ start: b.startDate, end: b.endDate, value: b.sumQuantity?.quantity }] : []));
}

export const readDailySteps = (from: Date): Promise<DayTotalIn[]> => dailyTotals('HKQuantityTypeIdentifierStepCount', 'count', from);

export const readDailyActiveEnergy = (from: Date): Promise<DayTotalIn[]> => dailyTotals('HKQuantityTypeIdentifierActiveEnergyBurned', 'kcal', from);
