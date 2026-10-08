import { useEffect, useState } from 'react';
import { DotGround } from '@/components/dot-ground';
import { SetNewPassword, SignIn } from './features/auth/SignIn.tsx';
import { useSession } from './features/auth/useSession.ts';
import { Dashboard } from './features/dashboard/Dashboard.tsx';
import { Home } from './features/home/Home.tsx';
import { HOME_PATH, initialModeFor } from './features/home/route.ts';
import { navigate, routeAuthErrorToSignIn, useRoute } from './features/home/useRoute.ts';
import { ComingSoon } from './features/mobile/ComingSoon.tsx';
import { isPhone, readDeviceHints } from './features/mobile/device.ts';
import { Onboarding } from './features/onboarding/Onboarding.tsx';
import { needsOnboarding } from './features/onboarding/model.ts';
import { HabitsProvider } from './features/habits/HabitsContext.tsx';
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
      {session.status === 'signed_out' && (route === 'signin' ? <SignIn initialMode={initialModeFor(window.location.search)} /> : <Home />)}
      {session.status === 'recovery' && <SetNewPassword />}
    </>
  );
}

/** The homepage is public on every device. On a phone everything past it is the holding screen, because the app is not there yet. */
function PhoneSite() {
  return useRoute() === 'home' ? <Home /> : <ComingSoon />;
}

// decided once at load: the phone apps are not out yet, so a phone browser gets the homepage and a holding screen instead of the app
const PHONE = isPhone(readDeviceHints());

// an error from Google or an email link goes to the sign-in screen, which shows it
routeAuthErrorToSignIn();

export function App() {
  return (
    <>
      <DotGround />
      {PHONE ? <PhoneSite /> : <WebApp />}
    </>
  );
}
