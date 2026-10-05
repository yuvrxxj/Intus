import { useRef, useState, type DragEvent } from 'react';
import { confetti, emojiBurst, freshGesture, gesture, sparks } from '../../fx/engine.ts';
import { sfx } from '../../fx/sound.ts';
import type { Programme } from '../../lib/programme.ts';
import { useProgramme } from '../profile/ProfileContext.tsx';
import { dosesDue, skippedToday, describeDays, type Dose } from '../supplements/schedule.ts';
import { useSupplements } from '../supplements/useSupplements.ts';
import { useHabits } from '../habits/HabitsContext.tsx';
import { HabitsToday } from '../habits/HabitsToday.tsx';
import type { HabitEntry } from '../habits/model.ts';
import type { TodayForm } from './useToday.ts';
import { useHfmImage } from './hfmImage.ts';

const MOODS = [
  { value: 1, emoji: '😤', title: 'Rough' },
  { value: 2, emoji: '😞', title: 'Low' },
  { value: 3, emoji: '😐', title: 'Neutral' },
  { value: 4, emoji: '🙂', title: 'Good' },
  { value: 5, emoji: '🔥', title: 'Fired' },
];

const SAVE_MESSAGES = [
  'Saved ✓ future you says thanks',
  'Logged ✓ consistency king 👑',
  'Saved ✓ another brick in the wall 🧱',
  'In the books ✓ 📒',
  'Saved ✓ the data gods are pleased',
];

function calorieColor(total: number, programme: Programme | null): string {
  if (programme?.calorieOver == null || programme.calorieNear == null) return 'var(--txt)';
  return total > programme.calorieOver ? 'var(--red)' : total >= programme.calorieNear ? 'var(--yellow)' : 'var(--green)';
}

