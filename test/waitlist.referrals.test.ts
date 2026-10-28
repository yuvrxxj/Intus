import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHandler, clientIpFrom, type Deps, type StoredWaitlist } from '../supabase/functions/join-waitlist/handler.ts';
import { normalReferralEmail, referralCodeFrom, referralLink } from '../supabase/functions/_shared/waitlistRules.ts';
import {
  initialWaitlistState,
  interpretConfirmResponse,
  payloadFrom,
  placeText,
  reduceWaitlist,
  shareLink,
} from '../src/features/home/waitlist.ts';
import { currentReferral, referralFromSearch, rememberReferral, REFERRAL_KEY } from '../src/features/home/referral.ts';

const CODE = 'AB12CD34EF';
const TOKEN = 'c'.repeat(43);
const NOW = Date.parse('2026-10-29T12:00:00.000Z');

test('a referral code is ten hex characters, any case, and nothing else', () => {
  assert.equal(referralCodeFrom('ab12cd34ef'), CODE);
  assert.equal(referralCodeFrom(` ${CODE} `), CODE);
  for (const bad of ['', 'ab12', 'ZZ12CD34EF', `${CODE}0`, null, undefined, 5, {}]) assert.equal(referralCodeFrom(bad), null);
  assert.equal(referralLink(CODE), `https://intus.fit/?ref=${CODE}`);
  assert.equal(shareLink(CODE), `https://intus.fit/?ref=${CODE}`);
});

test('the same inbox in another spelling is one person, so it cannot refer itself', () => {
  assert.equal(normalReferralEmail('Person+Friend@Example.com'), 'person@example.com');
  assert.equal(normalReferralEmail('first.last+x@gmail.com'), 'firstlast@gmail.com');
  assert.equal(normalReferralEmail('first.last@googlemail.com'), 'firstlast@gmail.com');
  assert.notEqual(normalReferralEmail('per.son@example.com'), normalReferralEmail('person@example.com'));
});

test('the join body carries the code only when it is valid', () => {
  const state = { ...initialWaitlistState(false), email: 'Me@Example.com' };
  const submitting = reduceWaitlist(state, { type: 'submit' });
  assert.deepEqual(payloadFrom(submitting), { action: 'join', email: 'me@example.com', device: 'laptop', company: '' });
  assert.deepEqual(payloadFrom(submitting, 'nonsense'), { action: 'join', email: 'me@example.com', device: 'laptop', company: '' });
  assert.deepEqual(payloadFrom(submitting, CODE.toLowerCase()), { action: 'join', email: 'me@example.com', device: 'laptop', company: '', ref: CODE });
});

test('the confirm response gives the page a place, a count and a code, or nothing when it is malformed', () => {
  const good = interpretConfirmResponse(200, { result: 'confirmed', device: 'laptop', tracksToday: '', referral: { code: CODE, place: 3, referrals: 2 } });
  assert.deepEqual(good, { kind: 'confirmed', details: { device: 'laptop', tracksToday: '', referral: { code: CODE, place: 3, referrals: 2 } } });
  for (const referral of [undefined, null, { code: 'x', place: 3, referrals: 0 }, { code: CODE, place: 0, referrals: 0 }, { code: CODE, place: 1.5, referrals: 0 }, { code: CODE, place: 2, referrals: -1 }, { code: CODE, place: '2', referrals: 0 }]) {
    const result = interpretConfirmResponse(200, { result: 'confirmed', device: 'laptop', tracksToday: '', referral });
    assert.equal(result.kind === 'confirmed' ? result.details.referral : 'wrong', null);
  }
  assert.equal(placeText(4), 'Your place: #4');
});

test('a code from the link is kept for the visit, and a bad or missing one is ignored', () => {
  const kept = new Map<string, string>();
  const store = { getItem: (k: string) => kept.get(k) ?? null, setItem: (k: string, v: string) => { kept.set(k, v); } };
  assert.equal(referralFromSearch(`?ref=${CODE.toLowerCase()}&x=1`), CODE);
  assert.equal(referralFromSearch('?ref=nope'), null);
  assert.equal(rememberReferral('?ref=nope', store), null);
  assert.equal(kept.size, 0);
  assert.equal(rememberReferral(`?ref=${CODE}`, store), CODE);
  assert.equal(kept.get(REFERRAL_KEY), CODE);
  assert.equal(currentReferral('', store), CODE, 'a reload without the query string still has it');
  assert.equal(currentReferral('?ref=0000000000', store), '0000000000', 'a newer link wins');
  assert.equal(currentReferral('', null), null);
  const blocked = { getItem: () => { throw new Error('blocked'); }, setItem: () => { throw new Error('blocked'); } };
  assert.equal(rememberReferral(`?ref=${CODE}`, blocked), CODE);
  assert.equal(currentReferral('', blocked), null);
});

