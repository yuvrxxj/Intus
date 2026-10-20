import { CalendarDays } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';

import { Calendar } from '@/components/ui/calendar';
import { cn } from '@/lib/utils';

/** 'YYYY-MM-DD' to a local Date, or undefined when it is blank or not a real day. */
function parseDay(value: string): Date | undefined {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!m) return undefined;
  const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  return d.getFullYear() === Number(m[1]) && d.getMonth() === Number(m[2]) - 1 && d.getDate() === Number(m[3]) ? d : undefined;
}

function formatDay(d: Date): string {
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${String(d.getFullYear()).padStart(4, '0')}-${mm}-${dd}`;
}

/**
 * A date field that keeps the 'YYYY-MM-DD' string contract of <input type="date">, with the calendar in a popover.
 * `min` and `max` are 'YYYY-MM-DD' too. Pass the label's `id` so the label still focuses the control.
 */
export function DatePicker({ id, value, onChange, min, max, placeholder = 'Pick a date', allowClear = false, invalid, className }: {
  id?: string;
  value: string;
  onChange: (value: string) => void;
  min?: string;
  max?: string;
  placeholder?: string;
  allowClear?: boolean;
  invalid?: boolean;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  const selected = parseDay(value);
  const minDate = min ? parseDay(min) : undefined;
  const maxDate = max ? parseDay(max) : undefined;

  useEffect(() => {
    if (!open) return;
    const away = (e: PointerEvent) => { if (root.current && !root.current.contains(e.target as Node)) setOpen(false); };
    const esc = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('pointerdown', away);
    document.addEventListener('keydown', esc);
    return () => { document.removeEventListener('pointerdown', away); document.removeEventListener('keydown', esc); };
  }, [open]);

  return (
    <div ref={root} className={cn('relative', className)}>
      <button
        id={id}
        type="button"
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-invalid={invalid || undefined}
        onClick={() => setOpen((o) => !o)}
        className={cn(
          'flex min-h-11 w-full items-center justify-between gap-2 rounded-[10px] border border-line-strong bg-surface-2 px-3 py-2.5 text-left text-[15px] transition-colors hover:border-ink focus-visible:border-ink focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ink/10',
          invalid && 'border-primary',
          !selected && 'text-ink-3',
        )}
      >
        <span>{selected ? selected.toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' }) : placeholder}</span>
        <CalendarDays size={16} strokeWidth={2} className="shrink-0 text-ink-3" aria-hidden="true" />
      </button>
      {open ? (
        <div role="dialog" aria-label="Choose a date" className="absolute left-0 top-full z-50 mt-1.5 rounded-xl border border-line-strong bg-surface-2 p-2 shadow-lg">
          <Calendar
            mode="single"
            selected={selected}
            defaultMonth={selected ?? maxDate ?? minDate}
            captionLayout="dropdown"
            startMonth={minDate ?? new Date(1900, 0)}
            endMonth={maxDate ?? new Date(new Date().getFullYear() + 10, 11)}
            disabled={[...(minDate ? [{ before: minDate }] : []), ...(maxDate ? [{ after: maxDate }] : [])]}
            onSelect={(d) => { if (d) { onChange(formatDay(d)); setOpen(false); } }}
          />
          {allowClear && value ? (
            <button type="button" className="mt-1 w-full rounded-md py-1.5 text-xs font-medium text-ink-3 hover:bg-ink/5 hover:text-ink" onClick={() => { onChange(''); setOpen(false); }}>
              Clear date
            </button>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
