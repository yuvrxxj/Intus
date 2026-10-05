import { useEffect, useRef, useState } from 'react';
import { gesture, mountEngine, reducedMotion, ripple, sparks } from './engine.ts';
import { isMuted, setMuted, sfx } from './sound.ts';

const INTERACTIVE = 'button,a,.si,.tab,.mb,.tb,.hfm-drop,.bn-tab';
const HOT = 'button,a,input,textarea,.si,.tab,.mb,.tb,.hfm-drop,.bn-tab,.hdr h1,.lock-logo';

/**
 * The playful layer: particle canvas, custom cursor on desktop, click feedback, card tilt and the mute toggle.
 * Everything here is decoration. It honours prefers-reduced-motion and does nothing on touch cursors.
 */
export function FxLayer() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const dotRef = useRef<HTMLDivElement>(null);
  const ringRef = useRef<HTMLDivElement>(null);
  const [muted, setMutedState] = useState(isMuted());
  const [fine] = useState(() => window.matchMedia('(hover:hover) and (pointer:fine)').matches);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    return mountEngine(canvas);
  }, []);

  useEffect(() => {
    gesture.x = innerWidth / 2;
    gesture.y = innerHeight / 2;
    const onDown = (e: PointerEvent) => {
      gesture.x = e.clientX;
      gesture.y = e.clientY;
      gesture.at = Date.now();
      const target = e.target as Element | null;
      if (target?.closest('#sndToggle')) return;
      ripple(e.clientX, e.clientY);
      if (target?.closest(INTERACTIVE)) {
        sparks(e.clientX, e.clientY, 8);
        sfx.pop();
      }
    };
    addEventListener('pointerdown', onDown, { passive: true });
    return () => removeEventListener('pointerdown', onDown);
  }, []);

  useEffect(() => {
    if (!fine) return;
    const dot = dotRef.current;
    const ring = ringRef.current;
    if (!dot || !ring) return;
    // start off screen, so the ring does not sit mid-page until the mouse first moves
    let mx = -100;
    let my = -100;
    let rx = mx;
    let ry = my;
    let frame = 0;
    const onMove = (e: MouseEvent) => {
      mx = e.clientX;
      my = e.clientY;
      dot.style.left = `${mx}px`;
      dot.style.top = `${my}px`;
      document.body.classList.toggle('cursor-hot', !!(e.target as Element | null)?.closest(HOT));
    };
    const loop = () => {
      rx += (mx - rx) * 0.16;
      ry += (my - ry) * 0.16;
      ring.style.left = `${rx}px`;
      ring.style.top = `${ry}px`;
      frame = requestAnimationFrame(loop);
    };
    const down = () => document.body.classList.add('cursor-down');
    const up = () => document.body.classList.remove('cursor-down');
    const leave = () => { dot.style.opacity = '0'; ring.style.opacity = '0'; };
    const enter = () => { dot.style.opacity = '1'; ring.style.opacity = '1'; };
    addEventListener('mousemove', onMove, { passive: true });
    addEventListener('mousedown', down);
    addEventListener('mouseup', up);
    document.documentElement.addEventListener('mouseleave', leave);
    document.documentElement.addEventListener('mouseenter', enter);
    frame = requestAnimationFrame(loop);
    return () => {
      cancelAnimationFrame(frame);
      removeEventListener('mousemove', onMove);
      removeEventListener('mousedown', down);
      removeEventListener('mouseup', up);
      document.documentElement.removeEventListener('mouseleave', leave);
      document.documentElement.removeEventListener('mouseenter', enter);
      document.body.classList.remove('cursor-hot', 'cursor-down');
    };
  }, [fine]);

  // Card tilt is delegated, so cards that mount later (tab switches, loaded data) tilt too.
  useEffect(() => {
    if (!fine || reducedMotion()) return;
    let tilted: HTMLElement | null = null;
    const onMove = (e: MouseEvent) => {
      const card = (e.target as Element | null)?.closest<HTMLElement>('.card') ?? null;
      if (tilted && tilted !== card) tilted.style.transform = '';
      tilted = card;
      if (!card) return;
      const r = card.getBoundingClientRect();
      const px = (e.clientX - r.left) / r.width - 0.5;
      const py = (e.clientY - r.top) / r.height - 0.5;
      card.style.transform = `perspective(700px) rotateX(${(-py * 2.5).toFixed(2)}deg) rotateY(${(px * 2.5).toFixed(2)}deg)`;
    };
    addEventListener('mousemove', onMove, { passive: true });
    return () => {
      removeEventListener('mousemove', onMove);
      if (tilted) tilted.style.transform = '';
    };
  }, [fine]);

  return (
    <>
      <canvas id="fxCanvas" ref={canvasRef} aria-hidden="true" />
      {fine && (
        <>
          <div id="cursorRing" ref={ringRef} aria-hidden="true" />
          <div id="cursorDot" ref={dotRef} aria-hidden="true" />
        </>
      )}
      <button
        id="sndToggle"
        type="button"
        title="Toggle sound effects"
        aria-label={muted ? 'Unmute sound effects' : 'Mute sound effects'}
        onClick={(e) => {
          e.stopPropagation();
          const next = !muted;
          setMuted(next);
          setMutedState(next);
          if (!next) sfx.ding();
          sparks(gesture.x, gesture.y, 8);
        }}
      >
        {muted ? '🔇' : '🔊'}
      </button>
    </>
  );
}
