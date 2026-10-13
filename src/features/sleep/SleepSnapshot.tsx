import { useMemo } from 'react';
import { ArrowRight } from 'lucide-react';
import { Reveal } from '@/components/ui/reveal';
import { nightHeading } from './format.ts';
import { summarize } from './summary.ts';
import { formatClock, formatDuration, roundTo5 } from './time.ts';
import { useSleep } from './useSleep.ts';

const WINDOW = 28;

function Stat({ label, value, note }: { label: string; value: string; note?: string }) {
  return (
    <div className="min-w-0">
      <dt className="font-mono text-[11px] tracking-[0.06em] text-ink-3 uppercase">{label}</dt>
      <dd className="m-0 mt-1 font-mono text-[26px] leading-none font-medium tracking-[-0.02em] tabular-nums">{value}</dd>
      {note ? <div className="mt-1.5 text-xs text-ink-3">{note}</div> : null}
    </div>
  );
}

/** A small look at sleep for the dashboard: the latest night, the usual night, and a way into the whole Sleep module. */
export function SleepSnapshot({ today, onOpen }: { today: string; onOpen: () => void }) {
  const { status, error, built } = useSleep();
  const summary = useMemo(() => summarize(built.nights, today, WINDOW), [built.nights, today]);
  const latest = built.nights[0] ?? null;

  return (
    <Reveal delay={0.1}>
      <section className="card p-5 sm:p-6" aria-labelledby="sleep-snapshot-title">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 id="sleep-snapshot-title" className="font-mono text-[11px] tracking-[0.08em] text-ink-3 uppercase">Sleep</h2>
          <a href="#today" onClick={(e) => { e.preventDefault(); onOpen(); }} className="inline-flex items-center gap-1.5 text-sm text-ink-2 underline decoration-primary underline-offset-3 hover:text-ink">
            Open sleep <ArrowRight className="size-3.5" aria-hidden="true" />
          </a>
        </div>
        {status === 'loading' ? <div className="loading mt-4">Loading your sleep</div> : null}
        {status === 'error' ? <p className="mt-4 text-sm text-ink-2" role="alert">Your sleep could not be loaded: {error}</p> : null}
        {status === 'ready' && latest === null ? (
          <p className="mt-4 max-w-lg text-sm text-ink-2">No nights yet. Add one on the Today page, or import sleep from Apple Health, and it shows up here.</p>
        ) : null}
        {status === 'ready' && latest !== null ? (
          <dl className="m-0 mt-4 grid grid-cols-2 gap-x-6 gap-y-5 sm:grid-cols-4">
            <Stat label="Latest night" value={formatDuration(latest.main.metrics.tstMin)} note={nightHeading(latest.key)} />
            {summary.enough && summary.medianAsleepMin !== null ? (
              <Stat label="Usual night" value={formatDuration(roundTo5(summary.medianAsleepMin))} note={`about, the middle of the last ${WINDOW} days`} />
            ) : (
              <Stat label="Usual night" value="--" note={`needs 5 nights in ${WINDOW} days`} />
            )}
            {summary.enough && summary.usualAsleepClock !== null && summary.usualWakeClock !== null ? (
              <>
                <Stat label="Usually asleep" value={formatClock(summary.usualAsleepClock)} />
                <Stat label="Usually up" value={formatClock(summary.usualWakeClock)} />
              </>
            ) : (
              <Stat label="Nights recorded" value={`${summary.nights} of ${WINDOW}`} />
            )}
          </dl>
        ) : null}
      </section>
    </Reveal>
  );
}
