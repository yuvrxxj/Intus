import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { cardHtml, factIds, postLength, problems, type Assets, type Card } from '../scripts/social-cards.ts';

const facts = readFileSync(new URL('../docs/social/facts.md', import.meta.url), 'utf8');
const known = factIds(facts);
const assets: Assets = { interFont: 'file:///inter.woff2', monoFont: 'file:///mono.woff2', markPath: 'M0 0' };

const ok: Card = {
  id: 'sets-never-lost',
  type: 'statement',
  headline: 'Every set is saved on your device first.',
  post: 'Every strength set is saved on your device first and then sent.',
  alt: 'A card that says every set is saved on your device first.',
  facts: ['F12'],
};
const with_ = (patch: Partial<Card>): Card => ({ ...ok, ...patch });

test('the fact ids come from the headings of docs/social/facts.md', () => {
  assert.ok(known.has('F1') && known.has('F12') && known.has('F16'));
  assert.ok(!known.has('F99'));
});

test('a card built from a real fact passes', () => {
  assert.deepEqual(problems(ok, known), []);
});

test('every example card in docs/social passes, so the example never teaches a rule it breaks', () => {
  const cards = JSON.parse(readFileSync(new URL('../docs/social/cards.example.json', import.meta.url), 'utf8')) as Card[];
  assert.ok(cards.length >= 3);
  for (const card of cards) assert.deepEqual(problems(card, known), [], card.id);
});

test('a card with no source fact, an unknown fact, no alt text or no post is refused', () => {
  assert.match(problems(with_({ facts: [] }), known).join(), /facts is empty/);
  assert.match(problems(with_({ facts: ['F99'] }), known).join(), /F99 is not in docs\/social\/facts.md/);
  assert.match(problems(with_({ alt: '' }), known).join(), /alt text is missing/);
  assert.match(problems(with_({ post: '' }), known).join(), /post text is missing/);
});

test('a price, a plan, a medical claim, AI, another product, an emoji and a long dash are each refused', () => {
  const bad: [string, RegExp][] = [
    ['Only $5 a month.', /price or a plan/],
    ['A simple one-time purchase.', /price or a plan/],
    ['Intus helps treat low vitamin D.', /medical claim/],
    ['It can prevent deficiency.', /medical claim/],
    ['Our AI reads your report.', /AI/],
    ['Better than Bevel.', /another product/],
    ['Saved on your phone \u{1F4AA}', /emoji/u],
    ['Saved — always.', /long dash/],
  ];
  for (const [text, why] of bad) assert.match(problems(with_({ post: text }), known).join(), why, text);
});

test('the same rules apply to the words inside the picture, not only to the post', () => {
  assert.match(problems(with_({ headline: 'Cure your sleep' }), known).join(), /headline has a medical claim/);
  assert.match(problems(with_({ sub: 'From $9' }), known).join(), /sub has a price/);
  assert.match(problems({ id: 'x', type: 'list', headline: 'H', items: ['one', 'Bevel does this'], post: 'ok', alt: 'ok', facts: ['F1'] }, known).join(), /items\[1\] has another product/);
});

test('the homepage wording about early access is allowed, and a promise of free forever is not', () => {
  assert.deepEqual(problems(with_({ post: 'Free during early access. Laptop, desktop and tablet today.', facts: ['F2'] }), known), []);
  assert.match(problems(with_({ post: 'Free forever for everyone.' }), known).join(), /price or a plan/);
});

test('a post is at most 280 characters and a link counts as 23', () => {
  assert.equal(postLength('https://intus.fit/some/very/long/path/that/goes/on'), 23);
  assert.match(problems(with_({ post: 'x'.repeat(281) }), known).join(), /281 characters/);
  // 250 letters, a space and a link of any length is 274, under the limit
  assert.deepEqual(problems(with_({ post: 'x'.repeat(250) + ' https://intus.fit/some/very/long/path/that/goes/on' }), known).filter((p) => /characters/.test(p)), []);
});

test('a number, a list and a statement each need their own fields', () => {
  assert.match(problems({ ...ok, type: 'number' }, known).join(), /needs a value and a label/);
  assert.match(problems({ ...ok, type: 'list', items: ['only one'] }, known).join(), /2 to 4 items/);
  assert.match(problems({ ...ok, type: 'statement', headline: '' }, known).join(), /needs a headline/);
});

test('card text can never become markup, and the page is exactly the picture size', () => {
  const html = cardHtml(with_({ headline: '<script>alert(1)</script> & "quotes"', kicker: '<b>x</b>' }), 'landscape', assets);
  assert.ok(!html.includes('<script>'));
  assert.ok(html.includes('&lt;script&gt;alert(1)&lt;/script&gt; &amp; &quot;quotes&quot;'));
  assert.ok(html.includes('width: 1200px; height: 675px'));
  assert.ok(cardHtml(ok, 'square', assets).includes('width: 1080px; height: 1080px'));
});
