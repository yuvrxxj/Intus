import { dayNumber } from './dates.ts';

/**
 * Whole years lived on `today`, from an exact date of birth. The age goes up on the birthday itself, so a person born
 * on 29 February turns a year older on 1 March in a common year. Null for a missing or impossible date (a date of birth
 * in the future, or before 1900). Both arguments are 'YYYY-MM-DD'; today is passed in, never read from the clock.
 */
export function ageOn(dateOfBirth: string | null | undefined, today: string): number | null {
  if (!dateOfBirth) return null;
  let born: number;
  try {
    born = dayNumber(dateOfBirth);
    if (born > dayNumber(today)) return null;
  } catch {
    return null;
  }
  const [by, bm, bd] = dateOfBirth.slice(0, 10).split('-').map(Number);
  const [ty, tm, td] = today.slice(0, 10).split('-').map(Number);
  if (by < 1900) return null;
  let years = ty - by;
  if (tm < bm || (tm === bm && td < bd)) years -= 1;
  return years;
}

/** The birthday-aware age if there is a date of birth, else the plain age that was stored before dates were asked for. */
export function currentAge(profile: { date_of_birth?: string | null; age?: number | null }, today: string): number | null {
  return ageOn(profile.date_of_birth, today) ?? (profile.age ?? null);
}
