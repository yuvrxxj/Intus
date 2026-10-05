import type { ReactNode } from 'react';
import { useScreenSize } from '@/components/hooks/use-screen-size';
import { AsciiBar } from '@/components/ui/ascii-bar';
import { Reveal } from '@/components/ui/reveal';
import { Ticker } from '@/components/ui/ticker';
import { cn } from '@/lib/utils';
import type { Direction } from '../../lib/programme.ts';
import { shortDate } from '../../util/dates.ts';
import { useHabits } from '../habits/HabitsContext.tsx';
import { summarize, withUntouchedCounts } from '../habits/model.ts';
import { useProgramme } from '../profile/ProfileContext.tsx';
import type { TodayDraft } from './useToday.ts';
import { daysToGoal, type WeightStats } from './stats.ts';

const PROGRESS_TITLE: Record<Direction, string> = { lose: 'Cut progress', gain: 'Gain progress', maintain: 'Weight goal' };

function Tile({ label, value, unit, note, tone = 'neutral' }: {
  label: string;
  value: ReactNode;
  unit: string;
  note?: ReactNode;
  tone?: 'good' | 'bad' | 'neutral';
}) {
  return (
    <div className="card flex min-h-[148px] flex-col justify-between p-5">
      <div className="font-mono text-[11px] tracking-[0.08em] text-ink-3 uppercase">{label}</div>
      <div>
        <div className="font-mono text-[34px] leading-none font-medium tracking-[-0.03em] text-ink">{value}</div>
        <div className="mt-1.5 text-xs text-ink-3">{unit}</div>
      </div>
      {note ? (
        <div className={cn('mt-3 text-xs', tone === 'good' ? 'text-success' : tone === 'bad' ? 'text-primary' : 'text-ink-2')}>{note}</div>
      ) : <div className="mt-3 h-4" />}
    </div>
  );
}

