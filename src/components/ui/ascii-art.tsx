import { useEffect, useRef } from 'react';
import { cn } from '@/lib/utils';
import { FPS, renderAscii, startTime, type AsciiShape } from './ascii-engine.ts';

export type { AsciiShape } from './ascii-engine.ts';

export function AsciiArt({ shape, cols = 48, rows = 24, still = false, className, label }: {
  shape: AsciiShape;
  cols?: number;
  rows?: number;
  /** draw one frame and never animate */
  still?: boolean;
  className?: string;
  /** read to screen readers; leave out for pure decoration */
  label?: string;
}) {
  const ref = useRef<HTMLPreElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const start = startTime(shape);
    el.textContent = renderAscii(shape, cols, rows, start);
    if (still || reduced) return;

    let frame = 0;
    let visible = true;
    let last = 0;
    let elapsed = start;
    const tick = (now: number) => {
      frame = requestAnimationFrame(tick);
      if (!visible || document.hidden) { last = now; return; }
      const dt = now - last;
      if (dt < 1000 / FPS) return;
      elapsed += Math.min(dt, 100) / 1000;
      last = now;
      el.textContent = renderAscii(shape, cols, rows, elapsed);
    };
    const io = new IntersectionObserver(([entry]) => { visible = entry.isIntersecting; }, { rootMargin: '100px' });
    io.observe(el);
    frame = requestAnimationFrame(tick);
    return () => {
      cancelAnimationFrame(frame);
      io.disconnect();
    };
  }, [shape, cols, rows, still]);

  return (
    <pre
      ref={ref}
      className={cn('m-0 select-none overflow-hidden font-mono whitespace-pre [font-variant-ligatures:none]', className)}
      // inline, so a text-size class passed in cannot reset the line height and stretch the drawing
      style={{ height: `${rows}em`, width: `${cols * 0.6}em`, lineHeight: 1 }}
      role={label ? 'img' : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
    />
  );
}
