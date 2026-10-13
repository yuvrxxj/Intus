export type Sex = 'male' | 'female';

/** The two values the app stores, whichever way they were typed or imported. Anything else is "not set". */
export function normalizeSex(value: string | null | undefined): Sex | '' {
  const v = (value ?? '').trim().toLowerCase();
  if (v === 'm' || v === 'male') return 'male';
  if (v === 'f' || v === 'female') return 'female';
  return '';
}
