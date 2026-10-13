import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mergeReadings, verifyAiRows, type AiRow } from '../src/features/reports/aiRows.ts';
import { parseReport, type MarkerRef } from '../src/features/reports/parse.ts';

const M = (code: string, name: string, unit: string): MarkerRef => ({ id: `id-${code}`, code, name, unit });
const MARKERS = [
  M('hemoglobin', 'Hemoglobin', 'g/dL'), M('testosterone', 'Testosterone', 'ng/dL'), M('crp', 'hs-CRP', 'mg/L'),
  M('creatinine', 'Creatinine', 'mg/dL'), M('tsh', 'TSH', 'mIU/L'), M('vitamin_d', 'Vitamin D', 'ng/mL'),
];
// what was sent: invented numbers, in the shapes real reports print
const SENT = [
  'Sample date: 2026-03-02',
  'Haemoglobin (HB) 16.0 g/dL 13.0-17.0',
  'Free-Testosterone 20.00 pg/mL 12.3 - 46.6',
  'C-REACTIVE PROTEIN (CRP) 7.30 mg/L <10',
  'Serum Creatinine 1.23 mg/dl 0.2 - 1.2',
  'Thyroid Stimulating Hormone 1.985 μIU/ml 0.55 - 4.78',
  'VITAMIN D (25 - OH VITAMIN D) 15.34 ng/ml 30 - 100',
  'Serum Phosphorus 4.9 mg/dl 2.4 - 5.1',
  'LDL / HDL Cholesterol Ratio 1.34 Ratio 0.5 - 3.0',
  'Hematocrit (PCV) 116.0 % 40.0-50.0',
];
const row = (over: Partial<AiRow>): AiRow => ({ name: 'Haemoglobin', marker: 'hemoglobin', value_text: '16.0', unit: 'g/dL', ref_low: '13.0', ref_high: '17.0', line: 'Haemoglobin (HB) 16.0 g/dL 13.0-17.0', ...over });
const one = (over: Partial<AiRow>) => verifyAiRows(SENT, [row(over)], MARKERS);

test('a result that is printed on the line it names is kept, with its unit and printed range', () => {
  const { rows, dropped } = one({});
  assert.equal(dropped, 0);
  assert.deepEqual(rows[0], { line: SENT[1], biomarkerId: 'id-hemoglobin', label: 'Haemoglobin', value: 16, unit: 'g/dL', refLow: 13, refHigh: 17, unitMismatch: false });
});

test('a number that is not printed on the report never gets through, however sure the AI was', () => {
  for (const over of [{ value_text: '99.9' }, { value_text: '6.0' }, { value_text: '1' }, { value_text: '1.6' }, { value_text: '16.0 g/dL' }, { value_text: 'Negative' }, { value_text: '<3.5' }]) {
    const { rows, dropped } = one(over);
    assert.deepEqual([rows.length, dropped], [0, 1], JSON.stringify(over));
  }
  // 16.0 is inside 116.0 on the hematocrit line, which is a different number
  const inside = verifyAiRows(SENT, [row({ name: 'Hematocrit', marker: null, line: SENT[9], value_text: '16.0' })], MARKERS);
  assert.deepEqual([inside.rows.length, inside.dropped], [0, 1]);
});

test('the number is compared as a number: a trailing zero more or less is the same value, a different number is not', () => {
  assert.equal(one({ value_text: '16' }).rows[0].value, 16);
  assert.equal(one({ value_text: '16.00' }).rows[0].value, 16);
  assert.equal(one({ value_text: '16,0' }).rows[0].value, 16);
  assert.deepEqual(one({ value_text: '13' }).rows[0].value, 13); // 13.0 is printed on the line, as the low end of the range
  const high = verifyAiRows(SENT, [row({ ref_low: '13', ref_high: '17.00' })], MARKERS).rows[0];
  assert.deepEqual([high.refLow, high.refHigh], [13, 17]);
  assert.equal(one({ ref_high: '17.5' }).rows[0].refHigh, null);
});

test('a line the AI made up, or one that has no result on it, is left out', () => {
  assert.equal(one({ line: 'Haemoglobin 17.2 g/dL 13.0-17.0', value_text: '17.2' }).dropped, 1);
  // a wrong copy of the line does not matter when the number really is printed beside that name
  assert.equal(one({ line: 'Haemoglobin 17.2 g/dL 13.0-17.0' }).rows[0].line, SENT[1]);
  assert.equal(one({ line: '' , name: 'Zzz' }).dropped, 1);
  const table = verifyAiRows(['VITAMIN D STATUS 25 ng/mL 15 - 20'], [row({ name: 'Vitamin D', marker: 'vitamin_d', value_text: '25', line: 'VITAMIN D STATUS 25 ng/mL 15 - 20' })], MARKERS);
  assert.equal(table.dropped, 1);
});

test('spacing and case in the AI\'s copy of the line do not matter, and a slightly different line is found by name and number', () => {
  assert.equal(one({ line: 'haemoglobin   (hb) 16.0  g/dl   13.0-17.0' }).rows.length, 1);
  const found = one({ line: 'Hb 16.0' });
  assert.equal(found.rows.length, 1);
  assert.equal(found.rows[0].line, SENT[1]);
});

