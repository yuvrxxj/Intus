/**
 * Small 3D shapes drawn in characters: each character cell casts a ray at a signed distance field, and the lit
 * surface picks a character from a density ramp. The shape turns slowly, renders at a low frame rate, pauses when
 * off screen or in a background tab, and holds one still frame when the person prefers reduced motion.
 */
export type AsciiShape = 'heart' | 'drop' | 'capsule' | 'ring' | 'sphere' | 'bars' | 'cross' | 'stack' | 'coin' | 'cube';

type Vec = [number, number, number];

const RAMP = ' .:-=+*#%@';
export const SWAYS: ReadonlySet<AsciiShape> = new Set(['heart', 'drop']);
export const FPS = 18;

const len = (x: number, y: number, z: number) => Math.sqrt(x * x + y * y + z * z);
const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

/** Inigo Quilez's round cone: a sphere of radius r1 at a, one of r2 at b, and the hull between them. */
function roundCone(px: number, py: number, pz: number, a: Vec, b: Vec, r1: number, r2: number): number {
  const bax = b[0] - a[0], bay = b[1] - a[1], baz = b[2] - a[2];
  const l2 = bax * bax + bay * bay + baz * baz;
  const rr = r1 - r2;
  const a2 = l2 - rr * rr;
  const il2 = 1 / l2;
  const pax = px - a[0], pay = py - a[1], paz = pz - a[2];
  const y = pax * bax + pay * bay + paz * baz;
  const z = y - l2;
  const cx = pax * l2 - bax * y, cy = pay * l2 - bay * y, cz = paz * l2 - baz * y;
  const x2 = cx * cx + cy * cy + cz * cz;
  const y2 = y * y * l2;
  const z2 = z * z * l2;
  const k = Math.sign(rr) * rr * rr * x2;
  if (Math.sign(z) * a2 * z2 > k) return Math.sqrt(x2 + z2) * il2 - r2;
  if (Math.sign(y) * a2 * y2 < k) return Math.sqrt(x2 + y2) * il2 - r1;
  return (Math.sqrt(x2 * a2 * il2) + y * rr) * il2 - r1;
}

function smin(a: number, b: number, k: number): number {
  const h = clamp(0.5 + (0.5 * (b - a)) / k, 0, 1);
  return b + (a - b) * h - k * h * (1 - h);
}


/** Signed distance to a box with half sizes bx, by, bz, corners rounded by r. */
function box(x: number, y: number, z: number, bx: number, by: number, bz: number, r = 0): number {
  const dx = Math.abs(x) - bx + r, dy = Math.abs(y) - by + r, dz = Math.abs(z) - bz + r;
  return len(Math.max(dx, 0), Math.max(dy, 0), Math.max(dz, 0)) + Math.min(Math.max(dx, dy, dz), 0) - r;
}

/** Signed distance to an upright cylinder of radius rad and half height h, edges rounded by r. */
function disc(x: number, y: number, z: number, rad: number, h: number, r = 0): number {
  const dx = Math.sqrt(x * x + z * z) - rad + r, dy = Math.abs(y) - h + r;
  return Math.min(Math.max(dx, dy), 0) + Math.sqrt(Math.max(dx, 0) ** 2 + Math.max(dy, 0) ** 2) - r;
}

/** Shapes seen a little from above, so a flat ring or coin does not turn edge-on to a line. */
const PITCH_BIAS: Partial<Record<AsciiShape, number>> = { ring: 0.5, coin: 0.7, stack: 0.38, cube: 0.45, bars: 0.3, cross: 0.25 };

