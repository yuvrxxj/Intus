import { useEffect, useRef, useState, type FormEvent } from 'react';
import { motion } from 'framer-motion';
import { ArrowLeft, ArrowRight, Eye, EyeOff, Lock, MailCheck } from 'lucide-react';
import { Brand } from '@/components/brand';
import { AsciiArt } from '@/components/ui/ascii-art';
import { Button } from '@/components/ui/button';
import { Field } from '@/components/ui/field';
import { Segmented } from '@/components/ui/segmented';
import { cn } from '@/lib/utils';
import { supabase } from '../../db/client.ts';
import {
  describeAuthError, MIN_PASSWORD_LENGTH, redirectError, validateCredentials, validateNewPassword, type AuthMode, type CredentialErrors,
} from './credentials.ts';
import { useAuthSettings } from './useAuthSettings.ts';

const PRINCIPLES = [
  ['01', 'Your numbers, kept plain', 'Weight, food, habits and bloodwork in one place, without scores you cannot check.'],
  ['02', 'Only you can see it', 'Every row in the database answers to your login and nobody else.'],
  ['03', 'Flagged against the range', 'Every lab result is set against its reference range, so what is out of range stands out.'],
] as const;

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative z-10 mx-auto grid min-h-dvh w-full max-w-6xl grid-cols-1 items-center gap-10 px-5 py-10 lg:grid-cols-[1.1fr_1fr] lg:gap-16 lg:px-10">
      <section className="on-dots flex flex-col gap-8">
        <Brand />
        <div className="flex items-end gap-6">
          <AsciiArt shape="heart" cols={44} rows={22} className="text-[9px] text-primary sm:text-[11px]" />
        </div>
        <div>
          <h1 className="max-w-xl text-[40px] leading-[1.05] font-semibold tracking-[-0.03em] text-ink sm:text-[52px]">
            Your health, in plain numbers.
          </h1>
          <ul className="mt-8 hidden max-w-xl gap-5 sm:grid">
            {PRINCIPLES.map(([n, title, body]) => (
              <li key={n} className="grid grid-cols-[40px_1fr] gap-2">
                <span className="font-mono text-xs text-primary">{n}</span>
                <span>
                  <span className="block text-sm font-medium text-ink">{title}</span>
                  <span className="block text-sm leading-relaxed text-ink-2">{body}</span>
                </span>
              </li>
            ))}
          </ul>
        </div>
      </section>
      {children}
    </div>
  );
}

/** Google's mark, drawn as Google's sign-in guidelines ask. The only colour outside the palette, on purpose. */
function GoogleMark() {
  return (
    <svg viewBox="0 0 48 48" className="size-[18px]" aria-hidden="true">
      <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z" />
      <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z" />
      <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z" />
      <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z" />
    </svg>
  );
}

type View = { kind: 'form' } | { kind: 'forgot' } | { kind: 'sent'; reason: 'confirm' | 'reset'; email: string };

