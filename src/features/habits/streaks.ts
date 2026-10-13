import type { Habit } from '../../db/habits.ts';
import { dayNumber, isoDay } from '../../lib/dates.ts';
import { betterOf, describeGoal, goalOf, isOnTrack, parseEntries, type Entries } from './model.ts';

/** A day's habit values, as the database holds them: only the date and the habits column are needed. */
export interface HabitDay {
  log_date: string;
  habits: unknown;
}

/**
 * Consecutive calendar days, ending today or yesterday, on which the habit was on track by its own rule: at or past the
 * goal for a more-is-better habit, at or under it for a fewer-is-better one (so for a goal of none, days with none).
 *
 * - A day with no saved log breaks the streak, because nothing says what happened. Today is the exception: it is not
 *   over, so a missing or unanswered today neither counts nor breaks. A more-is-better habit that is not at its goal yet
 *   today (8,000 steps, with 6,000 so far) is the same: today may still get there. A fewer-is-better habit over its goal
 *   today is already broken, because the number cannot go back down.
 * - A count that was left untouched on a saved day is zero, the way the daily log has always saved it.
 * - Any other kind with no answer on a saved day breaks the streak.
 *
 * today is passed in, never read from the clock.
 */
export function habitStreakDays(habit: Pick<Habit, 'id' | 'kind' | 'goal' | 'better'>, days: readonly HabitDay[], today: string): number {
  if (days.length === 0) return 0;
  const byDate = new Map<string, Entries>(days.map((d) => [d.log_date, parseEntries(d.habits)]));
  const earliest = Math.min(...days.map((d) => dayNumber(d.log_date)));
  let count = 0;
  const start = dayNumber(today);
  for (let day = start; day >= earliest; day--) {
    const key = isoDay(day);
    const entries = byDate.get(key);
    const isToday = day === start;
    if (entries === undefined) {
      if (isToday) continue;
      break;
    }
    let entry = entries[habit.id];
    if (entry === undefined && habit.kind === 'count') entry = { value: 0 };
    if (entry === undefined) {
      if (isToday) continue;
      break;
    }
    if (!isOnTrack(habit, entry)) {
      if (isToday && betterOf(habit) === 'higher') continue;
      break;
    }
    count++;
  }
  return count;
}

/** The words under a streak number: "No Cigarettes" for a fewer-is-better habit with a goal of none, else the habit and its goal. */
export function streakLabel(habit: Pick<Habit, 'name' | 'kind' | 'goal' | 'better' | 'unit'>): { title: string; hint: string | null } {
  const better = betterOf(habit);
  const goal = goalOf(habit);
  if (better === 'lower' && habit.kind !== 'yesno' && (goal === null || goal === 0)) return { title: `No ${habit.name}`, hint: null };
  if (better === 'lower' && habit.kind === 'yesno') return { title: habit.name, hint: 'days answered no' };
  return { title: habit.name, hint: describeGoal(habit) };
}
