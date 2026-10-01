import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  paracetamolDailyTotal, biotinWarnings, PARACETAMOL as P, BIOTIN_SENSITIVE_CODES, BIOTIN_WASHOUT_DAYS,
  looksLikeBiotin, looksLikeParacetamol, takenOn,
  type MedicationLike, type ParacetamolOptions,
} from '../src/lib/drugChecks.ts';

const today = '2026-10-01';
type Figure = number | string | null;
const med = (name: string, mg: Figure, doses: Figure, extra: Record<string, unknown> = {}): MedicationLike => ({
  name, paracetamol_mg_per_dose: mg, doses_per_day: doses, start_date: null, end_date: null, ...extra,
});
const total = (meds: MedicationLike[], options?: Partial<ParacetamolOptions>) =>
  paracetamolDailyTotal(meds, { today, ...options });

test('no paracetamol anywhere is none, not ok', () => {
  assert.equal(total([]).status, P.NONE);
  assert.equal(total([med('Vitamin C', null, null)]).status, P.NONE);
  assert.equal(total([]).totalMg, 0);
});

test('dose and frequency multiply into a daily total', () => {
  const r = total([med('Paracetamol', '500', '4')]);
  assert.deepEqual([r.status, r.totalMg], [P.OK, 2000]);
  assert.deepEqual(r.items, [{ name: 'Paracetamol', mgPerDose: 500, dosesPerDay: 4, dailyMg: 2000 }]);
});

test('3000 mg starts the caution band and 4000 mg is still only caution', () => {
  assert.equal(total([med('a', 1000, 2.99)]).status, P.OK);
  assert.equal(total([med('a', 1000, 3)]).status, P.CAUTION);
  assert.equal(total([med('a', 1000, 4)]).status, P.CAUTION);
  assert.equal(total([med('a', 1000, 4), med('b', 1, 1)]).status, P.EXCEEDED);
});

test('products add up across rows, such as a cold remedy on top of a regular dose', () => {
  const r = total([med('Paracetamol', 1000, 3), med('Cold and flu sachet', 500, 3)]);
  assert.deepEqual([r.status, r.totalMg], [P.EXCEEDED, 4500]);
});

test('course dates decide what counts today, inclusive at both ends', () => {
  const at = (extra: Record<string, unknown>) => total([med('a', 1000, 4, extra)]).totalMg;
  assert.equal(at({ start_date: '2026-10-01' }), 4000);
  assert.equal(at({ start_date: '2026-10-02' }), 0);
  assert.equal(at({ end_date: '2026-10-01' }), 4000);
  assert.equal(at({ end_date: '2026-09-30' }), 0);
});

test('a course with a future end date still counts even though the active column would say it has ended', () => {
  const r = total([med('Paracetamol', 1000, 4, { end_date: '2026-10-08', active: false })]);
  assert.deepEqual([r.status, r.totalMg], [P.CAUTION, 4000]);
});

test('a row with only half the numbers is reported, never silently dropped', () => {
  const r = total([med('Paracetamol', 500, null)]);
  assert.deepEqual([r.status, r.totalMg, r.incomplete], [P.INCOMPLETE, 0, ['Paracetamol']]);
  assert.equal(total([med('Paracetamol', null, 4)]).status, P.INCOMPLETE);
  // a bigger finding is not hidden by the incomplete row
  assert.equal(total([med('a', 1000, 4), med('b', 1, 1), med('Paracetamol', 500, null)]).status, P.EXCEEDED);
  // an incomplete row that ended already does not matter
  assert.equal(total([med('Paracetamol', 500, null, { end_date: '2026-01-01' })]).status, P.NONE);
});

test('a product named paracetamol with no figures is reported as incomplete, never silently left out', () => {
  for (const name of ['Paracetamol 500', 'Dolo 650', 'Crocin', 'Panadol', 'Calpol', 'Tylenol', 'Acetaminophen']) {
    const r = total([med(name, null, null)]);
    assert.deepEqual([r.status, r.totalMg, r.incomplete], [P.INCOMPLETE, 0, [name]], name);
  }
  // a figure on a product with an unrelated name is still counted, and an unrelated product is still ignored
  assert.equal(total([med('Cold and flu sachet', 500, 3)]).totalMg, 1500);
  assert.equal(total([med('Vitamin C', null, null), med('Creatine', null, null)]).status, P.NONE);
  // finished and not-yet-started courses do not matter, however they are named
  assert.equal(total([med('Dolo 650', null, null, { end_date: '2026-09-01' })]).status, P.NONE);
  assert.equal(total([med('Dolo 650', null, null, { start_date: '2026-10-05' })]).status, P.NONE);
  // a known total is not hidden by an incomplete named product, and the product is still listed
  const mixed = total([med('a', 1000, 4), med('b', 1, 1), med('Crocin', null, null)]);
  assert.deepEqual([mixed.status, mixed.incomplete], [P.EXCEEDED, ['Crocin']]);
});

test('name helpers recognise products in any case and ignore look-alikes', () => {
  assert.equal(looksLikeParacetamol('PARACETAMOL 500mg'), true);
  assert.equal(looksLikeParacetamol('dolo-650'), true);
  assert.equal(looksLikeParacetamol('Ibuprofen'), false);
  assert.equal(looksLikeParacetamol('Dolomite'), false);
  assert.equal(looksLikeBiotin('Biotin 5000 mcg'), true);
  assert.equal(looksLikeBiotin('Vitamin B7'), true);
  assert.equal(looksLikeBiotin('Vitamin B12'), false);
});

