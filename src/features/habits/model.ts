import type { Habit, HabitInput } from '../../db/habits.ts';
import type { Json } from '../../db/types.ts';
import { toNumberOrNull } from '../../lib/numbers.ts';

export type HabitKind = 'count' | 'yesno' | 'amount';
export type Better = 'higher' | 'lower';

export const KIND_LABEL: Record<HabitKind, string> = {
  count: 'A count (cigarettes, drinks)',
  yesno: 'Yes or no (lifted, drank today)',
  amount: 'An amount against a goal (steps, water)',
};

export const MAX_HABITS = 12;
export const MAX_NAME = 60;
export const MAX_UNIT = 20;
export const MAX_NOTE = 80;
export const MAX_COUNT = 999;
export const MAX_GOAL = 100000;

// ── what a day holds ─────────────────────────────────────────────────────────────────────────────

/** One habit on one day: a yes or no (true or false), or a number, and an optional short note. */
export interface HabitEntry {
  value: number | boolean;
  note?: string;
}
export type Entries = Record<string, HabitEntry>;

/** Reads the daily log's habits column. Anything that is not a clean entry is dropped rather than trusted. */
export function parseEntries(raw: unknown): Entries {
  const out: Entries = {};
  if (raw === null || typeof raw !== 'object' || Array.isArray(raw)) return out;
  for (const [id, entry] of Object.entries(raw as Record<string, unknown>)) {
    if (entry === null || typeof entry !== 'object' || Array.isArray(entry)) continue;
    const { value, note } = entry as { value?: unknown; note?: unknown };
    const ok = typeof value === 'boolean' || (typeof value === 'number' && Number.isFinite(value));
    if (!ok) continue;
    const trimmed = typeof note === 'string' ? note.trim().slice(0, MAX_NOTE) : '';
    out[id] = trimmed === '' ? { value } : { value, note: trimmed };
  }
  return out;
}

/** What gets written to the column. Notes are trimmed and an empty note is left out. */
export function serializeEntries(entries: Entries): Json {
  const out: Record<string, Json> = {};
  for (const [id, entry] of Object.entries(entries)) {
    const note = entry.note?.trim().slice(0, MAX_NOTE);
    out[id] = note ? { value: entry.value, note } : { value: entry.value };
  }
  return out;
}

// ── a habit and how a day measures up ────────────────────────────────────────────────────────────

export function isKind(value: unknown): value is HabitKind {
  return value === 'count' || value === 'yesno' || value === 'amount';
}

/** The daily goal as a number. The column is numeric, so it can arrive as a string. */
export function goalOf(habit: { goal?: number | null }): number | null {
  try {
    return toNumberOrNull(habit.goal, 'habit goal');
  } catch {
    return null;
  }
}

export const betterOf = (habit: { better?: string }): Better => (habit.better === 'lower' ? 'lower' : 'higher');

export type Tone = 'good' | 'ok' | 'bad' | 'none';

/**
 * How a day's value measures up. A yes or no is good when it matches the direction (yes for a higher-is-better
 * habit, no for a lower-is-better one). A number is good at or past the goal, "ok" within reach, bad otherwise. Lower
 * habits with no goal aim for none, and higher habits with no goal are good when there is anything at all.
 * "Within reach" is half the goal for higher habits, and for lower ones a quarter over the goal, or 3 over for a count.
 */
export function toneOf(habit: Pick<Habit, 'kind' | 'goal' | 'better'>, entry: HabitEntry | undefined): Tone {
  if (entry === undefined) return 'none';
  const better = betterOf(habit);
  if (habit.kind === 'yesno') {
    const yes = entry.value === true || (typeof entry.value === 'number' && entry.value > 0);
    return yes === (better === 'higher') ? 'good' : 'bad';
  }
  const value = typeof entry.value === 'number' ? entry.value : Number(entry.value);
  const goal = goalOf(habit);
  if (better === 'higher') {
    if (goal === null || goal <= 0) return value > 0 ? 'good' : 'none';
    return value >= goal ? 'good' : value >= goal / 2 ? 'ok' : 'bad';
  }
  const target = goal ?? 0;
  if (value <= target) return 'good';
  const slack = Math.max(habit.kind === 'count' ? 3 : 0, target * 0.25);
  return value <= target + slack ? 'ok' : 'bad';
}

