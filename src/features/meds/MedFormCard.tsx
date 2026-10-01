import { useState, type FormEvent } from 'react';
import type { Medication } from '../../db/medications.ts';
import { saveMedication } from '../../db/medications.ts';
import { EMPTY_MED_FORM, formFromMedication, validateMedForm, type MedForm, type MedFormErrors } from './model.ts';

interface Props {
  editing: Medication | null;
  onDone: () => void;
  onCancel: () => void;
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

export function MedFormCard({ editing, onDone, onCancel }: Props) {
  const [form, setForm] = useState<MedForm>(() => (editing ? formFromMedication(editing) : EMPTY_MED_FORM));
  const [errors, setErrors] = useState<MedFormErrors>({});
  const [failure, setFailure] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const set = <K extends keyof MedForm>(key: K, value: string) => setForm((f) => ({ ...f, [key]: value }));
  const preview = validateMedForm(form);
  const hints = preview.ok ? preview.hints : [];

  async function submit(event: FormEvent) {
    event.preventDefault();
    const result = validateMedForm(form);
    if (!result.ok) {
      setErrors(result.errors);
      return;
    }
    setErrors({});
    setFailure(null);
    setBusy(true);
    try {
      await saveMedication(editing?.id ?? null, result.value);
      onDone();
    } catch (e) {
      setFailure(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <form className="card sec" onSubmit={submit} noValidate>
      <div className="ct"><span className="dot dot-blue" />{editing ? `Edit ${editing.name}` : 'Add a medication or supplement'}</div>
      <div className="form-grid">
        <Field id="med-name" label="Name" error={errors.name} wide>
          <input id="med-name" type="text" value={form.name} placeholder="Paracetamol 500 mg" autoComplete="off" onChange={(e) => set('name', e.target.value)} />
        </Field>
        <Field id="med-dosage" label="Dosage" error={errors.dosage}>
          <input id="med-dosage" type="text" value={form.dosage} placeholder="500 mg tablet" onChange={(e) => set('dosage', e.target.value)} />
        </Field>
        <Field id="med-frequency" label="Frequency" error={errors.frequency}>
          <input id="med-frequency" type="text" value={form.frequency} placeholder="Four times a day" onChange={(e) => set('frequency', e.target.value)} />
        </Field>
        <Field id="med-start" label="Started" error={errors.start_date} hint="Leave blank if unknown. A blank start counts as already taking it.">
          <input id="med-start" type="date" value={form.start_date} onChange={(e) => set('start_date', e.target.value)} />
        </Field>
        <Field id="med-end" label="Ended" error={errors.end_date} hint="Leave blank while you are still taking it.">
          <input id="med-end" type="date" value={form.end_date} onChange={(e) => set('end_date', e.target.value)} />
        </Field>
        <Field id="med-mg" label="Paracetamol per dose (mg)" error={errors.paracetamol_mg} hint="Only for products that contain paracetamol. Read it off the label.">
          <input id="med-mg" type="number" inputMode="decimal" min="0" step="any" value={form.paracetamol_mg} placeholder="500" onChange={(e) => set('paracetamol_mg', e.target.value)} />
        </Field>
        <Field id="med-doses" label="Doses per day" error={errors.doses_per_day} hint="How many doses you take on a day you take it.">
          <input id="med-doses" type="number" inputMode="decimal" min="0" step="any" value={form.doses_per_day} placeholder="4" onChange={(e) => set('doses_per_day', e.target.value)} />
        </Field>
        <Field id="med-notes" label="Notes" error={errors.notes} wide>
          <textarea id="med-notes" value={form.notes} placeholder="Why, who prescribed it, anything to remember" onChange={(e) => set('notes', e.target.value)} />
        </Field>
      </div>

      {hints.map((h) => (
        <div key={h} className="notice notice-warn">{h}</div>
      ))}
      {failure && <div className="notice notice-bad" role="alert">Could not save: {failure}</div>}

      <div className="btn-row">
        <button type="submit" className="btn btn-primary" disabled={busy}>{busy ? 'Saving…' : editing ? 'Save changes' : 'Add'}</button>
        <button type="button" className="btn" onClick={onCancel} disabled={busy}>Cancel</button>
      </div>
    </form>
  );
}
