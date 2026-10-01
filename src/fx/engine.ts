// The particle layer: sparks, ripples, emoji bursts and confetti on one fixed canvas.
interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  g?: number;
  size: number;
  life: number;
  decay: number;
  rot: number;
  vr?: number;
  color?: string;
  emoji?: string;
  ring?: boolean;
}

const HUES = ['#4a8fe8', '#3dc47a', '#e8b84a', '#d94f5c', '#6b6ef5', '#e07a42'];

let particles: Particle[] = [];
let canvas: HTMLCanvasElement | null = null;
let ctx: CanvasRenderingContext2D | null = null;

export const gesture = { x: 0, y: 0, at: 0 };

export function reducedMotion(): boolean {
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

/** true when the last pointer press was a moment ago, so an effect can tell a click from a programmatic change */
export function freshGesture(): boolean {
  return Date.now() - gesture.at < 450;
}

function fit(): void {
  if (!canvas || !ctx) return;
  const d = Math.min(2, window.devicePixelRatio || 1);
  canvas.width = innerWidth * d;
  canvas.height = innerHeight * d;
  canvas.style.width = `${innerWidth}px`;
  canvas.style.height = `${innerHeight}px`;
  ctx.setTransform(d, 0, 0, d, 0, 0);
}

function draw(): void {
  if (!ctx) return;
  ctx.clearRect(0, 0, innerWidth, innerHeight);
  particles = particles.filter((p) => p.life > 0);
  for (const p of particles) {
    p.x += p.vx;
    p.y += p.vy;
    p.vy += p.g ?? 0;
    p.vx *= 0.985;
    p.vy *= 0.985;
    p.life -= p.decay;
    p.rot += p.vr ?? 0;
    ctx.globalAlpha = Math.max(0, Math.min(1, p.life));
    if (p.emoji) {
      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.rotate(p.rot);
      ctx.font = `${p.size * 2}px serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(p.emoji, 0, 0);
      ctx.restore();
    } else if (p.ring) {
      ctx.strokeStyle = p.color ?? '#4a8fe8';
      ctx.lineWidth = Math.max(0.5, 2.5 * p.life);
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size * (1.7 - p.life), 0, 7);
      ctx.stroke();
    } else {
      ctx.fillStyle = p.color ?? '#4a8fe8';
      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.rotate(p.rot);
      ctx.fillRect(-p.size / 2, -p.size / 2, p.size, p.size * 0.62);
      ctx.restore();
    }
  }
  ctx.globalAlpha = 1;
}

/** Attach the engine to a canvas; returns a function that detaches it. */
export function mountEngine(target: HTMLCanvasElement): () => void {
  canvas = target;
  ctx = target.getContext('2d');
  fit();
  addEventListener('resize', fit);
  let frame = 0;
  const loop = () => {
    draw();
    frame = requestAnimationFrame(loop);
  };
  frame = requestAnimationFrame(loop);
  return () => {
    cancelAnimationFrame(frame);
    removeEventListener('resize', fit);
    particles = [];
    canvas = null;
    ctx = null;
  };
}

export function sparks(x: number, y: number, n = 10, colors: readonly string[] = HUES): void {
  if (reducedMotion() || !ctx) return;
  for (let i = 0; i < n; i++) {
    const a = Math.random() * Math.PI * 2;
    const s = 1.5 + Math.random() * 3;
    particles.push({
      x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, g: 0.07, size: 3 + Math.random() * 4, life: 1,
      decay: 0.022 + Math.random() * 0.02, rot: Math.random() * 6, vr: (Math.random() - 0.5) * 0.3,
      color: colors[Math.floor(Math.random() * colors.length)],
    });
  }
}

export function ripple(x: number, y: number, color = 'rgba(74,143,232,.8)'): void {
  if (reducedMotion() || !ctx) return;
  particles.push({ x, y, vx: 0, vy: 0, size: 26, life: 1, decay: 0.045, rot: 0, ring: true, color });
}

export function emojiBurst(x: number, y: number, emoji: string, n = 7): void {
  if (reducedMotion() || !ctx) return;
  for (let i = 0; i < n; i++) {
    const a = Math.random() * Math.PI * 2;
    const s = 1.5 + Math.random() * 2.5;
    particles.push({
      x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s - 2.2, g: 0.12, size: 8 + Math.random() * 7, life: 1,
      decay: 0.014, rot: 0, vr: (Math.random() - 0.5) * 0.2, emoji,
    });
  }
}

export function confetti(x = innerWidth / 2, y = innerHeight * 0.35, n = 80): void {
  if (reducedMotion() || !ctx) return;
  for (let i = 0; i < n; i++) {
    const a = -Math.PI / 2 + (Math.random() - 0.5) * 1.7;
    const s = 4 + Math.random() * 7;
    particles.push({
      x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, g: 0.18, size: 5 + Math.random() * 6, life: 1,
      decay: 0.008 + Math.random() * 0.006, rot: Math.random() * 6, vr: (Math.random() - 0.5) * 0.4,
      color: HUES[Math.floor(Math.random() * HUES.length)],
    });
  }
}
