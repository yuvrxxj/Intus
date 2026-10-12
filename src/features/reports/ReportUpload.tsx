import { useMemo, useState, type ChangeEvent } from 'react';
import { addReadings } from '../../db/biomarkerReadings.ts';
import { keepReport } from '../../db/labReports.ts';
import type { Biomarker, BiomarkerReading } from '../../db/queries.ts';
import type { ReadingFormErrors } from '../bloodwork/entry.ts';
import { extractLines } from './extract.ts';
import { parseReport } from './parse.ts';
import { reviewRows, validateReview, type ReviewRow } from './review.ts';
import './reports.css';

interface Props {
  biomarkers: readonly Biomarker[];
  readings: readonly BiomarkerReading[];
  today: string;
  /** called with how many results were saved, and a note when the PDF could not be kept */
  onSaved: (count: number, note: string | null) => void;
  onCancel: () => void;
}

type Stage =
  | { kind: 'pick' }
  | { kind: 'reading'; message: string }
  | { kind: 'review'; fileName: string; ocrPages: number; skippedPages: number; dateUnsure: boolean }
  | { kind: 'failed'; message: string };

/**
 * Upload a lab report PDF, check what was read, then save. The file is read on this device; only the results the
 * person ticks are saved. Nothing is written until they press save, because a wrong number in a health record is
 * worse than a slow entry.
 */
