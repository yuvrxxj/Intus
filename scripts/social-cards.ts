#!/usr/bin/env node
// Draws the picture for an X post, in the same paper, ink and red as the link preview (docs/brand/og-image.html), from a
// JSON file of cards. It refuses a card that breaks the rules in docs/social/voice.md, so a drafting agent cannot slip a
// price, a medical claim or an unsourced fact into a picture or a post.
//
//   npm i --no-save playwright-core
//   CHROMIUM_PATH=/path/to/chrome node scripts/social-cards.ts docs/social/cards.example.json [--out social-out] [--size landscape|square|both]
//
// A card is { id, type, ... , post, alt, facts }. `post` is the text that goes with the picture, `alt` its description for
// people who cannot see it, and `facts` the ids (F1, F2 ...) in docs/social/facts.md that every claim comes from.
// Nothing here posts anywhere. The pictures go to a folder that git ignores.
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');

export type CardType = 'statement' | 'number' | 'list';

export interface Card {
  id: string;
  type: CardType;
  kicker?: string;
  headline?: string;
  sub?: string;
  value?: string;
  label?: string;
  items?: string[];
  note?: string;
  post: string;
  alt: string;
  facts: string[];
}

export type Size = 'landscape' | 'square';
export const SIZES: Record<Size, { width: number; height: number }> = { landscape: { width: 1200, height: 675 }, square: { width: 1080, height: 1080 } };

const POST_LIMIT = 280;
/** X counts every link as 23 characters, whatever its length. */
const URL_LENGTH = 23;

