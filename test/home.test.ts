import { test } from 'node:test';
import assert from 'node:assert/strict';
import { KNOWLEDGE, searchKnowledge } from '../src/features/home/knowledge.ts';
import { initialModeFor, routeFor, SIGN_UP_URL } from '../src/features/home/route.ts';

const ids = (query: string) => searchKnowledge(KNOWLEDGE, query).map((e) => e.id);

test('the homepage is the default, and only /signin opens sign-in', () => {
  assert.equal(routeFor('/'), 'home');
  assert.equal(routeFor(''), 'home');
  assert.equal(routeFor('/signin'), 'signin');
  assert.equal(routeFor('/signin/'), 'signin');
  assert.equal(routeFor('/anything-else'), 'home');
  assert.equal(routeFor('/signin/extra'), 'home');
});

test('the create-account link opens the create-account tab and nothing else does', () => {
  assert.equal(initialModeFor(new URL(SIGN_UP_URL, 'https://intus.fit').search), 'sign-up');
  assert.equal(initialModeFor(''), 'sign-in');
  assert.equal(initialModeFor('?mode=signin'), 'sign-in');
  assert.equal(initialModeFor('?mode=other'), 'sign-in');
});

test('every knowledge entry is complete, unique and in plain ASCII punctuation', () => {
  const seen = new Set<string>();
  for (const entry of KNOWLEDGE) {
    assert.ok(!seen.has(entry.id), `duplicate id ${entry.id}`);
    seen.add(entry.id);
    assert.match(entry.id, /^[a-z0-9-]+$/);
    assert.ok(entry.changes.length > 0, `${entry.id} lists no result it can change`);
    const texts = [entry.name, ...entry.also, ...entry.changes.map((c) => c.marker), entry.why, entry.worthKnowing];
    for (const text of texts) {
      assert.equal(text, text.trim(), `${entry.id}: stray whitespace in "${text}"`);
      assert.ok(text.length > 0, `${entry.id}: empty text`);
      assert.doesNotMatch(text, /[–—]/, `${entry.id}: dash in "${text}"`);
      assert.doesNotMatch(text, /\p{Extended_Pictographic}/u, `${entry.id}: emoji in "${text}"`);
    }
    for (const change of entry.changes) assert.ok(['up', 'down', 'varies'].includes(change.direction));
  }
});

test('an empty search shows everything, in order', () => {
  assert.deepEqual(ids(''), KNOWLEDGE.map((e) => e.id));
  assert.deepEqual(ids('   '), KNOWLEDGE.map((e) => e.id));
});

test('search finds a supplement by its name, another name or a result it moves', () => {
  assert.deepEqual(ids('creatine'), ['creatine']);
  assert.deepEqual(ids('FISH oil'), ['omega-3']);
  assert.deepEqual(ids('hair skin'), ['biotin']);
  assert.deepEqual(ids('ferritin'), ['iron']);
  assert.ok(ids('creatinine').includes('creatine'));
  assert.ok(ids('thyroid').includes('biotin'));
  assert.ok(ids('b12').includes('vitamin-b12'));
});

test('every word typed has to match, and a word only matches the start of a word', () => {
  assert.deepEqual(ids('creatine thyroid'), []);
  assert.deepEqual(ids('zzzz'), []);
  // "ron" sits inside "iron" but does not start any word of it
  assert.ok(!ids('ron').includes('iron'));
});
