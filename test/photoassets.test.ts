import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

const root = new URL('../', import.meta.url);

/** The public names. Upload hashes are stripped; these are the addresses on the site. */
const FILES = [
  '01-experiment.png',
  '02-is-it-working.png',
  '03-track-everything.png',
  '04-coming-together.png',
  '05-habits-leave-evidence.png',
  '06-not-a-coach.png',
  '07-input.png',
  '08-output.png',
  '09-the-stack.png',
  '10-the-gap.png',
  '11-bloodwork.png',
  '12-the-timeline.png',
  '13-stop-guessing.png',
  '14-ownership.png',
  '15-introducing.png',
  '16-four-sources.png',
  '17-the-test.png',
  '18-the-deal.png',
  '19-the-name.png',
  '20-guestlist.png',
];

function read(path: string): string {
  return readFileSync(new URL(path, root), 'utf8');
}

test('the twenty marketing images are static PNGs under public/photoassets', () => {
  const dir = new URL('public/photoassets/', root);
  const pngs = readdirSync(dir).filter((name) => name.endsWith('.png')).sort();
  assert.deepEqual(pngs, FILES);
  for (const name of FILES) {
    const bytes = readFileSync(new URL(name, dir));
    assert.equal(bytes.subarray(1, 4).toString('latin1'), 'PNG', `${name} is not a PNG`);
    assert.equal(bytes.readUInt32BE(16), 2160);
    assert.equal(bytes.readUInt32BE(20), 2160);
  }
});

test('the photoassets page is static, lists every file, and asks not to be indexed', () => {
  const html = read('public/photoassets/index.html');
  assert.match(html, /<meta\s+name="robots"\s+content="noindex, nofollow">/);
  // a static document, so the signed-in app never boots and a logged-out visit is not sent to sign-in
  assert.doesNotMatch(html, /src\/main\.tsx|<script/);
  for (const name of FILES) {
    const href = `/photoassets/${name}`;
    assert.ok(html.includes(`src="${href}"`), `${href} is not shown`);
    assert.ok(html.includes(`href="${href}"`), `${href} is not linked`);
  }
  assert.equal(html.match(/<img /g)?.length, FILES.length);
});

test('/photoassets stays out of search without changing the rest of the site', () => {
  const vercel = JSON.parse(read('vercel.json')) as {
    headers: { source: string; headers: { key: string; value: string }[] }[];
    rewrites: { source: string; destination: string }[];
  };
  const robots = vercel.headers.filter((rule) => rule.headers.some((header) => header.key === 'X-Robots-Tag'));
  // /waitlist/confirmed and /signin are kept out of search too (test/indexing.test.ts); the photo assets are the last two
  assert.deepEqual(robots.map((rule) => rule.source).slice(-2), ['/photoassets', '/photoassets/:path*']);
  for (const rule of robots) {
    assert.deepEqual(rule.headers, [{ key: 'X-Robots-Tag', value: 'noindex, nofollow' }]);
  }
  assert.deepEqual(vercel.rewrites.at(-1), { source: '/(.*)', destination: '/index.html' });
  assert.deepEqual(
    vercel.rewrites.slice(0, -1),
    [
      { source: '/photoassets', destination: '/photoassets/index.html' },
      { source: '/photoassets/', destination: '/photoassets/index.html' },
    ],
  );
  assert.doesNotMatch(read('index.html'), /photoassets/);
});

test('no sitemap lists the photo assets', () => {
  const skip = new Set(['node_modules', 'dist', '.git']);
  const found: string[] = [];
  const walk = (dir: string) => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      if (skip.has(entry.name)) continue;
      const path = join(dir, entry.name);
      if (entry.isDirectory()) walk(path);
      else if (/sitemap/i.test(entry.name)) found.push(path);
    }
  };
  walk(fileURLToPath(root));
  for (const path of found) assert.doesNotMatch(readFileSync(path, 'utf8'), /photoassets/);
});

function fileURLToPath(url: URL): string {
  return decodeURIComponent(url.pathname);
}
