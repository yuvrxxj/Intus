import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Link } from './Link.tsx';
import { CONFIRM_PATH, HOME_PATH } from './route.ts';
import { submitConfirm } from './waitlistApi.ts';
import { WAITLIST, confirmTokenFrom, type ConfirmOutcome } from './waitlist.ts';

type Phase = 'checking' | ConfirmOutcome;

/**
 * Where a confirmation link lands. No email is sent from here. A missing or unknown token, and a token past its
 * expiry, all show the same expired page. The token is taken off the address bar once it has been read.
 */
export function ConfirmWaitlist() {
  const [token] = useState(() => confirmTokenFrom(window.location.search));
  const [phase, setPhase] = useState<Phase>(token ? 'checking' : 'expired');
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    if (window.location.search) window.history.replaceState(null, '', CONFIRM_PATH);
  }, []);

  useEffect(() => {
    if (!token) return;
    let cancelled = false;
    setPhase('checking');
    submitConfirm(token).then((result) => {
      if (!cancelled) setPhase(result);
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
            <h1 className="mt-3 text-[28px] leading-tight font-semibold tracking-[-0.02em] text-ink">{WAITLIST.confirmedTitle}</h1>
            <p className="mt-2 text-[15px] leading-relaxed text-ink">{WAITLIST.confirmedBody}</p>
          </div>
        )}
        {phase === 'expired' && (
          <div className="notice notice-warn mt-8" role="status">
            <div className="font-mono text-[11px] tracking-[0.08em] uppercase">{WAITLIST.expiredKicker}</div>
            <h1 className="mt-3 text-[28px] leading-tight font-semibold tracking-[-0.02em] text-ink">{WAITLIST.expiredTitle}</h1>
            <p className="mt-2 text-[15px] leading-relaxed text-ink">{WAITLIST.expiredBody}</p>
          </div>
        )}
        {phase === 'error' && (
          <div className="notice notice-bad mt-8" role="status">
            <p className="text-[15px] leading-relaxed text-ink">{WAITLIST.confirmError}</p>
            <Button type="button" variant="secondary" size="md" className="mt-4" onClick={() => setAttempt((n) => n + 1)}>
              {WAITLIST.confirmRetry}
            </Button>
          </div>
        )}
        <p className="mt-8">
          <Link to={`${HOME_PATH}#waitlist`} className="text-sm text-primary underline">{WAITLIST.backHome}</Link>
        </p>
      </main>
    </div>
  );
}
