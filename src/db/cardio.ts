import { supabase } from './client.ts';
import { fetchAll } from './paging.ts';
import type { Row } from './types.ts';

/** The columns the supplement before/after comparison reads. Nothing in the app writes this table yet; a phone sync will. */
export type CardioLog = Pick<Row<'cardio_metrics'>, 'measured_at' | 'hrv_ms' | 'resting_hr'>;

/** Oldest first, from a date up to now. Paged, like the daily logs, so a long comparison is never cut short. */
export function fetchCardioSince(fromDate: string): Promise<CardioLog[]> {
  return fetchAll<CardioLog>(
    (from, to) => supabase.from('cardio_metrics').select('measured_at,hrv_ms,resting_hr').gte('measured_at', fromDate).order('measured_at').range(from, to),
    'heart readings',
  );
}
