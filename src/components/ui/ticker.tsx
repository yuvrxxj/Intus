import { animate, useReducedMotion } from 'framer-motion';
import { useEffect, useRef } from 'react';

/** A number that settles into its new value instead of jumping. Renders plain text, so it reads normally. */
export function Ticker({ value, decimals = 0, format }: { value: number; decimals?: number; format?: (n: number) => string }) {
  const ref = useRef<HTMLSpanElement>(null);
  const shown = useRef(value);
  const reduced = useReducedMotion();
  const text = (n: number) => (format ? format(n) : n.toFixed(decimals));

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (reduced || shown.current === value) {
      shown.current = value;
      el.textContent = text(value);
      return;
    }
    const controls = animate(shown.current, value, {
      duration: 0.7,
      ease: [0.22, 1, 0.36, 1],
      onUpdate: (n) => {
        shown.current = n;
        el.textContent = text(n);
      },
    });
    return () => controls.stop();
  }, [value, decimals, reduced]);

  return <span ref={ref} className="tabular-nums">{text(shown.current)}</span>;
}
