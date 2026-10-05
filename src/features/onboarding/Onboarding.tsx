import { useMemo, useState, type ReactNode } from 'react';
import { createStarterHabits, saveOnboardingProfile } from '../../db/onboarding.ts';
import { todayKey } from '../../util/dates.ts';
import { useHabits } from '../habits/HabitsContext.tsx';
import { useProfile } from '../profile/ProfileContext.tsx';
import { nextSortOrder } from '../habits/model.ts';
import {
  ACTIVITY, DIET_LABEL, STEPS, firstInvalidStep, formFromProfile, goalNotes, goalSentence, habitsFromForm, profileFromForm,
  suggestCalories, validateStep, type Diet, type OnboardingErrors, type OnboardingForm,
} from './model.ts';

function Field(props: { id: string; label: string; error?: string; hint?: string; wide?: boolean; children: ReactNode }) {
  return (
    <div className={`fld${props.wide ? ' wide' : ''}`}>
      <label htmlFor={props.id}>{props.label}</label>
      {props.children}
      {props.error ? <div className="fld-err" role="alert">{props.error}</div> : props.hint ? <div className="fld-hint">{props.hint}</div> : null}
    </div>
  );
}

function Choice<T extends string>({ label, value, options, onChange, error, compact }: {
  label: string;
  value: T | '';
  options: readonly { value: T; label: string; hint?: string }[];
  onChange: (value: T) => void;
  error?: string;
  /** short labels sit side by side instead of one to a row */
  compact?: boolean;
}) {
  const id = `ob-${label.replace(/\W+/g, '-').toLowerCase()}`;
  return (
    <div className="fld wide">
      <label id={id}>{label}</label>
      <div className={`ob-choices${compact ? ' ob-choices-compact' : ''}`} role="group" aria-labelledby={id}>
        {options.map((o) => (
          <button key={o.value} type="button" className="ob-choice" aria-pressed={value === o.value} onClick={() => onChange(o.value)}>
            <span className="ob-choice-label">{o.label}</span>
            {o.hint && <span className="ob-choice-hint">{o.hint}</span>}
          </button>
        ))}
      </div>
      {error && <div className="fld-err" role="alert">{error}</div>}
    </div>
  );
}

function YesNo({ label, value, onChange, error }: { label: string; value: boolean | null; onChange: (value: boolean) => void; error?: string }) {
  return (
    <Choice<'yes' | 'no'> compact label={label} value={value === null ? '' : value ? 'yes' : 'no'} error={error}
      options={[{ value: 'yes', label: 'Yes' }, { value: 'no', label: 'No' }]} onChange={(v) => onChange(v === 'yes')} />
  );
}

/**
 * First-run questions, shown to anyone who has not set up a goal yet. Each step is checked before moving on, the last
 * screen says what will be created, and nothing is saved until Finish.
 */
