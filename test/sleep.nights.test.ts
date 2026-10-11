import { test } from 'node:test';
import assert from 'node:assert/strict';
import { at, NOW, seg, session, type Over } from './sleep.helpers.ts';
import { buildNights, rankOf, sourceId } from '../src/features/sleep/nights.ts';
import type { SleepSession } from '../src/features/sleep/model.ts';

// the research worked example: one night, three sources
const watch = (over: Over = {}) => session({
  from: '2026-10-08 23:10', to: '2026-10-09 06:40', sourceKind: 'healthkit', sourceName: 'Apple Watch', startIsInBed: false,
  stages: [
    seg('2026-10-08 23:10', '2026-10-09 01:40', 'light'), seg('2026-10-09 01:40', '2026-10-09 01:55', 'awake'),
    seg('2026-10-09 01:55', '2026-10-09 04:20', 'deep'), seg('2026-10-09 04:20', '2026-10-09 04:30', 'awake'),
    seg('2026-10-09 04:30', '2026-10-09 06:40', 'rem'),
  ], ...over,
}); // 425 minutes asleep
const phone = (over: Over = {}) => session({
  from: '2026-10-08 22:30', to: '2026-10-09 07:10', sourceKind: 'health_connect', sourceName: 'Sleep app',
  stages: [seg('2026-10-08 22:30', '2026-10-09 07:10', 'asleep')], ...over,
}); // 520 minutes asleep
const mine = (over: Over = {}) => session({ from: '2026-10-08 23:15', to: '2026-10-09 07:00', ...over }); // 465 minutes

const build = (sessions: SleepSession[], extra = {}) => buildNights(sessions, { nowMs: NOW, ...extra });

test('one source gives one night, filed under the date the person woke', () => {
  const { nights, quarantined } = build([mine()]);
  assert.equal(quarantined.length, 0);
  assert.equal(nights.length, 1);
  assert.equal(nights[0].key, '2026-10-09');
  assert.equal(nights[0].main.metrics.tstMin, 465);
  assert.deepEqual(nights[0].main.alternatives, []);
  assert.deepEqual(nights[0].additional, []);
});

test('three sources on one night: what you entered is used, and the others are listed, never added in', () => {
  const { nights } = build([watch(), phone(), mine()]);
  assert.equal(nights.length, 1);
  const n = nights[0];
  assert.equal(n.main.session.sourceKind, 'manual');
  assert.equal(n.main.metrics.tstMin, 465, 'exactly what the person typed, not a blend');
  assert.equal(n.additional.length, 0, 'the other two are the same sleep, not naps');
  assert.deepEqual(n.main.alternatives.map((a) => [a.sourceName, a.tstMin, a.reason]).sort(), [['Apple Watch', 425, 'lower_priority'], ['Sleep app', 520, 'lower_priority']]);
  assert.equal(n.totalAsleep24Min, 465, 'never the sum of the sources');
  assert.ok(!n.main.flags.includes('sources_disagree'), 'the phone says 55 minutes more than you and the watch 40 fewer: under an hour either way');
  const apart = build([mine({ from: '2026-10-08 23:00', to: '2026-10-09 07:00' }), phone({ from: '2026-10-08 20:00', to: '2026-10-09 07:30', stages: [seg('2026-10-08 20:00', '2026-10-09 07:30', 'asleep')] })]);
  assert.ok(apart.nights[0].main.flags.includes('sources_disagree'), 'a phone that says over 3 hours more is a disagreement worth showing');
});

test('without a manual entry, a wearable with stages beats a phone with none', () => {
  const { nights } = build([phone(), watch()]);
  assert.equal(nights[0].main.session.sourceName, 'Apple Watch');
  assert.equal(nights[0].main.metrics.tstMin, 425);
  assert.equal(nights[0].main.alternatives[0].tstMin, 520);
  assert.ok(nights[0].main.flags.includes('sources_disagree'));
});

test('a saved order beats the tiers, and a source not in the list goes below the ones that are', () => {
  const phoneFirst = build([watch(), phone()], { sourceOrder: [sourceId(phone())] });
  assert.equal(phoneFirst.nights[0].main.session.sourceName, 'Sleep app');
  assert.equal(phoneFirst.nights[0].main.metrics.tstMin, 520);
  const [w, p] = [watch(), phone()];
  assert.ok(rankOf(p, [sourceId(p)]) < rankOf(w, [sourceId(p)]));
});

