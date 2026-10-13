/**
 * Pictures made of characters that move. A picture is a grid of tones, read back from the characters of the generated
 * art in src/components/art (lightest to darkest along a ramp). A frame is made in four steps: soft handles pull
 * regions of the grid about (a region slides or turns by a few cells, most at its centre and not at all at its edge),
 * the scene paints a few things on top (falling sand, bubbles), a band of light crosses now and then, and every cell
 * picks its character again. Nothing is stored per frame, and the same time always gives the same frame.
 */
export type SceneId = 'hourglass' | 'archery' | 'bloodwork' | 'supplements' | 'sisyphus';

export const SCENE_IDS: readonly SceneId[] = ['hourglass', 'archery', 'bloodwork', 'supplements', 'sisyphus'];
export const SCENE_FPS = 15;

/** JetBrains Mono cells are 0.6 as wide as they are tall. */
export const CELL_ASPECT = 0.6;

/** The generated art: one line of characters per row, each character a step on the ramp. */
export interface SceneArt {
  cols: number;
  rows: number;
  ramp: string;
  text: readonly string[];
}

/** A soft handle. Everything within `r` of the centre moves by `move(t)` cells and turns by `turn(t)` radians. */
export interface Handle {
  /** the centre, as a share of the width and of the height */
  x: number;
  y: number;
  /** the reach, as a share of the height. The pull is full inside 55% of it and fades to nothing at the edge */
  r: number;
  /** how far the picture inside has moved at time t, in cells (right, down) */
  move?: (t: number) => readonly [number, number];
  /** how far it has turned at time t, clockwise, in radians */
  turn?: (t: number) => number;
}

/** The tones of a frame, for a scene to paint on once the handles have done their work. 0 is paper, 1 is full ink. */
export interface Grid {
  cols: number;
  rows: number;
  tone: Float32Array;
}

/** A band of light that crosses the picture along `angle`, for `travel` seconds out of every `period`, first after `delay`. */
export interface Sweep {
  angle: number;
  period: number;
  travel: number;
  delay: number;
  /** how much of the ink the band lifts at its brightest, 0 to 1 */
  strength: number;
}

export interface Motion {
  handles: readonly Handle[];
  paint?: (g: Grid, t: number) => void;
  sweep?: Sweep;
}

interface Reach {
  cells: Int32Array;
  weight: Float32Array;
  cx: number;
  cy: number;
}

export interface Scene {
  cols: number;
  rows: number;
  ramp: string;
  motion: Motion;
  base: Float32Array;
  reach: readonly Reach[];
  // scratch space, reused by every frame
  sx: Float32Array;
  sy: Float32Array;
  home: Float32Array;
  work: Float32Array;
}

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));
const smoothstep = (a: number, b: number, v: number) => {
  const x = clamp((v - a) / (b - a), 0, 1);
  return x * x * (3 - 2 * x);
};

/** The tone a character stands for: the middle of its step on the ramp, and paper for the blank at the start. */
const toneOf = (level: number, steps: number) => (level === 0 ? 0 : (level + 0.5) / steps);

export function buildScene(art: SceneArt, motion: Motion): Scene {
  const { cols, rows, ramp, text } = art;
  const steps = ramp.length;
  const level = new Map<string, number>();
  [...ramp].forEach((ch, i) => level.set(ch, i));

  const base = new Float32Array(cols * rows);
  for (let r = 0; r < rows; r++) {
    const line = text[r] ?? '';
    for (let c = 0; c < cols; c++) {
      const k = level.get(line[c] ?? ' ');
      if (k === undefined) throw new Error(`scene art: "${line[c]}" at row ${r}, column ${c} is not on the ramp`);
      base[r * cols + c] = toneOf(k, steps);
    }
  }

  const reach = motion.handles.map((h): Reach => {
    const cx = h.x * cols;
    const cy = h.y * rows;
    const radius = h.r * rows;
    const cells: number[] = [];
    const weight: number[] = [];
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const d = Math.hypot((c - cx) * CELL_ASPECT, r - cy);
        const w = 1 - smoothstep(radius * 0.55, radius, d);
        if (w > 0.002) { cells.push(r * cols + c); weight.push(w); }
      }
    }
    return { cells: Int32Array.from(cells), weight: Float32Array.from(weight), cx, cy };
  });

  const home = new Float32Array(cols * rows * 2);
  for (let i = 0; i < cols * rows; i++) { home[i * 2] = i % cols; home[i * 2 + 1] = Math.floor(i / cols); }

  return {
    cols, rows, ramp, motion, base, reach, home,
    sx: new Float32Array(cols * rows),
    sy: new Float32Array(cols * rows),
    work: new Float32Array(cols * rows),
  };
}

