// The outbox that makes the strength log lose nothing. Pure: storage and network are passed in, so it can be tested.
//
// Every change (a workout started or finished, a set added, changed or deleted) is written to local storage first,
// then sent. Each operation is idempotent (an upsert or a delete by an id made on the device), so sending one twice is
// harmless. Operations go in order and stop at the first failure, which stays queued for the next try: on the next
// change, when the page comes back online, or when the app is opened again.
import type { SetRow } from './model.ts';

export interface WorkoutRow {
  id: string;
  started_at: string;
  ended_at: string | null;
  notes: string | null;
}

export type Op =
  | { kind: 'workout'; row: WorkoutRow }
  | { kind: 'set'; row: SetRow }
  | { kind: 'deleteSet'; id: string }
  | { kind: 'deleteWorkout'; id: string };

export interface Storage {
  get: () => string | null;
  set: (value: string) => void;
}

export interface Sender {
  send: (op: Op) => Promise<void>;
}

export const QUEUE_KEY = 'intus.strength.outbox';

export function readQueue(storage: Storage): Op[] {
  try {
    const parsed = JSON.parse(storage.get() ?? '[]');
    return Array.isArray(parsed) ? parsed.filter((o) => o && typeof o === 'object' && typeof o.kind === 'string') : [];
  } catch {
    return [];
  }
}

function write(storage: Storage, ops: readonly Op[]): void {
  storage.set(JSON.stringify(ops));
}

/**
 * Adds an operation. A newer write of the same set or workout replaces the queued one, and a delete drops queued writes
 * of what it deletes (a set deleted before it was ever sent never needs to be sent).
 */
export function enqueue(storage: Storage, op: Op): Op[] {
  let ops = readQueue(storage);
  if (op.kind === 'set') ops = ops.filter((o) => !(o.kind === 'set' && o.row.id === op.row.id));
  if (op.kind === 'workout') ops = ops.filter((o) => !(o.kind === 'workout' && o.row.id === op.row.id));
  if (op.kind === 'deleteSet') ops = ops.filter((o) => !(o.kind === 'set' && o.row.id === op.id));
  if (op.kind === 'deleteWorkout') ops = ops.filter((o) => !((o.kind === 'workout' && o.row.id === op.id) || (o.kind === 'set' && o.row.workout_id === op.id)));
  ops.push(op);
  write(storage, ops);
  return ops;
}

/** Sends what is queued, in order. Returns how many are still waiting and the first error, if any. */
export async function flush(storage: Storage, sender: Sender): Promise<{ waiting: number; error: string | null }> {
  let ops = readQueue(storage);
  while (ops.length > 0) {
    try {
      await sender.send(ops[0]);
    } catch (e) {
      return { waiting: ops.length, error: e instanceof Error ? e.message : String(e) };
    }
    // re-read: something may have been queued while this one was in flight
    ops = readQueue(storage).slice(1);
    write(storage, ops);
  }
  return { waiting: 0, error: null };
}

/** What the screen shows: stored rows with queued changes laid over them, so a set never disappears while unsent. */
export function overlay<T extends { id: string }>(stored: readonly T[], ops: readonly Op[], pick: (op: Op) => T | null, deletedBy: (op: Op) => string | null): T[] {
  const byId = new Map(stored.map((r) => [r.id, r]));
  for (const op of ops) {
    const row = pick(op);
    if (row) byId.set(row.id, row);
    const gone = deletedBy(op);
    if (gone) byId.delete(gone);
  }
  return [...byId.values()];
}
