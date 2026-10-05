import { useRef, useState, type FormEvent } from 'react';
import { supabase } from '../../db/client.ts';
import { describeAuthError, MIN_PASSWORD_LENGTH, validateCredentials, type AuthMode, type CredentialErrors } from './credentials.ts';

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
      <div id="lock">
        <div className="lock-card">
          <div className="lock-logo" aria-hidden="true">📬</div>
          <div className="lock-title">Check your email</div>
          <div className="lock-sub" role="status">
            We sent a link to {email.trim()}. Open it to confirm your account, then sign in.
          </div>
          <button className="lock-btn" type="button" onClick={() => switchMode('sign-in')}>Back to sign in</button>
        </div>
      </div>
    );
  }

  return (
    <div id="lock">
      <form className="lock-card" onSubmit={submit} noValidate>
        <div className="lock-logo" aria-hidden="true">🩺</div>
        <div className="lock-title">Yuvraaj's Health OS</div>
        <div className="lock-sub">{signingUp ? 'Create your account' : 'Sign in to continue'}</div>
        <div className={`lock-input-wrap${shake && fieldErrors.email ? ' shake' : ''}`}>
          <input
            className="lock-input plain"
            type="email"
            placeholder="Email"
            autoComplete="username"
            aria-label="Email"
            aria-invalid={fieldErrors.email ? true : undefined}
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </div>
        <div className={`lock-input-wrap${shake && (fieldErrors.password || !signingUp) ? ' shake' : ''}`}>
          <input
            className="lock-input"
            type={showPassword ? 'text' : 'password'}
            placeholder={signingUp ? `Password, ${MIN_PASSWORD_LENGTH}+ characters` : '••••••••'}
            autoComplete={signingUp ? 'new-password' : 'current-password'}
            aria-label="Password"
            aria-invalid={fieldErrors.password ? true : undefined}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
          <button
            type="button"
            className="lock-toggle"
            onClick={() => setShowPassword((v) => !v)}
            aria-label={showPassword ? 'Hide password' : 'Show password'}
          >
            👁
          </button>
        </div>
        {signingUp && (
          <div className={`lock-input-wrap${shake && fieldErrors.confirm ? ' shake' : ''}`}>
            <input
              className="lock-input"
              type={showPassword ? 'text' : 'password'}
              placeholder="Repeat password"
              autoComplete="new-password"
              aria-label="Repeat password"
              aria-invalid={fieldErrors.confirm ? true : undefined}
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
            />
          </div>
        )}
        <button className="lock-btn" type="submit" disabled={busy}>
          {busy ? (signingUp ? 'Creating account…' : 'Signing in…') : signingUp ? 'Create account' : 'Sign in'}
        </button>
        <div className={`lock-err${message ? '' : ' hidden'}`} role="alert">{message ?? ' '}</div>
        <button type="button" className="lock-link" onClick={() => switchMode(signingUp ? 'sign-in' : 'sign-up')}>
          {signingUp ? 'Already have an account? Sign in' : 'New here? Create an account'}
        </button>
        <div className="lock-dots" aria-hidden="true">
          <div className="lock-dot active" />
          <div className="lock-dot" />
          <div className="lock-dot" />
        </div>
      </form>
    </div>
  );
}
