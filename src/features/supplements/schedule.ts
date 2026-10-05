import type { Medication } from '../../db/medications.ts';
import { dayNumber } from '../../lib/dates.ts';
import { toNumberOrNull } from '../../lib/numbers.ts';
import { courseStatus } from './course.ts';

/** Sunday is 0, the numbering JavaScript's getDay() and the database column both use. */
export const ALL_DAYS: readonly number[] = [0, 1, 2, 3, 4, 5, 6];
export const WEEKDAYS: readonly number[] = [1, 2, 3, 4, 5];
export const WEEKEND: readonly number[] = [0, 6];
export const DAY_SHORT = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'] as const;
export const DAY_LONG = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'] as const;
export const MAX_DOSES = 6;

type Scheduled = Pick<Medication, 'start_date' | 'end_date'> & { days_of_week?: readonly number[] | null; doses_per_day?: unknown };

/** The day of the week for a 'YYYY-MM-DD' date, Sunday as 0. 1 January 1970 was a Thursday. */
export function weekdayOf(date: string): number {
  return (((dayNumber(date) % 7) + 7) + 4) % 7;
}

/** Valid, sorted and without repeats. A row from before the column existed, or an empty one, means every day. */
export function normalizeDays(days: readonly unknown[] | null | undefined): number[] {
  const valid = new Set((days ?? []).filter((d): d is number => typeof d === 'number' && Number.isInteger(d) && d >= 0 && d <= 6));
  return valid.size === 0 ? [...ALL_DAYS] : [...valid].sort((a, b) => a - b);
}

/** Doses a day, as a whole number from 1 to 6. The column is numeric, so it can arrive as a string, and blank means once. */
export function dosesOf(item: Pick<Scheduled, 'doses_per_day'>): number {
  let n: number | null;
  try {
    n = toNumberOrNull(item.doses_per_day, 'doses per day');
  } catch {
    return 1;
  }
  if (n === null || !Number.isInteger(n) || n < 1) return 1;
  return Math.min(n, MAX_DOSES);
}

/** Taken today: the course has started and not ended, and today's weekday is one of its days. */
export function isDueOn(item: Scheduled, date: string): boolean {
  return courseStatus(item, date) === 'current' && normalizeDays(item.days_of_week).includes(weekdayOf(date));
}

/**
 * What the checklist stores a tick under. The first dose uses the supplement's id alone, so turning a once-a-day
 * supplement into twice a day keeps today's first tick.
 */
export function doseKey(id: string, n: number): string {
  return n === 1 ? id : `${id}#${n}`;
}

export interface Dose {
  key: string;
  itemId: string;
  name: string;
  dosage: string | null;
  /** which dose of the day this is, from 1 */
  n: number;
  of: number;
  days: number[];
}

type Listed = Scheduled & Pick<Medication, 'id' | 'name' | 'dosage' | 'created_at'>;

/** In the order they were added, so the list does not shuffle as the person edits. */
export function inChecklistOrder<T extends Pick<Medication, 'created_at' | 'name'>>(items: readonly T[]): T[] {
  return [...items].sort((a, b) => a.created_at.localeCompare(b.created_at) || a.name.localeCompare(b.name));
}

/** One entry for every dose due on the date. */
export function dosesDue(items: readonly Listed[], date: string): Dose[] {
  const out: Dose[] = [];
  for (const item of inChecklistOrder(items)) {
    if (!isDueOn(item, date)) continue;
    const of = dosesOf(item);
    const days = normalizeDays(item.days_of_week);
    for (let n = 1; n <= of; n++) out.push({ key: doseKey(item.id, n), itemId: item.id, name: item.name, dosage: item.dosage, n, of, days });
  }
  return out;
}

/** Taken today but not on this weekday, so the checklist can say why they are missing. */
export function skippedToday(items: readonly Listed[], date: string): Listed[] {
  return inChecklistOrder(items).filter((item) => courseStatus(item, date) === 'current' && !isDueOn(item, date));
}

function sameDays(a: readonly number[], b: readonly number[]): boolean {
  return a.length === b.length && a.every((d, i) => d === b[i]);
}

export function describeDays(days: readonly number[]): string {
  const d = normalizeDays(days);
  if (d.length === 7) return 'every day';
  if (sameDays(d, WEEKDAYS)) return 'weekdays';
  if (sameDays(d, WEEKEND)) return 'weekends';
  if (d.length === 1) return `${DAY_LONG[d[0]]}s`;
  return d.map((x) => DAY_SHORT[x]).join(', ');
}

/** "Once a day", "Twice on weekdays", "3 times on Mon, Wed, Fri". */
export function describeSchedule(doses: number, days: readonly number[]): string {
  const times = doses === 1 ? 'Once' : doses === 2 ? 'Twice' : `${doses} times`;
  const when = describeDays(days);
  return when === 'every day' ? `${times} a day` : `${times} on ${when}`;
}
