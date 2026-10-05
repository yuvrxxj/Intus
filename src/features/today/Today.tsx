import { useRef, useState, type DragEvent } from 'react';
import { PROGRAMME, SUPPLEMENTS } from '../../config.ts';
import { confetti, emojiBurst, freshGesture, gesture, sparks } from '../../fx/engine.ts';
import { sfx } from '../../fx/sound.ts';
import { isSunday } from '../../util/dates.ts';
import type { Toggle, TodayForm } from './useToday.ts';
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

function ToggleGroup(props: {
  label: string;
  value: Toggle | null;
  options: { value: Toggle; text: string }[];
  onChange: (value: Toggle) => void;
}) {
  return (
    <div>
      <label>{props.label}</label>
      <div className="tg">
        {props.options.map((o) => (
          <button
            key={o.value}
            type="button"
            className={`tb${props.value === o.value ? (o.value === 'no' ? ' an' : o.value === 'bad' ? ' ab' : ' ay') : ''}`}
            aria-pressed={props.value === o.value}
            onClick={() => props.onChange(o.value)}
          >
            {o.text}
          </button>
        ))}
      </div>
    </div>
  );
}

function calorieColor(total: number): string {
  return total > PROGRAMME.calorieOver ? 'var(--red)' : total >= PROGRAMME.calorieNear ? 'var(--yellow)' : 'var(--green)';
}

export function Today({ form, lastWeightDate, notify }: {
  form: TodayForm;
  lastWeightDate: string | null;
  notify: (message: string, error?: boolean) => void;
}) {
  const { draft, set, save, saving } = form;
  const sunday = isSunday();
  const cigRef = useRef<HTMLDivElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const { image, set: setImage } = useHfmImage();
  const [dragging, setDragging] = useState(false);
  const [saved, setSaved] = useState(false);

  const total = parseInt(draft.calories, 10) || 0;
  const remaining = PROGRAMME.calorieTarget - total;

  function changeCigs(delta: number) {
    const next = Math.max(0, draft.cigs + delta);
    set('cigs', next);
    const box = cigRef.current?.getBoundingClientRect();
    if (!box) return;
    const x = box.left + box.width / 2;
    const y = box.top + box.height / 2;
    if (delta > 0) {
      emojiBurst(x, y, '💨', 5);
      sfx.puff();
    } else if (next === 0) {
      emojiBurst(x, y, '🚭', 6);
      sfx.ding();
    } else {
      sparks(x, y, 6, ['#3dc47a', '#e8b84a']);
    }
  }

  function toggleSupplement(id: string) {
    const nowOn = !draft.supplements[id];
    const supplements = { ...draft.supplements, [id]: nowOn };
    set('supplements', supplements);
    if (nowOn && freshGesture()) {
      sparks(gesture.x, gesture.y, 12, ['#3dc47a', '#e8b84a']);
      const due = SUPPLEMENTS.filter((s) => !s.sundayOnly || sunday);
      if (due.every((s) => supplements[s.id])) {
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
          <div className="corner-accent" />
          <div className="ct"><span className="dot dot-green" />Activity</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 11 }}>
            <ToggleGroup label="Lift" value={draft.lift} onChange={(v) => set('lift', v)}
              options={[{ value: 'yes', text: '✓ Yes' }, { value: 'no', text: '✗ Rest' }]} />
            <ToggleGroup label="Core" value={draft.core} onChange={(v) => set('core', v)}
              options={[{ value: 'yes', text: '✓ Yes' }, { value: 'no', text: '✗ No' }]} />
            <ToggleGroup label="Cardio" value={draft.cardio} onChange={(v) => set('cardio', v)}
              options={[{ value: 'yes', text: '✓ Stairmaster' }, { value: 'no', text: '✗ No' }, { value: 'bad', text: '🏸 Badminton' }]} />
          </div>
        </div>
      </div>

      <div className="card sec">
        <div className="ct"><span className="dot dot-yellow" />Supplements</div>
        {!sunday && <div className="sun-notice">📅 D3 is Sunday only, not today</div>}
        <div className="glow-line" />
        <div className="supp-list">
          {SUPPLEMENTS.map((s) => {
            const checked = !!draft.supplements[s.id];
            const disabled = s.sundayOnly && !sunday;
            return (
              <div
                key={s.id}
                role="checkbox"
                aria-checked={checked}
                aria-disabled={disabled}
                tabIndex={disabled ? -1 : 0}
                className={`si${checked ? ' ck' : ''}${s.sundayOnly ? ' sun-only' : ''}`}
                style={disabled ? { opacity: 0.4, cursor: 'not-allowed' } : undefined}
                onClick={() => !disabled && toggleSupplement(s.id)}
                onKeyDown={(e) => {
                  if (!disabled && (e.key === ' ' || e.key === 'Enter')) {
                    e.preventDefault();
                    toggleSupplement(s.id);
                  }
                }}
              >
                <div className="scheck">{checked ? '✓' : ''}</div>
                <div style={{ flex: 1 }}>
                  <div className="sn">{s.name}</div>
                  <div className="sd">{s.dose}</div>
                </div>
                <span className={`stag ${s.sundayOnly ? 'sun' : s.id === 'zinc' || s.id === 'magnesium' ? 'daily' : ''}`}>{s.tag}</span>
              </div>
            );
          })}
        </div>
      </div>

      <div className="g g2 sec">
        <div className="card">
          <div className="ct"><span className="dot dot-orange" />HealthifyMe</div>
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
                <div className="cal-num" style={{ color: calorieColor(total) }}>{total}</div>
              </div>
              <div className="cal-meta">
                <div>Target: {PROGRAMME.calorieTarget.toLocaleString('en-US')} kcal</div>
                <div style={{ marginTop: 2, fontSize: 12, color: remaining < 0 ? 'var(--red)' : remaining < 200 ? 'var(--yellow)' : 'var(--muted)' }}>
                  {remaining >= 0 ? `${remaining} remaining` : `${Math.abs(remaining)} over`}
                </div>
              </div>
            </div>
            <div className="cal-bar">
              <div className={`cal-fill${total > PROGRAMME.calorieOver ? ' over' : ''}`}
                style={{ width: `${Math.min(100, (total / PROGRAMME.calorieTarget) * 100)}%` }} />
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div className="card">
            <div className="ct"><span className="dot dot-red" />Cigarettes</div>
            <div className="cig-wrap">
              <button type="button" className="cbtn" aria-label="One fewer cigarette" onClick={() => changeCigs(-1)}>−</button>
              <div ref={cigRef}>
                <div className={`cnum ${draft.cigs === 0 ? 'z' : draft.cigs <= 3 ? 'l' : 'h'}`} aria-live="polite">{draft.cigs}</div>
                <div style={{ fontSize: 11, color: 'var(--muted)', textAlign: 'center' }}>today</div>
              </div>
              <button type="button" className="cbtn" aria-label="One more cigarette" onClick={() => changeCigs(1)}>+</button>
            </div>
          </div>
          <div className="card" style={{ flex: 1 }}>
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
