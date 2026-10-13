import type { Sex } from './sex.ts';

/*
 * Calorie and protein starting points, worked out on the device. The formulas are the three that
 * https://www.calculator.net/calorie-calculator.html lists. They estimate an average person: they are a place to
 * start and are meant to be changed after a few weeks of real weigh-ins, not a prescription.
 */

export type Activity = 'sedentary' | 'light' | 'moderate' | 'active' | 'very_active';

export const ACTIVITY: readonly { value: Activity; label: string; hint: string; factor: number }[] = [
  { value: 'sedentary', label: 'Mostly sitting', hint: 'Desk job, little exercise', factor: 1.2 },
  { value: 'light', label: 'Lightly active', hint: 'On your feet some of the day, or exercise 1 to 3 days a week', factor: 1.375 },
  { value: 'moderate', label: 'Moderately active', hint: 'Exercise 3 to 5 days a week', factor: 1.55 },
  { value: 'active', label: 'Very active', hint: 'Hard exercise 6 to 7 days a week, or a physical job', factor: 1.725 },
  { value: 'very_active', label: 'Extremely active', hint: 'Hard exercise twice a day, or heavy physical work', factor: 1.9 },
];

export type BmrFormula = 'mifflin_st_jeor' | 'harris_benedict' | 'katch_mcardle';

export const FORMULA_LABEL: Record<BmrFormula, string> = {
  mifflin_st_jeor: 'Mifflin-St Jeor',
  harris_benedict: 'Revised Harris-Benedict',
  katch_mcardle: 'Katch-McArdle (needs body fat)',
};

export interface BodyInput {
  sex: Sex;
  weightKg: number;
  heightCm: number;
  ageYears: number;
  /** body fat as a percentage, only for Katch-McArdle */
  bodyFatPct?: number | null;
}

const finite = (...n: number[]) => n.every((v) => Number.isFinite(v));

/**
 * Basal metabolic rate in kcal a day: what the body spends at rest. Null when an input is missing or impossible, so a
 * blank form never produces a number.
 */
export function bmr(input: BodyInput, formula: BmrFormula = 'mifflin_st_jeor'): number | null {
  const { sex, weightKg: w, heightCm: h, ageYears: a } = input;
  if (!finite(w, h, a) || w <= 0 || h <= 0 || a <= 0) return null;
  if (formula === 'mifflin_st_jeor') return 10 * w + 6.25 * h - 5 * a + (sex === 'male' ? 5 : -161);
  if (formula === 'harris_benedict') {
    return sex === 'male' ? 13.397 * w + 4.799 * h - 5.677 * a + 88.362 : 9.247 * w + 3.098 * h - 4.33 * a + 447.593;
  }
  const f = input.bodyFatPct;
  if (f == null || !Number.isFinite(f) || f <= 0 || f >= 70) return null;
  return 370 + 21.6 * (1 - f / 100) * w;
}

export function activityFactor(activity: Activity): number {
  return ACTIVITY.find((x) => x.value === activity)?.factor ?? 1.2;
}

/** Calories that hold weight steady: BMR times the activity factor. */
export function maintenanceCalories(input: BodyInput, activity: Activity, formula: BmrFormula = 'mifflin_st_jeor'): number | null {
  const base = bmr(input, formula);
  return base === null ? null : base * activityFactor(activity);
}

/** About 7,700 kcal per kilogram of body weight (3,500 kcal a pound). */
export const KCAL_PER_KG = 7700;
/** Eating more than this far under maintenance is not suggested, whatever pace was asked for. */
export const MAX_DAILY_DEFICIT = 1000;
export const MAX_DAILY_SURPLUS = 1000;
/** Never suggest less than this a day. */
export const CALORIE_FLOOR: Record<Sex, number> = { male: 1500, female: 1200 };