export function SignIn() {
  const settings = useAuthSettings();
  const [view, setView] = useState<View>({ kind: 'form' });
  const [mode, setMode] = useState<AuthMode>('sign-in');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<CredentialErrors>({});
  const [shake, setShake] = useState(false);
  const [resent, setResent] = useState(false);
  const failTimer = useRef<number | undefined>(undefined);

  const signingUp = mode === 'sign-up';
  const redirectTo = window.location.origin;

  // Google or an email link can send someone back with an error in the address: show it once, then tidy the URL
  useEffect(() => {
    const error = redirectError(window.location.href);
    if (!error) return;
    setMessage(error);
    window.history.replaceState(null, '', window.location.pathname);
  }, []);

  function fail(text: string, errors: CredentialErrors = {}) {
    setShake(false);
    requestAnimationFrame(() => setShake(true));
    setMessage(text);
    setFieldErrors(errors);
    window.clearTimeout(failTimer.current);
    failTimer.current = window.setTimeout(() => setShake(false), 600);
  }

  function switchMode(next: AuthMode) {
    setMode(next);
    setView({ kind: 'form' });
    setMessage(null);
    setFieldErrors({});
    setPassword('');
    setConfirm('');
  }

  function openForgot() {
    setView({ kind: 'forgot' });
    setMessage(null);
    setFieldErrors({});
  }

  async function google() {
    setMessage(null);
    setBusy(true);
    // on success the browser leaves for Google, so busy is only cleared when the request itself fails
    const { error } = await supabase.auth.signInWithOAuth({ provider: 'google', options: { redirectTo } });
    if (error) {
      setBusy(false);
      fail('Could not reach Google. Try again.');
    }
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    setMessage(null);
    const errors = validateCredentials(mode, { email, password, confirm });
    const first = errors.email ?? errors.password ?? errors.confirm;
    if (first) return fail(first, errors);
    setFieldErrors({});
    setBusy(true);
    try {
      if (signingUp) {
        const { data, error } = await supabase.auth.signUp({
          email: email.trim(),
          password,
          options: { emailRedirectTo: redirectTo },
        });
        if (error) return fail(describeAuthError(mode, error));
        // With email confirmation on there is no session yet; the person has to follow the link first.
        // With it off a session exists and the auth listener takes them straight into the app.
        if (!data.session) {
          setResent(false);
          setView({ kind: 'sent', reason: 'confirm', email: email.trim() });
        }
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
        if (error) return fail(describeAuthError(mode, error));
      }
      setPassword('');
      setConfirm('');
    } finally {
      setBusy(false);
    }
  }

  async function sendReset(event: FormEvent) {
    event.preventDefault();
    setMessage(null);
    const error = validateCredentials('sign-in', { email, password: 'x', confirm: '' }).email;
    if (error) return fail(error, { email: error });
    setFieldErrors({});
    setBusy(true);
    try {
      const { error: sendError } = await supabase.auth.resetPasswordForEmail(email.trim(), { redirectTo });
      // the same screen whether or not the address has an account, so this cannot be used to find out who does
      if (sendError && sendError.status === 429) return fail(describeAuthError('sign-in', sendError));
      setResent(false);
      setView({ kind: 'sent', reason: 'reset', email: email.trim() });
    } finally {
      setBusy(false);
    }
  }

  async function resend(sent: Extract<View, { kind: 'sent' }>) {
    setBusy(true);
    setMessage(null);
    try {
      const { error } = sent.reason === 'confirm'
        ? await supabase.auth.resend({ type: 'signup', email: sent.email, options: { emailRedirectTo: redirectTo } })
        : await supabase.auth.resetPasswordForEmail(sent.email, { redirectTo });
      if (error) setMessage(describeAuthError(sent.reason === 'confirm' ? 'sign-up' : 'sign-in', error));
      else setResent(true);
    } finally {
      setBusy(false);
    }
  }

  if (view.kind === 'sent') {
    return (
      <Shell>
        <div className="card mx-auto w-full max-w-md p-8">
          <MailCheck className="size-6 text-success" aria-hidden="true" />
          <h2 className="mt-5 text-2xl font-semibold tracking-tight">Check your email</h2>
          <p className="mt-2 text-sm leading-relaxed text-ink-2" role="status">
            {view.reason === 'confirm' ? 'We sent a link to ' : 'If there is an account for '}
            <span className="font-medium text-ink">{view.email}</span>
            {view.reason === 'confirm'
              ? '. Open it to confirm your account, then sign in.'
              : ', a link to choose a new password is on its way. It works once and expires after an hour.'}
          </p>
          <Button variant="primary" size="lg" className="mt-8 w-full" onClick={() => switchMode('sign-in')}>Back to sign in</Button>
          <Button variant="ghost" size="md" className="mt-2 w-full" disabled={busy || resent} onClick={() => resend(view)}>
            {resent ? 'Sent again' : 'Send the link again'}
          </Button>
          <div className={cn('mt-2 min-h-5 text-center text-[13px] text-primary', !message && 'opacity-0')} role="alert">{message ?? ' '}</div>
        </div>
      </Shell>
    );
  }

  if (view.kind === 'forgot') {
    return (
      <Shell>
        <form className="card mx-auto w-full max-w-md p-6 sm:p-8" onSubmit={sendReset} noValidate>
          <button type="button" className="inline-flex items-center gap-1.5 text-[13px] font-medium text-ink-2 hover:text-ink" onClick={() => switchMode('sign-in')}>
            <ArrowLeft className="size-4" aria-hidden="true" /> Back to sign in
          </button>
          <h2 className="mt-6 text-2xl font-semibold tracking-tight">Reset your password</h2>
          <p className="mt-1 text-sm text-ink-2">We will email you a link to choose a new one.</p>
          <div className="mt-6">
            <Field id="reset-email" label="Email" error={fieldErrors.email}>
              <input
                id="reset-email"
                className={cn(shake && fieldErrors.email && 'shake')}
                type="email"
                placeholder="you@example.com"
                autoComplete="username"
                aria-invalid={fieldErrors.email ? true : undefined}
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </Field>
          </div>
          <Button type="submit" variant="primary" size="lg" className="mt-7 w-full" disabled={busy}>
            {busy ? 'Sending' : 'Send reset link'}
          </Button>
          <div className={cn('mt-3 min-h-5 text-center text-[13px] text-primary', !message && 'opacity-0')} role="alert">{message ?? ' '}</div>
        </form>
      </Shell>
    );
  }

  return (
    <Shell>
      <motion.form
        className="card mx-auto w-full max-w-md p-6 sm:p-8"
        onSubmit={submit}
        noValidate
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
      >
        <Segmented<AuthMode>
          label="Sign in or create an account"
          value={mode}
          onChange={switchMode}
          options={[{ value: 'sign-in', label: 'Sign in' }, { value: 'sign-up', label: 'Create account' }]}
        />
        <h2 className="mt-7 text-2xl font-semibold tracking-tight">{signingUp ? 'Create your account' : 'Welcome back'}</h2>
        <p className="mt-1 text-sm text-ink-2">{signingUp ? 'Two fields, then a few questions to set up your goal.' : 'Sign in to see today.'}</p>

        {settings.google && (
          <>
            <Button variant="secondary" size="lg" className="mt-6 w-full" disabled={busy} onClick={google}>
              <GoogleMark /> Continue with Google
            </Button>
            <div className="mt-6 flex items-center gap-3 font-mono text-[11px] tracking-[0.08em] text-ink-3 uppercase">
              <span className="h-px flex-1 bg-line-strong" aria-hidden="true" />
              or with email
              <span className="h-px flex-1 bg-line-strong" aria-hidden="true" />
            </div>
          </>
        )}

        <div className="mt-6 grid gap-4">
          <Field id="auth-email" label="Email" error={fieldErrors.email}>
            <input
              id="auth-email"
              className={cn(shake && fieldErrors.email && 'shake')}
              type="email"
              placeholder="you@example.com"
              autoComplete="username"
              aria-invalid={fieldErrors.email ? true : undefined}
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </Field>
          <Field id="auth-password" label="Password" error={fieldErrors.password} hint={signingUp ? `At least ${MIN_PASSWORD_LENGTH} characters.` : undefined}>
            <div className={cn('relative', shake && (fieldErrors.password || !signingUp) && 'shake')}>
              <input
                id="auth-password"
                className="pr-11"
                type={showPassword ? 'text' : 'password'}
                autoComplete={signingUp ? 'new-password' : 'current-password'}
                aria-invalid={fieldErrors.password ? true : undefined}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
              <button
                type="button"
                className="absolute top-1/2 right-1.5 flex size-8 -translate-y-1/2 items-center justify-center rounded-md text-ink-3 hover:text-ink"
                onClick={() => setShowPassword((v) => !v)}
                aria-label={showPassword ? 'Hide password' : 'Show password'}
              >
                {showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
              </button>
            </div>
          </Field>
          {signingUp && (
            <Field id="auth-confirm" label="Repeat password" error={fieldErrors.confirm}>
              <input
                id="auth-confirm"
                className={cn(shake && fieldErrors.confirm && 'shake')}
                type={showPassword ? 'text' : 'password'}
                autoComplete="new-password"
                aria-invalid={fieldErrors.confirm ? true : undefined}
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
              />
            </Field>
          )}
        </div>

        {!signingUp && (
          <div className="mt-2 text-right">
            <button type="button" className="text-[13px] font-medium text-ink-2 underline-offset-4 hover:text-ink hover:underline" onClick={openForgot}>
              Forgot password?
            </button>
          </div>
        )}

        <Button type="submit" variant="primary" size="lg" className={cn('w-full', signingUp ? 'mt-7' : 'mt-5')} disabled={busy}>
          {busy ? (signingUp ? 'Creating account' : 'Signing in') : signingUp ? 'Create account' : 'Sign in'}
          {!busy && <ArrowRight className="size-4" aria-hidden="true" />}
        </Button>
        <div className={cn('mt-3 min-h-5 text-center text-[13px] text-primary transition-opacity', message ? 'opacity-100' : 'opacity-0')} role="alert">
          {message ?? ' '}
        </div>
        <p className="mt-2 flex items-center justify-center gap-1.5 text-xs text-ink-3">
          <Lock className="size-3" aria-hidden="true" /> Only you can see your data.
        </p>
      </motion.form>
    </Shell>
  );
}

/** After following a reset link: the person is signed in, and chooses a new password before the app opens. */
export function SetNewPassword() {
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);
  const [errors, setErrors] = useState<Pick<CredentialErrors, 'password' | 'confirm'>>({});
  const [message, setMessage] = useState<string | null>(null);

  async function save(event: FormEvent) {
    event.preventDefault();
    setMessage(null);
    const found = validateNewPassword(password, confirm);
    setErrors(found);
    if (found.password || found.confirm) return;
    setBusy(true);
    try {
      // success fires USER_UPDATED, and the session listener opens the app
      const { error } = await supabase.auth.updateUser({ password });
      if (error) setMessage(describeAuthError('sign-up', error));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Shell>
      <form className="card mx-auto w-full max-w-md p-6 sm:p-8" onSubmit={save} noValidate>
        <h2 className="text-2xl font-semibold tracking-tight">Choose a new password</h2>
        <p className="mt-1 text-sm text-ink-2">Then you are straight back in.</p>
        <div className="mt-6 grid gap-4">
          <Field id="new-password" label="New password" error={errors.password} hint={`At least ${MIN_PASSWORD_LENGTH} characters.`}>
            <div className="relative">
              <input id="new-password" className="pr-11" type={show ? 'text' : 'password'} autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} />
              <button
                type="button"
                className="absolute top-1/2 right-1.5 flex size-8 -translate-y-1/2 items-center justify-center rounded-md text-ink-3 hover:text-ink"
                onClick={() => setShow((v) => !v)}
                aria-label={show ? 'Hide password' : 'Show password'}
              >
                {show ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
              </button>
            </div>
          </Field>
          <Field id="new-confirm" label="Repeat password" error={errors.confirm}>
            <input id="new-confirm" type={show ? 'text' : 'password'} autoComplete="new-password" value={confirm} onChange={(e) => setConfirm(e.target.value)} />
          </Field>
        </div>
        <Button type="submit" variant="primary" size="lg" className="mt-7 w-full" disabled={busy}>
          {busy ? 'Saving' : 'Save and continue'}
        </Button>
        <div className={cn('mt-3 min-h-5 text-center text-[13px] text-primary', !message && 'opacity-0')} role="alert">{message ?? ' '}</div>
      </form>
    </Shell>
  );
}
