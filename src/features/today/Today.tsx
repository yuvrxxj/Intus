import { useRef, useState, type DragEvent, type ReactNode } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Check, ImagePlus } from 'lucide-react';
import { AsciiSpark } from '@/components/ui/ascii-spark';
import { Button } from '@/components/ui/button';
import { Reveal } from '@/components/ui/reveal';
import { cn } from '@/lib/utils';
import type { Programme } from '../../lib/programme.ts';
import { useProgramme } from '../profile/ProfileContext.tsx';
import { dosesDue, skippedToday, describeDays, type Dose } from '../supplements/schedule.ts';
import { useSupplements } from '../supplements/useSupplements.ts';
import { useHabits } from '../habits/HabitsContext.tsx';
import { HabitsToday } from '../habits/HabitsToday.tsx';
import type { HabitEntry } from '../habits/model.ts';
import type { TodayForm } from './useToday.ts';
import { useHfmImage } from './hfmImage.ts';
import { MOODS } from './mood.ts';

function calorieTone(total: number, programme: Programme | null): 'over' | 'near' | 'under' | 'none' {
  if (programme?.calorieOver == null || programme.calorieNear == null || total === 0) return 'none';
  return total > programme.calorieOver ? 'over' : total >= programme.calorieNear ? 'near' : 'under';
}

function Panel({ title, children, className, aside }: { title: string; children: ReactNode; className?: string; aside?: ReactNode }) {
  return (
    <div className={cn('card', className)}>
      <div className="mb-4 flex items-center justify-between gap-3">
        <div className="font-mono text-[11px] tracking-[0.08em] text-ink-3 uppercase">{title}</div>
        {aside}
      </div>
      {children}
    </div>
  );
}

function JumpLink({ to, children }: { to: string; children: ReactNode }) {
  return <a href={`#${to}`} className="text-ink underline decoration-primary underline-offset-3">{children}</a>;
}

