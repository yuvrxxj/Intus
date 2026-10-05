import { test } from 'node:test';
import assert from 'node:assert/strict';
import type { Habit } from '../src/db/habits.ts';
import {
  EMPTY_HABIT_FORM, MAX_HABITS, activeHabits, archivedHabits, availablePresets, describeGoal, formFromHabit, fractionOfGoal,
  goalOf, habitStreak, isOnTrack, nextSortOrder, parseEntries, serializeEntries, summarize, toneOf, validateHabitForm,
  withUntouchedCounts, PRESETS, type HabitForm,
} from '../src/features/habits/model.ts';

const habit = (over: Partial<Habit> & Pick<Habit, 'id' | 'name' | 'kind'>): Habit => ({
  unit: null, goal: null, better: 'higher', sort_order: 0, archived_at: null, created_at: '2026-01-01T00:00:00Z', user_id: 'u', ...over,
});
const cigs = habit({ id: 'cig', name: 'Cigarettes', kind: 'count', goal: 0, better: 'lower' });
const lift = habit({ id: 'lift', name: 'Lift', kind: 'yesno' });
const drank = habit({ id: 'drank', name: 'Drank today', kind: 'yesno', better: 'lower' });
const steps = habit({ id: 'steps', name: 'Steps', kind: 'amount', unit: 'steps', goal: 9000 });

test('a day\'s habit values are read tolerantly: only clean entries survive', () => {
  assert.deepEqual(parseEntries({ a: { value: 3 }, b: { value: true, note: '  stairmaster ' }, c: { value: false } }), {
    a: { value: 3 }, b: { value: true, note: 'stairmaster' }, c: { value: false },
  });
  assert.deepEqual(parseEntries({ a: { value: 'x' }, b: 4, c: null, d: [1], e: { value: Number.NaN }, f: {}, g: { value: Infinity } }), {});
  for (const junk of [null, undefined, 'x', 7, [], true]) assert.deepEqual(parseEntries(junk), {}, String(junk));
  assert.deepEqual(parseEntries({ a: { value: 2, note: '   ' } }), { a: { value: 2 } }, 'a blank note is dropped');
  assert.equal(parseEntries({ a: { value: 1, note: 'x'.repeat(200) } }).a.note?.length, 80, 'notes are capped');
});

test('saving writes each entry back as it was, with trimmed notes and no empty ones', () => {
  assert.deepEqual(serializeEntries({ a: { value: 2, note: ' hi ' }, b: { value: false, note: '' }, c: { value: 0 } }), {
    a: { value: 2, note: 'hi' }, b: { value: false }, c: { value: 0 },
  });
  const original = { a: { value: 4 }, b: { value: true, note: 'run' } };
  assert.deepEqual(parseEntries(serializeEntries(original)), original, 'round trip');
});

test('a yes or no is good when it matches the direction', () => {
  assert.equal(toneOf(lift, { value: true }), 'good');
  assert.equal(toneOf(lift, { value: false }), 'bad');
  assert.equal(toneOf(drank, { value: false }), 'good');
  assert.equal(toneOf(drank, { value: true }), 'bad');
  assert.equal(toneOf(lift, undefined), 'none');
});

test('a lower-is-better count is good at the goal, ok within three, bad beyond (cigarettes as the page always showed them)', () => {
  assert.equal(toneOf(cigs, { value: 0 }), 'good');
  assert.equal(toneOf(cigs, { value: 1 }), 'ok');
  assert.equal(toneOf(cigs, { value: 3 }), 'ok');
  assert.equal(toneOf(cigs, { value: 4 }), 'bad');
  const limit = habit({ id: 'd', name: 'Drinks', kind: 'count', goal: 2, better: 'lower' });
  assert.deepEqual([0, 2, 3, 5, 6].map((v) => toneOf(limit, { value: v })), ['good', 'good', 'ok', 'ok', 'bad']);
  const none = habit({ id: 'n', name: 'x', kind: 'count', better: 'lower' });
  assert.equal(toneOf(none, { value: 0 }), 'good', 'no goal on a lower habit means none');
  assert.equal(toneOf(none, { value: 1 }), 'ok');
});

test('a higher-is-better amount is good at the goal, ok from half, bad below', () => {
  assert.deepEqual([9000, 12000, 4500, 4499, 0].map((v) => toneOf(steps, { value: v })), ['good', 'good', 'ok', 'bad', 'bad']);
  const free = habit({ id: 'w', name: 'Water', kind: 'amount', unit: 'L' });
  assert.equal(toneOf(free, { value: 0.5 }), 'good', 'no goal: anything counts');
  assert.equal(toneOf(free, { value: 0 }), 'none');
});

