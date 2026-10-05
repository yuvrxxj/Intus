import type { DailyLog } from '../../db/dailyLogs.ts';
import { PROGRAMME } from '../../config.ts';
import { shortDate } from '../../util/dates.ts';

const MOOD_FACES = ['', '😤', '😞', '😐', '🙂', '🔥'];
const CARDIO: Record<string, string> = { yes: '✓', no: '✗', bad: '🏸' };

function calorieColor(c: number | null): string {
  if (!c) return 'var(--muted)';
  return c > PROGRAMME.calorieOver ? 'var(--red)' : c >= PROGRAMME.calorieNear ? 'var(--yellow)' : 'var(--green)';
}

export function History({ logs, loading, error }: { logs: readonly DailyLog[]; loading: boolean; error: string | null }) {
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
              <tr><th>Date</th><th>Weight</th><th>Cals</th><th>P/C/F</th><th>Lift</th><th>Core</th><th>Cardio</th><th>Cigs</th><th>Mood</th></tr>
            </thead>
            <tbody>
              {logs.map((d) => {
                const macros = d.protein || d.carbs || d.fat ? `${d.protein || '?'}/${d.carbs || '?'}/${d.fat || '?'}` : '–';
                const cigs = d.cigs ?? 0;
                return (
                  <tr key={d.log_date}>
                    <td style={{ color: 'var(--muted)', whiteSpace: 'nowrap' }}>{shortDate(d.log_date)}</td>
                    <td><strong>{d.weight ? `${d.weight}kg` : '–'}</strong></td>
                    <td style={{ color: calorieColor(d.total_cals) }}>{d.total_cals || '–'}</td>
                    <td style={{ fontSize: 11, color: 'var(--muted)' }}>{macros}</td>
                    <td>{d.lift ? <span className={`pill ${d.lift === 'yes' ? 'pill-g' : 'pill-r'}`}>{d.lift === 'yes' ? '✓' : 'Rest'}</span> : '–'}</td>
                    <td>{d.core ? <span className={`pill ${d.core === 'yes' ? 'pill-g' : 'pill-r'}`}>{d.core === 'yes' ? '✓' : '✗'}</span> : '–'}</td>
                    <td>{d.cardio ? CARDIO[d.cardio] ?? '–' : '–'}</td>
                    <td style={{ color: cigs === 0 ? 'var(--green)' : cigs <= 3 ? 'var(--yellow)' : 'var(--red)' }}>{cigs}</td>
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
