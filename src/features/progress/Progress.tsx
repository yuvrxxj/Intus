import { useMemo } from 'react';
import type { ChartConfiguration, ChartOptions } from 'chart.js';
import type { DailyLog } from '../../db/dailyLogs.ts';
import { useHabits } from '../habits/HabitsContext.tsx';
import { activeHabits, goalOf, habitStreak, habitsWithHistory, parseEntries, toneOf, type Tone } from '../habits/model.ts';
import { useProgramme } from '../profile/ProfileContext.tsx';
import { shortDate } from '../../util/dates.ts';
import { moodWord } from '../today/mood.ts';
import { ChartCanvas } from './ChartCanvas.tsx';

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

/** logs: newest first. Charts read oldest to newest, over the latest 30 entries. */
export function Progress({ logs }: { logs: readonly DailyLog[] }) {
  const programme = useProgramme();
  const habits = useHabits();
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

  const entriesNewestFirst = useMemo(() => logs.map((l) => parseEntries(l.habits)), [logs]);
  const streaks = activeHabits(habits.habits).map((habit) => ({ habit, days: habitStreak(habit, entriesNewestFirst) }));

  return (
    <div>
      <div className="g g2 sec">
        <div className="card"><div className="ct"><span className="dot dot-blue" />{programme ? `Weight, ${programme.startWeightKg} to ${programme.goalWeightKg} kg` : 'Weight'}</div>
          <ChartCanvas config={configs.weight} label="Weight over the latest entries" /></div>
        <div className="card"><div className="ct"><span className="dot dot-green" />Calories per day</div>
          <ChartCanvas config={configs.calories} label="Calories per day" /></div>
      </div>
      <div className="g g2 sec">
        <div className="card"><div className="ct"><span className="dot dot-red" />Mood</div>
          <ChartCanvas config={configs.mood} label="Mood over the latest entries" /></div>
        {configs.habitCharts.map(({ habit, config }) => (
          <div className="card" key={habit.id}><div className="ct"><span className="dot dot-dim" />{habit.name} per day{habit.unit ? ` (${habit.unit})` : ''}</div>
            <ChartCanvas config={config} label={`${habit.name} per day`} /></div>
        ))}
      </div>
      {streaks.length > 0 && (
        <div className="card sec">
          <div className="ct"><span className="dot dot-green" />Habit streaks, in days</div>
          <div className="streak-row">
            {streaks.map(({ habit, days }) => (
              <div className="streak-box" key={habit.id}>
                <div className="sv" style={{ color: days > 0 ? 'var(--ink)' : 'var(--dot)' }}>{days}</div>
                <div className="sl">{habit.name}</div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
