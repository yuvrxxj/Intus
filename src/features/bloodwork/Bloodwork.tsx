import { useState } from 'react';
import { CriticalBanner } from './CriticalBanner.tsx';
import { MarkerTable } from './MarkerTable.tsx';
import { formatDay } from './format.ts';
import { useBloodwork } from './useBloodwork.ts';

export function Bloodwork() {
  const state = useBloodwork();
  const [expanded, setExpanded] = useState<ReadonlySet<string>>(new Set());

  function toggle(id: string) {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  if (state.status === 'loading') return <div className="loading">Loading bloodwork</div>;

  if (state.status === 'error') {
    return (
      <div className="cbanner" role="alert">
        <div className="cbanner-hdr">Bloodwork could not be loaded</div>
        <div className="ci">{state.message}</div>
        <button type="button" className="retry-btn" onClick={state.reload}>Try again</button>
      </div>
    );
  }

  const { view, data } = state;

  if (view.readingCount === 0) {
    return (
      <div className="card sec">
        <div className="ct"><span className="dot dot-red" />Bloodwork</div>
        <div className="loading" style={{ animation: 'none' }}>No results yet.</div>
      </div>
    );
  }

  const trendNote =
    view.trendable === 0
      ? 'A statistical trend needs five or more results for a marker, and none has that many yet, so the arrows only compare the latest result with the one before.'
      : `Arrows compare the latest result with the one before. ${view.trendable} marker${view.trendable === 1 ? ' has' : 's have'} five or more results and ${view.trendable === 1 ? 'also shows' : 'also show'} a trend.`;

  return (
    <div>
      <CriticalBanner
        current={view.currentCritical}
        past={view.pastCritical}
        biomarkers={data.biomarkers}
        unwatched={view.unwatched}
      />

      <div className="card sec">
        <div className="bw-head">
          <div>
            <div className="ct" style={{ marginBottom: 4 }}><span className="dot dot-red" />Bloodwork</div>
            <div className="bw-sub">
              Latest results {view.latestDate ? formatDay(view.latestDate) : ''} · {view.readingCount} results across {view.dateCount} test date{view.dateCount === 1 ? '' : 's'}
            </div>
          </div>
        </div>
        <div className="bw-legend">{trendNote}</div>
        <div className="glow-line" />

        {view.groups.map((group) => (
          <section key={group.category}>
            <div className="bio-sec">{group.category}</div>
            <MarkerTable rows={group.rows} expanded={expanded} onToggle={toggle} />
          </section>
        ))}

        {view.noResults.length > 0 && (
          <div className="bw-none">No results yet for: {view.noResults.join(', ')}.</div>
        )}
      </div>
    </div>
  );
}
