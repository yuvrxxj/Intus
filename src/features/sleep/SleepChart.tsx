import type { AgeBand } from './ageBand.ts';
import { dayLabel, shortDay } from './format.ts';
import type { Night } from './nights.ts';
import { formatDuration } from './time.ts';

const STEP = 13;
const LEFT = 38;
const RIGHT = 6;
const TOP = 10;
const BOTTOM = 26;
const HEIGHT = 190;

/**
 * One bar per night, from zero, so the length of a bar is the time. The recommended range for the person's age is
 * a light band behind it, with the "may be appropriate" hours lighter still. A night with no record is a gap, never
 * a short bar. Every bar is the same colour whether it is inside the band or not: nothing here says good or bad. A
 * lighter bar means the number is the time from bed to getting up, because no time awake was entered.
 */
export function SleepChart({ strip, band }: { strip: { key: string; night: Night | null }[]; band: AgeBand | null }) {
  const n = strip.length;
  const width = LEFT + n * STEP + RIGHT;
  const maxHours = Math.max(0, ...strip.map((d) => (d.night ? d.night.main.metrics.tstMin / 60 : 0)));
  const yMax = Math.max(12, Math.ceil(maxHours) + 1, band ? band.notAbove + 1 : 0);
  const y = (hours: number) => TOP + (HEIGHT - TOP - BOTTOM) * (1 - hours / yMax);
  const base = y(0);

  const ticks = Array.from({ length: Math.floor(yMax / 2) + 1 }, (_, i) => i * 2);
  const recorded = strip.filter((d) => d.night).length;
  const summary = strip.flatMap((d) => (d.night ? [`${dayLabel(d.key)} ${formatDuration(d.night.main.metrics.tstMin)}`] : [])).join(', ');

  return (
    <figure className="m-0 max-w-[560px]">
      <svg viewBox={`0 0 ${width} ${HEIGHT}`} className="h-auto w-full" role="img"
        aria-label={`Time asleep each night over the last ${n} days. ${recorded} nights recorded. ${summary}`}>
        {band && (
          <>
            <rect className="fill-ink/[0.04]" x={LEFT} y={y(band.notAbove)} width={n * STEP} height={y(band.recHigh) - y(band.notAbove)} />
            <rect className="fill-ink/[0.04]" x={LEFT} y={y(band.recLow)} width={n * STEP} height={y(band.notBelow) - y(band.recLow)} />
            <rect className="fill-ink/[0.09]" x={LEFT} y={y(band.recHigh)} width={n * STEP} height={y(band.recLow) - y(band.recHigh)} />
          </>
        )}
        {ticks.map((h) => (
          <g key={h}>
            <line className="stroke-line" x1={LEFT} x2={LEFT + n * STEP} y1={y(h)} y2={y(h)} strokeWidth={h === 0 ? 1.2 : 0.6} />
            <text className="fill-ink-3 font-mono text-[11px]" x={LEFT - 6} y={y(h) + 3} textAnchor="end">{h} h</text>
          </g>
        ))}
        {strip.map((d, i) => {
          const x = LEFT + i * STEP + STEP * 0.19;
          const w = STEP * 0.62;
          if (!d.night) {
            return (
              <g key={d.key}>
                <title>{`${dayLabel(d.key)}: no record`}</title>
                <line className="stroke-line-strong" x1={x + w * 0.25} x2={x + w * 0.75} y1={base - 1.5} y2={base - 1.5} strokeWidth={1.5} strokeLinecap="round" />
              </g>
            );
          }
          const m = d.night.main.metrics;
          const top = y(m.tstMin / 60);
          return (
            <g key={d.key}>
              <title>{`${dayLabel(d.key)}: ${formatDuration(m.tstMin)} ${m.basis === 'bed_to_wake' ? 'from getting into bed to getting up' : 'asleep'}`}</title>
              <rect className={m.basis === 'bed_to_wake' ? 'fill-ink-3' : 'fill-ink'} x={x} y={top} width={w} height={Math.max(1, base - top)} rx={1.5} />
            </g>
          );
        })}
        {strip.map((d, i) => (i % 7 === 0 || i === n - 1) && (
          <text key={d.key} className="fill-ink-3 font-mono text-[11px]" x={LEFT + i * STEP + STEP / 2} y={HEIGHT - 8} textAnchor={i === 0 ? 'start' : i === n - 1 ? 'end' : 'middle'}>
            {shortDay(d.key)}
          </text>
        ))}
      </svg>
      <figcaption className="mt-2 text-xs leading-relaxed text-ink-3">
        {band ? <>Shaded: {band.recLow} to {band.recHigh} hours, the range recommended for {band.label.toLowerCase()}; paler shading is the hours that "may be appropriate for some people". </> : null}
        A short tick is a night with no record. A paler bar is time from getting into bed to getting up, with no time awake entered.
      </figcaption>
      <details className="mt-2 text-xs text-ink-2">
        <summary className="cursor-pointer text-ink-3 hover:text-ink">Show the numbers as a table</summary>
        <table className="mt-2 w-full max-w-md border-collapse text-left">
          <thead><tr><th className="py-1 pr-4 font-medium">Night ending</th><th className="py-1 font-medium">Time</th></tr></thead>
          <tbody>
            {strip.map((d) => (
              <tr key={d.key} className="border-t border-line">
                <td className="py-1 pr-4">{dayLabel(d.key)}</td>
                <td className="py-1">{d.night ? `${formatDuration(d.night.main.metrics.tstMin)}${d.night.main.metrics.basis === 'bed_to_wake' ? ' (bed to wake)' : ''}` : 'No record'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </details>
    </figure>
  );
}
