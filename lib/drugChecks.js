import { dayNumber } from './dates.js';
import { toNumber, toNumberOrNull } from './numbers.js';

export const PARACETAMOL = Object.freeze({
  NONE: 'none',
  OK: 'ok',
  CAUTION: 'caution',
  INCOMPLETE: 'incomplete',
  EXCEEDED: 'exceeded',
});

// Adult label maximum, and a lower line that asks the user to look at the total before reaching it.
export const PARACETAMOL_LIMITS = Object.freeze({ cautionMg: 3000, maxMg: 4000 });

// Dates decide what is current. The generated `active` column is end_date IS NULL, so a course that
// ends next week would read as inactive and drop out of the daily total.
function takenOn(med, day) {
  if (med.start_date != null && dayNumber(med.start_date) > day) return false;
  if (med.end_date != null && dayNumber(med.end_date) < day) return false;
  return true;
}

/**
 * medications: medications rows. today: 'YYYY-MM-DD' (required, so results never depend on the clock).
 * Adds up paracetamol_mg_per_dose x doses_per_day over everything taken today.
 * A paracetamol row missing either number cannot be added up, so it is reported as incomplete rather than ignored.
 */
export function paracetamolDailyTotal(medications, { today, cautionMg, maxMg } = {}) {
  const limits = { ...PARACETAMOL_LIMITS, ...(cautionMg != null && { cautionMg }), ...(maxMg != null && { maxMg }) };
  const todayDay = dayNumber(today);
  const items = [];
  const incomplete = [];
  let totalMg = 0;
  for (const med of medications) {
    if (med.paracetamol_mg_per_dose == null && med.doses_per_day == null) continue;
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
  let status = PARACETAMOL.OK;
  if (totalMg > limits.maxMg) status = PARACETAMOL.EXCEEDED;
  else if (totalMg >= limits.cautionMg) status = PARACETAMOL.CAUTION;
  else if (incomplete.length > 0) status = PARACETAMOL.INCOMPLETE;
  else if (items.length === 0) status = PARACETAMOL.NONE;
  return { status, totalMg, items, incomplete, limits };
}

// Biomarker codes (as in the biomarkers table) measured by assays that commonly use biotin-streptavidin
// chemistry. Whether a given lab's platform is affected depends on the lab, so this errs towards warning.
export const BIOTIN_SENSITIVE_CODES = Object.freeze([
  'tsh', 't3_free', 't4_free', 't4_total', 'vitamin_d', 'vitamin_b12', 'ferritin', 'cortisol', 'testosterone',
]);

// Days after stopping biotin during which a blood test can still be affected.
export const BIOTIN_WASHOUT_DAYS = 3;

const BIOTIN_NAME = /\bbiotin\b|\bvitamin\s*b-?7\b/i;

/**
 * medications: medications rows (any status, so past readings are judged against what was taken then).
 * readings: biomarker_readings rows. biomarkers: biomarkers rows, for the code of each reading.
 * One warning per affected reading taken while a biotin product was being taken, or within the washout after.
 * The dose is not judged: a small multivitamin amount probably does not matter and a high-dose hair
 * supplement does, and dosage is free text, so the warning carries the dose text and leaves the call to the reader.
 */
export function biotinWarnings({ medications, readings, biomarkers, washoutDays = BIOTIN_WASHOUT_DAYS }) {
  const biotinMeds = medications.filter((m) => BIOTIN_NAME.test(m.name ?? ''));
  if (biotinMeds.length === 0) return [];
  const sensitiveIds = new Map(
    biomarkers.filter((b) => BIOTIN_SENSITIVE_CODES.includes(b.code)).map((b) => [b.id, b]),
  );
  const washout = toNumberOrNull(washoutDays, 'washoutDays') ?? 0;
  const warnings = [];
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
