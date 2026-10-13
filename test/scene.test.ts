import { test } from 'node:test';
import assert from 'node:assert/strict';
import { SCENE_IDS, buildScene, renderScene, sceneLines, stillScene, type Scene, type SceneId } from '../src/components/ui/scene-engine.ts';
import { SCENE_ART, SCENE_SIZE } from '../src/components/ui/scene-library.ts';
import { MOTIONS, hash } from '../src/components/ui/scene-motion.ts';

const art = Object.fromEntries(await Promise.all(SCENE_IDS.map(async (id) => [id, await SCENE_ART[id]()]))) as Record<SceneId, Awaited<ReturnType<(typeof SCENE_ART)[SceneId]>>>;
const scenes = Object.fromEntries(SCENE_IDS.map((id) => [id, buildScene(art[id], MOTIONS[id])])) as Record<SceneId, Scene>;

/** The total darkness of a frame, in ramp steps. */
const ink = (steps: Uint8Array) => steps.reduce((sum, k) => sum + k, 0);
const differing = (a: Uint8Array, b: Uint8Array) => a.reduce((n, k, i) => n + (k !== b[i] ? 1 : 0), 0);

test('the size table matches the generated art', () => {
  for (const id of SCENE_IDS) assert.deepEqual(SCENE_SIZE[id], { cols: art[id].cols, rows: art[id].rows }, id);
});

test('the art has one line per row, none wider than the picture, and only characters from its ramp', () => {
  for (const id of SCENE_IDS) {
    const a = art[id];
    assert.equal(a.text.length, a.rows, id);
    assert.ok(a.text.every((line) => line.length <= a.cols), `${id}: a line is wider than the picture`);
    assert.equal(a.ramp[0], ' ', `${id}: the ramp must start with a blank`);
    assert.equal(new Set(a.ramp).size, a.ramp.length, `${id}: the ramp repeats a character`);
    // buildScene throws for a character that is not on the ramp
    assert.doesNotThrow(() => buildScene(a, MOTIONS[id]), id);
  }
});

test('the still picture is the generated art, exactly', () => {
  for (const id of SCENE_IDS) {
    const lines = sceneLines(scenes[id], stillScene(scenes[id]));
    assert.equal(lines.length, art[id].rows, id);
    lines.forEach((line, r) => {
      assert.equal(line.length, art[id].cols, `${id} row ${r}: width`);
      assert.equal(line.trimEnd(), (art[id].text[r] ?? '').trimEnd(), `${id} row ${r}`);
    });
  }
});

test('a frame is the same every time for the same moment', () => {
  for (const id of SCENE_IDS) {
    assert.deepEqual(renderScene(scenes[id], 3.7), renderScene(scenes[id], 3.7), id);
  }
});

test('every picture moves, and keeps moving, without losing or inventing much ink', () => {
  for (const id of SCENE_IDS) {
    const scene = scenes[id];
    const still = stillScene(scene);
    const base = ink(still);
    let previous = still;
    for (const t of [1.5, 3, 4.5, 6, 7.9, 8.6, 12.3, 20, 61]) {
      const frame = renderScene(scene, t);
      assert.ok(differing(frame, still) > 100, `${id} looks the same as its still picture at t=${t}`);
      assert.ok(differing(frame, previous) > 20, `${id} has stopped between frames at t=${t}`);
      const drift = Math.abs(ink(frame) - base) / base;
      // the band of light lifts up to about a sixth of the ink while it crosses; nothing should lose or gain a fifth
      assert.ok(drift < 0.2, `${id} at t=${t} has ${(drift * 100).toFixed(1)}% more or less ink than at rest`);
      assert.ok(frame.every((k) => k < scene.ramp.length), `${id} chose a step beyond the ramp`);
      previous = frame;
    }
  }
});

test('the first frame is close to the still picture: the motion eases in', () => {
  for (const id of SCENE_IDS) {
    const still = stillScene(scenes[id]);
    // paint (sand, bubbles, shimmer) is on from the start, so allow for it; the handles must not have jumped
    assert.ok(differing(renderScene(scenes[id], 0), still) < still.length * 0.4, id);
    assert.ok(differing(renderScene(scenes[id], 0.05), renderScene(scenes[id], 0)) < still.length * 0.25, `${id} jumps in its first moments`);
  }
});

test('a frame is cheap enough for 15 frames a second', () => {
  for (const id of SCENE_IDS) {
    const out = new Uint8Array(scenes[id].cols * scenes[id].rows);
    const start = performance.now();
    for (let i = 0; i < 20; i++) renderScene(scenes[id], i * 0.05, out);
    assert.ok(performance.now() - start < 1500, `${id}: 20 frames took too long`);
  }
});

test('hash is repeatable and spread over 0 to 1', () => {
  assert.equal(hash(3, 9), hash(3, 9));
  const values = Array.from({ length: 2000 }, (_, i) => hash(i, 7));
  assert.ok(values.every((v) => v >= 0 && v < 1));
  const mean = values.reduce((a, b) => a + b, 0) / values.length;
  assert.ok(Math.abs(mean - 0.5) < 0.05, `mean ${mean}`);
});
