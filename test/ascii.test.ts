import { test } from 'node:test';
import assert from 'node:assert/strict';
import { renderAscii, type AsciiShape } from '../src/components/ui/ascii-engine.ts';
import { SCENE_IDS } from '../src/components/ui/scene-engine.ts';
import { PAGES, PAGE_ART_COLS as SECTION_ART_COLS, PAGE_ART_ROWS as SECTION_ART_ROWS, type PageMeta } from '../src/features/dashboard/pages.ts';

const ALL: AsciiShape[] = [
  'heart', 'drop', 'capsule', 'ring', 'sphere', 'bars', 'cross', 'stack', 'coin', 'cube', 'moon',
  'hourglass', 'target', 'vials', 'bottle', 'stairs',
];

const drawing = (p: PageMeta) => ('scene' in p.art ? `scene:${p.art.scene}` : `shape:${p.art.shape}`);

test('every page has a drawing, and no two neighbouring pages share one', () => {
  PAGES.forEach((p) => {
    const known = 'scene' in p.art ? SCENE_IDS.includes(p.art.scene) : ALL.includes(p.art.shape);
    assert.ok(known, `${p.id} has an unknown drawing`);
  });
  PAGES.slice(1).forEach((p, i) => assert.notEqual(drawing(p), drawing(PAGES[i]), `${PAGES[i].id} and ${p.id} look the same`));
});

test('every page from Today to Progress has its own drawing', () => {
  const own = PAGES.filter((p) => p.id !== 'dashboard' && p.id !== 'account');
  assert.equal(new Set(own.map(drawing)).size, own.length);
});

test('Today to Progress each have a moving engraving, in this order', () => {
  const own = PAGES.filter((p) => p.id !== 'dashboard' && p.id !== 'account');
  assert.deepEqual(own.map((p) => ('scene' in p.art ? p.art.scene : null)), ['hourglass', 'archery', 'bloodwork', 'supplements', 'sisyphus']);
});

test('every shape draws something, in the same way every time', () => {
  for (const shape of ALL) {
    const a = renderAscii(shape, SECTION_ART_COLS, SECTION_ART_ROWS, 0.9);
    assert.equal(a, renderAscii(shape, SECTION_ART_COLS, SECTION_ART_ROWS, 0.9), `${shape} is not repeatable`);
    assert.ok(a.replace(/\s/g, '').length > 60, `${shape} drew almost nothing`);
  }
});

test('no shape is cut off by its frame at any point in its turn, at the size the sections use', () => {
  for (const shape of ALL) {
    for (let step = 0; step < 24; step++) {
      const lines = renderAscii(shape, SECTION_ART_COLS, SECTION_ART_ROWS, step * 0.55).split('\n');
      const t = step * 0.55;
      assert.equal(lines.length, SECTION_ART_ROWS, `${shape}: row count`);
      assert.equal(lines[0].trim(), '', `${shape} touches the top edge at t=${t}`);
      assert.equal(lines.at(-1)!.trim(), '', `${shape} touches the bottom edge at t=${t}`);
      for (const line of lines) {
        assert.ok(line.length <= SECTION_ART_COLS, `${shape}: a line is wider than the frame`);
        assert.ok(!/\S/.test(line[0] ?? ' '), `${shape} touches the left edge at t=${t}`);
        assert.ok(!/\S/.test(line[SECTION_ART_COLS - 1] ?? ' '), `${shape} touches the right edge at t=${t}`);
      }
    }
  }
});
