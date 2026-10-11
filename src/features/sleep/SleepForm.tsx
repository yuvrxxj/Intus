import { useMemo, useState, type FormEvent } from 'react';
import { Field } from '@/components/ui/field';
import { addSleep, updateSleep } from '../../db/sleep.ts';
import { dayNumber, isoDay } from '../../lib/dates.ts';
import { CLASS_LABEL, classifyHours, type AgeBand } from './ageBand.ts';
import { localInputValue } from './format.ts';
import { sessionMetrics } from './metrics.ts';
import { LIMITS, validateSleepForm, type Resolver, type SleepErrors, type SleepForm, type SleepSession } from './model.ts';
import { formatClock, formatDuration, minutesIntoDay } from './time.ts';

/** Local date and time to an instant on this device's clock, with the offset that applied then. */
const browserResolver: Resolver = (date, clock) => {
  const [y, m, d] = date.split('-').map(Number);
  const [h, mi] = clock.split(':').map(Number);
  const when = new Date(y, m - 1, d, h, mi);
  if (Number.isNaN(when.getTime()) || when.getMonth() !== m - 1) return null;
  return { utcMs: when.getTime(), offsetMin: -when.getTimezoneOffset() };
};

const zoneName = (): string | null => {
  try { return Intl.DateTimeFormat().resolvedOptions().timeZone || null; } catch { return null; }
};

/** The form starts from the last night entered (its times of day), not from a made-up typical night. */
function initialForm(editing: SleepSession | null, last: SleepSession | null, today: string): SleepForm {
  if (editing) {
    return {
      start: localInputValue(editing.start, editing.startOffsetMin),
      end: localInputValue(editing.end, editing.endOffsetMin),
      latency: editing.latencyMin === null ? '' : String(editing.latencyMin),
      awake: editing.awakeMin === null ? '' : String(editing.awakeMin),
      notes: editing.notes ?? '',
    };
  }
  const bed = last ? minutesIntoDay(last.start, last.startOffsetMin) : 23 * 60;
  const up = last ? minutesIntoDay(last.end, last.endOffsetMin) : 7 * 60;
  const startDay = bed >= up ? isoDay(dayNumber(today) - 1) : today;
  return { start: `${startDay}T${formatClock(bed)}`, end: `${today}T${formatClock(up)}`, latency: '', awake: '', notes: '' };
}

export function SleepEntry({ editing, last, existing, band, today, nowMs, onDone, onCancel, notify }: {
  editing: SleepSession | null;
  last: SleepSession | null;
  existing: readonly SleepSession[];
  band: AgeBand | null;
  today: string;
  nowMs: number;
  onDone: () => void;
  onCancel?: () => void;
  notify: (message: string, error?: boolean) => void;
}) {
  const [form, setForm] = useState<SleepForm>(() => initialForm(editing, last, today));
  const [errors, setErrors] = useState<SleepErrors>({});
  const [failure, setFailure] = useState<string | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);

  const set = <K extends keyof SleepForm>(key: K, value: string) => { setForm((f) => ({ ...f, [key]: value })); setConfirming(false); };
  const ctx = useMemo(() => ({ nowMs, resolve: browserResolver, tzId: zoneName(), existing, editingId: editing?.id ?? null }), [nowMs, existing, editing]);

  // what this entry will say, shown before saving, as numbers: never a verdict
  const preview = useMemo(() => {
    const r = validateSleepForm(form, ctx);
    if (!r.ok) return null;
    const s: SleepSession = {
      id: 'preview', sourceKind: 'manual', sourceName: null, externalId: null,
      start: Date.parse(r.value.start_at), end: Date.parse(r.value.end_at), startOffsetMin: r.value.start_offset_min, endOffsetMin: r.value.end_offset_min,
      tzId: r.value.tz_id, latencyMin: r.value.latency_min, awakeMin: r.value.awake_min, stages: [], startIsInBed: true, notes: null, recordedAt: nowMs,
    };
    const m = sessionMetrics(s);
    return { m, warnings: r.warnings, hours: m.tstMin / 60 };
  }, [form, ctx, nowMs]);

  async function submit(event: FormEvent) {
    event.preventDefault();
    const r = validateSleepForm(form, ctx);
    if (!r.ok) { setErrors(r.errors); return; }
    setErrors({});
    if (r.warnings.length > 0 && !confirming) { setConfirming(true); return; }
    setFailure(null);
    setBusy(true);
    try {
      if (editing) await updateSleep(editing.id, r.value); else await addSleep(r.value);
      notify(editing ? 'Night updated' : 'Night saved');
      setConfirming(false);
      onDone();
    } catch (e) {
      setFailure(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <form className="card sec" onSubmit={submit} noValidate>
      <div className="ct"><span className="dot dot-blue" />{editing ? 'Edit a night' : 'Add a night'}</div>
      <div className="form-grid">
        <Field id="sleep-start" label="Got into bed" error={errors.start}>
          <input id="sleep-start" type="datetime-local" value={form.start} onChange={(e) => set('start', e.target.value)} />
        </Field>
        <Field id="sleep-end" label="Got up" error={errors.end}>
          <input id="sleep-end" type="datetime-local" value={form.end} onChange={(e) => set('end', e.target.value)} />
        </Field>
        <Field id="sleep-latency" label="Minutes to fall asleep" error={errors.latency} hint="Optional. Your own estimate.">
          <input id="sleep-latency" type="number" inputMode="numeric" min={0} max={LIMITS.maxLatencyMin} step={1} value={form.latency} onChange={(e) => set('latency', e.target.value)} />
        </Field>
        <Field id="sleep-awake" label="Minutes awake in the night" error={errors.awake} hint="Optional. Add it up roughly. Without it, time asleep is the time from bed to getting up.">
          <input id="sleep-awake" type="number" inputMode="numeric" min={0} max={LIMITS.maxAwakeMin} step={1} value={form.awake} onChange={(e) => set('awake', e.target.value)} />
        </Field>
        <Field id="sleep-notes" label="Note" error={errors.notes} hint="Optional.">
          <input id="sleep-notes" type="text" maxLength={LIMITS.notesChars + 20} value={form.notes} onChange={(e) => set('notes', e.target.value)} />
        </Field>
      </div>

      {preview ? (
        <div className="notice" style={{ marginTop: 12 }} role="status">
          {preview.m.basis === 'bed_to_wake'
            ? `${formatDuration(preview.m.tibMin)} from getting into bed to getting up.`
            : `${formatDuration(preview.m.tstMin)} asleep, ${formatDuration(preview.m.tibMin)} in bed.`}
          {band ? ` ${CLASS_LABEL[classifyHours(preview.hours, band)]} (${band.recLow} to ${band.recHigh} hours).` : ''}
        </div>
      ) : null}
      {confirming && preview ? preview.warnings.map((w) => <div key={w} className="notice notice-warn" role="alert">{w}</div>) : null}
      {failure ? <div className="notice notice-bad" role="alert">Could not save: {failure}</div> : null}

      <div className="btn-row">
        <button type="submit" className="btn btn-primary" disabled={busy}>
          {busy ? 'Saving…' : confirming ? 'Save anyway' : editing ? 'Save changes' : 'Save night'}
        </button>
        {editing && onCancel ? <button type="button" className="btn" disabled={busy} onClick={onCancel}>Cancel</button> : null}
      </div>
    </form>
  );
}