export const isOnTrack = (habit: Pick<Habit, 'kind' | 'goal' | 'better'>, entry: HabitEntry | undefined): boolean =>
  toneOf(habit, entry) === 'good';

/** The ones to show on Today and count, in the order they were added. */
export function activeHabits(habits: readonly Habit[]): Habit[] {
  return habits.filter((h) => h.archived_at == null && isKind(h.kind));
}

export function archivedHabits(habits: readonly Habit[]): Habit[] {
  return habits.filter((h) => h.archived_at != null && isKind(h.kind));
}

export interface HabitsSummary {
  onTrack: number;
  total: number;
}

/** How many of the active habits are on track in the given entries. */
export function summarize(habits: readonly Habit[], entries: Entries): HabitsSummary {
  const active = activeHabits(habits);
  return { onTrack: active.filter((h) => isOnTrack(h, entries[h.id])).length, total: active.length };
}

/** "Aim for yes", "At most 3", "At least 8,000 steps", or null when there is nothing to say. */
export function describeGoal(habit: { kind: string; goal?: number | null; better?: string; unit?: string | null }): string | null {
  const better = betterOf(habit);
  if (habit.kind === 'yesno') return better === 'higher' ? 'Aim for yes' : 'Aim for no';
  const goal = goalOf(habit);
  if (goal === null || (goal === 0 && better === 'lower')) return better === 'lower' ? 'Aim for none' : null;
  const amount = `${goal.toLocaleString('en-US')}${habit.unit ? ` ${habit.unit}` : ''}`;
  return `${better === 'lower' ? 'At most' : 'At least'} ${amount}`;
}

/** Share of the goal reached, 0 to 1, for a bar. Null when there is no goal to measure against. */
export function fractionOfGoal(habit: { goal?: number | null }, entry: HabitEntry | undefined): number | null {
  const goal = goalOf(habit);
  if (entry === undefined || typeof entry.value !== 'number' || goal === null || goal <= 0) return null;
  return Math.min(1, Math.max(0, entry.value / goal));
}

/** Consecutive newest entries (as the page counts streaks) where the habit was on track. */
export function habitStreak(habit: Pick<Habit, 'id' | 'kind' | 'goal' | 'better'>, entriesNewestFirst: readonly Entries[]): number {
  let n = 0;
  for (const entries of entriesNewestFirst) {
    if (!isOnTrack(habit, entries[habit.id])) break;
    n++;
  }
  return n;
}

/**
 * A count habit that was not touched today is saved as zero, the way cigarettes always were, so a quiet day counts
 * as a logged day. Other kinds are only saved once answered.
 */
export function withUntouchedCounts(habits: readonly Habit[], entries: Entries): Entries {
  const out = { ...entries };
  for (const h of activeHabits(habits)) if (h.kind === 'count' && out[h.id] === undefined) out[h.id] = { value: 0 };
  return out;
}

// ── the add and edit form ────────────────────────────────────────────────────────────────────────

export interface HabitForm {
  name: string;
  kind: HabitKind;
  unit: string;
  goal: string;
  better: Better;
}

export const EMPTY_HABIT_FORM: HabitForm = { name: '', kind: 'yesno', unit: '', goal: '', better: 'higher' };

export function formFromHabit(habit: Habit): HabitForm {
  const goal = goalOf(habit);
  return {
    name: habit.name,
    kind: isKind(habit.kind) ? habit.kind : 'count',
    unit: habit.unit ?? '',
    goal: goal === null ? '' : String(goal),
    better: betterOf(habit),
  };
}

export type HabitFormErrors = Partial<Record<keyof HabitForm, string>>;

export type HabitFormResult =
  | { ok: true; value: HabitInput }
  | { ok: false; errors: HabitFormErrors };

/**
 * others: the person's other active habits, so a name is not used twice and the limit holds. Pass every active
 * habit except the one being edited.
 */
