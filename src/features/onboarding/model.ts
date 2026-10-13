import type { HabitInput } from '../../db/habits.ts';
import type { Profile } from '../../db/profile.ts';
import { ageOn } from '../../lib/age.ts';
import { dayNumber, isoDay } from '../../lib/dates.ts';
import { ACTIVITY, calorieSuggestion, paceOf, proteinSuggestion, type Activity, type Advice } from '../../lib/nutrition.ts';
import type { Direction } from '../../lib/programme.ts';
import { normalizeSex, type Sex } from '../../lib/sex.ts';
import { LIMITS, summarizeGoal } from '../goals/model.ts';
import { PRESETS } from '../habits/model.ts';

export { ACTIVITY, type Activity };
export type Diet = 'vegetarian' | 'non_vegetarian' | 'vegan' | 'other';

export const DIET_LABEL: Record<Diet, string> = {
  vegetarian: 'Vegetarian', non_vegetarian: 'Non-vegetarian', vegan: 'Vegan', other: 'Something else',
};

export const MIN_AGE = 18;
export const MAX_AGE = 120;
/** The pace used for a suggestion when the goal does not say one (a goal with no weeks, or keeping weight). */
const DEFAULT_PACE_KG_PER_WEEK = 0.5;
export const HEIGHT_CM = { min: 100, max: 250 } as const;
export const MAX_WEEKS = 104;
export const STEP_GOAL = { min: 1000, max: 100000 } as const;
export const MAX_DAY_TEXT = 1000;
export const MAX_CARDIO_TEXT = 200;
export const MAX_NAME = 40;

export type StepId = 'about' | 'goal' | 'habits' | 'day' | 'review';
export const STEPS: readonly { id: StepId; title: string }[] = [
  { id: 'about', title: 'About you' },
  { id: 'goal', title: 'Your goal' },
  { id: 'habits', title: 'Your habits' },
  { id: 'day', title: 'Your day' },
  { id: 'review', title: 'All set' },
];

export interface OnboardingForm {
  name: string;
  sex: Sex | '';
  /** 'YYYY-MM-DD'. The age is always worked out from it, so it rolls over on the birthday */
  date_of_birth: string;
  height_cm: string;
  weight_kg: string;
  activity: Activity | '';
  direction: Direction | '';
  goal_weight: string;
  weeks: string;
  calorie_target: string;
  protein_target: string;
  smokes: boolean | null;
  drinks: boolean | null;
  workout_days: string;
  does_cardio: boolean | null;
  cardio_notes: string;
  diet: Diet | '';
  track_steps: boolean;
  steps_goal: string;
  typical_day: string;
  desired_day: string;
}

export const EMPTY_ONBOARDING: OnboardingForm = {
  name: '', sex: '', date_of_birth: '', height_cm: '', weight_kg: '', activity: '', direction: '', goal_weight: '', weeks: '12', calorie_target: '', protein_target: '',
  smokes: null, drinks: null, workout_days: '3', does_cardio: null, cardio_notes: '', diet: '', track_steps: true, steps_goal: '8000',
  typical_day: '', desired_day: '',
};

export type OnboardingErrors = Partial<Record<keyof OnboardingForm, string>>;

const text = (v: unknown): string => (v == null ? '' : String(v));

/** Someone who has set a goal, or finished onboarding, goes straight to the dashboard. */
export function needsOnboarding(profile: Pick<Profile, 'onboarded' | 'start_weight' | 'goal_weight' | 'goal_date'> | null): boolean {
  if (profile === null) return true;
  if (profile.onboarded === true) return false;
  return !(profile.start_weight != null && profile.goal_weight != null && profile.goal_date != null);
}

