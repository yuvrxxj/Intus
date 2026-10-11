import { cn } from '@/lib/utils';
import { MARK_PATH, MARK_VIEWBOX } from './brand-mark.ts';

/**
 * The Intus mark: a slash, solid at its head and dissolving into halftone dots. At small sizes the dots blend into a
 * soft fade, so one drawing serves from a tab icon up to a hero. Red by default; pass a fill class to change that.
 */
export function Mark({ className }: { className?: string }) {
  return (
    <svg viewBox={MARK_VIEWBOX} className={cn('h-7 w-auto shrink-0 fill-primary', className)} aria-hidden="true" focusable="false">
      <path d={MARK_PATH} />
    </svg>
  );
}

/** The wordmark: the mark, then the name in mono capitals. */
export function Brand({ className }: { className?: string }) {
  return (
    <span className={cn('inline-flex items-center gap-2.5 font-mono text-[13px] font-medium tracking-[0.12em] text-ink', className)}>
      <Mark />
      INTUS
    </span>
  );
}