test('takenOn is inclusive at both ends of a course', () => {
  const day = (s: string) => Date.UTC(+s.slice(0, 4), +s.slice(5, 7) - 1, +s.slice(8, 10)) / 86400000;
  const course = { name: 'x', start_date: '2026-10-01', end_date: '2026-10-03' };
  assert.deepEqual(['2026-09-30', '2026-10-01', '2026-10-03', '2026-10-04'].map((d) => takenOn(course, day(d))), [false, true, true, false]);
  assert.equal(takenOn({ name: 'x' }, day('2030-01-01')), true);
});

test('limits can be overridden', () => {
  assert.equal(total([med('a', 500, 4)], { cautionMg: 1500, maxMg: 1999 }).status, P.EXCEEDED);
  assert.equal(total([med('a', 500, 4)], { cautionMg: 2000 }).status, P.CAUTION);
});

test('bad figures and a missing date throw', () => {
  assert.throws(() => total([med('a', 'lots', 2)]), TypeError);
  assert.throws(() => total([med('a', -500, 2)]), RangeError);
  // @ts-expect-error the date is required on purpose
  assert.throws(() => paracetamolDailyTotal([med('a', 500, 2)], {}), TypeError);
  assert.throws(() => paracetamolDailyTotal([med('a', 500, 2)], { today: 'tomorrow' }), TypeError);
});

const biomarkers = [
  { id: 'tsh', code: 'tsh', name: 'TSH' },
  { id: 'vd', code: 'vitamin_d', name: 'Vitamin D' },
  { id: 'k', code: 'potassium', name: 'Potassium' },
];
const reading = (id: string, biomarker_id: string, measured_at: string) => ({ id, biomarker_id, value: '1', measured_at });
const biotin = (extra: Record<string, unknown> = {}): MedicationLike => ({ name: 'Biotin', dosage: '10 mg', start_date: '2026-01-01', end_date: null, ...extra });
const warn = (meds: MedicationLike[], readings: ReturnType<typeof reading>[]) => biotinWarnings({ medications: meds, readings, biomarkers });

test('only assays that biotin can distort are warned about', () => {
  const w = warn([biotin()], [reading('r1', 'tsh', '2026-06-06'), reading('r2', 'k', '2026-06-06'), reading('r3', 'vd', '2026-06-06')]);
  assert.deepEqual(w.map((x) => x.code), ['tsh', 'vitamin_d']);
  assert.deepEqual(w[0], {
    reading_id: 'r1', code: 'tsh', name: 'TSH', measured_at: '2026-06-06', medication: 'Biotin', dosage: '10 mg',
  });
});

test('no biotin product means no warnings', () => {
  assert.deepEqual(warn([{ name: 'Creatine' }], [reading('r1', 'tsh', '2026-06-06')]), []);
  assert.deepEqual(warn([], [reading('r1', 'tsh', '2026-06-06')]), []);
});

test('biotin is recognised by name, in any case, including vitamin B7', () => {
  for (const name of ['biotin', 'BIOTIN 5000 mcg', 'Hair Skin Nails - Biotin', 'Vitamin B7', 'vitamin b-7']) {
    assert.equal(warn([biotin({ name })], [reading('r1', 'tsh', '2026-06-06')]).length, 1, name);
  }
  for (const name of ['Biotinidase', 'Vitamin B12', 'Vitamin B6']) {
    assert.equal(warn([biotin({ name })], [reading('r1', 'tsh', '2026-06-06')]).length, 0, name);
  }
});

test('timing: warns while taking it and through the washout, not before or well after', () => {
  const r = (date: string) => [reading('r1', 'tsh', date)];
  const ended = biotin({ start_date: '2026-01-01', end_date: '2026-06-01' });
  assert.equal(warn([ended], r('2026-06-01')).length, 1);
  assert.equal(warn([ended], r(`2026-06-0${1 + BIOTIN_WASHOUT_DAYS}`)).length, 1);
  assert.equal(warn([ended], r(`2026-06-0${2 + BIOTIN_WASHOUT_DAYS}`)).length, 0);
  assert.equal(warn([ended], r('2025-12-31')).length, 0);
  assert.equal(warn([ended], r('2026-01-01')).length, 1);
});

test('missing dates are treated as taking it, because unknown is not safe', () => {
  assert.equal(warn([biotin({ start_date: null })], [reading('r1', 'tsh', '2019-01-01')]).length, 1);
  assert.equal(warn([biotin({ end_date: null })], [reading('r1', 'tsh', '2030-01-01')]).length, 1);
});

test('past readings are judged by the dates taken, not by whether the product is current', () => {
  const stopped = biotin({ start_date: '2022-01-01', end_date: '2022-06-30', active: false });
  assert.equal(warn([stopped], [reading('r1', 'tsh', '2022-04-10')]).length, 1);
  assert.equal(warn([stopped], [reading('r2', 'tsh', '2026-06-06')]).length, 0);
});

test('washout can be set, and two biotin products give two warnings', () => {
  const ended = biotin({ end_date: '2026-06-01' });
  const none = biotinWarnings({ medications: [ended], readings: [reading('r1', 'tsh', '2026-06-02')], biomarkers, washoutDays: 0 });
  assert.equal(none.length, 0);
  assert.equal(warn([biotin(), biotin({ name: 'Hair gummies with biotin' })], [reading('r1', 'tsh', '2026-06-06')]).length, 2);
});

test('the sensitive list uses codes that exist in the biomarkers table', () => {
  assert.deepEqual([...BIOTIN_SENSITIVE_CODES].sort(), [
    'cortisol', 'ferritin', 't3_free', 't4_free', 't4_total', 'testosterone', 'tsh', 'vitamin_b12', 'vitamin_d',
  ]);
});