interface Row extends StoredWaitlist { email: string; referredBy: string | null }

function setup(over: Partial<Deps> = {}) {
  const rows = new Map<string, Row>();
  const referrerLookups: string[] = [];
  let seq = 0;
  const deps: Deps = {
    now: () => NOW,
    allowJoin: () => true,
    clientIp: clientIpFrom,
    newToken: () => TOKEN,
    log: () => {},
    findByEmail: async (email) => rows.get(email) ?? null,
    insert: async (row) => {
      if (rows.has(row.email)) return 'exists';
      seq += 1;
      rows.set(row.email, { id: `r${seq}`, email: row.email, device: row.device, status: 'pending', confirmTokenHash: row.confirmTokenHash, confirmTokenExpiresAt: row.confirmTokenExpiresAt, confirmSentAt: row.confirmSentAt, tracksToday: null, answeredAt: null, referredBy: row.referredBy ?? null });
      return 'created';
    },
    replaceToken: async () => {},
    findByTokenHash: async (hash) => [...rows.values()].find((r) => r.confirmTokenHash === hash) ?? null,
    markConfirmed: async (id) => { for (const r of rows.values()) if (r.id === id) r.status = 'confirmed'; },
    saveAnswers: async () => {},
    findReferrer: async (code) => {
      referrerLookups.push(code);
      const owner = [...rows.values()].find((r) => r.status === 'confirmed' && code === CODE && r.email === 'owner@example.com');
      return owner ? { id: owner.id, email: owner.email } : null;
    },
    ...over,
  };
  const handle = createHandler(deps);
  const post = (body: unknown) => handle(new Request('https://fn.test/', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) }));
  const join = (email: string, ref?: unknown) => post({ action: 'join', email, device: 'laptop', company: '', ...(ref === undefined ? {} : { ref }) });
  const seed = async () => {
    await join('owner@example.com');
    const owner = rows.get('owner@example.com')!;
    owner.status = 'confirmed';
    return owner;
  };
  return { rows, join, post, seed, referrerLookups };
}

test('a friend who joins with a confirmed person\'s code is stored as referred by them', async () => {
  const t = setup();
  const owner = await t.seed();
  const res = await t.join('friend@example.com', CODE.toLowerCase());
  assert.deepEqual(await res.json(), { result: 'pending' });
  assert.equal(t.rows.get('friend@example.com')!.referredBy, owner.id);
  assert.deepEqual(t.referrerLookups, [CODE]);
});

test('no referral is stored for an unknown code, a malformed one, a pending owner, or the owner\'s own inbox', async () => {
  const t = setup();
  const owner = await t.seed();
  await t.join('a@example.com', '0000000000');
  await t.join('b@example.com', 'not-a-code');
  await t.join('c@example.com', 12345);
  await t.join('owner+me@example.com', CODE);
  assert.equal(t.rows.get('a@example.com')!.referredBy, null);
  assert.equal(t.rows.get('b@example.com')!.referredBy, null);
  assert.equal(t.rows.get('c@example.com')!.referredBy, null);
  assert.equal(t.rows.get('owner+me@example.com')!.referredBy, null, 'the +tag does not make a second person');
  owner.status = 'pending';
  await t.join('d@example.com', CODE);
  assert.equal(t.rows.get('d@example.com')!.referredBy, null);
  assert.deepEqual(t.referrerLookups, ['0000000000', CODE, CODE]);
});

test('signing up again does not move an existing row to a new referrer, and a failed lookup never fails the join', async () => {
  const t = setup();
  await t.seed();
  await t.join('friend@example.com');
  await t.join('friend@example.com', CODE);
  assert.equal(t.rows.get('friend@example.com')!.referredBy, null);

  const broken = setup({ findReferrer: async () => { throw new Error('down'); } });
  const res = await broken.join('x@example.com', CODE);
  assert.equal(res.status, 200);
  assert.equal(broken.rows.get('x@example.com')!.referredBy, null);
});

test('confirming returns the place from the database, and still confirms when the place cannot be worked out', async () => {
  const standing = { code: CODE, place: 2, referrals: 1 };
  const t = setup({ standing: async () => standing });
  await t.join('friend@example.com');
  const friend = t.rows.get('friend@example.com')!;
  // The friend's own token is TOKEN; confirming it flips the row, then asks for the standing.
  const res = await t.post({ action: 'confirm', token: TOKEN });
  const body = await res.json();
  assert.equal(body.result, 'confirmed');
  assert.deepEqual(body.referral, standing);
  assert.equal(friend.status, 'confirmed');

  const failing = setup({ standing: async () => { throw new Error('down'); } });
  await failing.join('g@example.com');
  const failed = await (await failing.post({ action: 'confirm', token: TOKEN })).json();
  assert.equal(failed.result, 'confirmed');
  assert.equal('referral' in failed, false);
});
