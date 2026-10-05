import { useRef, useState, type FormEvent } from 'react';
import { motion } from 'framer-motion';
import { ArrowRight, Eye, EyeOff, Lock, MailCheck } from 'lucide-react';
import { Brand } from '@/components/brand';
import { AsciiArt } from '@/components/ui/ascii-art';
import { Button } from '@/components/ui/button';
import { Field } from '@/components/ui/field';
import { Segmented } from '@/components/ui/segmented';
import { cn } from '@/lib/utils';
import { supabase } from '../../db/client.ts';
import { describeAuthError, MIN_PASSWORD_LENGTH, validateCredentials, type AuthMode, type CredentialErrors } from './credentials.ts';

const PRINCIPLES = [
  ['01', 'Your numbers, kept plain', 'Weight, food, habits and bloodwork in one place, without scores you cannot check.'],
  ['02', 'Only you can see it', 'Every row in the database answers to your login and nobody else.'],
  ['03', 'Honest about limits', 'Nothing is called good or bad until a clinician has signed off the range.'],
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

export function SignIn() {
  const [mode, setMode] = useState<AuthMode>('sign-in');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<CredentialErrors>({});
  const [shake, setShake] = useState(false);
  const [checkEmail, setCheckEmail] = useState(false);
  const failTimer = useRef<number | undefined>(undefined);

  const signingUp = mode === 'sign-up';

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
    setMessage(null);
    setFieldErrors({});
    setPassword('');
    setConfirm('');
    setCheckEmail(false);
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
          options: { emailRedirectTo: window.location.origin },
        });
        if (error) return fail(describeAuthError(mode, error));
        // With email confirmation on there is no session yet; the person has to follow the link first.
        // With it off a session exists and the auth listener takes them straight into the app.
        if (!data.session) setCheckEmail(true);
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

  if (checkEmail) {
    return (
      <Shell>
        <div className="card mx-auto w-full max-w-md p-8">
          <MailCheck className="size-6 text-success" aria-hidden="true" />
          <h2 className="mt-5 text-2xl font-semibold tracking-tight">Check your email</h2>
          <p className="mt-2 text-sm leading-relaxed text-ink-2" role="status">
            We sent a link to <span className="font-medium text-ink">{email.trim()}</span>. Open it to confirm your account, then sign in.
          </p>
          <Button variant="primary" size="lg" className="mt-8 w-full" onClick={() => switchMode('sign-in')}>Back to sign in</Button>
        </div>
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

        <Button type="submit" variant="primary" size="lg" className="mt-7 w-full" disabled={busy}>
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
