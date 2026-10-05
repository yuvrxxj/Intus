import type { DailyLog, DailyLogInsert } from '../../db/dailyLogs.ts';
import type { Habit } from '../../db/habits.ts';
import { parseEntries, serializeEntries, withUntouchedCounts, type Entries } from '../habits/model.ts';

export interface TodayDraft {
  weight: string;
  calories: string;
  protein: string;
  carbs: string;
  fat: string;
  /** what the person logged for each habit today, by habit id */
  habits: Entries;
  mood: number | null;
  notes: string;
  supplements: Record<string, boolean>;
}

export const EMPTY_DRAFT: TodayDraft = {
  weight: '', calories: '', protein: '', carbs: '', fat: '', habits: {}, mood: null, notes: '', supplements: {},
};

function supplementsOf(value: DailyLog['supplements']): Record<string, boolean> {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) return {};
  return Object.fromEntries(Object.entries(value).filter(([, v]) => typeof v === 'boolean')) as Record<string, boolean>;
}

const text = (n: number | null) => (n == null ? '' : String(n));

export function draftFromLog(log: DailyLog): TodayDraft {
  return {
    weight: text(log.weight),
    calories: text(log.total_cals),
    protein: text(log.protein),
    carbs: text(log.carbs),
    fat: text(log.fat),
    habits: parseEntries(log.habits),
    mood: log.mood,
    notes: log.mood_notes ?? '',
    supplements: supplementsOf(log.supplements),
  };
}

// Blank fields save as null, as the page always has; loading today's log first is what keeps earlier entries.
const asFloat = (s: string) => parseFloat(s) || null;
const asInt = (s: string) => parseInt(s, 10) || null;

/**
 * habits: the person's habit list, so a count they never touched today is saved as zero. The old lift, core, cardio
 * and cigarette columns are no longer written; the habits column carries all of it now.
 */
export function recordFromDraft(draft: TodayDraft, date: string, savedAt: string, habits: readonly Habit[] = []): DailyLogInsert {
  return {
    log_date: date,
    weight: asFloat(draft.weight),
    protein: asInt(draft.protein),
    carbs: asInt(draft.carbs),
    fat: asInt(draft.fat),
    total_cals: asInt(draft.calories),
    habits: serializeEntries(withUntouchedCounts(habits, draft.habits)),
    mood: draft.mood,
    mood_notes: draft.notes,
    supplements: draft.supplements,
    saved_at: savedAt,
  };
}
