import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Reveal } from '@/components/ui/reveal';
import type { SectionMeta } from './sections.ts';

/** One numbered block of the page: a mono index, a title, one line on what it is for, then its content. */
export function Section({ meta, children, aside }: { meta: SectionMeta; children: ReactNode; aside?: ReactNode }) {
  return (
    <section id={meta.id} aria-labelledby={`${meta.id}-title`} className="scroll-mt-20 border-t border-line-strong pt-8 pb-16 lg:scroll-mt-8">
      <Reveal>
        <div className="on-dots mb-8 flex flex-wrap items-end justify-between gap-4">
          <div>
            <div className="font-mono text-[11px] tracking-[0.08em] text-ink-3 uppercase">
              <span className="text-primary">{meta.n}</span> / 07
            </div>
            <h2 id={`${meta.id}-title`} className="mt-2 text-[28px] leading-tight font-semibold tracking-[-0.02em] sm:text-[32px]">{meta.title}</h2>
            <p className="mt-1.5 max-w-xl text-sm text-ink-2">{meta.blurb}</p>
          </div>
          {aside}
        </div>
      </Reveal>
      {children}
    </section>
  );
}

/** Mounts its children once they come within a screen or so of the viewport, so heavy parts never delay the page. */
export function WhenNear({ children, fallback, minHeight = 320 }: { children: ReactNode; fallback?: ReactNode; minHeight?: number }) {
  const ref = useRef<HTMLDivElement>(null);
  const [near, setNear] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el || near) return;
    const io = new IntersectionObserver(([entry]) => entry.isIntersecting && setNear(true), { rootMargin: '600px 0px' });
    io.observe(el);
    return () => io.disconnect();
  }, [near]);
  return <div ref={ref} style={near ? undefined : { minHeight }}>{near ? children : fallback}</div>;
}
