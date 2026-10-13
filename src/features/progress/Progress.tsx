import { useMemo, useState, type ReactNode } from 'react';
import type { ChartConfiguration, ChartOptions } from 'chart.js';
import { ArrowUpRight } from 'lucide-react';
import type { DailyLog } from '../../db/dailyLogs.ts';
import { useHabits } from '../habits/HabitsContext.tsx';
import { activeHabits, goalOf, habitsWithHistory, parseEntries, toneOf, type Tone } from '../habits/model.ts';
import { habitStreakDays, streakLabel } from '../habits/streaks.ts';
import { useProgramme } from '../profile/ProfileContext.tsx';
import { shortDate } from '../../util/dates.ts';
import { moodWord } from '../today/mood.ts';
import { ChartCanvas } from './ChartCanvas.tsx';
import { DeepDive } from './DeepDive.tsx';
import { calorieRows, habitRows, moodRows, weightRows, type HistoryRow } from './history.ts';
import { useAllLogs } from './useAllLogs.ts';

// chart colours come from the theme: ink lines on paper, red for limits, green and ochre for the bands
const INK = '#1f1300';
const RED = '#a31621';
const GRID = 'rgba(31,19,0,.07)';
const MONO = '"JetBrains Mono Variable", ui-monospace, monospace';
const TICK = { color: '#5a5446', font: { size: 10, family: MONO, weight: 560 } };

function baseOptions(): ChartOptions {
  return {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { display: false },
      tooltip: {
        backgroundColor: INK, titleColor: '#e5ece9', bodyColor: '#e5ece9', titleFont: { family: MONO, size: 11 },
        bodyFont: { family: MONO, size: 12 }, padding: 10, cornerRadius: 8, displayColors: false,
      },
    },
    scales: {
      x: { grid: { display: false }, border: { color: 'rgba(31,19,0,.22)' }, ticks: { ...TICK, maxRotation: 0, autoSkipPadding: 12 } },
      y: { grid: { color: GRID }, border: { display: false }, ticks: TICK },
    },
  };
}

const TONE_FILL: Record<Tone, string> = {
  good: 'rgba(18,105,95,.8)', ok: 'rgba(138,90,20,.7)', bad: 'rgba(163,22,33,.8)', none: 'rgba(163,152,143,.7)',
};

const bandColor = (value: number, over: number, near: number) =>
  value > over ? 'rgba(163,22,33,.8)' : value >= near ? 'rgba(138,90,20,.7)' : 'rgba(18,105,95,.8)';

/** The title row of a chart card, with the button that opens that chart's whole history. */
function ChartTitle({ dot, children, onDive }: { dot: string; children: ReactNode; onDive: () => void }) {
  return (
    <div className="ct flex items-center justify-between gap-3">
      <span className="flex min-w-0 items-center gap-2.5"><span className={`dot ${dot}`} />{children}</span>
      <button type="button" onClick={onDive} className="inline-flex shrink-0 items-center gap-1 font-sans text-xs font-medium tracking-normal text-ink-2 normal-case underline decoration-primary underline-offset-3 hover:text-ink">
        Dive deeper <ArrowUpRight className="size-3.5" aria-hidden="true" />
      </button>
    </div>
  );
}

