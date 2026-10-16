import type { DailyLog, Habit } from '../../../src/db/rows.ts';
import { serializeEntries, withUntouchedCounts, type Entries } from '../../../src/features/habits/model.ts';
import { habitStreakDays } from '../../../src/features/habits/streaks.ts';

/**
 * Streaks for each habit, counting today as the person has it on screen (saved or not), over the saved days before it.
 * Pure, so the node tests cover it.
 */
export function streaksFor(habits: readonly Habit[], recent: readonly DailyLog[], draftHabits: Entries, today: string): Record<string, number> {
  const days = [
    { log_date: today, habits: serializeEntries(withUntouchedCounts(habits, draftHabits)) },
    ...recent.filter((l) => l.log_date !== today).map((l) => ({ log_date: l.log_date, habits: l.habits })),
  ];
  return Object.fromEntries(habits.map((h) => [h.id, habitStreakDays(h, days, today)]));
}
