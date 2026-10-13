import { ageOn } from '../../lib/age.ts';
import { dayNumber } from '../../lib/dates.ts';
import { ACTIVITY, activityFactor, calorieSuggestion, proteinSuggestion, type Advice, type GoalDirection } from '../../lib/nutrition.ts';
import { directionOf } from '../../lib/programme.ts';
import { normalizeSex } from '../../lib/sex.ts';
import type { Profile } from '../../db/profile.ts';
import type { GoalsForm } from './model.ts';

const kcal = (n: number) => Math.round(n).toLocaleString('en-US');
const kg = (n: number) => String(Number(n.toFixed(2)));

/**
 * The working behind a calorie suggestion, in plain words, so nobody has to trust a bare number:
 * "Maintenance is about 2,550 kcal (resting 1,650 x 1.55 for how active you are). To lose about 0.5 kg a week, eat about
 * 550 less: 2,000 kcal." Mentions the cap or floor when one changed the answer.
 */
export function calorieBreakdown(advice: Advice): string {
  const { calories: c } = advice;
  const base = `Maintenance is about ${kcal(c.maintenance)} kcal (resting ${kcal(c.bmr)} x ${activityFactor(advice.activity)} for how active you are).`;
  if (advice.direction === 'maintain') return `${base} To keep your weight, aim for about ${kcal(c.target)} kcal.`;
  const verb = advice.direction === 'lose' ? 'lose' : 'gain';
  const change = advice.direction === 'lose' ? 'less' : 'more';
  const amount = `${kcal(Math.abs(c.adjustment))} ${change}`;
  const tail = c.limitedBy === 'floor'
    ? ` That is the lowest this app suggests, so it stops at ${kcal(c.target)} kcal.`
    : c.limitedBy === 'deficit_cap' || c.limitedBy === 'surplus_cap'
      ? ` That pace is faster than this app suggests, so the change is capped at 1,000 kcal a day.`
      : '';
  return `${base} To ${verb} about ${kg(advice.paceKgPerWeek)} kg a week, eat about ${amount}: ${kcal(c.target)} kcal.${tail} These are averages, so adjust after a few weeks of weigh-ins.`;
}


/**
 * The suggestion for the goal as typed so far, from the profile's details. Weight is the latest weigh-in, or the
 * starting weight when there is none. Null until the details and the weights make a suggestion possible.
 */
export function adviceFromGoals(
  form: GoalsForm,
  profile: Pick<Profile, 'sex' | 'date_of_birth' | 'age' | 'height_cm' | 'activity_level'> | null,
  latestWeightKg: number | null,
  today: string,
): Advice | null {
  if (!profile) return null;
  const sex = normalizeSex(profile.sex);
  const activity = ACTIVITY.find((a) => a.value === profile.activity_level)?.value;
  const age = ageOn(profile.date_of_birth, today) ?? profile.age;
  const height = profile.height_cm == null ? NaN : Number(profile.height_cm);
  const start = Number(form.start_weight);
  const goal = Number(form.goal_weight);
  const weight = latestWeightKg ?? start;
  if (sex === '' || !activity || age == null || !Number.isFinite(height) || !Number.isFinite(weight) || weight <= 0) return null;
  if (!Number.isFinite(start) || !Number.isFinite(goal) || start <= 0 || goal <= 0) return null;
  const direction: GoalDirection = directionOf(start, goal);
  let pace = 0;
  if (direction !== 'maintain') {
    let days = NaN;
    try {
      days = dayNumber(form.goal_date.trim()) - dayNumber(form.start_date.trim());
    } catch {
      /* no usable dates yet: fall back to the steady pace below */
    }
    pace = Number.isFinite(days) && days > 0 ? Math.abs(goal - start) / (days / 7) : 0.5;
  }
  const calories = calorieSuggestion({ sex, weightKg: weight, heightCm: height, ageYears: age }, activity, direction, pace);
  if (calories === null) return null;
  return { calories, protein: proteinSuggestion(weight, activity), paceKgPerWeek: pace, age, activity, direction };
}