const quantise = (tone: Float32Array, steps: number, out: Uint8Array) => {
  for (let i = 0; i < tone.length; i++) {
    const v = tone[i];
    out[i] = v > 0.02 ? Math.min(steps - 1, Math.floor(v * steps)) : 0;
  }
  return out;
};

/** The picture at rest, exactly as the art was generated. This is what reduced motion shows. */
export function stillScene(scene: Scene, out: Uint8Array = new Uint8Array(scene.cols * scene.rows)): Uint8Array {
  return quantise(scene.base, scene.ramp.length, out);
}

/** One frame as a step on the ramp for every cell, row by row. Pass `out` to reuse a buffer. */
export function renderScene(scene: Scene, t: number, out: Uint8Array = new Uint8Array(scene.cols * scene.rows)): Uint8Array {
  const { cols, rows, base, motion, reach, home, sx, sy, work } = scene;
  const cells = cols * rows;
  const steps = scene.ramp.length;

  // the handles ease in over the first second or so, so nothing jumps when the picture starts to move
  const live = smoothstep(0, 1.5, t);
  // where each cell takes its tone from: its own place, moved back by whatever the handles are doing
  let moved = false;
  for (let i = 0; i < cells; i++) { sx[i] = home[i * 2]; sy[i] = home[i * 2 + 1]; }
  motion.handles.forEach((h, hi) => {
    const [dx, dy] = h.move ? h.move(t) : [0, 0];
    const mx = dx * live;
    const my = dy * live;
    const turn = (h.turn ? h.turn(t) : 0) * live;
    if (mx === 0 && my === 0 && turn === 0) return;
    moved = true;
    const { cells: idx, weight, cx, cy } = reach[hi];
    for (let k = 0; k < idx.length; k++) {
      const i = idx[k];
      const w = weight[k];
      let x = sx[i];
      let y = sy[i];
      if (turn !== 0) {
        const vx = (x - cx) * CELL_ASPECT;
        const vy = y - cy;
        const a = -turn * w;
        const cs = Math.cos(a);
        const sn = Math.sin(a);
        x = cx + (vx * cs - vy * sn) / CELL_ASPECT;
        y = cy + (vx * sn + vy * cs);
      }
      sx[i] = x - mx * w;
      sy[i] = y - my * w;
    }
  });

  if (!moved) {
    work.set(base);
  } else {
    // bilinear, so a slide of a fraction of a cell still shows as a change of tone
    for (let i = 0; i < cells; i++) {
      const x = clamp(sx[i], 0, cols - 1);
      const y = clamp(sy[i], 0, rows - 1);
      const x0 = Math.floor(x);
      const y0 = Math.floor(y);
      const x1 = Math.min(x0 + 1, cols - 1);
      const y1 = Math.min(y0 + 1, rows - 1);
      const fx = x - x0;
      const fy = y - y0;
      const top = base[y0 * cols + x0] * (1 - fx) + base[y0 * cols + x1] * fx;
      const bottom = base[y1 * cols + x0] * (1 - fx) + base[y1 * cols + x1] * fx;
      work[i] = top * (1 - fy) + bottom * fy;
    }
  }

  motion.paint?.({ cols, rows, tone: work }, t);

  const sweep = motion.sweep;
  if (sweep) {
    const progress = ((((t - sweep.delay) % sweep.period) + sweep.period) % sweep.period) / sweep.travel;
    const centre = -0.4 + 1.8 * progress;
    if (centre < 1.5) {
      const ca = Math.cos(sweep.angle) * CELL_ASPECT;
      const sa = Math.sin(sweep.angle);
      for (let i = 0; i < cells; i++) {
        if (work[i] === 0) continue;
        const p = ((i % cols) * ca + Math.floor(i / cols) * sa) / rows;
        const d = (p - centre) / 0.17;
        work[i] *= 1 - sweep.strength * Math.exp(-d * d);
      }
    }
  }

  return quantise(work, steps, out);
}

/** The characters of a frame, one string per row, as wide as the picture. */
export function sceneLines(scene: Scene, steps: Uint8Array): string[] {
  const { cols, rows, ramp } = scene;
  const glyph = [...ramp];
  const lines: string[] = [];
  for (let r = 0; r < rows; r++) {
    let line = '';
    for (let c = 0; c < cols; c++) line += glyph[steps[r * cols + c]];
    lines.push(line);
  }
  return lines;
}

/** A frame as text, for tests and for drawing without a canvas. */
export function sceneFrame(scene: Scene, t: number): string[] {
  return sceneLines(scene, renderScene(scene, t));
}
