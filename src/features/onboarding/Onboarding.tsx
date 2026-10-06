import { useMemo, useState, type ReactNode } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { ArrowLeft, ArrowRight, Check } from 'lucide-react';
import { Brand } from '@/components/brand';
import { AsciiArt, type AsciiShape } from '@/components/ui/ascii-art';
import { Button } from '@/components/ui/button';
import { Field } from '@/components/ui/field';
import { Stepper } from '@/components/ui/stepper';
import { cn } from '@/lib/utils';
import { createStarterHabits, saveOnboardingProfile } from '../../db/onboarding.ts';
import { todayKey } from '../../util/dates.ts';
import { useHabits } from '../habits/HabitsContext.tsx';
import { useProfile } from '../profile/ProfileContext.tsx';
import { nextSortOrder } from '../habits/model.ts';
import {
  ACTIVITY, DIET_LABEL, STEPS, firstInvalidStep, formFromProfile, goalNotes, goalSentence, habitsFromForm, profileFromForm,
  suggestCalories, validateStep, type Diet, type OnboardingErrors, type OnboardingForm, type StepId,
} from './model.ts';

/** What each step is for, shown under its title so nobody wonders why a question is asked. */
const STEP_COPY: Record<StepId, { short: string; why: string; art: AsciiShape }> = {
  about: { short: 'Body basics', why: 'So ranges and calorie targets fit you. You can change any of it later.', art: 'sphere' },
  goal: { short: 'Target and pace', why: 'One clear target gives the dashboard something to measure against.', art: 'ring' },
  habits: { short: 'What to track', why: 'Your answers set up the daily checklist. Edit it any time under Goals.', art: 'capsule' },
  day: { short: 'Optional', why: 'In your own words. It helps tailor suggestions later, and both can stay empty.', art: 'drop' },
  review: { short: 'Review', why: 'Nothing is saved until you press Finish.', art: 'heart' },
};

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
    <div className="col-span-full">
      <label id={id}>{label}</label>
      <div className={cn('grid gap-2', compact ? 'grid-cols-[repeat(auto-fit,minmax(110px,1fr))]' : 'grid-cols-1 sm:grid-cols-2')} role="group" aria-labelledby={id}>
        {options.map((o) => {
          const on = value === o.value;
          return (
            <button
              key={o.value}
              type="button"
              aria-pressed={on}
              onClick={() => onChange(o.value)}
              className={cn(
                'group flex min-h-12 items-start justify-between gap-3 rounded-[10px] border px-3.5 py-3 text-left transition-colors',
                on ? 'border-ink bg-ink text-paper' : 'border-line-strong bg-surface-2 text-ink hover:border-ink',
              )}
            >
              <span className="min-w-0">
                <span className="block text-sm font-medium">{o.label}</span>
                {o.hint && <span className={cn('mt-0.5 block text-xs leading-snug', on ? 'text-paper/70' : 'text-ink-3')}>{o.hint}</span>}
              </span>
              <span className={cn('mt-0.5 flex size-4 shrink-0 items-center justify-center rounded-full border', on ? 'border-paper bg-paper text-ink' : 'border-line-strong')} aria-hidden="true">
                {on && <Check className="size-3" strokeWidth={3} />}
              </span>
            </button>
          );
        })}
      </div>
      {error && <div className="mt-1.5 text-xs text-primary" role="alert">{error}</div>}
    </div>
  );
}

function YesNo({ label, value, onChange, error }: { label: string; value: boolean | null; onChange: (value: boolean) => void; error?: string }) {
  return (
    <Choice<'yes' | 'no'> compact label={label} value={value === null ? '' : value ? 'yes' : 'no'} error={error}
      options={[{ value: 'yes', label: 'Yes' }, { value: 'no', label: 'No' }]} onChange={(v) => onChange(v === 'yes')} />
  );
}

