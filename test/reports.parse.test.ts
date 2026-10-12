import { test } from 'node:test';
import assert from 'node:assert/strict';
import { findDate, parseReport, readDate, readValues, sameUnit, type MarkerRef } from '../src/features/reports/parse.ts';

// The markers as they are stored, with invented ids. The report lines below are made up in the shapes real labs print.
const M = (code: string, name: string, unit: string): MarkerRef => ({ id: code, code, name, unit });
const MARKERS = [
  M('hemoglobin', 'Hemoglobin', 'g/dL'), M('ldl', 'LDL', 'mg/dL'), M('hdl', 'HDL', 'mg/dL'), M('total_cholesterol', 'Total Cholesterol', 'mg/dl'),
  M('triglycerides', 'Triglycerides', 'mg/dL'), M('tsh', 'TSH', 'mIU/L'), M('t4_free', 'Free T4', 'ng/dL'), M('t4_total', 'T4 Total', 'ug/dl'),
  M('hba1c', 'HbA1c', '%'), M('glucose', 'Glucose', 'mg/dL'), M('alt', 'ALT', 'U/L'), M('vitamin_d', 'Vitamin D', 'ng/mL'),
  M('creatinine', 'Creatinine', 'mg/dL'), M('serum_iron', 'Serum Iron', 'ug/dl'), M('platelets', 'Platelets', '10³/µl'),
];
const byId = (report: ReturnType<typeof parseReport>, id: string) => report.rows.filter((r) => r.biomarkerId === id);

test('values, units and printed ranges, read as written', () => {
  assert.deepEqual(readValues(' 13.2 g/dL 12.0 - 15.5'), { value: 13.2, unit: 'g/dL', refLow: 12, refHigh: 15.5 });
  assert.deepEqual(readValues(': 142 H mg/dL < 100'), { value: 142, unit: 'mg/dL', refLow: null, refHigh: 100 });
  assert.deepEqual(readValues(' 4,6 mmol/L 3,5 - 5,1'), { value: 4.6, unit: 'mmol/L', refLow: 3.5, refHigh: 5.1 });
  assert.deepEqual(readValues(' 38 ng/mL >30'), { value: 38, unit: 'ng/mL', refLow: 30, refHigh: null });
  assert.deepEqual(readValues(' 5.9 % 4.0 to 5.6'), { value: 5.9, unit: '%', refLow: 4, refHigh: 5.6 });
  assert.deepEqual(readValues(' pending'), { value: null, unit: null, refLow: null, refHigh: null });
});

test('units that are the same quantity under another name match; nothing is converted', () => {
  assert.ok(sameUnit('µIU/mL', 'mIU/L'));
  assert.ok(sameUnit('mg/dl', 'mg/dL'));
  assert.ok(sameUnit('IU/L', 'U/L'));
  assert.ok(sameUnit('x10^3/uL', '10³/µl'));
  assert.ok(!sameUnit('mmol/L', 'mg/dL'));
  assert.ok(!sameUnit('pmol/L', 'ng/dL'));
});

