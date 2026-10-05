import type { Profile, ProfileValues } from '../../db/profile.ts';
import { dayNumber } from '../../lib/dates.ts';
import { SCREENING_STATUS, type ScreeningItem, type ScreeningStatus } from '../../lib/screening.ts';

export interface ScreeningGroups {
  overdue: ScreeningItem[];
  due: ScreeningItem[];
  upToDate: ScreeningItem[];
  notYet: ScreeningItem[];
}

export function groupScreening(items: readonly ScreeningItem[]): ScreeningGroups {
  const by = (status: ScreeningStatus) => items.filter((i) => i.status === status);
  return {
    overdue: by(SCREENING_STATUS.OVERDUE),
    due: by(SCREENING_STATUS.DUE),
    upToDate: by(SCREENING_STATUS.UP_TO_DATE),
    notYet: by(SCREENING_STATUS.NOT_YET),
  };
}

export type Sex = 'male' | 'female';

export function normalizeSex(value: string | null | undefined): Sex | '' {
  const v = (value ?? '').trim().toLowerCase();
  if (v === 'm' || v === 'male') return 'male';
  if (v === 'f' || v === 'female') return 'female';
  return '';
}

export interface ProfileForm {
  age: string;
  sex: Sex | '';
  family_colorectal_cancer: boolean;
  family_prostate_cancer: boolean;
  noise_or_blast_exposure: boolean;
}

/** What the header already says about you (26M). Used to prefill the form, never saved until you press save. */
export const PROFILE_FORM_DEFAULTS: ProfileForm = {
  age: '26', sex: 'male', family_colorectal_cancer: false, family_prostate_cancer: false, noise_or_blast_exposure: false,
};

export function formFromProfile(profile: Profile | null): ProfileForm {
  if (!profile) return { ...PROFILE_FORM_DEFAULTS };
  return {
    age: profile.age == null ? '' : String(profile.age),
    sex: normalizeSex(profile.sex),
    family_colorectal_cancer: profile.family_colorectal_cancer,
    family_prostate_cancer: profile.family_prostate_cancer,
    noise_or_blast_exposure: profile.noise_or_blast_exposure,
  };
}

export type ProfileErrors = Partial<Record<'age' | 'sex', string>>;
export type ProfileResult = { ok: true; value: ProfileValues } | { ok: false; errors: ProfileErrors };

export function validateProfileForm(form: ProfileForm): ProfileResult {
  const errors: ProfileErrors = {};
  const age = Number(form.age.trim());
  if (form.age.trim() === '' || !Number.isInteger(age) || age < 0 || age > 120) errors.age = 'Enter your age as a whole number from 0 to 120';
  if (form.sex === '') errors.sex = 'Choose male or female, because some screenings depend on it';
  if (Object.keys(errors).length > 0 || form.sex === '') return { ok: false, errors };
  return {
    ok: true,
    value: {
      age,
      sex: form.sex,
      family_colorectal_cancer: form.family_colorectal_cancer,
      family_prostate_cancer: form.family_prostate_cancer,
      noise_or_blast_exposure: form.noise_or_blast_exposure,
    },
  };
}

/**
 * The calendar needs an age and a sex. Without a sex the rules would quietly drop everything sex-specific, so a
 * missing value means "not ready", not "fewer items".
 */
export function profileIsReady(profile: Profile | null): profile is Profile & { age: number; sex: string } {
  return !!profile && profile.age != null && normalizeSex(profile.sex) !== '';
}

/** A screening is recorded on the day it happened, so it cannot be dated in the future. */
export function validateRecordDate(date: string, today: string): string | null {
  const trimmed = date.trim();
  if (trimmed === '') return 'Choose the date it was done';
  let day: number;
  try {
    day = dayNumber(trimmed);
  } catch {
    return 'That is not a valid date';
  }
  return day > dayNumber(today) ? 'That date is in the future' : null;
}