/** The usual choices for how fast to change weight, in kg a week. */
export const PACES = {
  lose: [
    { id: 'mild', label: 'Mild', kgPerWeek: 0.25 },
    { id: 'steady', label: 'Steady', kgPerWeek: 0.5 },
    { id: 'fast', label: 'Fast', kgPerWeek: 0.75 },
  ],
  gain: [
    { id: 'mild', label: 'Mild', kgPerWeek: 0.25 },
    { id: 'steady', label: 'Steady', kgPerWeek: 0.5 },
  ],
} as const;

export type GoalDirection = 'lose' | 'gain' | 'maintain';

export interface CalorieSuggestion {
  bmr: number;
  maintenance: number;
  /** the daily change from maintenance: negative to lose, positive to gain, 0 to maintain */
  adjustment: number;
  /** maintenance plus the adjustment, rounded to 50, never below the floor */
  target: number;
  /** why the target is not the plain sum, when it is not */
  limitedBy: 'floor' | 'deficit_cap' | 'surplus_cap' | null;
}

/** Calories and protein together, with what they were worked out from, so a screen can show its working. */
export interface Advice {
  calories: CalorieSuggestion;
  /** grams a day, from the person's current weight and activity */
  protein: number | null;
  /** the pace the calories were worked out for, in kg a week (0 when keeping weight) */
  paceKgPerWeek: number;
  /** the age the formula used, which the date of birth gives */
  age: number;
  activity: Activity;
  direction: GoalDirection;
}

const round50 = (n: number) => Math.round(n / 50) * 50;

/**
 * The daily calories to aim for. paceKgPerWeek is how fast the weight should move (ignored when maintaining). The
 * deficit is capped at 1,000 kcal a day and the result never goes under the floor.
 */
export function calorieSuggestion(
  input: BodyInput,
  activity: Activity,
  direction: GoalDirection,
  paceKgPerWeek = 0.5,
  formula: BmrFormula = 'mifflin_st_jeor',
): CalorieSuggestion | null {
  const base = bmr(input, formula);
  if (base === null) return null;
  const maintenance = base * activityFactor(activity);
  let adjustment = 0;
  let limitedBy: CalorieSuggestion['limitedBy'] = null;
  if (direction !== 'maintain' && Number.isFinite(paceKgPerWeek) && paceKgPerWeek > 0) {
    const raw = (paceKgPerWeek * KCAL_PER_KG) / 7;
    if (direction === 'lose') {
      adjustment = -Math.min(raw, MAX_DAILY_DEFICIT);
      if (raw > MAX_DAILY_DEFICIT) limitedBy = 'deficit_cap';
    } else {
      adjustment = Math.min(raw, MAX_DAILY_SURPLUS);
      if (raw > MAX_DAILY_SURPLUS) limitedBy = 'surplus_cap';
    }
  }
  let target = maintenance + adjustment;
  const floor = CALORIE_FLOOR[input.sex];
  if (target < floor) {
    target = floor;
    limitedBy = 'floor';
  }
  return { bmr: base, maintenance: round50(maintenance), adjustment: Math.round(target - maintenance), target: round50(target), limitedBy };
}

/**
 * A protein starting point in grams: 1.2 g per kg for people who are mostly sitting or lightly active, 1.6 g per kg for
 * anyone who trains. Common sports-nutrition figures, not a prescription, and the person can change it.
 */
export function proteinSuggestion(weightKg: number, activity: Activity): number | null {
  if (!Number.isFinite(weightKg) || weightKg <= 0) return null;
  const perKg = activity === 'sedentary' || activity === 'light' ? 1.2 : 1.6;
  return Math.round((weightKg * perKg) / 5) * 5;
}

/** The pace a goal implies: kilograms to change over the weeks given. Null when it cannot be worked out. */
export function paceOf(startKg: number, goalKg: number, weeks: number): number | null {
  if (![startKg, goalKg, weeks].every(Number.isFinite) || weeks <= 0) return null;
  return Math.abs(goalKg - startKg) / weeks;
}
