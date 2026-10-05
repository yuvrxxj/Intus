import type { DailyLog } from '../../db/dailyLogs.ts';
import type { Programme } from '../../lib/programme.ts';
import { shortDate } from '../../util/dates.ts';
import { useHabits } from '../habits/HabitsContext.tsx';
import { habitsWithHistory, parseEntries, toneOf, type HabitEntry, type Tone } from '../habits/model.ts';
import type { Habit } from '../../db/habits.ts';
import { useProgramme } from '../profile/ProfileContext.tsx';

const MOOD_FACES = ['', '😤', '😞', '😐', '🙂', '🔥'];
const TONE_COLOR: Record<Tone, string> = { good: 'var(--green)', ok: 'var(--yellow)', bad: 'var(--red)', none: 'var(--muted)' };

function HabitCell({ habit, entry }: { habit: Habit; entry: HabitEntry | undefined }) {
  if (entry === undefined) return <>–</>;
  const tone = toneOf(habit, entry);
  const note = entry.note ? <span className="hist-note" title={entry.note}>{entry.note}</span> : null;
  if (habit.kind === 'yesno') {
    const yes = entry.value === true;
    return <><span className={`pill ${tone === 'good' ? 'pill-g' : 'pill-r'}`}>{yes ? '✓' : '✗'}</span>{note}</>;
  }
  return <><span style={{ color: TONE_COLOR[tone] }}>{typeof entry.value === 'number' ? entry.value.toLocaleString('en-US') : '–'}</span>{note}</>;
}

function calorieColor(c: number | null, programme: Programme | null): string {
  if (!c) return 'var(--muted)';
  if (programme?.calorieOver == null || programme.calorieNear == null) return 'var(--txt)';
  return c > programme.calorieOver ? 'var(--red)' : c >= programme.calorieNear ? 'var(--yellow)' : 'var(--green)';
}

export function History({ logs, loading, error }: { logs: readonly DailyLog[]; loading: boolean; error: string | null }) {
  const programme = useProgramme();
  const habits = useHabits();
  const dayEntries = logs.map((l) => parseEntries(l.habits));
  const columns = habitsWithHistory(habits.habits, dayEntries);
  return (
    <div className="card">
      <div className="ct"><span className="dot dot-dim" />Log History</div>
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
                const macros = d.protein || d.carbs || d.fat ? `${d.protein || '?'}/${d.carbs || '?'}/${d.fat || '?'}` : '–';
                return (
                  <tr key={d.log_date}>
                    <td style={{ color: 'var(--muted)', whiteSpace: 'nowrap' }}>{shortDate(d.log_date)}</td>
                    <td><strong>{d.weight ? `${d.weight}kg` : '–'}</strong></td>
                    <td style={{ color: calorieColor(d.total_cals, programme) }}>{d.total_cals || '–'}</td>
                    <td style={{ fontSize: 11, color: 'var(--muted)' }}>{macros}</td>
                    {columns.map((h) => <td key={h.id}><HabitCell habit={h} entry={dayEntries[i][h.id]} /></td>)}
                    <td>{d.mood ? MOOD_FACES[d.mood] : '–'}</td>
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
