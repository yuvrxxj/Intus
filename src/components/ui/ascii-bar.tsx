import { animate, useReducedMotion } from 'framer-motion';
import { useEffect, useState } from 'react';
import { cn } from '@/lib/utils';

/** A progress bar drawn as text, [#######.......], that fills from empty the first time it appears. */
export function AsciiBar({ percent, width = 32, className, label }: { percent: number; width?: number; className?: string; label: string }) {
  const reduced = useReducedMotion();
  const target = Math.max(0, Math.min(100, percent));
  const [shown, setShown] = useState(reduced ? target : 0);

  useEffect(() => {
    if (reduced) {
      setShown(target);
      return;
    }
    const controls = animate(0, target, { duration: 1.1, ease: [0.22, 1, 0.36, 1], onUpdate: setShown });
    return () => controls.stop();
  }, [target, reduced]);

  const filled = Math.round((shown / 100) * width);
  return (
    <div className={cn('font-mono leading-none whitespace-pre', className)} role="img" aria-label={label}>
      <span className="text-ink-3">[</span>
      <span className="text-primary">{'#'.repeat(filled)}</span>
      <span className="text-dot">{'.'.repeat(width - filled)}</span>
      <span className="text-ink-3">]</span>
    </div>
  );
}
