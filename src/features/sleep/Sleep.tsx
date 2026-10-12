import { useMemo, useState } from 'react';
import { Pencil, Trash2 } from 'lucide-react';
import { deleteSleep } from '../../db/sleep.ts';
import { useProfile } from '../profile/ProfileContext.tsx';
import { ageBand, bandSentence, CLASS_LABEL, classifyHours } from './ageBand.ts';
import { approx, clockRange, nightHeading, sourceLabel } from './format.ts';
import { SleepEntry } from './SleepForm.tsx';
import { SleepChart } from './SleepChart.tsx';
import { sourceId, type Flag, type Night, type Sleep as NightSleep } from './nights.ts';
import { dayStrip, MIN_NIGHTS, summarize } from './summary.ts';
import { formatClock, formatDuration, roundTo5 } from './time.ts';
import { useSleep } from './useSleep.ts';
import { ImportAppleHealth } from '../import/ImportAppleHealth.tsx';
import type { SleepSession } from './model.ts';

const WINDOW = 28;
const PAGE = 14;

const FLAG_TEXT: Record<Flag, string> = {
  sources_disagree: 'Two sources differ by an hour or more for this night.',
  possible_tz_error: 'Two sources differ by a whole number of hours, which can be a time zone mix-up.',
  short_main: 'Under 3 hours asleep. Worth a look in case a record is incomplete.',
  tz_uncertain: 'Bed and wake were in different time zones, so clock times here are approximate.',
};

const REASON_TEXT = { lower_priority: 'not used: another source ranks first', below_coverage_floor: 'not used: it covers less than half of the night' } as const;

const isDevice = (s: NightSleep): boolean => s.session.sourceKind !== 'manual';

function Stat({ label, value, note }: { label: string; value: string; note?: string }) {
  return (
    <div className="min-w-0">
      <dt className="font-mono text-[11px] tracking-[0.06em] text-ink-3 uppercase">{label}</dt>
      <dd className="m-0 mt-1 text-2xl font-semibold tracking-[-0.02em] tabular-nums">{value}</dd>
      {note ? <div className="mt-0.5 text-xs text-ink-3">{note}</div> : null}
    </div>
  );
}

function NightRow({ night, band, editable, onEdit, onDelete, busy }: {
  night: Night;
  band: ReturnType<typeof ageBand>;
  editable: boolean;
  onEdit: () => void;
  onDelete: () => void;
  busy: boolean;
}) {
  const [asking, setAsking] = useState(false);
  const { main } = night;
  const m = main.metrics;
  const hours = (band?.includesNaps ? night.totalAsleep24Min : m.tstMin) / 60;
  const device = isDevice(main);
  const duration = formatDuration(m.tstMin);
  return (
    <li className="border-t border-line py-3 first:border-t-0">
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <div className="font-medium">{nightHeading(night.key)}</div>
        <div className="tabular-nums">
          <span className="text-lg font-semibold">{device ? approx(duration) : duration}</span>
          <span className="ml-2 text-xs text-ink-3">{m.basis === 'bed_to_wake' ? 'bed to wake' : 'asleep'}</span>
        </div>
      </div>
      <div className="mt-0.5 text-xs text-ink-3 tabular-nums">
        {clockRange(main.session)} · {sourceLabel(main.session)}
        {main.session.members.length > 1 ? ` · ${main.session.members.length} records joined` : ''}
      </div>
      {band ? <div className="mt-1 text-xs text-ink-2">{CLASS_LABEL[classifyHours(hours, band)]}</div> : null}
      {m.basis === 'diary' || m.basis === 'stages' ? (
        <div className="mt-1 text-xs text-ink-3">
          {formatDuration(m.tibMin)} in bed
          {m.latencyMin !== null ? `, ${m.latencyMin} min to fall asleep` : ''}
          {m.wasoMin !== null ? `, ${m.wasoMin} min awake in the night` : ''}
          {m.efficiency !== null ? `, ${Math.round(m.efficiency)}% of the time in bed asleep` : ''}.
        </div>
      ) : null}
      {m.stageMinutes ? (
        <div className="mt-1 text-xs text-ink-3">
          Estimated by the device: light {formatDuration(m.stageMinutes.light)}, deep {formatDuration(m.stageMinutes.deep)}, REM {formatDuration(m.stageMinutes.rem)}. Stages are a rough guess.
        </div>
      ) : null}
      {night.additional.map((extra) => (
        <div key={extra.session.id} className="mt-1 text-xs text-ink-3 tabular-nums">
          {extra.kind === 'nap' ? 'Nap' : 'Second sleep'}: {formatDuration(extra.metrics.tstMin)} ({clockRange(extra.session)})
        </div>
      ))}
      {main.alternatives.map((alt) => (
        <div key={alt.sourceId} className="mt-1 text-xs text-ink-3">
          Also recorded by {sourceLabel(alt)}: {approx(formatDuration(alt.tstMin))} ({REASON_TEXT[alt.reason]}).
        </div>
      ))}
      {main.flags.map((f) => <div key={f} className="mt-1 text-xs text-ink-2">{FLAG_TEXT[f]}</div>)}
      {editable ? (
        <div className="mt-2 flex flex-wrap items-center gap-3 text-xs">
          <button type="button" className="inline-flex items-center gap-1 text-ink-3 hover:text-ink" onClick={onEdit}>
            <Pencil className="size-3" aria-hidden="true" />Edit
          </button>
          {asking ? (
            <span className="flex flex-wrap gap-2">
              <button type="button" className="btn btn-danger !min-h-0 !px-2.5 !py-1 text-xs" disabled={busy} onClick={onDelete}>Delete for good</button>
              <button type="button" className="btn !min-h-0 !px-2.5 !py-1 text-xs" disabled={busy} onClick={() => setAsking(false)}>Keep</button>
            </span>
          ) : (
            <button type="button" className="inline-flex items-center gap-1 text-ink-3 hover:text-ink" onClick={() => setAsking(true)}>
              <Trash2 className="size-3" aria-hidden="true" />Delete
            </button>
          )}
        </div>
      ) : null}
    </li>
  );
}

