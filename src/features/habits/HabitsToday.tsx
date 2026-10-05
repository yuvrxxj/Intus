import { useRef, useState } from 'react';
import type { Habit } from '../../db/habits.ts';
import { emojiBurst, freshGesture, gesture, sparks } from '../../fx/engine.ts';
import { sfx } from '../../fx/sound.ts';
import {
  MAX_COUNT, MAX_NOTE, describeGoal, fractionOfGoal, toneOf, type Entries, type HabitEntry, type Tone,
} from './model.ts';

const TONE_WORD: Record<Tone, string> = { good: 'On track', ok: 'Close', bad: 'Off track', none: '' };

function HabitRow({ habit, entry, onChange }: {
  habit: Habit;
  entry: HabitEntry | undefined;
  onChange: (entry: HabitEntry | undefined) => void;
}) {
  // a count nobody touched shows 0, so it is judged as 0 (and saved as 0), the same as the overview counts it
  const tone = toneOf(habit, entry ?? (habit.kind === 'count' ? { value: 0 } : undefined));
  const goal = describeGoal(habit);
  const countRef = useRef<HTMLDivElement>(null);
  const [noteOpen, setNoteOpen] = useState(false);
  const fraction = habit.kind === 'amount' ? fractionOfGoal(habit, entry) : null;
  const lowerBetter = habit.better === 'lower';

  function celebrate(good: boolean) {
    if (!freshGesture()) return;
    sparks(gesture.x, gesture.y, good ? 10 : 6, good ? ['#3dc47a', '#e8b84a'] : ['#d94f5c', '#e8b84a']);
  }

  function changeCount(delta: number) {
    const current = typeof entry?.value === 'number' ? entry.value : 0;
    const next = Math.min(MAX_COUNT, Math.max(0, current + delta));
    onChange({ ...entry, value: next });
    const box = countRef.current?.getBoundingClientRect();
    if (!box) return;
    const x = box.left + box.width / 2;
    const y = box.top + box.height / 2;
    if (lowerBetter && next === 0 && current > 0) {
      emojiBurst(x, y, '🎉', 6);
      sfx.ding();
    } else if (delta > 0 && lowerBetter) {
      sparks(x, y, 6, ['#d94f5c', '#e8b84a']);
      sfx.puff();
    } else {
      sparks(x, y, 6, ['#3dc47a', '#e8b84a']);
    }
  }

  function answer(yes: boolean) {
    if (entry?.value === yes) {
      onChange(undefined);
      return;
    }
    onChange({ ...entry, value: yes });
    celebrate(yes === !lowerBetter);
  }

  function setAmount(raw: string) {
    if (raw.trim() === '') return onChange(undefined);
    const n = Number(raw);
    if (Number.isFinite(n) && n >= 0) onChange({ ...entry, value: n });
  }

  const value = entry?.value;
  const yes = value === true;
  const no = value === false;

  return (
    <div className={`habit tone-${tone}`}>
      <div className="habit-head">
        <span className="habit-name">{habit.name}</span>
        {goal && <span className="habit-goal">{goal}</span>}
        {tone !== 'none' && <span className={`habit-tone tone-${tone}`}>{TONE_WORD[tone]}</span>}
      </div>

      {habit.kind === 'yesno' && (
        <div className="tg">
          <button type="button" className={`tb${yes ? (lowerBetter ? ' an' : ' ay') : ''}`} aria-pressed={yes} onClick={() => answer(true)}>✓ Yes</button>
          <button type="button" className={`tb${no ? (lowerBetter ? ' ay' : ' an') : ''}`} aria-pressed={no} onClick={() => answer(false)}>✗ No</button>
        </div>
      )}

      {habit.kind === 'count' && (
        <div className="habit-count">
          <button type="button" className="cbtn" aria-label={`One fewer ${habit.name}`} onClick={() => changeCount(-1)}>−</button>
          <div ref={countRef} className={`habit-num tone-${tone}`} aria-live="polite" aria-label={`${habit.name} today`}>
            {typeof value === 'number' ? value : 0}
          </div>
          <button type="button" className="cbtn" aria-label={`One more ${habit.name}`} onClick={() => changeCount(1)}>+</button>
        </div>
      )}

      {habit.kind === 'amount' && (
        <div>
          <div className="habit-amount">
            <input type="number" inputMode="decimal" min="0" step="any" aria-label={`${habit.name}${habit.unit ? ` (${habit.unit})` : ''}`}
              value={typeof value === 'number' ? String(value) : ''} placeholder="0" onChange={(e) => setAmount(e.target.value)} />
            {habit.unit && <span className="habit-unit">{habit.unit}</span>}
          </div>
          {fraction !== null && (
            <div className="pbar habit-bar" role="img" aria-label={`${Math.round(fraction * 100)} percent of the goal`}>
              <div className={`pfill habit-fill tone-${tone}`} style={{ width: `${fraction * 100}%` }} />
            </div>
          )}
        </div>
      )}

      {entry !== undefined && (noteOpen || entry.note) ? (
        <input className="habit-note" type="text" maxLength={MAX_NOTE} aria-label={`Note for ${habit.name}`}
          placeholder={habit.name.toLowerCase().includes('cardio') ? 'Stairmaster, 30 min' : 'Add a note'}
          value={entry.note ?? ''} onChange={(e) => onChange({ value: entry.value, ...(e.target.value === '' ? {} : { note: e.target.value }) })} />
      ) : entry !== undefined ? (
        <button type="button" className="habit-add-note" onClick={() => setNoteOpen(true)}>+ note</button>
      ) : null}
    </div>
  );
}

/** One tile per habit the person tracks. onChange(id, undefined) clears a habit's value for the day. */
export function HabitsToday({ habits, entries, onChange }: {
  habits: readonly Habit[];
  entries: Entries;
  onChange: (id: string, entry: HabitEntry | undefined) => void;
}) {
  return (
    <div className="habit-grid">
      {habits.map((h) => (
        <HabitRow key={h.id} habit={h} entry={entries[h.id]} onChange={(entry) => onChange(h.id, entry)} />
      ))}
    </div>
  );
}
