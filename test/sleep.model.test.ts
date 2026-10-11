import { test } from 'node:test';
import assert from 'node:assert/strict';
import { NOW, session } from './sleep.helpers.ts';
import { ageBand, bandSentence, classifyHours, CLASS_LABEL } from '../src/features/sleep/ageBand.ts';
import { fixedOffset, LIMITS, sessionProblem, validateSleepForm, type SleepForm } from '../src/features/sleep/model.ts';

const form = (over: Partial<SleepForm> = {}): SleepForm => ({ start: '2026-10-11T23:00', end: '2026-10-12T07:00', latency: '', awake: '', notes: '', ...over });
const ctx = { nowMs: NOW, resolve: fixedOffset(60), tzId: 'Europe/London', existing: [] as ReturnType<typeof session>[] };
const errorsOf = (f: SleepForm, c = ctx) => { const r = validateSleepForm(f, c); assert.equal(r.ok, false); return r.ok ? {} : r.errors; };

test('a night entered by hand becomes instants with the offset the person was in', () => {
  const r = validateSleepForm(form({ latency: '20', awake: '30', notes: ' restless ' }), ctx);
  assert.ok(r.ok);
  if (!r.ok) return;
  assert.deepEqual(r.value, {
    source_kind: 'manual',
    start_at: '2026-10-11T22:00:00.000Z',
    end_at: '2026-10-12T06:00:00.000Z',
    start_offset_min: 60,
    end_offset_min: 60,
    tz_id: 'Europe/London',
    latency_min: 20,
    awake_min: 30,
    start_is_in_bed: true,
    notes: 'restless',
  });
  assert.deepEqual(r.warnings, []);
});

test('the optional fields can be left blank, and then stay empty rather than becoming zero', () => {
  const r = validateSleepForm(form(), ctx);
  assert.ok(r.ok);
  if (r.ok) assert.deepEqual([r.value.latency_min, r.value.awake_min, r.value.notes], [null, null, null]);
  const zero = validateSleepForm(form({ latency: '0', awake: '0' }), ctx);
  assert.ok(zero.ok);
  if (zero.ok) assert.deepEqual([zero.value.latency_min, zero.value.awake_min], [0, 0], 'a typed zero is an answer');
});

test('both times are needed, and getting up has to follow getting into bed', () => {
  assert.match(errorsOf(form({ start: '' })).start ?? '', /got into bed/);
  assert.match(errorsOf(form({ end: '' })).end ?? '', /got up/);
  assert.match(errorsOf(form({ start: 'tonight' })).start ?? '', /got into bed/);
  assert.match(errorsOf(form({ end: '2026-10-11T22:00' })).end ?? '', /after getting into bed/);
  assert.match(errorsOf(form({ end: '2026-10-11T23:00' })).end ?? '', /after getting into bed/);
});

test('under 15 minutes is not sleep, over 20 hours is a typo, and 14 hours asks for a second look', () => {
  assert.match(errorsOf(form({ end: '2026-10-11T23:14' })).end ?? '', /Shorter than 15 minutes/);
  assert.ok(validateSleepForm(form({ end: '2026-10-11T23:15' }), ctx).ok);
  assert.match(errorsOf(form({ start: '2026-10-11T10:00', end: '2026-10-12T07:00' })).end ?? '', /longer than 20 hours/);
  const long = validateSleepForm(form({ start: '2026-10-11T18:00', end: '2026-10-12T09:00' }), ctx); // 15 h
  assert.ok(long.ok);
  if (long.ok) assert.match(long.warnings[0], /more than 14 hours/);
  const edge = validateSleepForm(form({ start: '2026-10-11T19:00', end: '2026-10-12T09:00' }), ctx); // exactly 14 h
  assert.ok(edge.ok);
  if (edge.ok) assert.deepEqual(edge.warnings, []);
});

test('a night cannot end in the future, or start before 2000', () => {
  assert.match(errorsOf(form({ start: '2026-10-12T10:00', end: '2026-10-12T15:00' })).end ?? '', /future/);
  assert.ok(validateSleepForm(form({ start: '2026-10-12T04:00', end: '2026-10-12T13:04' }), ctx).ok, 'five minutes of clock skew is allowed');
  assert.match(errorsOf(form({ start: '1999-12-31T23:00', end: '2000-01-01T07:00' })).start ?? '', /too far back/);
});

test('time to fall asleep and time awake are whole minutes that fit inside the night', () => {
  assert.match(errorsOf(form({ latency: '-5' })).latency ?? '', /whole number of minutes/);
  assert.match(errorsOf(form({ latency: '12.5' })).latency ?? '', /whole number/);
  assert.match(errorsOf(form({ latency: 'a while' })).latency ?? '', /whole number/);
  assert.match(errorsOf(form({ latency: '601' })).latency ?? '', /0 to 600/);
  assert.match(errorsOf(form({ awake: '721' })).awake ?? '', /0 to 720/);
  assert.match(errorsOf(form({ latency: '240', awake: '240' })).awake ?? '', /add up to less than/);
  assert.ok(validateSleepForm(form({ latency: '239', awake: '240' }), ctx).ok);
});

test('notes are short', () => {
  assert.match(errorsOf(form({ notes: 'x'.repeat(201) })).notes ?? '', /200 characters/);
  assert.ok(validateSleepForm(form({ notes: 'x'.repeat(200) }), ctx).ok);
});

