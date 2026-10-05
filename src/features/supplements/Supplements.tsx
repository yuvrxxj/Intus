import { useMemo, useState } from 'react';
import { deleteMedication, saveMedication, type Medication as Supplement, type MedicationInput as SupplementInput } from '../../db/medications.ts';
import { formatDay } from '../bloodwork/format.ts';
import { SupplementFormCard } from './SupplementFormCard.tsx';
import { courseStatus, sortSupplements, type CourseStatus } from './model.ts';
import { useSupplements } from './useSupplements.ts';

const STATUS_LABEL: Record<CourseStatus, string> = { current: 'Taking now', ended: 'Ended', upcoming: 'Starts later' };

function inputFrom(item: Supplement, over: Partial<SupplementInput>): SupplementInput {
  return {
    name: item.name, dosage: item.dosage, frequency: item.frequency, start_date: item.start_date, end_date: item.end_date,
    notes: item.notes, ...over,
  };
}

function dates(item: Supplement): string {
  if (item.start_date && item.end_date) return `${formatDay(item.start_date)} to ${formatDay(item.end_date)}`;
  if (item.start_date) return `From ${formatDay(item.start_date)}, ongoing`;
  if (item.end_date) return `Until ${formatDay(item.end_date)}`;
  return 'No dates recorded, counted as ongoing';
}

export function Supplements({ today, notify }: {
  today: string;
  notify: (message: string, error?: boolean) => void;
}) {
  const [editing, setEditing] = useState<Supplement | 'new' | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const { items, loading, error, reload } = useSupplements();

  const sorted = useMemo(() => sortSupplements(items, today), [items, today]);

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

  if (loading) return <div className="loading">Loading supplements</div>;
  if (error) {
    return (
      <div className="cbanner" role="alert">
        <div className="cbanner-hdr">Supplements could not be loaded</div>
        <div className="ci">{error}</div>
        <button type="button" className="retry-btn" onClick={reload}>Try again</button>
      </div>
    );
  }

  return (
    <div>
      {editing !== null ? (
        <SupplementFormCard
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
          <button type="button" className="btn btn-primary" onClick={() => setEditing('new')}>+ Add supplement</button>
        </div>
      )}

      <div className="card sec">
        <div className="ct"><span className="dot dot-dim" />Supplements</div>
        {sorted.length === 0 ? (
          <div className="empty">
            Nothing recorded yet. Add what you take, such as a multivitamin or creatine, with start and end dates.
          </div>
        ) : (
          <ul className="med-list">
            {sorted.map((item) => {
              const status = courseStatus(item, today);
              const busy = busyId === item.id;
              return (
                <li key={item.id} className={`med-item med-${status}`}>
                  <div className="med-main">
                    <div className="med-name">
                      {item.name}
                      <span className={`tag med-tag-${status}`}>{STATUS_LABEL[status]}</span>
                    </div>
                    <div className="med-meta">{[item.dosage, item.frequency].filter(Boolean).join(' · ') || 'No dosage recorded'}</div>
                    <div className="med-meta">{dates(item)}</div>
                    {item.notes && <div className="med-notes">{item.notes}</div>}
                  </div>
                  <div className="med-actions">
                    <button type="button" className="btn" disabled={busy} onClick={() => setEditing(item)}>Edit</button>
                    {status === 'current' && (
                      <button type="button" className="btn" disabled={busy}
                        onClick={() => run(item.id, () => saveMedication(item.id, inputFrom(item, { end_date: today })), 'Marked as stopped today')}>
                        Stop today
                      </button>
                    )}
                    <button type="button" className="btn btn-danger" disabled={busy}
                      onClick={() => {
                        if (window.confirm(`Delete ${item.name}? This cannot be undone.`)) void run(item.id, () => deleteMedication(item.id), 'Deleted');
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
