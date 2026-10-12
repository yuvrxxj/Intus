// The strength log's rules. Pure: no network, no storage.
import { parseResultValue } from '../bloodwork/entry.ts';

export interface SetRow {
  id: string;
  workout_id: string;
  exercise: string;
  position: number;
  weight_kg: number | null;
  reps: number;
  rpe: number | null;
  notes: string | null;
}

export interface SetForm {
  exercise: string;
  weight: string;
  reps: string;
  rpe: string;
  notes: string;
}

export const EMPTY_SET: SetForm = { exercise: '', weight: '', reps: '', rpe: '', notes: '' };
export const LIMITS = { exercise: 60, notes: 200, weightKg: 1000, reps: 1000 } as const;

export type SetErrors = Partial<Record<keyof SetForm, string>>;

/** RPE from 1 to 10 in half steps; weight optional (bodyweight work); reps a whole number. */
export function validateSet(form: SetForm): { ok: true; value: Omit<SetRow, 'id' | 'workout_id' | 'position'> } | { ok: false; errors: SetErrors } {
  const errors: SetErrors = {};
  const exercise = form.exercise.trim().replace(/\s+/g, ' ');
  if (exercise === '') errors.exercise = 'Name the exercise';
  else if (exercise.length > LIMITS.exercise) errors.exercise = `Keep it under ${LIMITS.exercise} characters`;
  let weight: number | null = null;
  if (form.weight.trim() !== '') {
    weight = parseResultValue(form.weight);
    if (weight === null || weight > LIMITS.weightKg) errors.weight = 'Enter the weight in kg, such as 62.5, or leave it blank';
  }
  const reps = /^\d+$/.test(form.reps.trim()) ? Number(form.reps.trim()) : null;
  if (reps === null || reps > LIMITS.reps) errors.reps = 'Enter the number of reps';
  let rpe: number | null = null;
  if (form.rpe.trim() !== '') {
    rpe = parseResultValue(form.rpe);
    if (rpe === null || rpe < 1 || rpe > 10 || rpe * 2 !== Math.floor(rpe * 2)) errors.rpe = 'RPE is 1 to 10, in half steps';
  }
  const notes = form.notes.trim();
  if (notes.length > LIMITS.notes) errors.notes = `Keep notes under ${LIMITS.notes} characters`;
  if (Object.keys(errors).length > 0 || reps === null) return { ok: false, errors };
  return { ok: true, value: { exercise, weight_kg: weight, reps, rpe, notes: notes === '' ? null : notes } };
}

/** Sets grouped by exercise, in the order each exercise was first done. */
export function byExercise(sets: readonly SetRow[]): { exercise: string; sets: SetRow[] }[] {
  const groups: { exercise: string; sets: SetRow[] }[] = [];
  for (const set of [...sets].sort((a, b) => a.position - b.position)) {
    const key = set.exercise.toLowerCase();
    const group = groups.find((g) => g.exercise.toLowerCase() === key);
    if (group) group.sets.push(set);
    else groups.push({ exercise: set.exercise, sets: [set] });
  }
  return groups;
}

/** Total weight moved (weight times reps), counting only sets with a weight. */
export function volume(sets: readonly SetRow[]): number {
  return sets.reduce((n, s) => n + (s.weight_kg ?? 0) * s.reps, 0);
}

/** The heaviest set for each exercise across every workout given, by weight then reps. */
export function bests(sets: readonly SetRow[]): Map<string, SetRow> {
  const out = new Map<string, SetRow>();
  for (const s of sets) {
    if (s.weight_kg === null) continue;
    const key = s.exercise.toLowerCase();
    const best = out.get(key);
    if (!best || (best.weight_kg ?? 0) < s.weight_kg || (best.weight_kg === s.weight_kg && best.reps < s.reps)) out.set(key, s);
  }
  return out;
}
