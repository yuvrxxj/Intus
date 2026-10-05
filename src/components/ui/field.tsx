import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

/** A label, its control, and either an error or a hint underneath. */
export function Field({ id, label, error, hint, className, children }: {
  id?: string;
  label: ReactNode;
  error?: string;
  hint?: ReactNode;
  className?: string;
  children: ReactNode;
}) {
  return (
    <div className={cn('min-w-0', className)}>
      <label htmlFor={id}>{label}</label>
      {children}
      {error ? (
        <div className="mt-1.5 text-xs text-primary" role="alert">{error}</div>
      ) : hint ? (
        <div className="mt-1.5 text-xs leading-relaxed text-ink-3">{hint}</div>
      ) : null}
    </div>
  );
}