/** Sleep: when and how long, from what you enter now and from Apple or Google health data once it is imported. */
export function Sleep({ today, notify }: { today: string; notify: (message: string, error?: boolean) => void }) {
  const { profile } = useProfile();
  const { status, error, sessions, built, reload } = useSleep();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [shown, setShown] = useState(PAGE);

  const band = useMemo(() => ageBand(profile?.age), [profile?.age]);
  // the chart and the middle night are about the main sleep, so a band that counts naps (under 6) does not apply to them
  const mainBand = band && !band.includesNaps ? band : null;
  const nowMs = useMemo(() => Date.now(), [sessions]);
  const summary = useMemo(() => summarize(built.nights, today, WINDOW), [built.nights, today]);
  const strip = useMemo(() => dayStrip(built.nights, today, WINDOW), [built.nights, today]);
  const byId = useMemo(() => new Map(sessions.map((s) => [s.id, s])), [sessions]);
  const editing: SleepSession | null = editingId ? byId.get(editingId) ?? null : null;
  const last = useMemo(() => {
    const manual = built.nights.find((n) => n.main.session.sourceKind === 'manual');
    return manual ? byId.get(manual.main.session.members[0]) ?? null : null;
  }, [built.nights, byId]);
  const typicalClass = mainBand && summary.medianAsleepMin !== null ? classifyHours(roundTo5(summary.medianAsleepMin) / 60, mainBand) : null;

  async function remove(night: Night) {
    const id = night.main.session.members[0];
    setBusyId(id);
    try {
      await deleteSleep(id);
      notify('Night deleted');
      reload();
    } catch (e) {
      notify(`Error: ${e instanceof Error ? e.message : String(e)}`, true);
    } finally {
      setBusyId(null);
    }
  }

  function edit(night: Night) {
    setEditingId(night.main.session.members[0]);
    window.setTimeout(() => document.getElementById('sleep-start')?.focus(), 0);
  }

  const editable = (n: Night) => n.main.session.sourceKind === 'manual' && n.main.session.members.length === 1;

  return (
    <div className="grid gap-4">
      <section className="card sec" aria-labelledby="sleep-title">
        <div className="ct" id="sleep-title"><span className="dot dot-blue" />Last {WINDOW} days</div>
        {status === 'loading' ? <div className="loading">Loading your sleep</div> : null}
        {status === 'error' ? (
          <div className="cbanner" role="alert">
            <div className="cbanner-hdr">Your sleep could not be loaded</div>
            <div className="ci">{error}</div>
            <button type="button" className="retry-btn" onClick={reload}>Try again</button>
          </div>
        ) : null}

        {status === 'ready' ? (
          <>
            {summary.enough && summary.medianAsleepMin !== null ? (
              <dl className="m-0 grid grid-cols-2 gap-x-6 gap-y-4 sm:grid-cols-4">
                <Stat label="Time asleep" value={`about ${formatDuration(roundTo5(summary.medianAsleepMin))}`} note="the middle night" />
                {summary.usualAsleepClock !== null && summary.usualWakeClock !== null ? (
                  <>
                    <Stat label="Usually asleep" value={formatClock(summary.usualAsleepClock)} note={summary.asleepSdMin !== null ? `varies by about ${roundTo5(summary.asleepSdMin)} min${summary.rough ? ', roughly' : ''}` : undefined} />
                    <Stat label="Usually up" value={formatClock(summary.usualWakeClock)} note={summary.wakeSdMin !== null ? `varies by about ${roundTo5(summary.wakeSdMin)} min${summary.rough ? ', roughly' : ''}` : undefined} />
                  </>
                ) : null}
                <Stat label="Nights" value={`${summary.nights} of ${WINDOW}`} note="with a record" />
              </dl>
            ) : (
              <div className="notice" style={{ marginTop: 0 }}>
                {summary.nights === 0
                  ? 'No nights yet. Add one below. Averages appear once you have 5 nights in a 28 day stretch.'
                  : `${summary.nights} of the last ${WINDOW} nights recorded. Averages need at least ${MIN_NIGHTS}, so none are shown yet.`}
              </div>
            )}
            {summary.enough ? (
              <p className="mt-3 text-xs leading-relaxed text-ink-3">
                Based on {summary.nights} of the last {WINDOW} nights. Nights with no data are left out, not counted as zero.
                {summary.rough ? ' With fewer than 14 nights, how much your times vary is only a rough guide.' : ''}
                {typicalClass ? ` The middle night is ${CLASS_LABEL[typicalClass].toLowerCase()}.` : ''}
              </p>
            ) : null}

            <div className="mt-5"><SleepChart strip={strip} band={mainBand} /></div>

            {!band ? <p className="mt-3 text-xs leading-relaxed text-ink-3">Add your age under Screening to see the range recommended for it behind the bars. Nothing is assumed in its place.</p> : null}

            <details className="mt-4 text-sm text-ink-2">
              <summary className="cursor-pointer text-ink-3 hover:text-ink">How this is worked out</summary>
              <ul className="mt-2 grid list-disc gap-1.5 pl-5 text-xs leading-relaxed text-ink-3">
                <li>A night is filed under the date you woke up. If there are several sleeps that day, the longest is the main one; the rest are naps or second sleeps.</li>
                <li>Two records from one source less than an hour apart are one sleep with a wake in the middle.</li>
                <li>If more than one source covers a night, one is used and the others are listed beside it. Sources are never added together or averaged. What you enter yourself ranks first, then devices that report stages, then the rest.</li>
                <li>Time asleep with only bed and wake times is the time between them. Add minutes to fall asleep and minutes awake and it becomes closer to time actually asleep.</li>
                <li>Usual times use a circular average, so 23:30 and 00:30 give about midnight, not noon. How much they vary is the standard deviation around it.</li>
                <li>{band ? bandSentence(band) : 'The recommended range depends on age, and no age is set.'} It is shown as a shaded band and never as a verdict, and there is no sleep score.</li>
              </ul>
            </details>
            <p className="mt-3 text-xs leading-relaxed text-ink-3">
              These numbers describe your sleep. They do not grade it. A watch or ring guesses your sleep from movement and heart rate, so it is not a sleep lab: use the
              numbers to see your own pattern over weeks, not to judge one night. This cannot tell you whether you have a sleep problem such as sleep apnea or insomnia. If
              you often feel unrested or very sleepy in the day, talk to a doctor, whatever the numbers say.
            </p>
          </>
        ) : null}
      </section>

      {status === 'ready' ? (
        <SleepEntry key={editing?.id ?? 'new'} editing={editing} last={last} existing={sessions} band={band} today={today} nowMs={nowMs}
          onDone={() => { setEditingId(null); reload(); }} onCancel={editing ? () => setEditingId(null) : undefined} notify={notify} />
      ) : null}

      {status === 'ready' && built.nights.length > 0 ? (
        <section className="card sec" aria-labelledby="sleep-nights-title">
          <div className="ct" id="sleep-nights-title"><span className="dot dot-dim" />Nights</div>
          <ul className="m-0 mt-1 list-none p-0">
            {built.nights.slice(0, shown).map((n) => (
              <NightRow key={`${n.key}-${sourceId(n.main.session)}`} night={n} band={band} editable={editable(n)} busy={busyId === n.main.session.members[0]}
                onEdit={() => edit(n)} onDelete={() => void remove(n)} />
            ))}
          </ul>
          {built.nights.length > shown ? (
            <button type="button" className="btn mt-3" onClick={() => setShown((s) => s + PAGE)}>Show earlier nights</button>
          ) : null}
        </section>
      ) : null}

      <ImportAppleHealth onDone={reload} notify={notify} />

      {status === 'ready' && built.quarantined.length > 0 ? (
        <section className="card sec" aria-labelledby="sleep-set-aside">
          <div className="ct" id="sleep-set-aside"><span className="dot dot-red" />Set aside</div>
          <p className="mt-1 text-sm text-ink-2">These records were not used, because the numbers in them cannot be right.</p>
          <ul className="m-0 mt-2 list-none p-0 text-xs text-ink-3">
            {built.quarantined.map((q) => <li key={q.session.id} className="border-t border-line py-2 first:border-t-0">{clockRange(q.session)}: {q.reason}</li>)}
          </ul>
        </section>
      ) : null}
    </div>
  );
}
