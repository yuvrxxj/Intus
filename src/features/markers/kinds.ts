import { PERSONAL_TABLES, type PersonalTable } from '../export/model.ts';

/*
 * Three kinds of marker, told apart by how and how often the value arrives, not by what it measures:
 *
 *   active    pulled from a wearable or a health platform (Apple Health, Health Connect) with nothing typed: sleep and
 *             heart readings from a watch, steps, a cycle logged in Apple Health. Arrives all day, on its own.
 *   daily     typed in by the person, usually at the end of the day: habits, calories, weight, mood, supplements taken,
 *             a workout, a sleep entry from a diary. One entry a day, and a missed day is a gap.
 *   periodic  measured now and then, never daily: blood results (every 2 to 3 months), screenings, photo check-ins,
 *             body composition scans. Nothing is wrong when a day passes with no new value.
 *
 * Logic that treats a missing value as a gap, or a handful of values as a trend, must ask which kind it is reading.
 */

export type MarkerKind = 'active' | 'daily' | 'periodic';
export const MARKER_KINDS: readonly MarkerKind[] = ['active', 'daily', 'periodic'];

export interface KindDef {
  id: MarkerKind;
  label: string;
  /** where the value comes from */
  from: string;
  /** how often a new value is expected */
  cadence: string;
}

export const KIND_DEFS: Record<MarkerKind, KindDef> = {
  active: { id: 'active', label: 'Active markers', from: 'Wearables and health platforms (Apple Health, Health Connect)', cadence: 'Continuously, synced' },
  daily: { id: 'daily', label: 'Daily markers', from: 'Logged by the person, towards the end of the day', cadence: 'Once a day' },
  periodic: { id: 'periodic', label: 'Periodic markers', from: 'Lab reports, check-ups and scans', cadence: 'Every few weeks or months' },
};

/**
 * Days between new values for a periodic marker: the least and the most it is normally repeated. Blood tests are done
 * every 2 to 3 months, not weekly, so "no new value this week" is the normal state and never a reason to flag one.
 */
export const PERIODIC_GAP_DAYS = {
  biomarker_readings: { min: 60, max: 90 },
  /** the schedule the person picks in Goals: weekly or fortnightly */
  photo_log: { min: 7, max: 14 },
} as const;

/** The `source` values the app stores for sleep, heart and cycle rows. */
export type DataSource = 'manual' | 'apple_health_export' | 'healthkit' | 'health_connect' | 'other';

/** A row from a health platform is active; one typed by hand is daily. An unknown source is not assumed to be a wearable. */
export function kindOfSource(source: DataSource): MarkerKind {
  return source === 'healthkit' || source === 'health_connect' || source === 'apple_health_export' ? 'active' : 'daily';
}

/**
 * The kind of each table that holds readings, or null for a table that holds settings, a list or a history that is
 * not a reading (the profile, the habits list, the medication list). `bySource` tables are active when the row came
 * from a health platform and daily when it was typed, see kindOfSource.
 */
export const TABLE_KIND: Record<PersonalTable, MarkerKind | 'bySource' | null> = {
  sleep_sessions: 'bySource',
  cardio_metrics: 'bySource',
  cycle_days: 'bySource',
  daily_logs: 'daily',
  meals: 'daily',
  workouts: 'daily',
  workout_sets: 'daily',
  biomarker_readings: 'periodic',
  photo_log: 'periodic',
  body_composition: 'periodic',
  profile: null,
  profile_conditions: null,
  habits: null,
  medications: null,
  supplement_catalog: null,
  diagnoses: null,
  devices: null,
  action_items: null,
};

/** The kind of one stored row. A table that holds no readings has none. */
export function kindOfRow(table: PersonalTable, source?: DataSource): MarkerKind | null {
  const kind = TABLE_KIND[table];
  if (kind === 'bySource') return kindOfSource(source ?? 'manual');
  return kind;
}

/** The tables whose rows are always of one kind (the by-source tables can be two). */
export function tablesOfKind(kind: MarkerKind): PersonalTable[] {
  return PERSONAL_TABLES.filter((t) => TABLE_KIND[t] === kind);
}
