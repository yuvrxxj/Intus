// What the Bloodwork screen would show if a model's rows were reviewed and saved, without saving anything. It runs the
// rows through the same steps the app does between a report and the database: the review table's rules, the per-row
// checks a result gets when it is saved, then the view the screen draws. Nothing here touches a database.
import type { BiomarkerReading } from '../../db/queries.ts';
import { buildBloodworkView, type BloodworkView } from '../bloodwork/model.ts';
import type { ParsedReport, ParsedRow } from '../reports/parse.ts';
import { reviewRows, validateReview, type ReviewRow } from '../reports/review.ts';
import { BIOMARKERS } from './biomarkers.ts';

export interface Preview {
  view: BloodworkView;
  /** results that went through every check and are on the screen */
  shown: number;
  /** rows the review table would leave unticked, or that failed a check, with the reason, like the app's "Unticked rows say why" */
  left: ReviewRow[];
  /** the date the results are dated with */
  date: string;
}

/**
 * `rows` are as the benchmark writes them: the marker's code stands in for its id. The person is male on the report the
 * lab was run on, so a default range for men may be used where the report printed none.
 */
export function previewRows(rows: readonly ParsedRow[], reportDate: string | null, today: string, sex: string | null = 'male'): Preview {
  const idOf = (code: string | null) => BIOMARKERS.find((b) => b.code === code)?.id ?? null;
  const parsed: ParsedReport = { date: reportDate, dateUnsure: false, rows: rows.map((r) => ({ ...r, biomarkerId: idOf(r.biomarkerId) })) };
  const date = reportDate ?? today;
  let review = reviewRows(parsed, BIOMARKERS, []);
  let readings: BiomarkerReading[] = [];

  // the app shows every problem at once and the person fixes or unticks; here a row with a problem is left out and listed
  for (let pass = 0; pass < 6; pass++) {
    const result = validateReview(review, date, BIOMARKERS, [], today);
    if (result.ok) {
      readings = result.inputs.map((input, n) => ({
        id: `preview-${n}`,
        user_id: 'preview',
        created_at: `${today}T00:00:00Z`,
        status: null,
        notes: input.notes ?? null,
        ref_low: input.ref_low ?? null,
        ref_high: input.ref_high ?? null,
        biomarker_id: input.biomarker_id,
        measured_at: input.measured_at,
        value: input.value,
        source: input.source,
      }));
      break;
    }
    if (result.dateError || Object.keys(result.rowErrors).length === 0) {
      // nothing left to untick: the date itself is the problem, so nothing is shown
      review = review.map((r) => ({ ...r, include: false, issue: result.dateError ?? result.message }));
      break;
    }
    review = review.map((r) => {
      const errors = result.rowErrors[r.key];
      return errors ? { ...r, include: false, issue: Object.values(errors).filter(Boolean).join(' ') } : r;
    });
  }

  return {
    view: buildBloodworkView({ biomarkers: BIOMARKERS, readings, sex }),
    shown: readings.length,
    left: review.filter((r) => !r.include),
    date,
  };
}
