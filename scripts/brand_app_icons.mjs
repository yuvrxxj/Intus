#!/usr/bin/env node
// Draws the app icon files for the phone apps from the chosen logo (option B, the section cut), straight from its
// vector path, so every size is exact and nothing is redrawn by hand or by an image model.
//
//   mobile/assets/icon.png                       1024 px, the iOS icon: paper mark on full-bleed red, no transparency
//   mobile/assets/android-icon-background.png    1024 px, solid red
//   mobile/assets/android-icon-foreground.png    1024 px, paper mark on transparent, inside Android's safe circle
//   mobile/assets/android-icon-monochrome.png    1024 px, one-colour mark on transparent, which Android tints
//   mobile/assets/splash-icon.png                1024 px, red mark on transparent
//   mobile/assets/favicon.png                    48 px, from public/favicon.svg
//   docs/brand/app-icons/intus-app-icon-2048.png the iOS icon at 2048 px, for stores, decks and design tools
//   docs/brand/app-icons/intus-mark-red-2048.png the red mark on transparent at 2048 px
//
//   npm i --no-save playwright-core        (and `pip install pillow`)
//   CHROMIUM_PATH=/path/to/chrome node scripts/brand_app_icons.mjs      (CHROMIUM_PATH is only needed if Playwright has no browser of its own)
import { execFileSync } from 'node:child_process';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright-core';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const at = (p) => resolve(root, p);

const RED = '#A31621', PAPER = '#E5ECE9', INK = '#000000';

// the mark as one path on a 256 unit artboard, and its bounding box, read off that path
const MARK = (await readFile(at('docs/brand/logos/intus-b-slash.svg'), 'utf8')).match(/ d="([^"]+)"/)[1];
const BOX = { x: 80.13, y: 28, w: 112.87, h: 166.12 };

// Android masks the adaptive icon to a circle of 66 of its 108 units, so the mark has to sit inside 61% of the canvas.
// Centred on its own bounding box, 0.72 of the artboard leaves the farthest corner at 92% of that circle's radius.
const SAFE = 0.72;

/** One 256 unit artboard: an optional full-bleed background, and the mark centred on its bounding box at `scale`. */
function svg({ bg, fill, scale }) {
  const cx = BOX.x + BOX.w / 2, cy = BOX.y + BOX.h / 2;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 256">${bg ? `<rect width="256" height="256" fill="${bg}"/>` : ''}`
    + `<path transform="translate(128 128) scale(${scale}) translate(${-cx} ${-cy})" fill="${fill}" fill-rule="nonzero" d="${MARK}"/></svg>`;
}

const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined, args: ['--no-sandbox', '--allow-file-access-from-files'] });

async function draw(markup, size, { transparent = true } = {}) {
  const page = await browser.newPage({ viewport: { width: size, height: size }, deviceScaleFactor: 1 });
  await page.setContent(`<!doctype html><style>html,body{margin:0;background:transparent}svg{display:block;width:${size}px;height:${size}px}</style>${markup}`);
  const png = await page.screenshot({ omitBackground: transparent });
  await page.close();
  return png;
}

const iosIcon = await readFile(at('docs/brand/logos/intus-b-slash-icon.svg'), 'utf8');
const favicon = await readFile(at('public/favicon.svg'), 'utf8');

await mkdir(at('docs/brand/app-icons'), { recursive: true });
const files = {
  'mobile/assets/icon.png': await draw(iosIcon, 1024, { transparent: false }),
  'mobile/assets/android-icon-background.png': await draw(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 256"><rect width="256" height="256" fill="${RED}"/></svg>`, 1024, { transparent: false }),
  'mobile/assets/android-icon-foreground.png': await draw(svg({ fill: PAPER, scale: SAFE }), 1024),
  'mobile/assets/android-icon-monochrome.png': await draw(svg({ fill: INK, scale: SAFE }), 1024),
  'mobile/assets/splash-icon.png': await draw(svg({ fill: RED, scale: SAFE }), 1024),
  'mobile/assets/favicon.png': await draw(favicon, 48),
  'docs/brand/app-icons/intus-app-icon-2048.png': await draw(iosIcon, 2048, { transparent: false }),
  'docs/brand/app-icons/intus-mark-red-2048.png': await draw(svg({ fill: RED, scale: 1 }), 2048),
};
await browser.close();
for (const [path, png] of Object.entries(files)) await writeFile(at(path), png);

// Apple rejects an app icon that has an alpha channel, even a fully opaque one, so the opaque files are saved as RGB.
// The art is flat colour, so optimising the PNGs costs nothing.
execFileSync('python3', ['-B', '-c', `
from PIL import Image
root = ${JSON.stringify(root)}
opaque = ['mobile/assets/icon.png', 'mobile/assets/android-icon-background.png', 'docs/brand/app-icons/intus-app-icon-2048.png']
for p in ${JSON.stringify(Object.keys(files))}:
    im = Image.open(root + '/' + p)
    im = im.convert('RGB') if p in opaque else im.convert('RGBA')
    im.save(root + '/' + p, optimize=True)
`]);
console.log('wrote', Object.keys(files).join(', '));