test('a higher-priority device that recorded under half of the best candidate loses the night', () => {
  const dead = watch({
    from: '2026-10-08 23:10', to: '2026-10-09 02:20',
    stages: [seg('2026-10-08 23:10', '2026-10-09 02:20', 'light')],
  }); // 190 minutes, then the battery died
  const full = phone({ from: '2026-10-08 23:00', to: '2026-10-09 06:40', stages: [seg('2026-10-08 23:00', '2026-10-09 06:40', 'asleep')] }); // 460 minutes
  const { nights } = build([dead, full]);
  assert.equal(nights[0].main.session.sourceName, 'Sleep app');
  assert.deepEqual(nights[0].main.alternatives.map((a) => [a.sourceName, a.reason]), [['Apple Watch', 'below_coverage_floor']]);
  // what you typed is never overruled by the floor
  const typed = mine({ from: '2026-10-08 23:00', to: '2026-10-09 02:30' });
  assert.equal(build([typed, full]).nights[0].main.session.sourceKind, 'manual');
});

test('the same input in any order gives the same nights', () => {
  const all = [watch({ id: 'w' }), phone({ id: 'p' }), mine({ id: 'm' }), session({ id: 'n', from: '2026-10-09 14:00', to: '2026-10-09 14:45' }), session({ id: 'o', from: '2026-10-09 23:00', to: '2026-10-10 06:30' })];
  const first = JSON.stringify(build(all).nights);
  for (const order of [[4, 3, 2, 1, 0], [2, 0, 4, 1, 3], [1, 3, 0, 4, 2]]) {
    assert.equal(JSON.stringify(build(order.map((i) => all[i])).nights), first);
  }
});

test('two sleeps of one source less than an hour apart are one sleep with a wake in the middle', () => {
  const { nights } = build([mine({ from: '2026-10-08 23:00', to: '2026-10-09 02:00' }), mine({ from: '2026-10-09 02:30', to: '2026-10-09 07:00' })]);
  assert.equal(nights.length, 1);
  const m = nights[0].main.metrics;
  assert.equal(m.tibMin, 480);
  assert.equal(m.wasoMin, 30, 'the gap counts as time awake');
  assert.equal(m.tstMin, 450);
  assert.equal(nights[0].main.session.members.length, 2, 'it remembers which stored entries it was made from');
});

test('two sleeps more than an hour apart stay separate: the longer is the main sleep, the other a nap or second sleep', () => {
  const { nights } = build([mine({ from: '2026-10-08 23:00', to: '2026-10-09 06:00' }), mine({ from: '2026-10-09 14:00', to: '2026-10-09 14:45' })]);
  assert.equal(nights.length, 1);
  assert.equal(nights[0].main.metrics.tstMin, 420);
  assert.deepEqual(nights[0].additional.map((a) => [a.kind, a.metrics.tstMin]), [['nap', 45]]);
  assert.equal(nights[0].totalAsleep24Min, 465);
  const second = build([mine({ from: '2026-10-08 23:00', to: '2026-10-09 04:00' }), mine({ from: '2026-10-09 06:30', to: '2026-10-09 10:30' })]);
  assert.equal(second.nights[0].main.metrics.tstMin, 300);
  assert.deepEqual(second.nights[0].additional.map((a) => a.kind), ['second'], 'four hours asleep is more than a nap');
});

test('a night shift worker\'s daytime sleep is a main sleep, because the rule uses length and not the time of day', () => {
  const { nights } = build([mine({ from: '2026-10-09 08:30', to: '2026-10-09 15:30' }), mine({ from: '2026-10-08 17:00', to: '2026-10-08 18:00' })]);
  assert.equal(nights.find((n) => n.key === '2026-10-09')?.main.metrics.tstMin, 420);
});

test('with an 18:00 cutoff, an evening wake-up belongs to the next date', () => {
  const evening = mine({ from: '2026-10-09 10:00', to: '2026-10-09 19:00' });
  assert.equal(build([evening]).nights[0].key, '2026-10-09');
  assert.equal(build([evening], { cutoffHour: 18 }).nights[0].key, '2026-10-10');
});

