import { useEffect, useRef, useState, type FormEvent } from 'react';
import { Button, buttonClass } from '@/components/ui/button';
import { Header } from './Home.tsx';
import { CONFIRMED_PATH } from './route.ts';
import { ErrorNotice, WaitlistForm } from './WaitlistSection.tsx';
import { submitAnswers, submitConfirm } from './waitlistApi.ts';
import {
  DEVICES,
  WAITLIST,
  confirmTokenFrom,
  placeText,
  shareLink,
  type ConfirmPageResult,
  type Device,
  type ReferralStanding,
} from './waitlist.ts';
import { Segmented } from '@/components/ui/segmented';

type Phase = 'checking' | ConfirmPageResult['kind'];

/** Your place, your share link with a copy button, and why sharing helps. Hidden when the place could not be worked out. */
function ReferralBlock({ standing }: { standing: ReferralStanding }) {
  const link = shareLink(standing.code);
  const [copied, setCopied] = useState(false);
  const [copyFailed, setCopyFailed] = useState(false);

  async function copy() {
    setCopyFailed(false);
    try {
      await navigator.clipboard.writeText(link);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopyFailed(true);
    }
  }

  return (
    <section className="mt-6 rounded-[10px] border border-line bg-surface-3 px-4 py-4" aria-labelledby="referral-place">
      <p className="font-mono text-[11px] tracking-[0.08em] text-ink-2 uppercase">{WAITLIST.referralKicker}</p>
      <p id="referral-place" className="mt-2 text-[22px] leading-tight font-semibold tracking-[-0.01em] text-ink">{placeText(standing.place)}</p>
      <p className="mt-1 text-[15px] leading-relaxed font-normal text-ink-2">{WAITLIST.referralHelper}</p>
      <div className="mt-4">
        <label htmlFor="referral-link" className="mb-1.5 block text-[13px] font-semibold text-ink-2">{WAITLIST.referralLinkLabel}</label>
        <div className="flex flex-wrap items-center gap-3">
          <input
            id="referral-link"
            readOnly
            value={link}
            onFocus={(e) => e.currentTarget.select()}
            className="min-w-0 flex-1 border-2 border-line-strong font-mono text-[13px] focus:border-ink"
          />
          <Button type="button" variant="secondary" size="md" onClick={copy}>
            {copied ? WAITLIST.copiedLink : WAITLIST.copyLink}
          </Button>
          <span className="sr-only" role="status">{copied ? WAITLIST.copiedLink : ''}</span>
        </div>
        {copyFailed && <ErrorNotice>{WAITLIST.copyError}</ErrorNotice>}
      </div>
      <p className="mt-3 text-xs leading-relaxed font-normal text-ink-3">{WAITLIST.referralNote}</p>
    </section>
  );
}

/**
 * `/waitlist/confirmed`. A live token confirms the row and shows the optional questions. Opening the same link
 * again loads whatever was saved. A missing or expired token shows the waitlist form and no questions.
 * The access-process block stays hidden until Sales replaces {{ACCESS_PROCESS_TBD}}.
 * TODO(INT-94): the confirmation email that links here is the Resend pull request.
 */
