import { useState, type FormEvent, type ReactNode } from 'react';
import { createHabit, setHabitArchived, updateHabit, type Habit } from '../../db/habits.ts';
import { useHabits } from './HabitsContext.tsx';
import {
  EMPTY_HABIT_FORM, MAX_HABITS, archivedHabits, availablePresets, describeGoal, formFromHabit, nextSortOrder, validateHabitForm,
  type Better, type HabitForm, type HabitFormErrors, type HabitKind, type Preset,
} from './model.ts';

const KIND_SHORT: Record<HabitKind, string> = { count: 'Count', yesno: 'Yes or no', amount: 'Amount' };
const KIND_HINT: Record<HabitKind, string> = {
  count: 'A tally for the day, like cigarettes or drinks.',
  yesno: 'Did you or did not you, like lifting or drinking today.',
  amount: 'A number against a daily goal, like steps or litres of water.',
};

function Field(props: { id: string; label: string; error?: string; hint?: string; wide?: boolean; children: ReactNode }) {
  return (
    <div className={`fld${props.wide ? ' wide' : ''}`}>
      <label htmlFor={props.id}>{props.label}</label>
      {props.children}
      {props.error ? <div className="fld-err" role="alert">{props.error}</div> : props.hint ? <div className="fld-hint">{props.hint}</div> : null}
    </div>
  );
}

function directionOptions(kind: HabitKind): { value: Better; label: string }[] {
  return kind === 'yesno'
    ? [{ value: 'higher', label: 'Yes is good' }, { value: 'lower', label: 'No is good' }]
    : [{ value: 'higher', label: 'Higher is better' }, { value: 'lower', label: 'Lower is better' }];
}

