import { useEffect, useRef, type CSSProperties } from 'react';
import statueBust from '@/assets/art/statue-bust.webp';
import { cn } from '@/lib/utils';

/**
 * The statue bust, calm but alive: every so often a band of lighter red crosses the stone, and the chest rises and
 * falls a little. Both pause while the bust is off screen or the tab is hidden, and the reduced-motion rule in
 * index.css switches them off. Give it a height; the width follows from the picture's shape.
 */
export function StatueBust({ className, still = false }: { className?: string; still?: boolean }) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el || still) return;
    let onScreen = true;
    const sync = () => { el.dataset.paused = String(!onScreen || document.hidden); };
    const io = new IntersectionObserver(([entry]) => { onScreen = entry.isIntersecting; sync(); }, { rootMargin: '100px' });
    io.observe(el);
    document.addEventListener('visibilitychange', sync);
    sync();
    return () => {
      io.disconnect();
      document.removeEventListener('visibilitychange', sync);
    };
  }, [still]);

  return (
    <div
      ref={ref}
      className={cn('bust relative aspect-[1031/1349] shrink-0 animate-[rail-art-in_1.2s_var(--ease-out-quint)_both]', className)}
      data-still={still || undefined}
    >
      <div className="bust-body size-full">
        <img src={statueBust} alt="" width={1031} height={1349} decoding="async" className="size-full" />
        {/* the light only falls on the statue: the picture's own shape is the mask */}
        <div className="bust-light" style={{ '--bust': `url(${statueBust})` } as CSSProperties} aria-hidden="true" />
      </div>
    </div>
  );
}
