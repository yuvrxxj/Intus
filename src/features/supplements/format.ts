import { YES_NO_UNIT } from './effect.ts';

/*
 * How the "What changed since you started" screen writes numbers. Pure, so the rules can be tested without drawing
 * anything. Three rules the screen used to break:
 *   - a number is rounded to a precision that suits what it measures (weight to 0.1 kg, calories to a whole number),
 *     not to a fixed count of significant figures, which showed 69.98 kg and 1.0425 as if they meant something;
 *   - every change carries its unit, so a weight change reads "−1.0 kg", not "−1";
 *   - the sign comes from the rounded number, so a change that rounds to nothing is never written "−0.0".
 * Nothing here says a change is good or bad.
 */

/** The same minus sign the Bloodwork screen uses (U+2212), so "−1.0" lines up with "+1.0" and with the table elsewhere. */
export const MINUS = '−';

/** Decimal places for the daily log's own measures. A habit with a unit of its own, and mood, fall back to one place. */
const DECIMALS: Record<string, number> = {
  kg: 1,
  g: 0,
  kcal: 0,
  ml: 0,
  ms: 0,
  bpm: 0,
  [YES_NO_UNIT]: 1,
};
const DEFAULT_DECIMALS = 1;

export function metricDecimals(unit: string): number {
  return DECIMALS[unit] ?? DEFAULT_DECIMALS;
}

/** The size without a sign, rounded to `decimals` places. */
function magnitude(value: number, decimals: number): string {
  return Math.abs(value).toFixed(decimals);
}

/** True when the number, written to `decimals` places, is zero. */
function roundsToZero(value: number, decimals: number): boolean {
  return Number(magnitude(value, decimals)) === 0;
}

/** "+", the minus sign, or nothing, judged on the rounded number. */
function signOf(value: number, decimals: number): string {
  if (roundsToZero(value, decimals)) return '';
  return value > 0 ? '+' : MINUS;
}

function spaced(unit: string): string {
  return unit ? ` ${unit}` : '';
}

/** "70.0 kg", "2150 kcal", "6.4" (no unit). */
export function formatMetricValue(value: number, unit: string): string {
  return `${magnitude(value, metricDecimals(unit))}${spaced(unit)}`;
}

/** The brackets part of a change: " (+1.4%)", " (0.0%)", or "" when there is no percentage to give. */
export function formatPercentChange(percent: number | null): string {
  if (percent === null) return '';
  return ` (${signOf(percent, 1)}${magnitude(percent, 1)}%)`;
}

/**
 * The Change cell for one logged measure. A yes or no habit's average is a share of days, so its change is in
 * percentage points. A change too small to show at the measure's precision is written "<0.1 kg" rather than as zero:
 * the reading column beside it already says whether it is higher or lower.
 */
export function formatMetricChange(diff: number | null, percent: number | null, unit: string): string {
  if (diff === null) return '—';
  if (diff === 0) return 'No change';
  const decimals = metricDecimals(unit);
  const amount = roundsToZero(diff, decimals)
    ? `<${(10 ** -decimals).toFixed(decimals)}`
    : `${signOf(diff, decimals)}${magnitude(diff, decimals)}`;
  if (unit === YES_NO_UNIT) return `${amount} points`;
  return `${amount}${spaced(unit)}${formatPercentChange(percent)}`;
}

/**
 * A lab result keeps four significant figures, as the Bloodwork screen does, but never drops digits left of the
 * point: 12345.678 is 12346, not 12350. Very small numbers are written in full, never as 1e-7.
 */
export function formatMarkerValue(value: number): string {
  const abs = Math.abs(value);
  if (abs === 0) return '0';
  const places = Math.max(0, 3 - Math.floor(Math.log10(abs)));
  const fixed = abs.toFixed(Math.min(places, 20));
  return fixed.includes('.') ? fixed.replace(/0+$/, '').replace(/\.$/, '') : fixed;
}

/** The Change cell for one blood marker: sign, amount, the marker's own unit, then the percentage when there is one. */
export function formatMarkerChange(delta: number, percent: number | null, unit: string): string {
  if (delta === 0) return 'No change';
  const sign = delta > 0 ? '+' : MINUS;
  return `${sign}${formatMarkerValue(delta)}${spaced(unit)}${formatPercentChange(percent)}`;
}

/** A marker result with its unit, for the Before and After cells. */
export function formatMarkerWithUnit(value: number, unit: string): string {
  return `${formatMarkerValue(value)}${spaced(unit)}`;
}
