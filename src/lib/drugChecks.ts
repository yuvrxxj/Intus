import { dayNumber } from './dates.ts';
import { toNumber, toNumberOrNull, type NumericInput } from './numbers.ts';

export const PARACETAMOL = Object.freeze({
  NONE: 'none',
  OK: 'ok',
  CAUTION: 'caution',
  INCOMPLETE: 'incomplete',
  EXCEEDED: 'exceeded',
});

export type ParacetamolStatus = (typeof PARACETAMOL)[keyof typeof PARACETAMOL];

// Adult label maximum, and a lower line that asks the user to look at the total before reaching it.
export const PARACETAMOL_LIMITS = Object.freeze({ cautionMg: 3000, maxMg: 4000 });

/** The slice of a medications row that the drug checks read. */
export interface MedicationLike {
  name: string;
  dosage?: string | null;
  start_date?: string | null;
  end_date?: string | null;
  paracetamol_mg_per_dose?: NumericInput;
  doses_per_day?: NumericInput;
}

export interface ParacetamolItem {
  name: string;
  mgPerDose: number;
  dosesPerDay: number;
  dailyMg: number;
}

export interface ParacetamolOptions {
  today: string;
  cautionMg?: number;
  maxMg?: number;
}

export interface ParacetamolTotal {
  status: ParacetamolStatus;
  totalMg: number;
  items: ParacetamolItem[];
  incomplete: string[];
  limits: { cautionMg: number; maxMg: number };
}

// Dates decide what is current. The generated `active` column is end_date IS NULL, so a course that
// ends next week would read as inactive and drop out of the daily total.
export function takenOn(med: MedicationLike, day: number): boolean {
  if (med.start_date != null && dayNumber(med.start_date) > day) return false;
  if (med.end_date != null && dayNumber(med.end_date) < day) return false;
  return true;
}

// Names that mean a product is, or contains, paracetamol. It cannot be exhaustive (cold and flu remedies and
// combination painkillers often contain it), so the screens also remind the reader to check labels.
const PARACETAMOL_NAME = /paracetamol|acetaminophen|\b(?:panadol|dolo|crocin|calpol|tylenol|paracip)\b/i;

export function looksLikeParacetamol(name: string): boolean {
  return PARACETAMOL_NAME.test(name ?? '');
}

/**
 * medications: medications rows. today: 'YYYY-MM-DD' (required, so results never depend on the clock).
 * Adds up paracetamol_mg_per_dose x doses_per_day over everything taken today.
 * A paracetamol row missing either number cannot be added up, so it is reported as incomplete rather than ignored.
 * That includes a product whose name says paracetamol but which has no figures at all: leaving it out of the
 * total would read as reassurance that nothing was missed.
 */
export function paracetamolDailyTotal(
  medications: readonly MedicationLike[],
  { today, cautionMg, maxMg }: ParacetamolOptions,
): ParacetamolTotal {
  const limits = { ...PARACETAMOL_LIMITS, ...(cautionMg != null && { cautionMg }), ...(maxMg != null && { maxMg }) };
  const todayDay = dayNumber(today);
  const items: ParacetamolItem[] = [];
  const incomplete: string[] = [];
  let totalMg = 0;
  for (const med of medications) {
    const hasFigure = med.paracetamol_mg_per_dose != null || med.doses_per_day != null;
    if (!hasFigure && !looksLikeParacetamol(med.name)) continue;
    if (!takenOn(med, todayDay)) continue;
    if (med.paracetamol_mg_per_dose == null || med.doses_per_day == null) {
      incomplete.push(med.name);
      continue;
    }
    const mgPerDose = toNumber(med.paracetamol_mg_per_dose, `${med.name} paracetamol_mg_per_dose`);
    const dosesPerDay = toNumber(med.doses_per_day, `${med.name} doses_per_day`);
    if (mgPerDose < 0 || dosesPerDay < 0) throw new RangeError(`${med.name}: dose figures cannot be negative`);
    const dailyMg = mgPerDose * dosesPerDay;
    items.push({ name: med.name, mgPerDose, dosesPerDay, dailyMg });
    totalMg += dailyMg;
  }
  let status: ParacetamolStatus = PARACETAMOL.OK;
  if (totalMg > limits.maxMg) status = PARACETAMOL.EXCEEDED;
  else if (totalMg >= limits.cautionMg) status = PARACETAMOL.CAUTION;
  else if (incomplete.length > 0) status = PARACETAMOL.INCOMPLETE;
  else if (items.length === 0) status = PARACETAMOL.NONE;
  return { status, totalMg, items, incomplete, limits };
}

// Biomarker codes (as in the biomarkers table) measured by assays that commonly use biotin-streptavidin
// chemistry. Whether a given lab's platform is affected depends on the lab, so this errs towards warning.
export const BIOTIN_SENSITIVE_CODES: readonly string[] = Object.freeze([
  'tsh', 't3_free', 't4_free', 't4_total', 'vitamin_d', 'vitamin_b12', 'ferritin', 'cortisol', 'testosterone',
]);

// Days after stopping biotin during which a blood test can still be affected.
export const BIOTIN_WASHOUT_DAYS = 3;

const BIOTIN_NAME = /\bbiotin\b|\bvitamin\s*b-?7\b/i;

export function looksLikeBiotin(name: string): boolean {
  return BIOTIN_NAME.test(name ?? '');
}

export interface BiotinInput {
  medications: readonly MedicationLike[];
  readings: readonly { id?: string; biomarker_id: string; measured_at: string }[];
  biomarkers: readonly { id: string; code: string; name: string }[];
  washoutDays?: number;
}

export interface BiotinWarning {
  reading_id: string | null;
  code: string;
  name: string;
  measured_at: string;
  medication: string;
  dosage: string | null;
}

/**
 * medications: medications rows (any status, so past readings are judged against what was taken then).
 * readings: biomarker_readings rows. biomarkers: biomarkers rows, for the code of each reading.
 * One warning per affected reading taken while a biotin product was being taken, or within the washout after.
 * The dose is not judged: a small multivitamin amount probably does not matter and a high-dose hair
 * supplement does, and dosage is free text, so the warning carries the dose text and leaves the call to the reader.
 */
export function biotinWarnings({
  medications,
  readings,
  biomarkers,
  washoutDays = BIOTIN_WASHOUT_DAYS,
}: BiotinInput): BiotinWarning[] {
  const biotinMeds = medications.filter((m) => looksLikeBiotin(m.name));
  if (biotinMeds.length === 0) return [];
  const sensitiveIds = new Map(
    biomarkers.filter((b) => BIOTIN_SENSITIVE_CODES.includes(b.code)).map((b) => [b.id, b]),
  );
  const washout = toNumberOrNull(washoutDays, 'washoutDays') ?? 0;
  const warnings: BiotinWarning[] = [];
  for (const reading of readings) {
    const biomarker = sensitiveIds.get(reading.biomarker_id);
    if (!biomarker) continue;
    const day = dayNumber(reading.measured_at);
    for (const med of biotinMeds) {
      const started = med.start_date == null || dayNumber(med.start_date) <= day;
      const notFinished = med.end_date == null || dayNumber(med.end_date) + washout >= day;
      if (started && notFinished) {
        warnings.push({
          reading_id: reading.id ?? null,
          code: biomarker.code,
          name: biomarker.name,
          measured_at: reading.measured_at,
          medication: med.name,
          dosage: med.dosage ?? null,
        });
      }
    }
  }
  return warnings;
}
