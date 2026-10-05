import { Suspense, lazy, useCallback, useEffect, useRef, useState } from 'react';
import { supabase } from './db/client.ts';
import { SignIn } from './features/auth/SignIn.tsx';
import { useSession } from './features/auth/useSession.ts';
import { Bloodwork } from './features/bloodwork/Bloodwork.tsx';
import { Goals } from './features/goals/Goals.tsx';
import { Onboarding } from './features/onboarding/Onboarding.tsx';
import { needsOnboarding } from './features/onboarding/model.ts';
import { HabitsProvider, useHabits } from './features/habits/HabitsContext.tsx';
import { History } from './features/history/History.tsx';
import { ProfileProvider, useProfile } from './features/profile/ProfileContext.tsx';
import { profileLine, titleFor } from './features/profile/profileLine.ts';
import { Screening } from './features/screening/Screening.tsx';
import { Supplements } from './features/supplements/Supplements.tsx';
import { Overview } from './features/today/Overview.tsx';
import { programmeWeek, weightStats } from './features/today/stats.ts';
import { Today } from './features/today/Today.tsx';
import { useRecentLogs } from './features/today/useRecentLogs.ts';
import { useToday } from './features/today/useToday.ts';
import { FxLayer } from './fx/FxLayer.tsx';
import { DIRECTION_LABEL } from './lib/programme.ts';
import { emojiBurst, reducedMotion } from './fx/engine.ts';
import { sfx } from './fx/sound.ts';
import { clockParts, shortDate, todayKey } from './util/dates.ts';

// Chart.js is the heaviest dependency and only the Progress tab needs it, so it loads on first visit to that tab.
const Progress = lazy(() => import('./features/progress/Progress.tsx').then((m) => ({ default: m.Progress })));

type TabId = 'today' | 'progress' | 'goals' | 'history' | 'bloodwork' | 'screening' | 'supplements';

const TABS: { id: TabId; label: string; short: string; icon: string }[] = [
  { id: 'today', label: 'Today', short: 'Today', icon: '📋' },
  { id: 'progress', label: 'Progress', short: 'Charts', icon: '📈' },
  { id: 'goals', label: 'Goals', short: 'Goals', icon: '🎯' },
  { id: 'history', label: 'History', short: 'History', icon: '📅' },
  { id: 'bloodwork', label: 'Bloodwork', short: 'Blood', icon: '🩸' },
  { id: 'screening', label: 'Screening', short: 'Screen', icon: '🔎' },
  { id: 'supplements', label: 'Supplements', short: 'Supps', icon: '💊' },
];

const PUNS = [
  'Keep your heart in it 🫀',
  'Hydrate or diedrate 💧',
  'You miss 100% of the lifts you skip 🏋️',
  'Abs are made in the kitchen 🍳',
  'Rest is part of the program 😴',
  'Creatinine called, drink water 💧',
];

function tabFromHash(): TabId {
  const id = window.location.hash.slice(1);
  return TABS.some((t) => t.id === id) ? (id as TabId) : 'today';
}

function useTab(): [TabId, (tab: TabId) => void] {
  const [tab, setTab] = useState<TabId>(tabFromHash);
  useEffect(() => {
    const onHash = () => setTab(tabFromHash());
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  }, []);
  const choose = useCallback((next: TabId) => {
    window.location.hash = next;
    window.scrollTo({ top: 0, behavior: reducedMotion() ? 'auto' : 'smooth' });
  }, []);
  return [tab, choose];
}

function useClock(): Date {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const id = window.setInterval(() => setNow(new Date()), 30_000);
    return () => window.clearInterval(id);
  }, []);
  return now;
}

function useToast(): { toast: { message: string; error: boolean; show: boolean }; notify: (m: string, error?: boolean) => void } {
  const [toast, setToast] = useState({ message: '', error: false, show: false });
  const timer = useRef<number | undefined>(undefined);
  const notify = useCallback((message: string, error = false) => {
    setToast({ message, error, show: true });
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => setToast((t) => ({ ...t, show: false })), 2500);
  }, []);
  return { toast, notify };
}

