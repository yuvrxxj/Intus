import type { Medication as Supplement, MedicationInput as SupplementInput } from '../../db/medications.ts';
import { dayNumber } from '../../lib/dates.ts';

/** Judged by the dates, never by the generated `active` column, which says "active" for a course that has not started. */
export type CourseStatus = 'current' | 'ended' | 'upcoming';

export function courseStatus(item: Pick<Supplement, 'start_date' | 'end_date'>, today: string): CourseStatus {
  const day = dayNumber(today);
  if (item.start_date != null && dayNumber(item.start_date) > day) return 'upcoming';
  if (item.end_date != null && dayNumber(item.end_date) < day) return 'ended';
  return 'current';
}

export interface SupplementForm {
  name: string;
  dosage: string;
  frequency: string;
  start_date: string;
  end_date: string;
  notes: string;
}

export const EMPTY_SUPPLEMENT_FORM: SupplementForm = {
  name: '', dosage: '', frequency: '', start_date: '', end_date: '', notes: '',
};

export function formFromSupplement(item: Supplement): SupplementForm {
  const text = (v: string | null) => v ?? '';
  return {
    name: item.name,
    dosage: text(item.dosage),
    frequency: text(item.frequency),
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
      frequency: orNull(form.frequency),
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
