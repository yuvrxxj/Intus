import { useMemo } from 'react';
import type { ChartConfiguration, ChartOptions } from 'chart.js';
import { PROGRAMME } from '../../config.ts';
import type { DailyLog } from '../../db/dailyLogs.ts';
import { streak } from '../today/stats.ts';
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

const bandColor = (value: number, over: number, near: number) =>
  value > over ? 'rgba(217,79,92,.7)' : value >= near ? 'rgba(232,184,74,.7)' : 'rgba(61,196,122,.7)';

/** logs: newest first. Charts read oldest to newest, over the latest 30 entries. */
export function Progress({ logs }: { logs: readonly DailyLog[] }) {
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
          { data: recent.map(() => PROGRAMME.goalWeightKg), borderColor: 'rgba(217,79,92,.4)', borderWidth: 1, borderDash: [4, 4], pointRadius: 0, fill: false },
        ],
      },
      options: { ...base, scales: { ...scales, y: { ...scales.y, min: PROGRAMME.goalWeightKg - 2, max: PROGRAMME.startWeightKg + 1 } } },
    };

    const cals = recent.map((d) => d.total_cals);
    const calories: ChartConfiguration = {
      type: 'bar',
      data: {
        labels,
        datasets: [
          { type: 'bar', data: cals, backgroundColor: cals.map((c) => (c == null ? 'transparent' : bandColor(c, PROGRAMME.calorieOver, PROGRAMME.calorieNear))), borderRadius: 5 },
          { type: 'line', data: recent.map(() => PROGRAMME.calorieTarget), borderColor: 'rgba(74,143,232,.4)', borderWidth: 1, borderDash: [4, 4], pointRadius: 0, fill: false },
        ],
      },
      options: base,
    };

    const cigs = recent.map((d) => d.cigs ?? 0);
    const cigarettes: ChartConfiguration = {
      type: 'bar',
      data: {
        labels,
        datasets: [{ data: cigs, backgroundColor: cigs.map((c) => (c === 0 ? 'rgba(61,196,122,.7)' : c <= 3 ? 'rgba(232,184,74,.7)' : 'rgba(217,79,92,.7)')), borderRadius: 5 }],
      },
      options: { ...base, scales: { ...scales, y: { ...scales.y, min: 0, ticks: { ...TICK, stepSize: 1 } } } },
    };

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
    return { weight, calories, cigarettes, mood };
  }, [logs]);

  const lift = streak(logs, (l) => l.lift === 'yes');
  const cardio = streak(logs, (l) => l.cardio === 'yes' || l.cardio === 'bad');
  const core = streak(logs, (l) => l.core === 'yes');

  return (
    <div>
      <div className="g g2 sec">
        <div className="card"><div className="ct"><span className="dot dot-blue" />Weight ({PROGRAMME.startWeightKg}→{PROGRAMME.goalWeightKg}kg)</div>
          <ChartCanvas config={configs.weight} label="Weight over the latest entries" /></div>
        <div className="card"><div className="ct"><span className="dot dot-green" />Calories / Day</div>
          <ChartCanvas config={configs.calories} label="Calories per day" /></div>
      </div>
      <div className="g g2 sec">
        <div className="card"><div className="ct"><span className="dot dot-red" />Cigarettes / Day</div>
          <ChartCanvas config={configs.cigarettes} label="Cigarettes per day" /></div>
        <div className="card"><div className="ct"><span className="dot" style={{ background: 'linear-gradient(135deg,var(--blue),var(--red))' }} />Mood</div>
          <ChartCanvas config={configs.mood} label="Mood over the latest entries" /></div>
      </div>
      <div className="card sec">
        <div className="ct"><span className="dot dot-green" />Activity Streaks</div>
        <div className="streak-row">
          <div className="streak-box"><div className="sv" style={{ color: 'var(--blue)' }}>{lift}</div><div className="sl">Lift 🔥</div></div>
          <div className="streak-box"><div className="sv" style={{ color: 'var(--green)' }}>{cardio}</div><div className="sl">Cardio 💦</div></div>
          <div className="streak-box"><div className="sv" style={{ color: 'var(--yellow)' }}>{core}</div><div className="sl">Core ⚡</div></div>
        </div>
      </div>
    </div>
  );
}
