import type { EffectLog } from '../../db/dailyLogs.ts';
import type { Habit } from '../../db/habits.ts';
import { shortDate } from '../../util/dates.ts';
import { parseEntries, toneOf, type Tone } from '../habits/model.ts';
import { moodWord } from '../today/mood.ts';

/** One line of a chart's history: the day, what was logged, and how it measured up where that is known. */
export interface HistoryRow {
  date: string;
  /** 'D Mon YYYY' */
  dateLabel: string;
  value: string;
  note?: string;
  tone?: Tone;
}

const label = (key: string) => `${shortDate(key)} ${key.slice(0, 4)}`;
const newestFirst = (logs: readonly EffectLog[]) => [...logs].sort((a, b) => (a.log_date < b.log_date ? 1 : a.log_date > b.log_date ? -1 : 0));
const num = (v: unknown): number | null => (typeof v === 'number' && Number.isFinite(v) ? v : v == null ? null : Number.isFinite(Number(v)) ? Number(v) : null);

/** Every weigh-in, newest first, with the change since the one before it. */
export function weightRows(logs: readonly EffectLog[]): HistoryRow[] {
  const sorted = newestFirst(logs).filter((l) => (num(l.weight) ?? 0) > 0);
  return sorted.map((l, i) => {
    const w = num(l.weight) as number;
    const before = sorted[i + 1] ? (num(sorted[i + 1].weight) as number) : null;
    const change = before === null ? undefined : `${w - before > 0 ? '+' : ''}${(w - before).toFixed(1)} kg since the one before`;
    return { date: l.log_date, dateLabel: label(l.log_date), value: `${w} kg`, note: change };
  });
}

/** Every day with calories logged, newest first, against the target when there is one. */
export function calorieRows(logs: readonly EffectLog[], target: number | null): HistoryRow[] {
  return newestFirst(logs)
    .filter((l) => (num(l.total_cals) ?? 0) > 0)
    .map((l) => {
      const c = num(l.total_cals) as number;
      const diff = target === null ? undefined : c > target ? `${(c - target).toLocaleString('en-US')} over` : `${(target - c).toLocaleString('en-US')} under`;
      return { date: l.log_date, dateLabel: label(l.log_date), value: `${c.toLocaleString('en-US')} kcal`, note: diff };
    });
}

export function moodRows(logs: readonly EffectLog[]): HistoryRow[] {
  return newestFirst(logs)
    .filter((l) => (num(l.mood) ?? 0) > 0)
    .map((l) => ({ date: l.log_date, dateLabel: label(l.log_date), value: `${l.mood} ${moodWord(num(l.mood) as number)}`.trim() }));
}

/** Every day the habit has a value, newest first, coloured by how the day measured up to the goal. */
export function habitRows(habit: Pick<Habit, 'id' | 'name' | 'kind' | 'goal' | 'better' | 'unit'>, logs: readonly EffectLog[]): HistoryRow[] {
  const rows: HistoryRow[] = [];
  for (const l of newestFirst(logs)) {
    const entry = parseEntries(l.habits)[habit.id];
    if (entry === undefined) continue;
    const value = habit.kind === 'yesno'
      ? (entry.value === true ? 'Yes' : 'No')
      : `${typeof entry.value === 'number' ? entry.value.toLocaleString('en-US') : '--'}${habit.unit ? ` ${habit.unit}` : ''}`;
    rows.push({ date: l.log_date, dateLabel: label(l.log_date), value, note: entry.note, tone: toneOf(habit, entry) });
  }
  return rows;
}

