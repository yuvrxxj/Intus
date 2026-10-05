import { dayNumber } from './dates.ts';

const SQRT_PI = Math.sqrt(Math.PI);

export const TREND = Object.freeze({
  INCREASING: 'increasing',
  DECREASING: 'decreasing',
  NO_TREND: 'no_trend',
  INSUFFICIENT_DATA: 'insufficient_data',
});

export type TrendDirection = (typeof TREND)[keyof typeof TREND];

export interface MannKendallOptions {
  alpha?: number;
  minPoints?: number;
}

export interface MannKendallResult {
  direction: TrendDirection;
  n: number;
  s: number | null;
  variance: number | null;
  z: number | null;
  p: number | null;
}

export interface TrendResult extends MannKendallResult {
  slopePerDay: number | null;
}

export interface DatedReading {
  measured_at: string;
  value: number | string | null;
}

// positive-term series: no cancellation, so accurate for the small-to-moderate tail
function erfSeries(x: number): number {
  let term = x;
  let sum = x;
  for (let k = 0; term > 1e-17 * sum; k++) {
    term *= (2 * x * x) / (2 * k + 3);
    sum += term;
  }
  return (2 / SQRT_PI) * Math.exp(-x * x) * sum;
}

// continued fraction keeps relative accuracy where 1 - erf would round to zero
function erfcTail(x: number): number {
  let denominator = x;
  for (let k = 60; k >= 1; k--) denominator = x + k / 2 / denominator;
  return Math.exp(-x * x) / (SQRT_PI * denominator);
}

export function twoSidedNormalP(z: number): number {
  const x = Math.abs(z) / Math.SQRT2;
  return x < 2.5 ? 1 - erfSeries(x) : erfcTail(x);
}

function assertFinite(values: readonly number[]): void {
  if (!values.every(Number.isFinite)) throw new TypeError('values must be finite numbers');
}

function tieTerm(values: readonly number[]): number {
  const counts = new Map<number, number>();
  for (const v of values) counts.set(v, (counts.get(v) ?? 0) + 1);
  let sum = 0;
  for (const t of counts.values()) sum += t * (t - 1) * (2 * t + 5);
  return sum;
}

/** values must be ordered oldest to newest */
export function mannKendall(
  values: readonly number[],
  { alpha = 0.05, minPoints = 5 }: MannKendallOptions = {},
): MannKendallResult {
  assertFinite(values);
  const n = values.length;
  if (n < minPoints) {
    return { direction: TREND.INSUFFICIENT_DATA, n, s: null, variance: null, z: null, p: null };
  }
  let s = 0;
  for (let i = 0; i < n - 1; i++) {
    for (let j = i + 1; j < n; j++) s += Math.sign(values[j] - values[i]);
  }
  const variance = (n * (n - 1) * (2 * n + 5) - tieTerm(values)) / 18;
  if (variance === 0) return { direction: TREND.NO_TREND, n, s, variance, z: 0, p: 1 };

  const z = s === 0 ? 0 : (s - Math.sign(s)) / Math.sqrt(variance);
  const p = twoSidedNormalP(z);
  let direction: TrendDirection = TREND.NO_TREND;
  if (p < alpha) direction = z > 0 ? TREND.INCREASING : TREND.DECREASING;
  return { direction, n, s, variance, z, p };
}

export function theilSenSlope(xs: readonly number[], ys: readonly number[]): number | null {
  const slopes: number[] = [];
  for (let i = 0; i < xs.length - 1; i++) {
    for (let j = i + 1; j < xs.length; j++) {
      const dx = xs[j] - xs[i];
      if (dx !== 0) slopes.push((ys[j] - ys[i]) / dx);
    }
  }
  if (slopes.length === 0) return null;
  slopes.sort((a, b) => a - b);
  const mid = slopes.length >> 1;
  return slopes.length % 2 ? slopes[mid] : (slopes[mid - 1] + slopes[mid]) / 2;
}

/** readings: [{ measured_at: 'YYYY-MM-DD', value }] in any order */
export function trendOfReadings(readings: readonly DatedReading[], options?: MannKendallOptions): TrendResult {
  const points = readings
    .map((r) => ({ day: dayNumber(r.measured_at), value: Number(r.value ?? NaN) }))
    .sort((a, b) => a.day - b.day);
  const values = points.map((pt) => pt.value);
  const result = mannKendall(values, options);
  const slopePerDay =
    result.direction === TREND.INSUFFICIENT_DATA
      ? null
      : theilSenSlope(points.map((pt) => pt.day), values);
  return { ...result, slopePerDay };
}
