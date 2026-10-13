import { test } from 'node:test';
import assert from 'node:assert/strict';
import { renderAscii, type AsciiShape } from '../src/components/ui/ascii-engine.ts';
import { PAGES, PAGE_ART_COLS as SECTION_ART_COLS, PAGE_ART_ROWS as SECTION_ART_ROWS } from '../src/features/dashboard/pages.ts';

const ALL: AsciiShape[] = [
  'heart', 'drop', 'capsule', 'ring', 'sphere', 'bars', 'cross', 'stack', 'coin', 'cube', 'moon',
  'hourglass', 'target', 'vials', 'bottle', 'stairs',
];

test('every page has a drawing, and no two neighbouring pages share one', () => {
  PAGES.forEach((p) => assert.ok(ALL.includes(p.art), `${p.id} has an unknown drawing`));
  PAGES.slice(1).forEach((p, i) => assert.notEqual(p.art, PAGES[i].art, `${PAGES[i].id} and ${p.id} look the same`));
});

test('every page from Today to Progress has its own drawing', () => {
  const own = PAGES.filter((p) => p.id !== 'dashboard' && p.id !== 'account').map((p) => p.art);
  assert.equal(new Set(own).size, own.length);
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
