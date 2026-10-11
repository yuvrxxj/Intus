import { useEffect, useMemo, useRef, useState, type FormEvent, type ReactNode } from 'react';
import { Camera, Trash2 } from 'lucide-react';
import { Segmented } from '@/components/ui/segmented';
import { addCheckIn, deleteCheckIn } from '../../db/photos.ts';
import { formatDay } from '../bloodwork/format.ts';
import { prepareImage, type PreparedImage } from './image.ts';
import {
  compareEnds, daysApart, describeWeightChange, fileProblem, LIMITS, POSE_LABEL, POSES, roomFor, validateCheckIn,
  type CheckIn, type CheckInErrors, type CheckInForm, type Pose,
} from './model.ts';
import { usePhotoCheckIns } from './usePhotoCheckIns.ts';

function Field(props: { id: string; label: string; error?: string; hint?: string; children: ReactNode }) {
  return (
    <div className="fld">
      <label htmlFor={props.id}>{props.label}</label>
      {props.children}
      {props.error ? <div className="fld-err" role="alert">{props.error}</div> : props.hint ? <div className="fld-hint">{props.hint}</div> : null}
    </div>
  );
}

const kb = (bytes: number) => (bytes >= 1024 * 1024 ? `${(bytes / 1024 / 1024).toFixed(1)} MB` : `${Math.max(1, Math.round(bytes / 1024))} KB`);

function caption(entry: CheckIn): string {
  const parts = [formatDay(entry.log_date)];
  if (entry.pose) parts.push(POSE_LABEL[entry.pose]);
  if (entry.weight !== null) parts.push(`${entry.weight} kg`);
  return parts.join(' · ');
}

