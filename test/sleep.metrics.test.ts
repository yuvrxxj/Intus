import { test } from 'node:test';
import assert from 'node:assert/strict';
import { at, seg, session } from './sleep.helpers.ts';
import { resolveStages, sessionMetrics } from '../src/features/sleep/metrics.ts';

test('with only bed and wake times, time asleep cannot be told apart from the sleep period, and nothing else is claimed', () => {
  const m = sessionMetrics(session({ from: '2026-10-08 23:00', to: '2026-10-09 07:00' }));
  assert.equal(m.basis, 'bed_to_wake');
  assert.equal(m.tibMin, 480);
  assert.equal(m.sptMin, 480);
  assert.equal(m.tstMin, 480);
  assert.equal(m.efficiency, null, 'it would read 100 percent and mean nothing');
  assert.equal(m.wasoMin, null);
  assert.equal(m.latencyMin, null);
  assert.equal(m.awakeningsOver5, null);
  assert.equal(m.stageMinutes, null);
  assert.equal(m.asleepClock, 23 * 60);
  assert.equal(m.wakeClock, 7 * 60);
  assert.equal(m.midpointClock, 3 * 60, 'the midpoint of 23:00 to 07:00 is 03:00');
});

test('the person\'s own estimates shorten time asleep and make an efficiency, labelled as a diary', () => {
  const m = sessionMetrics(session({ from: '2026-10-08 23:00', to: '2026-10-09 07:00', latencyMin: 20, awakeMin: 30 }));
  assert.equal(m.basis, 'diary');
  assert.equal(m.tibMin, 480);
  assert.equal(m.sptMin, 460);
  assert.equal(m.tstMin, 430);
  assert.equal(m.wasoMin, 30);
  assert.equal(m.latencyMin, 20);
  assert.equal(m.efficiency, (100 * 430) / 480);
  assert.equal(m.asleepClock, 23 * 60 + 20, 'asleep from 23:20, not from getting into bed');
  assert.equal(m.midpointClock, Math.round((23 * 60 + 20 + 7 * 60 + 1440) / 2) % 1440);
});

test('only one of the two estimates is enough, and the other stays unknown', () => {
  const latencyOnly = sessionMetrics(session({ from: '2026-10-08 23:00', to: '2026-10-09 07:00', latencyMin: 15 }));
  assert.equal(latencyOnly.basis, 'diary');
  assert.equal(latencyOnly.tstMin, 465);
  assert.equal(latencyOnly.wasoMin, null);
  const awakeOnly = sessionMetrics(session({ from: '2026-10-08 23:00', to: '2026-10-09 07:00', awakeMin: 40 }));
  assert.equal(awakeOnly.tstMin, 440);
  assert.equal(awakeOnly.latencyMin, null);
});

test('stages give time asleep, wake after onset, awakenings over 5 minutes, and stage minutes, all as estimates', () => {
  // the watch in the research worked example: asleep 23:10 to 06:40 minus awake 01:40 to 01:55 and 04:20 to 04:30
  const m = sessionMetrics(session({
    from: '2026-10-08 23:10', to: '2026-10-09 06:40', sourceKind: 'healthkit', sourceName: 'Apple Watch', startIsInBed: false,
    stages: [
      seg('2026-10-08 23:10', '2026-10-09 01:40', 'light'),
      seg('2026-10-09 01:40', '2026-10-09 01:55', 'awake'),
      seg('2026-10-09 01:55', '2026-10-09 03:00', 'deep'),
      seg('2026-10-09 03:00', '2026-10-09 04:20', 'rem'),
      seg('2026-10-09 04:20', '2026-10-09 04:30', 'awake'),
      seg('2026-10-09 04:30', '2026-10-09 06:40', 'light'),
    ],
  }));
  assert.equal(m.basis, 'stages');
  assert.equal(m.tstMin, 425);
  assert.equal(m.wasoMin, 25);
  assert.equal(m.awakeningsOver5, 2);
  assert.equal(m.sptMin, 450);
  assert.deepEqual(m.stageMinutes, { light: 150 + 130, deep: 65, rem: 80, unspecified: 0, awake: 25 });
  assert.equal(m.efficiency, null, 'the watch gave no in-bed time, so asleep over in bed is not worked out');
});

test('a wake of 5 minutes or less is not an awakening, and one over 5 is', () => {
  const m = sessionMetrics(session({
    from: '2026-10-08 23:00', to: '2026-10-09 06:00', sourceKind: 'healthkit', sourceName: 'Apple Watch',
    stages: [
      seg('2026-10-08 23:00', '2026-10-09 02:00', 'light'), seg('2026-10-09 02:00', '2026-10-09 02:05', 'awake'),
      seg('2026-10-09 02:05', '2026-10-09 04:00', 'light'), seg('2026-10-09 04:00', '2026-10-09 04:06', 'awake'),
      seg('2026-10-09 04:06', '2026-10-09 06:00', 'light'),
    ],
  }));
  assert.equal(m.awakeningsOver5, 1);
  assert.equal(m.wasoMin, 11);
});

