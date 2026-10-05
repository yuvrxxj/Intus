import type { ChangeDirection, RangeStatus } from './model.ts';

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** '2026-06-06' becomes '6 Jun 2026'. Read from the text, never through Date, so no timezone can shift the day. */
export function formatDay(iso: string): string {
  const [year, month, day] = iso.slice(0, 10).split('-').map(Number);
  return `${day} ${MONTHS[month - 1]} ${year}`;
}

/** A lab value as written: no padding, no float noise. */
export function formatValue(value: number): string {
  return String(Number(value.toPrecision(10)));
}

export function formatDelta(delta: number): string {
  const rounded = Number(Math.abs(delta).toPrecision(4));
  return String(rounded);
}

export function formatRange(low: number | null, high: number | null): string {
  if (low !== null && high !== null) return `${formatValue(low)}–${formatValue(high)}`;
  if (high !== null) return `<${formatValue(high)}`;
  if (low !== null) return `>${formatValue(low)}`;
  return 'none set';
}

export const RANGE_LABEL: Record<RangeStatus, string> = {
  in_range: 'In range',
  below: 'Below range',
  above: 'Above range',
  no_range: 'No range',
};

export const ARROW: Record<ChangeDirection, string> = { up: '↑', down: '↓', flat: '→' };

export const DIRECTION_WORD: Record<ChangeDirection, string> = { up: 'Up', down: 'Down', flat: 'No change' };

export function describeDays(days: number): string {
  if (days === 0) return 'the same day';
  if (days < 60) return `${days} day${days === 1 ? '' : 's'} earlier`;
  if (days < 365) return `${Math.round(days / 30.4375)} months earlier`;
  return `${(days / 365.25).toFixed(1)} years earlier`;
}
