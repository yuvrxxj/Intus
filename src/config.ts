// The cut programme the Today, Progress and header screens are measured against. The profile table that could hold
// these is still empty, so they live here until it is filled in.
export const PROGRAMME = {
  startDate: '2026-04-05',
  goalDate: '2026-07-14',
  startWeightKg: 82,
  goalWeightKg: 75,
  calorieTarget: 2100,
  calorieOver: 2200,
  calorieNear: 1900,
  weeks: 12,
} as const;

export const PROFILE_LINE = `26M · 179cm · B+ · Cut: ${PROGRAMME.startWeightKg}→${PROGRAMME.goalWeightKg}kg`;

export interface Supplement {
  id: string;
  name: string;
  dose: string;
  tag: string;
  sundayOnly: boolean;
}

export const SUPPLEMENTS: readonly Supplement[] = [
  { id: 'zinc', name: 'Zinc', dose: 'Daily', tag: 'daily', sundayOnly: false },
  { id: 'vitd3', name: 'Vitamin D3', dose: 'Sunday only', tag: 'sunday', sundayOnly: true },
  { id: 'magnesium', name: 'Magnesium', dose: '400mg · Daily', tag: 'daily', sundayOnly: false },
  { id: 'ashwag_am', name: 'Ashwagandha AM', dose: 'Dose 1 of 2', tag: '2×/day', sundayOnly: false },
  { id: 'ashwag_pm', name: 'Ashwagandha PM', dose: 'Dose 2 of 2', tag: '2×/day', sundayOnly: false },
  { id: 'creatine_am', name: 'Creatine AM', dose: '3.5g · Monitor creatinine', tag: '7g/day', sundayOnly: false },
  { id: 'creatine_pm', name: 'Creatine PM', dose: '3.5g · 2nd dose', tag: '7g/day', sundayOnly: false },
];
