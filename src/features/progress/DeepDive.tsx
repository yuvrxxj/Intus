import { useEffect, useRef, useState } from 'react';
import { X } from 'lucide-react';
import type { HistoryRow } from './history.ts';

const PAGE = 30;
const TONE_COLOR = { good: 'var(--green)', ok: 'var(--warn)', bad: 'var(--red)', none: 'var(--ink)' } as const;

/**
 * A chart's whole history in a panel over the page, newest first, thirty days at a time. The Progress page only ever
 * charts the latest 30 entries; this is where the rest lives.
 */
export function DeepDive({ title, rows, loading, error, onClose }: {
  title: string;
  rows: readonly HistoryRow[];
  loading: boolean;
  error: string | null;
  onClose: () => void;
}) {
  const [shown, setShown] = useState(PAGE);
  const closeRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    closeRef.current?.focus();
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = previous;
    };
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center sm:p-6">
      <button type="button" aria-label="Close the history" className="absolute inset-0 bg-ink/30 backdrop-blur-sm" onClick={onClose} />
      <div role="dialog" aria-modal="true" aria-labelledby="deep-dive-title" className="relative flex max-h-[85dvh] w-full max-w-xl flex-col rounded-t-[20px] border border-line-strong bg-surface shadow-[0_24px_60px_rgb(31_19_0/0.25)] sm:rounded-[20px]">
        <div className="flex items-start justify-between gap-4 border-b border-line px-5 py-4 sm:px-6">
          <div className="min-w-0">
            <div className="font-mono text-[11px] tracking-[0.08em] text-ink-3 uppercase">Full history</div>
            <h2 id="deep-dive-title" className="mt-1 text-xl font-semibold tracking-[-0.02em]">{title}</h2>
          </div>
          <button ref={closeRef} type="button" onClick={onClose} aria-label="Close" className="flex size-8 shrink-0 items-center justify-center rounded-full text-ink-3 hover:text-ink">
            <X className="size-4" />
          </button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-2 sm:px-6">
          {loading ? <div className="loading">Loading your history</div> : null}
          {error ? <div className="notice notice-bad" role="alert">{error}</div> : null}
          {!loading && !error && rows.length === 0 ? <div className="loading" style={{ animation: 'none' }}>Nothing logged for this yet</div> : null}
          {rows.length > 0 ? (
            <ul className="m-0 list-none p-0">
              {rows.slice(0, shown).map((r) => (
                <li key={r.date} className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-0.5 border-b border-line py-3 last:border-b-0">
                  <span className="font-mono text-xs whitespace-nowrap text-ink-3">{r.dateLabel}</span>
                  <span className="font-mono text-sm font-medium tabular-nums" style={{ color: TONE_COLOR[r.tone ?? 'none'] }}>{r.value}</span>
                  {r.note ? <span className="w-full text-xs text-ink-3">{r.note}</span> : null}
                </li>
              ))}
            </ul>
          ) : null}
        </div>
        <div className="flex items-center justify-between gap-3 border-t border-line px-5 py-3 text-xs text-ink-3 sm:px-6">
          <span>{rows.length > 0 ? `Showing ${Math.min(shown, rows.length)} of ${rows.length}` : ''}</span>
          {rows.length > shown ? <button type="button" className="btn" onClick={() => setShown((n) => n + PAGE)}>Show 30 more</button> : null}
        </div>
      </div>
    </div>
  );
}