test('two entered nights cannot overlap, but a night can be edited and a different source can overlap', () => {
  const mine = session({ id: 'mine', from: '2026-10-11 22:00', to: '2026-10-12 06:00' }); // 23:00 to 07:00 at +1 is 22:00 to 06:00 UTC
  const c = { ...ctx, existing: [mine] };
  assert.match(errorsOf(form(), c).start ?? '', /already have an entry that overlaps/);
  assert.match(errorsOf(form({ start: '2026-10-12T05:00', end: '2026-10-12T09:00' }), c).start ?? '', /overlaps/);
  assert.ok(validateSleepForm(form(), { ...c, editingId: 'mine' }).ok, 'editing the entry itself is not an overlap');
  assert.ok(validateSleepForm(form({ start: '2026-10-12T07:30', end: '2026-10-12T09:00' }), c).ok, 'next to it is fine');
  const watch = session({ id: 'w', from: '2026-10-11 22:00', to: '2026-10-12 06:00', sourceKind: 'healthkit', sourceName: 'Apple Watch' });
  assert.ok(validateSleepForm(form(), { ...ctx, existing: [watch] }).ok, 'a watch recording the same night is expected');
});

test('a session from anywhere is checked for impossible shapes', () => {
  const ok = session({ from: '2026-10-11 23:00', to: '2026-10-12 07:00' });
  assert.equal(sessionProblem(ok, NOW), null);
  assert.match(sessionProblem({ ...ok, end: ok.start }, NOW) ?? '', /ends before it starts/);
  assert.match(sessionProblem({ ...ok, end: Number.NaN }, NOW) ?? '', /not valid/);
  assert.match(sessionProblem({ ...ok, end: ok.start + 10 * 60_000 }, NOW) ?? '', /shorter than 15 minutes/);
  assert.match(sessionProblem({ ...ok, end: ok.start + 21 * 3_600_000 }, NOW) ?? '', /longer than 20 hours/);
  assert.match(sessionProblem(session({ from: '1999-12-31 23:00', to: '2000-01-01 07:00' }), NOW) ?? '', /before 2000/);
  assert.match(sessionProblem(session({ from: '2026-10-12 11:00', to: '2026-10-12 19:00' }), NOW) ?? '', /future/);
  assert.match(sessionProblem({ ...ok, latencyMin: 300, awakeMin: 200 }, NOW) ?? '', /do not fit/);
  assert.equal(LIMITS.maxSessionMin, 1200);
});

// ── how many hours are recommended, by age ───────────────────────────────────────────────────────────────

test('the recommended range follows the age, and there is none to show without a usable age', () => {
  assert.deepEqual(ageBand(40), { label: 'Adults 26 to 64', notBelow: 6, recLow: 7, recHigh: 9, notAbove: 10, includesNaps: false });
  assert.equal(ageBand(25)?.label, 'Young adults 18 to 25');
  assert.equal(ageBand(26)?.label, 'Adults 26 to 64');
  assert.equal(ageBand(64)?.label, 'Adults 26 to 64');
  assert.equal(ageBand(65)?.label, 'Adults 65 and over');
  assert.equal(ageBand(17)?.label, 'Teenagers 14 to 17');
  assert.equal(ageBand(18)?.label, 'Young adults 18 to 25', 'eighteen is an adult');
  assert.equal(ageBand(4)?.includesNaps, true, 'under 6 is counted over 24 hours with naps');
  assert.equal(ageBand(6)?.includesNaps, false);
  for (const none of [null, undefined, 0, -1, 121, 30.5, Number.NaN]) assert.equal(ageBand(none as number | null), null, `no band for ${none}`);
});

test('every age row is ordered and the rows do not overlap or leave a gap from 1 to 120', () => {
  let previous: ReturnType<typeof ageBand> = null;
  for (let age = 1; age <= 120; age += 1) {
    const band = ageBand(age);
    assert.ok(band, `a band for age ${age}`);
    assert.ok(band.notBelow < band.recLow && band.recLow < band.recHigh && band.recHigh < band.notAbove, `${band.label} is in order`);
    if (previous && previous.label !== band.label) assert.ok(band.recLow >= previous.recLow - 3, 'ranges move gradually between rows');
    previous = band;
  }
});

test('a night is placed against the range on a continuous scale, with the edges as the panel printed them', () => {
  const adult = ageBand(40);
  assert.ok(adult);
  const at = (minutes: number) => classifyHours(minutes / 60, adult);
  assert.equal(at(359), 'shorter');
  assert.equal(at(360), 'shorter-possible');
  assert.equal(at(419), 'shorter-possible');
  assert.equal(at(420), 'within');
  assert.equal(at(540), 'within');
  assert.equal(at(541), 'longer-possible');
  assert.equal(at(600), 'longer-possible');
  assert.equal(at(601), 'longer');
  const older = ageBand(70);
  assert.ok(older);
  assert.equal(classifyHours(4.9, older), 'shorter');
  assert.equal(classifyHours(5.5, older), 'shorter-possible');
  assert.equal(classifyHours(8, older), 'within');
  assert.equal(classifyHours(9, older), 'longer-possible');
  assert.equal(classifyHours(9.1, older), 'longer');
});

test('the wording never ranks a longer night above a shorter one or calls either good or bad', () => {
  for (const label of Object.values(CLASS_LABEL)) assert.doesNotMatch(label, /good|bad|poor|great|enough|need|should|catch up/i);
  assert.match(CLASS_LABEL.longer, /^Longer than/);
  assert.match(CLASS_LABEL.shorter, /^Shorter than/);
  const band = ageBand(40);
  assert.ok(band);
  assert.match(bandSentence(band), /7 to 9 hours is the range the National Sleep Foundation panel recommends/);
  assert.match(bandSentence(band), /may be appropriate for some people/);
});
