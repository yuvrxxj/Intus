import type { CSSProperties } from 'react';
import type { Direction } from '../../lib/programme.ts';
import { shortDate } from '../../util/dates.ts';
import { useHabits } from '../habits/HabitsContext.tsx';
import { summarize, withUntouchedCounts } from '../habits/model.ts';
import { useProgramme } from '../profile/ProfileContext.tsx';
import type { TodayDraft } from './useToday.ts';
import { daysToGoal, type WeightStats } from './stats.ts';

const PROGRESS_TITLE: Record<Direction, string> = { lose: 'Cut Progress', gain: 'Gain Progress', maintain: 'Weight Goal' };

/** Four stat cards and the cut progress ring that sit above the tabs. Calories and cigarettes follow today's form live. */
export function Overview({ stats, draft, today }: { stats: WeightStats; draft: TodayDraft; today: string }) {
  const programme = useProgramme();
  const cals = parseInt(draft.calories, 10) || 0;
  const target = programme?.calorieTarget ?? null;
  const remaining = target === null ? null : target - cals;
  const habits = useHabits();
  const habitsToday = summarize(habits.habits, withUntouchedCounts(habits.habits, draft.habits));
  const pct = stats.percentDone;
  const days = programme ? daysToGoal(programme, today) : null;
  const fromStart = stats.fromStartKg;

  return (
    <>
      <div className="g g4 sec anim-3">
        <div className="card stat stat-glow-blue">
          <div className="ct"><span className="dot dot-blue" />Weight</div>
          <div className="val">{stats.latest ? stats.latest.weight.toFixed(1) : '–'}</div>
          <div className="unit">kg latest</div>
          {fromStart !== null && (
            <div className={`delta ${fromStart < 0 ? 'pos' : fromStart > 0 ? 'neg' : 'neu'}`}>
              {fromStart > 0 ? '+' : ''}{fromStart.toFixed(1)}kg from start
            </div>
          )}
        </div>
        <div className="card stat stat-glow-blue">
          <div className="ct"><span className="dot dot-dim" />Recent Avg</div>
          <div className="val">{stats.recentAverage ? stats.recentAverage.kg.toFixed(1) : '–'}</div>
          <div className="unit">kg, last weigh-ins</div>
          {stats.recentAverage && (
            <div className="delta neu">{stats.recentAverage.count} weigh-in{stats.recentAverage.count === 1 ? '' : 's'}</div>
          )}
        </div>
        <div className="card stat stat-glow-green">
          <div className="ct"><span className="dot dot-green" />Calories</div>
          <div className="val">{cals}</div>
          <div className="unit">{target === null ? 'kcal today' : `of ${target.toLocaleString('en-US')} kcal`}</div>
          {cals > 0 && remaining !== null && (
            <div className={`delta ${remaining >= 0 ? 'pos' : 'neg'}`}>
              {remaining >= 0 ? `↓ ${remaining} under` : `↑ ${Math.abs(remaining)} over`}
            </div>
          )}
        </div>
        <div className="card stat stat-glow-red">
          <div className="ct"><span className="dot dot-red" />Habits</div>
          <div className="val">{habits.status !== 'ready' || habitsToday.total === 0 ? '–' : `${habitsToday.onTrack}/${habitsToday.total}`}</div>
          <div className="unit">{habits.status === 'loading' ? 'loading' : habits.status === 'error' ? 'could not load' : 'on track today'}</div>
          {habits.status === 'ready' && (habitsToday.total === 0
            ? <div className="delta neu"><a href="#goals" style={{ color: 'var(--blue)' }}>Choose habits</a></div>
            : <div className={`delta ${habitsToday.onTrack === habitsToday.total ? 'pos' : 'neu'}`}>
                {habitsToday.onTrack === habitsToday.total ? '✓ all on track' : `${habitsToday.total - habitsToday.onTrack} to go`}
              </div>)}
        </div>
      </div>

      {programme ? (
        <div className="card sec anim-4">
          <div className="ct"><span className="dot dot-blue" />{PROGRESS_TITLE[programme.direction]}</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap' }}>
            <div className="score-ring">
              <div className="ring-wrap">
                <svg viewBox="0 0 72 72" width="72" height="72" aria-hidden="true">
                  <circle className="ring-bg" cx="36" cy="36" r="30" />
                  <circle className="ring-fg" cx="36" cy="36" r="30" style={{ '--pct': pct ?? 0 } as CSSProperties} />
                </svg>
                <div className="ring-num">{pct === null ? '0%' : `${Math.round(pct)}%`}</div>
              </div>
              <div>
                <div style={{ fontSize: 13, fontWeight: 600 }}>
                  {stats.progressKg === null
                    ? (programme.direction === 'maintain' ? 'Keeping steady' : '–')
                    : `${stats.progressKg.toFixed(1)}kg ${programme.direction === 'gain' ? 'gained' : 'lost'}`}
                </div>
                <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 2 }}>
                  {stats.toGoKg === null ? '–' : `${stats.toGoKg.toFixed(1)}kg ${programme.direction === 'maintain' ? 'from goal' : 'to go'}`}
                </div>
                <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 2 }}>{days === null ? 'Deadline reached' : `~${days} days left`}</div>
              </div>
            </div>
            <div style={{ flex: 1, minWidth: 160 }}>
              <div className="pbar-labels" style={{ marginBottom: 4 }}><span>{programme.startWeightKg}kg</span><span>{programme.goalWeightKg}kg</span></div>
              <div className="pbar"><div className="pfill" style={{ width: `${pct ?? 0}%` }} /></div>
              <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 6 }}>
                Started {shortDate(programme.startDate)} · Target {shortDate(programme.goalDate)}, {programme.goalDate.slice(0, 4)}
              </div>
            </div>
          </div>
        </div>
      ) : (
        <div className="card sec anim-4">
          <div className="ct"><span className="dot dot-blue" />Your goal</div>
          <div style={{ fontSize: 13, color: 'var(--txt2)', marginBottom: 12 }}>
            You have not set a goal yet. Choose a starting weight, a goal weight and a date to see your progress here.
          </div>
          <a className="btn btn-primary" href="#goals" style={{ display: 'inline-block', textDecoration: 'none' }}>Set your goal</a>
        </div>
      )}
    </>
  );
}