function ReviewRow({ label, children }: { label: string; children: ReactNode }) {
  return (
    <li className="grid gap-1 border-b border-line py-4 last:border-b-0 sm:grid-cols-[160px_1fr] sm:gap-6">
      <span className="font-mono text-[11px] tracking-[0.08em] text-ink-3 uppercase">{label}</span>
      <span className="text-sm leading-relaxed text-ink">{children}</span>
    </li>
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
  const reduced = useReducedMotion();
  const [form, setForm] = useState<OnboardingForm>(() => formFromProfile(profile));
  const [stepIndex, setStepIndex] = useState(0);
  const [direction, setDirection] = useState(1);
  const [errors, setErrors] = useState<OnboardingErrors>({});
  const [busy, setBusy] = useState(false);
  const [failure, setFailure] = useState<string | null>(null);
  const [profileSaved, setProfileSaved] = useState(false);

  const step = STEPS[stepIndex];
  const copy = STEP_COPY[step.id];
  const set = <K extends keyof OnboardingForm>(key: K, value: OnboardingForm[K]) => {
    setForm((f) => ({ ...f, [key]: value }));
    setErrors((e) => (key in e ? { ...e, [key]: undefined } : e));
  };
  const suggested = useMemo(() => suggestCalories(form), [form]);
  const notes = goalNotes(form);
  const alreadyTracked = habits.active.map((h) => h.name);
  const toCreate = habitsFromForm(form, alreadyTracked);
  const sentence = goalSentence(form, today);

  function go(to: number) {
    setDirection(to > stepIndex ? 1 : -1);
    setStepIndex(to);
    window.scrollTo({ top: 0, behavior: reduced ? 'auto' : 'smooth' });
  }

  function next() {
    const found = validateStep(step.id, form);
    if (Object.keys(found).length > 0) {
      setErrors(found);
      return;
    }
    setErrors({});
    go(Math.min(STEPS.length - 1, stepIndex + 1));
  }

  function back() {
    setErrors({});
    go(Math.max(0, stepIndex - 1));
  }

  function done() {
    reloadProfile();
    habits.reload();
  }

  async function finish() {
    const bad = firstInvalidStep(form);
    if (bad !== null) {
      go(STEPS.findIndex((s) => s.id === bad));
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
    <div className="relative z-10 mx-auto flex min-h-dvh w-full max-w-5xl flex-col px-5 pt-6 pb-16 sm:px-8">
      <header className="on-dots flex items-center justify-between">
        <Brand />
        <Button variant="ghost" size="sm" onClick={onSkip}>Skip for now</Button>
      </header>

      <div className="on-dots mt-10 sm:mt-14">
        <div className="mb-4 flex items-baseline justify-between font-mono text-[11px] tracking-[0.08em] text-ink-3 uppercase sm:hidden">
          <span>Step {stepIndex + 1} of {STEPS.length}</span>
          <span>{copy.short}</span>
        </div>
        <div className="mb-6 grid grid-cols-5 gap-1 sm:hidden" aria-hidden="true">
          {STEPS.map((s, i) => <span key={s.id} className={cn('h-1 rounded-full', i <= stepIndex ? 'bg-primary' : 'bg-ink/10')} />)}
        </div>
        <Stepper
          className="hidden sm:grid"
          currentStep={stepIndex}
          steps={STEPS.map((s) => ({ id: s.id, title: s.title, description: STEP_COPY[s.id].short }))}
        />
      </div>

      <form
        className="card mt-8 overflow-hidden p-0 sm:mt-10"
        noValidate
        onSubmit={(e) => { e.preventDefault(); if (step.id === 'review') void finish(); else next(); }}
      >
        <div className="grid lg:grid-cols-[260px_1fr]">
          <aside className="hidden flex-col justify-between border-r border-line bg-surface-3/60 p-8 lg:flex">
            <div>
              <div className="font-mono text-[11px] tracking-[0.08em] text-ink-3 uppercase">Step {String(stepIndex + 1).padStart(2, '0')} / {String(STEPS.length).padStart(2, '0')}</div>
              <p className="mt-3 text-sm leading-relaxed text-ink-2">{copy.why}</p>
            </div>
            <AsciiArt key={copy.art} shape={copy.art} cols={30} rows={15} className="self-center text-[10px] text-ink/70" />
          </aside>

          <div className="p-6 sm:p-10">
            <AnimatePresence mode="wait" initial={false} custom={direction}>
              <motion.div
                key={step.id}
                custom={direction}
                initial={reduced ? false : { opacity: 0, x: 16 * direction }}
                animate={{ opacity: 1, x: 0 }}
                exit={reduced ? undefined : { opacity: 0, x: -16 * direction }}
                transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
              >
                <h1 className="text-[28px] leading-tight font-semibold tracking-[-0.02em] sm:text-[32px]">{step.title}</h1>
                <p className="mt-2 text-sm leading-relaxed text-ink-2 lg:hidden">{copy.why}</p>

                <div className="mt-8">
                  {step.id === 'about' && (
                    <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
                      <Field id="ob-name" label="What should we call you? (optional)" error={errors.name} className="col-span-full">
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
                      <Field id="ob-weight" label="Current weight (kg)" error={errors.weight_kg} className="col-span-full sm:col-span-1">
                        <input id="ob-weight" type="number" inputMode="decimal" step="0.1" value={form.weight_kg} placeholder="75" onChange={(e) => set('weight_kg', e.target.value)} />
                      </Field>
                      <Choice label="How active are you?" value={form.activity} error={errors.activity} onChange={(v) => set('activity', v)}
                        options={ACTIVITY.map((a) => ({ value: a.value, label: a.label, hint: a.hint }))} />
                    </div>
                  )}

                  {step.id === 'goal' && (
                    <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
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
                      <Field id="ob-calories" label="Daily calories (optional)" error={errors.calorie_target} className="col-span-full"
                        hint={suggested === null ? 'Fill in the earlier steps to get a suggestion.' : `A starting point from a standard formula is ${suggested.toLocaleString('en-US')} kcal. It is not medical advice.`}>
                        <div className="flex flex-wrap gap-2">
                          <input id="ob-calories" className="min-w-0 flex-1 basis-40" type="number" inputMode="numeric" value={form.calorie_target} placeholder="2000" onChange={(e) => set('calorie_target', e.target.value)} />
                          <Button disabled={suggested === null} onClick={() => set('calorie_target', String(suggested))}>Use the suggestion</Button>
                        </div>
                      </Field>
                      {notes.map((n) => <div key={n} className="notice notice-warn col-span-full mt-0">{n}</div>)}
                    </div>
                  )}

                  {step.id === 'habits' && (
                    <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
                      <YesNo label="Do you smoke?" value={form.smokes} error={errors.smokes} onChange={(v) => set('smokes', v)} />
                      <YesNo label="Do you drink alcohol?" value={form.drinks} error={errors.drinks} onChange={(v) => set('drinks', v)} />
                      <Choice compact label="What do you eat?" value={form.diet} error={errors.diet} onChange={(v: Diet) => set('diet', v)}
                        options={(Object.keys(DIET_LABEL) as Diet[]).map((d) => ({ value: d, label: DIET_LABEL[d] }))} />
                      <Field id="ob-workouts" label="Workouts in a normal week" error={errors.workout_days}>
                        <select id="ob-workouts" value={form.workout_days} onChange={(e) => set('workout_days', e.target.value)}>
                          {[0, 1, 2, 3, 4, 5, 6, 7].map((n) => <option key={n} value={String(n)}>{n === 0 ? 'None' : n === 1 ? '1 day' : `${n} days`}</option>)}
                        </select>
                      </Field>
                      <YesNo label="Do you do cardio?" value={form.does_cardio} error={errors.does_cardio} onChange={(v) => set('does_cardio', v)} />
                      {form.does_cardio && (
                        <Field id="ob-cardio" label="What is it like? (optional)" error={errors.cardio_notes} className="col-span-full" hint="For example stairmaster, running, badminton.">
                          <input id="ob-cardio" type="text" value={form.cardio_notes} placeholder="Stairmaster, 3 times a week" maxLength={200} onChange={(e) => set('cardio_notes', e.target.value)} />
                        </Field>
                      )}
                      <div className="col-span-full grid gap-3 sm:grid-cols-2">
                        <div className="check-row self-end">
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
                    <div className="grid gap-5">
                      <Field id="ob-typical" label="What does a regular day look like for you?" error={errors.typical_day}>
                        <textarea id="ob-typical" value={form.typical_day} maxLength={1000} placeholder="Wake at 7, desk job, dinner around 9, little walking" onChange={(e) => set('typical_day', e.target.value)} />
                      </Field>
                      <Field id="ob-desired" label="What do you want it to look like?" error={errors.desired_day}>
                        <textarea id="ob-desired" value={form.desired_day} maxLength={1000} placeholder="A morning walk, earlier dinner, lifting after work" onChange={(e) => set('desired_day', e.target.value)} />
                      </Field>
                    </div>
                  )}

                  {step.id === 'review' && (
                    <div>
                      <ul>
                        <ReviewRow label="Your goal">{sentence ?? 'Not set yet'}{form.calorie_target ? ` Around ${Number(form.calorie_target).toLocaleString('en-US')} kcal a day.` : ''}</ReviewRow>
                        <ReviewRow label="You will track">{toCreate.length > 0 ? toCreate.map((h) => h.name).join(', ') : 'Nothing new. Add habits any time under Goals.'}</ReviewRow>
                        <ReviewRow label="Bloodwork">Add results from your lab report in the Bloodwork section. Booking the same full panel each time keeps your history comparable.</ReviewRow>
                        <ReviewRow label="Supplements">Add anything you take in the Supplements section and it appears on your daily checklist.</ReviewRow>
                      </ul>
                      {failure && (
                        <div className="notice notice-bad" role="alert">
                          {profileSaved ? 'Your answers were saved, but the habits could not be added: ' : 'Could not save: '}{failure}
                          {profileSaved && <> <button type="button" className="underline underline-offset-2" onClick={done}>Continue without them</button></>}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </motion.div>
            </AnimatePresence>

            <div className="mt-10 flex items-center justify-between gap-3 border-t border-line pt-6">
              {stepIndex > 0 ? (
                <Button variant="ghost" onClick={back} disabled={busy}><ArrowLeft className="size-4" aria-hidden="true" />Back</Button>
              ) : <span />}
              <Button type="submit" variant="primary" size="lg" disabled={busy} className="min-w-36">
                {step.id === 'review' ? (busy ? 'Saving' : failure ? 'Try again' : 'Finish') : 'Continue'}
                {!busy && step.id !== 'review' && <ArrowRight className="size-4" aria-hidden="true" />}
              </Button>
            </div>
          </div>
        </div>
      </form>
    </div>
  );
}