test('a lower-is-better amount allows a quarter over its goal', () => {
  const screen = habit({ id: 's', name: 'Screen', kind: 'amount', unit: 'h', goal: 4, better: 'lower' });
  assert.deepEqual([3, 4, 5, 5.5, 0].map((v) => toneOf(screen, { value: v })), ['good', 'good', 'ok', 'bad', 'good']);
});

test('a goal that arrives as a string from the numeric column still works, and rubbish counts as no goal', () => {
  assert.equal(goalOf({ goal: '9000' as never }), 9000);
  assert.equal(goalOf({ goal: null }), null);
  assert.equal(goalOf({ goal: 'lots' as never }), null);
  assert.equal(toneOf({ ...steps, goal: '9000' as never }, { value: 9000 }), 'good');
});

test('on track means good', () => {
  assert.equal(isOnTrack(lift, { value: true }), true);
  assert.equal(isOnTrack(lift, undefined), false);
  assert.equal(isOnTrack(cigs, { value: 1 }), false);
});

test('active and archived habits are told apart, and unknown kinds are ignored', () => {
  const old = habit({ id: 'o', name: 'Old', kind: 'count', archived_at: '2026-02-01T00:00:00Z' });
  const odd = habit({ id: 'x', name: 'Odd', kind: 'tally' as never });
  assert.deepEqual(activeHabits([cigs, old, odd, lift]).map((h) => h.id), ['cig', 'lift']);
  assert.deepEqual(archivedHabits([cigs, old, odd, lift]).map((h) => h.id), ['o']);
});

test('the summary counts active habits that are on track, and ignores archived ones', () => {
  const old = habit({ id: 'o', name: 'Old', kind: 'yesno', archived_at: '2026-02-01T00:00:00Z' });
  const entries = { cig: { value: 0 }, lift: { value: true }, steps: { value: 3000 }, o: { value: true } };
  assert.deepEqual(summarize([cigs, lift, steps, drank, old], entries), { onTrack: 2, total: 4 });
  assert.deepEqual(summarize([], {}), { onTrack: 0, total: 0 });
});

test('goals read in words', () => {
  assert.equal(describeGoal(lift), 'Aim for yes');
  assert.equal(describeGoal(drank), 'Aim for no');
  assert.equal(describeGoal(cigs), 'Aim for none');
  assert.equal(describeGoal(habit({ id: 'd', name: 'Drinks', kind: 'count', goal: 2, better: 'lower' })), 'At most 2');
  assert.equal(describeGoal(steps), 'At least 9,000 steps');
  assert.equal(describeGoal(habit({ id: 'a', name: 'a', kind: 'count', better: 'lower' })), 'Aim for none');
  assert.equal(describeGoal(habit({ id: 'a', name: 'a', kind: 'amount' })), null);
});

test('the share of the goal is capped at one, and absent without a goal or a number', () => {
  assert.equal(fractionOfGoal(steps, { value: 4500 }), 0.5);
  assert.equal(fractionOfGoal(steps, { value: 20000 }), 1);
  assert.equal(fractionOfGoal(steps, { value: -5 }), 0);
  assert.equal(fractionOfGoal(steps, undefined), null);
  assert.equal(fractionOfGoal(lift, { value: true }), null);
  assert.equal(fractionOfGoal({ goal: null }, { value: 3 }), null);
});

test('a streak counts the newest entries in a row that were on track, and a missing day ends it', () => {
  const days = [{ lift: { value: true } }, { lift: { value: true } }, {}, { lift: { value: true } }] as never[];
  assert.equal(habitStreak(lift, days), 2);
  assert.equal(habitStreak(lift, [{ lift: { value: false } }, { lift: { value: true } }] as never[]), 0);
  assert.equal(habitStreak(cigs, [{ cig: { value: 0 } }, { cig: { value: 0 } }, { cig: { value: 2 } }] as never[]), 2);
  assert.equal(habitStreak(lift, []), 0);
});

test('a count not touched today is saved as zero, and nothing else is invented', () => {
  const entries = withUntouchedCounts([cigs, lift, steps], {});
  assert.deepEqual(entries, { cig: { value: 0 } });
  assert.deepEqual(withUntouchedCounts([cigs], { cig: { value: 3, note: 'n' } }), { cig: { value: 3, note: 'n' } }, 'what was set is kept');
  const old = habit({ id: 'o', name: 'Old', kind: 'count', archived_at: '2026-02-01T00:00:00Z' });
  assert.deepEqual(withUntouchedCounts([old], {}), {}, 'archived habits are not logged');
});

const form = (over: Partial<HabitForm> = {}): HabitForm => ({ ...EMPTY_HABIT_FORM, name: 'Lift', ...over });

