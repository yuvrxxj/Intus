import { useCallback, useEffect, useMemo, useState } from 'react';
import { fetchWorkouts, sendOp, type Workout } from '../../db/strength.ts';
import { bests, byExercise, EMPTY_SET, validateSet, volume, type SetErrors, type SetForm, type SetRow } from './model.ts';
import { enqueue, flush, overlay, readQueue, QUEUE_KEY, type Op, type Storage, type WorkoutRow } from './queue.ts';
import './strength.css';

type Notify = (message: string, error?: boolean) => void;

/** Local storage that never throws: a private window or blocked storage just means no offline queue. */
const storage: Storage = {
  get: () => {
    try {
      return localStorage.getItem(QUEUE_KEY);
    } catch {
      return null;
    }
  },
  set: (v) => {
    try {
      localStorage.setItem(QUEUE_KEY, v);
    } catch {
      // nothing more can be done; the send below is still tried
    }
  },
};

const fmt = (n: number) => String(Number(n.toPrecision(6)));

/**
 * The strength log. A set is kept on this device the moment it is entered, then sent; if sending fails it stays
 * queued and is sent later, so a closed tab or a lost connection never loses a set.
 */
export function Strength({ notify }: { notify: Notify }) {
  const [stored, setStored] = useState<Workout[] | null>(null);
  const [ops, setOps] = useState<Op[]>(() => readQueue(storage));
  const [loadError, setLoadError] = useState<string | null>(null);
  const [form, setForm] = useState<SetForm>(EMPTY_SET);
  const [errors, setErrors] = useState<SetErrors>({});
  const [syncError, setSyncError] = useState<string | null>(null);

  const load = useCallback(() => {
    fetchWorkouts().then(setStored, (e: unknown) => setLoadError(e instanceof Error ? e.message : String(e)));
  }, []);

  const sync = useCallback(async () => {
    const result = await flush(storage, { send: sendOp });
    setOps(readQueue(storage));
    setSyncError(result.error && /failed to fetch|network|load failed/i.test(result.error) ? 'no connection' : result.error);
    if (result.waiting === 0) load();
  }, [load]);

  useEffect(() => {
    load();
    void sync();
    const online = () => void sync();
    window.addEventListener('online', online);
    return () => window.removeEventListener('online', online);
  }, [sync]);

  function push(op: Op) {
    setOps(enqueue(storage, op));
    void sync();
  }

  // stored workouts with every unsent change laid over them
  const workouts = useMemo(() => {
    const base: WorkoutRow[] = (stored ?? []).map(({ sets: _s, ...w }) => { void _s; return w; });
    const ws = overlay(base, ops, (o) => (o.kind === 'workout' ? o.row : null), (o) => (o.kind === 'deleteWorkout' ? o.id : null));
    const sets = overlay((stored ?? []).flatMap((w) => w.sets), ops, (o) => (o.kind === 'set' ? o.row : null), (o) => (o.kind === 'deleteSet' ? o.id : null));
    return ws
      .map((w) => ({ ...w, sets: sets.filter((s) => s.workout_id === w.id) }))
      .sort((a, b) => b.started_at.localeCompare(a.started_at));
  }, [stored, ops]);

  const open = workouts.find((w) => w.ended_at === null) ?? null;
  const past = workouts.filter((w) => w.ended_at !== null).slice(0, 5);
  const known = useMemo(() => [...new Set(workouts.flatMap((w) => w.sets.map((s) => s.exercise)))].sort(), [workouts]);
  const best = useMemo(() => bests(workouts.flatMap((w) => w.sets)), [workouts]);

  function start() {
    push({ kind: 'workout', row: { id: crypto.randomUUID(), started_at: new Date().toISOString(), ended_at: null, notes: null } });
  }

  function finish() {
    if (!open) return;
    const { sets: _s, ...row } = open;
    void _s;
    push({ kind: 'workout', row: { ...row, ended_at: new Date().toISOString() } });
    notify(`Workout saved: ${open.sets.length} set${open.sets.length === 1 ? '' : 's'}`);
  }

  function addSet() {
    if (!open) return;
    const result = validateSet(form);
    if (!result.ok) return setErrors(result.errors);
    setErrors({});
    const position = open.sets.reduce((n, s) => Math.max(n, s.position + 1), 0);
    push({ kind: 'set', row: { id: crypto.randomUUID(), workout_id: open.id, position, ...result.value } });
    // keep the exercise and weight for the next set, the usual case
    setForm((f) => ({ ...f, reps: '', rpe: '', notes: '' }));
  }

  function removeSet(s: SetRow) {
    push({ kind: 'deleteSet', id: s.id });
  }

  function discard() {
    if (!open || !window.confirm('Discard this workout and its sets?')) return;
    push({ kind: 'deleteWorkout', id: open.id });
  }

  const set = <K extends keyof SetForm>(k: K, v: string) => setForm((f) => ({ ...f, [k]: v }));
  const waiting = ops.length;

  return (
    <div className="card sec" data-testid="strength">
      <div className="ct"><span className="dot dot-red" />Strength</div>
      {waiting > 0 && (
        <div className="notice notice-warn" role="status">
          {waiting} change{waiting === 1 ? '' : 's'} kept on this device, waiting to be sent{syncError ? ` (${syncError})` : ''}.
          <button type="button" className="btn st-retry" onClick={() => void sync()}>Send now</button>
        </div>
      )}
      {loadError && <div className="notice notice-bad" role="alert">Past workouts could not be loaded: {loadError}</div>}

      {!open ? (
        <div className="btn-row" style={{ marginTop: 0 }}>
          <button type="button" className="btn btn-primary" onClick={start}>Start a workout</button>
        </div>
      ) : (
        <>
          <div className="st-head">Started {new Date(open.started_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} · {open.sets.length} set{open.sets.length === 1 ? '' : 's'} · {fmt(volume(open.sets))} kg moved</div>
          <div className="st-form">
            <div className="fld st-ex">
              <label htmlFor="st-ex">Exercise</label>
              <input id="st-ex" type="text" list="st-known" value={form.exercise} onChange={(e) => set('exercise', e.target.value)} placeholder="Back squat" />
              <datalist id="st-known">{known.map((k) => <option key={k} value={k} />)}</datalist>
              {errors.exercise && <div className="fld-err">{errors.exercise}</div>}
            </div>
            <div className="fld">
              <label htmlFor="st-kg">kg</label>
              <input id="st-kg" type="text" inputMode="decimal" value={form.weight} onChange={(e) => set('weight', e.target.value)} placeholder="100" />
              {errors.weight && <div className="fld-err">{errors.weight}</div>}
            </div>
            <div className="fld">
              <label htmlFor="st-reps">Reps</label>
              <input id="st-reps" type="text" inputMode="numeric" value={form.reps} onChange={(e) => set('reps', e.target.value)} placeholder="5" />
              {errors.reps && <div className="fld-err">{errors.reps}</div>}
            </div>
            <div className="fld">
              <label htmlFor="st-rpe">RPE</label>
              <input id="st-rpe" type="text" inputMode="decimal" value={form.rpe} onChange={(e) => set('rpe', e.target.value)} placeholder="8" />
              {errors.rpe && <div className="fld-err">{errors.rpe}</div>}
            </div>
            <div className="fld st-notes">
              <label htmlFor="st-notes">Note</label>
              <input id="st-notes" type="text" value={form.notes} maxLength={200} onChange={(e) => set('notes', e.target.value)} placeholder="Optional" />
              {errors.notes && <div className="fld-err">{errors.notes}</div>}
            </div>
          </div>
          <div className="btn-row">
            <button type="button" className="btn btn-primary" onClick={addSet}>Add set</button>
            <button type="button" className="btn" onClick={finish} disabled={open.sets.length === 0}>Finish workout</button>
            <button type="button" className="btn btn-danger" onClick={discard}>Discard</button>
          </div>
          {byExercise(open.sets).map((g) => (
            <div key={g.exercise} className="st-group">
              <div className="bio-sec">{g.exercise}</div>
              <ol className="st-sets">
                {g.sets.map((s) => (
                  <li key={s.id}>
                    <span className="st-set">{s.weight_kg !== null ? `${fmt(s.weight_kg)} kg × ` : ''}{s.reps}{s.rpe !== null ? ` @ RPE ${fmt(s.rpe)}` : ''}</span>
                    {s.notes && <span className="st-note">{s.notes}</span>}
                    {ops.some((o) => o.kind === 'set' && o.row.id === s.id) && <span className="st-pending" title="Kept on this device, not sent yet">not sent yet</span>}
                    <button type="button" className="st-del" aria-label={`Delete set ${s.reps} reps`} onClick={() => removeSet(s)}>×</button>
                  </li>
                ))}
              </ol>
            </div>
          ))}
        </>
      )}

      {stored === null && !loadError ? (
        <div className="loading">Loading workouts</div>
      ) : past.length > 0 ? (
        <>
          <div className="bio-sec">Recent workouts</div>
          <ul className="st-past">
            {past.map((w) => (
              <li key={w.id}>
                <span>{new Date(w.started_at).toLocaleDateString([], { day: 'numeric', month: 'short' })}</span>
                <span>{byExercise(w.sets).map((g) => g.exercise).join(', ') || 'No sets'}</span>
                <span className="st-n">{w.sets.length} sets · {fmt(volume(w.sets))} kg</span>
              </li>
            ))}
          </ul>
          {best.size > 0 && (
            <div className="fld-hint">
              Heaviest sets: {[...best.values()].slice(0, 6).map((s) => `${s.exercise} ${fmt(s.weight_kg ?? 0)} kg × ${s.reps}`).join(' · ')}
            </div>
          )}
        </>
      ) : null}
    </div>
  );
}