function Dashboard() {
  const [tab, chooseTab] = useTab();
  const now = useClock();
  const today = todayKey(now);
  const { toast, notify } = useToast();
  const recent = useRecentLogs(40);
  const habits = useHabits();
  const form = useToday(recent.reload, habits.habits);
  const { profile, programme, reload: reloadProfile } = useProfile();
  const stats = weightStats(recent.logs, programme);
  const week = programme ? programmeWeek(programme, today) : null;
  const clock = clockParts(now);
  const titleRef = useRef<HTMLHeadingElement>(null);

  function titleClicked() {
    const el = titleRef.current;
    if (!el) return;
    if (!reducedMotion()) {
      el.style.animation = 'none';
      void el.offsetWidth;
      el.style.animation = 'heartbeat .6s ease';
    }
    const r = el.getBoundingClientRect();
    emojiBurst(r.left + r.width / 2, r.top + 4, '❤️', 6);
    notify(PUNS[Math.floor(Math.random() * PUNS.length)]);
    sfx.ding();
  }

  return (
    <div id="app">
      <div className="app-inner">
        <div className="hdr anim-1">
          <div className="hdr-left">
            <div className="badge">
              {programme ? `Week ${week} of ${programme.weeks} · ${DIRECTION_LABEL[programme.direction]}` : 'No goal set yet'}
            </div>
            <h1 ref={titleRef} onClick={titleClicked}>{titleFor(profile)}</h1>
            <div className="sub">{profileLine(profile, programme)}</div>
          </div>
          <div className="date-chip">
            <div className="d">{clock.date}</div>
            <div className="t">{clock.time}</div>
            <button type="button" className="signout" onClick={() => void supabase.auth.signOut()}>Sign out</button>
          </div>
        </div>

        <Overview stats={stats} draft={form.draft} today={today} />

        <div className="tabs anim-5" role="tablist">
          {TABS.map((t) => (
            <button key={t.id} type="button" role="tab" aria-selected={tab === t.id}
              className={`tab${tab === t.id ? ' on' : ''}`} onClick={() => chooseTab(t.id)}>
              {t.label}
            </button>
          ))}
        </div>

        <div className="panel" key={tab} role="tabpanel">
          {tab === 'today' && (
            <Today form={form} today={today} notify={notify} lastWeightDate={stats.latest ? shortDate(stats.latest.date) : null} />
          )}
          {tab === 'progress' && (
            <Suspense fallback={<div className="loading">Loading</div>}>
              <Progress logs={recent.logs} />
            </Suspense>
          )}
          {tab === 'goals' && <Goals today={today} latestWeightKg={stats.latest?.weight ?? null} notify={notify} />}
          {tab === 'history' && <History logs={recent.logs} loading={recent.loading} error={recent.error} />}
          {tab === 'bloodwork' && <Bloodwork today={today} notify={notify} />}
          {tab === 'screening' && <Screening today={today} notify={notify} onProfileSaved={reloadProfile} />}
          {tab === 'supplements' && <Supplements today={today} notify={notify} />}
        </div>
      </div>

      <nav className="bottom-nav" aria-label="Sections">
        <div className="bn-inner">
          {TABS.map((t) => (
            <button key={t.id} type="button" className={`bn-tab${tab === t.id ? ' on' : ''}`}
              aria-current={tab === t.id ? 'page' : undefined} onClick={() => chooseTab(t.id)}>
              <div className="bn-icon" aria-hidden="true">{t.icon}</div>
              {t.short}
            </button>
          ))}
        </div>
      </nav>

      <div className={`toast${toast.error ? ' err' : ''}${toast.show ? ' show' : ''}`} role="status">{toast.message}</div>
    </div>
  );
}

/** New accounts answer the first-run questions before seeing the dashboard. Anyone can skip them for now. */
function Gate() {
  const { status, profile } = useProfile();
  const [skipped, setSkipped] = useState(false);
  if (status === 'loading') return <div className="boot"><div className="loading">Loading</div></div>;
  if (status === 'ready' && needsOnboarding(profile) && !skipped) return <Onboarding onSkip={() => setSkipped(true)} />;
  return <Dashboard />;
}

export function App() {
  const session = useSession();
  return (
    <>
      {session.status === 'signed_in' && (
        <ProfileProvider>
          <HabitsProvider>
            <Gate />
          </HabitsProvider>
        </ProfileProvider>
      )}
      {session.status === 'signed_out' && <SignIn />}
      <FxLayer />
    </>
  );
}
