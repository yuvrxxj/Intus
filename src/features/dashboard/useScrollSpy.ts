import { useCallback, useEffect, useRef, useState } from 'react';
import { SECTIONS, sectionFromHash, type SectionId } from './sections.ts';

function reducedMotion(): boolean {
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

/**
 * Tracks which section is in view, keeps the address bar's #hash in step without adding history entries, and
 * offers a jump that scrolls smoothly. Number keys 1 to 8 jump too, unless the person is typing.
 */
export function useScrollSpy(): [SectionId, (id: SectionId) => void] {
  const [active, setActive] = useState<SectionId>(() => sectionFromHash(window.location.hash) ?? 'today');
  // while a jump is scrolling, the sections it passes are not "in view" in any useful sense
  const jumping = useRef<SectionId | null>(null);

  const jump = useCallback((id: SectionId) => {
    const el = document.getElementById(id);
    if (!el) return;
    jumping.current = id;
    setActive(id);
    window.history.replaceState(null, '', `#${id}`);
    el.scrollIntoView({ behavior: reducedMotion() ? 'auto' : 'smooth', block: 'start' });

    // Sections above can grow while the page scrolls past them (charts mount as they come near), which leaves a
    // smooth scroll short of its target. Once scrolling stops, land exactly on the section.
    let done = false;
    const settle = () => {
      if (done) return;
      done = true;
      window.removeEventListener('scrollend', settle);
      const target = document.getElementById(id);
      if (target) {
        const margin = parseFloat(getComputedStyle(target).scrollMarginTop) || 0;
        if (Math.abs(target.getBoundingClientRect().top - margin) > 4) target.scrollIntoView({ block: 'start' });
      }
      window.setTimeout(() => { if (jumping.current === id) jumping.current = null; }, 100);
    };
    window.addEventListener('scrollend', settle);
    window.setTimeout(settle, 1200);
  }, []);

  useEffect(() => {
    const visible = new Map<SectionId, number>();
    const io = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          const id = entry.target.id as SectionId;
          if (entry.isIntersecting) visible.set(id, entry.boundingClientRect.top);
          else visible.delete(id);
        }
        if (jumping.current) return;
        const first = SECTIONS.find((s) => visible.has(s.id));
        if (first) {
          setActive(first.id);
          if (window.location.hash !== `#${first.id}`) window.history.replaceState(null, '', `#${first.id}`);
        }
      },
      { rootMargin: '-30% 0px -60% 0px' },
    );
    for (const s of SECTIONS) {
      const el = document.getElementById(s.id);
      if (el) io.observe(el);
    }
    return () => io.disconnect();
  }, []);

  // a link straight to a section opens there, once the first data has had a moment to lay out
  useEffect(() => {
    const target = sectionFromHash(window.location.hash);
    if (!target || target === 'today') return;
    const id = window.setTimeout(() => document.getElementById(target)?.scrollIntoView({ block: 'start' }), 350);
    return () => window.clearTimeout(id);
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      const t = e.target as HTMLElement | null;
      if (t && (t.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(t.tagName))) return;
      const index = Number(e.key) - 1;
      if (Number.isInteger(index) && index >= 0 && index < SECTIONS.length) jump(SECTIONS[index].id);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [jump]);

  return [active, jump];
}