/** Whatever the profile already holds, so nobody is asked twice. Someone who only ever gave an age is asked for the date. */
export function formFromProfile(profile: Profile | null): OnboardingForm {
  if (!profile) return { ...EMPTY_ONBOARDING };
  const activity = ACTIVITY.find((a) => a.value === profile.activity_level)?.value ?? '';
  const diet = (Object.keys(DIET_LABEL) as Diet[]).find((d) => d === profile.diet) ?? '';
  return {
    ...EMPTY_ONBOARDING,
    name: text(profile.name),
    sex: normalizeSex(profile.sex),
    date_of_birth: text(profile.date_of_birth),
    height_cm: text(profile.height_cm),
    weight_kg: text(profile.start_weight),
    activity,
    diet,
    workout_days: profile.workout_days_per_week == null ? EMPTY_ONBOARDING.workout_days : text(profile.workout_days_per_week),
    does_cardio: profile.cardio_notes ? true : null,
    cardio_notes: text(profile.cardio_notes),
    calorie_target: text(profile.calorie_target),
    protein_target: text(profile.protein_target),
    typical_day: text(profile.typical_day),
    desired_day: text(profile.desired_day),
  };
}

function number(raw: string): number | null {
  if (raw.trim() === '') return null;
  const n = Number(raw.trim());
  return Number.isFinite(n) ? n : Number.NaN;
}

/** today is passed in, never read, so the age check does not depend on the clock. */
export function validateStep(step: StepId, form: OnboardingForm, today: string): OnboardingErrors {
  const e: OnboardingErrors = {};
  if (step === 'about') {
    if (form.name.trim().length > MAX_NAME) e.name = `Keep it under ${MAX_NAME + 1} characters`;
    if (form.sex === '') e.sex = 'Choose male or female. Some health checks and ranges depend on it.';
    if (form.date_of_birth.trim() === '') e.date_of_birth = 'Enter your date of birth';
    else {
      const age = ageOn(form.date_of_birth.trim(), today);
      if (age === null) e.date_of_birth = 'Enter a real date of birth, not in the future';
      else if (age > MAX_AGE) e.date_of_birth = `Enter a date of birth that makes you ${MAX_AGE} or younger`;
      else if (age < MIN_AGE) e.date_of_birth = `This app is built for adults, ${MIN_AGE} and over`;
    }
    const height = number(form.height_cm);
    if (height === null) e.height_cm = 'Enter your height in centimetres';
    else if (Number.isNaN(height) || height < HEIGHT_CM.min || height > HEIGHT_CM.max) e.height_cm = `Enter a height between ${HEIGHT_CM.min} and ${HEIGHT_CM.max} cm`;
    const weight = number(form.weight_kg);
    if (weight === null) e.weight_kg = 'Enter your current weight in kg';
    else if (Number.isNaN(weight) || weight < LIMITS.weightKg.min || weight > LIMITS.weightKg.max) e.weight_kg = `Enter a weight between ${LIMITS.weightKg.min} and ${LIMITS.weightKg.max} kg`;
    if (form.activity === '') e.activity = 'Choose how active you are';
  }

  if (step === 'goal') {
    const weight = number(form.weight_kg);
    if (form.direction === '') e.direction = 'Choose what you want to do';
    const weeks = number(form.weeks);
    if (weeks === null) e.weeks = 'Enter how many weeks';
    else if (!Number.isInteger(weeks) || Number.isNaN(weeks) || weeks < 1 || weeks > MAX_WEEKS) e.weeks = `Enter a whole number of weeks from 1 to ${MAX_WEEKS}`;
    if (form.direction !== '' && form.direction !== 'maintain') {
      const goal = number(form.goal_weight);
      if (goal === null) e.goal_weight = 'Enter your goal weight in kg';
      else if (Number.isNaN(goal) || goal < LIMITS.weightKg.min || goal > LIMITS.weightKg.max) e.goal_weight = `Enter a weight between ${LIMITS.weightKg.min} and ${LIMITS.weightKg.max} kg`;
      else if (weight !== null && !Number.isNaN(weight)) {
        if (form.direction === 'lose' && goal >= weight) e.goal_weight = 'To lose weight, your goal must be below your current weight';
        if (form.direction === 'gain' && goal <= weight) e.goal_weight = 'To gain weight, your goal must be above your current weight';
      }
    }
    const cals = number(form.calorie_target);
    if (cals !== null && (Number.isNaN(cals) || !Number.isInteger(cals) || cals < LIMITS.calories.min || cals > LIMITS.calories.max)) {
      e.calorie_target = `Calories must be a whole number from ${LIMITS.calories.min} to ${LIMITS.calories.max.toLocaleString('en-US')}, or leave it blank`;
    }
    const protein = number(form.protein_target);
    if (protein !== null && (Number.isNaN(protein) || !Number.isInteger(protein) || protein < LIMITS.proteinG.min || protein > LIMITS.proteinG.max)) {
      e.protein_target = `Protein must be a whole number from ${LIMITS.proteinG.min} to ${LIMITS.proteinG.max} g, or leave it blank`;
    }
  }

  if (step === 'habits') {
    if (form.smokes === null) e.smokes = 'Choose yes or no';
    if (form.drinks === null) e.drinks = 'Choose yes or no';
    const days = number(form.workout_days);
    if (days === null || !Number.isInteger(days) || Number.isNaN(days) || days < 0 || days > 7) e.workout_days = 'Choose 0 to 7 days';
    if (form.does_cardio === null) e.does_cardio = 'Choose yes or no';
    if (form.cardio_notes.length > MAX_CARDIO_TEXT) e.cardio_notes = `Keep it under ${MAX_CARDIO_TEXT + 1} characters`;
    if (form.diet === '') e.diet = 'Choose the one closest to how you eat';
    if (form.track_steps) {
      const steps = number(form.steps_goal);
      if (steps === null || !Number.isInteger(steps) || Number.isNaN(steps) || steps < STEP_GOAL.min || steps > STEP_GOAL.max) {
        e.steps_goal = `Enter a daily step goal from ${STEP_GOAL.min.toLocaleString('en-US')} to ${STEP_GOAL.max.toLocaleString('en-US')}`;
      }
    }
  }

  if (step === 'day') {
    if (form.typical_day.length > MAX_DAY_TEXT) e.typical_day = `Keep it under ${MAX_DAY_TEXT + 1} characters`;
    if (form.desired_day.length > MAX_DAY_TEXT) e.desired_day = `Keep it under ${MAX_DAY_TEXT + 1} characters`;
  }
  return e;
}

