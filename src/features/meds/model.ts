import type { Medication, MedicationInput } from '../../db/medications.ts';
import { dayNumber } from '../../lib/dates.ts';
import { BIOTIN_SENSITIVE_CODES, BIOTIN_WASHOUT_DAYS, looksLikeBiotin, looksLikeParacetamol, takenOn } from '../../lib/drugChecks.ts';

/** Judged by the course dates, never by the generated `active` column, which says "active" for a course that has not started. */
export type CourseStatus = 'current' | 'ended' | 'upcoming';

export function courseStatus(med: Pick<Medication, 'start_date' | 'end_date' | 'name'>, today: string): CourseStatus {
  const day = dayNumber(today);
  if (med.start_date != null && dayNumber(med.start_date) > day) return 'upcoming';
  return takenOn(med, day) ? 'current' : 'ended';
}

export interface MedForm {
  name: string;
  dosage: string;
  frequency: string;
  start_date: string;
  end_date: string;
  paracetamol_mg: string;
  doses_per_day: string;
  notes: string;
}

export const EMPTY_MED_FORM: MedForm = {
  name: '', dosage: '', frequency: '', start_date: '', end_date: '', paracetamol_mg: '', doses_per_day: '', notes: '',
};

export function formFromMedication(med: Medication): MedForm {
  const text = (v: string | number | null) => (v == null ? '' : String(v));
  return {
    name: med.name,
    dosage: text(med.dosage),
    frequency: text(med.frequency),
    start_date: text(med.start_date),
    end_date: text(med.end_date),
    paracetamol_mg: text(med.paracetamol_mg_per_dose),
    doses_per_day: text(med.doses_per_day),
    notes: text(med.notes),
  };
}

export type MedFormErrors = Partial<Record<keyof MedForm, string>>;

export type MedFormResult =
  | { ok: true; value: MedicationInput; hints: string[] }
  | { ok: false; errors: MedFormErrors };

const MAX_DOSES_PER_DAY = 24;
const USUAL_MAX_DOSE_MG = 1000;

function parseDate(text: string, label: string, errors: MedFormErrors, key: keyof MedForm): string | null {
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

function parsePositive(text: string, label: string, errors: MedFormErrors, key: keyof MedForm): number | null {
  const trimmed = text.trim();
  if (trimmed === '') return null;
  const n = Number(trimmed);
  if (!Number.isFinite(n) || n <= 0) {
    errors[key] = `${label} must be a number above zero`;
    return null;
  }
  return n;
}

/**
 * Turns the form into a row, or says what is wrong. Paracetamol figures are all or nothing: half a pair cannot be
 * added into the daily total, and the check would then report the product as incomplete. Hints are things worth
 * knowing, not blockers.
 */
export function validateMedForm(form: MedForm): MedFormResult {
  const errors: MedFormErrors = {};
  const name = form.name.trim();
  if (name === '') errors.name = 'Enter a name';
  else if (name.length > 120) errors.name = 'Keep the name under 120 characters';

  const start = parseDate(form.start_date, 'Start date', errors, 'start_date');
  const end = parseDate(form.end_date, 'End date', errors, 'end_date');
  if (start && end && dayNumber(end) < dayNumber(start)) errors.end_date = 'End date is before the start date';

  const mg = parsePositive(form.paracetamol_mg, 'Paracetamol per dose', errors, 'paracetamol_mg');
  const doses = parsePositive(form.doses_per_day, 'Doses per day', errors, 'doses_per_day');
  if (doses !== null && doses > MAX_DOSES_PER_DAY) errors.doses_per_day = `More than ${MAX_DOSES_PER_DAY} doses a day looks like a typo`;
  const mgBlank = form.paracetamol_mg.trim() === '';
  const dosesBlank = form.doses_per_day.trim() === '';
  if (mgBlank && !dosesBlank) errors.paracetamol_mg ??= 'Enter the paracetamol per dose too, or clear doses per day';
  if (dosesBlank && !mgBlank) errors.doses_per_day ??= 'Enter doses per day too, or clear the paracetamol amount';

  if (Object.keys(errors).length > 0) return { ok: false, errors };

  const hints: string[] = [];
  if (mg === null && looksLikeParacetamol(name)) {
    hints.push('This looks like a paracetamol product. Without mg per dose and doses per day it cannot be counted, so the daily total will show as incomplete.');
  }
  if (mg !== null && mg > USUAL_MAX_DOSE_MG) {
    hints.push(`A single dose above ${USUAL_MAX_DOSE_MG} mg is unusual for adults. Check the figure is mg per dose, not per day.`);
  }
  if (looksLikeBiotin(name)) {
    hints.push(`Biotin can distort some blood tests. Bloodwork will flag results for ${BIOTIN_SENSITIVE_CODES.length} markers taken while on it or within ${BIOTIN_WASHOUT_DAYS} days of stopping.`);
  }

  const orNull = (s: string) => (s.trim() === '' ? null : s.trim());
  return {
    ok: true,
    hints,
    value: {
      name,
      dosage: orNull(form.dosage),
      frequency: orNull(form.frequency),
      start_date: start,
      end_date: end,
      notes: orNull(form.notes),
      paracetamol_mg_per_dose: mg,
      doses_per_day: doses,
    },
  };
}

/** mg per day for one row, or null when it has no paracetamol figures. */
export function paracetamolPerDay(med: Pick<Medication, 'paracetamol_mg_per_dose' | 'doses_per_day'>): number | null {
  if (med.paracetamol_mg_per_dose == null || med.doses_per_day == null) return null;
  return Number(med.paracetamol_mg_per_dose) * Number(med.doses_per_day);
}

/** Current first, then upcoming, then ended; newest start first within each. */
export function sortMedications(meds: readonly Medication[], today: string): Medication[] {
  const rank: Record<CourseStatus, number> = { current: 0, upcoming: 1, ended: 2 };
  return [...meds].sort((a, b) => {
    const r = rank[courseStatus(a, today)] - rank[courseStatus(b, today)];
    if (r !== 0) return r;
    const da = a.start_date ? dayNumber(a.start_date) : -Infinity;
    const db = b.start_date ? dayNumber(b.start_date) : -Infinity;
    return db - da || a.name.localeCompare(b.name);
  });
}
