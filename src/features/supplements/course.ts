import type { Medication } from '../../db/medications.ts';
import { dayNumber } from '../../lib/dates.ts';

/** Judged by the dates, never by the generated `active` column, which says "active" for a course that has not started. */
export type CourseStatus = 'current' | 'ended' | 'upcoming';

export function courseStatus(item: Pick<Medication, 'start_date' | 'end_date'>, today: string): CourseStatus {
  const day = dayNumber(today);
  if (item.start_date != null && dayNumber(item.start_date) > day) return 'upcoming';
  if (item.end_date != null && dayNumber(item.end_date) < day) return 'ended';
  return 'current';
}
