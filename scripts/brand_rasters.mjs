#!/usr/bin/env node
// Draws the pictures the browser and link previews need, from the files scripts/brand_assets.py writes:
//
//   public/favicon.ico            16, 32 and 48 px frames of public/favicon.svg
//   public/apple-touch-icon.png   180 px, the full-bleed icon (iOS rounds the corners itself)
//   public/og.png                 1200 by 630 link preview, from docs/brand/og-image.html
//
//   npm i --no-save playwright-core        (and `pip install pillow`, for the last step)
//   CHROMIUM_PATH=/path/to/chrome node scripts/brand_rasters.mjs      (CHROMIUM_PATH is only needed if Playwright has no browser of its own)
import { execFileSync } from 'node:child_process';
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { chromium } from 'playwright-core';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const at = (p) => resolve(root, p);

/** An .ico file holding one PNG per size, which every current browser reads. */
function ico(frames) {
  const head = Buffer.alloc(6);
  head.writeUInt16LE(1, 2);
  head.writeUInt16LE(frames.length, 4);
  let offset = 6 + 16 * frames.length;
  const dir = frames.map(({ size, png }) => {
    const d = Buffer.alloc(16);
    d[0] = d[1] = size;
    d.writeUInt16LE(1, 4);
    d.writeUInt16LE(32, 6);
    d.writeUInt32LE(png.length, 8);
    d.writeUInt32LE(offset, 12);
    offset += png.length;
    return d;
  });
  return Buffer.concat([head, ...dir, ...frames.map((f) => f.png)]);
}

const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined, args: ['--no-sandbox', '--allow-file-access-from-files'] });

async function shoot(url, width, height, { transparent = false } = {}) {
  const page = await browser.newPage({ viewport: { width, height }, deviceScaleFactor: 1 });
  await page.goto(url);
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(300);
  const png = await page.screenshot({ omitBackground: transparent });
  await page.close();
  return png;
}

// a one-image page at the size wanted; it is a real file, because a page with no address may not load file images
async function drawSvg(file, size, { transparent = true } = {}) {
  const dir = await mkdtemp(join(tmpdir(), 'intus-raster-'));
  const html = join(dir, 'page.html');
  await writeFile(html, `<style>html,body{margin:0;background:transparent}img{display:block;width:${size}px;height:${size}px}</style><img src="${pathToFileURL(at(file))}">`);
  const page = await browser.newPage({ viewport: { width: size, height: size }, deviceScaleFactor: 1 });
  await page.goto(pathToFileURL(html).href);
  await page.waitForFunction(() => document.images[0].complete && document.images[0].naturalWidth > 0);
  const png = await page.screenshot({ omitBackground: transparent });
  await page.close();
  await rm(dir, { recursive: true, force: true });
  return png;
}

await mkdir(at('public'), { recursive: true });
await writeFile(at('public/favicon.ico'), ico(await Promise.all([16, 32, 48].map(async (size) => ({ size, png: await drawSvg('public/favicon.svg', size) })))));
await writeFile(at('public/apple-touch-icon.png'), await drawSvg('docs/brand/logos/intus-b-slash-icon.svg', 180, { transparent: false }));
await writeFile(at('public/og.png'), await shoot(pathToFileURL(at('docs/brand/og-image.html')).href, 1200, 630));
await browser.close();

// The art is flat colour, so a 128 colour palette is invisible and takes the preview from about 300 KB to about 115 KB.
// Some apps (WhatsApp, for one) skip preview images much over 300 KB.
execFileSync('python3', ['-B', '-c', `
from PIL import Image
p = ${JSON.stringify(at('public/og.png'))}
Image.open(p).convert('RGB').quantize(colors=128, method=Image.Quantize.MEDIANCUT, dither=Image.Dither.NONE).save(p, optimize=True)
`]);
console.log('wrote public/favicon.ico, public/apple-touch-icon.png, public/og.png');