test('a typical report: names matched by alias, the longest name wins, derived lines are skipped', () => {
  const lines = [
    'ACME DIAGNOSTICS  Patient: X  DOB: 01/02/1990',
    'Sample Collected On: 06/10/2026 08:12   Reported: 07/10/2026',
    'HAEMATOLOGY',
    'Haemoglobin (Hb)            13.2   g/dL      13.0 - 17.0',
    'Mean Corpuscular Hemoglobin (MCH)   29.1  pg   27 - 32',
    'Platelet Count              250    10^3/uL   150 - 410',
    'LIPID PROFILE',
    'Cholesterol, Total          212  H   mg/dL   < 200',
    'HDL Cholesterol             48       mg/dL   > 40',
    'LDL Cholesterol, Direct     131  H   mg/dL   < 100',
    'LDL/HDL Ratio               2.7              < 3.5',
    'Non-HDL Cholesterol         164      mg/dL   < 130',
    'Triglycerides               165  H   mg/dL   < 150',
    'Free T4 (FT4)               1.21     ng/dL   0.89 - 1.76',
    'TSH, Ultrasensitive         2.85     µIU/mL  0.55 - 4.78',
    'Glucose, Fasting            92       mg/dL   70 - 100',
    'Glucose, Post Prandial      131      mg/dL   70 - 140',
    'Total Iron Binding Capacity 320      ug/dL   250 - 450',
    'Iron, Serum                 88       ug/dL   65 - 175',
    'SGPT (ALT)                  31       U/L     < 41',
    '25-OH Vitamin D             18.4  L  nmol/L  75 - 250',
    'Interleukin 6               3.1      pg/mL   0.0 - 7.0',
  ];
  const r = parseReport(lines, MARKERS);
  assert.equal(r.date, '2026-10-06');
  assert.equal(r.dateUnsure, true); // 06/10 could be 10 June
  assert.deepEqual(byId(r, 'hemoglobin').map((x) => [x.value, x.unit, x.refLow, x.refHigh]), [[13.2, 'g/dL', 13, 17]]);
  assert.deepEqual(byId(r, 'total_cholesterol').map((x) => [x.value, x.refHigh]), [[212, 200]]);
  assert.deepEqual(byId(r, 'ldl').map((x) => x.value), [131]);
  assert.deepEqual(byId(r, 'hdl').map((x) => [x.value, x.refLow]), [[48, 40]]);
  assert.deepEqual(byId(r, 't4_free').map((x) => x.value), [1.21]);
  assert.equal(byId(r, 't4_total').length, 0);
  assert.deepEqual(byId(r, 'tsh').map((x) => [x.value, x.unitMismatch]), [[2.85, false]]);
  assert.deepEqual(byId(r, 'glucose').map((x) => x.value), [92]);
  assert.deepEqual(byId(r, 'serum_iron').map((x) => x.value), [88]);
  assert.deepEqual(byId(r, 'alt').map((x) => [x.value, x.refHigh]), [[31, 41]]);
  assert.deepEqual(byId(r, 'platelets').map((x) => [x.value, x.unitMismatch]), [[250, false]]);
  // a unit Intus does not store for that marker is kept, but marked, never converted
  assert.deepEqual(byId(r, 'vitamin_d').map((x) => [x.value, x.unit, x.unitMismatch]), [[18.4, 'nmol/L', true]]);
  // tests Intus does not track are shown, not dropped, including the ones that only share a name with a marker
  const unknown = r.rows.filter((x) => x.biomarkerId === null);
  assert.deepEqual(unknown.map((x) => [x.label, x.value]), [
    ['Mean Corpuscular Hemoglobin (MCH)', 29.1], ['Glucose, Post Prandial', 131], ['Total Iron Binding Capacity', 320], ['Interleukin 6', 3.1],
  ]);
  // MCH, the LDL/HDL ratio, non-HDL, post-prandial glucose and TIBC were not mistaken for the markers they name
  assert.equal(r.rows.some((x) => /corpuscular|ratio|non-hdl|post prandial|binding/i.test(x.line) && x.biomarkerId !== null), false);
});

test('dates: sample date first, then report date, never a date of birth; day and month order', () => {
  assert.deepEqual(readDate('Collected: 2026-10-06'), { date: '2026-10-06', unsure: false });
  assert.deepEqual(readDate('Sample date 6 Oct 2026'), { date: '2026-10-06', unsure: false });
  assert.deepEqual(readDate('Drawn Oct 6, 2026'), { date: '2026-10-06', unsure: false });
  assert.deepEqual(readDate('Collected 25/09/2026'), { date: '2026-09-25', unsure: false });
  assert.deepEqual(readDate('Collected 09/25/2026'), { date: '2026-09-25', unsure: false });
  assert.deepEqual(readDate('Collected 31/02/2026'), null);
  assert.deepEqual(findDate(['DOB: 12/03/1990', 'Reported: 14 Oct 2026', 'Specimen collected 12 Oct 2026']), { date: '2026-10-12', unsure: false });
  assert.deepEqual(findDate(['Report Date: 2026-10-14']), { date: '2026-10-14', unsure: false });
  assert.deepEqual(findDate(['nothing here']), { date: null, unsure: false });
});

test('text pieces become lines top to bottom, with columns kept apart', async () => {
  const { linesFromPieces } = await import('../src/features/reports/lines.ts');
  const p = (str: string, x: number, y: number) => ({ str, x, y, width: str.length * 5, height: 10 });
  assert.deepEqual(linesFromPieces([
    p('13.2', 200, 700.5), p('Haemoglobin', 50, 700), p('g/dL', 260, 699.8), p('13.0 - 17.0', 330, 700),
    p('Platelets', 50, 680), p('250', 200, 680), p(' ', 0, 690),
    p('HAEMATOLOGY', 50, 720),
  ]), ['HAEMATOLOGY', 'Haemoglobin   13.2   g/dL   13.0 - 17.0', 'Platelets   250']);
});
