import type { DailyLog } from '../../db/dailyLogs.ts';
import { dayNumber } from '../../lib/dates.ts';
import type { Programme } from '../../lib/programme.ts';

export interface WeightStats {
  latest: { weight: number; date: string } | null;
  /** latest minus the start weight; negative means below where the goal started. Null without a goal. */
  fromStartKg: number | null;
  /** mean of the most recent weigh-ins (up to seven) and how many went into it */
  recentAverage: { kg: number; count: number } | null;
  /** kg moved toward the goal so far, never negative. Null without a goal, or for a keep-steady goal. */
  progressKg: number | null;
  /** kg still to go to reach the goal weight, never negative. Null without a goal. */
  toGoKg: number | null;
  /** 0 to 100 of the planned change achieved. Null without a goal, or for a keep-steady goal. */
  percentDone: number | null;
}

/**
 * logs: newest first, as the query returns them. Entries without a weight are skipped. programme: the person's
 * current goal, or null before they have set one. It works for losing, gaining and keeping weight.
 */
export function weightStats(logs: readonly DailyLog[], programme: Programme | null): WeightStats {
  const weighed = logs.filter((l): l is DailyLog & { weight: number } => typeof l.weight === 'number' && l.weight > 0);
  if (weighed.length === 0) {
    return { latest: null, fromStartKg: null, recentAverage: null, progressKg: null, toGoKg: null, percentDone: null };
  }
  const latest = weighed[0];
  const recent = weighed.slice(0, 7).map((l) => l.weight);
  const base = {
    latest: { weight: latest.weight, date: latest.log_date },
    recentAverage: { kg: recent.reduce((a, b) => a + b, 0) / recent.length, count: recent.length },
  };
  if (!programme) return { ...base, fromStartKg: null, progressKg: null, toGoKg: null, percentDone: null };

  const planned = programme.goalWeightKg - programme.startWeightKg; // negative when losing
  const moved = latest.weight - programme.startWeightKg;
  if (programme.direction === 'maintain') {
    return { ...base, fromStartKg: moved, progressKg: null, toGoKg: Math.abs(latest.weight - programme.goalWeightKg), percentDone: null };
  }
  const sign = Math.sign(planned);
  return {
    ...base,
    fromStartKg: moved,
    progressKg: Math.max(0, moved * sign),
    toGoKg: Math.max(0, (programme.goalWeightKg - latest.weight) * sign),
    percentDone: Math.min(100, Math.max(0, (moved / planned) * 100)),
  };
}

/** Whole days from today to the goal date, by calendar day, or null once it has passed. */
export function daysToGoal(programme: Programme, today: string): number | null {
  const days = dayNumber(programme.goalDate) - dayNumber(today);
  return days > 0 ? days : null;
}

/** Week of the goal, 1 on the start day through to the last planned week. */
export function programmeWeek(programme: Programme, today: string): number {
  const days = dayNumber(today) - dayNumber(programme.startDate);
  return Math.min(programme.weeks, Math.max(1, Math.floor(days / 7) + 1));
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
