import { useState, type FormEvent } from 'react';
import type { Medication as Supplement } from '../../db/medications.ts';
import { saveMedication } from '../../db/medications.ts';
import {
  EMPTY_SUPPLEMENT_FORM, formFromSupplement, validateSupplementForm, type SupplementForm, type SupplementFormErrors,
} from './model.ts';

interface Props {
  editing: Supplement | null;
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

export function SupplementFormCard({ editing, onDone, onCancel }: Props) {
  const [form, setForm] = useState<SupplementForm>(() => (editing ? formFromSupplement(editing) : EMPTY_SUPPLEMENT_FORM));
  const [errors, setErrors] = useState<SupplementFormErrors>({});
  const [failure, setFailure] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const set = <K extends keyof SupplementForm>(key: K, value: string) => setForm((f) => ({ ...f, [key]: value }));

  async function submit(event: FormEvent) {
    event.preventDefault();
    const result = validateSupplementForm(form);
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
      <div className="ct"><span className="dot dot-blue" />{editing ? `Edit ${editing.name}` : 'Add a supplement'}</div>
      <div className="form-grid">
        <Field id="sup-name" label="Name" error={errors.name} wide>
          <input id="sup-name" type="text" value={form.name} placeholder="Creatine monohydrate" autoComplete="off" onChange={(e) => set('name', e.target.value)} />
        </Field>
        <Field id="sup-dosage" label="Dosage" error={errors.dosage}>
          <input id="sup-dosage" type="text" value={form.dosage} placeholder="5 g" onChange={(e) => set('dosage', e.target.value)} />
        </Field>
        <Field id="sup-frequency" label="Frequency" error={errors.frequency}>
          <input id="sup-frequency" type="text" value={form.frequency} placeholder="Once a day" onChange={(e) => set('frequency', e.target.value)} />
        </Field>
        <Field id="sup-start" label="Started" error={errors.start_date} hint="Leave blank if unknown. A blank start counts as already taking it.">
          <input id="sup-start" type="date" value={form.start_date} onChange={(e) => set('start_date', e.target.value)} />
        </Field>
        <Field id="sup-end" label="Ended" error={errors.end_date} hint="Leave blank while you are still taking it.">
          <input id="sup-end" type="date" value={form.end_date} onChange={(e) => set('end_date', e.target.value)} />
        </Field>
        <Field id="sup-notes" label="Notes" error={errors.notes} wide>
          <textarea id="sup-notes" value={form.notes} placeholder="Brand, why you take it, anything to remember" onChange={(e) => set('notes', e.target.value)} />
        </Field>
      </div>

      {failure && <div className="notice notice-bad" role="alert">Could not save: {failure}</div>}

      <div className="btn-row">
        <button type="submit" className="btn btn-primary" disabled={busy}>{busy ? 'Saving…' : editing ? 'Save changes' : 'Add'}</button>
        <button type="button" className="btn" onClick={onCancel} disabled={busy}>Cancel</button>
      </div>
    </form>
  );
}
