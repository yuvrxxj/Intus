import { cn } from '@/lib/utils';

/** The wordmark: a red square, like a lit dot, then the name in mono capitals. */
export function Brand({ className }: { className?: string }) {
  return (
    <span className={cn('inline-flex items-center gap-2 font-mono text-[13px] font-medium tracking-[0.12em] text-ink', className)}>
      <span className="size-2.5 rounded-[2px] bg-primary" aria-hidden="true" />
      INTUS
    </span>
  );
}