export function ReportUpload({ biomarkers, readings, today, onSaved, onCancel }: Props) {
  const [stage, setStage] = useState<Stage>({ kind: 'pick' });
  const [rows, setRows] = useState<ReviewRow[]>([]);
  const [date, setDate] = useState('');
  const [dateError, setDateError] = useState<string | null>(null);
  const [rowErrors, setRowErrors] = useState<Record<string, ReadingFormErrors>>({});
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [keep, setKeep] = useState(true);

  const byCategory = useMemo(() => {
    const groups = new Map<string, Biomarker[]>();
    for (const b of biomarkers) groups.set(b.category, [...(groups.get(b.category) ?? []), b]);
    return [...groups.entries()];
  }, [biomarkers]);

  async function pick(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    if (file.type !== 'application/pdf' && !file.name.toLowerCase().endsWith('.pdf')) {
      setStage({ kind: 'failed', message: 'That is not a PDF. Most labs let you download the report as a PDF.' });
      return;
    }
    setStage({ kind: 'reading', message: 'Opening the report' });
    try {
      const extracted = await extractLines(file, (m) => setStage({ kind: 'reading', message: m }));
      const parsed = parseReport(extracted.lines, biomarkers);
      if (parsed.rows.length === 0) {
        setStage({ kind: 'failed', message: 'No results could be read from this report. You can still add them by hand.' });
        return;
      }
      setRows(reviewRows(parsed, biomarkers, readings));
      setDate(parsed.date ?? '');
      setDateError(null);
      setRowErrors({});
      setMessage(null);
      setFile(file);
      setStage({ kind: 'review', fileName: file.name, ocrPages: extracted.ocrPages, skippedPages: extracted.skippedPages, dateUnsure: parsed.dateUnsure });
    } catch (e) {
      setStage({ kind: 'failed', message: `The report could not be read: ${e instanceof Error ? e.message : String(e)}` });
    }
  }

  const update = (key: string, patch: Partial<ReviewRow>) => setRows((all) => all.map((r) => (r.key === key ? { ...r, ...patch } : r)));

  async function save() {
    const result = validateReview(rows, date, biomarkers, readings, today);
    if (!result.ok) {
      setDateError(result.dateError);
      setRowErrors(result.rowErrors);
      setMessage(result.message);
      return;
    }
    setBusy(true);
    setMessage(null);
    try {
      await addReadings(result.inputs);
      let note: string | null = null;
      if (keep && file) {
        try {
          await keepReport(file);
        } catch (e) {
          note = `The results are saved, but the PDF could not be kept: ${e instanceof Error ? e.message : String(e)}`;
        }
      }
      onSaved(result.inputs.length, note);
    } catch (e) {
      setMessage(`Nothing was saved: ${e instanceof Error ? e.message : String(e)}`);
    } finally {
      setBusy(false);
    }
  }

  const ticked = rows.filter((r) => r.include).length;

  return (
    <div className="card sec" data-testid="report-upload">
      <div className="ct"><span className="dot dot-red" />Upload a lab report</div>

      {stage.kind === 'pick' || stage.kind === 'failed' ? (
        <>
          <label className="rp-drop">
            <input type="file" accept="application/pdf,.pdf" onChange={pick} />
            <span className="rp-drop-main">Choose a PDF</span>
            <span className="rp-drop-sub">Read on this device. Only the results you tick are saved.</span>
          </label>
          <div className="fld-hint">Tip: get the same comprehensive panel each time, so there is a history to track.</div>
          {stage.kind === 'failed' && <div className="notice notice-bad" role="alert">{stage.message}</div>}
          <div className="btn-row"><button type="button" className="btn" onClick={onCancel}>Cancel</button></div>
        </>
      ) : stage.kind === 'reading' ? (
        <div className="loading" role="status">{stage.message}</div>
      ) : (
        <>
          <div className="rp-head">
            <div className="fld-hint">
              {stage.fileName}: {rows.length} line{rows.length === 1 ? '' : 's'} read{stage.ocrPages > 0 ? `, ${stage.ocrPages} page${stage.ocrPages === 1 ? '' : 's'} from a scan, so check the numbers closely` : ''}.{' '}
              {stage.skippedPages > 0 ? ` ${stage.skippedPages} page${stage.skippedPages === 1 ? ' was' : 's were'} too many to read here, so results on ${stage.skippedPages === 1 ? 'it' : 'them'} are missing. Add those by hand.` : ''}{' '}
              Check each ticked row against the report. Unticked rows say why.
            </div>
            <div className="fld">
              <label htmlFor="rp-date">Date of the test</label>
              <input id="rp-date" type="date" max={today} value={date} onChange={(e) => setDate(e.target.value)} />
              {dateError ? <div className="fld-err" role="alert">{dateError}</div>
                : stage.dateUnsure ? <div className="fld-hint">The report's date could be day-first or month-first. Check it.</div>
                : !date ? <div className="fld-hint">No date was found on the report. Enter the day the sample was taken.</div> : null}
            </div>
          </div>

          <div className="bt-wrap">
            <table className="bt rp-table">
              <thead>
                <tr><th aria-label="Save">Save</th><th>On the report</th><th>Marker</th><th>Result</th><th>Range on the report</th></tr>
              </thead>
              <tbody>
                {rows.map((r) => {
                  const marker = biomarkers.find((b) => b.id === r.biomarkerId);
                  const err = rowErrors[r.key] ?? {};
                  return (
                    <tr key={r.key} className={r.include ? '' : 'rp-off'}>
                      <td><input type="checkbox" aria-label={`Save ${r.label}`} checked={r.include} onChange={(e) => update(r.key, { include: e.target.checked })} /></td>
                      <td data-label="On the report">
                        <div className="rp-line">{r.line}</div>
                        {r.issue && <div className="rp-issue">{r.issue}</div>}
                        {err.measured_at && <div className="fld-err">{err.measured_at}</div>}
                      </td>
                      <td data-label="Marker">
                        <select aria-label={`Marker for ${r.label}`} value={r.biomarkerId} onChange={(e) => update(r.key, { biomarkerId: e.target.value })}>
                          <option value="">Not tracked</option>
                          {byCategory.map(([category, items]) => (
                            <optgroup key={category} label={category}>
                              {items.map((b) => <option key={b.id} value={b.id}>{b.name} ({b.unit})</option>)}
                            </optgroup>
                          ))}
                        </select>
                        {err.biomarker_id && <div className="fld-err">{err.biomarker_id}</div>}
                      </td>
                      <td data-label="Result">
                        <input aria-label={`Result for ${r.label}`} className="rp-num" type="text" inputMode="decimal" value={r.value} onChange={(e) => update(r.key, { value: e.target.value })} />
                        <span className="bt-unit"> {marker?.unit ?? r.unit ?? ''}</span>
                        {r.unit && marker && r.unit !== marker.unit && <div className="rp-unit">printed as {r.unit}</div>}
                        {err.value && <div className="fld-err">{err.value}</div>}
                      </td>
                      <td data-label="Range on the report" className="rp-range">
                        <input aria-label={`Range low for ${r.label}`} className="rp-num" type="text" inputMode="decimal" value={r.refLow} placeholder="low" onChange={(e) => update(r.key, { refLow: e.target.value })} />
                        {' to '}
                        <input aria-label={`Range high for ${r.label}`} className="rp-num" type="text" inputMode="decimal" value={r.refHigh} placeholder="high" onChange={(e) => update(r.key, { refHigh: e.target.value })} />
                        {(err.ref_low || err.ref_high) && <div className="fld-err">{err.ref_low ?? err.ref_high}</div>}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <label className="rp-keep">
            <input type="checkbox" checked={keep} onChange={(e) => setKeep(e.target.checked)} />
            Keep a private copy of this PDF in your account. Only you can open it, and it is deleted with your account.
          </label>
          {message && <div className="notice notice-bad" role="alert">{message}</div>}
          <div className="btn-row">
            <button type="button" className="btn btn-primary" disabled={busy || ticked === 0} onClick={save}>
              {busy ? 'Saving…' : `Save ${ticked} result${ticked === 1 ? '' : 's'}`}
            </button>
            <button type="button" className="btn" disabled={busy} onClick={() => setStage({ kind: 'pick' })}>Choose another file</button>
            <button type="button" className="btn" disabled={busy} onClick={onCancel}>Cancel</button>
          </div>
        </>
      )}
    </div>
  );
}
