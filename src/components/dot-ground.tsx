import { useEffect, useState } from 'react';
import { PixelTrail } from '@/components/ui/pixel-trail';

const PITCH = 28;
const DOT = 8;

function wantsTrail(): boolean {
  return window.matchMedia('(hover: hover) and (pointer: fine)').matches
    && !window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

/**
 * The background of every screen: grey dots on paper, drawn in CSS, and on a desktop pointer a trail that lights the
 * dots under the cursor in red. The trail mounts after the first paint so it never delays the page.
 */
export function DotGround() {
  const [trail, setTrail] = useState(false);

  useEffect(() => {
    if (!wantsTrail()) return;
    const idle = window.requestIdleCallback ?? ((cb: () => void) => window.setTimeout(cb, 200));
    const cancel = window.cancelIdleCallback ?? window.clearTimeout;
    const handle = idle(() => setTrail(true));
    return () => cancel(handle);
  }, []);

  return (
    <div className="dot-ground" style={{ '--dot-pitch': `${PITCH}px`, '--dot-size': `${DOT}px` } as React.CSSProperties} aria-hidden="true">
      {trail && <PixelTrail pixelSize={PITCH} dotSize={DOT} fadeDuration={900} pixelClassName="bg-primary" />}
    </div>
  );
}
