// Sleep time arithmetic. Everything is done on UTC instants (milliseconds) plus the offset east of UTC in minutes that
// applied at that instant, never on local clock strings, so daylight saving changes and travel cannot corrupt a duration.

export const MINUTE_MS = 60_000;
export const DAY_MIN = 1440;

const mod = (n: number, m: number): number => ((n % m) + m) % m;

/** The calendar date ('YYYY-MM-DD') on the wall clock of the given offset. */
export function localDate(utcMs: number, offsetMin: number): string {
  return new Date(utcMs + offsetMin * MINUTE_MS).toISOString().slice(0, 10);
}

/** Minutes since local midnight, 0 up to but not including 1440. */
export function minutesIntoDay(utcMs: number, offsetMin: number): number {
  return mod((utcMs + offsetMin * MINUTE_MS) / MINUTE_MS, DAY_MIN);
}

/**
 * The date a night is filed under: the local date the person woke up (the rule Fitbit documents as dateOfSleep). The
 * cutoff is the hour at which the sleep day rolls over; 24 is midnight, and 18 would file anything ending after 6 pm
 * under the next date. The offset is the one at the end of the sleep, so a flight across zones during the night is
 * filed where the person woke.
 */
export function nightKey(endUtcMs: number, endOffsetMin: number, cutoffHour = 24): string {
  return new Date(endUtcMs + endOffsetMin * MINUTE_MS + (24 - cutoffHour) * 3_600_000).toISOString().slice(0, 10);
}

/** The instant for a local date and clock time ('2026-10-09', '23:10') at an offset. Null if either is malformed. */
export function instantFor(date: string, clock: string, offsetMin: number): number | null {
  const d = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date);
  const t = /^(\d{2}):(\d{2})$/.exec(clock);
  if (!d || !t) return null;
  const [y, mo, da, h, mi] = [d[1], d[2], d[3], t[1], t[2]].map(Number);
  if (mo < 1 || mo > 12 || da < 1 || da > 31 || h > 23 || mi > 59) return null;
  const ms = Date.UTC(y, mo - 1, da, h, mi);
  // Date.UTC rolls 31 Feb into March; a date that did not survive the trip is not a real date
  if (new Date(ms).toISOString().slice(0, 10) !== date) return null;
  return ms - offsetMin * MINUTE_MS;
}

/** '23:10'. Minutes past 1440 or below 0 wrap around the clock. */
export function formatClock(minutes: number): string {
  const m = Math.floor(mod(minutes, DAY_MIN) + 1e-9);
  return `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
}

/** '7 h 05' for 425, '45 min' for 45, '8 h' for 480. Whole minutes. */
export function formatDuration(totalMin: number): string {
  const m = Math.round(totalMin);
  if (m < 60) return `${m} min`;
  const h = Math.floor(m / 60);
  const rest = m % 60;
  return rest === 0 ? `${h} h` : `${h} h ${String(rest).padStart(2, '0')}`;
}

/** Rounded to the nearest 5 minutes, which is as precise as a wrist device can honestly be. */
export function roundTo5(minutes: number): number {
  return Math.round(minutes / 5) * 5;
}

export function mean(xs: readonly number[]): number | null {
  return xs.length === 0 ? null : xs.reduce((a, b) => a + b, 0) / xs.length;
}

export function median(xs: readonly number[]): number | null {
  if (xs.length === 0) return null;
  const sorted = [...xs].sort((a, b) => a - b);
  const mid = sorted.length >> 1;
  return sorted.length % 2 === 1 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

/** The signed shortest distance from m to x around a 24 hour clock, in [-720, 720). */
export function wrapDiff(x: number, m: number): number {
  const d = mod(mod(x - m, DAY_MIN), DAY_MIN);
  return d >= 720 ? d - DAY_MIN : d;
}

/**
 * How tightly a set of clock times cluster, 0 (spread evenly around the clock) to 1 (all the same). The usual mean and
 * standard deviation are wrong for clock times that straddle midnight: 23:30 and 00:30 average to 12:00.
 */
export function clockConcentration(times: readonly number[]): number {
  if (times.length === 0) return 0;
  const k = (2 * Math.PI) / DAY_MIN;
  const c = times.reduce((a, x) => a + Math.cos(k * x), 0) / times.length;
  const s = times.reduce((a, x) => a + Math.sin(k * x), 0) / times.length;
  return Math.hypot(c, s);
}

/** The average clock time, in minutes into the day, or null when the times are spread evenly around the clock. */
export function clockMean(times: readonly number[]): number | null {
  if (times.length === 0) return null;
  const k = (2 * Math.PI) / DAY_MIN;
  const c = times.reduce((a, x) => a + Math.cos(k * x), 0) / times.length;
  const s = times.reduce((a, x) => a + Math.sin(k * x), 0) / times.length;
  if (Math.hypot(c, s) < 1e-9) return null;
  return mod(Math.atan2(s, c) / k, DAY_MIN);
}

/** The middle clock time: the median distance from the circular mean, added back. Null when there is no meaningful centre. */
export function clockMedian(times: readonly number[]): number | null {
  const centre = clockMean(times);
  if (centre === null) return null;
  const spread = median(times.map((x) => wrapDiff(x, centre)));
  return spread === null ? null : mod(centre + spread, DAY_MIN);
}

/**
 * The sample standard deviation of clock times in minutes, measured around the circular mean so a bedtime that moves
 * from 23:30 to 00:30 counts as an hour, not as twelve. Null for fewer than two times, or when they are spread so
 * widely round the clock (shift work) that a single spread figure would mean nothing.
 */
export function clockSd(times: readonly number[]): number | null {
  if (times.length < 2) return null;
  if (clockConcentration(times) < 0.3) return null;
  const centre = clockMean(times);
  if (centre === null) return null;
  const offsets = times.map((x) => wrapDiff(x, centre));
  const mu = offsets.reduce((a, b) => a + b, 0) / offsets.length;
  return Math.sqrt(offsets.reduce((a, d) => a + (d - mu) ** 2, 0) / (offsets.length - 1));
}