export function ConfirmWaitlist() {
  const [token] = useState(() => confirmTokenFrom(window.location.search));
  const [phase, setPhase] = useState<Phase>(token ? 'checking' : 'expired');
  const [device, setDevice] = useState<Device>('laptop');
  const [tracks, setTracks] = useState('');
  const [referral, setReferral] = useState<ReferralStanding | null>(null);
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);
  const thanksRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (sent) thanksRef.current?.focus();
  }, [sent]);

  useEffect(() => {
    if (!token) return;
    let cancelled = false;
    setPhase('checking');
    submitConfirm(token).then((result) => {
      if (cancelled) return;
      if (result.kind === 'confirmed') {
        setDevice(result.details.device);
        setTracks(result.details.tracksToday);
        setReferral(result.details.referral);
      }
      if (window.location.pathname !== CONFIRMED_PATH) window.history.replaceState(null, '', `${CONFIRMED_PATH}${window.location.search}`);
      setPhase(result.kind);
    });
    return () => { cancelled = true; };
  }, [token, attempt]);

  async function send(event: FormEvent) {
    event.preventDefault();
    if (!token || sending) return;
    setSending(true);
    setSaveError(null);
    const outcome = await submitAnswers(token, device, tracks);
    setSending(false);
    if (outcome === 'saved') setSent(true);
    else if (outcome === 'expired') setPhase('expired');
    else setSaveError(WAITLIST.answersError);
  }

  return (
    <div className="relative z-10 min-h-dvh">
      <Header quiet />
      <main className="mx-auto w-full max-w-[560px] px-4 py-10 sm:py-14">
        {phase === 'checking' && <p className="font-mono text-xs tracking-[0.06em] text-ink-3 uppercase">{WAITLIST.confirmChecking}</p>}
        {phase === 'error' && (
          <ErrorNotice>
            {WAITLIST.confirmError}
            <Button type="button" variant="secondary" size="md" className="mt-4" onClick={() => setAttempt((n) => n + 1)}>{WAITLIST.confirmRetry}</Button>
          </ErrorNotice>
        )}
        {phase === 'expired' && (
          <>
            <p className="text-[15px] leading-relaxed font-normal text-ink" role="status">{WAITLIST.expiredBody}</p>
            <WaitlistForm className="mt-8" />
          </>
        )}
        {phase === 'confirmed' && (
          <div className="rounded-[16px] border border-line bg-surface px-4 py-5 sm:p-6">
            {sent ? (
              <div ref={thanksRef} tabIndex={-1} className="notice notice-ok mt-0 outline-none" role="status">
                <p className="text-[15px] leading-relaxed font-normal text-ink">{WAITLIST.sentThanks}</p>
                <p className="mt-4">
                  <a href={WAITLIST.confirmedLink} className="text-sm text-primary underline">{WAITLIST.sentBack}</a>
                </p>
              </div>
            ) : (
              <>
                <div className="notice notice-ok mt-0" role="status">
                  <div className="font-mono text-[11px] tracking-[0.08em] uppercase">{WAITLIST.confirmedKicker}</div>
                  <h1 className="mt-3 text-[28px] leading-tight font-semibold tracking-[-0.02em] text-ink">{WAITLIST.confirmedTitle}</h1>
                  <p className="mt-3 font-mono text-[13px] leading-relaxed text-ink">{WAITLIST.promiseConfirmed}</p>
                </div>
                {referral && <ReferralBlock standing={referral} />}
                <p className="mt-6 text-[15px] leading-relaxed font-normal text-ink-2">{WAITLIST.whatIntus}</p>
                <form className="mt-8" onSubmit={send} noValidate>
                  <p className="font-mono text-[11px] tracking-[0.08em] text-ink-2 uppercase">{WAITLIST.questionsKicker}</p>
                  <h2 className="mt-2 text-[17px] font-semibold tracking-[-0.01em] text-ink">{WAITLIST.questionsLead}</h2>
                  <div className="mt-5">
                    <span id="confirmed-device-label" className="mb-1.5 block text-[13px] font-semibold text-ink-2">{WAITLIST.deviceLabel}</span>
                    <Segmented<Device>
                      labelledBy="confirmed-device-label"
                      size="md"
                      disabled={sending}
                      value={device}
                      options={DEVICES}
                      onChange={setDevice}
                    />
                    <p className="mt-1.5 text-xs leading-relaxed font-normal text-ink-3">{WAITLIST.deviceHelper}</p>
                  </div>
                  <label className="mt-5 block" htmlFor="tracks-today">
                    <span className="mb-1.5 block text-[13px] font-semibold text-ink-2">{WAITLIST.tracksLabel}</span>
                    <textarea
                      id="tracks-today"
                      rows={3}
                      maxLength={280}
                      value={tracks}
                      readOnly={sending}
                      placeholder={WAITLIST.tracksPlaceholder}
                      onChange={(e) => setTracks(e.target.value)}
                      className="border-2 border-line-strong focus:border-ink"
                    />
                  </label>
                  {saveError && <ErrorNotice>{saveError}</ErrorNotice>}
                  <div className="mt-6 flex flex-wrap items-center gap-3">
                    <Button type="submit" variant="primary" size="lg" className="disabled:opacity-100" aria-busy={sending} disabled={sending}>
                      {WAITLIST.sendAnswers}
                      {sending && <span className="font-mono motion-safe:animate-pulse" aria-hidden="true">_</span>}
                    </Button>
                    <a href={WAITLIST.confirmedLink} className={buttonClass({ variant: 'ghost', size: 'lg' })}>{WAITLIST.skip}</a>
                  </div>
                  <p className="mt-4 text-xs leading-relaxed font-normal text-ink-3">{WAITLIST.finePrint}</p>
                </form>
              </>
            )}
          </div>
        )}
      </main>
    </div>
  );
}