/** Four stat tiles and the goal bar at the top of the page. Calories and habits follow today's form live. */
export function Overview({ stats, draft, today, onJump }: {
  stats: WeightStats;
  draft: TodayDraft;
  today: string;
  onJump: (id: 'goals') => void;
}) {
  const programme = useProgramme();
  const screen = useScreenSize();
  const cals = parseInt(draft.calories, 10) || 0;
  const target = programme?.calorieTarget ?? null;
  const remaining = target === null ? null : target - cals;
  const habits = useHabits();
  const habitsToday = summarize(habits.habits, withUntouchedCounts(habits.habits, draft.habits));
  const pct = stats.percentDone;
  const days = programme ? daysToGoal(programme, today) : null;
  const fromStart = stats.fromStartKg;
  const goalLink = (text: string) => (
    <a href="#goals" onClick={(e) => { e.preventDefault(); onJump('goals'); }} className="underline decoration-primary underline-offset-3">{text}</a>
  );

  return (
    <div className="grid gap-4">
      <Reveal className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        <Tile
          label="Weight"
          value={stats.latest ? <Ticker value={stats.latest.weight} decimals={1} /> : '--'}
          unit={stats.latest ? `kg, ${shortDate(stats.latest.date)}` : 'kg, no weigh-in yet'}
          note={fromStart !== null ? `${fromStart > 0 ? '+' : ''}${fromStart.toFixed(1)} kg from start` : undefined}
        />
        <Tile
          label="Recent average"
          value={stats.recentAverage ? <Ticker value={stats.recentAverage.kg} decimals={1} /> : '--'}
          unit="kg, latest weigh-ins"
          note={stats.recentAverage ? `${stats.recentAverage.count} weigh-in${stats.recentAverage.count === 1 ? '' : 's'}` : undefined}
        />
        <Tile
          label="Calories"
          value={<Ticker value={cals} format={(n) => Math.round(n).toLocaleString('en-US')} />}
          unit={target === null ? 'kcal today' : `of ${target.toLocaleString('en-US')} kcal`}
          tone={remaining !== null && remaining < 0 ? 'bad' : 'neutral'}
          note={cals > 0 && remaining !== null ? (remaining >= 0 ? `${remaining.toLocaleString('en-US')} left` : `${Math.abs(remaining).toLocaleString('en-US')} over`) : undefined}
        />
        <Tile
          label="Habits"
          value={habits.status !== 'ready' || habitsToday.total === 0 ? '--' : `${habitsToday.onTrack}/${habitsToday.total}`}
          unit={habits.status === 'loading' ? 'loading' : habits.status === 'error' ? 'could not load' : 'on track today'}
          tone={habitsToday.total > 0 && habitsToday.onTrack === habitsToday.total ? 'good' : 'neutral'}
          note={habits.status === 'ready'
            ? (habitsToday.total === 0 ? goalLink('Choose habits') : habitsToday.onTrack === habitsToday.total ? 'All on track' : `${habitsToday.total - habitsToday.onTrack} to go`)
            : undefined}
        />
      </Reveal>

      <Reveal delay={0.06}>
        {programme ? (
          <div className="card p-5 sm:p-6">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <div className="font-mono text-[11px] tracking-[0.08em] text-ink-3 uppercase">{PROGRESS_TITLE[programme.direction]}</div>
              <div className="font-mono text-[11px] text-ink-3 tabular-nums">
                {shortDate(programme.startDate)} to {shortDate(programme.goalDate)} {programme.goalDate.slice(0, 4)}
              </div>
            </div>
            <div className="mt-5 grid items-end gap-5 md:grid-cols-[1fr_auto]">
              <div className="min-w-0">
                <div className="flex items-baseline gap-3">
                  <span className="font-mono text-[34px] leading-none font-medium tracking-[-0.03em]">{pct === null ? '--' : <Ticker value={pct} format={(n) => `${Math.round(n)}%`} />}</span>
                  <span className="text-sm text-ink-2">
                    {stats.progressKg === null
                      ? (programme.direction === 'maintain' ? 'Keeping steady' : 'Log a weigh-in to start')
                      : `${stats.progressKg.toFixed(1)} kg ${programme.direction === 'gain' ? 'gained' : 'lost'}`}
                  </span>
                </div>
                <AsciiBar
                  percent={pct ?? 0}
                  width={screen.lessThan('sm') ? 26 : screen.lessThan('xl') ? 36 : 44}
                  className="mt-4 overflow-hidden text-[13px] sm:text-[15px]"
                  label={`${Math.round(pct ?? 0)} percent of the way from ${programme.startWeightKg} to ${programme.goalWeightKg} kg`}
                />
                <div className="mt-2 flex justify-between font-mono text-[11px] text-ink-3 tabular-nums">
                  <span>{programme.startWeightKg} kg</span><span>{programme.goalWeightKg} kg</span>
                </div>
              </div>
              <dl className="grid grid-cols-2 gap-6 border-line md:border-l md:pl-6">
                <div>
                  <dt className="font-mono text-[10px] tracking-[0.08em] text-ink-3 uppercase">{programme.direction === 'maintain' ? 'From goal' : 'To go'}</dt>
                  <dd className="mt-1 font-mono text-lg tabular-nums">{stats.toGoKg === null ? '--' : `${stats.toGoKg.toFixed(1)} kg`}</dd>
                </div>
                <div>
                  <dt className="font-mono text-[10px] tracking-[0.08em] text-ink-3 uppercase">Days left</dt>
                  <dd className="mt-1 font-mono text-lg tabular-nums">{days === null ? 'Done' : days}</dd>
                </div>
              </dl>
            </div>
          </div>
        ) : (
          <div className="card flex flex-wrap items-center justify-between gap-4 p-5 sm:p-6">
            <div>
              <div className="font-mono text-[11px] tracking-[0.08em] text-ink-3 uppercase">Your goal</div>
              <p className="mt-2 max-w-lg text-sm text-ink-2">
                No goal yet. Pick a starting weight, a goal weight and a date to see your progress here.
              </p>
            </div>
            <a href="#goals" onClick={(e) => { e.preventDefault(); onJump('goals'); }} className="btn btn-primary">Set your goal</a>
          </div>
        )}
      </Reveal>
    </div>
  );
}
