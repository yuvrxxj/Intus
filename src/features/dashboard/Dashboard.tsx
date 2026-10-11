import { Suspense, lazy, useEffect, useState } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import { AsciiArt } from '@/components/ui/ascii-art';
import { supabase } from '../../db/client.ts';
import { CONTACT_EMAIL } from '../../lib/contact.ts';
import { DIRECTION_LABEL } from '../../lib/programme.ts';
import { clockParts, shortDate, todayKey } from '../../util/dates.ts';
import { Account } from '../account/Account.tsx';
import { Bloodwork } from '../bloodwork/Bloodwork.tsx';
import { Goals } from '../goals/Goals.tsx';
import { useHabits } from '../habits/HabitsContext.tsx';
import { History } from '../history/History.tsx';
import { useProfile } from '../profile/ProfileContext.tsx';
import { profileLine } from '../profile/profileLine.ts';
import { Screening } from '../screening/Screening.tsx';
import { Supplements } from '../supplements/Supplements.tsx';
import { Overview } from '../today/Overview.tsx';
import { programmeWeek, weightStats } from '../today/stats.ts';
import { Today } from '../today/Today.tsx';
import { useRecentLogs } from '../today/useRecentLogs.ts';
import { useToday } from '../today/useToday.ts';
import { MobileNav, SectionRail } from './Navigation.tsx';
import { Section, WhenNear } from './Section.tsx';
import { SECTIONS, type SectionId } from './sections.ts';
import { Toast, useToast } from './Toast.tsx';
import { useScrollSpy } from './useScrollSpy.ts';

// Chart.js is the heaviest dependency and only Progress needs it, so it loads as that section comes near.
const Progress = lazy(() => import('../progress/Progress.tsx').then((m) => ({ default: m.Progress })));

const meta = (id: SectionId) => SECTIONS.find((s) => s.id === id)!;

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

/** The whole signed-in app: one page of numbered sections, an index to move between them, and a quiet toast. */
export function Dashboard() {
  const now = useClock();
  const today = todayKey(now);
  const clock = clockParts(now);
  const reduced = useReducedMotion();
  const { toast, notify } = useToast();
  const [active, jump] = useScrollSpy();
  const recent = useRecentLogs(40);
  const habits = useHabits();
  const form = useToday(recent.reload, habits.habits);
  const { profile, programme, reload: reloadProfile } = useProfile();
  const stats = weightStats(recent.logs, programme);
  const week = programme ? programmeWeek(programme, today) : null;
  const recentWeights = recent.logs.flatMap((l) => (typeof l.weight === 'number' && l.weight > 0 ? [l.weight] : [])).slice(0, 14).reverse();
  const name = profile?.name?.trim();
  const signOut = () => void supabase.auth.signOut();

  return (
    <div className="relative z-10 w-full px-5 sm:px-8 lg:pr-10 lg:pl-[var(--rail-w)] 2xl:pr-16">
      <SectionRail active={active} onJump={jump} onSignOut={signOut} clock={clock} />

      <main className="mx-auto min-w-0 max-w-[1640px] pb-32 lg:pb-24">
        <MobileNav active={active} onJump={jump} onSignOut={signOut} />

        <header className="on-dots flex items-end justify-between gap-6 pt-8 pb-10 lg:pt-14">
          <motion.div
            className="min-w-0"
            initial={reduced ? false : { opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
          >
            <div className="font-mono text-[11px] tracking-[0.08em] text-primary uppercase">
              {programme ? `Week ${week} of ${programme.weeks} / ${DIRECTION_LABEL[programme.direction]}` : 'No goal set yet'}
            </div>
            <h1 className="mt-3 text-[36px] leading-[1.05] font-semibold tracking-[-0.03em] sm:text-[48px]">
              {greeting(now)}{name ? `, ${name}` : ''}.
            </h1>
            <p className="mt-3 font-mono text-xs text-ink-2 tabular-nums">{profileLine(profile, programme)}</p>
            <p className="mt-1 font-mono text-xs text-ink-3 tabular-nums lg:hidden">{clock.date} / {clock.time}</p>
          </motion.div>
          <AsciiArt shape="heart" cols={40} rows={20} label="A heart drawn in characters, turning slowly" className="on-dots hidden shrink-0 text-[9px] text-primary md:block xl:text-[10px]" />
        </header>

        <div className="pb-16">
          <Overview stats={stats} draft={form.draft} today={today} onJump={jump} />
        </div>

        <Section meta={meta('today')}>
          <Today form={form} today={today} notify={notify} lastWeightDate={stats.latest ? shortDate(stats.latest.date) : null} recentWeights={recentWeights} />
        </Section>

        <Section meta={meta('progress')}>
          <WhenNear minHeight={1100} fallback={<div className="loading">Loading charts</div>}>
            <Suspense fallback={<div className="loading">Loading charts</div>}>
              <Progress logs={recent.logs} />
            </Suspense>
          </WhenNear>
        </Section>

        <Section meta={meta('goals')}>
          <Goals today={today} latestWeightKg={stats.latest?.weight ?? null} notify={notify} />
        </Section>

        <Section meta={meta('bloodwork')}>
          <Bloodwork today={today} notify={notify} />
        </Section>

        <Section meta={meta('supplements')}>
          <Supplements today={today} notify={notify} />
        </Section>

        <Section meta={meta('screening')}>
          <Screening today={today} notify={notify} onProfileSaved={reloadProfile} />
        </Section>

        <Section meta={meta('history')}>
          <History logs={recent.logs} loading={recent.loading} error={recent.error} />
        </Section>

        <Section meta={meta('account')}>
          <Account onSignOut={signOut} />
        </Section>

        <footer className="on-dots flex flex-wrap items-center justify-between gap-3 border-t border-line-strong pt-6 font-mono text-[11px] tracking-[0.06em] text-ink-3 uppercase">
          <span>Intus</span>
          <span>Not medical advice. Ranges are flagged, never diagnosed.</span>
          <a href={`mailto:${CONTACT_EMAIL}`} className="normal-case hover:text-ink">{CONTACT_EMAIL}</a>
        </footer>
      </main>

      <Toast toast={toast} />
    </div>
  );
}
