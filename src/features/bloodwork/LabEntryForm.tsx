import { useMemo, useState, type FormEvent } from 'react';
import { addReading } from '../../db/biomarkerReadings.ts';
import type { Biomarker, BiomarkerReading } from '../../db/queries.ts';
import { emptyReadingForm, validateReadingForm, type ReadingForm, type ReadingFormErrors } from './entry.ts';
import { formatRange } from './format.ts';
import { toNumberOrNull } from '../../lib/numbers.ts';

interface Props {
  biomarkers: readonly Biomarker[];
  readings: readonly BiomarkerReading[];
  today: string;
  onDone: () => void;
  onCancel?: () => void;
}

function Field(props: { id: string; label: string; error?: string; hint?: string; wide?: boolean; children: React.ReactNode }) {
  return (
    <div className={`fld${props.wide ? ' wide' : ''}`}>
      <label htmlFor={props.id}>{props.label}</label>
      {props.children}
      {props.error ? <div className="fld-err" role="alert">{props.error}</div> : props.hint ? <div className="fld-hint">{props.hint}</div> : null}
    </div>
  );
}

function refRange(b: Biomarker): string | null {
  try {
    const low = toNumberOrNull(b.ref_low, 'ref_low');
    const high = toNumberOrNull(b.ref_high, 'ref_high');
    return low === null && high === null ? null : formatRange(low, high);
  } catch {
    return null;
  }
}

/** Typing a result in by hand. Nothing is checked for criticality here: that is the screen's job once it is saved. */
export function LabEntryForm({ biomarkers, readings, today, onDone, onCancel }: Props) {
  const [form, setForm] = useState<ReadingForm>(() => emptyReadingForm(today));
  const [errors, setErrors] = useState<ReadingFormErrors>({});
  const [failure, setFailure] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const set = <K extends keyof ReadingForm>(key: K, value: ReadingForm[K]) => setForm((f) => ({ ...f, [key]: value }));
  const chosen = biomarkers.find((b) => b.id === form.biomarker_id) ?? null;

  const byCategory = useMemo(() => {
    const groups = new Map<string, Biomarker[]>();
    for (const b of biomarkers) groups.set(b.category, [...(groups.get(b.category) ?? []), b]);
    return [...groups.entries()];
  }, [biomarkers]);

  async function submit(event: FormEvent) {
    event.preventDefault();
    const result = validateReadingForm(form, biomarkers, readings, today);
    if (!result.ok) {
      setErrors(result.errors);
      return;
    }
    setErrors({});
    setFailure(null);
    if (result.warning && !window.confirm(`${result.warning}\n\nSave it anyway?`)) return;
    setBusy(true);
    try {
      await addReading(result.value);
      onDone();
    } catch (e) {
      setFailure(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  const range = chosen ? refRange(chosen) : null;

  return (
    <form className="card sec" onSubmit={submit} noValidate>
      <div className="ct"><span className="dot dot-red" />Add a result</div>
      {biomarkers.length === 0 ? (
        <div className="empty">No markers are set up yet, so a result cannot be added.</div>
      ) : (
        <div className="form-grid">
          <Field id="lab-marker" label="Marker" error={errors.biomarker_id} wide>
            <select id="lab-marker" value={form.biomarker_id} onChange={(e) => set('biomarker_id', e.target.value)}>
              <option value="">Choose a marker</option>
              {byCategory.map(([category, items]) => (
                <optgroup key={category} label={category}>
                  {items.map((b) => <option key={b.id} value={b.id}>{b.name} ({b.unit})</option>)}
                </optgroup>
              ))}
            </select>
          </Field>
          <Field
            id="lab-value"
            label={chosen ? `Result in ${chosen.unit}` : 'Result'}
            error={errors.value}
            hint={chosen ? `Enter it in ${chosen.unit}. If your report uses another unit, convert it first.${range ? ` Usual range here: ${range} ${chosen.unit}.` : ''}` : undefined}
          >
            <input id="lab-value" type="text" inputMode="decimal" autoComplete="off" value={form.value} placeholder="4.2" onChange={(e) => set('value', e.target.value)} />
          </Field>
          <Field id="lab-date" label="Date of the test" error={errors.measured_at} hint="The day the sample was taken, not the day the report came back.">
            <input id="lab-date" type="date" max={today} value={form.measured_at} onChange={(e) => set('measured_at', e.target.value)} />
          </Field>
          <Field id="lab-notes" label="Notes" error={errors.notes} wide>
            <textarea id="lab-notes" value={form.notes} placeholder="Lab name, fasting or not, anything the report said" onChange={(e) => set('notes', e.target.value)} />
          </Field>
        </div>
      )}

      {failure && <div className="notice notice-bad" role="alert">Could not save: {failure}</div>}

      <div className="bw-legend">
        Saved as entered by you, then checked against the marker's reference range and critical limits.
      </div>

      <div className="btn-row">
        <button type="submit" className="btn btn-primary" disabled={busy || biomarkers.length === 0}>{busy ? 'Saving…' : 'Save result'}</button>
        {onCancel && <button type="button" className="btn" onClick={onCancel} disabled={busy}>Cancel</button>}
      </div>
    </form>
  );
}
