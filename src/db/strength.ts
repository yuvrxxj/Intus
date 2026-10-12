import type { SetRow } from '../features/strength/model.ts';
import type { Op, WorkoutRow } from '../features/strength/queue.ts';
import { supabase } from './client.ts';

export interface Workout extends WorkoutRow {
  sets: SetRow[];
}

/** The latest workouts with their sets, newest first. A table that does not exist yet reads as no workouts. */
export async function fetchWorkouts(limit = 30): Promise<Workout[]> {
  const { data, error } = await supabase
    .from('workouts')
    .select('id,started_at,ended_at,notes,workout_sets(id,workout_id,exercise,position,weight_kg,reps,rpe,notes)')
    .order('started_at', { ascending: false })
    .limit(limit);
  if (error) {
    if (/does not exist|schema cache|not find the table/i.test(error.message)) return [];
    throw new Error(`Could not load your workouts: ${error.message}`);
  }
  return (data ?? []).map((w) => {
    const { workout_sets, ...rest } = w as WorkoutRow & { workout_sets: SetRow[] | null };
    return {
      ...rest,
      sets: (workout_sets ?? []).map((s) => ({
        ...s,
        weight_kg: s.weight_kg === null ? null : Number(s.weight_kg),
        rpe: s.rpe === null ? null : Number(s.rpe),
      })),
    };
  });
}

/** One queued operation. Each is safe to send twice. */
export async function sendOp(op: Op): Promise<void> {
  const result =
    op.kind === 'workout' ? await supabase.from('workouts').upsert(op.row, { onConflict: 'id' })
    : op.kind === 'set' ? await supabase.from('workout_sets').upsert(op.row, { onConflict: 'id' })
    : op.kind === 'deleteSet' ? await supabase.from('workout_sets').delete().eq('id', op.id)
    : await supabase.from('workouts').delete().eq('id', op.id);
  if (result.error) throw new Error(result.error.message);
}