export function Today({ form, today, lastWeightDate, notify }: {
  form: TodayForm;
  today: string;
  lastWeightDate: string | null;
  notify: (message: string, error?: boolean) => void;
}) {
  const { draft, set, save, saving } = form;
  const fileRef = useRef<HTMLInputElement>(null);
  const { image, set: setImage } = useHfmImage();
  const [dragging, setDragging] = useState(false);
  const [saved, setSaved] = useState(false);

  const programme = useProgramme();
  const supplements = useSupplements();
  const habits = useHabits();
  const due = dosesDue(supplements.items, today);
  const skipped = skippedToday(supplements.items, today);
  const total = parseInt(draft.calories, 10) || 0;
  const target = programme?.calorieTarget ?? null;
  const remaining = target === null ? null : target - total;

  function setHabit(id: string, entry: HabitEntry | undefined) {
    const next = { ...draft.habits };
    if (entry === undefined) delete next[id];
    else next[id] = entry;
    set('habits', next);
  }

  function toggleSupplement(id: string) {
    const nowOn = !draft.supplements[id];
    const supplements = { ...draft.supplements, [id]: nowOn };
    set('supplements', supplements);
    if (nowOn && freshGesture()) {
      sparks(gesture.x, gesture.y, 12, ['#3dc47a', '#e8b84a']);
      if (due.every((d) => supplements[d.key])) {
        confetti(gesture.x, gesture.y, 60);
        sfx.ding();
        notify('Full stack complete 💊✨');
      }
    }
  }

  function chooseMood(value: number, button: HTMLButtonElement) {
    set('mood', value);
    if (!freshGesture()) return;
    const r = button.getBoundingClientRect();
    emojiBurst(r.left + r.width / 2, r.top + r.height / 2, button.textContent?.trim() ?? '🙂', 7);
  }

  function readFile(file: File | undefined) {
    if (!file || !file.type.startsWith('image/')) return;
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string' && !setImage(reader.result)) {
        notify('Screenshot shown, but this device would not keep it', true);
      }
    };
    reader.readAsDataURL(file);
  }

  function onDrop(e: DragEvent) {
    e.preventDefault();
    setDragging(false);
    readFile(e.dataTransfer.files[0]);
  }

  async function onSave() {
    try {
      await save();
      setSaved(true);
      window.setTimeout(() => setSaved(false), 2000);
      notify(SAVE_MESSAGES[Math.floor(Math.random() * SAVE_MESSAGES.length)]);
      confetti();
      sfx.ding();
    } catch (e) {
      notify(`Error: ${e instanceof Error ? e.message : String(e)}`, true);
      sfx.err();
    }
  }

  return (
    <div>
      <div className="g g2 sec">
        <div className="card">
          <div className="corner-accent" />
          <div className="ct"><span className="dot dot-blue" />Morning Weight</div>
          <label htmlFor="inputWeight">Weight (kg)</label>
          <input id="inputWeight" type="number" step="0.1" min="60" max="120" placeholder="78.0"
            value={draft.weight} onChange={(e) => set('weight', e.target.value)} />
          <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 7 }}>Last: <span>{lastWeightDate ?? '–'}</span></div>
        </div>
    <div className="card">
      <div className="ct"><span className="dot" style={{ background: 'linear-gradient(135deg,var(--blue),var(--red))' }} />Mood</div>
      <div className="mood-row">
        {MOODS.map((m) => (
          <button key={m.value} type="button" className={`mb${draft.mood === m.value ? ' sel' : ''}`}
            title={m.title} aria-label={m.title} aria-pressed={draft.mood === m.value}
            onClick={(e) => chooseMood(m.value, e.currentTarget)}>
            {m.emoji}
          </button>
        ))}
      </div>
      <label htmlFor="moodNotes">Notes</label>
      <textarea id="moodNotes" placeholder="Sleep, energy, body feel..." value={draft.notes}
        onChange={(e) => set('notes', e.target.value)} />
    </div>
      </div>

      <div className="card sec">
        <div className="ct"><span className="dot dot-green" />Habits</div>
        {habits.status === 'loading' ? (
          <div className="loading">Loading your habits</div>
        ) : habits.status === 'error' ? (
          <div className="notice notice-bad" role="alert">
            Your habits could not be loaded ({habits.error}).{' '}
            <button type="button" className="retry-btn" onClick={habits.reload}>Try again</button>
          </div>
        ) : habits.active.length === 0 ? (
          <div className="empty">
            You are not tracking any habits yet. <a href="#goals" style={{ color: 'var(--blue)' }}>Choose what to track</a>, such as cigarettes, lifting, cardio or steps.
          </div>
        ) : (
          <HabitsToday habits={habits.active} entries={draft.habits} onChange={setHabit} />
        )}
      </div>

      <div className="card sec">
        <div className="ct"><span className="dot dot-yellow" />Supplements</div>
        {supplements.loading ? (
          <div className="loading">Loading your supplements</div>
        ) : supplements.error ? (
          <div className="notice notice-bad" role="alert">
            Your supplements could not be loaded ({supplements.error}).{' '}
            <button type="button" className="retry-btn" onClick={supplements.reload}>Try again</button>
          </div>
        ) : due.length === 0 ? (
          <div className="empty">
            {supplements.items.length === 0
              ? <>You have not added any supplements. <a href="#supplements" style={{ color: 'var(--blue)' }}>Add what you take</a> and it shows here each day it is due.</>
              : <>Nothing is due today. <a href="#supplements" style={{ color: 'var(--blue)' }}>Change your schedule</a></>}
          </div>
        ) : (
          <>
            {skipped.length > 0 && (
              <div className="sun-notice">📅 Not due today: {skipped.map((i) => `${i.name} (${describeDays(i.days_of_week ?? [])})`).join(', ')}</div>
            )}
            <div className="glow-line" />
            <div className="supp-list">
              {due.map((d: Dose) => {
                const checked = !!draft.supplements[d.key];
                const detail = [d.dosage, d.of > 1 ? `Dose ${d.n} of ${d.of}` : null].filter(Boolean).join(' · ');
                const everyDay = d.days.length === 7;
                return (
                  <div
                    key={d.key}
                    role="checkbox"
                    aria-checked={checked}
                    tabIndex={0}
                    className={`si${checked ? ' ck' : ''}${everyDay ? '' : ' sun-only'}`}
                    onClick={() => toggleSupplement(d.key)}
                    onKeyDown={(e) => {
                      if (e.key === ' ' || e.key === 'Enter') {
                        e.preventDefault();
                        toggleSupplement(d.key);
                      }
                    }}
                  >
                    <div className="scheck">{checked ? '✓' : ''}</div>
                    <div style={{ flex: 1 }}>
                      <div className="sn">{d.name}</div>
                      {detail && <div className="sd">{detail}</div>}
                    </div>
                    <span className={`stag ${everyDay ? 'daily' : 'sun'}`}>{d.of > 1 ? `${d.of}×/day` : everyDay ? 'daily' : describeDays(d.days)}</span>
                  </div>
                );
              })}
            </div>
          </>
        )}
      </div>

      <div className="card sec">
        <div className="ct"><span className="dot dot-orange" />HealthifyMe</div>
        <div className="nutri-grid">
          <div>
          <div
            className={`hfm-drop${dragging ? ' drag' : ''}`}
            role="button"
            tabIndex={0}
            aria-label="Add today's HealthifyMe screenshot"
            onClick={() => fileRef.current?.click()}
            onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && fileRef.current?.click()}
            onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
            onDragLeave={() => setDragging(false)}
            onDrop={onDrop}
          >
            {image ? (
              <div style={{ width: '100%' }}>
                <img src={image} alt="Today's HealthifyMe screenshot" style={{ maxWidth: '100%', maxHeight: 180, borderRadius: 6, display: 'block', margin: '0 auto' }} />
                <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 5 }}>Tap to replace</div>
              </div>
            ) : (
              <div>
                <div style={{ fontSize: 22 }}>📲</div>
                <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 2 }}>Drop today's HealthifyMe screenshot</div>
              </div>
            )}
          </div>
          <input ref={fileRef} type="file" accept="image/*" style={{ display: 'none' }}
            onChange={(e) => readFile(e.target.files?.[0])} />
          </div>
          <div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 10 }}>
            <div><label htmlFor="inputCals">Calories</label>
              <input id="inputCals" type="number" placeholder="0" min="0" max="6000" value={draft.calories} onChange={(e) => set('calories', e.target.value)} /></div>
            <div><label htmlFor="inputProtein">Protein (g)</label>
              <input id="inputProtein" type="number" placeholder="0" min="0" max="400" value={draft.protein} onChange={(e) => set('protein', e.target.value)} /></div>
            <div><label htmlFor="inputCarbs">Carbs (g)</label>
              <input id="inputCarbs" type="number" placeholder="0" min="0" max="800" value={draft.carbs} onChange={(e) => set('carbs', e.target.value)} /></div>
            <div><label htmlFor="inputFat">Fat (g)</label>
              <input id="inputFat" type="number" placeholder="0" min="0" max="400" value={draft.fat} onChange={(e) => set('fat', e.target.value)} /></div>
          </div>
          <div className="cal-bar-wrap">
            <div className="cal-totals">
              <div>
                <div style={{ fontSize: 11, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '.06em', fontWeight: 600 }}>Total</div>
                <div className="cal-num" style={{ color: calorieColor(total, programme) }}>{total}</div>
              </div>
              <div className="cal-meta">
                {target === null || remaining === null ? (
                  <div>No calorie target set. <a href="#goals" style={{ color: 'var(--blue)' }}>Set one</a></div>
                ) : (
                  <>
                    <div>Target: {target.toLocaleString('en-US')} kcal</div>
                    <div style={{ marginTop: 2, fontSize: 12, color: remaining < 0 ? 'var(--red)' : remaining < 200 ? 'var(--yellow)' : 'var(--muted)' }}>
                      {remaining >= 0 ? `${remaining} remaining` : `${Math.abs(remaining)} over`}
                    </div>
                  </>
                )}
              </div>
            </div>
            <div className="cal-bar">
              <div className={`cal-fill${programme?.calorieOver != null && total > programme.calorieOver ? ' over' : ''}`}
                style={{ width: `${target === null ? 0 : Math.min(100, (total / target) * 100)}%` }} />
            </div>
          </div>
          </div>
        </div>
      </div>

      {form.loadError && (
        <div className="sun-notice" role="alert" style={{ marginTop: 10 }}>
          Today's saved entry could not be loaded ({form.loadError}). Saving is off so it is not overwritten with blanks. Reload to try again.
        </div>
      )}
      <button type="button" className={`save-btn${saved ? ' success' : ''}`} disabled={saving || form.loading || form.loadError !== null} onClick={onSave}>
        {saving ? 'Saving…' : '💾 Save Today'}
      </button>
    </div>
  );
}
