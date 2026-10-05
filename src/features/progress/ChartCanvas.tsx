import { useEffect, useRef } from 'react';
import {
  BarController, BarElement, CategoryScale, Chart, Filler, LineController, LineElement, LinearScale, PointElement,
  Tooltip, type ChartConfiguration,
} from 'chart.js';

Chart.register(BarController, BarElement, LineController, LineElement, PointElement, CategoryScale, LinearScale, Filler, Tooltip);

/** Owns one Chart.js instance: built from the config, rebuilt when the config changes, destroyed on unmount. */
export function ChartCanvas({ config, label }: { config: ChartConfiguration; label: string }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const chart = new Chart(canvas, config);
    return () => chart.destroy();
  }, [config]);
  return (
    <div className="chart-wrap">
      <canvas ref={ref} role="img" aria-label={label} />
    </div>
  );
}
