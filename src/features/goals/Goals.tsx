import { useState, type FormEvent, type ReactNode } from 'react';
import { saveGoals } from '../../db/profile.ts';
import { useProfile } from '../profile/ProfileContext.tsx';
import {
  formFromProfile, newGoalFrom, summarizeGoal, validateGoalsForm, LIMITS, type GoalsErrors, type GoalsForm,
} from './model.ts';

function Field(props: { id: string; label: string; error?: string; hint?: string; children: ReactNode }) {
  return (
    <div className="fld">
      <label htmlFor={props.id}>{props.label}</label>
      {props.children}
      {props.error ? <div className="fld-err" role="alert">{props.error}</div> : props.hint ? <div className="fld-hint">{props.hint}</div> : null}
    </div>
  );
}

/** The form itself. It is keyed on the saved goal, so a fresh load or a save resets it to what is stored. */
function GoalsFormCard({ initial, existingId, today, latestWeightKg, reload, notify }: {
  initial: GoalsForm;
  existingId: string | null;
  today: string;
  latestWeightKg: number | null;
  reload: () => void;
  notify: (message: string, error?: boolean) => void;
}) {
  const [form, setForm] = useState<GoalsForm>(initial);
  const [errors, setErrors] = useState<GoalsErrors>({});
  const [failure, setFailure] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const set = <K extends keyof GoalsForm>(key: K, value: string) => setForm((f) => ({ ...f, [key]: value }));
  const summary = summarizeGoal(form);
  const preview = validateGoalsForm(form, today);
  const notes = preview.ok ? preview.notes : [];

  async function submit(event: FormEvent) {
    event.preventDefault();
    const result = validateGoalsForm(form, today);
    if (!result.ok) {
      setErrors(result.errors);
      return;
    }
    setErrors({});
    setFailure(null);
    setBusy(true);
    try {
      await saveGoals(existingId, result.value);
      notify('Goal saved ✓');
      reload();
    } catch (e) {
      setFailure(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <form className="card sec" onSubmit={submit} noValidate>
      <div className="ct"><span className="dot dot-blue" />Your goal</div>
      {summary ? <div className="notice notice-ok" style={{ marginTop: 0, marginBottom: 12 }} role="status">{summary}</div> : null}
      <div className="form-grid">
        <Field id="goal-start-weight" label="Starting weight (kg)" error={errors.start_weight}>
          <input id="goal-start-weight" type="number" inputMode="decimal" step="0.1" min={LIMITS.weightKg.min} max={LIMITS.weightKg.max}
            value={form.start_weight} placeholder="82" onChange={(e) => set('start_weight', e.target.value)} />
        </Field>
        <Field id="goal-goal-weight" label="Goal weight (kg)" error={errors.goal_weight} hint="Lower than your start to lose weight, higher to gain.">
          <input id="goal-goal-weight" type="number" inputMode="decimal" step="0.1" min={LIMITS.weightKg.min} max={LIMITS.weightKg.max}
            value={form.goal_weight} placeholder="75" onChange={(e) => set('goal_weight', e.target.value)} />
        </Field>
        <Field id="goal-start-date" label="Start date" error={errors.start_date}>
          <input id="goal-start-date" type="date" value={form.start_date} onChange={(e) => set('start_date', e.target.value)} />
        </Field>
        <Field id="goal-goal-date" label="Goal date" error={errors.goal_date} hint="The day you want to reach your goal weight.">
          <input id="goal-goal-date" type="date" value={form.goal_date} onChange={(e) => set('goal_date', e.target.value)} />
        </Field>
      </div>

      <div className="ct" style={{ marginTop: 20 }}><span className="dot dot-green" />Daily targets</div>
      <div className="form-grid">
        <Field id="goal-calories" label="Calories (kcal)" error={errors.calorie_target} hint="Optional. Shown against what you log each day.">
          <input id="goal-calories" type="number" inputMode="numeric" step="1" min={LIMITS.calories.min} max={LIMITS.calories.max}
            value={form.calorie_target} placeholder="2100" onChange={(e) => set('calorie_target', e.target.value)} />
        </Field>
        <Field id="goal-protein" label="Protein (g)" error={errors.protein_target} hint="Optional.">
          <input id="goal-protein" type="number" inputMode="numeric" step="1" min={LIMITS.proteinG.min} max={LIMITS.proteinG.max}
            value={form.protein_target} placeholder="165" onChange={(e) => set('protein_target', e.target.value)} />
        </Field>
        <Field id="goal-steps" label="Steps" error={errors.step_target} hint="Optional. Used by your habits.">
          <input id="goal-steps" type="number" inputMode="numeric" step="1" min={LIMITS.steps.min} max={LIMITS.steps.max}
            value={form.step_target} placeholder="9000" onChange={(e) => set('step_target', e.target.value)} />
        </Field>
      </div>

      {notes.map((n) => <div key={n} className="notice notice-warn">{n}</div>)}
      {failure ? <div className="notice notice-bad" role="alert">Could not save: {failure}</div> : null}

      <div className="btn-row">
        <button type="submit" className="btn btn-primary" disabled={busy}>{busy ? 'Saving…' : 'Save goal'}</button>
        <button type="button" className="btn" disabled={busy}
          onClick={() => { setForm(newGoalFrom(form, today, latestWeightKg)); setErrors({}); }}>
          Start a new goal from today
        </button>
      </div>
      <div className="fld-hint" style={{ marginTop: 10 }}>
        A new goal starts today from your latest weigh-in and clears the old goal weight and date. Your daily entries stay as they are.
      </div>
    </form>
  );
}

export function Goals({ today, latestWeightKg, notify }: {
  today: string;
  latestWeightKg: number | null;
  notify: (message: string, error?: boolean) => void;
}) {
  const { status, profile, error, reload } = useProfile();

  if (status === 'loading') return <div className="loading">Loading your goal</div>;
  if (status === 'error') {
    return (
      <div className="cbanner" role="alert">
        <div className="cbanner-hdr">Your goal could not be loaded</div>
        <div className="ci">{error}</div>
        <button type="button" className="retry-btn" onClick={reload}>Try again</button>
      </div>
    );
  }

  return (
    <div>
      {profile === null || profile.start_weight == null ? (
        <div className="notice" style={{ marginTop: 0, marginBottom: 14 }}>
          You have not set a goal yet. Pick a starting weight, a goal weight and a date, and the dashboard measures your progress against them.
        </div>
      ) : null}
      <GoalsFormCard
        key={`${profile?.id ?? 'none'}:${profile?.updated_at ?? ''}`}
        initial={formFromProfile(profile)}
        existingId={profile?.id ?? null}
        today={today}
        latestWeightKg={latestWeightKg}
        reload={reload}
        notify={notify}
      />
    </div>
  );
}
