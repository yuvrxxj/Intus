import { useEffect, useState, type ReactNode } from 'react';
import { DotGround } from '@/components/dot-ground';
import { SetNewPassword, SignIn } from './features/auth/SignIn.tsx';
import { useSession } from './features/auth/useSession.ts';
import { authEntryRedirect } from './features/auth/webAuth.ts';
import { WEB_AUTH_ENABLED } from './features/auth/webAuthFlag.ts';
import { Dashboard } from './features/dashboard/Dashboard.tsx';
import { ConfirmWaitlist } from './features/home/ConfirmWaitlist.tsx';
import { Unsubscribe } from './features/home/Unsubscribe.tsx';
import { Home } from './features/home/Home.tsx';
import { Pricing } from './features/home/Pricing.tsx';
import { HOME_PATH, initialModeFor } from './features/home/route.ts';
import { navigate, routeAuthErrorToSignIn, useRoute } from './features/home/useRoute.ts';
import { ComingSoon } from './features/mobile/ComingSoon.tsx';
import { isPhone, readDeviceHints } from './features/mobile/device.ts';
import { Onboarding } from './features/onboarding/Onboarding.tsx';
import { needsOnboarding } from './features/onboarding/model.ts';
import { HabitsProvider } from './features/habits/HabitsContext.tsx';
import { Legal } from './features/legal/Legal.tsx';
import { ProfileProvider, useProfile } from './features/profile/ProfileContext.tsx';

function Loading() {
  return <div className="relative z-10 flex min-h-dvh items-center justify-center"><div className="loading">Loading</div></div>;
}

/** New accounts answer the first-run questions before seeing the dashboard. Anyone can skip them for now. */
function Gate() {
  const { status, profile } = useProfile();
  const [skipped, setSkipped] = useState(false);
  if (status === 'loading') return <Loading />;
  if (status === 'ready' && needsOnboarding(profile) && !skipped) return <Onboarding onSkip={() => setSkipped(true)} />;
  return <Dashboard />;
}

function WebApp() {
  const session = useSession();
  const route = useRoute();
  // once signed in, the sign-in address has done its job: the app lives at the site root
  useEffect(() => {
    if (session.status === 'signed_in' && route === 'signin') navigate(HOME_PATH, true);
  }, [session.status, route]);
  // the privacy policy, terms and pricing are readable by anyone, signed in or not
  if (route === 'privacy' || route === 'terms') return <Legal page={route} />;
  if (route === 'pricing') return <Pricing />;
  if (route === 'confirmed') return <ConfirmWaitlist />;
  if (route === 'unsubscribe') return <Unsubscribe />;
  return (
    <>
      {session.status === 'loading' && <Loading />}
      {session.status === 'signed_in' && (
        <ProfileProvider>
          <HabitsProvider>
            <Gate />
          </HabitsProvider>
        </ProfileProvider>
      )}
      {session.status === 'signed_out' && (WEB_AUTH_ENABLED && route === 'signin' ? <SignIn initialMode={initialModeFor(window.location.search)} /> : <Home />)}
      {session.status === 'recovery' && <SetNewPassword />}
    </>
  );
}

/** The homepage is public on every device. On a phone everything past it is the holding screen, because the app is not there yet. */
function PhoneSite() {
  const route = useRoute();
  if (route === 'privacy' || route === 'terms') return <Legal page={route} />;
  if (route === 'pricing') return <Pricing />;
  if (route === 'confirmed') return <ConfirmWaitlist />;
  if (route === 'unsubscribe') return <Unsubscribe />;
  return route === 'home' ? <Home /> : <ComingSoon />;
}

// decided once at load: the phone apps are not out yet, so a phone browser gets the homepage and a holding screen instead of the app
const PHONE = isPhone(readDeviceHints());

// an error from Google or an email link goes to the sign-in screen, which shows it, once web auth is open
if (WEB_AUTH_ENABLED) routeAuthErrorToSignIn();

/**
 * If a closed auth address still reaches the app (a client-side hop the server redirect did not see),
 * leave for the waitlist. A Supabase return stays, so an in-flight email link can finish.
 */
function AuthEntryGate({ children }: { children: ReactNode }) {
  const route = useRoute();
  const redirect = route === 'signin'
    ? authEntryRedirect(window.location.pathname, window.location.search, WEB_AUTH_ENABLED, window.location.hash)
    : null;
  useEffect(() => {
    if (redirect) window.location.replace(redirect);
  }, [redirect]);
  if (redirect) return null;
  return children;
}

export function App() {
  return (
    <>
      <DotGround />
      <AuthEntryGate>
        {PHONE ? <PhoneSite /> : <WebApp />}
      </AuthEntryGate>
    </>
  );
}
