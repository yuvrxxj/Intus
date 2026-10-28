# Intus for iPhone: the HealthKit sync companion

A thin Expo (React Native) app on the same Supabase project as intus.fit. It signs in with your Intus account, asks Apple Health for read access, syncs, and from Account can sign out, download your data, or delete the account. The daily log and the other screens stay on the website until they are built (INT-89, INT-97).

What it reads, and where it goes:

| Apple Health | Intus table | How |
| --- | --- | --- |
| Sleep analysis (in bed, asleep, core, deep, REM, awake) | `sleep_sessions`, `source_kind = 'healthkit'` | Samples grouped per source into sessions, kept as the source reported them, keyed by the source's own id so a second sync updates instead of duplicating. The website merges and picks between sources when it reads |
| Heart rate variability (SDNN) | `cardio_metrics.hrv_ms`, `source = 'healthkit'` | Mean of the day's readings, one row per local day |
| Resting heart rate | `cardio_metrics.resting_hr` | The day's last reading (Apple writes one a day and revises it) |

It never writes to Apple Health. The mapping is plain TypeScript in `src/sync/mapping.ts`, tested from the web repo (`test/mobile.sync.test.ts`). The first sync reads 90 days; later ones re-read the last 3 days whole, so late watch data is caught and a day's average is never taken from half a day.

## Run it in the iOS Simulator (free)

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

## Account

The More tab pushes Account, with the system back chevron and a large title. Sign out asks "Sign out of Intus?" and returns to the sign-in screen. Download my data builds the same JSON file the website saves (the shared `buildExport`) and opens the iOS share sheet. Delete account is a destructive row that opens a system action sheet; only then does the email have to be typed back. Photos and uploaded lab reports are removed, `delete_my_account()` runs, and the keychain, async storage and cache are cleared. Privacy policy and terms open in the app at https://intus.fit/privacy and https://intus.fit/terms. The "Not medical advice" line sits at the bottom of More.

## Settings

`EXPO_PUBLIC_SUPABASE_URL` and `EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY` point it at another Supabase project. Both default to production and are public by design, as on the web; row-level security keeps each person's rows to themselves. The login session is kept in the iOS keychain (`expo-secure-store`).

## Not done yet

- Background sync (HealthKit background delivery). The entitlement is off (`background: false` in `app.json`) until it is built; sync is by the button for now.
- Android and Health Connect (INT-57, INT-101).
- The app icon: the template's placeholder icons are still in `assets/`. INT-50.