/** logs: newest first. Charts read oldest to newest, over the latest 30 entries. today feeds the streaks. */
export function Progress({ logs, today }: { logs: readonly DailyLog[]; today: string }) {
  const programme = useProgramme();
  const habits = useHabits();
  const all = useAllLogs();
  const [dive, setDive] = useState<{ title: string; rows: () => HistoryRow[] } | null>(null);
  const configs = useMemo(() => {
    const recent = logs.slice(0, 30).reverse();
    const labels = recent.map((d) => shortDate(d.log_date));
    const base = baseOptions();
    const scales = base.scales as NonNullable<ChartOptions['scales']>;

    const weight: ChartConfiguration = {
      type: 'line',
      data: {
        labels,
        datasets: [
          { data: recent.map((d) => d.weight), borderColor: INK, backgroundColor: 'rgba(31,19,0,.05)', borderWidth: 1.5, pointRadius: 2.5, pointBackgroundColor: INK, pointHoverRadius: 4, fill: true, tension: 0.3, spanGaps: true },
          ...(programme
            ? [{ data: recent.map(() => programme.goalWeightKg), borderColor: RED, borderWidth: 1, borderDash: [3, 4], pointRadius: 0, fill: false }]
            : []),
        ],
      },
      options: programme
        ? {
            ...base,
            scales: {
              ...scales,
              y: { ...scales.y, min: Math.min(programme.startWeightKg, programme.goalWeightKg) - 2, max: Math.max(programme.startWeightKg, programme.goalWeightKg) + 1 },
            },
          }
        : base,
    };

    const cals = recent.map((d) => d.total_cals);
    const calories: ChartConfiguration = {
      type: 'bar',
      data: {
        labels,
        datasets: [
          {
            type: 'bar',
            data: cals,
            backgroundColor: cals.map((c) => {
              if (c == null) return 'transparent';
              return programme?.calorieOver != null && programme.calorieNear != null
                ? bandColor(c, programme.calorieOver, programme.calorieNear)
                : 'rgba(31,19,0,.75)';
            }),
            borderRadius: 3,
            maxBarThickness: 18,
          },
          ...(programme?.calorieTarget != null
            ? [{ type: 'line' as const, data: recent.map(() => programme.calorieTarget as number), borderColor: RED, borderWidth: 1, borderDash: [3, 4], pointRadius: 0, fill: false }]
            : []),
        ],
      },
      options: base,
    };

    // one bar chart for every counted or measured habit, coloured by how each day measured up to its goal
    const recentEntries = recent.map((d) => parseEntries(d.habits));
    const habitCharts = habitsWithHistory(habits.habits, recentEntries)
      .filter((h) => h.kind === 'count' || h.kind === 'amount')
      .map((habit) => {
        const values = recentEntries.map((e) => (typeof e[habit.id]?.value === 'number' ? (e[habit.id].value as number) : null));
        const goal = goalOf(habit);
        const ticks = habit.kind === 'count' ? { ...TICK, stepSize: 1 } : TICK;
        const config: ChartConfiguration = {
          type: 'bar',
          data: {
            labels,
            datasets: [
              { type: 'bar', data: values, backgroundColor: recentEntries.map((e) => TONE_FILL[toneOf(habit, e[habit.id])]), borderRadius: 3, maxBarThickness: 18 },
              ...(goal !== null
                ? [{ type: 'line' as const, data: recent.map(() => goal), borderColor: RED, borderWidth: 1, borderDash: [3, 4], pointRadius: 0, fill: false }]
                : []),
            ],
          },
          options: { ...base, scales: { ...scales, y: { ...scales.y, min: 0, ticks } } },
        };
        return { habit, config };
      });

    const mood: ChartConfiguration = {
      type: 'line',
      data: {
        labels,
        datasets: [{ data: recent.map((d) => d.mood), borderColor: RED, backgroundColor: 'rgba(163,22,33,.06)', borderWidth: 1.5, pointRadius: 2.5, pointBackgroundColor: RED, fill: true, tension: 0.3, spanGaps: true }],
      },
      options: {
        ...base,
        scales: {
          ...scales,
          y: { ...scales.y, min: 1, max: 5, ticks: { ...TICK, stepSize: 1, callback: (v) => moodWord(Number(v)) || String(v) } },
        },
      },
    };
    return { weight, calories, mood, habitCharts };
  }, [logs, programme, habits.habits]);

  const streaks = useMemo(
    () => activeHabits(habits.habits).map((habit) => ({ habit, days: habitStreakDays(habit, all.logs, today), label: streakLabel(habit) })),
    [habits.habits, all.logs, today],
  );
  const diveRows = useMemo(() => (dive ? dive.rows() : []), [dive]);

  return (
    <div>
      <div className="g g2 sec">
        <div className="card">
          <ChartTitle dot="dot-blue" onDive={() => setDive({ title: 'Weight', rows: () => weightRows(all.logs) })}>{programme ? `Weight, ${programme.startWeightKg} to ${programme.goalWeightKg} kg` : 'Weight'}</ChartTitle>
          <ChartCanvas config={configs.weight} label="Weight over the latest entries" />
        </div>
        <div className="card">
          <ChartTitle dot="dot-green" onDive={() => setDive({ title: 'Calories per day', rows: () => calorieRows(all.logs, programme?.calorieTarget ?? null) })}>Calories per day</ChartTitle>
          <ChartCanvas config={configs.calories} label="Calories per day" />
        </div>
      </div>
      <div className="g g2 sec">
        <div className="card">
          <ChartTitle dot="dot-red" onDive={() => setDive({ title: 'Mood', rows: () => moodRows(all.logs) })}>Mood</ChartTitle>
          <ChartCanvas config={configs.mood} label="Mood over the latest entries" />
        </div>
        {configs.habitCharts.map(({ habit, config }) => (
          <div className="card" key={habit.id}>
            <ChartTitle dot="dot-dim" onDive={() => setDive({ title: habit.name, rows: () => habitRows(habit, all.logs) })}>{habit.name} per day{habit.unit ? ` (${habit.unit})` : ''}</ChartTitle>
            <ChartCanvas config={config} label={`${habit.name} per day`} />
          </div>
        ))}
      </div>
      {streaks.length > 0 && (
        <div className="card sec">
          <div className="ct"><span className="dot dot-green" />Habit streaks, in days</div>
          {all.error ? <div className="notice notice-warn" role="alert">Streaks could not be worked out: {all.error}</div> : null}
          <div className="streak-row">
            {streaks.map(({ habit, days, label }) => (
              <div className="streak-box" key={habit.id}>
                <div className="sv" style={{ color: days > 0 ? 'var(--ink)' : 'var(--dot)' }}>{all.loading ? '--' : days}</div>
                <div className="sl">{label.title}</div>
                {label.hint ? <div className="mt-0.5 text-[10px] text-ink-3">{label.hint}</div> : null}
              </div>
            ))}
          </div>
          <p className="mt-3 text-xs leading-relaxed text-ink-3">
            A streak counts days in a row on which a habit met its own goal. For a habit where less is better, such as cigarettes, that is every day at or under the goal. A day with no entry ends it. Today does not end a streak while it can still be met.
          </p>
        </div>
      )}
      {dive ? <DeepDive title={dive.title} rows={diveRows} loading={all.loading} error={all.error} onClose={() => setDive(null)} /> : null}
    </div>
  );
}
