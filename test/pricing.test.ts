import { test } from 'node:test';
import assert from 'node:assert/strict';
import { PRICING, PRICING_PAGE } from '../src/features/home/pricing.ts';
import { DEVICES, WAITLIST } from '../src/features/home/waitlist.ts';

// Every string the site shows about price, from the homepage card and the /pricing page.
const words: string[] = [
  PRICING.headline,
  ...PRICING.points,
  PRICING_PAGE.title,
  PRICING_PAGE.lead,
  ...PRICING_PAGE.sections.flatMap((s) => [s.heading, ...s.paragraphs, ...(s.items ?? [])]),
  ...PRICING_PAGE.questions.flat(),
  ...Object.values(WAITLIST),
  ...DEVICES.map((device) => device.label),
];

test('the site names no price, plan or subscription until the pricing decision is made (INT-38)', () => {
  for (const text of words) {
    assert.doesNotMatch(text, /[$€£₹]\s?\d|\d\s?(USD|EUR|GBP|INR)\b/i, `an amount in: ${text}`);
    assert.doesNotMatch(text, /\b(subscription|lifetime|one-time|per month|a month|per year|a year|discount|trial|founding)\b/i, `a plan or a term in: ${text}`);
  }
});

test('what the site says about cost is that it is free in early access and that the price comes first', () => {
  assert.equal(PRICING.headline, 'Free during early access.');
  const all = words.join(' ');
  assert.match(all, /price will be published/i);
  assert.match(all, /before anything is charged/i);
  assert.match(all, /do not need a card/i);
});

test('the pricing copy has no long dashes and no empty parts', () => {
  for (const text of words) {
    assert.ok(text.trim().length > 0);
    assert.doesNotMatch(text, /[–—]/, text);
  }
  assert.ok(PRICING_PAGE.sections.length >= 3 && PRICING_PAGE.questions.length >= 3);
});
