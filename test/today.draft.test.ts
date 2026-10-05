import { test } from 'node:test';
import assert from 'node:assert/strict';
import { EMPTY_DRAFT, draftFromLog, recordFromDraft } from '../src/features/today/draft.ts';
import type { DailyLog } from '../src/db/dailyLogs.ts';
import type { Habit } from '../src/db/habits.ts';

const log = (over: Partial<DailyLog> = {}): DailyLog => ({
  id: 'x', user_id: 'u', log_date: '2026-10-01', weight: null, total_cals: null, protein: null, carbs: null, fat: null, lift: null,
  core: null, cardio: null, cigs: null, mood: null, mood_notes: null, supplements: null, saved_at: null, steps: null,
  water_ml: 0, active_kcal: null, rings: null, habits: {}, ...over,
});
const habit = (over: Partial<Habit> & Pick<Habit, 'id' | 'name' | 'kind'>): Habit => ({
  unit: null, goal: null, better: 'higher', sort_order: 0, archived_at: null, created_at: '2026-01-01T00:00:00Z', user_id: 'u', ...over,
});
const cigs = habit({ id: 'cig', name: 'Cigarettes', kind: 'count', goal: 0, better: 'lower' });
const lift = habit({ id: 'lift', name: 'Lift', kind: 'yesno' });

test('a saved log loads into the form, and an empty one loads as a blank form', () => {
  const draft = draftFromLog(log({
    weight: 77.4, total_cals: 2050, protein: 150, carbs: 200, fat: 60,
    habits: { cig: { value: 2 }, lift: { value: true, note: 'legs' } },
    mood: 4, mood_notes: 'slept well', supplements: { zinc: true, vitd3: false },
  }));
  assert.deepEqual(draft, {
    weight: '77.4', calories: '2050', protein: '150', carbs: '200', fat: '60',
    habits: { cig: { value: 2 }, lift: { value: true, note: 'legs' } },
    mood: 4, notes: 'slept well', supplements: { zinc: true, vitd3: false },
  });
  assert.deepEqual(draftFromLog(log()), EMPTY_DRAFT);
});

test('unexpected values in the database load as blank rather than leaking into the form', () => {
  const draft = draftFromLog(log({ supplements: { zinc: 'yes', magnesium: true } as never, habits: { a: { value: 'maybe' }, b: 3, c: { value: 1 } } as never }));
  assert.deepEqual(draft.supplements, { magnesium: true });
  assert.deepEqual(draft.habits, { c: { value: 1 } });
  assert.deepEqual(draftFromLog(log({ supplements: ['zinc'] as never })).supplements, {});
  assert.deepEqual(draftFromLog(log({ supplements: 'zinc' as never })).supplements, {});
  assert.deepEqual(draftFromLog(log({ habits: null as never })).habits, {});
  assert.deepEqual(draftFromLog(log({ habits: [] as never })).habits, {});
});

test('saving turns the form into a row keyed by date, with blank fields as null and habits in their own column', () => {
  const record = recordFromDraft(
    { ...EMPTY_DRAFT, weight: '77.4', calories: '2050', habits: { cig: { value: 3 }, lift: { value: true, note: ' legs ' } }, notes: 'ok', supplements: { zinc: true } },
    '2026-10-01',
    '2026-10-01T06:00:00.000Z',
    [cigs, lift],
  );
  assert.deepEqual(record, {
    log_date: '2026-10-01', weight: 77.4, protein: null, carbs: null, fat: null, total_cals: 2050,
    habits: { cig: { value: 3 }, lift: { value: true, note: 'legs' } }, mood: null, mood_notes: 'ok', supplements: { zinc: true },
    saved_at: '2026-10-01T06:00:00.000Z',
  });
});

test('saving no longer touches the old lift, core, cardio and cigarette columns', () => {
  const record = recordFromDraft(EMPTY_DRAFT, '2026-10-01', 't', [cigs]);
  for (const key of ['lift', 'core', 'cardio', 'cigs', 'steps']) assert.equal(key in record, false, key);
});

test('a count that was not touched is saved as zero, and a yes or no that was not answered is not saved at all', () => {
  const record = recordFromDraft(EMPTY_DRAFT, '2026-10-01', 't', [cigs, lift]);
  assert.deepEqual(record.habits, { cig: { value: 0 } });
});

test('values for a habit that is no longer in the list are kept when the day is saved again', () => {
  const record = recordFromDraft({ ...EMPTY_DRAFT, habits: { gone: { value: true } } }, '2026-10-01', 't', []);
  assert.deepEqual(record.habits, { gone: { value: true } });
});

test('loading a log and saving it unchanged writes back the same values', () => {
  const original = log({
    weight: 78, total_cals: 1900, protein: 140, carbs: 180, fat: 55, mood: 3, mood_notes: 'n', supplements: { zinc: true },
    habits: { cig: { value: 0 }, lift: { value: false } },
  });
  const record = recordFromDraft(draftFromLog(original), original.log_date, 't', [cigs, lift]);
  for (const key of ['weight', 'total_cals', 'protein', 'carbs', 'fat', 'mood', 'mood_notes', 'supplements', 'habits'] as const) {
    assert.deepEqual(record[key], original[key], key);
  }
});
