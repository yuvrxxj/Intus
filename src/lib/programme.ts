import { dayNumber } from './dates.ts';
import { toNumberOrNull, type NumericInput } from './numbers.ts';

export type Direction = 'lose' | 'gain' | 'maintain';

export const DIRECTION_LABEL: Record<Direction, string> = { lose: 'Cut', gain: 'Gain', maintain: 'Maintain' };

/** The goal columns of a profile row, as they may arrive from the database. */
export interface GoalFields {
  start_weight?: NumericInput;
  goal_weight?: NumericInput;
  start_date?: string | null;
  goal_date?: string | null;
  calorie_target?: NumericInput;
  protein_target?: NumericInput;
}

/** A person's current goal, with everything the screens need already worked out. */
export interface Programme {
  startDate: string;
  goalDate: string;
  startWeightKg: number;
  goalWeightKg: number;
  direction: Direction;
  /** whole weeks from start to goal, at least 1 */
  weeks: number;
  calorieTarget: number | null;
  /** above this a day reads as over; null without a calorie target */
  calorieOver: number | null;
  /** from here up to the over line a day reads as close; null without a calorie target */
  calorieNear: number | null;
  proteinTarget: number | null;
}

/** Weights closer together than this are treated as "keep my weight". */
const SAME_WEIGHT_KG = 0.05;

export function directionOf(startKg: number, goalKg: number): Direction {
  const change = goalKg - startKg;
  if (Math.abs(change) < SAME_WEIGHT_KG) return 'maintain';
  return change < 0 ? 'lose' : 'gain';
}

/** A number from the database, or null when it is missing or not a number. Never throws. */
function num(value: unknown): number | null {
  try {
    return toNumberOrNull(value, 'goal value');
  } catch {
    return null;
  }
}

function day(value: string | null | undefined): number | null {
  if (value == null) return null;
  try {
    return dayNumber(value);
  } catch {
    return null;
  }
}

function positive(value: unknown): number | null {
  const n = num(value);
  return n !== null && n > 0 ? n : null;
}

/**
 * Turns the goal columns into a programme, or null when there is no usable goal yet: a missing weight or date,
 * or a goal date that is not after the start date. A calorie target is optional. The over and near lines keep
 * the proportions the page always used (2,100 kcal target, over from 2,200, near from 1,900).
 */
export function programmeFromProfile(fields: GoalFields | null | undefined): Programme | null {
  if (!fields) return null;
  const startWeightKg = positive(fields.start_weight);
  const goalWeightKg = positive(fields.goal_weight);
  const start = day(fields.start_date);
  const goal = day(fields.goal_date);
  if (startWeightKg === null || goalWeightKg === null || start === null || goal === null || goal <= start) return null;

  const calorieTarget = positive(fields.calorie_target);
  return {
    startDate: fields.start_date as string,
    goalDate: fields.goal_date as string,
    startWeightKg,
    goalWeightKg,
    direction: directionOf(startWeightKg, goalWeightKg),
    weeks: Math.max(1, Math.ceil((goal - start) / 7)),
    calorieTarget,
    calorieOver: calorieTarget === null ? null : calorieTarget + 100,
    calorieNear: calorieTarget === null ? null : Math.max(0, calorieTarget - 200),
    proteinTarget: positive(fields.protein_target),
  };
}
