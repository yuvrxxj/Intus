import { test } from 'node:test';
import assert from 'node:assert/strict';
import { bests, byExercise, validateSet, volume, EMPTY_SET, type SetRow } from '../src/features/strength/model.ts';
import { enqueue, flush, overlay, readQueue, type Op, type Storage } from '../src/features/strength/queue.ts';

const memory = (): Storage & { value: string | null } => {
  const s = { value: null as string | null, get: () => s.value, set: (v: string) => { s.value = v; } };
  return s;
};
const set = (id: string, over: Partial<SetRow> = {}): SetRow => ({ id, workout_id: 'w', exercise: 'Squat', position: 0, weight_kg: 100, reps: 5, rpe: null, notes: null, ...over });

test('a set needs an exercise and reps; weight is optional; RPE is 1 to 10 in half steps', () => {
  const ok = validateSet({ ...EMPTY_SET, exercise: '  Back   squat ', weight: '102,5', reps: '5', rpe: '8.5' });
  assert.ok(ok.ok);
  assert.deepEqual(ok.value, { exercise: 'Back squat', weight_kg: 102.5, reps: 5, rpe: 8.5, notes: null });
  assert.ok(validateSet({ ...EMPTY_SET, exercise: 'Pull-up', reps: '10' }).ok);
  const bad = validateSet({ ...EMPTY_SET, exercise: '', weight: 'heavy', reps: '5.5', rpe: '8.3', notes: 'x'.repeat(201) });
  assert.ok(!bad.ok);
  assert.deepEqual(Object.keys(bad.errors).sort(), ['exercise', 'notes', 'reps', 'rpe', 'weight']);
  assert.ok(!validateSet({ ...EMPTY_SET, exercise: 'Squat', reps: '5', rpe: '11' }).ok);
});

test('grouping, volume and bests', () => {
  const sets = [set('1', { position: 0 }), set('2', { exercise: 'Bench', position: 1, weight_kg: 60, reps: 8 }), set('3', { exercise: 'squat', position: 2, weight_kg: 110, reps: 3 }), set('4', { exercise: 'Plank', position: 3, weight_kg: null, reps: 1 })];
  assert.deepEqual(byExercise(sets).map((g) => [g.exercise, g.sets.length]), [['Squat', 2], ['Bench', 1], ['Plank', 1]]);
  assert.equal(volume(sets), 500 + 480 + 330);
  assert.equal(bests(sets).get('squat')?.id, '3');
  assert.equal(bests(sets).has('plank'), false);
});

test('the outbox keeps everything until it is confirmed, in order, and a failure stays queued', async () => {
  const storage = memory();
  enqueue(storage, { kind: 'workout', row: { id: 'w', started_at: 't', ended_at: null, notes: null } });
  enqueue(storage, { kind: 'set', row: set('1') });
  enqueue(storage, { kind: 'set', row: set('2') });
  const sent: string[] = [];
  let failOn = '2';
  const sender = { send: async (op: Op) => {
    const id = op.kind === 'set' || op.kind === 'workout' ? op.row.id : op.id;
    if (id === failOn) throw new Error('offline');
    sent.push(`${op.kind}:${id}`);
  } };
  assert.deepEqual(await flush(storage, sender), { waiting: 1, error: 'offline' });
  assert.deepEqual(sent, ['workout:w', 'set:1']);
  assert.equal(readQueue(storage).length, 1); // set 2 is still kept, as if the tab were closed now
  failOn = '';
  assert.deepEqual(await flush(storage, sender), { waiting: 0, error: null });
  assert.deepEqual(sent, ['workout:w', 'set:1', 'set:2']);
});

test('a newer edit replaces the queued one, and deleting an unsent set means it is never sent', () => {
  const storage = memory();
  enqueue(storage, { kind: 'set', row: set('1', { reps: 5 }) });
  enqueue(storage, { kind: 'set', row: set('1', { reps: 6 }) });
  assert.deepEqual(readQueue(storage).map((o) => (o.kind === 'set' ? o.row.reps : null)), [6]);
  enqueue(storage, { kind: 'deleteSet', id: '1' });
  assert.deepEqual(readQueue(storage), [{ kind: 'deleteSet', id: '1' }]);
  enqueue(storage, { kind: 'set', row: set('9', { workout_id: 'w2' }) });
  enqueue(storage, { kind: 'deleteWorkout', id: 'w2' });
  assert.deepEqual(readQueue(storage).map((o) => o.kind), ['deleteSet', 'deleteWorkout']);
  // a corrupt store reads as empty instead of breaking the page
  storage.set('{nope');
  assert.deepEqual(readQueue(storage), []);
});

test('the screen shows stored sets with unsent changes laid over them', () => {
  const ops: Op[] = [{ kind: 'set', row: set('2', { reps: 9 }) }, { kind: 'set', row: set('3') }, { kind: 'deleteSet', id: '1' }];
  const shown = overlay([set('1'), set('2')], ops, (o) => (o.kind === 'set' ? o.row : null), (o) => (o.kind === 'deleteSet' ? o.id : null));
  assert.deepEqual(shown.map((s) => [s.id, s.reps]).sort(), [['2', 9], ['3', 5]]);
});
