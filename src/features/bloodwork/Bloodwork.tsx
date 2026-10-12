import { useEffect, useMemo, useState } from 'react';
import { fetchCycleDays, type CycleDay } from '../../db/cycle.ts';
import { cycleDayOn, isFemale, periodsOf } from '../cycle/model.ts';
import { deleteReading } from '../../db/biomarkerReadings.ts';
import { CriticalBanner } from './CriticalBanner.tsx';
import { LabEntryForm } from './LabEntryForm.tsx';
import { ReportUpload } from '../reports/ReportUpload.tsx';
import { DoctorReport } from '../export/DoctorReport.tsx';
import { doctorReport, type DoctorReport as Report } from '../export/doctor.ts';
import { fetchMedications } from '../../db/medications.ts';
import { useProfile } from '../profile/ProfileContext.tsx';
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
  const [uploading, setUploading] = useState(false);
  const [printing, setPrinting] = useState<Report | null>(null);
  const { profile } = useProfile();
  const female = isFemale(profile?.sex);
  const [cycleDays, setCycleDays] = useState<CycleDay[]>([]);
  useEffect(() => {
    if (!female) return;
    let live = true;
    // only a nicety beside the dates, so a failure to load leaves it out rather than stopping the screen
    fetchCycleDays().then((d) => live && setCycleDays(d), () => {});
    return () => { live = false; };
  }, [female]);
  const cycleDayFor = useMemo(() => {
    if (!female || cycleDays.length === 0) return undefined;
    const periods = periodsOf(cycleDays);
    return (date: string) => cycleDayOn(periods, date);
  }, [female, cycleDays]);

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
    notify('Result saved');
    reload();
  }

  function uploaded(count: number, note: string | null) {
    setUploading(false);
    notify(note ?? `${count} result${count === 1 ? '' : 's'} saved from the report`, note !== null);
    reload();
  }

  async function printForDoctor() {
    try {
      const supplements = await fetchMedications();
      setPrinting(doctorReport({ groups: view.groups, supplements, name: profile?.name ?? null, age: profile?.age ?? null, sex: profile?.sex ?? null, today }));
    } catch (e) {
      notify(`Error: ${e instanceof Error ? e.message : String(e)}`, true);
    }
  }

  const upload = (
    <ReportUpload biomarkers={data.biomarkers} readings={data.readings} today={today} onSaved={uploaded} onCancel={() => setUploading(false)} />
  );

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
        <CriticalBanner current={view.currentCritical} past={view.pastCritical} />
        <div className="card sec">
          <div className="ct"><span className="dot dot-red" />Bloodwork</div>
          <div className="empty">No results yet. Upload a lab report PDF, or type your first result in below.</div>
          {!uploading && <div className="btn-row"><button type="button" className="btn btn-primary" onClick={() => setUploading(true)}>Upload a report</button></div>}
        </div>
        {uploading ? upload : form}
      </div>
    );
  }

  const trendNote =
    view.trendable === 0
      ? 'A statistical trend needs five or more results for a marker, and none has that many yet, so the arrows only compare the latest result with the one before.'
      : `Arrows compare the latest result with the one before. ${view.trendable} marker${view.trendable === 1 ? ' has' : 's have'} five or more results and ${view.trendable === 1 ? 'also shows' : 'also show'} a trend.`;

  return (
    <div>
      <CriticalBanner current={view.currentCritical} past={view.pastCritical} />
      {printing && <DoctorReport report={printing} onDone={() => setPrinting(null)} />}

      {uploading ? (
        upload
      ) : adding ? (
        form
      ) : (
        <div className="btn-row" style={{ marginTop: 0, marginBottom: 14 }}>
          <button type="button" className="btn btn-primary" onClick={() => setUploading(true)}>Upload a report</button>
          <button type="button" className="btn" onClick={() => setAdding(true)}>+ Add a result</button>
          <button type="button" className="btn" onClick={printForDoctor}>Print for your doctor</button>
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
            <MarkerTable rows={group.rows} expanded={expanded} onToggle={toggle} onDeleteReading={removeReading} cycleDayFor={cycleDayFor} />
          </section>
        ))}

        {view.noResults.length > 0 && (
          <details className="bw-none">
            <summary>{view.noResults.length} marker{view.noResults.length === 1 ? '' : 's'} with no results yet</summary>
            <div>{view.noResults.join(', ')}.</div>
          </details>
        )}
      </div>
    </div>
  );
}
