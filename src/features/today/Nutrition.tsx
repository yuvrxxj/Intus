import { useProfile, useProgramme } from '../profile/ProfileContext.tsx';
import { adviceFromGoals, calorieBreakdown } from '../goals/advice.ts';
import { formFromProfile } from '../goals/model.ts';
import type { TodayDraft } from './useToday.ts';

function Meter({ label, value, target, unit }: { label: string; value: number; target: number | null; unit: string }) {
  const pct = target ? Math.min(100, Math.round((value / target) * 100)) : 0;
  return (
    <div className="min-w-0">
      <div className="flex items-baseline justify-between gap-3">
        <span className="font-mono text-[11px] tracking-[0.06em] text-ink-3 uppercase">{label}</span>
        <span className="font-mono text-sm tabular-nums">
          {value.toLocaleString('en-US')}{target ? <span className="text-ink-3"> / {target.toLocaleString('en-US')}</span> : null} {unit}
        </span>
      </div>
      <div className="pbar mt-2" role="img" aria-label={target ? `${pct} percent of the ${label.toLowerCase()} target` : `${label}: no target set`}>
        <div className="pfill" style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

/**
 * Nutrition for the day: calories and protein so far against the targets, and the estimate those targets come from.
 * The totals are what is typed into Log the day above; a meal-by-meal tracker with a food database is the next sprint.
 */
export function Nutrition({ draft, today, latestWeightKg }: { draft: TodayDraft; today: string; latestWeightKg: number | null }) {
  const programme = useProgramme();
  const { profile } = useProfile();
  const calories = parseInt(draft.calories, 10) || 0;
  const protein = parseInt(draft.protein, 10) || 0;
  const advice = profile && programme
    ? adviceFromGoals(formFromProfile(profile), profile, latestWeightKg, today)
    : null;
  return (
    <section className="card sec" aria-labelledby="nutrition-title">
      <div className="ct" id="nutrition-title"><span className="dot dot-green" />Today against your targets</div>
      <div className="grid gap-5 sm:grid-cols-2">
        <Meter label="Calories" value={calories} target={programme?.calorieTarget ?? null} unit="kcal" />
        <Meter label="Protein" value={protein} target={programme?.proteinTarget ?? null} unit="g" />
      </div>
      {advice ? (
        <p className="mt-4 text-xs leading-relaxed text-ink-3">{calorieBreakdown(advice)}</p>
      ) : (
        <p className="mt-4 text-xs leading-relaxed text-ink-3">
          Add your details and a goal under <a href="#goals" className="underline decoration-primary underline-offset-2">Goals and habits</a> to see an estimate of the calories you need.
        </p>
      )}
      <p className="mt-2 text-xs leading-relaxed text-ink-3">
        Totals come from what you enter under Log the day. Food search and meal-by-meal tracking are the next thing being built.
      </p>
    </section>
  );
}
