import { Check, X } from 'lucide-react';
import type { DailyLog } from '../../db/dailyLogs.ts';
import type { Programme } from '../../lib/programme.ts';
import { shortDate } from '../../util/dates.ts';
import { useHabits } from '../habits/HabitsContext.tsx';
import { habitsWithHistory, parseEntries, toneOf, type HabitEntry, type Tone } from '../habits/model.ts';
import type { Habit } from '../../db/habits.ts';
import { useProgramme } from '../profile/ProfileContext.tsx';
import { moodWord } from '../today/mood.ts';

const TONE_COLOR: Record<Tone, string> = { good: 'var(--green)', ok: 'var(--warn)', bad: 'var(--red)', none: 'var(--muted)' };

function HabitCell({ habit, entry }: { habit: Habit; entry: HabitEntry | undefined }) {
  if (entry === undefined) return <span className="text-ink-3">--</span>;
  const tone = toneOf(habit, entry);
  const note = entry.note ? <span className="hist-note" title={entry.note}>{entry.note}</span> : null;
  if (habit.kind === 'yesno') {
    const yes = entry.value === true;
    return <><span className={`pill ${tone === 'good' ? 'pill-g' : 'pill-r'}`} aria-label={yes ? 'Yes' : 'No'}>{yes ? <Check className="size-3" strokeWidth={3} /> : <X className="size-3" strokeWidth={3} />}</span>{note}</>;
  }
  return <><span style={{ color: TONE_COLOR[tone] }}>{typeof entry.value === 'number' ? entry.value.toLocaleString('en-US') : '--'}</span>{note}</>;
}

function calorieColor(c: number | null, programme: Programme | null): string {
  if (!c) return 'var(--muted)';
  if (programme?.calorieOver == null || programme.calorieNear == null) return 'var(--txt)';
  return c > programme.calorieOver ? 'var(--red)' : c >= programme.calorieNear ? 'var(--warn)' : 'var(--green)';
}

export function History({ logs, loading, error }: { logs: readonly DailyLog[]; loading: boolean; error: string | null }) {
  const programme = useProgramme();
  const habits = useHabits();
  const dayEntries = logs.map((l) => parseEntries(l.habits));
  const columns = habitsWithHistory(habits.habits, dayEntries);
  return (
    <div className="card">
      <div className="ct"><span className="dot dot-dim" />Every logged day</div>
      <div className="ht-wrap">
        {loading ? (
          <div className="loading">Loading</div>
        ) : error ? (
          <div className="loading" style={{ animation: 'none' }} role="alert">{error}</div>
        ) : logs.length === 0 ? (
          <div className="loading" style={{ animation: 'none' }}>No entries yet</div>
        ) : (
          <table className="ht">
            <thead>
              <tr><th>Date</th><th>Weight</th><th>Cals</th><th>P/C/F</th>{columns.map((h) => <th key={h.id} title={h.name}>{h.name}</th>)}<th>Mood</th></tr>
            </thead>
            <tbody>
              {logs.map((d, i) => {
                const macros = d.protein || d.carbs || d.fat ? `${d.protein || '?'}/${d.carbs || '?'}/${d.fat || '?'}` : '--';
                return (
                  <tr key={d.log_date}>
                    <td className="font-mono whitespace-nowrap text-ink-3">{shortDate(d.log_date)}</td>
                    <td className="font-mono font-medium whitespace-nowrap">{d.weight ? `${d.weight} kg` : '--'}</td>
                    <td className="font-mono" style={{ color: calorieColor(d.total_cals, programme) }}>{d.total_cals || '--'}</td>
                    <td className="font-mono text-xs text-ink-3">{macros}</td>
                    {columns.map((h) => <td key={h.id}><HabitCell habit={h} entry={dayEntries[i][h.id]} /></td>)}
                    <td className="whitespace-nowrap">{d.mood ? <><span className="font-mono">{d.mood}</span> <span className="text-ink-3">{moodWord(d.mood)}</span></> : '--'}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
