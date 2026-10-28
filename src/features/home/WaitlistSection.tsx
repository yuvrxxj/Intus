import { useEffect, useRef, useState, type FormEvent, type ReactNode } from 'react';
import { Button } from '@/components/ui/button';
import { Field } from '@/components/ui/field';
import { Reveal } from '@/components/ui/reveal';
import { ScrollHeading } from '@/components/ui/scroll-heading';
import { Segmented } from '@/components/ui/segmented';
import { cn } from '@/lib/utils';
import { currentReferral, rememberReferral } from './referral.ts';
import { submitJoin, submitResend } from './waitlistApi.ts';
import {
  DEVICES,
  WAITLIST,
  checkEmailMessage,
  initialWaitlistState,
  reduceWaitlist,
  resendLabel,
  type Device,
  type WaitlistState,
} from './waitlist.ts';

/** A save error: red kicker, ink sentence, solid tint. Not an all-red paragraph. */
export function ErrorNotice({ children }: { children: ReactNode }) {
  return (
    <div className="mt-3 rounded-[10px] bg-[#F0DFDF] px-4 py-3" role="status">
      <p className="font-mono text-[11px] tracking-[0.08em] text-primary uppercase">Error</p>
      <div className="mt-2 text-[15px] leading-relaxed font-normal text-ink">{children}</div>
    </div>
  );
}

function phoneWidth(): boolean {
  return typeof window !== 'undefined' && window.matchMedia('(max-width: 639px)').matches;
}

/**
 * The waitlist form and its check-your-email state. The homepage section and the expired-link page both use it.
 * TODO(INT-94): country select under the row (INT-110). The confirmation email itself is the Resend pull request.
 */
