# Intus for iPhone

An Expo (React Native) app on the same Supabase project as intus.fit. It does the daily loop natively: sign in, a Home screen, Today (weight, food, mood, habits, supplements), Habits with streaks, Bloodwork against the ranges printed on your reports, Sleep, Apple Health sync, and the account (sign out, download your data, delete). Accounts are made on the website.

The app imports the web's plain TypeScript rules from `../src` (ranges, critical limits, streaks, sleep nights, account deletion and more) rather than copying them. The list is `docs/ios/SHARED.md` at the repo root, and `test/mobile.shared.test.ts` loads each file under Node so a change that makes one non-shareable fails loudly. Anything typed on the phone goes into a local outbox first (`src/data/outbox.ts`) and is sent after, so a closed app or a lost connection loses nothing.

Layout: `src/app` is the screens (expo-router, five native tabs: Home, Today, Habits, Bloodwork, More; Supplements, Sleep, Apple Health and Account are under More), `src/data` talks to Supabase, `src/ui` is the shared components, `src/theme/tokens.ts` is the only place colours and fonts are defined.

## Sync: what it reads from Apple Health, and where it goes

| Apple Health | Intus table | How |
| --- | --- | --- |
| Sleep analysis (in bed, asleep, core, deep, REM, awake) | `sleep_sessions`, `source_kind = 'healthkit'` | Samples grouped per source into sessions, kept as the source reported them, keyed by the source's own id so a second sync updates instead of duplicating. The website merges and picks between sources when it reads |
| Heart rate variability (SDNN) | `cardio_metrics.hrv_ms`, `source = 'healthkit'` | Mean of the day's readings, one row per local day |
| Resting heart rate | `cardio_metrics.resting_hr` | The day's last reading (Apple writes one a day and revises it) |

It never writes to Apple Health. The mapping is plain TypeScript in `src/sync/mapping.ts`, tested from the web repo (`test/mobile.sync.test.ts`). The first sync reads 90 days; later ones re-read the last 3 days whole, so late watch data is caught and a day's average is never taken from half a day.

## Run it in the iOS Simulator (free)

Notes for Xcode 27 and iOS 27 (found on 17 to 21 Oct 2026, details in `docs/ios/PROGRESS.md`):

- Xcode 27 has no Simulator.app; the window is `/Applications/Xcode.app/Contents/Applications/DeviceHub.app`.
- Build the Debug configuration. A Release build fails on Expo's prebuilt Release frameworks (built with Swift 6.3.1, Xcode 27.1 has 6.4).
- `app.json` sets `ios.enableSceneSupport` (needs Expo 57.0.23 or newer), because the iOS 27 SDK crashes an app that does not adopt the scene lifecycle.
- `metro.config.js` watches the repo root so the shared rules resolve.
- UI checks are Maestro flows in `.maestro/` (`signin.yaml` takes `-e EMAIL=... -e PASSWORD=...`; Maestro writes typed text into `~/.maestro/tests`, so delete that folder after).


No paid Apple account is needed for this. HealthKit works in the Simulator: open the Health app there and add samples by hand (Browse, Sleep or Heart, Add Data), then sync from Intus.

**On a Mac with Xcode** (free from the App Store):

```
cd mobile
npm install
npm run typecheck
npm run ios                   # builds the development client, installs it in the Simulator and starts Metro
```

`npm run ios` generates the `ios/` folder (not committed) and runs the HealthKit config plugin, so the permission strings and the HealthKit capability are set up for you.

**Without a Mac:** a free Expo account can build the Simulator app in the cloud (`npx eas login`, then `npm run build:simulator`). It produces an `.app` you can drag onto a Simulator on any Mac, so you still need a Mac to run it, but not Xcode's build setup.

## A real iPhone and TestFlight (later, paid)

Installing on a real iPhone for more than a week, and TestFlight, need the Apple Developer Program (99 USD a year). Not now. When it is time: create the app in App Store Connect with the bundle id `fit.intus.app`, then `npm run build:testflight`. EAS makes the certificates and the provisioning profile with the HealthKit capability, builds, and submits. App Store review for a HealthKit app wants a privacy policy URL (INT-66) and a clear purpose string (in `app.json`).

## Settings

`EXPO_PUBLIC_SUPABASE_URL` and `EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY` point it at another Supabase project. Both default to production and are public by design, as on the web; row-level security keeps each person's rows to themselves. The login session is kept in the iOS keychain (`expo-secure-store`).

## Not done yet

- Background sync (HealthKit background delivery). The entitlement is off (`background: false` in `app.json`) until it is built; sync is by the button for now.
- Android and Health Connect (INT-57, INT-101).
- The app icon: the template's placeholder icons are still in `assets/`. INT-50.
