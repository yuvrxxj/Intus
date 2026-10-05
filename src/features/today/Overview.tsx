import type { CSSProperties } from 'react';
import { PROGRAMME } from '../../config.ts';
import { shortDate } from '../../util/dates.ts';
import type { TodayDraft } from './useToday.ts';
import { daysToGoal, type WeightStats } from './stats.ts';

/** Four stat cards and the cut progress ring that sit above the tabs. Calories and cigarettes follow today's form live. */
export function Overview({ stats, draft, today }: { stats: WeightStats; draft: TodayDraft; today: string }) {
  const cals = parseInt(draft.calories, 10) || 0;
  const remaining = PROGRAMME.calorieTarget - cals;
  const cigs = draft.cigs;
  const pct = stats.percentDone;
  const days = daysToGoal(today);
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
          <div className="unit">of {PROGRAMME.calorieTarget.toLocaleString('en-US')} kcal</div>
          {cals > 0 && (
            <div className={`delta ${remaining >= 0 ? 'pos' : 'neg'}`}>
              {remaining >= 0 ? `↓ ${remaining} under` : `↑ ${Math.abs(remaining)} over`}
            </div>
          )}
        </div>
        <div className="card stat stat-glow-red">
          <div className="ct"><span className="dot dot-red" />Cigarettes</div>
          <div className="val">{cigs}</div>
          <div className="unit">today</div>
          <div className={`delta ${cigs === 0 ? 'pos' : cigs <= 3 ? 'neu' : 'neg'}`}>
            {cigs === 0 ? '🚭 smoke-free' : cigs <= 3 ? `${cigs} today` : `${cigs} · cut back`}
          </div>
        </div>
      </div>

      <div className="card sec anim-4">
        <div className="ct"><span className="dot dot-blue" />Cut Progress</div>
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
              <div style={{ fontSize: 13, fontWeight: 600 }}>{stats.lostKg === null ? '–' : `${stats.lostKg.toFixed(1)}kg lost`}</div>
              <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 2 }}>{stats.toGoKg === null ? '–' : `${stats.toGoKg.toFixed(1)}kg to go`}</div>
              <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 2 }}>{days === null ? 'Deadline reached' : `~${days} days left`}</div>
            </div>
          </div>
          <div style={{ flex: 1, minWidth: 160 }}>
            <div className="pbar-labels" style={{ marginBottom: 4 }}><span>{PROGRAMME.startWeightKg}kg</span><span>{PROGRAMME.goalWeightKg}kg</span></div>
            <div className="pbar"><div className="pfill" style={{ width: `${pct ?? 0}%` }} /></div>
            <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 6 }}>
              Started {shortDate(PROGRAMME.startDate)} · Target {shortDate(PROGRAMME.goalDate)}, {PROGRAMME.goalDate.slice(0, 4)}
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
