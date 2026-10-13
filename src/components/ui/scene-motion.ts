import type { Grid, Motion, SceneId } from './scene-engine.ts';

/**
 * What moves in each picture. Positions are shares of the picture's width and height (x right, y down), read off the
 * generated art, so they hold at any size. Every motion is slow and small, as the statue bust's breathing is: the
 * picture should feel alive, not busy.
 */
const TAU = Math.PI * 2;

/** A repeatable number in [0, 1) from two whole numbers. No random state, so the same time always gives the same frame. */
export function hash(a: number, b: number): number {
  let h = Math.imul(a + 0x9e3779b9, 0x85ebca6b) ^ Math.imul(b + 0x7f4a7c15, 0xc2b2ae35);
  h = Math.imul(h ^ (h >>> 15), 0x2c1b3c6d);
  h = Math.imul(h ^ (h >>> 12), 0x297a2d39);
  return ((h ^ (h >>> 15)) >>> 0) / 4294967296;
}

const wave = (t: number, period: number, phase = 0) => Math.sin(TAU * (t / period) + phase);

/** 0, up to 1 half way through the period, and back to 0: a slow there and back. */
const there = (t: number, period: number) => 0.5 - 0.5 * Math.cos(TAU * (t / period));

const ease = (v: number) => v * v * (3 - 2 * v);

/** 0 to 1 slowly (the push), then back to 0 quickly (the rock rolling down), over and over. */
function push(t: number, period: number): number {
  const p = (((t % period) + period) % period) / period;
  return p < 0.84 ? ease(p / 0.84) : 1 - ease((p - 0.84) / 0.16);
}

function lift(g: Grid, x: number, y: number, v: number) {
  if (x < 0 || y < 0 || x >= g.cols || y >= g.rows) return;
  const i = y * g.cols + x;
  if (g.tone[i] < v) g.tone[i] = v;
}

function dim(g: Grid, x: number, y: number, f: number) {
  if (x < 0 || y < 0 || x >= g.cols || y >= g.rows) return;
  g.tone[y * g.cols + x] *= f;
}

/** Grains of sand falling down the neck of the hourglass, speeding up as they go, and the flicker where they land. */
function sandStream(g: Grid, t: number) {
  const cx = Math.round(g.cols * 0.5);
  const top = g.rows * 0.5;
  const length = g.rows * 0.19;
  for (let k = 0; k < 12; k++) {
    const lane = cx + [-1, 0, 0, 1][k % 4];
    const p = (t * (0.45 + 0.35 * hash(k, 1)) + hash(k, 2)) % 1;
    const y = Math.floor(top + length * Math.pow(p, 1.5));
    const fade = Math.min(1, p * 8, (1 - p) * 5);
    lift(g, lane, y, 0.18 + 0.5 * fade);
    lift(g, lane, y - 1, 0.1 + 0.25 * fade);
  }
  // the heap where they land does not sit still
  const heap = Math.round(top + length);
  const tick = Math.floor(t * 8);
  for (let dx = -6; dx <= 6; dx++) {
    for (let dy = 0; dy < 3; dy++) {
      dim(g, cx + dx, heap + dy, 0.82 + 0.3 * hash(dx + 40, tick * 3 + dy));
    }
  }
}

/** The blood in the tubes: slow bands of light moving through it, and bubbles that climb. */
const TUBES: readonly (readonly [number, number, number])[] = [
  // x, then the span of height the liquid fills, as shares
  [0.19, 0.42, 0.86], [0.34, 0.48, 0.78], [0.54, 0.5, 0.78], [0.72, 0.3, 0.7], [0.88, 0.28, 0.7],
];