export function Today({ form, lastWeightDate, recentWeights, notify, today }: {
  form: TodayForm;
  today: string;
  lastWeightDate: string | null;
  /** the latest weigh-ins, oldest first, for the small trend line under the field */
  recentWeights: readonly number[];
  notify: (message: string, error?: boolean) => void;
}) {
  const { draft, set, save, saving, dirty } = form;
  const fileRef = useRef<HTMLInputElement>(null);
  const { image, set: setImage } = useHfmImage();
  const [dragging, setDragging] = useState(false);

  const programme = useProgramme();
  const supplements = useSupplements();
  const habits = useHabits();
  const due = dosesDue(supplements.items, today);
  const skipped = skippedToday(supplements.items, today);
  const total = parseInt(draft.calories, 10) || 0;
  const target = programme?.calorieTarget ?? null;
  const remaining = target === null ? null : target - total;
  const tone = calorieTone(total, programme);
  const takenCount = due.filter((d) => draft.supplements[d.key]).length;
  const canSave = !saving && !form.loading && form.loadError === null;

  function setHabit(id: string, entry: HabitEntry | undefined) {
    const next = { ...draft.habits };
    if (entry === undefined) delete next[id];
    else next[id] = entry;
    set('habits', next);
  }

  function toggleSupplement(id: string) {
    set('supplements', { ...draft.supplements, [id]: !draft.supplements[id] });
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
      notify('Day saved');
    } catch (e) {
      notify(`Could not save: ${e instanceof Error ? e.message : String(e)}`, true);
    }
  }

  return (
    <div className="grid gap-4">
      <Reveal className="grid gap-4 md:grid-cols-[minmax(0,5fr)_minmax(0,7fr)]">
        <Panel title="Morning weight">
          <label htmlFor="inputWeight" className="sr-only">Weight in kilograms</label>
          <div className="relative">
            <input id="inputWeight" type="number" inputMode="decimal" step="0.1" min="20" max="400" placeholder="78.0"
              className="h-16 pr-12 font-mono text-[28px] tracking-[-0.02em]"
              value={draft.weight} onChange={(e) => set('weight', e.target.value)} />
            <span className="pointer-events-none absolute top-1/2 right-4 -translate-y-1/2 font-mono text-sm text-ink-3">kg</span>
          </div>
          <div className="mt-3 text-xs text-ink-3">Last weigh-in: <span className="font-mono text-ink-2">{lastWeightDate ?? 'none yet'}</span></div>
          {recentWeights.length >= 2 && (
            <div className="mt-6 border-t border-line pt-4">
              <div className="flex items-baseline justify-between font-mono text-[10px] tracking-[0.08em] text-ink-3 uppercase">
                <span>Last {recentWeights.length} weigh-ins</span>
                <span className="tabular-nums">{Math.min(...recentWeights).toFixed(1)} to {Math.max(...recentWeights).toFixed(1)} kg</span>
              </div>
              <AsciiSpark values={recentWeights} className="mt-2 block overflow-hidden text-[20px]"
                label={`Weight over the last ${recentWeights.length} weigh-ins, from ${recentWeights[0]} to ${recentWeights[recentWeights.length - 1]} kg`} />
            </div>
          )}
        </Panel>

        <Panel title="Mood">
          <div className="grid grid-cols-5 gap-1.5" role="radiogroup" aria-label="Mood today">
            {MOODS.map((m) => {
              const on = draft.mood === m.value;
              return (
                <button key={m.value} type="button" role="radio" aria-checked={on}
                  onClick={() => set('mood', on ? null : m.value)}
                  className={cn(
                    'flex h-16 flex-col items-center justify-center gap-1 rounded-[10px] border transition-colors',
                    on ? 'border-ink bg-ink text-paper' : 'border-line-strong bg-surface-2 text-ink-2 hover:border-ink hover:text-ink',
                  )}>
                  <span className="font-mono text-base leading-none">{m.value}</span>
                  <span className="text-[11px] leading-none">{m.word}</span>
                </button>
              );
            })}
          </div>
          <label htmlFor="moodNotes" className="mt-4">Notes</label>
          <textarea id="moodNotes" className="min-h-[72px]" placeholder="Sleep, energy, how your body feels" value={draft.notes}
            onChange={(e) => set('notes', e.target.value)} />
        </Panel>
      </Reveal>

      <Reveal>
        <Panel title="Habits" aside={habits.status === 'ready' && habits.active.length > 0 ? <JumpLink to="goals">Edit</JumpLink> : undefined}>
          {habits.status === 'loading' ? (
            <div className="loading">Loading your habits</div>
          ) : habits.status === 'error' ? (
            <div className="notice notice-bad mt-0" role="alert">
              Your habits could not be loaded ({habits.error}).{' '}
              <button type="button" className="underline underline-offset-2" onClick={habits.reload}>Try again</button>
            </div>
          ) : habits.active.length === 0 ? (
            <div className="empty">
              You are not tracking any habits yet. <JumpLink to="goals">Choose what to track</JumpLink>, such as cigarettes, lifting, cardio or steps.
            </div>
          ) : (
            <HabitsToday habits={habits.active} entries={draft.habits} onChange={setHabit} />
          )}
        </Panel>
      </Reveal>

      <Reveal className="grid gap-4 md:grid-cols-2">
        <Panel title="Supplements" aside={due.length > 0 ? <span className="font-mono text-[11px] text-ink-3 tabular-nums">{takenCount}/{due.length} taken</span> : undefined}>
          {supplements.loading ? (
            <div className="loading">Loading your supplements</div>
          ) : supplements.error ? (
            <div className="notice notice-bad mt-0" role="alert">
              Your supplements could not be loaded ({supplements.error}).{' '}
              <button type="button" className="underline underline-offset-2" onClick={supplements.reload}>Try again</button>
            </div>
          ) : due.length === 0 ? (
            <div className="empty">
              {supplements.items.length === 0
                ? <>You have not added any supplements. <JumpLink to="supplements">Add what you take</JumpLink> and it shows here each day it is due.</>
                : <>Nothing is due today. <JumpLink to="supplements">Change your schedule</JumpLink></>}
            </div>
          ) : (
            <>
              {skipped.length > 0 && (
                <div className="sun-notice">Not due today: {skipped.map((i) => `${i.name} (${describeDays(i.days_of_week ?? [])})`).join(', ')}</div>
              )}
              <div className="supp-list">
                {due.map((d: Dose) => {
                  const checked = !!draft.supplements[d.key];
                  const detail = [d.dosage, d.of > 1 ? `Dose ${d.n} of ${d.of}` : null].filter(Boolean).join(', ');
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
                      <div className="scheck">{checked && <Check className="size-3.5" strokeWidth={3} aria-hidden="true" />}</div>
                      <div className="min-w-0 flex-1">
                        <div className="sn">{d.name}</div>
                        {detail && <div className="sd">{detail}</div>}
                      </div>
                      <span className={`stag ${everyDay ? 'daily' : 'sun'}`}>{d.of > 1 ? `${d.of}x a day` : everyDay ? 'Daily' : describeDays(d.days)}</span>
                    </div>
                  );
                })}
              </div>
            </>
          )}
        </Panel>

        <Panel title="Nutrition">
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2"><label htmlFor="inputCals">Calories (kcal)</label>
              <input id="inputCals" type="number" inputMode="numeric" placeholder="0" min="0" max="6000" value={draft.calories} onChange={(e) => set('calories', e.target.value)} /></div>
            <div><label htmlFor="inputProtein">Protein (g)</label>
              <input id="inputProtein" type="number" inputMode="numeric" placeholder="0" min="0" max="400" value={draft.protein} onChange={(e) => set('protein', e.target.value)} /></div>
            <div><label htmlFor="inputCarbs">Carbs (g)</label>
              <input id="inputCarbs" type="number" inputMode="numeric" placeholder="0" min="0" max="800" value={draft.carbs} onChange={(e) => set('carbs', e.target.value)} /></div>
            <div><label htmlFor="inputFat">Fat (g)</label>
              <input id="inputFat" type="number" inputMode="numeric" placeholder="0" min="0" max="400" value={draft.fat} onChange={(e) => set('fat', e.target.value)} /></div>
            <div>
              <span className="mb-1.5 block text-[13px] font-medium text-ink-2">Screenshot</span>
              <div
                className={cn(
                  'flex h-11 cursor-pointer items-center justify-center gap-2 rounded-[10px] border border-dashed text-xs transition-colors',
                  dragging ? 'border-ink bg-ink/5 text-ink' : 'border-line-strong text-ink-3 hover:border-ink hover:text-ink',
                )}
                role="button"
                tabIndex={0}
                aria-label="Add today's HealthifyMe screenshot"
                onClick={() => fileRef.current?.click()}
                onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && fileRef.current?.click()}
                onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
                onDragLeave={() => setDragging(false)}
                onDrop={onDrop}
              >
                <ImagePlus className="size-4" aria-hidden="true" /> {image ? 'Replace' : 'Add'}
              </div>
              <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={(e) => readFile(e.target.files?.[0])} />
            </div>
          </div>
          {image && (
            <img src={image} alt="Today's HealthifyMe screenshot" className="mt-3 max-h-48 w-full rounded-[10px] border border-line object-contain" />
          )}
          <div className="mt-5 border-t border-line pt-4">
            <div className="flex items-end justify-between gap-3">
              <div>
                <div className="font-mono text-[10px] tracking-[0.08em] text-ink-3 uppercase">Total</div>
                <div className={cn('font-mono text-[28px] leading-tight font-medium tabular-nums',
                  tone === 'over' ? 'text-primary' : tone === 'near' ? 'text-warning' : tone === 'under' ? 'text-success' : 'text-ink')}>
                  {total.toLocaleString('en-US')}
                </div>
              </div>
              <div className="text-right text-xs text-ink-3">
                {target === null || remaining === null ? (
                  <>No calorie target. <JumpLink to="goals">Set one</JumpLink></>
                ) : (
                  <>
                    <div>Target {target.toLocaleString('en-US')} kcal</div>
                    <div className={cn('mt-0.5 font-mono tabular-nums', remaining < 0 ? 'text-primary' : 'text-ink-2')}>
                      {remaining >= 0 ? `${remaining.toLocaleString('en-US')} left` : `${Math.abs(remaining).toLocaleString('en-US')} over`}
                    </div>
                  </>
                )}
              </div>
            </div>
            <div className="pbar mt-3" role="img" aria-label={target ? `${Math.round((total / target) * 100)} percent of the calorie target` : 'No calorie target'}>
              <div className="pfill" style={{ width: `${target === null ? 0 : Math.min(100, (total / target) * 100)}%`, background: tone === 'over' ? 'var(--red)' : undefined }} />
            </div>
          </div>
        </Panel>
      </Reveal>

      {form.loadError && (
        <div className="notice notice-warn mt-0" role="alert">
          Today's saved entry could not be loaded ({form.loadError}). Saving is off so it is not overwritten with blanks. Reload to try again.
        </div>
      )}

      <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
        <span className="glass glass-text glass-text-sm font-mono text-[11px] tracking-[0.06em] text-ink-3 uppercase">{dirty ? 'Unsaved changes' : form.loading ? 'Loading today' : 'All saved'}</span>
        <Button variant="primary" size="lg" disabled={!canSave} onClick={onSave} className="min-w-40">
          {saving ? 'Saving' : 'Save today'}
        </Button>
      </div>

      {/* a floating save bar while there are changes and the inline button is out of view */}
      <AnimatePresence>
        {dirty && canSave && (
          <motion.div
            className="pointer-events-none fixed inset-x-0 bottom-[calc(env(safe-area-inset-bottom)+76px)] z-30 flex justify-center px-4 lg:bottom-6 lg:pl-[var(--rail-w)]"
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 12 }}
            transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
          >
            <div className="pointer-events-auto flex items-center gap-4 rounded-full border border-line bg-surface/95 py-1.5 pr-1.5 pl-5 shadow-[0_10px_30px_rgb(31_19_0/0.14)] backdrop-blur">
              <span className="flex items-center gap-2 text-[13px] text-ink-2"><span className="size-1.5 rounded-full bg-primary" aria-hidden="true" />Unsaved changes</span>
              <Button variant="primary" size="sm" className="rounded-full px-4" onClick={onSave} disabled={saving}>{saving ? 'Saving' : 'Save today'}</Button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
