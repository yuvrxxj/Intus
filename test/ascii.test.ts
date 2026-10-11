import { test } from 'node:test';
import assert from 'node:assert/strict';
import { renderAscii, type AsciiShape } from '../src/components/ui/ascii-engine.ts';
import { SECTION_ART, SECTION_ART_COLS, SECTION_ART_ROWS } from '../src/features/dashboard/sectionArt.ts';
import { SECTIONS } from '../src/features/dashboard/sections.ts';

const ALL: AsciiShape[] = ['heart', 'drop', 'capsule', 'ring', 'sphere', 'bars', 'cross', 'stack', 'coin', 'cube'];

test('every section has a drawing, and no two neighbouring sections share one', () => {
  assert.deepEqual(Object.keys(SECTION_ART).sort(), SECTIONS.map((s) => s.id).sort());
  SECTIONS.slice(1).forEach((s, i) => assert.notEqual(SECTION_ART[s.id], SECTION_ART[SECTIONS[i].id], `${SECTIONS[i].id} and ${s.id} look the same`));
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
