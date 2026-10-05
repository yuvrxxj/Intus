import { useState, type FormEvent } from 'react';
import type { Medication as Supplement } from '../../db/medications.ts';
import { saveMedication } from '../../db/medications.ts';
import {
  EMPTY_SUPPLEMENT_FORM, formFromSupplement, validateSupplementForm, type SupplementForm, type SupplementFormErrors,
} from './model.ts';
import { ALL_DAYS, DAY_LONG, DAY_SHORT, MAX_DOSES, WEEKDAYS, WEEKEND, describeSchedule } from './schedule.ts';

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

  const set = <K extends keyof SupplementForm>(key: K, value: SupplementForm[K]) => setForm((f) => ({ ...f, [key]: value }));
  const toggleDay = (day: number) => set('days', form.days.includes(day) ? form.days.filter((d) => d !== day) : [...form.days, day].sort((a, b) => a - b));
  const sameDays = (days: readonly number[]) => days.length === form.days.length && days.every((d) => form.days.includes(d));
  const summary = form.days.length > 0 ? describeSchedule(Number(form.doses_per_day) || 1, form.days) : null;

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
        <Field id="sup-dosage" label="Dosage each time" error={errors.dosage} hint="For example 3.5 g or 1 tablet.">
          <input id="sup-dosage" type="text" value={form.dosage} placeholder="5 g" onChange={(e) => set('dosage', e.target.value)} />
        </Field>
        <Field id="sup-doses" label="Times a day" error={errors.doses_per_day}>
          <select id="sup-doses" value={form.doses_per_day} onChange={(e) => set('doses_per_day', e.target.value)}>
            {Array.from({ length: MAX_DOSES }, (_, i) => i + 1).map((n) => <option key={n} value={String(n)}>{n === 1 ? 'Once' : n === 2 ? 'Twice' : `${n} times`}</option>)}
          </select>
        </Field>
        <div className="fld wide">
          <label id="sup-days-label">Days</label>
          <div className="day-chips" role="group" aria-labelledby="sup-days-label">
            {ALL_DAYS.map((d) => (
              <button key={d} type="button" className={`day-chip${form.days.includes(d) ? ' on' : ''}`} aria-pressed={form.days.includes(d)}
                aria-label={DAY_LONG[d]} onClick={() => toggleDay(d)}>
                {DAY_SHORT[d]}
              </button>
            ))}
          </div>
          <div className="btn-row" style={{ marginTop: 8 }}>
            <button type="button" className="btn" aria-pressed={sameDays(ALL_DAYS)} onClick={() => set('days', [...ALL_DAYS])}>Every day</button>
            <button type="button" className="btn" aria-pressed={sameDays(WEEKDAYS)} onClick={() => set('days', [...WEEKDAYS])}>Weekdays</button>
            <button type="button" className="btn" aria-pressed={sameDays(WEEKEND)} onClick={() => set('days', [...WEEKEND])}>Weekends</button>
          </div>
          {errors.days && form.days.length === 0 ? <div className="fld-err" role="alert">{errors.days}</div> : summary ? <div className="fld-hint">{summary}. Only the days you pick show on your Today checklist.</div> : null}
        </div>
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
