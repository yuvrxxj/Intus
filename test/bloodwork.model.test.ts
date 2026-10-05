import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildBloodworkView, changeBetween, rangeStatus, type Point } from '../src/features/bloodwork/model.ts';
import { describeDays, formatDay, formatDelta, formatRange, formatValue } from '../src/features/bloodwork/format.ts';
import { CRITICAL } from '../src/lib/safety.ts';
import { TREND } from '../src/lib/trends.ts';
import type { Biomarker, BiomarkerReading } from '../src/db/queries.ts';

// Invented numbers, shaped like rows from the live tables. They exercise the logic and say nothing about real limits.
let n = 0;
const marker = (over: Partial<Biomarker> & Pick<Biomarker, 'id' | 'code'>): Biomarker => ({
  name: over.code.toUpperCase(),
  unit: 'u',
  category: 'Group A',
  organ_systems: [],
  ref_low: null,
  ref_high: null,
  optimal_low: null,
  optimal_high: null,
  description: null,
  sort_order: n++,
  created_at: '2026-01-01T00:00:00Z',
  critical_low: null,
  critical_high: null,
  threshold_source: null,
  threshold_verified_at: null,
  threshold_verified_by: null,
  ...over,
});
// stands in for a clinician sign-off; without it a marker's limits are held back from every alert
const SIGNED_OFF = { threshold_verified_at: '2026-01-01T00:00:00Z', threshold_verified_by: 'test fixture' };
const reading = (id: string, biomarker_id: string, measured_at: string, value: number | string): BiomarkerReading => ({
  id,
  biomarker_id,
  measured_at,
  value: value as number,
  notes: null,
  created_at: '2026-01-01T00:00:00Z',
  status: null,
  source: 'lab',
  user_id: 'u',
});

const potassium = marker({ id: 'k', code: 'potassium', ref_low: 3.5, ref_high: 5.1, critical_low: 2.8, critical_high: 6, ...SIGNED_OFF });
const albumin = marker({ id: 'a', code: 'albumin', category: 'Group B', ref_low: 3.4, ref_high: 4.8 });
const tsh = marker({ id: 't', code: 'tsh', category: 'Group B', ref_high: 4.78 });
const unmeasured = marker({ id: 'u', code: 'ferritin', name: 'Ferritin' });
const biomarkers = [potassium, albumin, tsh, unmeasured];

test('markers are grouped by category in database order, and markers without results are listed apart', () => {
  const view = buildBloodworkView({
    biomarkers,
    readings: [reading('r1', 'a', '2026-06-06', 4.1), reading('r2', 'k', '2026-06-06', 4.2), reading('r3', 't', '2026-06-06', 2)],
  });
  assert.deepEqual(view.groups.map((g) => [g.category, g.rows.map((r) => r.biomarker.code)]), [
    ['Group A', ['potassium']],
    ['Group B', ['albumin', 'tsh']],
  ]);
  assert.deepEqual(view.noResults, ['Ferritin']);
  assert.equal(view.latestDate, '2026-06-06');
  assert.deepEqual([view.readingCount, view.dateCount], [3, 1]);
});

test('reference range is inclusive at both ends and says no_range when none is stored', () => {
  assert.equal(rangeStatus(potassium, 3.5), 'in_range');
  assert.equal(rangeStatus(potassium, 5.1), 'in_range');
  assert.equal(rangeStatus(potassium, 3.49), 'below');
  assert.equal(rangeStatus(potassium, 5.11), 'above');
  assert.equal(rangeStatus(tsh, 0.01), 'in_range');
  assert.equal(rangeStatus(tsh, 4.79), 'above');
  assert.equal(rangeStatus(unmeasured, 1e9), 'no_range');
  assert.throws(() => rangeStatus({ ...potassium, ref_low: 6, ref_high: 5 }, 4), RangeError);
});

