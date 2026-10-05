import type { Point } from './model.ts';
import { formatDay, formatValue } from './format.ts';

interface Props {
  points: readonly Point[];
  refLow: number | null;
  refHigh: number | null;
  width?: number;
  height?: number;
}

const PAD_X = 10;
const PAD_Y = 8;

/** Results over time with the lab reference range as a band behind them. Time is to scale, so a long gap looks like one. */
export function Sparkline({ points, refLow, refHigh, width = 260, height = 64 }: Props) {
  const values = points.map((p) => p.value);
  const lows = [...values, ...(refLow !== null ? [refLow] : [])];
  const highs = [...values, ...(refHigh !== null ? [refHigh] : [])];
  let yMin = Math.min(...lows);
  let yMax = Math.max(...highs);
  if (yMin === yMax) {
    yMin -= 1;
    yMax += 1;
  }
  const dayMin = points[0].day;
  const dayMax = points[points.length - 1].day;
  const x = (day: number) => (dayMax === dayMin ? width / 2 : PAD_X + ((day - dayMin) / (dayMax - dayMin)) * (width - 2 * PAD_X));
  const y = (value: number) => height - PAD_Y - ((value - yMin) / (yMax - yMin)) * (height - 2 * PAD_Y);

  const label = points.map((p) => `${formatValue(p.value)} on ${formatDay(p.measured_at)}`).join(', ');
  const line = points.map((p) => `${x(p.day).toFixed(1)},${y(p.value).toFixed(1)}`).join(' ');

  return (
    <svg className="spark" viewBox={`0 0 ${width} ${height}`} width={width} height={height} role="img" aria-label={`Results over time: ${label}`}>
      {refLow !== null && refHigh !== null && (
        <rect className="spark-band" x={0} width={width} y={y(refHigh)} height={Math.max(1, y(refLow) - y(refHigh))} />
      )}
      {refLow !== null && refHigh === null && <line className="spark-limit" x1={0} x2={width} y1={y(refLow)} y2={y(refLow)} />}
      {refHigh !== null && refLow === null && <line className="spark-limit" x1={0} x2={width} y1={y(refHigh)} y2={y(refHigh)} />}
      {points.length > 1 && <polyline className="spark-line" points={line} fill="none" />}
      {points.map((p) => (
        <circle key={p.id} className="spark-dot" cx={x(p.day)} cy={y(p.value)} r={3.5}>
          <title>{`${formatValue(p.value)} on ${formatDay(p.measured_at)}`}</title>
        </circle>
      ))}
    </svg>
  );
}
