# Intus for iPhone: the HealthKit sync companion

A thin Expo (React Native) app on the same Supabase project as intus.fit. It does three things: sign in with your Intus account, ask Apple Health for read access, and sync. Everything else stays on the website until the phone screens are built (INT-89, INT-97).

What it reads, and where it goes:

| Apple Health | Intus table | How |
| --- | --- | --- |
| Sleep analysis (in bed, asleep, core, deep, REM, awake) | `sleep_sessions`, `source_kind = 'healthkit'` | Samples grouped per source into sessions, kept as the source reported them, keyed by the source's own id so a second sync updates instead of duplicating. The website merges and picks between sources when it reads |
| Heart rate variability (SDNN) | `cardio_metrics.hrv_ms`, `source = 'healthkit'` | Mean of the day's readings, one row per local day |
| Resting heart rate | `cardio_metrics.resting_hr` | The day's last reading (Apple writes one a day and revises it) |

It never writes to Apple Health. The mapping is plain TypeScript in `src/sync/mapping.ts`, tested from the web repo (`test/mobile.sync.test.ts`). The first sync reads 90 days; later ones re-read the last 3 days whole, so late watch data is caught and a day's average is never taken from half a day.

## Run it

HealthKit does not work in Expo Go or in the simulator's Health store without data, so this needs a development build on a real iPhone.

```
cd mobile
npm install
npm run typecheck
npx eas login                 # an Expo account (free)
npm run build:dev             # cloud build of the development client; install it on the phone from the link
npm start                     # then open the development build on the phone
```

On a Mac with Xcode you can build locally instead: `npm run ios` (it generates the `ios/` folder, which is not committed).

## TestFlight

Needs the Apple Developer Program (99 USD a year), which is the one cost here.

1. Join the program, then in App Store Connect create the app with the bundle id `fit.intus.app` (change it in `app.json` first if you want a different one).
2. `npm run build:testflight`. EAS creates the certificates and the provisioning profile with the HealthKit capability, builds, and submits to TestFlight.
3. App Store review for a HealthKit app wants a privacy policy URL and a clear purpose string (the permission text is in `app.json`). INT-66 covers the policy.

## Settings

`EXPO_PUBLIC_SUPABASE_URL` and `EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY` point it at another Supabase project. Both default to production and are public by design, as on the web; row-level security keeps each person's rows to themselves. The login session is kept in the iOS keychain (`expo-secure-store`).

## Not done yet

- Background sync (HealthKit background delivery). The entitlement is off (`background: false` in `app.json`) until it is built; sync is by the button for now.
- Android and Health Connect (INT-57, INT-101).
- The app icon: the template's placeholder icons are still in `assets/`. INT-50.
