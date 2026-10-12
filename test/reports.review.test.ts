import { test } from 'node:test';
import assert from 'node:assert/strict';
import { REPORT_SOURCE, reviewRows, validateReview } from '../src/features/reports/review.ts';
import type { ParsedReport } from '../src/features/reports/parse.ts';
import type { Biomarker } from '../src/db/queries.ts';

// Invented markers and rows.
const marker = (id: string, name: string, unit: string): Biomarker => ({
  id, code: id, name, unit, category: 'x', organ_systems: [], ref_low: null, ref_high: null, optimal_low: null, optimal_high: null,
  description: null, sort_order: 0, created_at: '2026-01-01T00:00:00Z', critical_low: null, critical_high: null, threshold_source: null, ref_sex: null,
});
const MARKERS = [marker('hb', 'Hemoglobin', 'g/dL'), marker('ldl', 'LDL', 'mg/dL'), marker('vitd', 'Vitamin D', 'ng/mL')];
const row = (over: Partial<ParsedReport['rows'][number]>): ParsedReport['rows'][number] => ({
  line: 'x', biomarkerId: 'hb', label: 'Hb', value: 13.2, unit: 'g/dL', refLow: 12, refHigh: 15.5, unitMismatch: false, ...over,
});
const report: ParsedReport = {
  date: '2026-10-06',
  dateUnsure: false,
  rows: [
    row({}),
    row({ biomarkerId: 'ldl', label: 'LDL', value: 131, unit: 'mg/dL', refLow: null, refHigh: 100 }),
    row({ biomarkerId: 'vitd', label: 'Vitamin D', value: 18.4, unit: 'nmol/L', unitMismatch: true }),
    row({ biomarkerId: null, label: 'Interleukin 6', value: 3.1 }),
    row({ value: 13.4 }), // the same marker again
  ],
};

test('only plainly fine rows start ticked, and every unticked row says why', () => {
  const rows = reviewRows(report, MARKERS, []);
  assert.deepEqual(rows.map((r) => r.include), [true, true, false, false, false]);
  assert.match(rows[2].issue ?? '', /nmol\/L.*ng\/mL/);
  assert.match(rows[3].issue ?? '', /Not a marker/);
  assert.match(rows[4].issue ?? '', /twice/);
  // a result already stored for that marker on that date is not ticked again
  const again = reviewRows(report, MARKERS, [{ biomarker_id: 'ldl', measured_at: '2026-10-06' }]);
  assert.equal(again[1].include, false);
  assert.match(again[1].issue ?? '', /already have/);
});

test('saving: the ticked rows become results with their printed ranges, marked as from a report', () => {
  const rows = reviewRows(report, MARKERS, []);
  const result = validateReview(rows, '2026-10-06', MARKERS, [], '2026-10-12');
  assert.ok(result.ok);
  assert.deepEqual(result.inputs.map((i) => [i.biomarker_id, i.value, i.ref_low ?? null, i.ref_high ?? null, i.source, i.measured_at]), [
    ['hb', 13.2, 12, 15.5, REPORT_SOURCE, '2026-10-06'],
    ['ldl', 131, null, 100, REPORT_SOURCE, '2026-10-06'],
  ]);
});

test('every problem is reported before anything is saved', () => {
  const rows = reviewRows(report, MARKERS, []);
  assert.equal(validateReview(rows.map((r) => ({ ...r, include: false })), '2026-10-06', MARKERS, [], '2026-10-12').ok, false);
  const future = validateReview(rows, '2026-11-01', MARKERS, [], '2026-10-12');
  assert.ok(!future.ok);
  assert.match(future.dateError ?? '', /future/);
  // the person ticks the second haemoglobin too: that is a duplicate within the report
  const both = validateReview(rows.map((r, i) => (i === 4 ? { ...r, include: true } : r)), '2026-10-06', MARKERS, [], '2026-10-12');
  assert.ok(!both.ok);
  assert.ok(both.rowErrors.r4?.measured_at);
  // a typed-over value that is not a number
  const typo = validateReview(rows.map((r, i) => (i === 0 ? { ...r, value: '13..2' } : r)), '2026-10-06', MARKERS, [], '2026-10-12');
  assert.ok(!typo.ok);
  assert.ok(typo.rowErrors.r0?.value);
});
