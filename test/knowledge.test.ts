import { test } from 'node:test';
import assert from 'node:assert/strict';
import { KNOWLEDGE, matchKnowledge, searchKnowledge } from '../src/features/knowledge/knowledge.ts';

const ids = (query: string) => searchKnowledge(KNOWLEDGE, query).map((e) => e.id);
const match = (name: string) => matchKnowledge(KNOWLEDGE, name)?.id ?? null;

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

test('a supplement a person records is matched to its entry by the name they typed', () => {
  assert.equal(match('Creatine'), 'creatine');
  assert.equal(match('Creatine monohydrate 5 g'), 'creatine');
  assert.equal(match('Vitamin D'), 'vitamin-d');
  assert.equal(match('Vitamin D3 2000 IU'), 'vitamin-d');
  assert.equal(match('Vitamin D3+K2'), 'vitamin-d');
  assert.equal(match('Fish Oil 1000mg'), 'omega-3');
  assert.equal(match('Omega 3'), 'omega-3');
  assert.equal(match('omega-3 (EPA/DHA)'), 'omega-3');
  assert.equal(match('B12'), 'vitamin-b12');
  assert.equal(match('Methylcobalamin'), 'vitamin-b12');
  assert.equal(match('Biotin 10mg'), 'biotin');
  assert.equal(match('Hair, skin and nails'), 'biotin');
  assert.equal(match('Whey protein isolate'), 'protein-powder');
  assert.equal(match('Iron bisglycinate'), 'iron');
  assert.equal(match('Zinc 25mg'), 'zinc');
  assert.equal(match('Niacin 500mg'), 'niacin');
});

test('a name with no entry matches nothing, and only whole words count', () => {
  for (const name of ['', '   ', 'Multivitamin', 'Magnesium glycinate', 'Ashwagandha', 'Vitamin C', 'Vitamin B6', 'Niacinamide']) {
    assert.equal(match(name), null, `"${name}" has no entry`);
  }
  assert.equal(match('Environment blend'), null, '"iron" is not a part of "environment"');
  assert.equal(match('Ironclad'), null);
});
