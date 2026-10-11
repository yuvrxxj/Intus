import { test } from 'node:test';
import assert from 'node:assert/strict';
import { at, session } from './sleep.helpers.ts';
import { clockRange, dayLabel, localInputValue, nightHeading, shortDay, sourceLabel } from '../src/features/sleep/format.ts';
import { parseStages, sessionFromRow } from '../src/features/sleep/rows.ts';

test('dates read plainly, and the heading names the date the person woke up', () => {
  assert.equal(dayLabel('2026-10-09'), 'Fri 9 Oct');
  assert.equal(dayLabel('2026-01-01'), 'Thu 1 Jan');
  assert.equal(nightHeading('2026-10-09'), 'Night ending Fri 9 Oct');
  assert.equal(shortDay('2026-12-25'), '25 Dec');
});

test('the times of a night are on the clock where the person was, with the day on each end', () => {
  assert.equal(clockRange(session({ from: '2026-10-08 23:00', to: '2026-10-09 07:00' })), '23:00 Thu to 07:00 Fri');
  // 23:00 and 07:00 in Tokyo are the same wall times whatever the viewer's zone
  assert.equal(clockRange(session({ from: '2026-10-08 23:00', to: '2026-10-09 07:00', offset: 540 })), '23:00 Thu to 07:00 Fri');
  // a flight: asleep at 23:00 UTC+1, awake at 06:00 UTC-5
  const flight = session({ start: Date.UTC(2026, 9, 8, 22), end: Date.UTC(2026, 9, 9, 11), startOffsetMin: 60, endOffsetMin: -300 });
  assert.equal(clockRange(flight), '23:00 Thu to 06:00 Fri');
});

test('where a night came from is said in words', () => {
  assert.equal(sourceLabel({ sourceKind: 'manual', sourceName: null }), 'Entered by you');
  assert.equal(sourceLabel({ sourceKind: 'healthkit', sourceName: 'Apple Watch' }), 'Apple Watch (Apple Health)');
  assert.equal(sourceLabel({ sourceKind: 'apple_health_export', sourceName: null }), 'Apple Health export');
  assert.equal(sourceLabel({ sourceKind: 'health_connect', sourceName: 'Pixel Watch' }), 'Pixel Watch (Health Connect)');
});

test('an instant goes back into a datetime-local input on the clock of its offset', () => {
  assert.equal(localInputValue(at('2026-10-08 22:00'), 60), '2026-10-08T23:00');
  assert.equal(localInputValue(at('2026-10-08 22:00'), -300), '2026-10-08T17:00');
});

test('stored stage lists are read defensively: a bad segment is dropped and the rest are kept', () => {
  assert.deepEqual(parseStages(null), []);
  assert.deepEqual(parseStages('light'), []);
  assert.deepEqual(parseStages({}), []);
  assert.deepEqual(parseStages([
    { s: 1, e: 2, t: 'deep' }, { s: 2, e: 2, t: 'deep' }, { s: 3, e: 1, t: 'rem' }, { s: 'a', e: 5, t: 'rem' },
    { s: 1, e: 2, t: 'nap' }, null, 7, { s: 5, e: 9, t: 'awake' },
  ]), [{ s: 1, e: 2, t: 'deep' }, { s: 5, e: 9, t: 'awake' }]);
});

test('a stored row becomes a session, with an empty source name as none and an unknown kind as other', () => {
  const row = {
    id: 'r1', user_id: 'u', source_kind: 'healthkit', source_name: 'Apple Watch', external_id: 'abc',
    start_at: '2026-10-08T22:00:00+00:00', end_at: '2026-10-09T06:00:00+00:00', start_offset_min: 60, end_offset_min: 60, tz_id: 'Europe/London',
    latency_min: 10, awake_min: null, stages: [{ s: 1, e: 2, t: 'light' }], start_is_in_bed: false, notes: null,
    recorded_at: '2026-10-09T07:00:00+00:00', created_at: '2026-10-09T07:00:00+00:00',
  };
  const s = sessionFromRow(row);
  assert.equal(s.start, Date.UTC(2026, 9, 8, 22));
  assert.equal(s.end, Date.UTC(2026, 9, 9, 6));
  assert.deepEqual([s.sourceKind, s.sourceName, s.externalId, s.tzId, s.latencyMin, s.awakeMin, s.startIsInBed], ['healthkit', 'Apple Watch', 'abc', 'Europe/London', 10, null, false]);
  assert.equal(s.stages.length, 1);
  assert.equal(sessionFromRow({ ...row, source_name: '', source_kind: 'fitbit' }).sourceName, null);
  assert.equal(sessionFromRow({ ...row, source_kind: 'fitbit' }).sourceKind, 'other');
});