test('change compares the latest result with the one before it, in date order whatever order rows arrive in', () => {
  const view = buildBloodworkView({
    biomarkers: [potassium],
    readings: [reading('r3', 'k', '2026-06-06', 4.5), reading('r1', 'k', '2022-04-10', 4), reading('r2', 'k', '2024-06-16', 4.2)],
  });
  const row = view.groups[0].rows[0];
  assert.equal(row.latest.value, 4.5);
  assert.equal(row.previous?.measured_at, '2024-06-16');
  assert.equal(row.change?.direction, 'up');
  assert.ok(Math.abs((row.change?.delta ?? 0) - 0.3) < 1e-9);
  assert.equal(row.change?.days, 720);
  assert.deepEqual(row.points.map((p) => p.measured_at), ['2022-04-10', '2024-06-16', '2026-06-06']);
});

test('a single result has no change, and an unchanged or zero baseline is handled', () => {
  const only = buildBloodworkView({ biomarkers: [potassium], readings: [reading('r1', 'k', '2026-06-06', 4)] });
  assert.equal(only.groups[0].rows[0].change, null);
  assert.equal(only.groups[0].rows[0].previous, null);

  const point = (value: number, day: number): Point => ({ id: 'p', measured_at: 'x', day, value, source: null, notes: null });
  assert.equal(changeBetween(point(4, 10), point(4, 20)).direction, 'flat');
  assert.equal(changeBetween(point(4, 10), point(3, 20)).direction, 'down');
  assert.equal(changeBetween(point(0, 10), point(3, 20)).percent, null);
  assert.equal(changeBetween(point(200, 10), point(150, 20)).percent, -25);
});

test('numeric strings from the database behave like numbers', () => {
  const view = buildBloodworkView({
    biomarkers: [{ ...potassium, ref_low: '3.5' as unknown as number, critical_high: '6.0' as unknown as number }],
    readings: [reading('r1', 'k', '2024-01-01', '4.0'), reading('r2', 'k', '2026-01-01', '6.0')],
  });
  const row = view.groups[0].rows[0];
  assert.equal(row.latest.value, 6);
  assert.equal(row.critical.status, CRITICAL.HIGH);
  assert.equal(row.range, 'above');
});

test('a critical result is current when it is the marker\'s latest, and past once a later result exists', () => {
  const view = buildBloodworkView({
    biomarkers: [potassium, albumin],
    readings: [
      reading('r1', 'k', '2022-04-10', 6.2), // critical high, later superseded
      reading('r2', 'k', '2026-06-06', 4.1),
      reading('r3', 'a', '2026-06-06', 0), // no limits on albumin, so never critical
    ],
  });
  assert.deepEqual(view.currentCritical, []);
  assert.deepEqual(view.pastCritical.map((f) => [f.code, f.measured_at, f.status]), [['potassium', '2022-04-10', CRITICAL.HIGH]]);

  const now = buildBloodworkView({
    biomarkers: [potassium],
    readings: [reading('r1', 'k', '2022-04-10', 4.1), reading('r2', 'k', '2026-06-06', 2.8)],
  });
  assert.deepEqual(now.currentCritical.map((f) => [f.code, f.status]), [['potassium', CRITICAL.LOW]]);
  assert.equal(now.groups[0].rows[0].critical.status, CRITICAL.LOW);
});

test('markers with no critical limit are listed as unwatched and never read as ok', () => {
  const view = buildBloodworkView({
    biomarkers,
    readings: [reading('r1', 'a', '2026-06-06', 0.1)],
  });
  assert.deepEqual(view.unwatched, ['ALBUMIN', 'TSH', 'Ferritin']);
  assert.equal(view.groups[0].rows[0].critical.status, CRITICAL.NO_THRESHOLD);
  assert.deepEqual(view.currentCritical, []);
});

test('with no signed-off limits the view raises no critical alert at all, and says which markers were held back', () => {
  const unsigned = { ...potassium, threshold_verified_at: null, threshold_verified_by: null };
  const view = buildBloodworkView({
    biomarkers: [unsigned, albumin],
    readings: [reading('r1', 'k', '2022-04-10', 9), reading('r2', 'k', '2026-06-06', 1.5), reading('r3', 'a', '2026-06-06', 4)],
  });
  assert.deepEqual([view.currentCritical, view.pastCritical], [[], []]);
  assert.equal(view.verifiedCount, 0);
  assert.deepEqual(view.unverified, ['POTASSIUM']);
  assert.deepEqual(view.unwatched, ['ALBUMIN']);
  const row = view.groups[0].rows[0];
  assert.equal(row.critical.status, CRITICAL.UNVERIFIED);
  // the lab reference range still applies: a value far below it is flagged as below range, not as critical
  assert.equal(row.range, 'below');
});

