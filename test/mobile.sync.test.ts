import { test } from 'node:test';
import assert from 'node:assert/strict';
import { SLEEP_VALUE, cardioRows, localDay, sleepRows, syncWindowStart, type SleepSampleIn } from '../mobile/src/sync/mapping.ts';
import { parseStages } from '../src/features/sleep/rows.ts';

// Invented samples. A fixed offset (UTC+5:30, India) stands in for the phone's time zone so the tests do not depend on where they run.
const IST = () => 330;
const at = (iso: string) => new Date(iso);
const sample = (uuid: string, start: string, end: string, value: number, sourceName = 'Apple Watch'): SleepSampleIn => ({ uuid, start: at(start), end: at(end), value, sourceName });
const recordedAt = at('2026-10-10T03:00:00Z');

test('a night of stage samples becomes one session, with stages mapped and the in-bed start kept', () => {
  const night = [
    sample('bed', '2026-10-09T17:00:00Z', '2026-10-10T01:00:00Z', SLEEP_VALUE.inBed),
    sample('c1', '2026-10-09T17:20:00Z', '2026-10-09T19:00:00Z', SLEEP_VALUE.asleepCore),
    sample('d1', '2026-10-09T19:00:00Z', '2026-10-09T20:00:00Z', SLEEP_VALUE.asleepDeep),
    sample('w1', '2026-10-09T20:00:00Z', '2026-10-09T20:10:00Z', SLEEP_VALUE.awake),
    sample('r1', '2026-10-09T20:10:00Z', '2026-10-10T00:50:00Z', SLEEP_VALUE.asleepREM),
  ];
  const { rows, skipped } = sleepRows(night, { offsetAt: IST, tzId: 'Asia/Kolkata', recordedAt });
  assert.equal(skipped, 0);
  assert.equal(rows.length, 1);
  const [row] = rows;
  assert.equal(row.source_kind, 'healthkit');
  assert.equal(row.source_name, 'Apple Watch');
  assert.equal(row.external_id, 'bed');
  assert.equal(row.start_at, '2026-10-09T17:00:00.000Z');
  assert.equal(row.end_at, '2026-10-10T01:00:00.000Z');
  assert.equal(row.start_offset_min, 330);
  assert.equal(row.start_is_in_bed, true);
  assert.deepEqual(row.stages.map((s) => s.t), ['light', 'deep', 'awake', 'rem']);
  // the web app reads the stages back without dropping any
  assert.equal(parseStages(row.stages).length, 4);
});

test('without an in-bed sample the start is not an in-bed time; sources stay apart; a long gap splits sessions', () => {
  const samples = [
    sample('a', '2026-10-09T17:30:00Z', '2026-10-10T00:30:00Z', SLEEP_VALUE.asleepUnspecified, 'iPhone'),
    sample('w1', '2026-10-09T17:00:00Z', '2026-10-10T00:00:00Z', SLEEP_VALUE.asleepCore),
    sample('nap', '2026-10-10T08:00:00Z', '2026-10-10T08:40:00Z', SLEEP_VALUE.asleepCore), // eight hours later: its own session
  ];
  const { rows } = sleepRows(samples, { offsetAt: IST, recordedAt });
  assert.deepEqual(rows.map((r) => [r.source_name, r.external_id, r.start_is_in_bed]).sort(), [
    ['Apple Watch', 'nap', false], ['Apple Watch', 'w1', false], ['iPhone', 'a', false],
  ]);
});

test('sessions the database would refuse are dropped and counted, not stored', () => {
  const { rows, skipped } = sleepRows([
    sample('short', '2026-10-09T17:00:00Z', '2026-10-09T17:10:00Z', SLEEP_VALUE.asleepCore), // 10 minutes
    sample('bedonly', '2026-10-09T10:00:00Z', '2026-10-09T12:00:00Z', SLEEP_VALUE.inBed), // no sleep in it
    sample('backwards', '2026-10-09T05:00:00Z', '2026-10-09T04:00:00Z', SLEEP_VALUE.asleepCore), // ignored outright
  ], { offsetAt: IST, recordedAt });
  assert.equal(rows.length, 0);
  assert.equal(skipped, 2);
});

test('heart readings: one row per local day, HRV averaged, resting heart rate the last of the day, glitches dropped', () => {
  const q = (uuid: string, iso: string, value: number) => ({ uuid, start: at(iso), end: at(iso), value, sourceName: 'Apple Watch' });
  const rows = cardioRows(
    [q('h1', '2026-10-09T20:00:00Z', 40), q('h2', '2026-10-10T02:00:00Z', 51), q('h3', '2026-10-10T03:00:00Z', 0), q('h4', '2026-10-10T04:00:00Z', 900)],
    [q('r1', '2026-10-10T01:00:00Z', 58), q('r2', '2026-10-10T12:00:00Z', 56.6), q('r3', '2026-10-10T13:00:00Z', 10)],
    IST,
  );
  // 20:00Z on the 9th is 01:30 on the 10th in India, so all of these fall on the 10th
  assert.deepEqual(rows, [{ measured_at: '2026-10-10', hrv_ms: 46, resting_hr: 57, source: 'healthkit' }]);
  assert.deepEqual(cardioRows([], []), []);
});

test('local days and the sync window start at local midnight', () => {
  assert.equal(localDay(at('2026-10-09T19:00:00Z'), IST), '2026-10-10');
  assert.equal(localDay(at('2026-10-09T18:00:00Z'), IST), '2026-10-09');
  // three days back from 10 Oct, local midnight on 7 Oct in India is 18:30 UTC on 6 Oct
  assert.equal(syncWindowStart(at('2026-10-10T09:00:00Z'), 3, IST).toISOString(), '2026-10-06T18:30:00.000Z');
});
