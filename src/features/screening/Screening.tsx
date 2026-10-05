import { useMemo, useState, type FormEvent } from 'react';
import { addScreeningRecord, deleteScreeningRecord, type ScreeningHistoryRow } from '../../db/screening.ts';
import { buildScreeningCalendar, latestDoneByCode, SCREENING_STATUS, type ScreeningItem } from '../../lib/screening.ts';
import { formatDay } from '../bloodwork/format.ts';
import { groupScreening, profileIsReady, validateRecordDate } from './model.ts';
import { ProfileCard } from './ProfileCard.tsx';
import { useScreening } from './useScreening.ts';

const PILL: Record<ScreeningItem['status'], { cls: string; text: string }> = {
  [SCREENING_STATUS.OVERDUE]: { cls: 'bk bk-hi', text: 'Overdue' },
  [SCREENING_STATUS.DUE]: { cls: 'bk bk-lo', text: 'Due' },
  [SCREENING_STATUS.UP_TO_DATE]: { cls: 'bk bk-ok', text: 'Up to date' },
  [SCREENING_STATUS.NOT_YET]: { cls: 'bk bk-none', text: 'Not needed yet' },
};

function Row({ item, records, today, notify, onChanged }: {
  item: ScreeningItem;
  records: ScreeningHistoryRow[];
  today: string;
  notify: (message: string, error?: boolean) => void;
  onChanged: () => void;
}) {
  const [recording, setRecording] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [date, setDate] = useState(today);
  const [notes, setNotes] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const pill = PILL[item.status];

  async function submit(event: FormEvent) {
    event.preventDefault();
    const problem = validateRecordDate(date, today);
    if (problem) return setError(problem);
    setError(null);
    setBusy(true);
    try {
      await addScreeningRecord(item.code, date, notes.trim() === '' ? null : notes.trim());
      setRecording(false);
      setNotes('');
      notify('Saved ✓');
      onChanged();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  async function remove(record: ScreeningHistoryRow) {
    if (!window.confirm(`Delete the record from ${formatDay(record.done_date)}? This cannot be undone.`)) return;
    setBusy(true);
    try {
      await deleteScreeningRecord(record.id);
      notify('Deleted');
      onChanged();
    } catch (e) {
      notify(`Error: ${e instanceof Error ? e.message : String(e)}`, true);
    } finally {
      setBusy(false);
    }
  }

  return (
    <li className="scr-item">
      <div className="scr-top">
        <div className="scr-main">
          <div className="scr-label">{item.label} <span className={pill.cls}>{pill.text}</span></div>
          <div className="scr-detail">{item.detail}</div>
        </div>
        <div className="scr-actions">
          <button type="button" className="btn" disabled={busy} onClick={() => setRecording((v) => !v)} aria-expanded={recording}>
            {recording ? 'Close' : 'Record done'}
          </button>
          {records.length > 0 && (
            <button type="button" className="btn" onClick={() => setShowHistory((v) => !v)} aria-expanded={showHistory}>
              History ({records.length})
            </button>
          )}
        </div>
      </div>

      {recording && (
        <form className="scr-record" onSubmit={submit} noValidate>
          <div className="form-grid">
            <div className="fld">
              <label htmlFor={`d-${item.code}`}>Date done</label>
              <input id={`d-${item.code}`} type="date" value={date} max={today} onChange={(e) => setDate(e.target.value)} />
            </div>
            <div className="fld">
              <label htmlFor={`n-${item.code}`}>Notes</label>
              <input id={`n-${item.code}`} type="text" value={notes} placeholder="Optional" onChange={(e) => setNotes(e.target.value)} />
            </div>
          </div>
          {error && <div className="fld-err" role="alert">{error}</div>}
          <div className="btn-row" style={{ marginTop: 10 }}>
            <button type="submit" className="btn btn-primary" disabled={busy}>{busy ? 'Saving…' : 'Save record'}</button>
          </div>
        </form>
      )}

      {showHistory && (
        <ul className="scr-history">
          {records.map((r) => (
            <li key={r.id}>
              <span>{formatDay(r.done_date)}{r.notes ? `, ${r.notes}` : ''}</span>
              <button type="button" className="btn btn-danger" disabled={busy} onClick={() => void remove(r)}>Delete</button>
            </li>
          ))}
        </ul>
      )}
    </li>
  );
}

export function Screening({ today, notify }: { today: string; notify: (message: string, error?: boolean) => void }) {
  const state = useScreening();

  const calendar = useMemo<{ kind: 'ok'; items: ScreeningItem[] } | { kind: 'error'; error: string } | null>(() => {
    if (state.status !== 'ready' || !profileIsReady(state.profile)) return null;
    const { profile, rules, history } = state;
    try {
      return {
        kind: 'ok',
        items: buildScreeningCalendar({
          rules,
          sex: profile.sex,
          age: profile.age,
          flags: {
            family_colorectal_cancer: profile.family_colorectal_cancer,
            family_prostate_cancer: profile.family_prostate_cancer,
            noise_or_blast_exposure: profile.noise_or_blast_exposure,
          },
          lastDone: latestDoneByCode(history),
          today,
        }),
      };
    } catch (e) {
      return { kind: 'error', error: e instanceof Error ? e.message : String(e) };
    }
  }, [state, today]);

  if (state.status === 'loading') return <div className="loading">Loading screening</div>;
  if (state.status === 'error') {
    return (
      <div className="cbanner" role="alert">
        <div className="cbanner-hdr">Screening could not be loaded</div>
        <div className="ci">{state.message}</div>
        <button type="button" className="retry-btn" onClick={state.reload}>Try again</button>
      </div>
    );
  }

  const groups = calendar?.kind === 'ok' ? groupScreening(calendar.items) : null;
  const recordsFor = (code: string) => state.history.filter((h) => h.screening_code === code);
  const rows = (items: ScreeningItem[]) => (
    <ul className="scr-list">
      {items.map((item) => (
        <Row key={item.code} item={item} records={recordsFor(item.code)} today={today} notify={notify} onChanged={state.reload} />
      ))}
    </ul>
  );

  return (
    <div>
      <ProfileCard key={state.profile?.id ?? 'none'} profile={state.profile} onSaved={state.reload} />

      {calendar?.kind === 'error' && (
        <div className="cbanner" role="alert">
          <div className="cbanner-hdr">The screening calendar could not be built</div>
          <div className="ci">{calendar.error}</div>
        </div>
      )}

      {groups && (
        <>
          <div className="notice scr-caveat">
            General screening intervals, used as a prompt to ask your doctor, not as advice. The defaults have not been checked by a
            clinician yet.
          </div>
          {([
            ['Overdue', groups.overdue, 'dot-red'],
            ['Due', groups.due, 'dot-yellow'],
            ['Up to date', groups.upToDate, 'dot-green'],
          ] as const).map(([title, items, dot]) =>
            items.length === 0 ? null : (
              <div key={title} className="card sec">
                <div className="ct"><span className={`dot ${dot}`} />{title} ({items.length})</div>
                {rows(items)}
              </div>
            ),
          )}
          {groups.notYet.length > 0 && (
            <details className="card sec scr-notyet">
              <summary className="ct"><span className="dot dot-dim" />Not needed yet ({groups.notYet.length})</summary>
              {rows(groups.notYet)}
            </details>
          )}
          {calendar?.kind === 'ok' && calendar.items.length === 0 && <div className="empty">No screenings apply from the rules in the database.</div>}
        </>
      )}
    </div>
  );
}