test('a valid form becomes a habit, with yes or no carrying no unit or goal', () => {
  const r = validateHabitForm(form({ kind: 'yesno', unit: 'x', goal: '5' }), []);
  assert.equal(r.ok, true);
  if (r.ok) assert.deepEqual(r.value, { name: 'Lift', kind: 'yesno', unit: null, goal: null, better: 'higher' });
  const s = validateHabitForm(form({ name: '  Steps ', kind: 'amount', unit: ' steps ', goal: '9000.5' }), []);
  assert.equal(s.ok, true);
  if (s.ok) assert.deepEqual(s.value, { name: 'Steps', kind: 'amount', unit: 'steps', goal: 9000.5, better: 'higher' });
  const c = validateHabitForm(form({ kind: 'count', better: 'lower', goal: '0', unit: '' }), []);
  assert.equal(c.ok, true);
  if (c.ok) assert.deepEqual(c.value, { name: 'Lift', kind: 'count', unit: null, goal: 0, better: 'lower' });
  const blank = validateHabitForm(form({ kind: 'amount', goal: ' ' }), []);
  assert.equal(blank.ok && blank.value.goal, null, 'a blank goal is no goal');
});

test('the name is required, trimmed, short enough and not already used (any case) by another active habit', () => {
  assert.equal(validateHabitForm(form({ name: '  ' }), []).ok, false);
  assert.equal(validateHabitForm(form({ name: 'x'.repeat(61) }), []).ok, false);
  assert.equal(validateHabitForm(form({ name: 'x'.repeat(60) }), []).ok, true);
  const dup = validateHabitForm(form({ name: ' lift ' }), [{ name: 'LIFT' }]);
  assert.equal(dup.ok === false && dup.errors.name, 'You already track a habit with that name');
  assert.equal(validateHabitForm(form({ name: 'Core' }), [{ name: 'Lift' }]).ok, true);
});

test('there is a limit on how many habits one person tracks', () => {
  const many = Array.from({ length: MAX_HABITS }, (_, i) => ({ name: `h${i}` }));
  const r = validateHabitForm(form({ name: 'One more' }), many);
  assert.equal(r.ok === false && r.errors.name?.includes('up to 12'), true);
  assert.equal(validateHabitForm(form({ name: 'One more' }), many.slice(1)).ok, true);
});

test('goals must be numbers in range, whole for a count, and above zero when higher is better', () => {
  for (const [kind, goal, better] of [['count', '-1', 'lower'], ['amount', '100001', 'higher'], ['amount', 'lots', 'higher'], ['count', '2.5', 'lower'], ['amount', '0', 'higher'], ['count', '0', 'higher']] as const) {
    const r = validateHabitForm(form({ kind, goal, better }), []);
    assert.equal(r.ok, false, `${kind} ${goal} ${better}`);
  }
  assert.equal(validateHabitForm(form({ kind: 'amount', goal: '0', better: 'lower' }), []).ok, true);
  assert.equal(validateHabitForm(form({ kind: 'amount', goal: '100000' }), []).ok, true);
  assert.equal(validateHabitForm(form({ kind: 'amount', unit: 'u'.repeat(21) }), []).ok, false);
});

test('editing a habit round-trips through the form unchanged', () => {
  for (const h of [cigs, lift, drank, steps, habit({ id: 'w', name: 'Water', kind: 'amount', unit: 'L', goal: 2.5 })]) {
    const r = validateHabitForm(formFromHabit(h), []);
    assert.equal(r.ok, true, h.name);
    if (!r.ok) continue;
    assert.deepEqual(r.value, { name: h.name, kind: h.kind, unit: h.unit, goal: h.goal, better: h.better }, h.name);
  }
});

test('every preset is a valid habit on its own, and a preset already tracked is no longer offered', () => {
  for (const p of PRESETS) {
    const r = validateHabitForm({ name: p.value.name, kind: p.value.kind as 'count', unit: p.value.unit ?? '', goal: p.value.goal == null ? '' : String(p.value.goal), better: p.value.better as 'higher' }, []);
    assert.equal(r.ok, true, p.label);
  }
  assert.equal(availablePresets([]).length, PRESETS.length);
  assert.equal(availablePresets([{ name: 'cigarettes' }, { name: 'Steps' }]).some((p) => ['Cigarettes', 'Steps'].includes(p.label)), false);
  assert.equal(new Set(PRESETS.map((p) => p.value.name)).size, PRESETS.length, 'no duplicate names');
});

test('a new habit goes at the end', () => {
  assert.equal(nextSortOrder([]), 0);
  assert.equal(nextSortOrder([{ sort_order: 0 }, { sort_order: 4 }, { sort_order: 2 }]), 5);
});
