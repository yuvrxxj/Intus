import { useEffect, useRef, useState } from 'react';
import { useReducedMotion } from 'framer-motion';
import { cn } from '@/lib/utils';
import { CELL_ASPECT, SCENE_FPS, renderScene, stillScene, type Scene, type SceneId } from './scene-engine.ts';
import { SCENE_SIZE, loadScene } from './scene-library.ts';

export type { SceneId } from './scene-engine.ts';

/** How much red sits under the characters at the darkest tone. A glyph covers only about half its cell, so without this the dark parts read pink. */
const UNDERLAY = 0.36;

/**
 * Draws a scene into the canvas and keeps it moving. The canvas is as sharp as the screen allows, so the characters
 * stay readable at any size, and it takes its colour and font from the page (text-primary, font-mono). A soft red
 * layer, one pixel per character and smoothed when it is stretched, carries the weight of the dark parts under the
 * glyphs, as the solid layer does for the ribs. It pauses off screen and in a background tab, and under reduced
 * motion it draws the picture once, at rest. Returns a stop function.
 */
function run(canvas: HTMLCanvasElement, scene: Scene, still: boolean, shown: () => void): () => void {
  const ctx = canvas.getContext('2d');
  if (!ctx) return () => {};
  const glyph = [...scene.ramp];
  // the ramp is plain ASCII, so a row of it is a row of bytes, and the browser can turn that into a string in one native call
  const code = Uint8Array.from(glyph, (g) => g.charCodeAt(0));
  const row = new Uint8Array(scene.cols);
  const decoder = new TextDecoder();
  // how opaque the red under each step of the ramp is
  const veil = Uint8Array.from(glyph, (_, k) => (k === 0 ? 0 : Math.pow((k + 0.5) / glyph.length, 1.3) * UNDERLAY * 255));
  const steps = new Uint8Array(scene.cols * scene.rows);
  const under = document.createElement('canvas');
  under.width = scene.cols;
  under.height = scene.rows;
  const underCtx = under.getContext('2d');
  const pixels = underCtx?.createImageData(scene.cols, scene.rows);
  let elapsed = 0;
  // read the page's colour and font once, and again when the canvas changes size: asking for them every frame forces a style recalculation
  let colour = '';
  let family = '';
  let rgb: [number, number, number] = [163, 22, 33];
  const readStyle = () => {
    const style = getComputedStyle(canvas);
    colour = style.color;
    family = style.fontFamily;
    rgb = parseColour(colour);
  };
  readStyle();
  let first = true;

  const draw = () => {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const w = Math.round(canvas.clientWidth * dpr);
    const h = Math.round(canvas.clientHeight * dpr);
    if (w === 0 || h === 0) return;
    if (canvas.width !== w || canvas.height !== h) { canvas.width = w; canvas.height = h; readStyle(); }
    if (still) stillScene(scene, steps); else renderScene(scene, elapsed, steps);

    const cell = h / scene.rows;
    ctx.clearRect(0, 0, w, h);
    if (underCtx && pixels) {
      const data = pixels.data;
      for (let i = 0, j = 0; i < steps.length; i++, j += 4) {
        data[j] = rgb[0];
        data[j + 1] = rgb[1];
        data[j + 2] = rgb[2];
        data[j + 3] = veil[steps[i]];
      }
      underCtx.putImageData(pixels, 0, 0);
      ctx.imageSmoothingEnabled = true;
      ctx.drawImage(under, 0, 0, w, h);
    }
    ctx.fillStyle = colour;
    ctx.font = `800 ${cell}px ${family}`;
    ctx.textBaseline = 'alphabetic';
    // the lines change every frame, so the browser shapes new text 100 times a frame; its fast path (no kerning, no
    // ligatures, which a monospace picture does not need) takes about half the time
    if ('textRendering' in ctx) ctx.textRendering = 'optimizeSpeed';
    if ('fontKerning' in ctx) ctx.fontKerning = 'none';
    // the fast path may round the advance to whole pixels, so stretch each line to the width of the canvas: the grid stays even
    const advance = ctx.measureText('M').width || cell * CELL_ASPECT;
    ctx.save();
    ctx.scale(w / scene.cols / advance, 1);
    for (let r = 0; r < scene.rows; r++) {
      let lead = -1;
      let tail = 0;
      for (let c = 0; c < scene.cols; c++) {
        const k = steps[r * scene.cols + c];
        row[c] = code[k];
        if (k !== 0) { if (lead < 0) lead = c; tail = c + 1; }
      }
      if (lead < 0) continue;
      ctx.fillText(decoder.decode(row.subarray(lead, tail)), lead * advance, (r + 0.8) * cell);
    }
    ctx.restore();
    if (first) { first = false; shown(); }
  };

  draw();
  const resize = new ResizeObserver(draw);
  resize.observe(canvas);
  if (still) return () => resize.disconnect();

  let frame = 0;
  let visible = true;
  let last = 0;
  const tick = (now: number) => {
    frame = requestAnimationFrame(tick);
    if (!visible || document.hidden) { last = now; return; }
    const dt = now - last;
    if (dt < 1000 / SCENE_FPS) return;
    elapsed += Math.min(dt, 100) / 1000;
    last = now;
    draw();
  };
  const watch = new IntersectionObserver(([entry]) => { visible = entry.isIntersecting; }, { rootMargin: '100px' });
  watch.observe(canvas);
  frame = requestAnimationFrame(tick);
  return () => {
    cancelAnimationFrame(frame);
    watch.disconnect();
    resize.disconnect();
  };
}

/** The red, green and blue of a computed colour such as "rgb(163, 22, 33)". Falls back to the app's red. */
function parseColour(css: string): [number, number, number] {
  const m = css.match(/\d+(\.\d+)?/g);
  return m && m.length >= 3 ? [Number(m[0]), Number(m[1]), Number(m[2])] : [163, 22, 33];
}

/** One of the engraved pictures, drawn in characters and moving slowly. Give it a width or a height; it keeps its proportions. */
export function AsciiScene({ id, className }: { id: SceneId; className?: string }) {
  const ref = useRef<HTMLCanvasElement>(null);
  const reduced = useReducedMotion();
  const [shown, setShown] = useState(false);
  const { cols, rows } = SCENE_SIZE[id];

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    let cancelled = false;
    let stop = () => {};
    // the picture is decoration: if its chunk cannot be fetched, the page is fine without it
    loadScene(id).then((scene) => {
      if (!cancelled) stop = run(canvas, scene, reduced === true, () => setShown(true));
    }, () => {});
    return () => { cancelled = true; stop(); };
  }, [id, reduced]);

  return (
    <canvas
      ref={ref}
      aria-hidden="true"
      className={cn('block font-mono text-primary transition-opacity duration-700 ease-out [filter:drop-shadow(0_0_3px_var(--paper))_drop-shadow(0_0_7px_var(--paper))]', shown ? 'opacity-100' : 'opacity-0', className)}
      style={{ aspectRatio: `${cols * CELL_ASPECT} / ${rows}` }}
    />
  );
}
