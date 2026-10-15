import type { DetailsValues, Profile } from '../../db/rows.ts';
import { ageOn } from '../../lib/age.ts';
import { ACTIVITY } from '../../lib/nutrition.ts';
import { normalizeSex, type Sex } from '../../lib/sex.ts';

export const MIN_AGE = 18;
export const MAX_AGE = 120;
export const HEIGHT_CM = { min: 100, max: 250 } as const;

/** The "Your details" form: the four facts that set a person's age, their ranges and their calorie suggestion. */
export interface DetailsForm {
  sex: Sex | '';
  date_of_birth: string;
  height_cm: string;
  activity: string;
}

export type DetailsErrors = Partial<Record<keyof DetailsForm, string>>;
export type DetailsResult = { ok: true; value: DetailsValues } | { ok: false; errors: DetailsErrors };

const text = (v: unknown): string => (v == null ? '' : String(v));

export function formFromDetails(profile: Pick<Profile, 'sex' | 'date_of_birth' | 'height_cm' | 'activity_level'> | null): DetailsForm {
  if (!profile) return { sex: '', date_of_birth: '', height_cm: '', activity: '' };
  const activity = ACTIVITY.find((a) => a.value === profile.activity_level)?.value ?? '';
  return { sex: normalizeSex(profile.sex), date_of_birth: text(profile.date_of_birth), height_cm: text(profile.height_cm), activity };
}

/** today is passed in, never read from the clock. */
export function validateDetails(form: DetailsForm, today: string): DetailsResult {
  const errors: DetailsErrors = {};
  if (form.sex === '') errors.sex = 'Choose male or female. Some ranges and the calorie suggestion depend on it.';
  const dob = form.date_of_birth.trim();
  const age = dob === '' ? null : ageOn(dob, today);
  if (dob === '') errors.date_of_birth = 'Enter your date of birth';
  else if (age === null) errors.date_of_birth = 'Enter a real date of birth, not in the future';
  else if (age > MAX_AGE) errors.date_of_birth = `Enter a date of birth that makes you ${MAX_AGE} or younger`;
  else if (age < MIN_AGE) errors.date_of_birth = `This app is built for adults, ${MIN_AGE} and over`;
  const raw = form.height_cm.trim();
  const height = raw === '' ? null : Number(raw);
  if (height === null) errors.height_cm = 'Enter your height in centimetres';
  else if (!Number.isFinite(height) || height < HEIGHT_CM.min || height > HEIGHT_CM.max) errors.height_cm = `Enter a height between ${HEIGHT_CM.min} and ${HEIGHT_CM.max} cm`;
  if (!ACTIVITY.some((a) => a.value === form.activity)) errors.activity = 'Choose how active you are';
  if (Object.keys(errors).length > 0 || form.sex === '' || age === null || height === null) return { ok: false, errors };
  return { ok: true, value: { sex: form.sex, date_of_birth: dob, age, height_cm: height, activity_level: form.activity } };
}
