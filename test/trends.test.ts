import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mannKendall, theilSenSlope, trendOfReadings, twoSidedNormalP, TREND } from '../src/lib/trends.ts';

const near = (actual: number | null, expected: number, rel = 1e-9) =>
  assert.ok(actual !== null && Math.abs(actual - expected) <= rel * Math.abs(expected), `${actual} vs ${expected}`);

// reference values from scipy.stats.norm and pymannkendall.original_test (MIT)
test('two-sided normal p matches scipy across the tail', () => {
  const cases = [
    [0, 1],
    [0.5, 0.6170750774519738],
    [1, 0.31731050786291415],
    [1.96, 0.04999579029644087],
    [2.5, 0.012419330651552265],
    [3, 0.0026997960632601866],
    [4, 6.334248366623973e-5],
    [5, 5.733031437583866e-7],
    [8, 1.244192114854348e-15],
    [10, 1.523970604832094e-23],
  ];
  for (const [z, p] of cases) {
    near(twoSidedNormalP(z), p);
    near(twoSidedNormalP(-z), p);
  }
});

test('matches pymannkendall on monotone, tied and noisy series', () => {
  const cases = [
    { values: [1, 2, 3, 4, 5, 6], direction: TREND.INCREASING, s: 15, variance: 28.333333333333332, z: 2.630142022557628, p: 0.008534920414227098 },
    { values: [6, 5, 4, 3, 2, 1], direction: TREND.DECREASING, s: -15, variance: 28.333333333333332, z: -2.630142022557628, p: 0.008534920414227098 },
    { values: [100, 104, 99, 110, 108, 115, 112, 120], direction: TREND.INCREASING, s: 20, variance: 65.33333333333333, z: 2.350640381700619, p: 0.018741136789596657 },
    { values: [5, 5, 5, 6, 6, 7, 7, 8], direction: TREND.INCREASING, s: 23, variance: 59.666666666666664, z: 2.8481102232138804, p: 0.0043979689615243345 },
    { values: [3, 1, 4, 1, 5, 9, 2, 6, 5, 3, 5], direction: TREND.NO_TREND, s: 16, variance: 159.33333333333334, z: 1.188332399294654, p: 0.23470247795516075 },
    { values: [110, 98, 105, 101, 99, 103, 107, 100], direction: TREND.NO_TREND, s: -2, variance: 65.33333333333333, z: -0.12371791482634838, p: 0.9015386266571279 },
    { values: [1, 2, 3, 4, 5], direction: TREND.INCREASING, s: 10, variance: 16.666666666666668, z: 2.2045407685048604, p: 0.0274863361115103 },
  ];
  for (const c of cases) {
    const r = mannKendall(c.values);
    assert.equal(r.direction, c.direction);
    assert.equal(r.n, c.values.length);
    assert.equal(r.s, c.s);
    near(r.variance, c.variance);
    near(r.z, c.z);
    near(r.p, c.p);
  }
});

test('alpha controls the significance cut-off', () => {
  const values = [100, 104, 99, 110, 108, 115, 112, 120];
  assert.equal(mannKendall(values, { alpha: 0.05 }).direction, TREND.INCREASING);
  assert.equal(mannKendall(values, { alpha: 0.01 }).direction, TREND.NO_TREND);
});

test('too few points is reported as insufficient data, not as no trend', () => {
  const r = mannKendall([1, 2, 3, 4]);
  assert.equal(r.direction, TREND.INSUFFICIENT_DATA);
  assert.equal(r.n, 4);
  assert.equal(r.p, null);
  assert.equal(mannKendall([1, 2, 3, 4], { minPoints: 4 }).direction, TREND.NO_TREND);
});

test('a constant series has no trend and p of 1', () => {
  const r = mannKendall([4, 4, 4, 4, 4, 4]);
  assert.deepEqual([r.direction, r.z, r.p], [TREND.NO_TREND, 0, 1]);
});

test('non-finite values are rejected', () => {
  assert.throws(() => mannKendall([1, 2, NaN, 4, 5]), TypeError);
  // @ts-expect-error a string in a numeric series is the point of the test
  assert.throws(() => mannKendall([1, 2, '3', 4, 5]), TypeError);
});

function permutationVariance(values: number[]): number {
  const counts = new Map<number, number>();
  for (const v of values) counts.set(v, (counts.get(v) ?? 0) + 1);
  const keys = [...counts.keys()];
  const perm: number[] = [];
  let total = 0;
  let sum = 0;
  let sumSq = 0;
  (function walk() {
    if (perm.length === values.length) {
      let s = 0;
      for (let i = 0; i < perm.length - 1; i++) {
        for (let j = i + 1; j < perm.length; j++) s += Math.sign(perm[j] - perm[i]);
      }
      total++;
      sum += s;
      sumSq += s * s;
      return;
    }
    for (const k of keys) {
      if (counts.get(k) === 0) continue;
      counts.set(k, (counts.get(k) ?? 0) - 1);
      perm.push(k);
      walk();
      perm.pop();
      counts.set(k, (counts.get(k) ?? 0) + 1);
    }
  })();
  return sumSq / total - (sum / total) ** 2;
}

test('variance equals the exact permutation variance, including ties', () => {
  const multisets = [[1, 2, 3, 4, 5, 6], [1, 1, 2, 3, 3], [2, 2, 2, 5, 7, 7, 9], [4, 4, 4, 4, 4, 4]];
  for (const values of multisets) {
    const { variance } = mannKendall(values, { minPoints: 0 });
    assert.ok(variance !== null && Math.abs(variance - permutationVariance(values)) < 1e-9, values.join(','));
  }
});

test('Theil-Sen slope is the median of pairwise slopes', () => {
  assert.equal(theilSenSlope([0, 1, 2], [0, 1, 4]), 2);
  near(theilSenSlope([0, 10, 45, 60, 200, 365], [100, 101, 108, 107, 130, 150]), 0.13802816901408452);
  assert.equal(theilSenSlope([0, 1, 2, 3, 4], [1, 2, 3, 4, 100]), 1);
  assert.equal(theilSenSlope([3, 3, 3], [1, 2, 3]), null);
});

const readings = ([
  ['2025-01-01', 100],
  ['2025-01-11', 101],
  ['2025-02-15', 108],
  ['2025-03-02', 107],
  ['2025-07-20', 130],
  ['2026-01-01', 150],
] as const).map(([measured_at, value]) => ({ measured_at: measured_at as string, value: value as number | string | null }));

test('trendOfReadings orders by date and reports a per-day slope', () => {
  const sorted = trendOfReadings(readings);
  assert.equal(sorted.direction, TREND.INCREASING);
  near(sorted.slopePerDay, 0.13802816901408452);
  assert.deepEqual(trendOfReadings([...readings].reverse()), sorted);
  assert.deepEqual(trendOfReadings([readings[3], readings[0], readings[5], readings[1], readings[4], readings[2]]), sorted);
});

test('trendOfReadings accepts numeric strings and reports insufficient data', () => {
  const asStrings = readings.map((r) => ({ ...r, value: String(r.value) }));
  assert.deepEqual(trendOfReadings(asStrings), trendOfReadings(readings));
  const few = trendOfReadings(readings.slice(0, 4));
  assert.equal(few.direction, TREND.INSUFFICIENT_DATA);
  assert.equal(few.slopePerDay, null);
});

test('trendOfReadings rejects missing values and bad dates', () => {
  assert.throws(() => trendOfReadings([...readings.slice(0, 5), { measured_at: '2026-02-01', value: null }]), TypeError);
  assert.throws(() => trendOfReadings([{ measured_at: 'yesterday', value: 1 }]), TypeError);
});