export function WaitlistForm({ className }: { className?: string }) {
  const [state, setState] = useState<WaitlistState>(() => initialWaitlistState(phoneWidth()));
  const [now, setNow] = useState(() => Date.now());

  // A friend's link (?ref=CODE) is remembered for the visit, so the code is still there if the page is reloaded.
  useEffect(() => { rememberReferral(window.location.search); }, []);
  const emailRef = useRef<HTMLInputElement>(null);
  const checkRef = useRef<HTMLDivElement>(null);
  const returnFocus = useRef(false);
  const phaseRef = useRef(state.phase);
  const busy = state.phase === 'submitting';

  useEffect(() => {
    if (phaseRef.current !== 'check' && state.phase === 'check') checkRef.current?.focus();
    phaseRef.current = state.phase;
  }, [state.phase]);

  useEffect(() => {
    if (!state.resentUntil || state.resentUntil <= Date.now()) return;
    const timer = window.setTimeout(() => setNow(Date.now()), state.resentUntil - Date.now());
    return () => window.clearTimeout(timer);
  }, [state.resentUntil]);

  useEffect(() => {
    if (!returnFocus.current || state.phase !== 'idle') return;
    returnFocus.current = false;
    emailRef.current?.focus();
  }, [state.phase]);

  function dispatch(event: Parameters<typeof reduceWaitlist>[1]) {
    setState((current) => reduceWaitlist(current, event));
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    const next = reduceWaitlist(state, { type: 'submit' });
    setState(next);
    if (next.emailError) {
      emailRef.current?.focus();
      return;
    }
    if (next.phase !== 'submitting') return;
    const outcome = await submitJoin(next, fetch, currentReferral(window.location.search));
    setState((current) => reduceWaitlist(current, { type: 'result', outcome }));
  }

  async function resend() {
    const at = Date.now();
    const next = reduceWaitlist(state, { type: 'resend', now: at });
    setState(next);
    if (!next.resending) return;
    const outcome = await submitResend(next.sentTo ?? next.email);
    setState((current) => reduceWaitlist(current, { type: 'resend-result', outcome, now: Date.now() }));
    setNow(Date.now());
  }

  function changeEmail() {
    returnFocus.current = true;
    dispatch({ type: 'change-email' });
  }

  if (state.phase === 'check' && state.sentTo) {
    const cooled = resendLabel(state.resentUntil, now) === WAITLIST.sentAgain;
    return (
      <div ref={checkRef} tabIndex={-1} className={cn('rounded-[10px] border border-line bg-surface-3 px-5 py-5 outline-none', className)} role="status" aria-live="polite">
        <div className="font-mono text-[11px] tracking-[0.08em] text-ink-2 uppercase">{WAITLIST.checkKicker}</div>
        <p className="mt-3 text-[15px] leading-relaxed font-normal text-ink">{checkEmailMessage(state.sentTo)}</p>
        <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-2">
          <button
            type="button"
            className="text-sm font-medium text-ink underline underline-offset-4 disabled:no-underline disabled:opacity-70"
            onClick={resend}
            disabled={cooled || state.resending}
          >
            {state.resending ? WAITLIST.sendAgain : resendLabel(state.resentUntil, now)}
          </button>
          <button type="button" className="text-sm font-medium text-ink-2 underline underline-offset-4 hover:text-ink" onClick={changeEmail}>
            {WAITLIST.changeEmail}
          </button>
        </div>
        {state.notice && (state.notice.tone === 'warn'
          ? <div className="notice notice-warn" role="status">{state.notice.text}</div>
          : <ErrorNotice>{state.notice.text}</ErrorNotice>)}
      </div>
    );
  }

  if (state.phase === 'listed') {
    return (
      <div className={cn('rounded-[10px] border border-line bg-surface-3 px-5 py-5', className)} role="status">
        <p className="text-[15px] leading-relaxed font-normal text-ink">{WAITLIST.exists}</p>
        <button type="button" className="mt-4 text-sm font-medium text-ink-2 underline underline-offset-4 hover:text-ink" onClick={changeEmail}>
          {WAITLIST.changeEmail}
        </button>
      </div>
    );
  }

  return (
    <form className={cn('@container relative', className)} onSubmit={submit} noValidate>
      <div className="grid gap-4 @min-[840px]:grid-cols-[minmax(0,1.2fr)_minmax(0,1.3fr)_auto] @min-[840px]:items-end">
        <Field id="waitlist-email" label={WAITLIST.emailLabel} error={state.emailError ?? undefined}>
          <input
            ref={emailRef}
            id="waitlist-email"
            name="email"
            type="email"
            inputMode="email"
            autoComplete="email"
            autoCapitalize="none"
            spellCheck={false}
            value={state.email}
            readOnly={busy}
            aria-invalid={state.emailError ? true : undefined}
            onBlur={() => dispatch({ type: 'blur-email' })}
            onChange={(e) => dispatch({ type: 'email', value: e.target.value })}
            className="border-2 border-line-strong focus:border-ink aria-[invalid=true]:border-primary"
          />
        </Field>
        <div className="min-w-0">
          <span id="waitlist-device-label" className="mb-1.5 block text-[13px] font-semibold text-ink-2">{WAITLIST.deviceLabel}</span>
          <Segmented<Device>
            labelledBy="waitlist-device-label"
            size="md"
            disabled={busy}
            value={state.device}
            options={DEVICES}
            onChange={(value) => dispatch({ type: 'device', value })}
          />
        </div>
        <Button type="submit" variant="primary" size="lg" className="w-full disabled:opacity-100 @min-[840px]:w-auto" aria-busy={busy} disabled={busy}>
          {WAITLIST.button}
          {busy && <span className="font-mono motion-safe:animate-pulse" aria-hidden="true">_</span>}
        </Button>
      </div>
      {/* Honeypot: off screen, not display:none, so a person never reaches it and a bot often fills it. */}
      <div className="absolute -left-[10000px] h-px w-px overflow-hidden" aria-hidden="true">
        <label htmlFor="waitlist-company">Company</label>
        <input
          id="waitlist-company"
          name="company"
          type="text"
          tabIndex={-1}
          autoComplete="off"
          value={state.company}
          onChange={(e) => dispatch({ type: 'company', value: e.target.value })}
        />
      </div>
      <p className="mt-3 font-mono text-[13px] leading-relaxed text-ink-3">{WAITLIST.promise}</p>
      <div aria-live="polite">
        {state.notice && (state.notice.tone === 'warn'
          ? <div className="notice notice-warn" role="status">{state.notice.text}</div>
          : <ErrorNotice>{state.notice.text}</ErrorNotice>)}
      </div>
    </form>
  );
}

/** Section 04. On phone widths the homepage pulls this up to sit under the hero; from 640px it stays after Pricing. */
export function WaitlistSection({ className }: { className?: string }) {
  return (
    <section id="waitlist" aria-labelledby="waitlist-title" className={cn('scroll-mt-20 border-t border-line-strong py-14 sm:py-16', className)}>
      <Reveal>
        <div className="on-dots flex items-baseline gap-3">
          <span className="font-mono text-xs text-primary">04</span>
          <span className="font-mono text-[11px] tracking-[0.08em] text-primary uppercase">{WAITLIST.kicker}</span>
        </div>
        <ScrollHeading id="waitlist-title" className="on-dots mt-3 text-[28px] leading-tight font-semibold tracking-[-0.02em] sm:text-[34px]">
          {WAITLIST.title}
        </ScrollHeading>
        <p className="on-dots mt-3 max-w-2xl text-[15px] leading-relaxed font-normal text-ink-2">{WAITLIST.intro} {WAITLIST.promise}</p>
      </Reveal>
      <Reveal delay={0.05} className="mt-8 max-w-4xl">
        <WaitlistForm />
      </Reveal>
    </section>
  );
}