test('signed-off and unsigned markers sit side by side: only the signed-off one can alert', () => {
  const unsigned = marker({ id: 'n', code: 'sodium', ref_low: 135, ref_high: 145, critical_low: 120, critical_high: 160 });
  const view = buildBloodworkView({
    biomarkers: [potassium, unsigned],
    readings: [reading('r1', 'k', '2026-06-06', 6.4), reading('r2', 'n', '2026-06-06', 170)],
  });
  assert.deepEqual(view.currentCritical.map((f) => [f.code, f.status]), [['potassium', CRITICAL.HIGH]]);
  assert.equal(view.verifiedCount, 1);
  assert.deepEqual(view.unverified, ['SODIUM']);
});

test('data that cannot be trusted throws instead of being skipped', () => {
  assert.throws(
    () => buildBloodworkView({ biomarkers: [potassium], readings: [reading('r1', 'ghost', '2026-06-06', 4)] }),
    /unknown biomarker ghost/,
  );
  assert.throws(
    () => buildBloodworkView({ biomarkers: [potassium], readings: [reading('r1', 'k', '2026-06-06', 'abc')] }),
    TypeError,
  );
  assert.throws(
    () => buildBloodworkView({ biomarkers: [potassium], readings: [reading('r1', 'k', 'sometime', 4)] }),
    TypeError,
  );
  assert.throws(
    () => buildBloodworkView({ biomarkers: [{ ...potassium, critical_low: 7 }], readings: [reading('r1', 'k', '2026-06-06', 4)] }),
    RangeError,
  );
});

test('a statistical trend needs five results; with fewer the row says so and the view counts none', () => {
  const four = buildBloodworkView({
    biomarkers: [potassium],
    readings: ['2022-01-01', '2023-01-01', '2024-01-01', '2025-01-01'].map((d, i) => reading(`r${i}`, 'k', d, 4 + i * 0.1)),
  });
  assert.equal(four.groups[0].rows[0].trend.direction, TREND.INSUFFICIENT_DATA);
  assert.equal(four.trendable, 0);

  const six = buildBloodworkView({
    biomarkers: [potassium],
    readings: ['2022-01-01', '2022-07-01', '2023-01-01', '2023-07-01', '2024-01-01', '2024-07-01'].map((d, i) =>
      reading(`r${i}`, 'k', d, 3.6 + i * 0.2),
    ),
  });
  assert.equal(six.groups[0].rows[0].trend.direction, TREND.INCREASING);
  assert.equal(six.trendable, 1);
});

test('an empty database yields an empty but valid view', () => {
  const view = buildBloodworkView({ biomarkers, readings: [] });
  assert.deepEqual([view.groups, view.latestDate, view.readingCount, view.dateCount], [[], null, 0, 0]);
  assert.deepEqual(view.noResults, ['POTASSIUM', 'ALBUMIN', 'TSH', 'Ferritin']);
});

test('formatting reads dates from the text and keeps lab values as written', () => {
  assert.equal(formatDay('2026-06-06'), '6 Jun 2026');
  assert.equal(formatDay('2022-12-31'), '31 Dec 2022');
  assert.equal(formatValue(9.89), '9.89');
  assert.equal(formatValue(14), '14');
  assert.equal(formatValue(0.1 + 0.2), '0.3');
  assert.equal(formatDelta(-0.30000000000000004), '0.3');
  assert.equal(formatRange(3.5, 5.1), '3.5–5.1');
  assert.equal(formatRange(null, 106), '<106');
  assert.equal(formatRange(65, null), '>65');
  assert.equal(formatRange(null, null), 'none set');
  assert.equal(describeDays(0), 'the same day');
  assert.equal(describeDays(1), '1 day earlier');
  assert.equal(describeDays(200), '7 months earlier');
  assert.equal(describeDays(720), '2.0 years earlier');
});
