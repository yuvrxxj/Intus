import { Suspense, lazy, useEffect, useState, type ReactNode } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import { RIBS_COLS, RIBS_ROWS, RIBS_SOLID, RIBS_SUB, RIBS_TEXT } from '@/components/art/ribs';
import { AsciiArt } from '@/components/ui/ascii-art';
import { AsciiPicture } from '@/components/ui/ascii-picture';
import { cn } from '@/lib/utils';
import { supabase } from '../../db/client.ts';
import { CONTACT_EMAIL } from '../../lib/contact.ts';
import { DIRECTION_LABEL } from '../../lib/programme.ts';
import { clockParts, shortDate, todayKey } from '../../util/dates.ts';
import { Account } from '../account/Account.tsx';
import { Bloodwork } from '../bloodwork/Bloodwork.tsx';
import { Goals } from '../goals/Goals.tsx';
import { useHabits } from '../habits/HabitsContext.tsx';
import { useProfile } from '../profile/ProfileContext.tsx';
import { profileLine } from '../profile/profileLine.ts';
import { Sleep } from '../sleep/Sleep.tsx';
import { SleepSnapshot } from '../sleep/SleepSnapshot.tsx';
import { Strength } from '../strength/Strength.tsx';
import { Supplements } from '../supplements/Supplements.tsx';
import { Nutrition } from '../today/Nutrition.tsx';
import { Overview } from '../today/Overview.tsx';
import { programmeWeek, weightStats } from '../today/stats.ts';
import { Today } from '../today/Today.tsx';
import { useRecentLogs } from '../today/useRecentLogs.ts';
import { useToday } from '../today/useToday.ts';
import { PageHeader } from './PageHeader.tsx';
import { pageMeta } from './pages.ts';
import { Toast, useToast } from './Toast.tsx';
import { TopNav } from './TopNav.tsx';
import { usePage } from './usePage.ts';

// Chart.js is the heaviest dependency and only Progress needs it, so it loads when that page is opened.
const Progress = lazy(() => import('../progress/Progress.tsx').then((m) => ({ default: m.Progress })));

function useClock(): Date {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const id = window.setInterval(() => setNow(new Date()), 30_000);
    return () => window.clearInterval(id);
  }, []);
  return now;
}

function greeting(now: Date): string {
  const h = now.getHours();
  return h < 5 ? 'Good evening' : h < 12 ? 'Good morning' : h < 18 ? 'Good afternoon' : 'Good evening';
}

/** A titled block inside a page that holds more than one thing, such as Today with its sleep and nutrition. */
function Part({ id, title, blurb, children }: { id: string; title: string; blurb: string; children: ReactNode }) {
  return (
    <section aria-labelledby={`${id}-title`} className="mt-14 border-t border-line-strong pt-6">
      <div className="on-dots mb-6">
        <h2 id={`${id}-title`} className="font-mono text-[11px] tracking-[0.08em] text-ink-3 uppercase">{title}</h2>
        <p className="mt-1.5 max-w-xl text-sm text-ink-2">{blurb}</p>
      </div>
      {children}
    </section>
  );
}

/** The ribs down the left edge of the dashboard, bleeding off the bottom corner. They belong to this page only. */
function RibsRail() {
  return (
    <div
      aria-hidden="true"
      className="pointer-events-none fixed bottom-0 left-0 z-0 hidden w-[calc(var(--rail-w)-12px)] lg:block [@media(max-height:640px)]:hidden"
      style={{ height: 'min(calc(100dvh - 7rem), calc((var(--rail-w) - 12px) * 740 / 336))' }}
    >
      <AsciiPicture
        text={RIBS_TEXT}
        solid={RIBS_SOLID}
        cols={RIBS_COLS}
        rows={RIBS_ROWS}
        sub={RIBS_SUB}
        style={{ height: '100%' }}
        className="absolute bottom-0 left-0 w-full animate-[rail-art-in_1.2s_var(--ease-out-quint)_both] [mask-image:linear-gradient(to_bottom,transparent,black_22%)]"
      />
    </div>
  );
}