function AddPhoto({ today, latestWeightKg, remaining, notify, onSaved }: {
  today: string;
  latestWeightKg: number | null;
  remaining: number;
  notify: (message: string, error?: boolean) => void;
  onSaved: () => void;
}) {
  const [form, setForm] = useState<CheckInForm>({ date: today, pose: 'front', label: '', weight: latestWeightKg === null ? '' : String(latestWeightKg) });
  const [errors, setErrors] = useState<CheckInErrors>({});
  const [picked, setPicked] = useState<PreparedImage | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [problem, setProblem] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!picked) { setPreviewUrl(null); return undefined; }
    const url = URL.createObjectURL(picked.blob);
    setPreviewUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [picked]);

  const set = <K extends keyof CheckInForm>(key: K, value: string) => setForm((f) => ({ ...f, [key]: value }));

  async function choose(file: File | undefined) {
    setProblem(null);
    setPicked(null);
    if (!file) return;
    const why = fileProblem(file);
    if (why) { setProblem(why); return; }
    setBusy(true);
    try {
      setPicked(await prepareImage(file));
    } catch (e) {
      setProblem(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  function clear() {
    setPicked(null);
    setProblem(null);
    if (fileInput.current) fileInput.current.value = '';
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!picked) { setProblem('Choose a photo first'); return; }
    const result = validateCheckIn(form, today);
    if (!result.ok) { setErrors(result.errors); return; }
    setErrors({});
    setBusy(true);
    try {
      await addCheckIn(picked.blob, picked.type, result.value);
      notify('Photo saved');
      clear();
      setForm((f) => ({ ...f, label: '' }));
      onSaved();
    } catch (e) {
      notify(`Error: ${e instanceof Error ? e.message : String(e)}`, true);
    } finally {
      setBusy(false);
    }
  }

  if (remaining === 0) {
    return <div className="notice" style={{ marginTop: 12 }}>You have {LIMITS.maxPhotos} photos, which is the most that can be kept. Delete some to add more.</div>;
  }

  return (
    <form onSubmit={submit} noValidate className="mt-4 grid gap-4">
      <div className="grid gap-3 sm:grid-cols-[auto_1fr] sm:items-start">
        <div>
          <input ref={fileInput} id="photo-file" type="file" accept="image/*" className="sr-only" disabled={busy}
            onChange={(e) => void choose(e.target.files?.[0])} />
          <label htmlFor="photo-file" className="btn inline-flex cursor-pointer items-center gap-2">
            <Camera className="size-4" aria-hidden="true" />{picked ? 'Choose another photo' : 'Choose or take a photo'}
          </label>
        </div>
        {picked && previewUrl ? (
          <div className="flex items-start gap-3">
            <img src={previewUrl} alt="Preview of the photo you chose" className="h-40 w-auto rounded-[10px] border border-line object-contain" />
            <div className="text-xs leading-relaxed text-ink-3">
              Saved at {picked.width} by {picked.height} px, {kb(picked.blob.size)}.<br />
              Location and camera details are removed.
            </div>
          </div>
        ) : null}
      </div>
      {problem ? <div className="notice notice-bad" role="alert" style={{ marginTop: 0 }}>{problem}</div> : null}

      <div className="form-grid">
        <Field id="photo-date" label="Date" error={errors.date}>
          <input id="photo-date" type="date" value={form.date} max={today} onChange={(e) => set('date', e.target.value)} />
        </Field>
        <Field id="photo-pose" label="Angle" error={errors.pose}>
          <select id="photo-pose" value={form.pose} onChange={(e) => set('pose', e.target.value)}>
            {POSES.map((p) => <option key={p} value={p}>{POSE_LABEL[p]}</option>)}
          </select>
        </Field>
        <Field id="photo-weight" label="Weight that day (kg)" error={errors.weight} hint="Optional. Filled in from your latest weigh-in.">
          <input id="photo-weight" type="number" inputMode="decimal" step="0.1" min={LIMITS.weightKg.min} max={LIMITS.weightKg.max}
            value={form.weight} onChange={(e) => set('weight', e.target.value)} />
        </Field>
        <Field id="photo-label" label="Note" error={errors.label} hint="Optional, for example Week 6.">
          <input id="photo-label" type="text" maxLength={LIMITS.labelChars + 10} value={form.label} onChange={(e) => set('label', e.target.value)} />
        </Field>
      </div>

      <div className="btn-row" style={{ marginTop: 0 }}>
        <button type="submit" className="btn btn-primary" disabled={busy || !picked}>{busy ? 'Working…' : 'Save photo'}</button>
        {picked ? <button type="button" className="btn" disabled={busy} onClick={clear}>Clear</button> : null}
      </div>
    </form>
  );
}

function Compare({ entries, links }: { entries: CheckIn[]; links: Map<string, string> }) {
  const available = useMemo(() => POSES.filter((p) => compareEnds(entries, p) !== null), [entries]);
  const [chosen, setChosen] = useState<Pose | null>(null);
  const pose = chosen && available.includes(chosen) ? chosen : available[0];
  if (!pose) return null;
  const pair = compareEnds(entries, pose);
  if (!pair) return null;
  const change = describeWeightChange(pair.weightChange);

  return (
    <div className="mt-5 border-t border-line pt-4">
      <div className="ct"><span className="dot dot-dim" />First and latest</div>
      {available.length > 1 ? (
        <Segmented className="mb-3 max-w-md" label="Angle to compare" value={pose} onChange={setChosen}
          options={available.map((p) => ({ value: p, label: POSE_LABEL[p] }))} />
      ) : null}
      <div className="grid grid-cols-2 gap-3">
        {[pair.before, pair.after].map((entry, i) => {
          const url = entry.storage_path ? links.get(entry.storage_path) : undefined;
          return (
            <figure key={entry.id} className="m-0">
              {url ? <img src={url} alt={`${i === 0 ? 'First' : 'Latest'} ${POSE_LABEL[pose]} photo, ${formatDay(entry.log_date)}`} className="aspect-[3/4] w-full rounded-[10px] border border-line bg-surface-2 object-contain" />
                : <div className="grid aspect-[3/4] w-full place-items-center rounded-[10px] border border-line text-xs text-ink-3">Photo unavailable</div>}
              <figcaption className="mt-1.5 text-xs text-ink-3">{i === 0 ? 'First' : 'Latest'}: {caption(entry)}</figcaption>
            </figure>
          );
        })}
      </div>
      <p className="mt-2 text-xs text-ink-3">
        {daysApart(pair.days)}{change ? `, ${change}` : ''}. Lighting, posture and time of day change how a body looks, so compare like with like.
      </p>
    </div>
  );
}

function Thumb({ entry, url, onOpen, onDelete, busy }: { entry: CheckIn; url: string | undefined; onOpen: () => void; onDelete: () => void; busy: boolean }) {
  const [asking, setAsking] = useState(false);
  return (
    <li className="min-w-0">
      <button type="button" onClick={onOpen} disabled={!url} className="block w-full overflow-hidden rounded-[10px] border border-line bg-surface-2 p-0 disabled:opacity-60"
        aria-label={`Open the photo from ${caption(entry)}`}>
        {url ? <img src={url} alt="" loading="lazy" className="aspect-[3/4] w-full object-cover" />
          : <span className="grid aspect-[3/4] w-full place-items-center px-2 text-center text-xs text-ink-3">Photo unavailable</span>}
      </button>
      <div className="mt-1.5 text-xs text-ink-2">{caption(entry)}</div>
      {entry.label ? <div className="text-xs text-ink-3">{entry.label}</div> : null}
      {asking ? (
        <div className="mt-1 flex flex-wrap gap-2">
          <button type="button" className="btn btn-danger !min-h-0 !px-2.5 !py-1 text-xs" disabled={busy} onClick={onDelete}>Delete for good</button>
          <button type="button" className="btn !min-h-0 !px-2.5 !py-1 text-xs" disabled={busy} onClick={() => setAsking(false)}>Keep</button>
        </div>
      ) : (
        <button type="button" className="mt-1 inline-flex items-center gap-1 text-xs text-ink-3 hover:text-ink" onClick={() => setAsking(true)}>
          <Trash2 className="size-3" aria-hidden="true" />Delete
        </button>
      )}
    </li>
  );
}

function Viewer({ entry, url, onClose }: { entry: CheckIn | null; url: string | undefined; onClose: () => void }) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (entry && !dialog.open) dialog.showModal();
    if (!entry && dialog.open) dialog.close();
  }, [entry]);
  return (
    <dialog ref={ref} onClose={onClose} onClick={(e) => { if (e.target === ref.current) onClose(); }}
      className="m-auto max-h-[92vh] max-w-[min(92vw,720px)] rounded-[14px] border border-line-strong bg-surface p-3 backdrop:bg-ink/60" aria-label="Photo">
      {entry && url ? (
        <div>
          <img src={url} alt={`Photo from ${caption(entry)}`} className="max-h-[78vh] w-auto max-w-full rounded-[10px]" />
          <div className="mt-2 flex items-center justify-between gap-3 text-sm text-ink-2">
            <span>{caption(entry)}{entry.label ? `, ${entry.label}` : ''}</span>
            <button type="button" className="btn" onClick={onClose}>Close</button>
          </div>
        </div>
      ) : null}
    </dialog>
  );
}

