import { useEffect, useState } from 'react';
import { LogOut } from 'lucide-react';
import { Field } from '@/components/ui/field';
import { deleteMyAccount } from '../../db/account.ts';
import { supabase } from '../../db/client.ts';
import { CONTACT_EMAIL } from '../../lib/contact.ts';
import { clearLocalData, rememberDeletion } from './localData.ts';
import { confirmationMatches, confirmationPhrase, providerLabel } from './model.ts';

interface Who {
  email: string | null;
  provider: string | null;
}

/** Who is signed in, read from the session the browser already holds (no request). */
function useWho(): Who | null {
  const [who, setWho] = useState<Who | null>(null);
  useEffect(() => {
    let live = true;
    void supabase.auth.getSession().then(({ data }) => {
      const user = data.session?.user;
      if (live && user) setWho({ email: user.email ?? null, provider: (user.app_metadata?.provider as string | undefined) ?? null });
    });
    return () => { live = false; };
  }, []);
  return who;
}

/** Everything is gone from the database. Clear this device, then end the session; the homepage says what happened. */
async function finishDeletion(): Promise<void> {
  clearLocalData();
  rememberDeletion();
  try {
    // the account no longer exists, so there is nothing for the server to sign out; this just drops the local session
    await supabase.auth.signOut({ scope: 'local' });
  } catch {
    // if even that fails, a reload finds a token for a user that no longer exists and signs out on its own
    window.location.assign('/');
  }
}

export function Account({ onSignOut }: { onSignOut: () => void }) {
  const who = useWho();
  const [confirming, setConfirming] = useState(false);
  const [typed, setTyped] = useState('');
  const [busy, setBusy] = useState(false);
  const [failure, setFailure] = useState<string | null>(null);

  const phrase = confirmationPhrase(who?.email);
  const ready = confirmationMatches(typed, who?.email);

  function cancel() {
    setConfirming(false);
    setTyped('');
    setFailure(null);
  }

  async function remove() {
    if (!ready || busy) return;
    setBusy(true);
    setFailure(null);
    try {
      await deleteMyAccount();
    } catch (e) {
      setFailure(e instanceof Error ? e.message : String(e));
      setBusy(false);
      return;
    }
    await finishDeletion();
  }

  return (
    <div className="grid gap-4 lg:grid-cols-2 lg:items-start">
      <div className="card">
        <div className="ct"><span className="dot dot-dim" />Signed in</div>
        {who ? (
          <p className="mt-1 text-sm text-ink-2">
            <span className="font-medium text-ink">{who.email ?? 'Your account'}</span>
            <span className="block text-ink-3">Signed in with {providerLabel(who.provider)}.</span>
          </p>
        ) : (
          <p className="mt-1 text-sm text-ink-3">Loading</p>
        )}
        <div className="btn-row">
          <button type="button" className="btn" onClick={onSignOut}>
            <LogOut className="mr-1.5 inline size-3.5 align-[-2px]" aria-hidden="true" />Sign out
          </button>
        </div>
      </div>

      <section className="card" aria-labelledby="delete-title">
        <div className="ct" id="delete-title"><span className="dot" style={{ background: 'var(--red)' }} />Delete account</div>
        <p className="mt-1 text-sm leading-relaxed text-ink-2">
          Deleting your account removes your sign-in and everything you have saved in Intus: your daily logs, habits, goals,
          bloodwork, supplements, screening history and profile. It happens straight away and cannot be undone.
          Screenshots you added on this device are removed too.
        </p>

        {!confirming ? (
          <div className="btn-row">
            <button type="button" className="btn btn-danger" onClick={() => setConfirming(true)}>Delete my account</button>
          </div>
        ) : (
          <form
            className="mt-4 grid gap-4 border-t border-line pt-4"
            onSubmit={(e) => { e.preventDefault(); void remove(); }}
            noValidate
          >
            <Field id="delete-confirm" label={<>To confirm, type <span className="font-mono text-ink">{phrase}</span></>}>
              <input
                id="delete-confirm"
                type="text"
                autoComplete="off"
                autoCapitalize="off"
                spellCheck={false}
                value={typed}
                disabled={busy}
                onChange={(e) => setTyped(e.target.value)}
              />
            </Field>
            {failure && (
              <div className="notice notice-bad" role="alert" style={{ marginTop: 0 }}>
                Your account was not deleted. Try again, and email <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a> if it keeps failing.
                <span className="mt-1 block font-mono text-[11px] text-ink-3">{failure}</span>
              </div>
            )}
            <div className="btn-row" style={{ marginTop: 0 }}>
              <button type="submit" className="btn btn-primary" disabled={!ready || busy}>
                {busy ? 'Deleting' : 'Delete everything permanently'}
              </button>
              <button type="button" className="btn" disabled={busy} onClick={cancel}>Cancel</button>
            </div>
          </form>
        )}
      </section>
    </div>
  );
}