/** The whole signed-in app: a bar across the top, one page at a time under it, and a quiet toast. */
export function Dashboard() {
  const now = useClock();
  const today = todayKey(now);
  const clock = clockParts(now);
  const reduced = useReducedMotion();
  const { toast, notify } = useToast();
  const [page, go] = usePage();
  const recent = useRecentLogs(40);
  const habits = useHabits();
  const form = useToday(recent.reload, habits.habits);
  const { profile, programme } = useProfile();
  const stats = weightStats(recent.logs, programme);
  const week = programme ? programmeWeek(programme, today) : null;
  const recentWeights = recent.logs.flatMap((l) => (typeof l.weight === 'number' && l.weight > 0 ? [l.weight] : [])).slice(0, 14).reverse();
  const name = profile?.name?.trim();
  const signOut = () => void supabase.auth.signOut();
  const meta = pageMeta(page);

  return (
    <div className="relative z-10 w-full px-5 sm:px-8 lg:px-10 2xl:px-16">
      {page === 'dashboard' && <RibsRail />}
      <TopNav page={page} onGo={go} onSignOut={signOut} clock={clock} />

      <main className={cn('relative z-10 mx-auto min-w-0 max-w-[1640px] pb-24', page === 'dashboard' && 'lg:pl-[calc(var(--rail-w)-40px)]')}>
        {page === 'dashboard' ? (
          <>
            <header className="on-dots flex items-end justify-between gap-6 pt-8 pb-10 lg:pt-12">
              <motion.div
                className="min-w-0"
                initial={reduced ? false : { opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
              >
                <div className="font-mono text-[11px] tracking-[0.08em] text-primary uppercase">
                  {programme ? `Week ${week} of ${programme.weeks} / ${DIRECTION_LABEL[programme.direction]}` : 'No goal set yet'}
                </div>
                <h1 id="dashboard-title" className="mt-3 text-[36px] leading-[1.05] font-semibold tracking-[-0.03em] sm:text-[48px]">
                  {greeting(now)}{name ? `, ${name}` : ''}.
                </h1>
                <p className="mt-3 font-mono text-xs text-ink-2 tabular-nums">{profileLine(profile, programme)}</p>
                <p className="mt-1 font-mono text-xs text-ink-3 tabular-nums xl:hidden">{clock.date} / {clock.time}</p>
              </motion.div>
              <AsciiArt shape={meta.art} cols={40} rows={20} label="A heart drawn in characters, turning slowly" className="on-dots hidden shrink-0 text-[9px] text-primary md:block xl:text-[10px]" />
            </header>
            <div className="grid gap-4 pb-8">
              <Overview stats={stats} draft={form.draft} today={today} onJump={go} />
              <SleepSnapshot today={today} onOpen={() => go('today')} />
            </div>
          </>
        ) : (
          <PageHeader meta={meta} />
        )}

        {page === 'today' && (
          <>
            <Today form={form} today={today} notify={notify} lastWeightDate={stats.latest ? shortDate(stats.latest.date) : null} recentWeights={recentWeights} />
            <Part id="nutrition" title="Nutrition targets" blurb="How today compares with your calorie and protein targets, and where those targets come from.">
              <Nutrition draft={form.draft} today={today} latestWeightKg={stats.latest?.weight ?? null} />
            </Part>
            <Part id="strength" title="Strength" blurb="Sets and reps, saved as you log them.">
              <Strength notify={notify} />
            </Part>
            <Part id="sleep" title="Sleep" blurb="When you slept and for how long, with the rule behind every number.">
              <Sleep today={today} notify={notify} />
            </Part>
          </>
        )}
        {page === 'goals' && <Goals today={today} latestWeightKg={stats.latest?.weight ?? null} notify={notify} />}
        {page === 'bloodwork' && <Bloodwork today={today} notify={notify} />}
        {page === 'supplements' && <Supplements today={today} notify={notify} />}
        {page === 'progress' && (
          <Suspense fallback={<div className="loading">Loading charts</div>}>
            <Progress logs={recent.logs} today={today} />
          </Suspense>
        )}
        {page === 'account' && <Account onSignOut={signOut} />}

        <footer className="on-dots mt-16 flex flex-wrap items-center justify-between gap-3 border-t border-line-strong pt-6 font-mono text-[11px] tracking-[0.06em] text-ink-3 uppercase">
          <span>Intus</span>
          <span>Not medical advice. Ranges are flagged, never diagnosed.</span>
          <a href={`mailto:${CONTACT_EMAIL}`} className="normal-case hover:text-ink">{CONTACT_EMAIL}</a>
        </footer>
      </main>

      <Toast toast={toast} />
    </div>
  );
}