/** The first earlier step that still has a problem, or null when every step is fine. */
export function firstInvalidStep(form: OnboardingForm, today: string): StepId | null {
  for (const { id } of STEPS) if (Object.keys(validateStep(id, form, today)).length > 0) return id;
  return null;
}

/**
 * Calories and protein to start from, worked out with the Mifflin-St Jeor formula from the answers so far. The pace
 * comes from the goal (kilograms to move over the weeks given) so a bigger goal asks for a bigger change, up to the cap
 * in lib/nutrition.ts. Null until sex, date of birth, height, weight, activity and a direction are all filled in.
 */
export function adviceFor(
  form: Pick<OnboardingForm, 'sex' | 'date_of_birth' | 'height_cm' | 'weight_kg' | 'activity' | 'direction' | 'goal_weight' | 'weeks'>,
  today: string,
): Advice | null {
  const age = ageOn(form.date_of_birth.trim(), today);
  const height = number(form.height_cm);
  const weight = number(form.weight_kg);
  if (form.sex === '' || form.activity === '' || form.direction === '' || age === null) return null;
  if (height === null || weight === null || [height, weight].some(Number.isNaN)) return null;
  let pace = form.direction === 'maintain' ? 0 : DEFAULT_PACE_KG_PER_WEEK;
  if (form.direction !== 'maintain') {
    const goal = number(form.goal_weight);
    const weeks = number(form.weeks);
    const implied = goal === null || weeks === null ? null : paceOf(weight, goal, weeks);
    if (implied !== null && implied > 0) pace = implied;
  }
  const calories = calorieSuggestion({ sex: form.sex, weightKg: weight, heightCm: height, ageYears: age }, form.activity, form.direction, pace);
  if (calories === null) return null;
  return { calories, protein: proteinSuggestion(weight, form.activity), paceKgPerWeek: pace, age, activity: form.activity, direction: form.direction };
}

/** Just the daily calories of adviceFor, clamped to what the form accepts. */
export function suggestCalories(form: Parameters<typeof adviceFor>[0], today: string): number | null {
  const advice = adviceFor(form, today);
  if (advice === null) return null;
  return Math.min(LIMITS.calories.max, Math.max(LIMITS.calories.min, advice.calories.target));
}

