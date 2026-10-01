import { useMemo, useState } from 'react';
import { deleteMedication, saveMedication, type Medication, type MedicationInput } from '../../db/medications.ts';
import { looksLikeParacetamol, paracetamolDailyTotal } from '../../lib/drugChecks.ts';
import { formatDay } from '../bloodwork/format.ts';
import { MedFormCard } from './MedFormCard.tsx';
import { ParacetamolCard } from './ParacetamolCard.tsx';
import { courseStatus, paracetamolPerDay, sortMedications, type CourseStatus } from './model.ts';
import type { MedicationsState } from './useMedications.ts';

const STATUS_LABEL: Record<CourseStatus, string> = { current: 'Taking now', ended: 'Ended', upcoming: 'Starts later' };

function inputFrom(med: Medication, over: Partial<MedicationInput>): MedicationInput {
  return {
    name: med.name, dosage: med.dosage, frequency: med.frequency, start_date: med.start_date, end_date: med.end_date,
    notes: med.notes, paracetamol_mg_per_dose: med.paracetamol_mg_per_dose, doses_per_day: med.doses_per_day, ...over,
  };
}

function dates(med: Medication): string {
  if (med.start_date && med.end_date) return `${formatDay(med.start_date)} to ${formatDay(med.end_date)}`;
  if (med.start_date) return `From ${formatDay(med.start_date)}, ongoing`;
  if (med.end_date) return `Until ${formatDay(med.end_date)}`;
  return 'No dates recorded, counted as ongoing';
}

export function Meds({ state, today, notify }: {
  state: MedicationsState;
  today: string;
  notify: (message: string, error?: boolean) => void;
}) {
  const [editing, setEditing] = useState<Medication | 'new' | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const { meds, loading, error, reload } = state;

  const total = useMemo(() => {
    try {
      return paracetamolDailyTotal(meds, { today });
    } catch (e) {
      return e instanceof Error ? e : new Error(String(e));
    }
  }, [meds, today]);
  const sorted = useMemo(() => sortMedications(meds, today), [meds, today]);

  async function run(id: string, action: () => Promise<void>, done: string) {
    setBusyId(id);
    try {
      await action();
      notify(done);
      reload();
    } catch (e) {
      notify(`Error: ${e instanceof Error ? e.message : String(e)}`, true);
    } finally {
      setBusyId(null);
    }
  }

  if (loading) return <div className="loading">Loading medications</div>;
  if (error) {
    return (
      <div className="cbanner" role="alert">
        <div className="cbanner-hdr">Medications could not be loaded</div>
        <div className="ci">{error}</div>
        <button type="button" className="retry-btn" onClick={reload}>Try again</button>
      </div>
    );
  }

  return (
    <div>
      {total instanceof Error ? (
        <div className="cbanner" role="alert">
          <div className="cbanner-hdr">Paracetamol total could not be worked out</div>
          <div className="ci">{total.message}</div>
        </div>
      ) : (
        <ParacetamolCard total={total} />
      )}

      {editing !== null ? (
        <MedFormCard
          key={editing === 'new' ? 'new' : editing.id}
          editing={editing === 'new' ? null : editing}
          onCancel={() => setEditing(null)}
          onDone={() => {
            setEditing(null);
            notify('Saved ✓');
            reload();
          }}
        />
      ) : (
        <div className="btn-row" style={{ marginTop: 0, marginBottom: 14 }}>
          <button type="button" className="btn btn-primary" onClick={() => setEditing('new')}>+ Add medication</button>
        </div>
      )}

      <div className="card sec">
        <div className="ct"><span className="dot dot-dim" />Medications and supplements</div>
        {sorted.length === 0 ? (
          <div className="empty">
            Nothing recorded yet. Add what you take, with start and end dates, so the paracetamol total and the biotin warnings on
            Bloodwork have something to work with.
          </div>
        ) : (
          <ul className="med-list">
            {sorted.map((med) => {
              const status = courseStatus(med, today);
              const perDay = paracetamolPerDay(med);
              const uncounted = looksLikeParacetamol(med.name) && perDay === null;
              const busy = busyId === med.id;
              return (
                <li key={med.id} className={`med-item med-${status}`}>
                  <div className="med-main">
                    <div className="med-name">
                      {med.name}
                      <span className={`tag med-tag-${status}`}>{STATUS_LABEL[status]}</span>
                      {uncounted && <span className="tag tag-warn" title="Add mg per dose and doses per day so it can be counted.">not counted</span>}
                    </div>
                    <div className="med-meta">{[med.dosage, med.frequency].filter(Boolean).join(' · ') || 'No dosage recorded'}</div>
                    <div className="med-meta">{dates(med)}</div>
                    {perDay !== null && (
                      <div className="med-meta">Paracetamol: {Number(med.paracetamol_mg_per_dose)} mg × {Number(med.doses_per_day)} a day = {perDay.toLocaleString('en-US')} mg</div>
                    )}
                    {med.notes && <div className="med-notes">{med.notes}</div>}
                  </div>
                  <div className="med-actions">
                    <button type="button" className="btn" disabled={busy} onClick={() => setEditing(med)}>Edit</button>
                    {status === 'current' && (
                      <button type="button" className="btn" disabled={busy}
                        onClick={() => run(med.id, () => saveMedication(med.id, inputFrom(med, { end_date: today })), 'Marked as stopped today')}>
                        Stop today
                      </button>
                    )}
                    <button type="button" className="btn btn-danger" disabled={busy}
                      onClick={() => {
                        if (window.confirm(`Delete ${med.name}? This cannot be undone.`)) void run(med.id, () => deleteMedication(med.id), 'Deleted');
                      }}>
                      Delete
                    </button>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}