test('the same import twice is one record, and the newer copy wins', () => {
  const a = watch({ id: 'a', externalId: 'hk-1', recordedAt: at('2026-10-09 07:00') });
  const b = watch({ id: 'b', externalId: 'hk-1', recordedAt: at('2026-10-10 07:00'), stages: [seg('2026-10-08 23:10', '2026-10-09 06:40', 'light')] });
  const { nights } = build([a, b]);
  assert.equal(nights.length, 1);
  assert.equal(nights[0].main.session.members.length, 1, 'not a night joined to its own copy');
  assert.equal(nights[0].main.metrics.tstMin, 450, 'the edited copy');
  // an import with no id of its own is recognised by its source and times
  const c = watch({ id: 'c', externalId: null });
  const d = watch({ id: 'd', externalId: null });
  assert.equal(build([c, d]).nights[0].main.session.members.length, 1);
  // two hand-typed nights are never merged away as copies
  assert.equal(build([mine({ id: 'x' }), mine({ id: 'y' })]).nights[0].main.session.members.length, 2, 'they overlap exactly, so the person sees both until they delete one');
});

test('records that cannot be right are set aside with a reason, and the rest still make nights', () => {
  const bad = [
    mine({ id: 'inverted', from: '2026-10-09 07:00', to: '2026-10-08 23:00' }),
    mine({ id: 'tiny', from: '2026-10-08 23:00', to: '2026-10-08 23:05' }),
    mine({ id: 'huge', from: '2026-10-07 00:00', to: '2026-10-08 12:00' }),
    mine({ id: 'future', from: '2026-10-12 12:30', to: '2026-10-12 20:00' }),
  ];
  const { nights, quarantined } = build([...bad, mine({ id: 'fine' })]);
  assert.equal(nights.length, 1);
  assert.deepEqual(quarantined.map((q) => q.session.id).sort(), ['future', 'huge', 'inverted', 'tiny']);
  assert.ok(quarantined.every((q) => q.reason.length > 0));
});

test('the same sleep an exact number of hours apart is flagged as a likely wrong time zone, and still not merged', () => {
  const eight = (from: string, to: string, name: string) => phone({ from, to, sourceName: name, stages: [seg(from, to, 'asleep')] });
  const a = eight('2026-10-08 23:00', '2026-10-09 07:00', 'Phone A');
  const oneHourLater = eight('2026-10-09 00:00', '2026-10-09 08:00', 'Phone B');
  const flagged = build([a, oneHourLater]).nights[0].main.flags;
  assert.ok(flagged.includes('possible_tz_error'), 'equal length, starts exactly one hour apart');
  assert.ok(!build([a, eight('2026-10-08 23:00', '2026-10-09 07:00', 'Phone B')]).nights[0].main.flags.includes('possible_tz_error'), 'identical times are not a zone error');
  assert.ok(!build([a, eight('2026-10-09 00:20', '2026-10-09 08:20', 'Phone B')]).nights[0].main.flags.includes('possible_tz_error'), 'twenty minutes late is not a whole number of hours');
  assert.ok(!build([a, eight('2026-10-09 00:00', '2026-10-09 07:20', 'Phone B')]).nights[0].main.flags.includes('possible_tz_error'), 'a different length is a different sleep');
});

test('a night with no record has no entry at all, and a short main sleep is flagged but kept', () => {
  const { nights } = build([mine({ from: '2026-10-08 23:00', to: '2026-10-09 07:00' }), mine({ from: '2026-10-10 02:00', to: '2026-10-10 04:30' })]);
  assert.deepEqual(nights.map((n) => n.key), ['2026-10-10', '2026-10-09'], 'newest first, and nothing is invented for the 10th of nothing');
  assert.ok(nights[0].main.flags.includes('short_main'));
  assert.equal(nights[0].main.metrics.tstMin, 150);
});

test('a night is never empty-handed: with nothing at all there are no nights and nothing quarantined', () => {
  assert.deepEqual(build([]), { nights: [], quarantined: [] });
});
