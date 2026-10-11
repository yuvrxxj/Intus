// Averages and spreads over a window of nights. Every one carries how many nights it is based on, and none becomes a verdict.
import { dayNumber, isoDay } from '../../lib/dates.ts';
import type { Night } from './nights.ts';
import { clockMedian, clockSd, median } from './time.ts';

/** Fewer than this many recorded nights and an average says too little to show. */
export const MIN_NIGHTS = 5;
/** Fewer than this many and a spread is only rough. */
export const ROUGH_BELOW = 14;

export interface PeriodSummary {
  windowDays: number;
  /** nights with a main sleep in the window */
  nights: number;
  /** false below MIN_NIGHTS: the figures are left null so nothing small is dressed up as a pattern */
  enough: boolean;
  /** the middle night's time asleep, in minutes */
  medianAsleepMin: number | null;
  /** the middle clock time you fell asleep, woke and passed the midpoint of your sleep, in minutes into the day */
  usualAsleepClock: number | null;
  usualWakeClock: number | null;
  usualMidpointClock: number | null;
  /** how much those vary, in minutes (the standard deviation around the circular mean) */
  asleepSdMin: number | null;
  wakeSdMin: number | null;
  midpointSdMin: number | null;
  /** the spread is based on fewer than ROUGH_BELOW nights */
  rough: boolean;
}

/** The nights whose date falls in the `windowDays` days ending on `endKey` (inclusive). */
export function nightsInWindow(nights: readonly Night[], endKey: string, windowDays: number): Night[] {
  const end = dayNumber(endKey);
  const start = end - windowDays + 1;
  return nights.filter((n) => {
    const d = dayNumber(n.key);
    return d >= start && d <= end;
  });
}

export function summarize(nights: readonly Night[], endKey: string, windowDays: number): PeriodSummary {
  const inWindow = nightsInWindow(nights, endKey, windowDays);
  const enough = inWindow.length >= MIN_NIGHTS;
  const asleep = inWindow.map((n) => n.main.metrics.asleepClock);
  const wake = inWindow.map((n) => n.main.metrics.wakeClock);
  const mid = inWindow.map((n) => n.main.metrics.midpointClock);
  return {
    windowDays,
    nights: inWindow.length,
    enough,
    medianAsleepMin: enough ? median(inWindow.map((n) => n.main.metrics.tstMin)) : null,
    usualAsleepClock: enough ? clockMedian(asleep) : null,
    usualWakeClock: enough ? clockMedian(wake) : null,
    usualMidpointClock: enough ? clockMedian(mid) : null,
    asleepSdMin: enough ? clockSd(asleep) : null,
    wakeSdMin: enough ? clockSd(wake) : null,
    midpointSdMin: enough ? clockSd(mid) : null,
    rough: inWindow.length < ROUGH_BELOW,
  };
}

/** The last `windowDays` dates ending on `endKey`, oldest first, with the night recorded on each (or null). Gaps stay gaps. */
export function dayStrip(nights: readonly Night[], endKey: string, windowDays: number): { key: string; night: Night | null }[] {
  const byKey = new Map(nights.map((n) => [n.key, n]));
  const end = dayNumber(endKey);
  return Array.from({ length: windowDays }, (_, i) => {
    const key = isoDay(end - windowDays + 1 + i);
    return { key, night: byKey.get(key) ?? null };
  });
}
