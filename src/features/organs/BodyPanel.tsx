import { useMemo } from 'react';
import { AsciiArt } from '@/components/ui/ascii-art';
import { useBloodwork } from '../bloodwork/useBloodwork.ts';
import { useHabits } from '../habits/HabitsContext.tsx';
import { withUntouchedCounts, type Entries } from '../habits/model.ts';
import { useProfile } from '../profile/ProfileContext.tsx';
import { ageBand, classifyHours } from '../sleep/ageBand.ts';
import { summarize } from '../sleep/summary.ts';
import { roundTo5 } from '../sleep/time.ts';
import { useSleep } from '../sleep/useSleep.ts';
import { LEVEL_LABEL, organStates, type OrganState, type SleepInput } from './model.ts';
import './organs.css';

/** The same window the Sleep section uses for a usual night. */
const SLEEP_WINDOW = 28;

function Organ({ organ }: { organ: OrganState }) {
  const { def, level, signals } = organ;
  const state = level === null ? 'Nothing logged yet' : LEVEL_LABEL[level];
  return (
    <div className={`card organ organ-${level ?? 'none'}`}>
      <AsciiArt shape={def.shape} cols={30} rows={15} still label={`${def.label}, ${state.toLowerCase()}`} className="organ-art text-[9px]" />
      <div className="organ-name">{def.label}</div>
      <div className="organ-state">{state}</div>
      {signals.length > 0 && (
        <ul className="organ-why">
          {signals.map((s) => (
            <li key={s.label}><span className={`organ-pip organ-${s.level}`} aria-hidden />{s.label}: {s.detail}</li>
          ))}
        </ul>
      )}
    </div>
  );
}

/**
 * Each organ in characters, red when everything it is linked to is on track, fading to grey as a reading moves away
 * from your own goal or the lab's range. It is read only from what you logged today, your latest blood results and
 * your usual night of sleep, and lists which of them set the colour. There is no score behind it.
 */
export function BodyPanel({ entries, today }: { entries: Entries; today: string }) {
  const { habits } = useHabits();
  const { profile } = useProfile();
  const blood = useBloodwork();
  const sleep = useSleep();

  const sleepInput = useMemo<SleepInput | null>(() => {
    if (sleep.status !== 'ready') return null;
    const summary = summarize(sleep.built.nights, today, SLEEP_WINDOW);
    const band = ageBand(profile?.age);
    const main = band && !band.includesNaps ? band : null;
    const durationClass = main && summary.medianAsleepMin !== null ? classifyHours(roundTo5(summary.medianAsleepMin) / 60, main) : null;
    return { medianAsleepMin: summary.medianAsleepMin, durationClass, windowDays: SLEEP_WINDOW };
  }, [sleep.status, sleep.built.nights, today, profile?.age]);

  const organs = useMemo(() => organStates({
    biomarkers: blood.status === 'ready' ? blood.data.biomarkers : [],
    readings: blood.status === 'ready' ? blood.data.readings : [],
    habits,
    entries: withUntouchedCounts(habits, entries),
    sleep: sleepInput,
    sex: profile?.sex ?? null,
  }), [blood, habits, entries, sleepInput, profile?.sex]);

  return <BodyPanelView organs={organs} bloodFailed={blood.status === 'error'} />;
}

/** The panel itself, given its data, so it can be drawn with made-up data and checked by eye. */
export function BodyPanelView({ organs, bloodFailed }: { organs: readonly OrganState[]; bloodFailed: boolean }) {
  return (
    <section aria-labelledby="body-title" className="pb-16">
      <div className="on-dots mb-4 flex flex-wrap items-baseline justify-between gap-2">
        <h2 id="body-title" className="font-mono text-[11px] tracking-[0.08em] text-ink-3 uppercase">Your body today</h2>
        <span className="text-xs text-ink-3">Fades as a reading moves away from your goal or the lab's range</span>
      </div>
      {bloodFailed && <div className="notice notice-warn" role="note">Blood results could not be loaded, so the organs below show only what you logged.</div>}
      <div className="organ-grid">
        {organs.map((o) => <Organ key={o.def.id} organ={o} />)}
      </div>
    </section>
  );
}
