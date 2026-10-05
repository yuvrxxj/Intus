import { PROGRAMME } from '../../config.ts';
import type { DailyLog } from '../../db/dailyLogs.ts';
import { dayNumber } from '../../lib/dates.ts';

export interface WeightStats {
  latest: { weight: number; date: string } | null;
  /** latest minus the programme start weight; negative is a loss */
  fromStartKg: number | null;
  /** mean of the most recent weigh-ins (up to seven) and how many went into it */
  recentAverage: { kg: number; count: number } | null;
  lostKg: number | null;
  toGoKg: number | null;
  /** 0 to 100 of the planned loss achieved */
  percentDone: number | null;
}

/** logs: newest first, as the query returns them. Entries without a weight are skipped. */
export function weightStats(logs: readonly DailyLog[]): WeightStats {
  const weighed = logs.filter((l): l is DailyLog & { weight: number } => typeof l.weight === 'number' && l.weight > 0);
  if (weighed.length === 0) {
    return { latest: null, fromStartKg: null, recentAverage: null, lostKg: null, toGoKg: null, percentDone: null };
  }
  const latest = weighed[0];
  const recent = weighed.slice(0, 7).map((l) => l.weight);
  const planned = PROGRAMME.startWeightKg - PROGRAMME.goalWeightKg;
  const lost = PROGRAMME.startWeightKg - latest.weight;
  return {
    latest: { weight: latest.weight, date: latest.log_date },
    fromStartKg: latest.weight - PROGRAMME.startWeightKg,
    recentAverage: { kg: recent.reduce((a, b) => a + b, 0) / recent.length, count: recent.length },
    lostKg: Math.max(0, lost),
    toGoKg: Math.max(0, latest.weight - PROGRAMME.goalWeightKg),
    percentDone: Math.min(100, Math.max(0, (lost / planned) * 100)),
  };
}

/** Whole days from today to the goal date, by calendar day, or null once it has passed. */
export function daysToGoal(today: string): number | null {
  const days = dayNumber(PROGRAMME.goalDate) - dayNumber(today);
  return days > 0 ? days : null;
}

/** Week of the programme, 1 on the start day through to the last planned week. */
export function programmeWeek(today: string): number {
  const days = dayNumber(today) - dayNumber(PROGRAMME.startDate);
  return Math.min(PROGRAMME.weeks, Math.max(1, Math.floor(days / 7) + 1));
}

export function programmeBlock(week: number): 1 | 2 | 3 {
  return week <= 4 ? 1 : week <= 8 ? 2 : 3;
}

/** Consecutive newest entries that satisfy a test. It counts entries, not calendar days, as the page always has. */
export function streak(logsNewestFirst: readonly DailyLog[], counts: (log: DailyLog) => boolean): number {
  let n = 0;
  for (const log of logsNewestFirst) {
    if (!counts(log)) break;
    n++;
  }
  return n;
}
