import { motion } from 'framer-motion';
import { useId } from 'react';
import { cn } from '@/lib/utils';

/** An Apple-style segmented control: one pill slides to the chosen option. */
export function Segmented<T extends string>({ value, options, onChange, label, className }: {
  value: T;
  options: readonly { value: T; label: string }[];
  onChange: (value: T) => void;
  label: string;
  className?: string;
}) {
  const id = useId();
  return (
    <div role="radiogroup" aria-label={label} className={cn('relative grid auto-cols-fr grid-flow-col rounded-[10px] bg-ink/[0.06] p-1', className)}>
      {options.map((o) => {
        const on = o.value === value;
        return (
          <button
            key={o.value}
            type="button"
            role="radio"
            aria-checked={on}
            onClick={() => onChange(o.value)}
            className={cn('relative z-0 h-9 rounded-[7px] px-3 text-[13px] font-medium transition-colors', on ? 'text-ink' : 'text-ink-3 hover:text-ink')}
          >
            {on && (
              <motion.span
                layoutId={`seg-${id}`}
                className="absolute inset-0 -z-10 rounded-[7px] bg-surface-2 shadow-[0_1px_2px_rgb(31_19_0/0.12),0_0_0_0.5px_rgb(31_19_0/0.08)]"
                transition={{ type: 'spring', stiffness: 500, damping: 40 }}
              />
            )}
            {o.label}
          </button>
        );
      })}
    </div>
  );
}
