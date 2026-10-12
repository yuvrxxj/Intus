import {
  isHealthDataAvailable,
  queryCategorySamples,
  queryQuantitySamples,
  requestAuthorization,
} from '@kingstinct/react-native-healthkit';
import type { QuantitySampleIn, SleepSampleIn } from './sync/mapping';

/** Read only. Intus never writes to Apple Health. */
export const READ_TYPES = [
  'HKCategoryTypeIdentifierSleepAnalysis',
  'HKQuantityTypeIdentifierHeartRateVariabilitySDNN',
  'HKQuantityTypeIdentifierRestingHeartRate',
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
