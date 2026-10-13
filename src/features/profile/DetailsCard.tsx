import { useState, type FormEvent } from 'react';
import { saveDetails, type Profile } from '../../db/profile.ts';
import { ACTIVITY } from '../../lib/nutrition.ts';
import { formFromDetails, validateDetails, type DetailsErrors, type DetailsForm } from './details.ts';

/**
 * Sex, date of birth, height and how active you are: the four facts a person's age, their lab reference ranges and the
 * calorie suggestion are worked out from. The age shown comes from the date of birth, so it goes up on the birthday.
 */
export function DetailsCard({ profile, today, onSaved }: { profile: Profile | null; today: string; onSaved: () => void }) {
  const initial = formFromDetails(profile);
  const complete = validateDetails(initial, today).ok;
  const [editing, setEditing] = useState(!complete);
  const [form, setForm] = useState<DetailsForm>(initial);
  const [errors, setErrors] = useState<DetailsErrors>({});
  const [failure, setFailure] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(event: FormEvent) {
    event.preventDefault();
    const result = validateDetails(form, today);
    if (!result.ok) {
      setErrors(result.errors);
      return;
    }
    setErrors({});
    setFailure(null);
    setBusy(true);
    try {
      await saveDetails(profile?.id ?? null, result.value);
      setEditing(false);
      onSaved();
    } catch (e) {
      setFailure(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  if (!editing && profile && complete) {
    const activity = ACTIVITY.find((a) => a.value === profile.activity_level);
    return (
      <div className="card sec">
        <div className="ct"><span className="dot dot-blue" />Your details</div>
        <div className="flex flex-wrap items-center justify-between gap-3 text-[13px] text-ink-2">
          <div>
            <strong className="text-ink">{profile.age}</strong> years, <strong className="text-ink">{initial.sex}</strong>, <strong className="text-ink">{Number(profile.height_cm)}</strong> cm
            {activity ? <>, <strong className="text-ink">{activity.label.toLowerCase()}</strong></> : null}
          </div>
          <button type="button" className="btn" onClick={() => { setForm(initial); setEditing(true); }}>Edit</button>
        </div>
        <div className="fld-hint">Born {profile.date_of_birth}. Your age goes up on your birthday by itself.</div>
      </div>
    );
  }

  return (
    <form className="card sec" onSubmit={submit} noValidate>
      <div className="ct"><span className="dot dot-blue" />Your details</div>
      {!complete && (
        <div className="notice notice-warn">
          Your age, lab ranges and calorie suggestion depend on these. {profile ? 'Fill in what is missing.' : 'Nothing is saved until you press Save.'}
        </div>
      )}
      <div className="form-grid" style={{ marginTop: 12 }}>
        <div className="fld">
          <label htmlFor="pf-dob">Date of birth</label>
          <input id="pf-dob" type="date" autoComplete="bday" min="1900-01-01" max={today} value={form.date_of_birth} onChange={(e) => setForm({ ...form, date_of_birth: e.target.value })} />
          {errors.date_of_birth && <div className="fld-err" role="alert">{errors.date_of_birth}</div>}
        </div>
        <div className="fld">
          <label htmlFor="pf-sex">Sex</label>
          <select id="pf-sex" value={form.sex} onChange={(e) => setForm({ ...form, sex: e.target.value as DetailsForm['sex'] })}>
            <option value="">Choose</option>
            <option value="male">Male</option>
            <option value="female">Female</option>
          </select>
          {errors.sex && <div className="fld-err" role="alert">{errors.sex}</div>}
        </div>
        <div className="fld">
          <label htmlFor="pf-height">Height (cm)</label>
          <input id="pf-height" type="number" inputMode="decimal" step="0.5" value={form.height_cm} placeholder="175" onChange={(e) => setForm({ ...form, height_cm: e.target.value })} />
          {errors.height_cm && <div className="fld-err" role="alert">{errors.height_cm}</div>}
        </div>
        <div className="fld">
          <label htmlFor="pf-activity">How active are you?</label>
          <select id="pf-activity" value={form.activity} onChange={(e) => setForm({ ...form, activity: e.target.value })}>
            <option value="">Choose</option>
            {ACTIVITY.map((a) => <option key={a.value} value={a.value}>{a.label}: {a.hint}</option>)}
          </select>
          {errors.activity && <div className="fld-err" role="alert">{errors.activity}</div>}
        </div>
      </div>
      {failure && <div className="notice notice-bad" role="alert">Could not save: {failure}</div>}
      <div className="btn-row">
        <button type="submit" className="btn btn-primary" disabled={busy}>{busy ? 'Saving…' : 'Save'}</button>
        {complete && <button type="button" className="btn" disabled={busy} onClick={() => setEditing(false)}>Cancel</button>}
      </div>
    </form>
  );
}
