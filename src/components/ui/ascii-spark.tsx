import { cn } from '@/lib/utils';

const BARS = '▁▂▃▄▅▆▇█';

/** A sparkline drawn as a row of block characters, lowest value to highest. Values read oldest to newest; the newest is red. */
export function AsciiSpark({ values, className, label }: { values: readonly number[]; className?: string; label: string }) {
  if (values.length < 2) return null;
  const lo = Math.min(...values);
  const hi = Math.max(...values);
  const span = hi - lo || 1;
  const line = values.map((v) => BARS[Math.round(((v - lo) / span) * (BARS.length - 1))]).join('');
  return (
    <span role="img" aria-label={label} className={cn('font-mono leading-none tracking-[0.12em] whitespace-pre', className)}>
      <span className="text-ink-3">{line.slice(0, -1)}</span>
      <span className="text-primary">{line.slice(-1)}</span>
    </span>
  );
}
