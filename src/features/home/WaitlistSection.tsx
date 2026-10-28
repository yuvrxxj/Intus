import { useRef, useState, type FormEvent } from 'react';
import { Button } from '@/components/ui/button';
import { Field } from '@/components/ui/field';
import { Reveal } from '@/components/ui/reveal';
import { ScrollHeading } from '@/components/ui/scroll-heading';
import { Segmented } from '@/components/ui/segmented';
import { cn } from '@/lib/utils';
import { submitJoin } from './waitlistApi.ts';
import {
  DEVICES,
  WAITLIST,
  initialWaitlistState,
  reduceWaitlist,
  type Device,
  type WaitlistState,
} from './waitlist.ts';

function phoneWidth(): boolean {
  return typeof window !== 'undefined' && window.matchMedia('(max-width: 639px)').matches;
}

/**
 * Section 04. On phone widths the homepage pulls this up to sit under the hero; from 640px it stays after Pricing.
 * TODO(INT-94): country select under the row (INT-110). UTM and analytics are later pull requests.
 */
export function WaitlistSection({ className }: { className?: string }) {
  const [state, setState] = useState<WaitlistState>(() => initialWaitlistState(phoneWidth()));
  const emailRef = useRef<HTMLInputElement>(null);
  const busy = state.phase === 'submitting';

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
    const outcome = await submitJoin(next);
    setState((current) => reduceWaitlist(current, { type: 'result', outcome }));
  }

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
        <p className="on-dots mt-3 max-w-2xl text-[15px] leading-relaxed text-ink-2">{WAITLIST.intro}</p>
        <p className="on-dots mt-2 max-w-2xl text-[15px] leading-relaxed text-ink-2">{WAITLIST.promise}</p>
      </Reveal>
      <Reveal delay={0.05} className="mt-8 max-w-3xl">
        {state.phase === 'done' && state.done ? (
          <div className="notice notice-ok" role="status">
            <div className="font-mono text-[11px] tracking-[0.08em] uppercase">{state.done.kicker}</div>
            <p className="mt-2 text-[15px] text-ink">{state.done.text}</p>
          </div>
        ) : (
          <form className="relative" onSubmit={submit} noValidate>
            <div className="grid gap-4 lg:grid-cols-[minmax(0,1.3fr)_minmax(0,1.4fr)_auto] lg:items-end">
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
                  label={WAITLIST.deviceLabel}
                  size="md"
                  disabled={busy}
                  value={state.device}
                  options={DEVICES}
                  onChange={(value) => dispatch({ type: 'device', value })}
                />
              </div>
              <Button type="submit" variant="primary" size="lg" className="w-full disabled:opacity-100 lg:w-auto" aria-busy={busy} disabled={busy}>
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
            <p className="mt-3 font-mono text-[11px] tracking-[0.06em] text-ink-3 uppercase">{WAITLIST.consent}</p>
            <div aria-live="polite">
              {state.notice && (
                <div className={cn('notice', state.notice.tone === 'warn' ? 'notice-warn' : 'notice-bad')} role="status">
                  {state.notice.text}
                </div>
              )}
            </div>
          </form>
        )}
      </Reveal>
    </section>
  );
}
