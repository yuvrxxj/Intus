// Still hardcoded, and the next thing to become editable: the supplement checklist on the Today screen.
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
