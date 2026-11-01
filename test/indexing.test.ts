import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { CONFIRMED_PATH, HOME_PATH, PRICING_PATH, PRIVACY_PATH, SIGN_IN_PATH, TERMS_PATH } from '../src/features/home/route.ts';

const HOST = 'https://www.intus.fit';
const sitemap = readFileSync(new URL('../public/sitemap.xml', import.meta.url), 'utf8');
const robots = readFileSync(new URL('../public/robots.txt', import.meta.url), 'utf8');
const vercel = JSON.parse(readFileSync(new URL('../vercel.json', import.meta.url), 'utf8')) as { headers: { source: string; headers: { key: string; value: string }[] }[] };
const listed = [...sitemap.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]);

test('the sitemap lists every public page on the canonical www host, once each', () => {
  const expected = [HOME_PATH, PRICING_PATH, PRIVACY_PATH, TERMS_PATH].map((path) => (path === HOME_PATH ? `${HOST}/` : `${HOST}${path}`));
  assert.deepEqual([...listed].sort(), [...expected].sort());
});

test('the sitemap leaves out the pages that must not be indexed', () => {
  // /waitlist/unsubscribe is the email unsubscribe page (INT-163)
  for (const path of [SIGN_IN_PATH, CONFIRMED_PATH, '/waitlist/unsubscribe', '/photoassets']) {
    assert.ok(!listed.some((loc) => loc.startsWith(`${HOST}${path}`)), `${path} must not be in the sitemap`);
  }
});

test('robots.txt allows the site and points at the sitemap', () => {
  assert.match(robots, /^User-agent: \*$/m);
  assert.match(robots, /^Allow: \/$/m);
  assert.match(robots, new RegExp(`^Sitemap: ${HOST}/sitemap\\.xml$`, 'm'));
});

test('robots.txt does not block pages that are kept out of the index with noindex', () => {
  // A crawler that is blocked never sees the noindex header, so the address could still be listed without a page.
  assert.ok(!/^Disallow:/m.test(robots));
});

test('the pages that stay out of the index send noindex', () => {
  const noindexed = vercel.headers.filter((rule) => rule.headers.some((h) => h.key === 'X-Robots-Tag' && /noindex/.test(h.value))).map((rule) => rule.source);
  for (const path of [CONFIRMED_PATH, SIGN_IN_PATH, '/waitlist/unsubscribe', '/photoassets']) {
    assert.ok(noindexed.includes(path), `${path} needs an X-Robots-Tag noindex header in vercel.json`);
  }
});