test('a unit or a range the AI adds that is not on the line is dropped, and the row stays', () => {
  const { rows } = one({ unit: 'mmol/L', ref_low: '12.0', ref_high: '18.0' });
  assert.deepEqual([rows[0].unit, rows[0].refLow, rows[0].refHigh], [null, null, null]);
  const swapped = one({ ref_low: '17.0', ref_high: '13.0' });
  assert.deepEqual([swapped.rows[0].refLow, swapped.rows[0].refHigh], [null, null]);
  const bound = verifyAiRows(SENT, [row({ name: 'C-REACTIVE PROTEIN (CRP)', marker: null, value_text: '7.30', unit: 'mg/L', ref_low: null, ref_high: '10', line: SENT[3] })], MARKERS);
  assert.deepEqual([bound.rows[0].refLow, bound.rows[0].refHigh], [null, 10]);
});

test('a marker the AI names that is not tracked, or is a look-alike, is not used', () => {
  assert.equal(one({ marker: 'not_a_marker' }).rows[0].biomarkerId, null);
  const free = verifyAiRows(SENT, [row({ name: 'Free-Testosterone', marker: 'testosterone', value_text: '20.00', unit: 'pg/mL', ref_low: '12.3', ref_high: '46.6', line: SENT[2] })], MARKERS);
  assert.equal(free.rows[0].biomarkerId, null);
  const crp = verifyAiRows(SENT, [row({ name: 'C-REACTIVE PROTEIN (CRP)', marker: 'crp', value_text: '7.30', unit: 'mg/L', ref_low: null, ref_high: '10', line: SENT[3] })], MARKERS);
  assert.equal(crp.rows[0].biomarkerId, null);
  const ratio = verifyAiRows(SENT, [row({ name: 'LDL / HDL Cholesterol Ratio', marker: 'hemoglobin', value_text: '1.34', unit: 'Ratio', ref_low: '0.5', ref_high: '3.0', line: SENT[8] })], MARKERS);
  assert.equal(ratio.rows[0].biomarkerId, null);
  // and a real match survives
  const tsh = verifyAiRows(SENT, [row({ name: 'Thyroid Stimulating Hormone', marker: 'tsh', value_text: '1.985', unit: 'μIU/ml', ref_low: '0.55', ref_high: '4.78', line: SENT[5] })], MARKERS);
  assert.deepEqual([tsh.rows[0].biomarkerId, tsh.rows[0].unitMismatch], ['id-tsh', false]);
});

test('a unit that is not the one Intus stores is flagged, never converted', () => {
  const { rows } = verifyAiRows(SENT, [row({ name: 'Vitamin D', marker: 'vitamin_d', value_text: '15.34', unit: 'ng/ml', ref_low: '30', ref_high: '100', line: SENT[6] })], MARKERS);
  assert.deepEqual([rows[0].value, rows[0].unitMismatch, rows[0].refLow], [15.34, false, 30]);
  const mismatch = verifyAiRows(['Vitamin D 38 nmol/L 75 - 250'], [row({ name: 'Vitamin D', marker: 'vitamin_d', value_text: '38', unit: 'nmol/L', ref_low: '75', ref_high: '250', line: 'Vitamin D 38 nmol/L 75 - 250' })], MARKERS);
  assert.deepEqual([mismatch.rows[0].value, mismatch.rows[0].unitMismatch], [38, true]);
});

test('merging keeps the AI\'s rows first, adds what only the device read, and shows a disagreement as two rows', () => {
  const device = parseReport(SENT, MARKERS).rows;
  const ai = verifyAiRows(SENT, [
    row({}),
    row({ name: 'Serum Phosphorus', marker: null, value_text: '4.9', unit: 'mg/dl', ref_low: '2.4', ref_high: '5.1', line: SENT[7] }),
  ], MARKERS).rows;
  const merged = mergeReadings(ai, device);
  // the same line and number read by both is one row, and the device's own extra finds are added after the AI's
  assert.deepEqual(merged.slice(0, 2).map((r) => r.label), ['Haemoglobin', 'Serum Phosphorus']);
  assert.equal(merged.filter((r) => r.biomarkerId === 'id-hemoglobin').length, 1);
  assert.ok(merged.some((r) => r.biomarkerId === 'id-creatinine'), 'what only the device read is kept');
  // the AI says one number, the device another, for the same marker: both stay
  const a = verifyAiRows(['Hemoglobin 16.0 g/dL 13.0-17.0'], [row({ line: 'Hemoglobin 16.0 g/dL 13.0-17.0' })], MARKERS).rows;
  const d = parseReport(['Hemoglobin 11.9 g/dL 13.0-17.0'], MARKERS).rows;
  assert.deepEqual(mergeReadings(a, d).map((r) => r.value), [16, 11.9]);
  assert.deepEqual(mergeReadings([], d).map((r) => r.value), [11.9]);
});
