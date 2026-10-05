import type { GoalValues } from '../../db/profile.ts';
import { dayNumber } from '../../lib/dates.ts';
import type { GoalFields } from '../../lib/programme.ts';
import { directionOf } from '../../lib/programme.ts';

export interface GoalsForm {
  start_weight: string;
  goal_weight: string;
  start_date: string;
  goal_date: string;
  calorie_target: string;
  protein_target: string;
  step_target: string;
}

export const EMPTY_GOALS_FORM: GoalsForm = {
  start_weight: '', goal_weight: '', start_date: '', goal_date: '', calorie_target: '', protein_target: '', step_target: '',
};

export const LIMITS = {
  weightKg: { min: 20, max: 400 },
  calories: { min: 800, max: 6000 },
  proteinG: { min: 0, max: 500 },
  steps: { min: 0, max: 100000 },
} as const;

const text = (v: unknown): string => (v == null ? '' : String(v));

export function formFromProfile(fields: GoalFields | null | undefined): GoalsForm {
  if (!fields) return { ...EMPTY_GOALS_FORM };
  return {
    start_weight: text(fields.start_weight),
    goal_weight: text(fields.goal_weight),
    start_date: text(fields.start_date),
    goal_date: text(fields.goal_date),
    calorie_target: text(fields.calorie_target),
    protein_target: text(fields.protein_target),
    step_target: text(fields.step_target),
  };
}

export type GoalsErrors = Partial<Record<keyof GoalsForm, string>>;

export type GoalsResult =
  | { ok: true; value: GoalValues; notes: string[] }
  | { ok: false; errors: GoalsErrors };

function parseNumber(raw: string): number | null {
  const trimmed = raw.trim();
  if (trimmed === '') return null;
  const n = Number(trimmed);
  return Number.isFinite(n) ? n : Number.NaN;
}

function weightError(raw: string, label: string): { value: number | null; error?: string } {
  const n = parseNumber(raw);
  const { min, max } = LIMITS.weightKg;
  if (n === null) return { value: null, error: `Enter your ${label}` };
  if (Number.isNaN(n) || n < min || n > max) return { value: null, error: `Enter a weight between ${min} and ${max} kg` };
  return { value: n };
}

function dateError(raw: string, label: string): { value: string | null; error?: string } {
  const trimmed = raw.trim();
  if (trimmed === '') return { value: null, error: `Choose the ${label}` };
  try {
    dayNumber(trimmed);
    return { value: trimmed };
  } catch {
    return { value: null, error: `The ${label} is not a valid date` };
  }
}

function optionalWhole(raw: string, min: number, max: number, label: string): { value: number | null; error?: string } {
  const n = parseNumber(raw);
  if (n === null) return { value: null };
  if (Number.isNaN(n) || !Number.isInteger(n) || n < min || n > max) {
    return { value: null, error: `${label} must be a whole number from ${min.toLocaleString('en-US')} to ${max.toLocaleString('en-US')}` };
  }
  return { value: n };
}

/**
 * Turns the form into values for the profile row, or says what is wrong. Notes are things worth knowing that do
 * not stop a save. today is passed in so the result never depends on the clock.
 */
export function validateGoalsForm(form: GoalsForm, today: string): GoalsResult {
  const errors: GoalsErrors = {};
  const notes: string[] = [];

  const startWeight = weightError(form.start_weight, 'starting weight');
  const goalWeight = weightError(form.goal_weight, 'goal weight');
  const startDate = dateError(form.start_date, 'start date');
  const goalDate = dateError(form.goal_date, 'goal date');
  const calories = optionalWhole(form.calorie_target, LIMITS.calories.min, LIMITS.calories.max, 'Calories');
  const protein = optionalWhole(form.protein_target, LIMITS.proteinG.min, LIMITS.proteinG.max, 'Protein');
  const steps = optionalWhole(form.step_target, LIMITS.steps.min, LIMITS.steps.max, 'Steps');

  if (startWeight.error) errors.start_weight = startWeight.error;
  if (goalWeight.error) errors.goal_weight = goalWeight.error;
  if (startDate.error) errors.start_date = startDate.error;
  if (goalDate.error) errors.goal_date = goalDate.error;
  if (calories.error) errors.calorie_target = calories.error;
  if (protein.error) errors.protein_target = protein.error;
  if (steps.error) errors.step_target = steps.error;

  if (startDate.value && goalDate.value && !errors.goal_date && dayNumber(goalDate.value) <= dayNumber(startDate.value)) {
    errors.goal_date = 'The goal date must be after the start date';
  }

  if (Object.keys(errors).length > 0) return { ok: false, errors };

  // all present once there are no errors
  const value: GoalValues = {
    start_weight: startWeight.value as number,
    goal_weight: goalWeight.value as number,
    start_date: startDate.value as string,
    goal_date: goalDate.value as string,
    calorie_target: calories.value,
    protein_target: protein.value,
    step_target: steps.value,
  };
  if (dayNumber(value.goal_date) < dayNumber(today)) notes.push('This goal date has already passed. You can still save it, or start a new goal.');
  if (directionOf(value.start_weight, value.goal_weight) === 'maintain') notes.push('The two weights are the same, so this goal is about keeping your weight steady.');
  return { ok: true, value, notes };
}

/** One plain sentence about the goal as typed so far, or null until the weights and dates make sense. */
export function summarizeGoal(form: GoalsForm): string | null {
  const start = parseNumber(form.start_weight);
  const goal = parseNumber(form.goal_weight);
  if (start === null || goal === null || Number.isNaN(start) || Number.isNaN(goal) || start <= 0 || goal <= 0) return null;
  let days: number;
  try {
    days = dayNumber(form.goal_date.trim()) - dayNumber(form.start_date.trim());
  } catch {
    return null;
  }
  if (days <= 0) return null;
  const weeks = Math.max(1, Math.ceil(days / 7));
  const span = `${weeks} week${weeks === 1 ? '' : 's'}`;
  const direction = directionOf(start, goal);
  if (direction === 'maintain') return `Keep your weight around ${goal} kg for ${span}.`;
  const kg = Math.abs(goal - start);
  const perWeek = kg / (days / 7);
  const rate = perWeek >= 0.1 ? perWeek.toFixed(1) : perWeek.toFixed(2);
  return `${direction === 'lose' ? 'Lose' : 'Gain'} ${Number(kg.toFixed(1))} kg over ${span}, about ${rate} kg a week.`;
}

/**
 * A fresh goal that starts today from the latest weigh-in. The old goal weight and date are cleared, because
 * they belonged to the last goal. The daily targets stay, since they usually carry over.
 */
export function newGoalFrom(form: GoalsForm, today: string, latestWeightKg: number | null): GoalsForm {
  return {
    ...form,
    start_date: today,
    start_weight: latestWeightKg === null ? '' : String(Number(latestWeightKg.toFixed(1))),
    goal_weight: '',
    goal_date: '',
  };
}