/** The fact ids a facts file defines: a heading such as `## F7 Supplement timeline`. */
export function factIds(markdown: string): Set<string> {
  return new Set([...markdown.matchAll(/^#{2,3}\s+(F\d+)\b/gm)].map((m) => m[1]!));
}

export function postLength(text: string): number {
  return [...text.replace(/https?:\/\/\S+/g, 'x'.repeat(URL_LENGTH))].length;
}

// The rules of docs/social/voice.md that a program can check. Each pattern is a thing nobody may post until a person has
// decided it, so a hit stops the card and says why.
const RULES: { pattern: RegExp; why: string }[] = [
  { pattern: /[–—]/, why: 'a long dash (write the sentence another way)' },
  { pattern: /\p{Extended_Pictographic}/u, why: 'an emoji' },
  { pattern: /[$€£₹]\s?\d|\b(price|pricing|subscription|lifetime|discount|pay once|one-time|for free|free (forever|plan|tier|trial))\b/i, why: 'a price or a plan (undecided, INT-38 and INT-49)' },
  { pattern: /\b(cures?|cured|treat(s|ed|ing|ment)?|diagnos\w*|prevent\w*|heals?|healed|detox\w*|boosts?|optimi[sz]\w*|clinically|doctor[- ]approved|FDA|HIPAA)\b/i, why: 'a medical claim' },
  { pattern: /\bAI\b|artificial intelligence/i, why: 'AI (the AI reader is off and not live, INT-108)' },
  { pattern: /\b(Bevel|Whoop|Oura|Garmin|Function Health|Superpower|InsideTracker|Ultrahuman|ID Formulas|Cronometer|MacroFactor)\b/i, why: 'another product by name' },
];

function textOf(card: Card): [string, string][] {
  const parts: [string, string | undefined][] = [['kicker', card.kicker], ['headline', card.headline], ['sub', card.sub], ['value', card.value], ['label', card.label], ['note', card.note], ['post', card.post], ['alt', card.alt]];
  (card.items ?? []).forEach((item, i) => parts.push([`items[${i}]`, item]));
  return parts.filter((p): p is [string, string] => typeof p[1] === 'string');
}

/** Everything wrong with a card, as sentences. An empty list means it may be drawn. */
export function problems(card: Card, known: ReadonlySet<string>): string[] {
  const out: string[] = [];
  if (!card.id || !/^[a-z0-9-]+$/.test(card.id)) out.push('id must be lowercase letters, digits and hyphens');
  if (card.type !== 'statement' && card.type !== 'number' && card.type !== 'list') out.push('type must be statement, number or list');
  if (card.type === 'statement' && !card.headline) out.push('a statement needs a headline');
  if (card.type === 'number' && (!card.value || !card.label)) out.push('a number needs a value and a label');
  if (card.type === 'list' && (!card.headline || !card.items || card.items.length < 2 || card.items.length > 4)) out.push('a list needs a headline and 2 to 4 items');
  if (!card.post) out.push('post text is missing');
  else if (postLength(card.post) > POST_LIMIT) out.push(`post is ${postLength(card.post)} characters, the limit is ${POST_LIMIT}`);
  if (!card.alt) out.push('alt text is missing (every picture needs a description)');
  if (!Array.isArray(card.facts) || card.facts.length === 0) out.push('facts is empty: every claim must come from a fact in docs/social/facts.md');
  else for (const f of card.facts) if (!known.has(f)) out.push(`fact ${f} is not in docs/social/facts.md`);
  for (const [field, text] of textOf(card)) for (const { pattern, why } of RULES) if (pattern.test(text)) out.push(`${field} has ${why}`);
  return out;
}

const escapeHtml = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

function headlineSize(text: string): number {
  const n = text.length;
  return n <= 32 ? 84 : n <= 52 ? 72 : n <= 80 ? 60 : 50;
}

function valueSize(text: string, size: Size): number {
  const n = text.length;
  const [short, medium, long] = size === 'square' ? [260, 190, 130] : [180, 140, 100];
  return n <= 3 ? short : n <= 6 ? medium : long;
}

export interface Assets {
  interFont: string;
  monoFont: string;
  /** the `d` attribute of the mark, from docs/brand/logos/intus-b-slash.svg */
  markPath: string;
}

/** One card as a page of exactly the picture's size. Every string is escaped, so card text can never become markup. */
export function cardHtml(card: Card, size: Size, assets: Assets): string {
  const { width, height } = SIZES[size];
  const pad = size === 'square' ? 80 : 72;
  const kicker = card.kicker ? `<div class="kicker">${escapeHtml(card.kicker)}</div>` : '';
  let body = '';
  if (card.type === 'number') {
    body = `${kicker}<div class="value" style="font-size:${valueSize(card.value ?? '', size)}px">${escapeHtml(card.value ?? '')}</div><div class="label">${escapeHtml(card.label ?? '')}</div>${card.note ? `<div class="note">${escapeHtml(card.note)}</div>` : ''}`;
  } else {
    const h = card.headline ?? '';
    const list = card.type === 'list' ? `<ul>${(card.items ?? []).map((i) => `<li>${escapeHtml(i)}</li>`).join('')}</ul>` : '';
    body = `${kicker}<h1 style="font-size:${headlineSize(h)}px">${escapeHtml(h)}</h1>${card.sub ? `<div class="sub">${escapeHtml(card.sub)}</div>` : ''}${list}${card.note ? `<div class="note">${escapeHtml(card.note)}</div>` : ''}`;
  }
  return `<!doctype html><html lang="en"><meta charset="utf-8"><title>${escapeHtml(card.id)}</title>
<style>
@font-face { font-family: Inter; font-weight: 100 900; src: url(${assets.interFont}) format("woff2"); }
@font-face { font-family: Mono; font-weight: 100 800; src: url(${assets.monoFont}) format("woff2"); }
* { box-sizing: border-box; margin: 0; }
html, body { width: ${width}px; height: ${height}px; }
body { position: relative; overflow: hidden; background-color: #E5ECE9; color: #1F1300; font-family: Inter, sans-serif;
  background-image: radial-gradient(circle at center, #A3988F 1.25px, transparent 1.75px); background-size: 22px 22px; }
.halo { text-shadow: 0 0 4px #E5ECE9, 0 0 4px #E5ECE9, 0 0 8px #E5ECE9, 0 0 8px #E5ECE9, 0 0 14px #E5ECE9, 0 0 18px #E5ECE9; }
.card { position: absolute; inset: 0; padding: ${pad}px; display: flex; flex-direction: column; justify-content: space-between; }
.brand { display: flex; align-items: center; gap: 14px; font: 600 24px/1 Mono, monospace; letter-spacing: .12em; }
.brand svg { height: 60px; width: auto; fill: #A31621; }
.main { display: flex; flex-direction: column; gap: ${size === 'square' ? 26 : 20}px; max-width: ${width - pad * 2}px; }
.kicker { font: 700 20px/1 Mono, monospace; letter-spacing: .1em; text-transform: uppercase; color: #A31621; }
h1 { font-weight: 600; letter-spacing: -.035em; line-height: 1.04; }
.sub { font-size: 30px; line-height: 1.4; color: #48422F; max-width: 900px; }
.value { font: 700 200px/.9 Mono, monospace; letter-spacing: -.04em; color: #A31621; }
.label { font-size: 44px; line-height: 1.15; font-weight: 600; letter-spacing: -.02em; }
.note { font: 600 20px/1.5 Mono, monospace; color: #48422F; max-width: 900px; }
ul { list-style: none; padding: 0; display: grid; gap: 18px; }
li { display: flex; gap: 18px; align-items: baseline; font: 600 30px/1.3 Mono, monospace; }
li::before { content: ""; width: 14px; height: 14px; background: #A31621; flex: none; }
.url { font: 600 19px/1 Mono, monospace; letter-spacing: .08em; color: #A31621; }
</style>
<body><div class="card">
<div class="brand halo"><svg viewBox="64 28 128 200" aria-hidden="true"><path d="${assets.markPath}"/></svg>INTUS</div>
<div class="main halo">${body}</div>
<div class="url halo">INTUS.FIT</div>
</div></body></html>`;
}

async function loadAssets(): Promise<Assets> {
  const svg = await readFile(join(root, 'docs/brand/logos/intus-b-slash.svg'), 'utf8');
  const markPath = /\sd="([^"]+)"/.exec(svg)?.[1];
  if (!markPath) throw new Error('could not read the mark from docs/brand/logos/intus-b-slash.svg');
  const font = (p: string) => pathToFileURL(join(root, 'node_modules/@fontsource-variable', p)).href;
  return { markPath, interFont: font('inter/files/inter-latin-wght-normal.woff2'), monoFont: font('jetbrains-mono/files/jetbrains-mono-latin-wght-normal.woff2') };
}

/** The few parts of playwright-core this script uses. */
interface PageLike {
  goto(url: string): Promise<unknown>;
  evaluate(fn: () => unknown): Promise<unknown>;
  waitForTimeout(ms: number): Promise<void>;
  screenshot(): Promise<Uint8Array>;
  close(): Promise<void>;
}
interface BrowserLike {
  newPage(options: { viewport: { width: number; height: number }; deviceScaleFactor: number }): Promise<PageLike>;
  close(): Promise<void>;
}
interface Playwright {
  chromium: { launch(options: { executablePath?: string; args: string[] }): Promise<BrowserLike> };
}

async function main() {
  const args = process.argv.slice(2);
  const flag = (name: string, fallback: string) => (args.includes(name) ? args[args.indexOf(name) + 1] ?? fallback : fallback);
  const file = args.find((a, i) => !a.startsWith('--') && !(i > 0 && args[i - 1]!.startsWith('--')));
  if (!file) {
    console.error('usage: node scripts/social-cards.ts cards.json [--out social-out] [--size landscape|square|both]');
    process.exit(2);
  }
  const outDir = resolve(flag('--out', 'social-out'));
  const which = flag('--size', 'landscape');
  const sizes: Size[] = which === 'both' ? ['landscape', 'square'] : which === 'square' ? ['square'] : ['landscape'];

  const cards = JSON.parse(await readFile(resolve(file), 'utf8')) as Card[];
  const known = factIds(await readFile(join(root, 'docs/social/facts.md'), 'utf8'));
  let bad = 0;
  for (const card of cards) {
    const list = problems(card, known);
    for (const p of list) console.error(`${card.id ?? '(no id)'}: ${p}`);
    bad += list.length;
  }
  if (bad > 0) {
    console.error(`${bad} problem${bad === 1 ? '' : 's'}. Nothing was drawn.`);
    process.exit(1);
  }

  let chromium: Playwright['chromium'];
  try {
    // the name is held in a variable so the typecheck, which has no playwright-core, does not need the package
    const name = 'playwright-core';
    ({ chromium } = (await import(name)) as Playwright);
  } catch {
    console.error('playwright-core is not installed. Run: npm i --no-save playwright-core');
    process.exit(2);
  }
  const assets = await loadAssets();
  await mkdir(outDir, { recursive: true });
  const tmp = await mkdtemp(join(tmpdir(), 'intus-social-'));
  const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined, args: ['--no-sandbox', '--allow-file-access-from-files'] });
  try {
    for (const card of cards) {
      for (const size of sizes) {
        // a real file, because a page with no address may not load the fonts
        const html = join(tmp, `${card.id}-${size}.html`);
        await writeFile(html, cardHtml(card, size, assets));
        const page = await browser.newPage({ viewport: SIZES[size], deviceScaleFactor: 1 });
        await page.goto(pathToFileURL(html).href);
        await page.evaluate(() => document.fonts.ready);
        await page.waitForTimeout(200);
        const png = await page.screenshot();
        await page.close();
        const target = join(outDir, `${card.id}-${size}.png`);
        await writeFile(target, png);
        console.log(`wrote ${target}`);
      }
      await writeFile(join(outDir, `${card.id}.txt`), `${card.post}\n\nAlt text: ${card.alt}\nFacts: ${card.facts.join(', ')}\n`);
    }
  } finally {
    await browser.close();
    await rm(tmp, { recursive: true, force: true });
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) await main();