test('awake time before falling asleep and after the last awakening is not counted as waking in the night', () => {
  const m = sessionMetrics(session({
    from: '2026-10-08 22:30', to: '2026-10-09 07:30', sourceKind: 'health_connect', sourceName: 'Watch',
    stages: [
      seg('2026-10-08 22:30', '2026-10-08 23:00', 'awake'), seg('2026-10-08 23:00', '2026-10-09 06:30', 'light'),
      seg('2026-10-09 06:30', '2026-10-09 07:30', 'awake'),
    ],
  }));
  assert.equal(m.tstMin, 450);
  assert.equal(m.wasoMin, 0);
  assert.equal(m.awakeningsOver5, 0);
  assert.equal(m.asleepClock, 23 * 60);
  assert.equal(m.wakeClock, 6 * 60 + 30, 'wake time is the final awakening, not getting out of bed');
  assert.equal(m.efficiency, (100 * 450) / (9 * 60), 'with an in-bed start, efficiency is asleep over in bed');
});

test('a source that only says "asleep" gives time asleep but no stage breakdown', () => {
  const m = sessionMetrics(session({
    from: '2026-10-08 23:00', to: '2026-10-09 07:00', sourceKind: 'healthkit', sourceName: 'Some app',
    stages: [seg('2026-10-08 23:00', '2026-10-09 07:00', 'asleep')],
  }));
  assert.equal(m.basis, 'stages');
  assert.equal(m.tstMin, 480);
  assert.equal(m.stageMinutes, null, 'no light, deep or REM were named, so none are shown');
});

test('overlapping stage segments are resolved: a named stage beats awake beats unspecified, and time nobody covered stays unknown', () => {
  const timeline = resolveStages({
    start: at('2026-10-08 23:00'), end: at('2026-10-09 03:00'),
    stages: [
      seg('2026-10-08 23:00', '2026-10-09 01:00', 'asleep'),
      seg('2026-10-08 23:30', '2026-10-09 00:00', 'awake'),
      seg('2026-10-08 23:45', '2026-10-09 00:15', 'deep'),
      // 01:00 to 02:00 is covered by nothing
      seg('2026-10-09 02:00', '2026-10-09 03:00', 'rem'),
    ],
  });
  assert.deepEqual(timeline.map((g) => [new Date(g.s).toISOString().slice(11, 16), new Date(g.e).toISOString().slice(11, 16), g.t]), [
    ['23:00', '23:30', 'asleep'], ['23:30', '23:45', 'awake'], ['23:45', '00:15', 'deep'], ['00:15', '01:00', 'asleep'], ['02:00', '03:00', 'rem'],
  ]);
  const m = sessionMetrics(session({
    from: '2026-10-08 23:00', to: '2026-10-09 03:00', sourceKind: 'healthkit', sourceName: 'x',
    stages: [seg('2026-10-08 23:00', '2026-10-09 01:00', 'light'), seg('2026-10-09 02:00', '2026-10-09 03:00', 'light')],
  }));
  assert.equal(m.tstMin, 180, 'the uncovered hour is not counted as asleep');
  assert.equal(m.wasoMin, 0, 'and not as awake either');
});

test('stage segments are clipped to the session and ones outside it are dropped', () => {
  const timeline = resolveStages({
    start: at('2026-10-08 23:00'), end: at('2026-10-09 01:00'),
    stages: [seg('2026-10-08 22:00', '2026-10-08 23:30', 'light'), seg('2026-10-09 01:00', '2026-10-09 02:00', 'deep'), seg('2026-10-09 00:00', '2026-10-09 05:00', 'rem')],
  });
  assert.deepEqual(timeline.map((g) => g.t), ['light', 'rem']);
  assert.equal(timeline[0].s, at('2026-10-08 23:00'));
  assert.equal(timeline[1].e, at('2026-10-09 01:00'));
});

test('a night that crosses the end of daylight saving time is 9 hours, with the right clock times', () => {
  // New York: 23:00 EDT (UTC-4) on 31 Oct to 07:00 EST (UTC-5) on 1 Nov, after the clocks went back at 02:00
  const m = sessionMetrics(session({
    id: 'dst', from: '2026-10-31 23:00', to: '2026-11-01 07:00', tzId: 'America/New_York',
    start: Date.UTC(2026, 10, 1, 3, 0), end: Date.UTC(2026, 10, 1, 12, 0), startOffsetMin: -240, endOffsetMin: -300,
  }));
  assert.equal(m.tibMin, 540);
  assert.equal(m.tstMin, 540);
  assert.equal(m.asleepClock, 23 * 60);
  assert.equal(m.wakeClock, 7 * 60);
  assert.equal(m.tzUncertain, false);
  // and the same record with no zone name cannot say which offset applies to the midpoint
  assert.equal(sessionMetrics(session({ from: '2026-10-31 23:00', to: '2026-11-01 07:00', start: Date.UTC(2026, 10, 1, 3, 0), end: Date.UTC(2026, 10, 1, 12, 0), startOffsetMin: -240, endOffsetMin: -300 })).tzUncertain, true);
});

test('an efficiency can never read over 100', () => {
  const m = sessionMetrics(session({ from: '2026-10-08 23:00', to: '2026-10-09 07:00', latencyMin: 0, awakeMin: 0 }));
  assert.equal(m.efficiency, 100);
});
