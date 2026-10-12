import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ORGANS, habitLevel, markerLevel, organStates } from '../src/features/organs/model.ts';
import { renderAscii } from '../src/components/ui/ascii-engine.ts';
import type { Biomarker, BiomarkerReading } from '../src/db/queries.ts';
import type { Habit } from '../src/db/habits.ts';

// Invented rows shaped like the live tables.
const marker = (over: Partial<Biomarker> & Pick<Biomarker, 'id' | 'code'>): Biomarker => ({
  name: over.code.toUpperCase(), unit: 'u', category: 'x', organ_systems: [], ref_low: null, ref_high: null,
  optimal_low: null, optimal_high: null, description: null, sort_order: 0, created_at: '2026-01-01T00:00:00Z',
  critical_low: null, critical_high: null, threshold_source: null, ...over,
});
const reading = (biomarker_id: string, measured_at: string, value: number | string): BiomarkerReading => ({
  id: `${biomarker_id}-${measured_at}`, biomarker_id, measured_at, value: value as number, notes: null, created_at: '2026-01-01T00:00:00Z', status: null, source: 'lab', user_id: 'u',
});
const habit = (over: Partial<Habit> & Pick<Habit, 'id' | 'name' | 'kind'>): Habit => ({
  archived_at: null, better: 'higher', created_at: '2026-01-01T00:00:00Z', goal: null, sort_order: 0, unit: null, user_id: 'u', ...over,
} as Habit);

test('markerLevel: in range is full; past a limit fades at 10% and 25% of that limit', () => {
  const alt = marker({ id: 'a', code: 'alt', ref_low: 7, ref_high: 56, unit: 'U/L' });
  assert.equal(markerLevel(alt, 30)?.level, 'full');
  assert.equal(markerLevel(alt, 61.5)?.level, 'light'); // just under 10% past
  assert.equal(markerLevel(alt, 70)?.level, 'pale'); // 25% past
  assert.equal(markerLevel(alt, 71)?.level, 'grey');
  assert.equal(markerLevel(alt, 6.5)?.level, 'light'); // below, about 7% past
  assert.match(markerLevel(alt, 70)?.detail ?? '', /above the lab's range of 56 \(25% past\)/);
  // no printed range, or a range the wrong way round, gives no reading rather than a guess
  assert.equal(markerLevel(marker({ id: 'b', code: 'b' }), 5), null);
  assert.equal(markerLevel(marker({ id: 'c', code: 'c', ref_low: 9, ref_high: 3 }), 5), null);
});

test('habitLevel: each cigarette past the slack fades the lungs further; higher habits against their goal', () => {
  const cigs = { kind: 'count', goal: null, better: 'lower', unit: null } as const;
  assert.deepEqual([0, 1, 3, 4, 6, 7].map((n) => habitLevel(cigs, n).level), ['full', 'light', 'light', 'pale', 'pale', 'grey']);
  const steps = { kind: 'amount', goal: 10000, better: 'higher', unit: 'steps' } as const;
  assert.deepEqual([10000, 5000, 4999].map((n) => habitLevel(steps, n).level), ['full', 'light', 'pale']);
  assert.equal(habitLevel({ kind: 'yesno', goal: null, better: 'lower', unit: null }, true).level, 'pale');
  assert.equal(habitLevel({ kind: 'yesno', goal: null, better: 'higher', unit: null }, true).level, 'full');
});

test('organStates: latest result per marker, matching habits, the furthest reading wins, nothing logged is null', () => {
  const biomarkers = [
    marker({ id: 'ldl', code: 'ldl', name: 'LDL', ref_low: 0, ref_high: 116 }),
    marker({ id: 'hdl', code: 'hdl', name: 'HDL', ref_low: 39, ref_high: 100 }),
    marker({ id: 'tsh', code: 'tsh', name: 'TSH', ref_low: 0.4, ref_high: 4 }),
  ];
  const readings = [
    reading('ldl', '2025-01-01', 200), // old and far off, replaced by the latest
    reading('ldl', '2026-06-01', '100'),
    reading('hdl', '2026-06-01', 33), // about 15% below
    reading('tsh', '2026-06-01', 'abc'), // unreadable, skipped
  ];
  const habits = [
    habit({ id: 'c', name: 'Cigarettes', kind: 'count', better: 'lower' }),
    habit({ id: 'w', name: 'Water', kind: 'amount', goal: 3000, unit: 'ml' }),
    habit({ id: 'old', name: 'Old cigs', kind: 'count', better: 'lower', archived_at: '2026-01-01T00:00:00Z' }),
  ];
  const states = organStates({ biomarkers, readings, habits, entries: { c: { value: 8 }, old: { value: 50 } }, sleep: null });
  const by = Object.fromEntries(states.map((s) => [s.def.id, s]));
  assert.deepEqual(states.map((s) => s.def.id), ORGANS.map((o) => o.id));
  assert.equal(by.heart.level, 'pale');
  assert.deepEqual(by.heart.signals.map((s) => [s.label, s.level]), [['LDL', 'full'], ['HDL', 'pale']]);
  assert.equal(by.lungs.level, 'grey');
  assert.equal(by.lungs.signals.length, 1); // the archived habit is not read
  assert.equal(by.kidneys.level, null); // water has no entry today
  assert.equal(by.thyroid.level, null);
  assert.equal(by.brain.level, null);
});

test('organStates: sleep sets the brain from the usual night against the age band', () => {
  const base = { biomarkers: [], readings: [], habits: [], entries: {} };
  const brain = (durationClass: 'within' | 'shorter-possible' | 'shorter' | null, min: number | null = 420) =>
    organStates({ ...base, sleep: { medianAsleepMin: min, durationClass, windowDays: 28 } }).find((s) => s.def.id === 'brain')!;
  assert.equal(brain('within').level, 'full');
  assert.equal(brain('shorter-possible').level, 'light');
  assert.equal(brain('shorter').level, 'pale');
  assert.match(brain('within', 425).signals[0].detail, /7 h 05 min on a usual night over 28 days/);
  assert.equal(brain(null).level, null);
  assert.equal(brain('within', null).level, null);
});

test('every organ has a drawing that renders', () => {
  for (const o of ORGANS) assert.ok(renderAscii(o.shape, 26, 13, 0.4).replace(/\s/g, '').length > 20, `${o.id} drew almost nothing`);
});
