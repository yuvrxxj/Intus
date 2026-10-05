import type { Medication as Supplement, MedicationInput as SupplementInput } from '../../db/medications.ts';
import { dayNumber } from '../../lib/dates.ts';
import { courseStatus, type CourseStatus } from './course.ts';
import { ALL_DAYS, MAX_DOSES, dosesOf, normalizeDays } from './schedule.ts';

export { courseStatus, type CourseStatus };

export interface SupplementForm {
  name: string;
  dosage: string;
  /** how many times a day, as typed: '1' to '6' */
  doses_per_day: string;
  /** the weekdays it is taken on, Sunday as 0 */
  days: number[];
  start_date: string;
  end_date: string;
  notes: string;
}

export const EMPTY_SUPPLEMENT_FORM: SupplementForm = {
  name: '', dosage: '', doses_per_day: '1', days: [...ALL_DAYS], start_date: '', end_date: '', notes: '',
};

export function formFromSupplement(item: Supplement): SupplementForm {
  const text = (v: string | null) => v ?? '';
  return {
    name: item.name,
    dosage: text(item.dosage),
    doses_per_day: String(dosesOf(item)),
    days: normalizeDays(item.days_of_week),
    start_date: text(item.start_date),
    end_date: text(item.end_date),
    notes: text(item.notes),
  };
}

export type SupplementFormErrors = Partial<Record<keyof SupplementForm, string>>;

export type SupplementFormResult =
  | { ok: true; value: SupplementInput }
  | { ok: false; errors: SupplementFormErrors };

function parseDate(text: string, label: string, errors: SupplementFormErrors, key: keyof SupplementForm): string | null {
  const trimmed = text.trim();
  if (trimmed === '') return null;
  try {
    dayNumber(trimmed);
    return trimmed;
  } catch {
    errors[key] = `${label} is not a valid date`;
    return null;
  }
}

/** Turns the form into a row, or says what is wrong. Blanks become null and text is trimmed. */
export function validateSupplementForm(form: SupplementForm): SupplementFormResult {
  const errors: SupplementFormErrors = {};
  const name = form.name.trim();
  if (name === '') errors.name = 'Enter a name';
  else if (name.length > 120) errors.name = 'Keep the name under 120 characters';

  const doses = Number(form.doses_per_day.trim() === '' ? Number.NaN : form.doses_per_day);
  if (!Number.isInteger(doses) || doses < 1 || doses > MAX_DOSES) errors.doses_per_day = `Choose 1 to ${MAX_DOSES} doses a day`;

  const days = [...new Set(form.days.filter((d) => Number.isInteger(d) && d >= 0 && d <= 6))].sort((a, b) => a - b);
  if (days.length === 0) errors.days = 'Choose at least one day';

  const start = parseDate(form.start_date, 'Start date', errors, 'start_date');
  const end = parseDate(form.end_date, 'End date', errors, 'end_date');
  if (start && end && dayNumber(end) < dayNumber(start)) errors.end_date = 'End date is before the start date';

  if (Object.keys(errors).length > 0) return { ok: false, errors };

  const orNull = (s: string) => (s.trim() === '' ? null : s.trim());
  return {
    ok: true,
    value: {
      name,
      dosage: orNull(form.dosage),
      doses_per_day: doses,
      days_of_week: days,
      start_date: start,
      end_date: end,
      notes: orNull(form.notes),
    },
  };
}

/** Current first, then upcoming, then ended; newest start first within each. */
export function sortSupplements(items: readonly Supplement[], today: string): Supplement[] {
  const rank: Record<CourseStatus, number> = { current: 0, upcoming: 1, ended: 2 };
  return [...items].sort((a, b) => {
    const r = rank[courseStatus(a, today)] - rank[courseStatus(b, today)];
    if (r !== 0) return r;
    const da = a.start_date ? dayNumber(a.start_date) : -Infinity;
    const db = b.start_date ? dayNumber(b.start_date) : -Infinity;
    return db - da || a.name.localeCompare(b.name);
  });
}
