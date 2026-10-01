import { useState, type FormEvent } from 'react';
import { saveProfile, type Profile } from '../../db/profile.ts';
import { formFromProfile, profileIsReady, validateProfileForm, type ProfileErrors, type ProfileForm } from './model.ts';

interface Props {
  profile: Profile | null;
  onSaved: () => void;
}

export function ProfileCard({ profile, onSaved }: Props) {
  const ready = profileIsReady(profile);
  const [editing, setEditing] = useState(!ready);
  const [form, setForm] = useState<ProfileForm>(() => formFromProfile(profile));
  const [errors, setErrors] = useState<ProfileErrors>({});
  const [failure, setFailure] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(event: FormEvent) {
    event.preventDefault();
    const result = validateProfileForm(form);
    if (!result.ok) {
      setErrors(result.errors);
      return;
    }
    setErrors({});
    setFailure(null);
    setBusy(true);
    try {
      await saveProfile(profile?.id ?? null, result.value);
      setEditing(false);
      onSaved();
    } catch (e) {
      setFailure(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  if (!editing && profile && ready) {
    const flags = [
      profile.family_colorectal_cancer && 'family history of colorectal cancer',
      profile.family_prostate_cancer && 'family history of prostate cancer',
      profile.noise_or_blast_exposure && 'noise or blast exposure',
    ].filter(Boolean);
    return (
      <div className="card sec">
        <div className="ct"><span className="dot dot-blue" />Your details</div>
        <div className="scr-profile">
          <div><strong>{profile.age}</strong> years, <strong>{formFromProfile(profile).sex}</strong>{flags.length > 0 ? `, ${flags.join(', ')}` : ', no risk flags set'}</div>
          <button type="button" className="btn" onClick={() => { setForm(formFromProfile(profile)); setEditing(true); }}>Edit</button>
        </div>
        <div className="fld-hint">Your age is stored as a number, so update it on your birthday.</div>
      </div>
    );
  }

  return (
    <form className="card sec" onSubmit={submit} noValidate>
      <div className="ct"><span className="dot dot-blue" />Your details</div>
      {!ready && (
        <div className="notice notice-warn">
          Which screenings apply depends on your age, sex and family history. {profile ? 'Fill in what is missing.' : 'These are prefilled from the header, and nothing is saved until you press Save.'}
        </div>
      )}
      <div className="form-grid" style={{ marginTop: 12 }}>
        <div className="fld">
          <label htmlFor="pf-age">Age</label>
          <input id="pf-age" type="number" inputMode="numeric" min="0" max="120" step="1" value={form.age} onChange={(e) => setForm({ ...form, age: e.target.value })} />
          {errors.age && <div className="fld-err" role="alert">{errors.age}</div>}
        </div>
        <div className="fld">
          <label htmlFor="pf-sex">Sex</label>
          <select id="pf-sex" value={form.sex} onChange={(e) => setForm({ ...form, sex: e.target.value as ProfileForm['sex'] })}>
            <option value="">Choose</option>
            <option value="male">Male</option>
            <option value="female">Female</option>
          </select>
          {errors.sex && <div className="fld-err" role="alert">{errors.sex}</div>}
        </div>
      </div>
      <div style={{ marginTop: 10 }}>
        <label className="check-row">
          <input type="checkbox" checked={form.family_colorectal_cancer} onChange={(e) => setForm({ ...form, family_colorectal_cancer: e.target.checked })} />
          A close relative had colorectal cancer
        </label>
        <label className="check-row">
          <input type="checkbox" checked={form.family_prostate_cancer} onChange={(e) => setForm({ ...form, family_prostate_cancer: e.target.checked })} />
          A close relative had prostate cancer
        </label>
        <label className="check-row">
          <input type="checkbox" checked={form.noise_or_blast_exposure} onChange={(e) => setForm({ ...form, noise_or_blast_exposure: e.target.checked })} />
          Regular exposure to loud noise or blasts
        </label>
      </div>
      {failure && <div className="notice notice-bad" role="alert">Could not save: {failure}</div>}
      <div className="btn-row">
        <button type="submit" className="btn btn-primary" disabled={busy}>{busy ? 'Saving…' : 'Save'}</button>
        {ready && <button type="button" className="btn" disabled={busy} onClick={() => setEditing(false)}>Cancel</button>}
      </div>
    </form>
  );
}
