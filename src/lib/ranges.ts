import { normalizeSex } from '../features/screening/model.ts';
import { toNumberOrNull } from './numbers.ts';

/*
 * Which reference range a result is read against. The order is the whole rule:
 *
 *   1. The range printed on the person's own report, stored with the result. The lab already chose it for the
 *      person's sex and age, and for the cycle phase where it does that, so it beats anything Intus keeps.
 *   2. The marker's default range, but only when it applies to the person. A default marked as one sex's range
 *      (biomarkers.ref_sex) is never used for the other sex, or for someone whose sex is not recorded.
 *   3. Otherwise no range, and so no flag. A wrong "low" is worse than none.
 *
 * Critical limits are a separate rule (src/lib/safety.ts) and do not change with any of this.
 */

export type RangeStatus = 'in_range' | 'below' | 'above' | 'no_range';
export type RangeSource = 'printed' | 'default' | 'none';
/** Why there is no range, so the screen can say something useful. */
export type NoRangeReason = 'none_set' | 'default_other_sex' | 'sex_unknown';

export interface ChosenRange {
  low: number | null;
  high: number | null;
  source: RangeSource;
  /** set only when source is 'none' */
  reason?: NoRangeReason;
}

export interface RangeMarker {
  code: string;
  ref_low: unknown;
  ref_high: unknown;
  /** 'male' or 'female' when the default range is for one sex only; null or missing when it is for everyone */
  ref_sex?: string | null;
}

/** The range columns on a stored result. They can be missing on rows read before the columns existed. */
export interface PrintedRange {
  ref_low?: unknown;
  ref_high?: unknown;
}

function pair(low: unknown, high: unknown, label: string): { low: number | null; high: number | null } {
  const lo = toNumberOrNull(low, `${label} low`);
  const hi = toNumberOrNull(high, `${label} high`);
  if (lo !== null && hi !== null && lo > hi) throw new RangeError(`${label}: the low end (${lo}) must not be above the high end (${hi})`);
  return { low: lo, high: hi };
}

/**
 * Throws on a range it cannot trust (a limit that is not a number, or one the wrong way round), like the rest of the
 * bloodwork code: a result checked against a broken range must not be shown as if it had been checked.
 */
export function chooseRange(marker: RangeMarker, printed: PrintedRange | null | undefined, sex: string | null | undefined): ChosenRange {
  if (printed && (printed.ref_low != null || printed.ref_high != null)) {
    return { ...pair(printed.ref_low, printed.ref_high, `${marker.code} printed range`), source: 'printed' };
  }
  const fallback = pair(marker.ref_low, marker.ref_high, `${marker.code} range`);
  if (fallback.low === null && fallback.high === null) return { low: null, high: null, source: 'none', reason: 'none_set' };
  const forSex = normalizeSex(marker.ref_sex);
  if (forSex !== '') {
    const person = normalizeSex(sex);
    if (person === '') return { low: null, high: null, source: 'none', reason: 'sex_unknown' };
    if (person !== forSex) return { low: null, high: null, source: 'none', reason: 'default_other_sex' };
  }
  return { ...fallback, source: 'default' };
}

/** Inclusive at both ends: a result exactly on a limit is in range. */
export function statusIn(range: Pick<ChosenRange, 'low' | 'high'>, value: number): RangeStatus {
  if (range.low === null && range.high === null) return 'no_range';
  if (range.low !== null && value < range.low) return 'below';
  if (range.high !== null && value > range.high) return 'above';
  return 'in_range';
}

/** Where the range came from, in a few words for the screen. */
export function rangeSourceLabel(range: ChosenRange): string {
  if (range.source === 'printed') return 'as printed on your report';
  if (range.source === 'default') return 'usual range';
  if (range.reason === 'default_other_sex') return 'no range for you here: the usual range is for the other sex. Add the range printed on your report';
  if (range.reason === 'sex_unknown') return 'no range: this one depends on sex, which is not in your details yet';
  return 'no range set';
}
