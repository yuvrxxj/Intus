import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  AFTER_MAX_DAYS, BEFORE_DAYS, BLOOD_MIN_DAYS_ON, MIN_DAYS, RAMP_DAYS,
  bloodPairs, compare, concurrentChanges, effectReport, metricEffects, statsOf, windowsFor,
} from '../src/features/supplements/effect.ts';
import { dayNumber, isoDay } from '../src/lib/dates.ts';
import type { DailyLog } from '../src/db/dailyLogs.ts';
import type { Medication } from '../src/db/medications.ts';
import type { Biomarker, BiomarkerReading } from '../src/db/queries.ts';

// Invented rows shaped like the live tables. They exercise the logic and say nothing about any real supplement.
const supplement = (over: Partial<Medication> & Pick<Medication, 'id' | 'name'>): Medication => ({
  active: true, created_at: '2026-01-01T00:00:00Z', days_of_week: [0, 1, 2, 3, 4, 5, 6], dosage: null, doses_per_day: 1,
  end_date: null, frequency: null, notes: null, paracetamol_mg_per_dose: null, start_date: null, user_id: 'u', ...over,
});
const log = (log_date: string, over: Partial<DailyLog> = {}): DailyLog => ({
  active_kcal: null, carbs: null, cardio: null, cigs: null, core: null, fat: null, habits: {}, id: log_date, lift: null,
  log_date, mood: null, mood_notes: null, protein: null, rings: null, saved_at: null, steps: null, supplements: null,
  total_cals: null, user_id: 'u', water_ml: null, weight: null, ...over,
});
const marker = (over: Partial<Biomarker> & Pick<Biomarker, 'id' | 'code'>): Biomarker => ({
  name: over.code.toUpperCase(), unit: 'u', category: 'Group A', organ_systems: [], ref_low: null, ref_high: null,
  optimal_low: null, optimal_high: null, description: null, sort_order: 0, created_at: '2026-01-01T00:00:00Z',
  critical_low: null, critical_high: null, threshold_source: null, threshold_verified_at: null, threshold_verified_by: null,
  ...over,
});
const reading = (id: string, biomarker_id: string, measured_at: string, value: number | string): BiomarkerReading => ({
  id, biomarker_id, measured_at, value: value as number, notes: null, created_at: '2026-01-01T00:00:00Z', status: null, source: 'lab', user_id: 'u',
});

const START = '2026-03-01';
const s = dayNumber(START);
const day = (offset: number) => isoDay(s + offset);
/** repeatable "noise" that averages out: -0.4, -0.2, 0, 0.2, 0.4 */
const wobble = (i: number) => ((i % 5) - 2) * 0.2;

test('windows: 28 days before, then from day 8 for at most 56 days, never past the end date or today', () => {
  const open = windowsFor({ start_date: START, end_date: null }, '2027-01-01');
  // the documented contract, written out as plain numbers so a change to the rules has to change this test too
  assert.deepEqual(open, { beforeFrom: s - 28, beforeTo: s - 1, afterFrom: s + 8, afterTo: s + 63 });
  assert.deepEqual([BEFORE_DAYS, RAMP_DAYS, AFTER_MAX_DAYS, MIN_DAYS, BLOOD_MIN_DAYS_ON], [28, 7, 56, 10, 14]);
  assert.equal(windowsFor({ start_date: START, end_date: day(20) }, '2027-01-01')?.afterTo, s + 20);
  assert.equal(windowsFor({ start_date: START, end_date: null }, day(30))?.afterTo, s + 30);
  assert.equal(windowsFor({ start_date: null, end_date: null }, '2027-01-01'), null);
});

test('statsOf uses the sample standard deviation and says null when it cannot', () => {
  const stats = statsOf([2, 4, 4, 4, 5, 5, 7, 9]);
  assert.equal(stats.n, 8);
  assert.equal(stats.mean, 5);
  assert.ok(Math.abs((stats.sd ?? 0) - Math.sqrt(32 / 7)) < 1e-12);
  assert.deepEqual(statsOf([3]), { n: 1, mean: 3, sd: null });
  assert.deepEqual(statsOf([]), { n: 0, mean: null, sd: null });
});

const series = (n: number, centre: number, spread = 1) => statsOf(Array.from({ length: n }, (_, i) => centre + wobble(i) * spread));

test('compare needs ten logged days in each period before it says anything', () => {
  assert.equal(compare(series(MIN_DAYS - 1, 70), series(30, 80)).verdict, 'insufficient_data');
  assert.equal(compare(series(30, 70), series(MIN_DAYS - 1, 80)).verdict, 'insufficient_data');
  assert.equal(compare(series(0, 70), series(30, 80)).verdict, 'insufficient_data');
  assert.equal(compare(series(MIN_DAYS, 70), series(MIN_DAYS, 80)).verdict, 'higher');
});

