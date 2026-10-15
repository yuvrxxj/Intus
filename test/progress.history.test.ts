import { test } from 'node:test';
import assert from 'node:assert/strict';
import { calorieRows, habitRows, moodRows, weightRows } from '../src/features/progress/history.ts';
import type { EffectLog } from '../src/db/dailyLogs.ts';

const log = (log_date: string, over: Partial<EffectLog> = {}): EffectLog => ({
  log_date, weight: null, mood: null, total_cals: null, protein: null, water_ml: null, active_kcal: null, habits: {}, ...over,
});
const LOGS = [
  log('2026-10-01', { weight: 82, total_cals: 2100, mood: 3, habits: { cig: { value: 5 } } }),
  log('2026-10-03', { weight: 81.4, total_cals: 2400, mood: 4, habits: { cig: { value: 0, note: 'patch' } } }),
  log('2026-10-02', { total_cals: 0, habits: {} }),
];

test('weight history is newest first, only weigh-ins, with the change since the one before', () => {
  const rows = weightRows(LOGS);
  assert.deepEqual(rows.map((r) => [r.date, r.value, r.note]), [
    ['2026-10-03', '81.4 kg', '-0.6 kg since the one before'],
    ['2026-10-01', '82 kg', undefined],
  ]);
  assert.equal(rows[0].dateLabel, '3 Oct 2026');
});

test('calorie history skips days without calories and says how far from the target', () => {
  assert.deepEqual(calorieRows(LOGS, 2200).map((r) => [r.value, r.note]), [['2,400 kcal', '200 over'], ['2,100 kcal', '100 under']]);
  assert.equal(calorieRows(LOGS, null)[0].note, undefined);
});

test('mood history reads each score with its word', () => {
  const rows = moodRows(LOGS);
  assert.equal(rows.length, 2);
  assert.ok(rows[0].value.startsWith('4 '));
});

test('habit history keeps notes and colours each day by how it measured up to the goal', () => {
  const cigs = { id: 'cig', name: 'Cigarettes', kind: 'count', goal: 0, better: 'lower', unit: null } as const;
  const rows = habitRows(cigs, LOGS);
  assert.deepEqual(rows.map((r) => [r.date, r.value, r.note, r.tone]), [
    ['2026-10-03', '0', 'patch', 'good'],
    ['2026-10-01', '5', undefined, 'bad'],
  ]);
});