/** Progress photos: private, resized in the browser, stored in a bucket only the owner can read. */
export function PhotoCheckIns({ today, latestWeightKg, notify }: {
  today: string;
  latestWeightKg: number | null;
  notify: (message: string, error?: boolean) => void;
}) {
  const { status, error, entries, links, reload } = usePhotoCheckIns();
  const [open, setOpen] = useState<CheckIn | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  // rows from before photos existed have no picture; they are not shown
  const shown = useMemo(() => entries.filter((e) => e.storage_path !== null), [entries]);

  async function remove(entry: CheckIn) {
    setBusyId(entry.id);
    try {
      await deleteCheckIn(entry);
      notify('Photo deleted');
      reload();
    } catch (e) {
      notify(`Error: ${e instanceof Error ? e.message : String(e)}`, true);
    } finally {
      setBusyId(null);
    }
  }

  return (
    <section className="card sec" aria-labelledby="photos-title">
      <div className="ct" id="photos-title"><span className="dot dot-red" />Photo check-ins</div>
      <p className="mt-1 text-sm leading-relaxed text-ink-2">
        Take a photo the same way each time: the same spot, light, clothing and time of day. Photos are private to you.
        They are shrunk on this device, location and camera details are removed, and they are deleted for good when you
        delete a photo or your account.
      </p>

      {status === 'loading' ? <div className="loading">Loading your photos</div> : null}
      {status === 'error' ? (
        <div className="cbanner" role="alert">
          <div className="cbanner-hdr">Your photos could not be loaded</div>
          <div className="ci">{error}</div>
          <button type="button" className="retry-btn" onClick={reload}>Try again</button>
        </div>
      ) : null}

      {status === 'ready' ? (
        <>
          <AddPhoto today={today} latestWeightKg={latestWeightKg} remaining={roomFor(shown.length)} notify={notify} onSaved={reload} />
          {shown.length === 0 ? (
            <div className="notice" style={{ marginTop: 14 }}>No photos yet. Your first one is the starting line you compare against.</div>
          ) : (
            <ul className="m-0 mt-5 grid list-none grid-cols-2 gap-3 p-0 sm:grid-cols-3 lg:grid-cols-4">
              {shown.map((entry) => (
                <Thumb key={entry.id} entry={entry} url={entry.storage_path ? links.get(entry.storage_path) : undefined}
                  busy={busyId === entry.id} onOpen={() => setOpen(entry)} onDelete={() => void remove(entry)} />
              ))}
            </ul>
          )}
          <Compare entries={shown} links={links} />
        </>
      ) : null}

      <Viewer entry={open} url={open?.storage_path ? links.get(open.storage_path) : undefined} onClose={() => setOpen(null)} />
    </section>
  );
}
