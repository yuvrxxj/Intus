// How many hours of sleep the sleep societies' panels recommend, by age. These are ranges for healthy people, not
// targets and not a verdict: the National Sleep Foundation panel (Hirshkowitz et al. 2015, Sleep Health 1(1):40-43)
// rated each number of hours as "recommended", "may be appropriate" (for some people), or "not recommended".
// The AASM and SRS adult statement (Watson et al. 2015, Sleep 38(6):843-844) says adults should sleep 7 or more hours.

export interface AgeBand {
  /** shown as "Adults 26 to 64" */
  label: string;
  /** hours: under this is "not recommended" (too short) */
  notBelow: number;
  /** the recommended range, inclusive */
  recLow: number;
  recHigh: number;
  /** hours: over this is "not recommended" (too long) */
  notAbove: number;
  /** compare the 24 hour total including naps (children under 6), not the main night */
  includesNaps: boolean;
}

// age in whole years, first matching row wins
const ROWS: readonly (readonly [number, number, AgeBand])[] = [
  [1, 2, { label: 'Toddlers 1 to 2', notBelow: 9, recLow: 11, recHigh: 14, notAbove: 16, includesNaps: true }],
  [3, 5, { label: 'Preschoolers 3 to 5', notBelow: 8, recLow: 10, recHigh: 13, notAbove: 14, includesNaps: true }],
  [6, 13, { label: 'Children 6 to 13', notBelow: 7, recLow: 9, recHigh: 11, notAbove: 12, includesNaps: false }],
  [14, 17, { label: 'Teenagers 14 to 17', notBelow: 7, recLow: 8, recHigh: 10, notAbove: 11, includesNaps: false }],
  [18, 25, { label: 'Young adults 18 to 25', notBelow: 6, recLow: 7, recHigh: 9, notAbove: 11, includesNaps: false }],
  [26, 64, { label: 'Adults 26 to 64', notBelow: 6, recLow: 7, recHigh: 9, notAbove: 10, includesNaps: false }],
  [65, 120, { label: 'Adults 65 and over', notBelow: 5, recLow: 7, recHigh: 8, notAbove: 9, includesNaps: false }],
];

/**
 * The band for a whole-number age, or null when there is none to show: a missing or impossible age, or under 1 year
 * (the first year has two bands that whole years cannot tell apart). It never falls back to the adult band.
 */
export function ageBand(age: number | null | undefined): AgeBand | null {
  if (age == null || !Number.isInteger(age)) return null;
  const row = ROWS.find(([from, to]) => age >= from && age <= to);
  return row ? row[2] : null;
}

export type DurationClass = 'shorter' | 'shorter-possible' | 'within' | 'longer-possible' | 'longer';

/**
 * Where a night falls against the band. The NSF table is printed in whole hours, so each row is read as four
 * thresholds on a continuous scale (an Intus reading, consistent with every row of the table): below notBelow is too
 * short; up to recLow may be appropriate; recLow to recHigh is recommended; up to notAbove may be appropriate; beyond is
 * too long. Minutes are used as they come.
 */
export function classifyHours(hours: number, band: AgeBand): DurationClass {
  if (hours < band.notBelow) return 'shorter';
  if (hours < band.recLow) return 'shorter-possible';
  if (hours <= band.recHigh) return 'within';
  if (hours <= band.notAbove) return 'longer-possible';
  return 'longer';
}

/** Neutral wording: longer is never ranked above shorter, and none of it is a verdict. */
export const CLASS_LABEL: Record<DurationClass, string> = {
  shorter: 'Shorter than the recommended range',
  'shorter-possible': 'A little shorter than the recommended range',
  within: 'In the recommended range',
  'longer-possible': 'A little longer than the recommended range',
  longer: 'Longer than the recommended range',
};

export function bandSentence(band: AgeBand): string {
  return `${band.label}: ${band.recLow} to ${band.recHigh} hours is the range the National Sleep Foundation panel recommends (Hirshkowitz 2015). `
    + `${band.notBelow} to ${band.recLow} and ${band.recHigh} to ${band.notAbove} hours "may be appropriate for some people".`;
}
