import type { Habit } from '../../../src/db/rows.ts';
import { summarize, type Entries } from '../../../src/features/habits/model.ts';
import type { TodayDraft } from '../../../src/features/today/draft.ts';

/** Whether anything has been entered for the day: a field, a mood, a habit answer or a ticked dose. */
export function hasAnyEntry(draft: TodayDraft): boolean {
  return (
    draft.weight !== '' ||
    draft.calories !== '' ||
    draft.protein !== '' ||
    draft.carbs !== '' ||
    draft.fat !== '' ||
    draft.notes.trim() !== '' ||
    draft.mood !== null ||
    Object.keys(draft.habits).length > 0 ||
    Object.values(draft.supplements).some(Boolean)
  );
}

/** One plain line for the Home screen. No score, no praise: what is logged and how many habits are on track. */
export function homeLine(draft: TodayDraft, habits: readonly Habit[], loading: boolean): string {
  if (loading) return 'Loading today…';
  if (!hasAnyEntry(draft)) return 'Nothing logged yet today.';
  const { onTrack, total } = summarize(habits, draft.habits as Entries);
  return total === 0 ? 'Today is logged.' : `Today is logged. ${onTrack} of ${total} habits on track.`;
}

/** "Good morning", "Good afternoon" or "Good evening", from the hour on the phone. */
export function greeting(hour: number): string {
  if (hour < 5) return 'Good evening';
  if (hour < 12) return 'Good morning';
  if (hour < 18) return 'Good afternoon';
  return 'Good evening';
}

/** The save button's words: what pressing it does now, or why it is off. */
export function saveLabel(draft: TodayDraft, dirty: boolean, unsent: boolean): string {
  if (dirty || unsent) return 'Save today';
  return hasAnyEntry(draft) ? 'Saved' : 'Nothing to save';
}
