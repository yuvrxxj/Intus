import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  checkCritical, criticalFindings, markersWithoutThreshold, CRITICAL as C, type BiomarkerLimits,
} from '../src/lib/safety.ts';

// shaped like Supabase rows: numeric columns arrive as strings, missing values as null
const potassium = { id: 'b1', code: 'potassium', name: 'Potassium', unit: 'mmol/L', critical_low: '2.8', critical_high: '6.0' };
const alt = { id: 'b2', code: 'alt', name: 'ALT', unit: 'U/L', critical_low: null, critical_high: '200' };
const albumin = { id: 'b3', code: 'albumin', name: 'Albumin', unit: 'g/dl', critical_low: null, critical_high: null };
const status = (biomarker: BiomarkerLimits, value: unknown) => checkCritical(biomarker, value).status;

test('a value exactly on a critical line is critical, and just inside it is not', () => {
  assert.equal(status(potassium, 6.0), C.HIGH);
  assert.equal(status(potassium, 5.99), C.OK);
  assert.equal(status(potassium, 2.8), C.LOW);
  assert.equal(status(potassium, 2.81), C.OK);
  assert.equal(status(potassium, 9), C.HIGH);
  assert.equal(status(potassium, 1), C.LOW);
});

test('numeric strings from the database work the same as numbers', () => {
  assert.equal(status(potassium, '6.0'), C.HIGH);
  assert.equal(status(potassium, '4.2'), C.OK);
});

test('a marker with no limits is no_threshold, never ok', () => {
  assert.equal(status(albumin, 0.1), C.NO_THRESHOLD);
  assert.equal(status(albumin, 99), C.NO_THRESHOLD);
});

test('a one-sided marker reports which side it actually checked', () => {
  const high = checkCritical(alt, 1000);
  assert.deepEqual([high.status, high.checkedLow, high.checkedHigh], [C.HIGH, false, true]);
  const fine = checkCritical(alt, 0);
  assert.deepEqual([fine.status, fine.checkedLow, fine.checkedHigh], [C.OK, false, true]);
});

test('missing, blank or non-numeric values throw instead of reading as zero', () => {
  for (const bad of [null, undefined, '', '  ', 'abc', NaN, Infinity]) {
    assert.throws(() => checkCritical(potassium, bad), TypeError, String(bad));
  }
});

test('unusable threshold data throws instead of guessing', () => {
  assert.throws(() => checkCritical({ ...potassium, critical_high: 'x' }, 4), TypeError);
  assert.throws(() => checkCritical({ ...potassium, critical_low: '7', critical_high: '6' }, 4), RangeError);
  assert.throws(() => checkCritical({ ...potassium, critical_low: '6', critical_high: '6' }, 4), RangeError);
});

const reading = (id: string, biomarker_id: string, value: string, measured_at: string) => ({ id, biomarker_id, value, measured_at });

test('criticalFindings returns only critical readings, newest first, with the biomarker details', () => {
  const findings = criticalFindings(
    [potassium, alt, albumin],
    [
      reading('r1', 'b1', '6.2', '2022-04-10'),
      reading('r2', 'b1', '4.1', '2024-06-16'),
      reading('r3', 'b2', '250', '2026-06-06'),
      reading('r4', 'b3', '0.5', '2026-06-06'),
      reading('r5', 'b1', '2.5', '2024-01-01'),
    ],
  );
  assert.deepEqual(findings.map((f) => [f.measured_at, f.code, f.status]), [
    ['2026-06-06', 'alt', C.HIGH],
    ['2024-01-01', 'potassium', C.LOW],
    ['2022-04-10', 'potassium', C.HIGH],
  ]);
  assert.equal(findings[2].unit, 'mmol/L');
  assert.equal(findings[2].value, 6.2);
});

test('criticalFindings is empty when nothing is critical', () => {
  assert.deepEqual(criticalFindings([potassium], [reading('r1', 'b1', '4.0', '2026-01-01')]), []);
});

test('a reading for an unknown biomarker throws rather than being skipped', () => {
  assert.throws(
    () => criticalFindings([potassium], [reading('r1', 'nope', '9', '2026-01-01')]),
    { name: 'TypeError', message: /reading r1 points at unknown biomarker nope/ },
  );
});

test('markersWithoutThreshold lists only the markers that can never flag', () => {
  assert.deepEqual(markersWithoutThreshold([potassium, alt, albumin]), ['albumin']);
});