export function Onboarding({ onSkip }: { onSkip: () => void }) {
  const { profile, reload: reloadProfile } = useProfile();
  const habits = useHabits();
  const today = todayKey();
  const [form, setForm] = useState<OnboardingForm>(() => formFromProfile(profile));
  const [stepIndex, setStepIndex] = useState(0);
  const [errors, setErrors] = useState<OnboardingErrors>({});
  const [busy, setBusy] = useState(false);
  const [failure, setFailure] = useState<string | null>(null);
  const [profileSaved, setProfileSaved] = useState(false);

  const step = STEPS[stepIndex];
  const set = <K extends keyof OnboardingForm>(key: K, value: OnboardingForm[K]) => {
    setForm((f) => ({ ...f, [key]: value }));
    setErrors((e) => (key in e ? { ...e, [key]: undefined } : e));
  };
  const suggested = useMemo(() => suggestCalories(form), [form]);
  const notes = goalNotes(form);
  const alreadyTracked = habits.active.map((h) => h.name);
  const toCreate = habitsFromForm(form, alreadyTracked);
  const sentence = goalSentence(form, today);

  function next() {
    const found = validateStep(step.id, form);
    if (Object.keys(found).length > 0) {
      setErrors(found);
      return;
    }
    setErrors({});
    setStepIndex((i) => Math.min(STEPS.length - 1, i + 1));
    window.scrollTo({ top: 0 });
  }

  function back() {
    setErrors({});
    setStepIndex((i) => Math.max(0, i - 1));
    window.scrollTo({ top: 0 });
  }

  function done() {
    reloadProfile();
    habits.reload();
  }

  async function finish() {
    const bad = firstInvalidStep(form);
    if (bad !== null) {
      setStepIndex(STEPS.findIndex((s) => s.id === bad));
      setErrors(validateStep(bad, form));
      return;
    }
    const values = profileFromForm(form, today);
    if (values === null) return;
    setBusy(true);
    setFailure(null);
    try {
      if (!profileSaved) {
        await saveOnboardingProfile(values);
        setProfileSaved(true);
      }
      await createStarterHabits(toCreate, nextSortOrder(habits.habits));
      done();
    } catch (e) {
      setFailure(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="ob">
      <div className="ob-inner">
        <div className="ob-top">
          <div className="ob-brand">🩺 Health OS</div>
          <button type="button" className="ob-skip" onClick={onSkip}>Skip for now</button>
        </div>
        <div className="ob-progress" role="progressbar" aria-valuemin={1} aria-valuemax={STEPS.length} aria-valuenow={stepIndex + 1} aria-label={`Step ${stepIndex + 1} of ${STEPS.length}`}>
          <div className="ob-progress-fill" style={{ width: `${((stepIndex + 1) / STEPS.length) * 100}%` }} />
        </div>
        <div className="ob-step">Step {stepIndex + 1} of {STEPS.length}</div>

        <form className="card ob-card" noValidate onSubmit={(e) => { e.preventDefault(); if (step.id === 'review') void finish(); else next(); }}>
          <h1 className="ob-title">{step.title}</h1>

          {step.id === 'about' && (
            <div className="form-grid">
              <div className="ob-lead wide">A few basics so your ranges and targets fit you. You can change any of it later.</div>
              <Field id="ob-name" label="What should we call you? (optional)" error={errors.name} wide>
                <input id="ob-name" type="text" autoComplete="given-name" value={form.name} placeholder="Your first name" onChange={(e) => set('name', e.target.value)} />
              </Field>
              <Choice compact label="Sex" value={form.sex} error={errors.sex} onChange={(v) => set('sex', v)}
                options={[{ value: 'male', label: 'Male' }, { value: 'female', label: 'Female' }]} />
              <Field id="ob-age" label="Age" error={errors.age}>
                <input id="ob-age" type="number" inputMode="numeric" min="18" max="120" value={form.age} placeholder="30" onChange={(e) => set('age', e.target.value)} />
              </Field>
              <Field id="ob-height" label="Height (cm)" error={errors.height_cm}>
                <input id="ob-height" type="number" inputMode="decimal" step="0.5" value={form.height_cm} placeholder="175" onChange={(e) => set('height_cm', e.target.value)} />
              </Field>
              <Field id="ob-weight" label="Current weight (kg)" error={errors.weight_kg} wide>
                <input id="ob-weight" type="number" inputMode="decimal" step="0.1" value={form.weight_kg} placeholder="75" onChange={(e) => set('weight_kg', e.target.value)} />
              </Field>
              <Choice label="How active are you?" value={form.activity} error={errors.activity} onChange={(v) => set('activity', v)}
                options={ACTIVITY.map((a) => ({ value: a.value, label: a.label, hint: a.hint }))} />
            </div>
          )}

          {step.id === 'goal' && (
            <div className="form-grid">
              <Choice compact label="What do you want to do?" value={form.direction} error={errors.direction} onChange={(v) => set('direction', v)}
                options={[{ value: 'lose', label: 'Lose weight' }, { value: 'gain', label: 'Gain weight' }, { value: 'maintain', label: 'Keep my weight' }]} />
              {form.direction !== '' && form.direction !== 'maintain' && (
                <Field id="ob-goal-weight" label="Goal weight (kg)" error={errors.goal_weight} hint={`You are at ${form.weight_kg || '?'} kg now.`}>
                  <input id="ob-goal-weight" type="number" inputMode="decimal" step="0.1" value={form.goal_weight} onChange={(e) => set('goal_weight', e.target.value)} />
                </Field>
              )}
              <Field id="ob-weeks" label="Over how many weeks?" error={errors.weeks} hint="Twelve weeks is a common first goal.">
                <input id="ob-weeks" type="number" inputMode="numeric" min="1" max="104" value={form.weeks} onChange={(e) => set('weeks', e.target.value)} />
              </Field>
              <Field id="ob-calories" label="Daily calories (optional)" error={errors.calorie_target} wide
                hint={suggested === null ? 'Fill in the earlier steps to get a suggestion.' : `A starting point from a standard formula is ${suggested.toLocaleString('en-US')} kcal. It is not medical advice.`}>
                <div className="ob-inline">
                  <input id="ob-calories" type="number" inputMode="numeric" value={form.calorie_target} placeholder="2000" onChange={(e) => set('calorie_target', e.target.value)} />
                  <button type="button" className="btn" disabled={suggested === null} onClick={() => set('calorie_target', String(suggested))}>Use the suggestion</button>
                </div>
              </Field>
              {notes.map((n) => <div key={n} className="notice notice-warn wide">{n}</div>)}
            </div>
          )}

          {step.id === 'habits' && (
            <div className="form-grid">
              <div className="ob-lead wide">What you track each day. Your answers set up the starting habits, and you can change them in the Goals tab.</div>
              <YesNo label="Do you smoke?" value={form.smokes} error={errors.smokes} onChange={(v) => set('smokes', v)} />
              <YesNo label="Do you drink alcohol?" value={form.drinks} error={errors.drinks} onChange={(v) => set('drinks', v)} />
              <Choice label="What do you eat?" value={form.diet} error={errors.diet} onChange={(v: Diet) => set('diet', v)}
                options={(Object.keys(DIET_LABEL) as Diet[]).map((d) => ({ value: d, label: DIET_LABEL[d] }))} />
              <Field id="ob-workouts" label="Workouts in a normal week" error={errors.workout_days}>
                <select id="ob-workouts" value={form.workout_days} onChange={(e) => set('workout_days', e.target.value)}>
                  {[0, 1, 2, 3, 4, 5, 6, 7].map((n) => <option key={n} value={String(n)}>{n === 0 ? 'None' : n === 1 ? '1 day' : `${n} days`}</option>)}
                </select>
              </Field>
              <YesNo label="Do you do cardio?" value={form.does_cardio} error={errors.does_cardio} onChange={(v) => set('does_cardio', v)} />
              {form.does_cardio && (
                <Field id="ob-cardio" label="What is it like? (optional)" error={errors.cardio_notes} wide hint="For example stairmaster, running, badminton.">
                  <input id="ob-cardio" type="text" value={form.cardio_notes} placeholder="Stairmaster, 3 times a week" maxLength={200} onChange={(e) => set('cardio_notes', e.target.value)} />
                </Field>
              )}
              <div className="fld wide">
                <div className="check-row">
                  <input id="ob-steps-on" type="checkbox" checked={form.track_steps} onChange={(e) => set('track_steps', e.target.checked)} />
                  <label htmlFor="ob-steps-on">Track my daily steps</label>
                </div>
                {form.track_steps && (
                  <Field id="ob-steps" label="Daily step goal" error={errors.steps_goal}>
                    <input id="ob-steps" type="number" inputMode="numeric" value={form.steps_goal} onChange={(e) => set('steps_goal', e.target.value)} />
                  </Field>
                )}
              </div>
            </div>
          )}

          {step.id === 'day' && (
            <div className="form-grid">
              <div className="ob-lead wide">Optional, in your own words. It helps tailor suggestions later.</div>
              <Field id="ob-typical" label="What does a regular day look like for you?" error={errors.typical_day} wide>
                <textarea id="ob-typical" value={form.typical_day} maxLength={1000} placeholder="Wake at 7, desk job, dinner around 9, little walking..." onChange={(e) => set('typical_day', e.target.value)} />
              </Field>
              <Field id="ob-desired" label="What do you want it to look like?" error={errors.desired_day} wide>
                <textarea id="ob-desired" value={form.desired_day} maxLength={1000} placeholder="A morning walk, earlier dinner, lifting after work..." onChange={(e) => set('desired_day', e.target.value)} />
              </Field>
            </div>
          )}

          {step.id === 'review' && (
            <div>
              <ul className="ob-review">
                <li><strong>Your goal</strong><span>{sentence ?? 'Not set yet'}{form.calorie_target ? ` Around ${Number(form.calorie_target).toLocaleString('en-US')} kcal a day.` : ''}</span></li>
                <li><strong>You will track</strong><span>{toCreate.length > 0 ? toCreate.map((h) => h.name).join(', ') : 'Nothing new. Add habits any time in the Goals tab.'}</span></li>
                <li><strong>Bloodwork</strong><span>Your blood test results go in the Bloodwork tab. Uploading a report is coming soon. When you get tests, it helps to book the same full panel each time so your history lines up.</span></li>
                <li><strong>Supplements</strong><span>Add anything you take in the Supplements tab and it shows on your daily checklist.</span></li>
              </ul>
              {failure && (
                <div className="notice notice-bad" role="alert">
                  {profileSaved ? 'Your answers were saved, but the habits could not be added: ' : 'Could not save: '}{failure}
                  {profileSaved && <> <button type="button" className="retry-btn" onClick={done}>Continue without them</button></>}
                </div>
              )}
            </div>
          )}

          <div className="btn-row ob-nav">
            {stepIndex > 0 && <button type="button" className="btn" onClick={back} disabled={busy}>Back</button>}
            <button type="submit" className="btn btn-primary ob-next" disabled={busy}>
              {step.id === 'review' ? (busy ? 'Saving…' : failure ? 'Try again' : 'Finish') : 'Next'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
