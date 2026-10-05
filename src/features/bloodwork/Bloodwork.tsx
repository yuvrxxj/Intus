import { useState } from 'react';
import { deleteReading } from '../../db/biomarkerReadings.ts';
import { CriticalBanner } from './CriticalBanner.tsx';
import { LabEntryForm } from './LabEntryForm.tsx';
import { MarkerTable } from './MarkerTable.tsx';
import { formatDay } from './format.ts';
import type { Point } from './model.ts';
import { useBloodwork } from './useBloodwork.ts';

interface Props {
  today: string;
  notify: (message: string, error?: boolean) => void;
}

export function Bloodwork({ today, notify }: Props) {
  const state = useBloodwork();
  const [expanded, setExpanded] = useState<ReadonlySet<string>>(new Set());
  const [adding, setAdding] = useState(false);

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

  const { view, data, reload } = state;

  function saved() {
    setAdding(false);
    notify('Result saved ✓');
    reload();
  }

  async function removeReading(point: Point, markerName: string) {
    if (!window.confirm(`Delete the ${markerName} result from ${formatDay(point.measured_at)}? This cannot be undone.`)) return;
    try {
      await deleteReading(point.id);
      notify('Result deleted');
      reload();
    } catch (e) {
      notify(`Error: ${e instanceof Error ? e.message : String(e)}`, true);
    }
  }

  const form = (
    <LabEntryForm
      biomarkers={data.biomarkers}
      readings={data.readings}
      today={today}
      onDone={saved}
      onCancel={view.readingCount === 0 ? undefined : () => setAdding(false)}
    />
  );

  if (view.readingCount === 0) {
    return (
      <div>
        <CriticalBanner
          current={view.currentCritical}
          past={view.pastCritical}
          biomarkers={data.biomarkers}
          unwatched={view.unwatched}
          unverified={view.unverified}
          verifiedCount={view.verifiedCount}
        />
        <div className="card sec">
          <div className="ct"><span className="dot dot-red" />Bloodwork</div>
          <div className="empty">No results yet. Add your first one below, straight from your lab report.</div>
        </div>
        {form}
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
        unverified={view.unverified}
        verifiedCount={view.verifiedCount}
      />

      {adding ? (
        form
      ) : (
        <div className="btn-row" style={{ marginTop: 0, marginBottom: 14 }}>
          <button type="button" className="btn btn-primary" onClick={() => setAdding(true)}>+ Add a result</button>
        </div>
      )}

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
            <MarkerTable rows={group.rows} expanded={expanded} onToggle={toggle} onDeleteReading={removeReading} />
          </section>
        ))}

        {view.noResults.length > 0 && (
          <div className="bw-none">No results yet for: {view.noResults.join(', ')}.</div>
        )}
      </div>
    </div>
  );
}
