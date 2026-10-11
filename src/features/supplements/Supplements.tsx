import { useMemo, useState } from 'react';
import { Segmented } from '@/components/ui/segmented';
import { deleteMedication, saveMedication, type Medication as Supplement, type MedicationInput as SupplementInput } from '../../db/medications.ts';
import { formatDay } from '../bloodwork/format.ts';
import { KnowledgeBase, MarkerChip } from '../knowledge/KnowledgeBase.tsx';
import { KNOWLEDGE, matchKnowledge } from '../knowledge/knowledge.ts';
import { SupplementEffects } from './SupplementEffects.tsx';
import { SupplementFormCard } from './SupplementFormCard.tsx';
import { courseStatus, sortSupplements, type CourseStatus } from './model.ts';
import { describeSchedule, dosesOf, normalizeDays } from './schedule.ts';
import { useSupplements, type SupplementsState } from './useSupplements.ts';

const STATUS_LABEL: Record<CourseStatus, string> = { current: 'Taking now', ended: 'Ended', upcoming: 'Starts later' };

function inputFrom(item: Supplement, over: Partial<SupplementInput>): SupplementInput {
  return {
    name: item.name, dosage: item.dosage, doses_per_day: dosesOf(item), days_of_week: normalizeDays(item.days_of_week),
    start_date: item.start_date, end_date: item.end_date, notes: item.notes, ...over,
  };
}

function dates(item: Supplement): string {
  if (item.start_date && item.end_date) return `${formatDay(item.start_date)} to ${formatDay(item.end_date)}`;
  if (item.start_date) return `From ${formatDay(item.start_date)}, ongoing`;
  if (item.end_date) return `Until ${formatDay(item.end_date)}`;
  return 'No dates recorded, counted as ongoing';
}

function MySupplements({ today, notify, state, onLearn }: {
  today: string;
  notify: (message: string, error?: boolean) => void;
  state: SupplementsState;
  /** open the knowledge base at this entry */
  onLearn: (entryId: string) => void;
}) {
  const [editing, setEditing] = useState<Supplement | 'new' | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const { items, loading, error, reload } = state;

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
            notify('Saved');
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
            Nothing recorded yet. Add what you take, such as a multivitamin or creatine, with how many times a day and on which days. What is due each day shows on your Today checklist.
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
                    <div className="med-meta">{[item.dosage, describeSchedule(dosesOf(item), normalizeDays(item.days_of_week))].filter(Boolean).join(' · ')}</div>
                    <div className="med-meta">{dates(item)}</div>
                    {item.notes && <div className="med-notes">{item.notes}</div>}
                    <KnownEffects name={item.name} onLearn={onLearn} />
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

      <SupplementEffects items={items} today={today} />
    </div>
  );
}

/** What the supplement can do to a blood test, when the knowledge base has an entry for it. Nothing shows otherwise. */
function KnownEffects({ name, onLearn }: { name: string; onLearn: (entryId: string) => void }) {
  const entry = matchKnowledge(KNOWLEDGE, name);
  if (!entry) return null;
  return (
    <div className="mt-2.5">
      <div className="font-mono text-[11px] tracking-[0.08em] text-ink-3 uppercase">Can change in a blood test</div>
      <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-2">
        <ul className="flex flex-wrap gap-1.5" aria-label="Results it can change">
          {entry.changes.slice(0, 3).map((c) => <MarkerChip key={c.marker} {...c} />)}
        </ul>
        <button type="button" className="text-[13px] font-medium text-primary underline-offset-4 hover:underline" onClick={() => onLearn(entry.id)}>
          Read more
        </button>
      </div>
    </div>
  );
}

type View = 'mine' | 'knowledge';

/** The Supplements section: what you take, and a knowledge base on how supplements can move blood results. */
export function Supplements({ today, notify }: {
  today: string;
  notify: (message: string, error?: boolean) => void;
}) {
  const [view, setView] = useState<View>('mine');
  const [openId, setOpenId] = useState<string | null>(null);
  const state = useSupplements();

  // the entries for what the person records, so the knowledge base can tag and lead with them
  const taking = useMemo(
    () => new Set(state.items.flatMap((item) => matchKnowledge(KNOWLEDGE, item.name)?.id ?? [])),
    [state.items],
  );

  return (
    <div>
      <Segmented<View>
        label="Supplements"
        className="mb-5 max-w-sm"
        value={view}
        onChange={(next) => { setOpenId(null); setView(next); }}
        options={[{ value: 'mine', label: 'My supplements' }, { value: 'knowledge', label: 'Knowledge base' }]}
      />
      {view === 'mine' ? (
        <MySupplements today={today} notify={notify} state={state} onLearn={(id) => { setOpenId(id); setView('knowledge'); }} />
      ) : (
        <div>
          <p className="mb-5 max-w-2xl text-sm leading-relaxed text-ink-2">
            Supplements can move a blood test without changing your health. Each entry says which results can shift, in which direction and why.
          </p>
          <KnowledgeBase taking={taking} openId={openId} />
        </div>
      )}
    </div>
  );
}