const SDF: Record<AsciiShape, (x: number, y: number, z: number) => number> = {
  heart: (x, y, z) => {
    const zz = z * 1.45;
    const left = roundCone(x, y, zz, [0, -0.78, 0], [-0.43, 0.2, 0], 0.07, 0.47);
    const right = roundCone(x, y, zz, [0, -0.78, 0], [0.43, 0.2, 0], 0.07, 0.47);
    return smin(left, right, 0.08) / 1.45;
  },
  drop: (x, y, z) => roundCone(x, y, z, [0, -0.32, 0], [0, 0.78, 0], 0.55, 0.02),
  capsule: (x, y, z) => {
    // tilted pill
    const c = Math.cos(0.7), s = Math.sin(0.7);
    const rx = c * x - s * y, ry = s * x + c * y;
    const h = clamp(ry, -0.5, 0.5);
    return len(rx, ry - h, z) - 0.36;
  },
  ring: (x, y, z) => {
    const q = Math.sqrt(x * x + y * y) - 0.62;
    return Math.sqrt(q * q + z * z) - 0.2;
  },
  sphere: (x, y, z) => len(x, y, z) - 0.78,
  // four bars rising left to right: a chart you can walk round
  bars: (x, y, z) => {
    const base = -0.62;
    let d = Infinity;
    [0.36, 0.66, 0.96, 1.26].forEach((h, i) => {
      d = Math.min(d, box(x - (-0.57 + i * 0.38), y - (base + h / 2), z, 0.15, h / 2, 0.15, 0.03));
    });
    return d;
  },
  // a plus sign, the mark of a check-up
  cross: (x, y, z) => Math.min(box(x, y, z, 0.76, 0.24, 0.24, 0.07), box(x, y, z, 0.24, 0.76, 0.24, 0.07)),
  // three discs, one on another: a ledger of days
  stack: (x, y, z) => Math.min(disc(x, y + 0.5, z, 0.74, 0.12, 0.045), disc(x, y, z, 0.74, 0.12, 0.045), disc(x, y - 0.5, z, 0.74, 0.12, 0.045)),
  // a single thick coin, turning
  coin: (x, y, z) => disc(x, y, z, 0.84, 0.11, 0.05),
  cube: (x, y, z) => box(x, y, z, 0.56, 0.56, 0.56, 0.1),
};

/** One frame as text. t is seconds; the shape turns about the vertical axis with a slight nod. */
export function renderAscii(shape: AsciiShape, cols: number, rows: number, t: number, aspect = 0.6): string {
  const sdf = SDF[shape];
  // shapes that only read from the front sway; the rest turn all the way round
  const yaw = SWAYS.has(shape) ? 0.75 * Math.sin(t * 0.6) : t * 0.55;
  const pitch = 0.22 * Math.sin(t * 0.4) + (PITCH_BIAS[shape] ?? 0);
  const cy = Math.cos(yaw), sy = Math.sin(yaw), cp = Math.cos(pitch), sp = Math.sin(pitch);
  // light from the upper left, in front
  const lx = -0.5, ly = 0.65, lz = 0.58;
  const scale = 2.3 / rows;
  const out: string[] = [];
  const at = (x: number, y: number, z: number) => {
    // world to object space: undo pitch (about x) then yaw (about y)
    const y1 = cp * y - sp * z;
    const z1 = sp * y + cp * z;
    const x2 = cy * x + sy * z1;
    const z2 = -sy * x + cy * z1;
    return sdf(x2, y1, z2);
  };
  for (let r = 0; r < rows; r++) {
    let line = '';
    const py = (rows / 2 - r - 0.5) * scale;
    for (let c = 0; c < cols; c++) {
      const px = (c + 0.5 - cols / 2) * scale * aspect;
      let tz = -2;
      let hit = false;
      for (let i = 0; i < 48; i++) {
        const d = at(px, py, tz);
        if (d < 0.004) { hit = true; break; }
        tz += d;
        if (tz > 2) break;
      }
      if (!hit) { line += ' '; continue; }
      const e = 0.01;
      const nx = at(px + e, py, tz) - at(px - e, py, tz);
      const ny = at(px, py + e, tz) - at(px, py - e, tz);
      const nz = at(px, py, tz - e) - at(px, py, tz + e);
      const nl = len(nx, ny, nz) || 1;
      const diffuse = Math.max(0, (nx * lx + ny * ly + nz * lz) / nl);
      const rim = Math.pow(1 - Math.abs(nz / nl), 3) * 0.25;
      const b = clamp(0.12 + diffuse * 0.8 + rim, 0, 0.999);
      line += RAMP[1 + Math.floor(b * (RAMP.length - 1))] ?? '@';
    }
    out.push(line.replace(/\s+$/, ''));
  }
  return out.join('\n');
}


/** The moment a shape starts at: a slight three-quarter view, so the still frame (reduced motion) reads well. */
export function startTime(shape: AsciiShape): number {
  return SWAYS.has(shape) ? 0.35 : 0.9;
}
