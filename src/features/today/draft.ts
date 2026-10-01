import type { DailyLog, DailyLogInsert } from '../../db/dailyLogs.ts';

export type Toggle = 'yes' | 'no' | 'bad';

export interface TodayDraft {
  weight: string;
  calories: string;
  protein: string;
  carbs: string;
  fat: string;
  lift: Toggle | null;
  core: Toggle | null;
  cardio: Toggle | null;
  cigs: number;
  mood: number | null;
  notes: string;
  supplements: Record<string, boolean>;
}

export const EMPTY_DRAFT: TodayDraft = {
  weight: '', calories: '', protein: '', carbs: '', fat: '', lift: null, core: null, cardio: null,
  cigs: 0, mood: null, notes: '', supplements: {},
};

function toggleOf(value: string | null): Toggle | null {
  return value === 'yes' || value === 'no' || value === 'bad' ? value : null;
}

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
    lift: toggleOf(log.lift),
    core: toggleOf(log.core),
    cardio: toggleOf(log.cardio),
    cigs: log.cigs ?? 0,
    mood: log.mood,
    notes: log.mood_notes ?? '',
    supplements: supplementsOf(log.supplements),
  };
}

// Blank fields save as null, as the page always has; loading today's log first is what keeps earlier entries.
const asFloat = (s: string) => parseFloat(s) || null;
const asInt = (s: string) => parseInt(s, 10) || null;

export function recordFromDraft(draft: TodayDraft, date: string, savedAt: string): DailyLogInsert {
  return {
    log_date: date,
    weight: asFloat(draft.weight),
    protein: asInt(draft.protein),
    carbs: asInt(draft.carbs),
    fat: asInt(draft.fat),
    total_cals: asInt(draft.calories),
    lift: draft.lift,
    core: draft.core,
    cardio: draft.cardio,
    cigs: draft.cigs,
    mood: draft.mood,
    mood_notes: draft.notes,
    supplements: draft.supplements,
    saved_at: savedAt,
  };
}
