# Progress: overnight iPhone build

Next action: R2 and its follow-ups are done (Home tab, Yes/No habits, large titles, Apple Health map). Next: R3 account screen (INT-135), then R4 sleep (INT-83), R5 bloodwork (INT-134). Run the app with the steps under "Running the app on this Mac" below.

The agent keeps this file current. A resume after a usage limit starts here, so the line above always says what to do next.

| Rung | What | Linear | State | Notes |
| --- | --- | --- | --- | --- |
| R0 | Read, baseline, Simulator build, Miro board | INT-138 | done except baseline screenshot (see log) | Miro board exists (https://miro.com/app/board/uXjVEZLWcBQ=/) with frames 1 to 3; do not create another |
| R1 | Foundation: shared rules, tokens, fonts, native navigation | INT-132, INT-89 | done | Simulator proof: `docs/ios/screens/01-shell.png` |
| R2 | Daily loop: sign-in, Today, habits, supplements | INT-133 | done | Proof: `02-signin.png`, `03-today.png`, `04-habits.png`; rows read back over REST as the test user |
| R3 | Account: sign out, delete, download | INT-135 | not started | |
| R4 | Sleep and Apple Health | INT-83 | not started | |
| R5 | Bloodwork | INT-134 | not started | |
| R6 | Polish and proof | | not started | |

States: not started, in progress, done, blocked (say why).

Check: `docs/ios/screens/` exists but is empty; three agents still running, no verdicts. Nothing else to do without touching files the Simulator build reads.

Still waiting (all three agents running; a background watcher fires when `docs/ios/screens/01-shell.png` exists). Order on report: Release screenshot, root checks, open draft PR, close R1, start R2.

R2 prep: repo-search running to map the R2 scope (BRIEF.md R2 section, shared rules, data access); read-only, no mobile edits until the Simulator build reports.

Stop-hook resume: two build-qa agents running (Release Simulator build for `01-shell.png`; root build, test, test:db and `ios-ci-check.sh`). Waiting on both verdicts. Then open the draft PR from ios/overnight and close R1.

## R1 plan (draft, before advisor)

1. After the Simulator baseline build finishes: `npx expo install expo-router react-native-safe-area-context react-native-screens expo-linking expo-constants expo-font expo-splash-screen expo-symbols @react-native-async-storage/async-storage @expo-google-fonts/inter @expo-google-fonts/jetbrains-mono`. Set `"main": "expo-router/entry"`, add `scheme`, routes in `mobile/src/app/`.
2. `mobile/tsconfig.json`: `allowImportingTsExtensions` + `noEmit`. Relative imports to `../../src` (no `paths`). Metro config only if the first shared import fails.
3. Fix the `chain` problem with the smallest web change: re-point `import type` from `db/<table>.ts` to pure types. Check with `call-sites` first; web build, test and test:db must stay green; list every web file in this file.
4. Fonts via `useFonts` with `SplashScreen.preventAutoHideAsync()` at module scope; splash `backgroundColor` `#E5ECE9`.
5. Native tabs (Today, Habits, Bloodwork, Supplements, More) with SF Symbols; placeholder screens say plainly they are not built. Prototype large titles in a Stack header first.
6. `test/mobile.shared.test.ts` imports every module in SHARED.md.
7. Prove: Simulator screenshot `01-shell.png`, mobile typecheck, `bash scripts/ios-ci-check.sh`, root build and tests. Commit, push `ios/overnight`, open the draft PR.

## Web files touched

Done to cut the `tsc` chain to `db/client.ts` (advisor point 1: CI has no root `node_modules`, so mobile `tsc` must never reach the client). No behaviour change; types only. Web `npm run build` and `npm test` (408/408) green after the change. `npm run test:db` is not affected (types only) and runs in the final check.

- New `src/db/rows.ts`: pure row and input types (all explicit aliases, none derived from functions).
- `src/db/{dailyLogs,habits,medications,queries,biomarkerReadings,profile}.ts`: type declarations moved to `rows.ts` and re-exported, so web callers are unchanged.
- Shared files re-pointed to `db/rows.ts`: `features/today/draft.ts`, `habits/{model,streaks}.ts`, `supplements/{schedule,course,model}.ts`, `bloodwork/{entry,model}.ts`, `profile/{profileLine,details}.ts`, `onboarding/model.ts`, `goals/model.ts`.

## Decisions made on the founder's behalf

- 20 Oct: a Home tab (the statue bust from the web, breathing, with the light sweep, a greeting and one line about today) is the first tab and the app opens on it. The system tab bar should carry five tabs at most, so Supplements moved under More (Today still lists the doses due). Tabs are now Home, Today, Habits, Bloodwork, More.
- 20 Oct: every tab is a native stack with the system large title. Home is the route group `(home)` because it owns `/`.
- 20 Oct: a yes or no habit is two buttons, Yes and No, neither lit until answered (pressing the lit one clears it). It was a switch, which could not tell "no" from "not answered".
- 20 Oct: the Apple Health field map is `docs/ios/APPLE_HEALTH.md`. The permission sheet was not widened; that is the founder's call.

## Log

Newest first. One entry per rung start, rung finish, and surprise.

- R1 shell written, committed and pushed to ios/overnight: `mobile/src/app/_layout.tsx` (fonts, splash held until loaded), `(tabs)/_layout.tsx` (NativeTabs with SF Symbols), five tab screens (Today, Habits, Bloodwork, Supplements are placeholders that say so; More hosts the existing sign-in and Apple Health sync). `mobile/tsconfig.json` allows `.ts` imports; `mobile/src/shared.ts` imports all 32 shared modules. Surprise: `bash scripts/ios-ci-check.sh` failed on a clean `npm ci` (ERESOLVE: optional peer react-dom@19.3.1 wants react ^19.3.1). Fixed by pinning `react-dom@19.2.3` in `mobile/package.json`; the check now prints ok. Still UNVERIFIED at runtime: NativeTabs props (typecheck passes) and Metro bundling the `.ts` shared imports (needs the Simulator build). Note: the guard reads `2>&1` after `git push` as the branch name, so push with no redirect.

- 2026-10-16 R0 start. Env: Xcode 27.0, Node 24.17.0, INTUS_IOS_OVERNIGHT=1. No node_modules yet in root or `mobile/`.
- R0 step 5 done: Miro board "Intus.iOS" has frames 01, 02, 03 (92 items). Linear project Intus.iOS already links the board and the kit PR (#43). INT-138 is In Progress.
- R0 step 6: Maestro NOT installed. No Java runtime, and brew refuses the `mobile-dev-inc/tap` formula as untrusted (`brew trust` needed). I did not trust a third-party tap unattended. UI checks will be by Simulator screenshot; manual steps go in MORNING.md. Simulators available: iPhone 18 Pro, iPhone 17, others on iOS 27.0.
- R0 step 3: `npm ci` done in root and `mobile/`; `dist/` exists, so the web build ran. Waiting on build-qa for test, test:db and mobile typecheck verdicts, and on repo-search for SHARED.md. Next after those: Simulator baseline build (`cd mobile && npx expo run:ios`), screenshot to `docs/ios/screens/00-baseline.png`.
- R0 step 4 started: second build-qa running the Simulator baseline build (iPhone 17) for `docs/ios/screens/00-baseline.png`, in parallel with the baseline checks and the SHARED.md search.
- R1 prep: docs-pull running for native tabs (expo-router vs react-native-bottom-tabs on SDK 57), Metro watchFolders and tsconfig paths, Inter and JetBrains Mono loading, expo-symbols, async-storage. Waiting on it plus the three R0 agents (baseline checks, SHARED.md search, Simulator build).
- R1 early: wrote `mobile/src/theme/tokens.ts` from `src/styles/index.css` (colours, font names, radii). Font package names (Inter_500Medium and so on) are assumed from @expo-google-fonts; confirm against the docs-pull answer before wiring `useFonts`.
- Linear: INT-132 and INT-89 set to In Progress (R1 work has started with tokens.ts). R0 is not closed until the baseline verdicts, SHARED.md and the Simulator screenshot arrive.
- `cd mobile && npm run typecheck` passes with tokens.ts added (checked directly, short output). Still no `docs/ios/screens/` or `SHARED.md`; the Simulator build and repo-search are still running.
- Holding: four agents still running (baseline checks, SHARED.md search, Simulator build, R1 docs). I am not editing `mobile/app.json` or `package.json` while the Simulator build reads them. Next on the first report: write SHARED.md, then the R1 plan, then ask the advisor before locking it.
- Test style for `test/mobile.shared.test.ts`: `node:test` + `node:assert/strict`, importing `../src/...ts` with explicit extensions, run by `node --test "test/**/*.test.ts"`. The test will import each shared module from the verified SHARED.md list once repo-search reports.
- R0 step 2 done: `docs/ios/SHARED.md` written from repo-search. 30 modules plus `goals/model.ts` are runtime-safe. Mobile tsc will fail on two things: `.ts` extension imports (needs `allowImportingTsExtensions` + `noEmit` in `mobile/tsconfig.json`) and `import type` chains to `db/<table>.ts` (reach `db/client.ts`, `import.meta.env`). Six db files are involved: dailyLogs, habits, medications, queries, biomarkerReadings, profile.
- docs-pull done. Facts for the R1 plan: expo-router `~57.0.25` with native tabs from `expo-router/unstable-native-tabs` (unverified until installed); `react-native-screens ~4.26.0`, `react-native-safe-area-context ~5.7.0`; entry becomes `"main": "expo-router/entry"` with routes in `mobile/src/app/` and a `scheme` in app.json; large titles via a Stack `headerLargeTitle` are UNVERIFIED, prototype first. Metro on SDK 57 resolves outside the project root lazily (no `watchFolders` needed for resolution), tsconfig `paths` are not read by Metro, so use relative imports. Splash `backgroundColor` defaults to `#ffffff`, set it to paper `#E5ECE9`. `expo-symbols ~57.0.3`, `async-storage 2.2.0`. Metro with explicit `.ts` extensions, and the JetBrains Mono package name, are UNVERIFIED; test with one import.
- R0 step 3 done, baseline GREEN (build-qa): `npm ci` root and `mobile/`, `npm run build`, `npm test` (408/408), `npm run test:db` (118/118, about 127s), `cd mobile && npm run typecheck`. Mobile `npm ci` reports 24 audit vulnerabilities (7 moderate, 17 high); not touched tonight. Only the Simulator baseline build (step 4) is left in R0.
- Committed b3e840a on ios/overnight (not pushed yet): `src/db/rows.ts` type move, `test/mobile.shared.test.ts` (64 tests: each of 32 shared modules loads under Node and has no client, browser global or import.meta), `tokens.ts`, SHARED.md. Web build clean, `npm test` green. Still to do before push: `bash scripts/ios-ci-check.sh` via build-qa, after the mobile tsconfig change (so CI sees mobile `tsc` on the shared files). Mobile work waits on the Simulator baseline build.
- R0 step 4 progress: `mobile/ios` generated (git-ignored), iPhone 17 Simulator booted, `expo run:ios --no-bundler` compiling (log in /tmp/expo-ios-build.log). No screenshot yet.
- R0 step 4 SURPRISE: the Debug build succeeded and installed (`fit.intus.app`), but `expo run:ios` then died on `osascript ... System Events` (exit 1): macOS automation permission, no sudo, so it cannot be fixed here. Metro runs on 8081 (started by build-qa). Launching the dev client shows the system prompt "Open in Intus?" for the dev-client deep link, and nothing can tap it (no Maestro, no Accessibility). My first screenshot showed only that prompt, so I deleted it: it is not a baseline. Options: (a) build `--configuration Release` so the JS bundle is embedded and no Metro or prompt is needed, which is the likeliest path for every later screenshot too; (b) find a non-UI way to accept the prompt. The build-qa agent is still working on this; I will not run a second build until it reports.
- R1 plan detail (advisor point 4): `mobile/App.tsx` (170 lines) holds the sign-in card, a `Sync` component (Apple Health connect and sync, `askToRead`, `syncNow`, `lastSync`) and a session listener. When the entry moves to expo-router, keep `SignIn` and `Sync` as components under `mobile/src/` (the session listener becomes a context in `_layout.tsx`), so R2 and R4 can reuse them. `mobile/src/sync/mapping.ts` has no `../src` imports, so there is no existing evidence on Metro and `.ts` extensions; the first shared import is the test.
- Note: the stop hook fired after a dry-run `git push origin HEAD:main`, which the guard refused as designed. Only `git push -u origin ios/overnight` is allowed.

## Running the app on this Mac

Found on 17 Oct (iOS 27 Simulator, Xcode 27.1). None of this was in the earlier notes.

- A Release build fails: Expo's prebuilt Release frameworks were built with Swift 6.3.1 and Xcode 27.1 has 6.4 (`failed to build module 'ExpoModulesCore'; this SDK is not supported by the compiler`). The Debug build works after bumping Expo to 57.0.30 (ExpoModulesCore 57.0.23, ExpoModulesJSI 57.1.2). So screenshots come from Debug plus Metro, not an embedded bundle.
- The iOS 27 SDK crashes an app that does not adopt the UIScene lifecycle (`NoSceneLifecycleAdoption`, SIGTRAP at launch). `mobile/app.json` sets `expo-build-properties` `ios.enableSceneSupport: true`, which needs Expo 57.0.23 or newer. The earlier baseline build never showed the app for this reason.
- Metro needs the repo root to resolve the shared rules: `mobile/metro.config.js`.
- Steps: `cd mobile && npx expo prebuild --platform ios --no-install && (cd ios && pod install)`, then `npx expo run:ios --device <simulator id> --no-bundler` (its final `osascript` step fails with exit 1; the build and install are fine), then `npx expo start --dev-client` and open `exp+intus://expo-development-client/?url=http%3A%2F%2Flocalhost%3A8081`. The system prompt "Open in Intus?" is tapped with Maestro (`maestro test` on a flow with `tapOn: "Open"`); Maestro needs a JDK on PATH (`/opt/homebrew/opt/openjdk/bin`).
- Maestro flows are in `mobile/.maestro/`. `signin.yaml` takes the account with `-e EMAIL=... -e PASSWORD=...`. Maestro writes the typed values into `~/.maestro/tests`; delete that folder afterwards.
- The Simulator keyboard shows a first-use "Type English and Hindi" tip that swallows the first typed text; tap Continue on it once.

## R2 notes

- Writes: `mobile/src/data/outbox.ts` (queue per user in AsyncStorage, newest entry per day wins, an entry leaves the queue only after the send works, tested in `test/mobile.outbox.test.ts`). Today shows "Not sent yet" and the server's own error while an entry is queued. A queued entry is read back in place of the server row after a relaunch.
- Numeric fields are capped by `maxLength` so a value cannot overflow the integer columns and jam the queue (seen once in testing: `210021002100`).
- Number pads have no return key, so `Screen` shows its own Done bar above the keyboard (the system `InputAccessoryView` did not render on this SDK).
- Large titles are plain text inside the scroll view, not a native large title; native large titles inside NativeTabs are still unverified.
- Streaks: `mobile/src/today/streaks.ts`, tested in `test/mobile.today.test.ts`.
- The test account had no habits or supplements, so three habits (Lift, Cigarettes, Steps) and two supplements (Vitamin D, Magnesium twice a day) were added through the normal API as the test user.
- Sign out is a button on More for now; R3 replaces that screen.

## Running it: DeviceHub, not Simulator

Xcode 27 has no Simulator.app. The window is `/Applications/Xcode.app/Contents/Applications/DeviceHub.app`. `open -a Simulator` does nothing, and the device still boots headless, which is why the app ran without a window on 17 Oct.
