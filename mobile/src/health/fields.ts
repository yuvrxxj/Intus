import { dayNumber } from '../../../src/lib/dates.ts';

// Which Intus fields Apple Health can supply, and which of them lock. The table is docs/ios/APPLE_HEALTH.md.
// Nothing here asks Health for anything: `READ_TYPES` in healthkit.ts still holds only sleep, HRV and resting heart rate.

export type HealthFieldId =
  | 'sleep'
  | 'hrv'
  | 'resting_hr'
  | 'steps'
  | 'active_kcal'
  | 'exercise_minutes'
  | 'water'
  | 'weight'
  | 'calories'
  | 'protein'
  | 'carbs'
  | 'fat'
  | 'lift'
  | 'mood';

export interface HealthField {
  id: HealthFieldId;
  /** the Health type or types it is read from */
  types: readonly string[];
  /** how a day's samples become one number */
  perDay: 'sum' | 'latest' | 'nights' | 'suggestion';
  /** a locked field is read-only on Today while Health is supplying it */
  lock: boolean;
  /** already read by the app today */
  connected: boolean;
}

export const HEALTH_FIELDS: readonly HealthField[] = [
  { id: 'sleep', types: ['HKCategoryTypeIdentifierSleepAnalysis'], perDay: 'nights', lock: true, connected: true },
  { id: 'hrv', types: ['HKQuantityTypeIdentifierHeartRateVariabilitySDNN'], perDay: 'latest', lock: true, connected: true },
  { id: 'resting_hr', types: ['HKQuantityTypeIdentifierRestingHeartRate'], perDay: 'latest', lock: true, connected: true },
  { id: 'steps', types: ['HKQuantityTypeIdentifierStepCount'], perDay: 'sum', lock: true, connected: false },
  { id: 'active_kcal', types: ['HKQuantityTypeIdentifierActiveEnergyBurned'], perDay: 'sum', lock: true, connected: false },
  { id: 'exercise_minutes', types: ['HKQuantityTypeIdentifierAppleExerciseTime'], perDay: 'sum', lock: true, connected: false },
  { id: 'water', types: ['HKQuantityTypeIdentifierDietaryWater'], perDay: 'sum', lock: false, connected: false },
  { id: 'weight', types: ['HKQuantityTypeIdentifierBodyMass'], perDay: 'latest', lock: false, connected: false },
  { id: 'calories', types: ['HKQuantityTypeIdentifierDietaryEnergyConsumed'], perDay: 'sum', lock: false, connected: false },
  { id: 'protein', types: ['HKQuantityTypeIdentifierDietaryProtein'], perDay: 'sum', lock: false, connected: false },
  { id: 'carbs', types: ['HKQuantityTypeIdentifierDietaryCarbohydrates'], perDay: 'sum', lock: false, connected: false },
  { id: 'fat', types: ['HKQuantityTypeIdentifierDietaryFatTotal'], perDay: 'sum', lock: false, connected: false },
  { id: 'lift', types: ['HKWorkoutTypeIdentifier'], perDay: 'suggestion', lock: false, connected: false },
  { id: 'mood', types: ['HKStateOfMindTypeIdentifier'], perDay: 'suggestion', lock: false, connected: false },
];

/** How many days without a sample before a field unlocks. A watch left in a drawer should not lock a person out. */
export const UNLOCK_AFTER_DAYS = 3;

/**
 * Whether a field is locked on `today`. iOS never says whether a read permission was granted, so "connected" means
 * samples came back: lastSampleDay is the newest local day a sync returned samples for this field, or null for never.
 * A field locks only if it is a locking field, the field is being read, and a sample is recent.
 */
export function isLocked(field: HealthField, lastSampleDay: string | null, today: string, reading: boolean): boolean {
  if (!field.lock || !reading || lastSampleDay === null) return false;
  const gap = dayNumber(today) - dayNumber(lastSampleDay);
  return gap >= 0 && gap <= UNLOCK_AFTER_DAYS;
}
