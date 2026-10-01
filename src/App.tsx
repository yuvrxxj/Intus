import { Suspense, lazy, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { PROFILE_LINE } from './config.ts';
import { supabase } from './db/client.ts';
import { SignIn } from './features/auth/SignIn.tsx';
import { useSession } from './features/auth/useSession.ts';
import { Bloodwork } from './features/bloodwork/Bloodwork.tsx';
import { History } from './features/history/History.tsx';
import { Meds } from './features/meds/Meds.tsx';
import { ParacetamolAlert } from './features/meds/ParacetamolAlert.tsx';
import { useMedications } from './features/meds/useMedications.ts';
import { Screening } from './features/screening/Screening.tsx';
import { Overview } from './features/today/Overview.tsx';
import { programmeBlock, programmeWeek, weightStats } from './features/today/stats.ts';
import { Today } from './features/today/Today.tsx';
import { useRecentLogs } from './features/today/useRecentLogs.ts';
import { useToday } from './features/today/useToday.ts';
import { FxLayer } from './fx/FxLayer.tsx';
import { paracetamolDailyTotal, type ParacetamolTotal } from './lib/drugChecks.ts';
import { emojiBurst, reducedMotion } from './fx/engine.ts';
import { sfx } from './fx/sound.ts';
import { clockParts, shortDate, todayKey } from './util/dates.ts';

// Chart.js is the heaviest dependency and only the Progress tab needs it, so it loads on first visit to that tab.
const Progress = lazy(() => import('./features/progress/Progress.tsx').then((m) => ({ default: m.Progress })));

type TabId = 'today' | 'progress' | 'history' | 'bloodwork' | 'screening' | 'meds';

const TABS: { id: TabId; label: string; short: string; icon: string }[] = [
  { id: 'today', label: 'Today', short: 'Today', icon: '📋' },
  { id: 'progress', label: 'Progress', short: 'Progress', icon: '📈' },
  { id: 'history', label: 'History', short: 'History', icon: '📅' },
  { id: 'bloodwork', label: 'Bloodwork', short: 'Blood', icon: '🩸' },
  { id: 'screening', label: 'Screening', short: 'Screen', icon: '🔎' },
  { id: 'meds', label: 'Meds', short: 'Meds', icon: '💊' },
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
  const medications = useMedications();
  const form = useToday(recent.reload);
  const stats = weightStats(recent.logs);
  const week = programmeWeek(today);
  const clock = clockParts(now);
  const titleRef = useRef<HTMLHeadingElement>(null);

  // Worked out here, above the tabs, so a risky total shows on every screen and not only on Meds.
  const paracetamol = useMemo<{ total: ParacetamolTotal | null; unavailable: string | null }>(() => {
    if (medications.loading) return { total: null, unavailable: null };
    if (medications.error) return { total: null, unavailable: `Medications could not be loaded (${medications.error}).` };
    try {
      return { total: paracetamolDailyTotal(medications.meds, { today }), unavailable: null };
    } catch (e) {
      return { total: null, unavailable: `Today's total could not be worked out (${e instanceof Error ? e.message : String(e)}).` };
    }
  }, [medications.loading, medications.error, medications.meds, today]);

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
            <div className="badge">Week {week} · Block {programmeBlock(week)} · Cut</div>
            <h1 ref={titleRef} onClick={titleClicked}>Yuvraaj's Health OS</h1>
            <div className="sub">{PROFILE_LINE}</div>
          </div>
          <div className="date-chip">
            <div className="d">{clock.date}</div>
            <div className="t">{clock.time}</div>
            <button type="button" className="signout" onClick={() => void supabase.auth.signOut()}>Sign out</button>
          </div>
        </div>

        <Overview stats={stats} draft={form.draft} today={today} />

        <ParacetamolAlert total={paracetamol.total} unavailable={paracetamol.unavailable} onOpen={() => chooseTab('meds')} />

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
            <Today form={form} notify={notify} lastWeightDate={stats.latest ? shortDate(stats.latest.date) : null} />
          )}
          {tab === 'progress' && (
            <Suspense fallback={<div className="loading">Loading</div>}>
              <Progress logs={recent.logs} />
            </Suspense>
          )}
          {tab === 'history' && <History logs={recent.logs} loading={recent.loading} error={recent.error} />}
          {tab === 'bloodwork' && <Bloodwork />}
          {tab === 'screening' && <Screening today={today} notify={notify} />}
          {tab === 'meds' && <Meds state={medications} today={today} notify={notify} />}
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

export function App() {
  const session = useSession();
  return (
    <>
      {session.status === 'signed_in' && <Dashboard />}
      {session.status === 'signed_out' && <SignIn />}
      <FxLayer />
    </>
  );
}
