# Morning note: where the iPhone app is

Written 21 Oct 2026, after a night's work on branch `ios/overnight`. Draft pull request: https://github.com/yuvrxxj/Intus.web/pull/44 (not merged; `main` deploys to intus.fit).

## How to see it running

Xcode 27 has no "Simulator" app. The window is **DeviceHub** (`/Applications/Xcode.app/Contents/Applications/DeviceHub.app`); pick iPhone 17 in it. The app needs Metro running:

```
cd ~/dev/Intus.ios/mobile && npx expo start --dev-client
```

Then open Intus in DeviceHub (second home-screen page) and tap Open on "Open in Intus?". It is signed in as the throwaway test account.

## What works (all seen working in the iOS 27 Simulator, with screenshots in `docs/ios/screens/`)

- **Home** (new): the statue bust from the web, breathing, with the light band crossing it; a greeting; one line about today; a button into the log. `01-home.png`
- **Sign in** and a signed-out gate. `02-signin.png`
- **Today:** weight, calories, macros, mood, notes, habits, supplements due. Saved through a local queue, so nothing is lost offline; "Not sent yet" shows until it goes. A saved day survived killing and relaunching the app, and the row read back over REST. `03-today.png`
- **Habits:** Yes and No buttons for a yes or no habit (it was a switch), a stepper for counts, a number for amounts, streaks from the shared rules. `04-habits.png`
- **Bloodwork:** the web's own rules for ranges and critical limits, imported, not copied. Printed range first, never another sex's default, a critical banner, change since the previous result, the marker sheet, adding a result with the web's checks (including the wrong-unit warning). `09`, `10`, `11`
- **Sleep:** nights, the 28 day summary after five nights, the age band, adding a night. `07-sleep.png`
- **Apple Health:** both of Apple's permission sheets, then a sync. A resting heart rate typed into the Simulator's Health app arrived in `cardio_metrics`. `08-apple-health.png`
- **Account:** sign out, download my data (a JSON file through the share sheet), privacy and terms links, delete account up to the confirm step. `06-account-data-legal.png`
- The largest text size lays out readably (`12-largest-text-today.png`). A Maestro smoke flow opens every tab (`mobile/.maestro/smoke.yaml`).

## What does not, and exactly why

- **Delete account was never run end to end.** There is no second test account. Add a throwaway user in Supabase (Authentication, Users, Add user, auto confirm) and put `INTUS_TEST_EMAIL_2` and `INTUS_TEST_PASSWORD_2` in `~/intus-ios-test.env`. I did not press the final delete on the main test account. INT-135 stays In Progress for this.
- **A sleep sample from Apple Health was not tried**, only a heart rate. INT-83 stays In Progress.
- **"Shows on intus.fit and the reverse"** (INT-133, INT-134): I confirmed the rows over the API, not by opening the website. Check when you are up: sign in to intus.fit as the test account and look for hemoglobin 14.2 on 21 Oct 2026, and the logged day.
- **No Release build.** Expo's prebuilt Release frameworks fail with Xcode 27.1's Swift 6.4. Everything here is Debug plus Metro. This blocks a TestFlight build until Expo ships a fix or we build those pods from source.
- **Offline behaviour** is covered by unit tests of the queue and by "Not sent yet" states, but I did not switch the Simulator's network off and watch.
- **VoiceOver** labels are on every control, but I did not run VoiceOver.
- **Not built tonight (out of scope):** PDF upload and on-device reading of reports, bloodwork charts, the print view, sleep charts, editing a night.

## Web files touched

Types only, no behaviour change (web build, `npm test` and `npm run test:db` green after): new `src/db/rows.ts`; the table files `dailyLogs`, `habits`, `medications`, `queries`, `biomarkerReadings`, `profile` re-export from it; the shared models `features/today/draft.ts`, `habits/{model,streaks}.ts`, `supplements/{schedule,course,model}.ts`, `bloodwork/{entry,model}.ts`, `profile/{profileLine,details}.ts`, `onboarding/model.ts`, `goals/model.ts` import their row types from it. Plus new tests in `test/` (all prefixed `mobile.`).

## Proposals and migrations

None. `docs/ios/PROPOSED_CHANGES.md` and `PROPOSED_MIGRATION.sql` were not needed. No schema change.

## Only you can do

1. **Real iPhone (INT-136):** your Apple ID in Xcode, Developer Mode on the phone, then `npx expo run:ios --device`. Check that HealthKit is allowed on a free team first.
2. **Decide the Apple Health scope** (INT-147). `docs/ios/APPLE_HEALTH.md` maps every Intus field: 3 connected today, 11 more possible (steps, active calories and exercise minutes should lock when Health supplies them; weight, food and water should prefill and stay editable), 4 not possible. Widening the permission sheet means changing the permission text, the in-app copy and the privacy policy.
3. **Welcome screen look:** the bust is a mock to try. Say if you want ASCII art instead.
4. **The second test account** (above) and the **website check** (above).
5. Delete the throwaway test account in Supabase and remove `~/intus-ios-test.env` when you are done testing.

## Decisions I made for you

- Home is the first tab and the app opens on it; Supplements moved under More so the tab bar stays at five.
- A yes or no habit is two buttons, neither lit until answered, so "no" and "not answered" differ.
- Seeded the test account through the normal API (as the test user): three habits, two supplements, eight nights of sleep, a date of birth in the profile, eight bloodwork results (one critical) and a hemoglobin typed in the app. All of it is throwaway.
- Upgraded Expo 57.0.27 to 57.0.30 and turned on the scene lifecycle, because the iOS 27 SDK would not run the app otherwise.
- Installed the Maestro CLI and OpenJDK with Homebrew (a first install pulled an unrelated app; I removed it).
- Did not widen Apple Health, did not touch the migrations, `.github/`, `vercel.json` or any `.env` file, did not push to `main`, did not use EAS or the Apple Developer Program.

## How close to TestFlight

The app does the daily loop, bloodwork, sleep and the account. Still to do before a first beta: the Release build problem above; the real-iPhone run (INT-136); the Apple Developer Program (INT-137); the deletion test end to end; the privacy policy and permission strings for whatever Health scope you pick; app icon and screenshots for the store. A rough guess is a week of focused work, most of it the build and the Apple side, not screens.

## Linear and Miro

Linear (project Intus.iOS): INT-132, INT-89, INT-133 and INT-134 Done; INT-135 and INT-83 In Progress with comments saying what is left; new issues INT-145 (Home, Done), INT-146 (Yes/No habits, Done), INT-147 (Apple Health scope, Todo). Miro board "Intus.iOS": frame "04 Simulator screenshots" holds the first four shots (taken before the Yes/No habits and the Home tab, so Today and Habits there are the older look); frame "05 More screens, 21 Oct" has Home, Sleep, Bloodwork and Apple Health. The rest are in `docs/ios/screens/`.
