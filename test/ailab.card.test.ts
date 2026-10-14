import { test } from 'node:test';
import assert from 'node:assert/strict';
import { compareScreens } from '../src/features/ailab/card.ts';
import { previewRows } from '../src/features/ailab/preview.ts';
import type { ParsedRow } from '../src/features/reports/parse.ts';

// invented results for tracked markers; the marker's code stands in for its id, as in a run file
const row = (code: string, value: number, unit: string, refLow: number | null, refHigh: number | null): ParsedRow => ({
  label: code, line: `${code} ${value} ${unit}`, value, unit, refLow, refHigh, biomarkerId: code, unitMismatch: false,
} as ParsedRow);

const TODAY = '2026-10-14';
const DATE = '2026-10-06';
const reference = previewRows([row('tsh', 2.1, 'mIU/L', 0.4, 4), row('ldl', 131, 'mg/dL', 0, 100), row('hba1c', 5.2, '%', 4, 5.7), row('vitamin_d', 18, 'ng/mL', 30, 100)], DATE, TODAY);

test('a model whose rows give the same screen scores every marker identical and flags the same concerns', () => {
  const same = previewRows([row('tsh', 2.1, 'mIU/L', 0.4, 4), row('ldl', 131, 'mg/dL', 0, 100), row('hba1c', 5.2, '%', 4, 5.7), row('vitamin_d', 18, 'ng/mL', 30, 100)], DATE, TODAY);
  const s = compareScreens(reference, same);
  assert.equal(s.reference, 4);
  assert.equal(s.sameFlag, 4);
  assert.equal(s.concerns, 2);
  assert.equal(s.concernsFlagged, 2);
  assert.deepEqual([s.missing, s.extra, s.differentValue, s.differentFlag, s.falseAlarms], [[], [], [], [], []]);
});

test('a missing marker, a wrong number and an invented alarm are each counted where they happen', () => {
  const model = previewRows([row('tsh', 9.9, 'mIU/L', 0.4, 4), row('ldl', 131, 'mg/dL', 0, 100), row('hba1c', 7.4, '%', 4, 5.7)], DATE, TODAY);
  const s = compareScreens(reference, model);
  assert.deepEqual(s.missing, ['vitamin_d']);
  assert.deepEqual(s.differentValue, ['tsh', 'hba1c']);
  assert.equal(s.sameFlag, 1);
  assert.equal(s.concernsFlagged, 1);
  assert.equal(s.concerns, 2);
});

test('a result the app\'s reader did not find, and that is out of range, is an extra marker and a false alarm', () => {
  const model = previewRows([row('tsh', 2.1, 'mIU/L', 0.4, 4), row('ldl', 131, 'mg/dL', 0, 100), row('hba1c', 5.2, '%', 4, 5.7), row('vitamin_d', 18, 'ng/mL', 30, 100), row('hdl', 12, 'mg/dL', 39, 100)], DATE, TODAY);
  const s = compareScreens(reference, model);
  assert.deepEqual(s.extra, ['hdl']);
  assert.deepEqual(s.falseAlarms, ['hdl']);
  assert.equal(s.sameFlag, 4);
});