test('compare: a shift well outside ordinary variation is higher or lower, with the size and percent', () => {
  const before = series(28, 70);
  const after = series(40, 72);
  const up = compare(before, after);
  assert.equal(up.verdict, 'higher');
  // the wobble does not average to exactly zero over 28 days, so work the expectation out from the means
  const diff = (after.mean ?? 0) - (before.mean ?? 0);
  assert.ok(Math.abs(diff - 2) < 0.05);
  assert.ok(Math.abs((up.diff ?? 0) - diff) < 1e-12);
  assert.ok(Math.abs((up.percent ?? 0) - (diff / (before.mean ?? 1)) * 100) < 1e-9);
  assert.ok((up.effectSize ?? 0) > 0.5);
  assert.equal(compare(series(28, 72), series(40, 70)).verdict, 'lower');
});

test('compare: a small shift against big day-to-day swings is no clear change, not an effect', () => {
  // averages differ by 1, but days swing by about 8 either way
  const result = compare(series(28, 70, 20), series(40, 71, 20));
  assert.equal(result.verdict, 'no_clear_change');
  assert.ok(Math.abs(result.effectSize ?? 9) < 0.5);
});

test('compare: an unchanged average is no clear change, and flat series are handled without dividing by zero', () => {
  assert.equal(compare(series(28, 70), series(28, 70)).verdict, 'no_clear_change');
  const flatSame = compare(statsOf(Array(12).fill(5)), statsOf(Array(12).fill(5)));
  assert.deepEqual([flatSame.verdict, flatSame.effectSize, flatSame.diff], ['no_clear_change', null, 0]);
  const flatMoved = compare(statsOf(Array(12).fill(3)), statsOf(Array(12).fill(4)));
  assert.deepEqual([flatMoved.verdict, flatMoved.effectSize], ['higher', null]);
  // a zero baseline has no percentage
  assert.equal(compare(statsOf(Array(12).fill(0)), series(12, 1)).percent, null);
});

test('metricEffects: ramp-up days, days after the end date and days outside the before window are left out', () => {
  const item = { start_date: START, end_date: day(45) };
  const logs: DailyLog[] = [];
  for (let off = -60; off <= 90; off++) {
    let weight: number;
    if (off < -28) weight = 500; // too early to count
    else if (off < 0) weight = 80 + wobble(off + 100);
    else if (off <= 7) weight = 999; // first week, still ramping up
    else if (off <= 45) weight = 82 + wobble(off);
    else weight = 777; // after the course ended
    logs.push(log(day(off), { weight }));
  }
  const [weight] = metricEffects(item, logs, day(90));
  assert.equal(weight.id, 'weight');
  assert.equal(weight.before.n, 28);
  assert.equal(weight.after.n, 38); // days 8 to 45
  assert.ok(Math.abs((weight.before.mean ?? 0) - 80) < 0.2);
  assert.ok(Math.abs((weight.after.mean ?? 0) - 82) < 0.2);
  assert.equal(weight.verdict, 'higher');
});

test('metricEffects: missing and unreadable values are skipped rather than read as zero, numeric strings count', () => {
  const logs: DailyLog[] = [];
  for (let off = -28; off <= -1; off++) logs.push(log(day(off), { steps: off % 2 === 0 ? 8000 : null, mood: off % 3 === 0 ? ('abc' as unknown as number) : 3 }));
  for (let off = 8; off <= 40; off++) logs.push(log(day(off), { steps: String(9000 + wobble(off) * 10) as unknown as number, mood: 3 }));
  const effects = metricEffects({ start_date: START, end_date: null }, logs, day(100));
  const steps = effects.find((e) => e.id === 'steps');
  const mood = effects.find((e) => e.id === 'mood');
  assert.equal(steps?.before.n, 14);
  assert.equal(steps?.before.mean, 8000);
  assert.equal(steps?.after.n, 33);
  assert.equal(mood?.before.n, 19); // 28 days less the 9 (offsets -27, -24 ... -3) whose mood was not a number
  assert.equal(mood?.before.mean, 3);
  // nothing was logged for weight, so it does not appear at all
  assert.equal(effects.some((e) => e.id === 'weight'), false);
});

test('metricEffects with no start date has nothing to compare against', () => {
  assert.deepEqual(metricEffects({ start_date: null, end_date: null }, [log(START, { weight: 80 })], '2026-06-01'), []);
});

