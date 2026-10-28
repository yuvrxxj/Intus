import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Link } from './Link.tsx';
import { CONFIRMED_PATH, HOME_PATH } from './route.ts';
import { WaitlistForm } from './WaitlistSection.tsx';
import { submitConfirm } from './waitlistApi.ts';
import { WAITLIST, confirmTokenFrom, type ConfirmOutcome } from './waitlist.ts';

type Phase = 'checking' | ConfirmOutcome;

const JUST_CONFIRMED = 'intus.waitlist.confirmed';

/**
 * `/waitlist/confirmed`. A live token confirms the row and shows the on-the-list notice. An expired or already used
 * token shows the expired line and the form, so the person can ask for a new link. No email is sent from here.
 */
export function ConfirmWaitlist() {
  const [token] = useState(() => confirmTokenFrom(window.location.search));
  const [phase, setPhase] = useState<Phase>(() => {
    if (token) return 'checking';
    try {
      return sessionStorage.getItem(JUST_CONFIRMED) === '1' ? 'confirmed' : 'expired';
    } catch {
      return 'expired';
    }
  });
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    if (!token) return;
    let cancelled = false;
    setPhase('checking');
    submitConfirm(token).then((result) => {
      if (cancelled) return;
      try {
        if (result === 'confirmed') sessionStorage.setItem(JUST_CONFIRMED, '1');
        else sessionStorage.removeItem(JUST_CONFIRMED);
      } catch { /* a private window can refuse storage; the page still shows the result */ }
      window.history.replaceState(null, '', CONFIRMED_PATH);
      setPhase(result);
    });
    return () => { cancelled = true; };
  }, [token, attempt]);

  return (
    <div className="relative z-10 min-h-dvh bg-paper text-ink">
      <main className="mx-auto w-full max-w-2xl px-5 py-12 lg:py-16">
        <Link to={HOME_PATH} className="font-mono text-[11px] tracking-[0.08em] text-primary uppercase">Intus</Link>
        {phase === 'checking' && <p className="mt-8 font-mono text-xs tracking-[0.06em] text-ink-3 uppercase">{WAITLIST.confirmChecking}</p>}
        {phase === 'confirmed' && (
          <div className="notice notice-ok mt-8" role="status">
            <div className="font-mono text-[11px] tracking-[0.08em] uppercase">{WAITLIST.confirmedKicker}</div>
            <p className="mt-3 text-[15px] leading-relaxed font-normal text-ink">{WAITLIST.confirmedBody}</p>
          </div>
        )}
        {phase === 'confirmed' && (
          <p className="mt-8">
            <a href="https://intus.fit" className="text-sm text-primary underline">{WAITLIST.confirmedLink}</a>
          </p>
        )}
        {phase === 'expired' && (
          <>
            <p className="mt-8 text-[15px] leading-relaxed font-normal text-ink" role="status">{WAITLIST.expiredBody}</p>
            <WaitlistForm className="mt-8" />
          </>
        )}
        {phase === 'error' && (
          <div className="notice notice-bad mt-8" role="status">
            <p className="text-[15px] leading-relaxed font-normal text-ink">{WAITLIST.confirmError}</p>
            <Button type="button" variant="secondary" size="md" className="mt-4" onClick={() => setAttempt((n) => n + 1)}>
              {WAITLIST.confirmRetry}
            </Button>
          </div>
        )}
      </main>
    </div>
  );
}