/** Notes worth knowing that do not stop anyone. */
export function goalNotes(form: OnboardingForm): string[] {
  const notes: string[] = [];
  const weight = number(form.weight_kg);
  const goal = number(form.goal_weight);
  const weeks = number(form.weeks);
  if (form.direction === 'lose' || form.direction === 'gain') {
    if (weight !== null && goal !== null && weeks !== null && ![weight, goal, weeks].some(Number.isNaN) && weeks > 0) {
      const perWeek = Math.abs(goal - weight) / weeks;
      if (perWeek > 1) notes.push(`That is ${perWeek.toFixed(1)} kg a week. A steadier pace, around 0.25 to 1 kg a week, is easier to keep up. You can change it later.`);
    }
  }
  return notes;
}

/** The weight the goal aims for: the typed goal, or the current weight when the aim is to keep it. */
export function goalWeightForDirection(form: OnboardingForm): number | null {
  if (form.direction === 'maintain') return number(form.weight_kg);
  return number(form.goal_weight);
}

export interface OnboardingProfile {
  name: string | null;
  date_of_birth: string;
  /** worked out from the date on the day of saving; the app always recomputes it from the date afterwards */
  age: number;
  sex: Sex;
  height_cm: number;
  start_weight: number;
  goal_weight: number;
  start_date: string;
  goal_date: string;
  calorie_target: number | null;
  protein_target: number | null;
  activity_level: Activity;
  diet: Diet;
  workout_days_per_week: number;
  cardio_notes: string | null;
  typical_day: string | null;
  desired_day: string | null;
  onboarded: true;
}

/** The profile columns the wizard writes, or null while any step is still invalid. today is passed in, never read. */
export function profileFromForm(form: OnboardingForm, today: string): OnboardingProfile | null {
  if (firstInvalidStep(form, today) !== null || form.sex === '' || form.activity === '' || form.diet === '') return null;
  const weight = number(form.weight_kg) as number;
  const goal = goalWeightForDirection(form) as number;
  const weeks = number(form.weeks) as number;
  const calories = number(form.calorie_target);
  const protein = number(form.protein_target);
  const orNull = (s: string) => (s.trim() === '' ? null : s.trim());
  return {
    name: orNull(form.name),
    date_of_birth: form.date_of_birth.trim(),
    age: ageOn(form.date_of_birth.trim(), today) as number,
    sex: form.sex,
    height_cm: number(form.height_cm) as number,
    start_weight: weight,
    goal_weight: goal,
    start_date: today,
    goal_date: isoDay(dayNumber(today) + weeks * 7),
    calorie_target: calories,
    protein_target: protein,
    activity_level: form.activity,
    diet: form.diet,
    workout_days_per_week: number(form.workout_days) as number,
    cardio_notes: form.does_cardio ? orNull(form.cardio_notes) : null,
    typical_day: orNull(form.typical_day),
    desired_day: orNull(form.desired_day),
    onboarded: true,
  };
}

const preset = (name: string): HabitInput => {
  const found = PRESETS.find((p) => p.value.name === name);
  if (!found) throw new Error(`No habit preset called ${name}`);
  return { ...found.value };
};

/** The habits the answers imply, leaving out any the person already tracks (by name, any case). */
export function habitsFromForm(form: OnboardingForm, alreadyTracked: readonly string[] = []): HabitInput[] {
  const out: HabitInput[] = [];
  if (form.smokes) out.push(preset('Cigarettes'));
  if (form.drinks) out.push(preset('Drinks'));
  if ((number(form.workout_days) ?? 0) > 0) out.push(preset('Lift'));
  if (form.does_cardio) out.push(preset('Cardio'));
  if (form.track_steps) out.push({ ...preset('Steps'), goal: number(form.steps_goal) });
  const taken = new Set(alreadyTracked.map((n) => n.trim().toLowerCase()));
  return out.filter((h) => !taken.has(h.name.trim().toLowerCase()));
}

/** One plain sentence about the goal, for the last screen. */
export function goalSentence(form: OnboardingForm, today: string): string | null {
  const values = profileFromForm(form, today);
  if (!values) return null;
  return summarizeGoal({
    start_weight: String(values.start_weight), goal_weight: String(values.goal_weight), start_date: values.start_date,
    goal_date: values.goal_date, calorie_target: '', protein_target: '',
  });
}
