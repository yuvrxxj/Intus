import { useRef, useState, type FormEvent } from 'react';
import { supabase } from '../../db/client.ts';

export function SignIn() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);
  const [shake, setShake] = useState(false);
  const failTimer = useRef<number | undefined>(undefined);

  function reject() {
    setShake(false);
    requestAnimationFrame(() => setShake(true));
    setFailed(true);
    window.clearTimeout(failTimer.current);
    failTimer.current = window.setTimeout(() => setFailed(false), 2500);
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!email.trim() || !password) return reject();
    setBusy(true);
    const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
    setBusy(false);
    if (error) return reject();
    setPassword('');
  }

  return (
    <div id="lock">
      <form className="lock-card" onSubmit={submit}>
        <div className="lock-logo" aria-hidden="true">🩺</div>
        <div className="lock-title">Yuvraaj's Health OS</div>
        <div className="lock-sub">Sign in to continue</div>
        <div className={`lock-input-wrap${shake ? ' shake' : ''}`}>
          <input
            className="lock-input plain"
            type="email"
            placeholder="Email"
            autoComplete="username"
            aria-label="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </div>
        <div className={`lock-input-wrap${shake ? ' shake' : ''}`}>
          <input
            className="lock-input"
            type={showPassword ? 'text' : 'password'}
            placeholder="••••••••"
            autoComplete="current-password"
            aria-label="Password"
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
        <button className="lock-btn" type="submit" disabled={busy}>
          {busy ? 'Signing in…' : 'Sign in'}
        </button>
        <div className={`lock-err${failed ? '' : ' hidden'}`} role="alert">
          Sign-in failed. Check your email and password.
        </div>
        <div className="lock-dots" aria-hidden="true">
          <div className="lock-dot active" />
          <div className="lock-dot" />
          <div className="lock-dot" />
        </div>
      </form>
    </div>
  );
}
