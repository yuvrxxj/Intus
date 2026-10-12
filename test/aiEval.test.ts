import { test } from 'node:test';
import assert from 'node:assert/strict';
import { score } from '../scripts/ai-eval.ts';
import type { ParsedRow } from '../src/features/reports/parse.ts';

const row = (biomarkerId: string | null, value: number): ParsedRow => ({ line: `${biomarkerId} ${value}`, biomarkerId, label: biomarkerId ?? 'other', value, unit: null, refLow: null, refHigh: null, unitMismatch: false });
const name = (id: string) => id.toUpperCase();

test('a model is scored on tracked markers it reproduced, disagreed on, missed and added, and on tests Intus does not track', () => {
  const device = [row('hdl', 54), row('ldl', 72), row('tsh', 2), row('ast', 21), row(null, 5)];
  const ai = [row('hdl', 54), row('ldl', 99), row('crp', 0.6), row(null, 7), row(null, 8)];
  const s = score(ai, device, 7, 2, name);
  assert.deepEqual([s.deviceKnown, s.aiKnown, s.agree], [4, 3, 1]);
  assert.deepEqual(s.conflicts, [{ marker: 'LDL', ai: 99, device: 72 }]);
  assert.deepEqual(s.deviceOnly.sort(), ['AST', 'TSH']);
  assert.deepEqual(s.aiOnly, ['CRP']);
  assert.deepEqual([s.extraUntracked, s.returned, s.kept, s.dropped], [2, 7, 5, 2]);
});

test('a marker read twice with different numbers agrees if the model has either of them', () => {
  const s = score([row('hdl', 54)], [row('hdl', 60), row('hdl', 54)], 1, 0, name);
  assert.deepEqual([s.agree, s.conflicts.length], [1, 0]);
});