function HabitFormCard({ editing, others, nextOrder, onDone, onCancel }: {
  editing: Habit | null;
  /** the person's other active habits, for the duplicate and limit checks */
  others: readonly Habit[];
  nextOrder: number;
  onDone: (message: string) => void;
  onCancel: () => void;
}) {
  const [form, setForm] = useState<HabitForm>(() => (editing ? formFromHabit(editing) : EMPTY_HABIT_FORM));
  const [errors, setErrors] = useState<HabitFormErrors>({});
  const [failure, setFailure] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const set = <K extends keyof HabitForm>(key: K, value: HabitForm[K]) => setForm((f) => ({ ...f, [key]: value }));
  const kindChanged = editing !== null && editing.kind !== form.kind;
  const preview = validateHabitForm(form, []);
  const goalLine = preview.ok ? describeGoal(preview.value) : null;

  async function submit(event: FormEvent) {
    event.preventDefault();
    const result = validateHabitForm(form, others);
    if (!result.ok) {
      setErrors(result.errors);
      return;
    }
    setErrors({});
    setFailure(null);
    setBusy(true);
    try {
      if (editing) await updateHabit(editing.id, result.value);
      else await createHabit(result.value, nextOrder);
      onDone(editing ? 'Habit saved' : 'Habit added');
    } catch (e) {
      setFailure(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <form className="card" style={{ background: 'var(--s2)', marginTop: 14 }} onSubmit={submit} noValidate>
      <div className="ct"><span className="dot dot-blue" />{editing ? `Edit ${editing.name}` : 'Add a habit'}</div>
      <div className="form-grid">
        <Field id="hab-name" label="Name" error={errors.name} wide>
          <input id="hab-name" type="text" value={form.name} placeholder="Cigarettes, Lift, Steps" autoComplete="off" onChange={(e) => set('name', e.target.value)} />
        </Field>

        <div className="fld wide">
          <label id="hab-kind-label">Type</label>
          <div className="seg" role="group" aria-labelledby="hab-kind-label">
            {(['count', 'yesno', 'amount'] as const).map((k) => (
              <button key={k} type="button" className="btn" aria-pressed={form.kind === k}
                onClick={() => setForm((f) => ({ ...f, kind: k, ...(k === 'yesno' ? { unit: '', goal: '' } : {}) }))}>
                {KIND_SHORT[k]}
              </button>
            ))}
          </div>
          <div className="fld-hint">{KIND_HINT[form.kind]}</div>
          {kindChanged && <div className="fld-hint">Changing the type does not change days you already logged.</div>}
        </div>

        <div className="fld wide">
          <label id="hab-better-label">Which way is good</label>
          <div className="seg" role="group" aria-labelledby="hab-better-label">
            {directionOptions(form.kind).map((o) => (
              <button key={o.value} type="button" className="btn" aria-pressed={form.better === o.value} onClick={() => set('better', o.value)}>{o.label}</button>
            ))}
          </div>
        </div>

        {form.kind !== 'yesno' && (
          <>
            <Field id="hab-goal" label="Daily goal" error={errors.goal} hint={form.better === 'lower' ? 'Stay at or under this. Leave blank for none.' : 'Reach at least this. Leave blank for any.'}>
              <input id="hab-goal" type="number" inputMode="decimal" min="0" step="any" value={form.goal}
                placeholder={form.kind === 'count' ? '0' : '8000'} onChange={(e) => set('goal', e.target.value)} />
            </Field>
            <Field id="hab-unit" label="Unit" error={errors.unit} hint="Optional, like steps or L.">
              <input id="hab-unit" type="text" value={form.unit} placeholder="steps" autoComplete="off" onChange={(e) => set('unit', e.target.value)} />
            </Field>
          </>
        )}
      </div>

      {goalLine && <div className="fld-hint" style={{ marginTop: 10 }}>On track means: {goalLine.charAt(0).toLowerCase() + goalLine.slice(1)}.</div>}
      {failure && <div className="notice notice-bad" role="alert">Could not save: {failure}</div>}

      <div className="btn-row">
        <button type="submit" className="btn btn-primary" disabled={busy}>{busy ? 'Saving…' : editing ? 'Save changes' : 'Add habit'}</button>
        <button type="button" className="btn" onClick={onCancel} disabled={busy}>Cancel</button>
      </div>
    </form>
  );
}

/** Choose what to track: quick starts, your own, edit, archive (history kept) and restore. */
export function HabitsManager({ notify }: { notify: (message: string, error?: boolean) => void }) {
  const { status, habits, active, error, reload } = useHabits();
  const [editing, setEditing] = useState<Habit | 'new' | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const archived = archivedHabits(habits);
  const presets = availablePresets(active);
  const full = active.length >= MAX_HABITS;

  async function run(id: string, action: () => Promise<void>, done: string) {
    setBusyId(id);
    try {
      await action();
      notify(done);
      reload();
    } catch (e) {
      notify(`Error: ${e instanceof Error ? e.message : String(e)}`, true);
    } finally {
      setBusyId(null);
    }
  }

  const addPreset = (p: Preset) => run(`preset:${p.label}`, () => createHabit(p.value, nextSortOrder(habits)), `${p.label} added`);

  function restore(habit: Habit) {
    if (full) return notify(`You can track up to ${MAX_HABITS} habits. Archive one first.`, true);
    if (active.some((h) => h.name.trim().toLowerCase() === habit.name.trim().toLowerCase())) {
      return notify(`You already track a habit called ${habit.name}`, true);
    }
    void run(habit.id, () => setHabitArchived(habit.id, false), `${habit.name} is back`);
  }

  return (
    <div className="card sec">
      <div className="ct"><span className="dot dot-green" />Habits you track</div>
      <div style={{ fontSize: 13, color: 'var(--txt2)', marginBottom: 12 }}>
        Choose what you want to log each day. They appear on your Today screen, in History and in Progress. Archiving hides a habit and keeps its history.
      </div>

      {status === 'loading' ? (
        <div className="loading">Loading your habits</div>
      ) : status === 'error' ? (
        <div className="cbanner" role="alert">
          <div className="cbanner-hdr">Your habits could not be loaded</div>
          <div className="ci">{error}</div>
          <button type="button" className="retry-btn" onClick={reload}>Try again</button>
        </div>
      ) : (
        <>
          {active.length === 0 ? (
            <div className="empty">Nothing tracked yet. Start with one of the quick adds below, or make your own.</div>
          ) : (
            <ul className="habit-manage">
              {active.map((h) => (
                <li key={h.id}>
                  <div className="hm-main">
                    <div className="hm-name">{h.name}</div>
                    <div className="hm-meta">{[KIND_SHORT[h.kind as HabitKind], describeGoal(h)].filter(Boolean).join(' · ')}</div>
                  </div>
                  <div className="hm-actions">
                    <button type="button" className="btn" disabled={busyId === h.id} onClick={() => setEditing(h)}>Edit</button>
                    <button type="button" className="btn" disabled={busyId === h.id}
                      onClick={() => void run(h.id, () => setHabitArchived(h.id, true), `${h.name} archived. Its history is kept.`)}>
                      Archive
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )}

          {presets.length > 0 && !full && (
            <div style={{ marginTop: 14 }}>
              <div className="fld-hint" style={{ marginBottom: 8 }}>Quick add</div>
              <div className="preset-row">
                {presets.map((p) => (
                  <button key={p.label} type="button" className="preset" title={p.hint} disabled={busyId !== null} onClick={() => void addPreset(p)}>
                    + {p.label}
                  </button>
                ))}
              </div>
            </div>
          )}

          {editing !== null ? (
            <HabitFormCard
              key={editing === 'new' ? 'new' : editing.id}
              editing={editing === 'new' ? null : editing}
              others={active.filter((h) => editing === 'new' || h.id !== editing.id)}
              nextOrder={nextSortOrder(habits)}
              onCancel={() => setEditing(null)}
              onDone={(message) => {
                setEditing(null);
                notify(message);
                reload();
              }}
            />
          ) : (
            <div className="btn-row">
              <button type="button" className="btn btn-primary" disabled={full} onClick={() => setEditing('new')}>+ Add your own habit</button>
              {full && <span className="fld-hint" style={{ alignSelf: 'center' }}>You can track up to {MAX_HABITS}. Archive one to add another.</span>}
            </div>
          )}

          {archived.length > 0 && (
            <details style={{ marginTop: 16 }}>
              <summary style={{ cursor: 'pointer', fontSize: 12, color: 'var(--muted)' }}>Archived ({archived.length})</summary>
              <ul className="habit-manage">
                {archived.map((h) => (
                  <li key={h.id}>
                    <div className="hm-main">
                      <div className="hm-name">{h.name}</div>
                      <div className="hm-meta">{[KIND_SHORT[h.kind as HabitKind], describeGoal(h)].filter(Boolean).join(' · ')}</div>
                    </div>
                    <div className="hm-actions">
                      <button type="button" className="btn" disabled={busyId === h.id} onClick={() => restore(h)}>Restore</button>
                    </div>
                  </li>
                ))}
              </ul>
            </details>
          )}
        </>
      )}
    </div>
  );
}