test('bloodPairs: last result on or before the start, latest result at least two weeks in and not past the end', () => {
  const k = marker({ id: 'k', code: 'potassium', name: 'Potassium', ref_low: 3.5, ref_high: 5.1 });
  const item = { start_date: START, end_date: day(120) };
  const pairs = bloodPairs(item, [k], [
    reading('r0', 'k', day(-200), 3.0), // older than the last pre-start result
    reading('r1', 'k', day(-10), '3.4'), // the "before"
    reading('r2', 'k', day(13), 9), // too soon after starting
    reading('r3', 'k', day(60), 4.0),
    reading('r4', 'k', day(100), 4.4), // the "after": latest within the course
    reading('r5', 'k', day(200), 8), // after the course ended
  ]);
  assert.equal(pairs.length, 1);
  const [pair] = pairs;
  assert.deepEqual([pair.before.value, pair.before.measured_at, pair.before.range], [3.4, day(-10), 'below']);
  assert.deepEqual([pair.after.value, pair.after.measured_at, pair.after.range], [4.4, day(100), 'in_range']);
  assert.ok(Math.abs(pair.delta - 1) < 1e-9);
  assert.equal(pair.daysOn, 100);
});

test('bloodPairs: a marker needs a result on both sides, a zero baseline has no percent, and unreadable rows are skipped', () => {
  const a = marker({ id: 'a', code: 'a' });
  const b = marker({ id: 'b', code: 'b' });
  const c = marker({ id: 'c', code: 'c' });
  const pairs = bloodPairs({ start_date: START, end_date: null }, [a, b, c], [
    reading('1', 'a', day(-5), 1), // only a before result: no pair
    reading('2', 'b', day(-5), 0),
    reading('3', 'b', day(40), 2),
    reading('4', 'c', day(-5), 'oops'), // unreadable, so c has no before result
    reading('5', 'c', day(40), 2),
  ]);
  assert.deepEqual(pairs.map((p) => p.biomarker.code), ['b']);
  assert.equal(pairs[0].percent, null);
  assert.equal(bloodPairs({ start_date: null, end_date: null }, [a], [reading('1', 'a', day(-5), 1)]).length, 0);
});

test('concurrentChanges lists other supplements started or stopped close enough to confuse the comparison', () => {
  const creatine = supplement({ id: 'c', name: 'Creatine', start_date: START });
  const others = [
    creatine,
    supplement({ id: 'm', name: 'Magnesium', start_date: day(-10) }), // started inside the before window
    supplement({ id: 'v', name: 'Vitamin D', start_date: day(20) }), // started inside the after window
    supplement({ id: 'r', name: 'Ramping', start_date: day(-33) }), // began a few days before the window opens, still ramping up in it
    supplement({ id: 'p', name: 'Paused', start_date: day(-300), end_date: day(15) }), // stopped inside the after window
    supplement({ id: 'f', name: 'Fish oil', start_date: day(-400) }), // taken throughout, unchanged: not a confounder
    supplement({ id: 'o', name: 'Old', start_date: day(-400), end_date: day(-200) }), // came and went long before
    supplement({ id: 'z', name: 'Zinc', start_date: day(500) }), // long after
    supplement({ id: 'n', name: 'No date' }),
  ];
  assert.deepEqual(concurrentChanges(creatine, others, day(200)), ['Magnesium', 'Vitamin D', 'Ramping', 'Paused']);
  // the window opens 28 days before the start; one week further back is still counted, one day more is not
  const edge = (start: number) => concurrentChanges(creatine, [creatine, supplement({ id: 'e', name: 'Edge', start_date: day(start) })], day(200));
  assert.deepEqual(edge(-35), ['Edge']);
  assert.deepEqual(edge(-36), []);
});

test('effectReport: no start date, not started yet, and ready', () => {
  const today = day(30);
  const noDate = supplement({ id: 'x', name: 'X' });
  assert.deepEqual(
    (({ status, earliestVerdict, metrics }) => ({ status, earliestVerdict, metrics }))(effectReport(noDate, [noDate], [], [], [], today)),
    { status: 'no_start_date', earliestVerdict: null, metrics: [] },
  );

  const later = supplement({ id: 'y', name: 'Y', start_date: day(60) });
  const notYet = effectReport(later, [later], [], [], [], today);
  assert.equal(notYet.status, 'not_started');
  assert.equal(notYet.earliestVerdict, day(60 + 17)); // 7 days of ramp-up, then 10 days to log

  const going = supplement({ id: 'g', name: 'G', start_date: START });
  const logs = [];
  for (let off = -28; off <= 30; off++) logs.push(log(day(off), { steps: off < 0 ? 6000 + wobble(off + 50) * 100 : 9000 + wobble(off) * 100 }));
  const report = effectReport(going, [going], logs, [], [], today);
  assert.equal(report.status, 'ready');
  assert.equal(report.earliestVerdict, day(17));
  assert.equal(report.metrics.find((m) => m.id === 'steps')?.verdict, 'higher');
});
