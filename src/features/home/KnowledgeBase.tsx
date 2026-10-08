import { useId, useMemo, useState } from 'react';
import { ChevronDown, Search } from 'lucide-react';
import { cn } from '@/lib/utils';
import { KNOWLEDGE, searchKnowledge, type Direction, type KnowledgeEntry } from './knowledge.ts';

const ARROW: Record<Direction, { glyph: string; words: string }> = {
  up: { glyph: '↑', words: 'goes up' },
  down: { glyph: '↓', words: 'goes down' },
  varies: { glyph: '↑↓', words: 'can go up or down' },
};

/** One result a supplement can move, with the direction as an arrow and, for screen readers, in words. */
function Marker({ marker, direction }: { marker: string; direction: Direction }) {
  const { glyph, words } = ARROW[direction];
  return (
    <li className="inline-flex items-center gap-1.5 rounded-md border border-line-strong bg-surface-2 px-2 py-1 font-mono text-[11px] text-ink">
      {marker}
      <span aria-hidden="true" className="text-primary">{glyph}</span>
      <span className="sr-only">{words}</span>
    </li>
  );
}

function Entry({ entry }: { entry: KnowledgeEntry }) {
  return (
    <details className="group rounded-[14px] border border-line bg-surface open:border-line-strong">
      <summary className="flex cursor-pointer list-none items-start justify-between gap-4 p-4 sm:p-5 [&::-webkit-details-marker]:hidden">
        <span className="min-w-0">
          <span className="block text-[17px] font-semibold tracking-[-0.01em] text-ink">{entry.name}</span>
          <ul className="mt-2.5 flex flex-wrap gap-1.5" aria-label="Results it can change">
            {entry.changes.map((c) => <Marker key={c.marker} {...c} />)}
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

/** The supplements list with a search box that matches a name, another name, or a result such as "thyroid" or "ferritin". */
export function KnowledgeBase() {
  const [query, setQuery] = useState('');
  const inputId = useId();
  const shown = useMemo(() => searchKnowledge(KNOWLEDGE, query), [query]);

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

      <p className={cn('mt-3 font-mono text-[11px] tracking-[0.08em] text-ink-3 uppercase')} role="status">
        {shown.length === KNOWLEDGE.length ? `${KNOWLEDGE.length} supplements` : `${shown.length} of ${KNOWLEDGE.length} supplements`}
      </p>

      {shown.length > 0 ? (
        <div className="mt-4 grid gap-3">
          {shown.map((entry) => <Entry key={entry.id} entry={entry} />)}
        </div>
      ) : (
        <p className="mt-4 rounded-[14px] border border-line bg-surface p-5 text-sm text-ink-2">
          Nothing matches that. Try a supplement name, or a test such as thyroid, ferritin or cholesterol.
        </p>
      )}
    </div>
  );
}