function bloodwork(g: Grid, t: number) {
  const { cols, rows, tone } = g;
  for (let y = 0; y < rows; y++) {
    const row = y * cols;
    for (let x = 0; x < cols; x++) {
      const v = tone[row + x];
      if (v < 0.5) continue;
      const band = 0.5 + 0.5 * Math.sin(TAU * (y / 13 - t / 3.4) + 0.9 * Math.sin(x / 9 + t / 2.2));
      // centred on the tone it had, so the liquid as a whole does not get lighter
      tone[row + x] = v + 0.055 - 0.11 * band;
    }
  }
  for (let b = 0; b < 15; b++) {
    const [u, from, to] = TUBES[b % TUBES.length];
    const p = (t * (0.07 + 0.05 * hash(b, 3)) + hash(b, 4)) % 1;
    const y = Math.round((to - p * (to - from)) * rows);
    const x = Math.round(u * cols + (hash(b, 5) - 0.5) * 0.09 * cols + 1.6 * Math.sin(t * 1.3 + b));
    for (let dy = 0; dy < 2; dy++) {
      for (let dx = -1; dx <= 1; dx++) {
        const i = (y + dy) * cols + x + dx;
        if (y + dy >= 0 && y + dy < rows && x + dx >= 0 && x + dx < cols && tone[i] > 0.5) tone[i] *= 0.4;
      }
    }
  }
}

const rattle = (x: number, y: number, k: number) => ({
  x,
  y,
  r: 0.07,
  move: (t: number) => [1.5 * wave(t, 2.3 + 0.3 * k, k * 1.7), 0.7 * wave(t, 1.7 + 0.2 * k, k * 0.9)] as const,
});

export const MOTIONS: Record<SceneId, Motion> = {
  // the sand runs, the heaps shift a little, and light crosses the glass
  hourglass: {
    handles: [
      { x: 0.5, y: 0.37, r: 0.12, move: (t) => [0, 2.6 * there(t, 24)] },
      { x: 0.5, y: 0.78, r: 0.11, move: (t) => [0, -2 * there(t, 24)] },
    ],
    paint: sandStream,
    sweep: { angle: 0.35, period: 11, travel: 5, delay: 3, strength: 0.3 },
  },
  // the bow's limbs give and spring back, the torso breathes
  archery: {
    handles: [
      { x: 0.58, y: 0.12, r: 0.17, move: (t) => [2.4 * wave(t, 5.5), 0] },
      { x: 0.56, y: 0.68, r: 0.15, move: (t) => [2 * wave(t, 5.5, 0.8), 0] },
      { x: 0.42, y: 0.4, r: 0.12, move: (t) => [0, -0.9 * wave(t, 4.2)] },
      { x: 0.33, y: 0.52, r: 0.16, move: (t) => [0, 0.8 * wave(t, 4.2, 1.2)] },
    ],
    sweep: { angle: 0.6, period: 12, travel: 5.5, delay: 4, strength: 0.28 },
  },
  // the blood moves in its tubes, and bubbles rise
  bloodwork: {
    handles: [],
    paint: bloodwork,
    sweep: { angle: 0.15, period: 10, travel: 5, delay: 2, strength: 0.25 },
  },
  // pills rattle, the fallen bottle rocks, light crosses the labels
  supplements: {
    handles: [
      rattle(0.07, 0.82, 0),
      rattle(0.2, 0.89, 1),
      rattle(0.5, 0.9, 2),
      rattle(0.75, 0.91, 3),
      { x: 0.76, y: 0.58, r: 0.22, move: (t) => [1.3 * wave(t, 6.5), 0] },
    ],
    sweep: { angle: 0.8, period: 9, travel: 4.5, delay: 3, strength: 0.3 },
  },
  // he leans in as the rock turns and creeps up the slope, then it rolls back down and he starts again
  sisyphus: {
    handles: [
      {
        x: 0.72, y: 0.33, r: 0.42,
        move: (t) => [5 * push(t, 9), -2.6 * push(t, 9)],
        turn: (t) => 0.11 * wave(t, 6),
      },
      {
        x: 0.25, y: 0.62, r: 0.34,
        move: (t) => [3.2 * push(t, 9), -1.5 * push(t, 9) + 0.4 * wave(t, 3.6)],
      },
    ],
    sweep: { angle: 0.5, period: 13, travel: 6, delay: 5, strength: 0.25 },
  },
};
