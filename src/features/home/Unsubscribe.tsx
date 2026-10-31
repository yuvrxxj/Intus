import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Header } from './Home.tsx';
import { ErrorNotice } from './WaitlistSection.tsx';
import { submitUnsubscribe } from './waitlistApi.ts';
import { WAITLIST, unsubscribeParamsFrom, type UnsubscribeResult } from './waitlist.ts';

type Phase = 'checking' | UnsubscribeResult;

/**
 * `/waitlist/unsubscribe?id=...&t=...`, the link at the bottom of the place-ready and launch emails (INT-163). Opening
 * it unsubscribes; opening it again says the same thing. A malformed link is refused here without a request.
 */
export function Unsubscribe() {
  const [params] = useState(() => unsubscribeParamsFrom(window.location.search));
  const [phase, setPhase] = useState<Phase>(params ? 'checking' : 'invalid');
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    if (!params) return;
    let cancelled = false;
    setPhase('checking');
    submitUnsubscribe(params.id, params.t).then((result) => {
      if (!cancelled) setPhase(result);
    });
    return () => { cancelled = true; };
  }, [params, attempt]);

  return (
    <div className="relative z-10 min-h-dvh">
      <Header quiet />
      <main className="mx-auto w-full max-w-[560px] px-4 py-10 sm:py-14">
        {phase === 'checking' && <p className="font-mono text-xs tracking-[0.06em] text-ink-3 uppercase">{WAITLIST.unsubscribeChecking}</p>}
        {phase === 'unsubscribed' && (
          <div className="rounded-[10px] bg-surface-3 px-5 py-5" role="status">
            <p className="font-mono text-[11px] tracking-[0.08em] text-ink-2 uppercase">{WAITLIST.unsubscribeKicker}</p>
            <h1 className="mt-3 text-[22px] leading-tight font-semibold tracking-[-0.01em] text-ink">{WAITLIST.unsubscribed}</h1>
            <p className="mt-4">
              <a href={WAITLIST.confirmedLink} className="text-sm text-primary underline">{WAITLIST.sentBack}</a>
            </p>
          </div>
        )}
        {phase === 'invalid' && <ErrorNotice>{WAITLIST.unsubscribeInvalid}</ErrorNotice>}
        {phase === 'error' && (
          <ErrorNotice>
            {WAITLIST.unsubscribeError}
            <Button type="button" variant="secondary" size="md" className="mt-4" onClick={() => setAttempt((n) => n + 1)}>{WAITLIST.unsubscribeRetry}</Button>
          </ErrorNotice>
        )}
      </main>
    </div>
  );
}