export function validateHabitForm(form: HabitForm, others: readonly Pick<Habit, 'name'>[]): HabitFormResult {
  const errors: HabitFormErrors = {};
  const name = form.name.trim();
  if (name === '') errors.name = 'Enter a name';
  else if (name.length > MAX_NAME) errors.name = `Keep the name under ${MAX_NAME + 1} characters`;
  else if (others.some((o) => o.name.trim().toLowerCase() === name.toLowerCase())) errors.name = 'You already track a habit with that name';
  else if (others.length >= MAX_HABITS) errors.name = `You can track up to ${MAX_HABITS} habits. Archive one to add another.`;

  let unit: string | null = null;
  let goal: number | null = null;
  if (form.kind !== 'yesno') {
    unit = form.unit.trim() === '' ? null : form.unit.trim();
    if (unit !== null && unit.length > MAX_UNIT) errors.unit = `Keep the unit under ${MAX_UNIT + 1} characters`;
    if (form.goal.trim() !== '') {
      const n = Number(form.goal.trim());
      if (!Number.isFinite(n) || n < 0 || n > MAX_GOAL) errors.goal = `Enter a goal from 0 to ${MAX_GOAL.toLocaleString('en-US')}`;
      else if (form.kind === 'count' && !Number.isInteger(n)) errors.goal = 'A count goal is a whole number';
      else if (n === 0 && form.better === 'higher') errors.goal = 'A goal of 0 only makes sense when lower is better';
      else goal = n;
    }
  }

  if (Object.keys(errors).length > 0) return { ok: false, errors };
  return { ok: true, value: { name, kind: form.kind, unit, goal, better: form.better } };
}

export interface Preset {
  label: string;
  /** a few words on what it tracks */
  hint: string;
  value: HabitInput;
}

/** Quick starts, also what onboarding will offer. Cardio's type (stairmaster, running) goes in the day's note. */
export const PRESETS: readonly Preset[] = [
  { label: 'Cigarettes', hint: 'a count, fewer is better', value: { name: 'Cigarettes', kind: 'count', unit: null, goal: 0, better: 'lower' } },
  { label: 'Drinks', hint: 'a count, fewer is better', value: { name: 'Drinks', kind: 'count', unit: null, goal: 0, better: 'lower' } },
  { label: 'Drank today', hint: 'yes or no, no is better', value: { name: 'Drank today', kind: 'yesno', unit: null, goal: null, better: 'lower' } },
  { label: 'Lift', hint: 'yes or no', value: { name: 'Lift', kind: 'yesno', unit: null, goal: null, better: 'higher' } },
  { label: 'Core', hint: 'yes or no', value: { name: 'Core', kind: 'yesno', unit: null, goal: null, better: 'higher' } },
  { label: 'Cardio', hint: 'yes or no, with the type as a note', value: { name: 'Cardio', kind: 'yesno', unit: null, goal: null, better: 'higher' } },
  { label: 'Steps', hint: 'an amount against a goal', value: { name: 'Steps', kind: 'amount', unit: 'steps', goal: 8000, better: 'higher' } },
  { label: 'Water', hint: 'an amount against a goal', value: { name: 'Water', kind: 'amount', unit: 'L', goal: 2, better: 'higher' } },
];

/** Presets not already tracked, so each is offered once. */
export function availablePresets(active: readonly Pick<Habit, 'name'>[]): Preset[] {
  const taken = new Set(active.map((h) => h.name.trim().toLowerCase()));
  return PRESETS.filter((p) => !taken.has(p.value.name.toLowerCase()));
}

/** The sort order for a habit added now, one past the last. */
export function nextSortOrder(habits: readonly Pick<Habit, 'sort_order'>[]): number {
  return habits.reduce((max, h) => Math.max(max, h.sort_order), -1) + 1;
}

/**
 * The habits to give a column or chart: everything the person tracks now, plus archived habits that still have
 * values in the days shown, so archiving never makes history vanish. In the order they were added.
 */
export function habitsWithHistory(habits: readonly Habit[], daysEntries: readonly Entries[]): Habit[] {
  const used = new Set(daysEntries.flatMap((e) => Object.keys(e)));
  return habits.filter((h) => isKind(h.kind) && (h.archived_at == null || used.has(h.id)));
}
