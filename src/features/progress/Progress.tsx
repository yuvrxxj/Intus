import { useMemo } from 'react';
import type { ChartConfiguration, ChartOptions } from 'chart.js';
import type { DailyLog } from '../../db/dailyLogs.ts';
import { useHabits } from '../habits/HabitsContext.tsx';
import { activeHabits, goalOf, habitStreak, habitsWithHistory, parseEntries, toneOf, type Tone } from '../habits/model.ts';
import { useProgramme } from '../profile/ProfileContext.tsx';
import { shortDate } from '../../util/dates.ts';
import { ChartCanvas } from './ChartCanvas.tsx';

const GRID = 'rgba(255,255,255,.04)';
const TICK = { color: '#585878', font: { size: 10 } };
const MOOD_FACES = ['', '😤', '😞', '😐', '🙂', '🔥'];

function baseOptions(): ChartOptions {
  return {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { display: false },
      tooltip: {
        backgroundColor: 'rgba(14,14,28,.95)', titleColor: '#e8e8f2', bodyColor: '#a0a0bc',
        borderColor: 'rgba(42,42,72,.8)', borderWidth: 1, padding: 10, cornerRadius: 8,
      },
    },
    scales: { x: { grid: { color: GRID }, ticks: TICK }, y: { grid: { color: GRID }, ticks: TICK } },
  };
}

const TONE_FILL: Record<Tone, string> = {
  good: 'rgba(61,196,122,.7)', ok: 'rgba(232,184,74,.7)', bad: 'rgba(217,79,92,.7)', none: 'rgba(88,88,120,.5)',
};
const STREAK_COLORS = ['var(--blue)', 'var(--green)', 'var(--yellow)', 'var(--red)'];

const bandColor = (value: number, over: number, near: number) =>
  value > over ? 'rgba(217,79,92,.7)' : value >= near ? 'rgba(232,184,74,.7)' : 'rgba(61,196,122,.7)';

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
          { data: recent.map((d) => d.weight), borderColor: '#4a8fe8', backgroundColor: 'rgba(74,143,232,.08)', borderWidth: 2, pointRadius: 3, pointBackgroundColor: '#4a8fe8', fill: true, tension: 0.35, spanGaps: true },
          ...(programme
            ? [{ data: recent.map(() => programme.goalWeightKg), borderColor: 'rgba(217,79,92,.4)', borderWidth: 1, borderDash: [4, 4], pointRadius: 0, fill: false }]
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
                : 'rgba(74,143,232,.7)';
            }),
            borderRadius: 5,
          },
          ...(programme?.calorieTarget != null
            ? [{ type: 'line' as const, data: recent.map(() => programme.calorieTarget as number), borderColor: 'rgba(74,143,232,.4)', borderWidth: 1, borderDash: [4, 4], pointRadius: 0, fill: false }]
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
              { type: 'bar', data: values, backgroundColor: recentEntries.map((e) => TONE_FILL[toneOf(habit, e[habit.id])]), borderRadius: 5 },
              ...(goal !== null
                ? [{ type: 'line' as const, data: recent.map(() => goal), borderColor: 'rgba(160,160,188,.45)', borderWidth: 1, borderDash: [4, 4], pointRadius: 0, fill: false }]
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
        datasets: [{ data: recent.map((d) => d.mood), borderColor: '#6b6ef5', backgroundColor: 'rgba(107,110,245,.08)', borderWidth: 2, pointRadius: 4, fill: true, tension: 0.35, spanGaps: true }],
      },
      options: {
        ...base,
        scales: {
          ...scales,
          y: { ...scales.y, min: 1, max: 5, ticks: { color: '#585878', stepSize: 1, font: { size: 13 }, callback: (v) => MOOD_FACES[Number(v)] ?? String(v) } },
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
        <div className="card"><div className="ct"><span className="dot dot-blue" />{programme ? `Weight (${programme.startWeightKg}→${programme.goalWeightKg}kg)` : 'Weight'}</div>
          <ChartCanvas config={configs.weight} label="Weight over the latest entries" /></div>
        <div className="card"><div className="ct"><span className="dot dot-green" />Calories / Day</div>
          <ChartCanvas config={configs.calories} label="Calories per day" /></div>
      </div>
      <div className="g g2 sec">
        <div className="card"><div className="ct"><span className="dot" style={{ background: 'linear-gradient(135deg,var(--blue),var(--red))' }} />Mood</div>
          <ChartCanvas config={configs.mood} label="Mood over the latest entries" /></div>
        {configs.habitCharts.map(({ habit, config }) => (
          <div className="card" key={habit.id}><div className="ct"><span className="dot dot-red" />{habit.name} / Day{habit.unit ? ` (${habit.unit})` : ''}</div>
            <ChartCanvas config={config} label={`${habit.name} per day`} /></div>
        ))}
      </div>
      {streaks.length > 0 && (
        <div className="card sec">
          <div className="ct"><span className="dot dot-green" />Habit Streaks</div>
          <div className="streak-row">
            {streaks.map(({ habit, days }, i) => (
              <div className="streak-box" key={habit.id}>
                <div className="sv" style={{ color: STREAK_COLORS[i % STREAK_COLORS.length] }}>{days}</div>
                <div className="sl">{habit.name}</div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
