import type { Biomarker, BiomarkerReading } from '../../db/queries.ts';
import type { ReadingInput } from '../../db/biomarkerReadings.ts';
import { dayNumber } from '../../lib/dates.ts';
import { toNumberOrNull } from '../../lib/numbers.ts';

/** What the Source column says for a result typed in by hand, so it can be told apart from imported or demo rows. */
export const MANUAL_SOURCE = 'manual';

export const MAX_NOTES = 500;
/** Far above any lab value, and well inside what a numeric column holds. A bigger number is a typo. */
export const MAX_VALUE = 1e9;
const EARLIEST_YEAR = 1900;

export interface ReadingForm {
  biomarker_id: string;
  /** as typed; a decimal comma is accepted */
  value: string;
  /** 'YYYY-MM-DD' */
  measured_at: string;
  notes: string;
}

export function emptyReadingForm(today: string): ReadingForm {
  return { biomarker_id: '', value: '', measured_at: today, notes: '' };
}

export type ReadingFormErrors = Partial<Record<keyof ReadingForm, string>>;

export type ReadingFormResult =
  | {
      ok: true;
      value: ReadingInput;
      /** set when the number looks like it was typed in the wrong unit; the caller should ask before saving */
      warning: string | null;
    }
  | { ok: false; errors: ReadingFormErrors };

/**
 * Plain decimals only, with a point or a comma. 1e3, 0x10, 1,000.5 and "4." are refused rather than guessed at,
 * because a lab value read wrongly is worse than one that is asked for again.
 */
export function parseResultValue(text: string): number | null {
  const trimmed = text.trim();
  if (!/^(\d+([.,]\d+)?|[.,]\d+)$/.test(trimmed)) return null;
  const parsed = Number(trimmed.replace(',', '.'));
  return Number.isFinite(parsed) ? parsed : null;
}

/** A value ten times past either end of the reference range is more likely the wrong unit than a real result. */
function unitWarning(biomarker: Biomarker, value: number): string | null {
  let low: number | null;
  let high: number | null;
  try {
    low = toNumberOrNull(biomarker.ref_low, `${biomarker.code} ref_low`);
    high = toNumberOrNull(biomarker.ref_high, `${biomarker.code} ref_high`);
  } catch {
    return null;
  }
  const tooHigh = high !== null && high > 0 && value > high * 10;
  const tooLow = low !== null && low > 0 && value > 0 && value < low / 10;
  if (!tooHigh && !tooLow) return null;
  return `${value} ${biomarker.unit} is more than ten times ${tooHigh ? 'above' : 'below'} the usual range for ${biomarker.name}. Check that your report uses ${biomarker.unit} and not a different unit.`;
}

/**
 * Turns the form into a row, or says what is wrong. It refuses a second result for the same marker on the same
 * day, because the screen compares results by date and two on one day would make "latest" a coin toss.
 */
export function validateReadingForm(
  form: ReadingForm,
  biomarkers: readonly Biomarker[],
  existing: readonly Pick<BiomarkerReading, 'biomarker_id' | 'measured_at'>[],
  today: string,
): ReadingFormResult {
  const errors: ReadingFormErrors = {};

  const biomarker = biomarkers.find((b) => b.id === form.biomarker_id);
  if (!biomarker) errors.biomarker_id = 'Choose a marker';

  const parsed = parseResultValue(form.value);
  if (form.value.trim() === '') errors.value = 'Enter the result';
  else if (parsed === null) errors.value = 'Enter a plain number such as 4.2';
  else if (parsed > MAX_VALUE) errors.value = 'That number is too large to be a lab result';

  const date = form.measured_at.trim();
  let day: number | null = null;
  try {
    day = dayNumber(date);
  } catch {
    errors.measured_at = 'Choose the date the sample was taken';
  }
  if (day !== null) {
    if (day > dayNumber(today)) errors.measured_at = 'That date is in the future';
    else if (Number(date.slice(0, 4)) < EARLIEST_YEAR) errors.measured_at = 'That date is too far back';
  }

  const notes = form.notes.trim();
  if (notes.length > MAX_NOTES) errors.notes = `Keep notes under ${MAX_NOTES} characters`;

  if (biomarker && day !== null && !errors.measured_at && existing.some((r) => r.biomarker_id === biomarker.id && r.measured_at.slice(0, 10) === date)) {
    errors.measured_at = `You already have a ${biomarker.name} result for this date. Delete it first if it was a mistake, or choose another date.`;
  }

  if (Object.keys(errors).length > 0 || !biomarker || parsed === null) return { ok: false, errors };

  return {
    ok: true,
    value: {
      biomarker_id: biomarker.id,
      measured_at: date,
      value: parsed,
      source: MANUAL_SOURCE,
      notes: notes === '' ? null : notes,
    },
    warning: unitWarning(biomarker, parsed),
  };
}
