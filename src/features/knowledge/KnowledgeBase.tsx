import { useEffect, useId, useMemo, useRef, useState } from 'react';
import { ChevronDown, Search } from 'lucide-react';
import { KNOWLEDGE, searchKnowledge, type Direction, type KnowledgeEntry } from './knowledge.ts';

const ARROW: Record<Direction, { glyph: string; words: string }> = {
  up: { glyph: '↑', words: 'goes up' },
  down: { glyph: '↓', words: 'goes down' },
  varies: { glyph: '↑↓', words: 'can go up or down' },
};

/** One result a supplement can move, with the direction as an arrow and, for screen readers, in words. */
export function MarkerChip({ marker, direction }: { marker: string; direction: Direction }) {
  const { glyph, words } = ARROW[direction];
  return (
    <li className="inline-flex items-center gap-1.5 rounded-md border border-line-strong bg-surface-2 px-2 py-1 font-mono text-[11px] text-ink">
      {marker}
      <span aria-hidden="true" className="text-primary">{glyph}</span>
      <span className="sr-only">{words}</span>
    </li>
  );
}

function Entry({ entry, taking, open, focus }: { entry: KnowledgeEntry; taking: boolean; open: boolean; focus: boolean }) {
  const ref = useRef<HTMLDetailsElement>(null);
  // arriving from a supplement's "Read more": bring the entry into the middle of the screen
  useEffect(() => {
    if (!focus) return;
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    ref.current?.scrollIntoView({ block: 'center', behavior: reduced ? 'auto' : 'smooth' });
  }, [focus]);

  return (
    <details ref={ref} open={open || undefined} className="group rounded-[14px] border border-line bg-surface open:border-line-strong">
      <summary className="flex cursor-pointer list-none items-start justify-between gap-4 p-4 sm:p-5 [&::-webkit-details-marker]:hidden">
        <span className="min-w-0">
          <span className="flex flex-wrap items-center gap-x-3 gap-y-1">
            <span className="block text-[17px] font-semibold tracking-[-0.01em] text-ink">{entry.name}</span>
            {taking && (
              <span className="rounded border border-primary px-1.5 py-0.5 font-mono text-[10px] tracking-[0.08em] text-primary uppercase">You take this</span>
            )}
          </span>
          <ul className="mt-2.5 flex flex-wrap gap-1.5" aria-label="Results it can change">
            {entry.changes.map((c) => <MarkerChip key={c.marker} {...c} />)}
          </ul>
        </span>
        <ChevronDown className="mt-1 size-5 shrink-0 text-ink-3 transition-transform group-open:rotate-180" aria-hidden="true" />
      </summary>
      <div className="grid gap-4 border-t border-line px-4 pt-4 pb-5 sm:grid-cols-2 sm:gap-8 sm:px-5">
        <div>
          <div className="font-mono text-[11px] tracking-[0.08em] text-primary uppercase">Why</div>
          <p className="mt-1.5 text-sm leading-relaxed text-ink-2">{entry.why}</p>
        </div>
        <div>
          <div className="font-mono text-[11px] tracking-[0.08em] text-primary uppercase">Worth knowing</div>
          <p className="mt-1.5 text-sm leading-relaxed text-ink-2">{entry.worthKnowing}</p>
        </div>
      </div>
    </details>
  );
}

const NONE: ReadonlySet<string> = new Set();

/**
 * The supplements list with a search box that matches a name, another name, or a result such as "thyroid" or "ferritin".
 * Inside the app, `taking` holds the entries for what the person records, which are tagged and listed first, and
 * `openId` opens and scrolls to one entry (the "Read more" from their own supplement).
 */
export function KnowledgeBase({ taking = NONE, openId = null }: { taking?: ReadonlySet<string>; openId?: string | null }) {
  const [query, setQuery] = useState('');
  const inputId = useId();
  // a search that would hide the entry being opened is cleared
  useEffect(() => { if (openId) setQuery(''); }, [openId]);

  const shown = useMemo(() => {
    const found = searchKnowledge(KNOWLEDGE, query);
    // what the person takes first, otherwise the order stays as written
    return [...found.filter((e) => taking.has(e.id)), ...found.filter((e) => !taking.has(e.id))];
  }, [query, taking]);

  return (
    <div>
      <label htmlFor={inputId} className="sr-only">Search supplements and results</label>
      <div className="relative max-w-md">
        <Search className="pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-ink-3" aria-hidden="true" />
        <input
          id={inputId}
          type="search"
          className="pl-10"
          placeholder="Search a supplement or a test"
          autoComplete="off"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
      </div>

      <p className="mt-3 font-mono text-[11px] tracking-[0.08em] text-ink-3 uppercase" role="status">
        {shown.length === KNOWLEDGE.length ? `${KNOWLEDGE.length} supplements` : `${shown.length} of ${KNOWLEDGE.length} supplements`}
      </p>

      {shown.length > 0 ? (
        <div className="mt-4 grid gap-3">
          {shown.map((entry) => (
            <Entry key={entry.id} entry={entry} taking={taking.has(entry.id)} open={entry.id === openId} focus={entry.id === openId} />
          ))}
        </div>
      ) : (
        <p className="mt-4 rounded-[14px] border border-line bg-surface p-5 text-sm text-ink-2">
          Nothing matches that. Try a supplement name, or a test such as thyroid, ferritin or cholesterol.
        </p>
      )}
    </div>
  );
}
