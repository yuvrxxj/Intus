import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync, statSync } from 'node:fs';
import { MARK_PATH, MARK_VIEWBOX } from '../src/components/brand-mark.ts';

const root = new URL('../', import.meta.url);
const html = readFileSync(new URL('index.html', root), 'utf8');

function meta(key: string): string {
  const m = html.match(new RegExp(`<meta\\s+(?:property|name)="${key}"\\s+content="([^"]*)"`));
  assert.ok(m, `index.html has no ${key} tag`);
  return m[1];
}

/** The pixel size written into a PNG's header, so a wrongly sized image fails here and not in someone's chat. */
function pngSize(file: string): { width: number; height: number } {
  const b = readFileSync(new URL(`public/${file}`, root));
  assert.equal(b.subarray(1, 4).toString('latin1'), 'PNG', `${file} is not a PNG`);
  return { width: b.readUInt32BE(16), height: b.readUInt32BE(20) };
}

test('the link preview names an absolute image on the site, at the size it says', () => {
  const site = new URL(meta('og:url'));
  const image = new URL(meta('og:image'));
  assert.equal(image.origin, site.origin, 'og:image must be on the same site as og:url');
  assert.equal(meta('twitter:image'), meta('og:image'));
  assert.equal(meta('twitter:card'), 'summary_large_image');
  assert.ok(meta('og:image:alt').length > 10 && meta('twitter:image:alt').length > 10, 'the preview image needs a description');
  const file = image.pathname.slice(1);
  assert.ok(existsSync(new URL(`public/${file}`, root)), `public/${file} is missing, so the preview would be blank`);
  assert.deepEqual(pngSize(file), { width: Number(meta('og:image:width')), height: Number(meta('og:image:height')) });
});

test('the preview image is small enough for apps that skip big ones', () => {
  // WhatsApp, among others, leaves out preview images much over 300 KB
  const kb = statSync(new URL('public/og.png', root)).size / 1024;
  assert.ok(kb < 300, `og.png is ${Math.round(kb)} KB`);
});

test('every icon the page links to exists', () => {
  const links = [...html.matchAll(/<link\s+rel="(icon|apple-touch-icon)"\s+href="([^"]+)"/g)];
  assert.ok(links.length >= 3, 'expected an .ico, an .svg and an apple touch icon');
  for (const [, , href] of links) assert.ok(existsSync(new URL(`public${href}`, root)), `${href} is linked but missing from public/`);
  assert.deepEqual(pngSize('apple-touch-icon.png'), { width: 180, height: 180 });
});

test('favicon.ico holds the 16, 32 and 48 pixel frames', () => {
  const b = readFileSync(new URL('public/favicon.ico', root));
  assert.equal(b.readUInt16LE(0), 0, 'ico reserved field');
  assert.equal(b.readUInt16LE(2), 1, 'ico type');
  const count = b.readUInt16LE(4);
  const sizes = Array.from({ length: count }, (_, i) => b[6 + i * 16]).sort((a, c) => a - c);
  assert.deepEqual(sizes, [16, 32, 48]);
});

test('the favicon and the app draw the same mark', () => {
  assert.match(MARK_VIEWBOX, /^\d+ \d+ \d+ \d+$/);
  assert.ok(MARK_PATH.length > 500, 'the mark path looks empty');
  assert.ok(readFileSync(new URL('public/favicon.svg', root), 'utf8').includes(MARK_PATH), 'public/favicon.svg and brand-mark.ts have drifted apart; run scripts/brand_assets.py');
});
