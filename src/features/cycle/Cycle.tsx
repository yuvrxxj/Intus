import { useCallback, useEffect, useMemo, useState } from 'react';
import { deleteCondition, deleteCycleDay, fetchCycleDays, saveCondition, saveCycleDay, type CycleDay } from '../../db/cycle.ts';
import { formatDay } from '../bloodwork/format.ts';
import {
  CONDITIONS, CONDITION_LABEL, FLOWS, FLOW_LABEL, SYMPTOMS, SYMPTOM_LABEL, cycleDayOn, periodsOf, summarize,
  type ConditionCode, type Flow, type Symptom,
} from './model.ts';
import { useConditions } from './useConditions.ts';
import './cycle.css';

type Notify = (message: string, error?: boolean) => void;

/** Logging period days, and what has already happened. Nothing is predicted: no next period, ovulation or fertile days. */
function CycleCard({ today, notify }: { today: string; notify: Notify }) {
  const [days, setDays] = useState<CycleDay[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [day, setDay] = useState(today);
  const [flow, setFlow] = useState<Flow>('medium');
  const [symptoms, setSymptoms] = useState<Symptom[]>([]);
  const [busy, setBusy] = useState(false);

  const load = useCallback(() => {
    fetchCycleDays().then(setDays, (e: unknown) => setError(e instanceof Error ? e.message : String(e)));
  }, []);
  useEffect(load, [load]);

  const periods = useMemo(() => periodsOf(days ?? []), [days]);
  const summary = useMemo(() => summarize(periods), [periods]);
  const current = cycleDayOn(periods, today);
  const existing = days?.find((d) => d.day === day && d.source === 'manual') ?? null;

  // editing a day already logged starts from what was saved for it
  useEffect(() => {
    if (existing) {
      setFlow(existing.flow as Flow);
      setSymptoms(existing.symptoms.filter((s): s is Symptom => (SYMPTOMS as readonly string[]).includes(s)));
    }
  }, [existing]);

  async function save() {
    if (day > today) return notify('That date is in the future', true);
    setBusy(true);
    try {
      await saveCycleDay(day, flow, symptoms);
      notify(existing ? 'Day updated' : 'Day logged');
      load();
    } catch (e) {
      notify(`Error: ${e instanceof Error ? e.message : String(e)}`, true);
    } finally {
      setBusy(false);
    }
  }

  async function remove() {
    setBusy(true);
    try {
      await deleteCycleDay(day);
      notify('Day removed');
      setSymptoms([]);
      load();
    } catch (e) {
      notify(`Error: ${e instanceof Error ? e.message : String(e)}`, true);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="card sec" data-testid="cycle">
      <div className="ct"><span className="dot dot-red" />Your cycle</div>
      {error ? (
        <div className="notice notice-bad" role="alert">Your cycle could not be loaded: {error}</div>
      ) : days === null ? (
        <div className="loading">Loading</div>
      ) : (
        <>
          <div className="cy-stats">
            <div><span className="cy-k">Cycle day</span><span className="cy-v">{current ?? '—'}</span></div>
            <div><span className="cy-k">Usual cycle</span><span className="cy-v">{summary.median !== null ? `${summary.median} days` : '—'}</span>
              <span className="cy-n">{summary.median !== null ? `${summary.shortest} to ${summary.longest} over the last ${summary.lengths.length}` : 'shown once 3 cycles are logged'}</span></div>
            <div><span className="cy-k">Usual period</span><span className="cy-v">{summary.periodMedian !== null ? `${summary.periodMedian} days` : '—'}</span></div>
          </div>

          <div className="form-grid">
            <div className="fld">
              <label htmlFor="cy-day">Day</label>
              <input id="cy-day" type="date" max={today} value={day} onChange={(e) => setDay(e.target.value)} />
            </div>
            <div className="fld">
              <label htmlFor="cy-flow">Flow</label>
              <select id="cy-flow" value={flow} onChange={(e) => setFlow(e.target.value as Flow)}>
                {FLOWS.map((f) => <option key={f} value={f}>{FLOW_LABEL[f]}</option>)}
              </select>
            </div>
            <fieldset className="fld wide cy-sym">
              <legend>Symptoms (optional)</legend>
              {SYMPTOMS.map((s) => (
                <label key={s}>
                  <input type="checkbox" checked={symptoms.includes(s)} onChange={(e) => setSymptoms((all) => (e.target.checked ? [...all, s] : all.filter((x) => x !== s)))} />
                  {SYMPTOM_LABEL[s]}
                </label>
              ))}
            </fieldset>
          </div>
          <div className="btn-row">
            <button type="button" className="btn btn-primary" disabled={busy} onClick={save}>{existing ? 'Update this day' : 'Log this day'}</button>
            {existing && <button type="button" className="btn btn-danger" disabled={busy} onClick={remove}>Remove this day</button>}
          </div>

          {periods.length > 0 && (
            <>
              <div className="bio-sec">Recent periods</div>
              <ul className="cy-list">
                {periods.slice(-6).reverse().map((p) => (
                  <li key={p.start}>{formatDay(p.start)}{p.days > 1 ? ` to ${formatDay(p.end)}` : ''} <span className="cy-n">{p.days} day{p.days === 1 ? '' : 's'}</span></li>
                ))}
              </ul>
            </>
          )}
          <div className="fld-hint">Blood results show the cycle day they were taken on, because several hormones change through the cycle. Intus does not predict periods or fertile days.</div>
        </>
      )}
    </div>
  );
}

/** Conditions and life stages a person chooses to record. They only change which ranges apply, never give advice. */
function ConditionsCard({ notify }: { notify: Notify }) {
  const { conditions, reload } = useConditions();
  const [busy, setBusy] = useState<string | null>(null);
  const [labels, setLabels] = useState<Record<string, string>>({});
  const has = (c: ConditionCode) => conditions.find((x) => x.condition === c) ?? null;

  async function toggle(c: ConditionCode, on: boolean) {
    setBusy(c);
    try {
      if (on) await saveCondition(c, labels[c]?.trim() || null, null);
      else await deleteCondition(c);
      reload();
    } catch (e) {
      notify(`Error: ${e instanceof Error ? e.message : String(e)}`, true);
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="card sec" data-testid="conditions">
      <div className="ct"><span className="dot dot-blue" />Conditions and life stages</div>
      <div className="fld-hint">Optional. Only you can see these. They change which ranges apply: in pregnancy, Intus reads results only against the ranges printed on your reports.</div>
      <div className="cy-conds">
        {CONDITIONS.map((c) => {
          const row = has(c);
          return (
            <div key={c} className="cy-cond">
              <label>
                <input type="checkbox" checked={row !== null} disabled={busy === c} onChange={(e) => void toggle(c, e.target.checked)} />
                {row?.label ? `${row.label} (${CONDITION_LABEL[c]})` : CONDITION_LABEL[c]}
              </label>
              {c === 'pcos' && row === null && (
                <input className="cy-label" type="text" maxLength={40} placeholder="Your word for it, e.g. PCOD" aria-label="Your word for PCOS"
                  value={labels[c] ?? ''} onChange={(e) => setLabels((l) => ({ ...l, [c]: e.target.value }))} />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

export function CycleSection({ today, notify }: { today: string; notify: Notify }) {
  return (
    <>
      <CycleCard today={today} notify={notify} />
      <ConditionsCard notify={notify} />
    </>
  );
}
