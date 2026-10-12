// The review table between a parsed report and the database. Pure: no PDF, no network.
//
// Nothing is saved until the person has looked at every row. A row starts ticked only when it is plainly fine: it
// matched a marker, it has a number, its unit is the one Intus stores (or the report printed none), and there is not
// already a result for that marker on that date. Everything else is shown unticked with the reason, for the person
// to fix or leave out.
import type { ReadingInput } from '../../db/biomarkerReadings.ts';
import type { Biomarker, BiomarkerReading } from '../../db/queries.ts';
import { validateReadingForm, type ReadingFormErrors } from '../bloodwork/entry.ts';
import type { ParsedReport } from './parse.ts';

/** What the Source column says for a result that came from an uploaded report. */
export const REPORT_SOURCE = 'report_upload';

export interface ReviewRow {
  key: string;
  /** the line as read from the report */
  line: string;
  label: string;
  /** '' when it matched nothing; the person can pick one */
  biomarkerId: string;
  value: string;
  /** the unit printed on the report, for comparison; never converted */
  unit: string | null;
  refLow: string;
  refHigh: string;
  include: boolean;
  /** why the row starts unticked, in plain words */
  issue: string | null;
}

const text = (n: number | null) => (n === null ? '' : String(n));

export function reviewRows(
  parsed: ParsedReport,
  biomarkers: readonly Pick<Biomarker, 'id' | 'name' | 'unit'>[],
  existing: readonly Pick<BiomarkerReading, 'biomarker_id' | 'measured_at'>[],
): ReviewRow[] {
  const seen = new Set<string>();
  return parsed.rows.map((row, i) => {
    const marker = biomarkers.find((b) => b.id === row.biomarkerId);
    let issue: string | null = null;
    if (!marker) issue = 'Not a marker Intus tracks yet. Pick one if it is, or leave it out.';
    else if (row.value === null) issue = 'No number was read. Type it in from the report.';
    else if (row.unitMismatch) issue = `The report gives this in ${row.unit}, and Intus stores ${marker.name} in ${marker.unit}. Convert it yourself or leave it out.`;
    else if (seen.has(marker.id)) issue = `${marker.name} appears twice on this report. Only the first is ticked.`;
    else if (parsed.date && existing.some((r) => r.biomarker_id === marker.id && r.measured_at.slice(0, 10) === parsed.date)) {
      issue = `You already have a ${marker.name} result for this date.`;
    }
    if (marker) seen.add(marker.id);
    return {
      key: `r${i}`,
      line: row.line,
      label: row.label,
      biomarkerId: marker?.id ?? '',
      value: text(row.value),
      unit: row.unit,
      refLow: text(row.refLow),
      refHigh: text(row.refHigh),
      include: issue === null,
      issue,
    };
  });
}

export type ReviewResult =
  | { ok: true; inputs: ReadingInput[] }
  | { ok: false; dateError: string | null; rowErrors: Record<string, ReadingFormErrors>; message: string };

/**
 * The ticked rows as results to save, or every problem at once. Each row goes through the same checks as a result
 * typed in by hand, against what is already stored and against the rows ticked above it.
 */
export function validateReview(
  rows: readonly ReviewRow[],
  date: string,
  biomarkers: readonly Biomarker[],
  existing: readonly Pick<BiomarkerReading, 'biomarker_id' | 'measured_at'>[],
  today: string,
): ReviewResult {
  const chosen = rows.filter((r) => r.include);
  if (chosen.length === 0) return { ok: false, dateError: null, rowErrors: {}, message: 'Tick at least one result to save.' };
  const rowErrors: Record<string, ReadingFormErrors> = {};
  let dateError: string | null = null;
  const inputs: ReadingInput[] = [];
  const soFar = [...existing];
  for (const row of chosen) {
    const result = validateReadingForm(
      { biomarker_id: row.biomarkerId, value: row.value, measured_at: date, notes: '', ref_low: row.refLow, ref_high: row.refHigh },
      biomarkers,
      soFar,
      today,
    );
    if (!result.ok) {
      const { measured_at, ...rest } = result.errors;
      // a date problem is the report's, not the row's, unless it is a duplicate for this marker
      if (measured_at && /already have/.test(measured_at)) rowErrors[row.key] = { ...rest, measured_at };
      else {
        if (measured_at) dateError = measured_at;
        if (Object.keys(rest).length > 0) rowErrors[row.key] = rest;
      }
      continue;
    }
    inputs.push({ ...result.value, source: REPORT_SOURCE });
    soFar.push({ biomarker_id: result.value.biomarker_id, measured_at: date });
  }
  if (dateError || Object.keys(rowErrors).length > 0) {
    const n = Object.keys(rowErrors).length;
    return {
      ok: false,
      dateError,
      rowErrors,
      message: dateError ? 'Check the date of the test.' : `${n} ticked row${n === 1 ? ' needs' : 's need'} fixing before anything is saved.`,
    };
  }
  return { ok: true, inputs };
}
