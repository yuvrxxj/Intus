import { test } from 'node:test';
import assert from 'node:assert/strict';
import { EMPTY_DRAFT, draftFromLog, recordFromDraft } from '../src/features/today/draft.ts';
import type { DailyLog } from '../src/db/dailyLogs.ts';

const log = (over: Partial<DailyLog> = {}): DailyLog => ({
  id: 'x', log_date: '2026-10-01', weight: null, total_cals: null, protein: null, carbs: null, fat: null, lift: null,
  core: null, cardio: null, cigs: null, mood: null, mood_notes: null, supplements: null, saved_at: null, steps: null,
  water_ml: 0, active_kcal: null, rings: null, ...over,
});

test('a saved log loads into the form, and an empty one loads as a blank form', () => {
  const draft = draftFromLog(log({
    weight: 77.4, total_cals: 2050, protein: 150, carbs: 200, fat: 60, lift: 'yes', core: 'no', cardio: 'bad', cigs: 2,
    mood: 4, mood_notes: 'slept well', supplements: { zinc: true, vitd3: false },
  }));
  assert.deepEqual(draft, {
    weight: '77.4', calories: '2050', protein: '150', carbs: '200', fat: '60', lift: 'yes', core: 'no', cardio: 'bad',
    cigs: 2, mood: 4, notes: 'slept well', supplements: { zinc: true, vitd3: false },
  });
  assert.deepEqual(draftFromLog(log()), EMPTY_DRAFT);
});

test('unexpected values in the database load as blank rather than leaking into the form', () => {
  const draft = draftFromLog(log({ lift: 'maybe', supplements: { zinc: 'yes', magnesium: true } as never }));
  assert.equal(draft.lift, null);
  assert.deepEqual(draft.supplements, { magnesium: true });
  assert.deepEqual(draftFromLog(log({ supplements: ['zinc'] as never })).supplements, {});
  assert.deepEqual(draftFromLog(log({ supplements: 'zinc' as never })).supplements, {});
});

test('saving turns the form into a row keyed by date, with blank fields as null', () => {
  const record = recordFromDraft(
    { ...EMPTY_DRAFT, weight: '77.4', calories: '2050', cigs: 3, lift: 'yes', notes: 'ok', supplements: { zinc: true } },
    '2026-10-01',
    '2026-10-01T06:00:00.000Z',
  );
  assert.deepEqual(record, {
    log_date: '2026-10-01', weight: 77.4, protein: null, carbs: null, fat: null, total_cals: 2050, lift: 'yes',
    core: null, cardio: null, cigs: 3, mood: null, mood_notes: 'ok', supplements: { zinc: true },
    saved_at: '2026-10-01T06:00:00.000Z',
  });
});

test('loading a log and saving it unchanged writes back the same values', () => {
  const original = log({ weight: 78, total_cals: 1900, protein: 140, carbs: 180, fat: 55, lift: 'no', core: 'yes', cardio: 'yes', cigs: 0, mood: 3, mood_notes: 'n', supplements: { zinc: true } });
  const record = recordFromDraft(draftFromLog(original), original.log_date, 't');
  for (const key of ['weight', 'total_cals', 'protein', 'carbs', 'fat', 'lift', 'core', 'cardio', 'cigs', 'mood', 'mood_notes', 'supplements'] as const) {
    assert.deepEqual(record[key], original[key], key);
  }
});
