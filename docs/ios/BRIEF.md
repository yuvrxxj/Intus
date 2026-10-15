# Brief for the overnight iPhone build

You are Claude Code, running unattended on the founder's Mac in bypass mode, with Sonnet as the main model and Opus as the advisor. Nobody is awake. Nobody will answer a question. Decide, write the decision down, and keep going. This file is your whole instruction set; read it all before you start, and again after any long pause.

## 1. The mission

Turn the thin HealthKit sync companion in `mobile/` into an iPhone app that does the daily loop natively, on the same Supabase project as intus.fit, looking and behaving like an iPhone app: Apple's design language in Intus's colours and typefaces.

Done tonight means a **Simulator-verified slice**, rung by rung (section 6), with a screenshot and a passing check for each. It does not mean web parity, App Store readiness, or the real iPhone. Finishing three rungs properly beats starting six. Order is fixed; go down the ladder.

The founder's words: "a working, fully functional iOS app by the time I wake up". Be honest in the morning about how close that is. Never report something as working that you did not see work.

## 2. Hard limits

A guard (`.claude/hooks/guard.mjs`) enforces these and will block you with a message if you try. Do not look for ways round it. If a block is wrong for what you need, record the need in `docs/ios/PROPOSED_CHANGES.md` and carry on with something else.

- **Same repo, same branch.** Work only in this repository (`yuvrxxj/Intus.web`) on branch `ios/overnight`. No new repo. Push only to `ios/...` branches. Never push to `main`, never force-push, never merge, never close a pull request. Open one **draft** pull request into `main` after rung 1 and keep pushing to it.
- **No production changes.** Do not touch `supabase/migrations/`, `supabase/baseline.txt`, `supabase/apply-migrations.sh`, `.github/`, `vercel.json` or any `.env` file (the guard blocks writes there). Merging a migration applies it to the live database. If you believe a schema change is needed, write the SQL to `docs/ios/PROPOSED_MIGRATION.sql` with the reason and stop that line of work.
- **No database tools beyond reads.** Supabase connector reads only (`list_tables`, `get_advisors`, `query_logs`, `get_publishable_keys`, `generate_typescript_types`). No `apply_migration`, no `execute_sql`, no Supabase CLI, no `psql`. The app reads and writes as the test user through the normal API, under row-level security.
- **No spending, no accounts.** No EAS, no TestFlight, no Apple Developer Program, no `--device`, no `-allowProvisioningUpdates`, no Vercel, no email, no CRM, no Zapier. Simulator only.
- **No root.** No `sudo`. If a tool is missing, say so in `MORNING.md` and work around it.
- **Secrets.** The test account is in the environment as `$INTUS_TEST_EMAIL` and `$INTUS_TEST_PASSWORD`. Use them in the command that needs them. Never print them, never write them to a file, never put them in a commit, a log, a screenshot or a Linear comment. The Supabase URL and publishable key in `mobile/src/supabase.ts` are public by design and fine to leave. The service key must never be used.
- **Health data is private.** Use only the test account. No real person's data, no real lab report, no real photo.
- **The web app must not break.** `main` deploys to intus.fit when it is merged, so any web file you touch must keep `npm run build`, `npm test` and `npm run test:db` green. Prefer not to touch web files; when you must (to make a pure module shareable), keep the change small and list it in `PROGRESS.md`.
- **Write like the repo.** No em dashes anywhere. Plain words. Match the comment density, naming and idiom of the surrounding code. No emojis, confetti or sounds in the app.

## 3. The people and tools you have

### You (Sonnet, main session)
You plan, implement, test and report. Keep your own context for the code. Do not read build logs, do not read whole files you only need a line of; delegate that.

### The advisor (Opus)
It sees your whole transcript when consulted and returns guidance. Consult it:
1. **Before you lock the plan for a rung.** Say what you intend to do and ask what it would get wrong.
2. **After the same error twice.** Not the third time.
3. **Before you call a rung done.** Ask it to look for what you have not checked.
4. **Before the final report.**

Ask a precise question each time. Treat its answer as advice: if your own evidence contradicts it, say so in `PROGRESS.md` and follow the evidence.

### Subagents (`.claude/agents/`)
- `repo-search` (Haiku, read-only): where things live and how they connect. Use before planning anything.
- `call-sites` (Haiku, read-only): every use of a symbol, table or column. Use before moving or sharing code.
- `docs-pull` (Haiku, read-only): exact current API reference for Expo, React Native, supabase-js, `@kingstinct/react-native-healthkit`, Apple HIG, SF Symbols, Maestro. Use instead of recalling an API from memory.
- `build-qa` (Sonnet, runs commands, never edits): every Xcode or Expo build, test run and Simulator screenshot. It returns a short verdict, so thousands of log lines never reach you.

Run independent subagents in parallel. Ask each for a short answer with `path:line` evidence.

### Linear and Miro
The workspace is "Intus", team INT. Everything for the phone app is in the project **Intus.iOS** (https://linear.app/intus/project/intusios-3a51eb1a9ad3). Tasks, status and decisions go in Linear; visuals go in Miro. Never use Notion.

Issues, in the order you will meet them:

| Rung | Linear issue | Purpose |
| --- | --- | --- |
| R1 | INT-132 (and INT-89, close it with INT-132) | Shared rules, tokens, fonts, native navigation |
| R2 | INT-133 | Sign-in, Today, habits, supplements |
| R3 | INT-135 | Sign out, delete account, download my data |
| R4 | INT-83 | Sleep screen and Apple Health |
| R5 | INT-134 | Bloodwork |
| any | INT-138 | The Miro board "Intus.iOS" |
| morning | INT-136 | Install on the real iPhone (the founder does this; do not start it) |
| later | INT-137 | TestFlight (not tonight) |

Move an issue to **In Progress** when you start its rung and to **Done** when the rung is done, with a comment: what changed, the commit, the pull request link, the screenshot paths. Search before you create any new issue; nest a new one under INT-97 and put it in the Intus.iOS project. Never delete anything in Linear.

**Miro:** create one new board named **Intus.iOS** (the founder asked for it; this is the one exception to the single-board rule in `CLAUDE.md`, which this run updates). Do not edit the existing "Intus" board. Frames, in order: (1) the design system carried over from the web, (2) how each web element maps to an Apple HIG component, (3) the screen map and the sign-in to Today flow, (4) Simulator screenshots as each rung lands. Follow the Miro tools' own canvas guidance (`canvas_get_canvas_composer_skill`) before drawing. Never share the board or change its permissions.

## 4. Design system: carry the web over, in Apple's language

Read `src/styles/index.css` for the tokens and `README.md` ("Design") for the rules. Do not invent colours.

- **Colours:** red `#A31621` (actions, current item), paper `#E5ECE9` (background), surface `#F2F5F3`, green `#12695F` (on track), ink `#1F1300` (text), ink-3 `#5A5446` (secondary text), ochre `#8A5A14` ("close", "check this"), line `rgba(31,19,0,0.12)`. Put them in one file, `mobile/src/theme/tokens.ts`, and use nothing else.
- **Type:** Inter for titles and text, JetBrains Mono for numbers, labels and units. Weights: body 500, medium 600, semibold 700. React Native cannot load the web's variable woff2 files, so use the same typefaces as static TTFs (`@expo-google-fonts/inter`, `@expo-google-fonts/jetbrains-mono`, loaded with `expo-font`; both are SIL OFL). Support Dynamic Type: no fixed heights on text containers.
- **Appearance:** light only, as `app.json` says (`userInterfaceStyle: light`). Dark mode is a later decision; do not build it.
- **Apple's design language** (the Human Interface Guidelines are the authority; use `docs-pull` to read the current pages, and note the date):
  - Navigation: the system tab bar at the bottom (no more than five tabs) and large navigation titles. Prefer native components so the system look, including iOS 26's Liquid Glass where it applies, comes for free: first choice a native tab bar (`expo-router`'s native tabs or `react-native-bottom-tabs`, whichever `docs-pull` confirms works with the installed Expo SDK), fallback React Navigation's bottom tabs styled to match.
  - Lists and forms: grouped inset sections, system text fields, pull to refresh, swipe actions where they fit, sheets with detents for pickers and info.
  - Icons: SF Symbols (`expo-symbols`), not an icon font.
  - Haptics: one light haptic on a successful save, nothing else.
  - Accessibility: a VoiceOver label on every control, 44 pt minimum targets, contrast at least WCAG AA (check red on paper and ochre on paper).
- **Web element to iOS element:**

| On the web | On the iPhone |
| --- | --- |
| Frosted top nav with six pages | System tab bar: Today, Habits, Bloodwork, Supplements, More (Sleep, Account) |
| Page title with ASCII artwork | Large navigation title; leave the ASCII art out this pass |
| Cards | Grouped inset sections on the paper background |
| Red button | System prominent button in the red tint |
| Popover (marker info) | Sheet with a medium detent |
| Dive deeper on a chart | Pushed detail screen |
| Footer disclaimer | One line at the bottom of More; the only disclaimer in the app, as on the web |

- Keep the product rules the web already has: no medical advice copy beyond the one footer line, no colouring a change good or bad where the web does not, ranges flagged and never diagnosed.

## 5. Architecture decisions (already made; do not reopen)

- **React Native with Expo**, decided 6 Oct (INT-22). No SwiftUI rewrite.
- **One repo.** The app is `mobile/`. Web code stays in `src/`.
- **Share the rules, not the screens.** The app imports the web's plain TypeScript (`src/lib/*`, and the pure `model.ts`-style files in `src/features/*/`) from one source. No copies. Share:
  - `src/lib/`: `ranges.ts`, `safety.ts`, `numbers.ts`, `dates.ts`, `age.ts`, `sex.ts`, `nutrition.ts`, `trends.ts`, `programme.ts`
  - `src/features/today/draft.ts`, `habits/model.ts`, `habits/streaks.ts`, `supplements/{model,schedule,course}.ts`, `bloodwork/{model,entry,format,markerInfo}.ts`, `sleep/{model,nights,metrics,summary,ageBand,time,format,rows}.ts`, `account/deletion.ts`, `profile/{details,profileLine}.ts`, `onboarding/model.ts`
  - Not shareable (they use `window`, `document`, `localStorage`, `import.meta` or the DOM): `export/model.ts`, `account/localData.ts`, `dashboard/usePage.ts`, `home/useRoute.ts`, `mobile/device.ts`, `photos/image.ts`, `reports/extract.ts`, `today/hfmImage.ts`. Check every file with `repo-search` before importing it; this list was made by a quick search, not a proof.
- **Data layer:** the web's `src/db/*.ts` imports the web Supabase client (`import.meta.env`), so do not import it at runtime. Write thin wrappers in `mobile/src/data/` on the app's own client (`mobile/src/supabase.ts`, session in the keychain), with the same tables, columns and `onConflict` targets as the web: `daily_logs` upserts on `user_id,log_date`; `sleep_sessions` on `user_id,source_kind,source_name,external_id`; `cardio_metrics` on `user_id,measured_at,source`. `user_id` is filled by the database from the login. Row types come from `src/db/types.ts` (types only). Numeric columns can arrive as strings: always read a number that decides anything through `src/lib/numbers.ts`. The API caps a response at 1000 rows: page like `src/db/paging.ts`.
- **Offline-safe writes:** anything the person types is saved to a local outbox first, then sent (see `src/features/strength/queue.ts` for the web's version of the idea). A closed app or a lost connection must never lose an entry. Use `@react-native-async-storage/async-storage` for the outbox (the keychain is for the session only).
- **State:** React context and hooks. No state library.
- **No new paid or account-bound service.** Libraries must be free and installable with npm.
- **Check versions before you code.** The app is on Expo SDK 57 and React Native 0.86. Install with `npx expo install <pkg>` so the versions match the SDK. If a library does not support the installed SDK, find another way and say so in `PROGRESS.md`.

### Sharing gotchas (found in the code; read before R1)

1. Shared files import each other with explicit `.ts` extensions (Node runs them directly in the tests). Metro resolves that. The app's TypeScript config must allow it (`allowImportingTsExtensions`, with `noEmit`).
2. Metro needs the repo root in its `watchFolders`, and an alias or relative paths to `../src`. Expo reads `tsconfig` `paths`; confirm with `docs-pull`.
3. Several pure models import **types** from `src/db/<table>.ts`, and those files import the web client. `import type` disappears at runtime, so Metro is fine, but `tsc` in `mobile/` follows the import into `import.meta` and fails. The smallest fix that is allowed: point the model's type import at `src/db/types.ts` (pure), or add a pure `src/db/rows.ts` that `<table>.ts` re-exports. Web tests and the web build must stay green. List every web file you touch.
4. The web TypeScript config has `erasableSyntaxOnly`: shared code may not use enums, namespaces or constructor parameter properties.
5. **CI has no root `node_modules`.** The `mobile` CI job runs `npm ci` and `npm run typecheck` inside `mobile/` only. A shared file that imports an npm package missing from `mobile/package.json` passes on this Mac and fails in CI. Run `bash scripts/ios-ci-check.sh` (through `build-qa`) after committing and before every push.
6. `mobile/src/sync/tsconfig.json` exists so the web build can import `mobile/src/sync/mapping.ts`. Do not break that; the web's `src/features/import` depends on it.
7. `mobile/ios/` and `mobile/android/` are generated and git-ignored. Never commit them.

## 6. The ladder

Work top to bottom. For each rung, run the loop in section 7. Update `docs/ios/PROGRESS.md` when you start a rung, when you finish it, and whenever something surprising happens.

### R0: before the first line of app code
1. Read `CLAUDE.md`, `mobile/README.md`, `supabase/README.md`, `README.md` (the "Design" and "Bloodwork and safety" parts), and every file in `docs/ios/`.
2. `repo-search` the shared-code list in section 5. Write the verified list to `docs/ios/SHARED.md`.
3. Install dependencies (`npm ci`, then `cd mobile && npm ci`). Run the baseline: `npm run build`, `npm test`, `npm run test:db`, `cd mobile && npm run typecheck`, via `build-qa`. If the baseline is red, record exactly what and carry on only if the failure is in something you are not touching.
4. Build the unchanged app in the Simulator (`cd mobile && npx expo run:ios`) and take a screenshot to `docs/ios/screens/00-baseline.png`. If this fails, nothing else can be verified: spend up to 90 minutes fixing the environment, then record the blocker and do everything that does not need the Simulator (types, models, unit tests) so the morning is not wasted.
5. Create the Miro board "Intus.iOS" and its first three frames (INT-138). Link it from the Linear project (a resource link on the project).
6. Install Maestro for UI checks if it installs cleanly in ten minutes (`brew tap mobile-dev-inc/tap && brew install maestro`, which needs Java 17 or newer). If not, verify by screenshot and note the manual steps in `MORNING.md`.

### R1: foundation (INT-132, INT-89)
- Metro and TypeScript set up to import the shared rules from `src/` (section 5).
- `mobile/src/theme/tokens.ts`, fonts loaded, a splash that does not flash white.
- Native tab bar and navigation shell with the five tabs and large titles; placeholder screens for the tabs not built yet that say so plainly.
- Done when: the app launches in the Simulator on the new shell (screenshot `01-shell.png`), `cd mobile && npm run typecheck` and `bash scripts/ios-ci-check.sh` pass, web build and tests still green, and a node test imports every shared module you chose (`test/mobile.shared.test.ts`), so a future change that makes one non-shareable fails loudly.
- Open the draft pull request now.

### R2: the daily loop (INT-133)
Read `src/features/auth/`, `today/`, `habits/`, `supplements/` first (via `repo-search`).
- Sign-in (email and password, using `supabase.auth.signInWithPassword`; keep the existing keychain session). "Forgot password" sends the reset email and says to finish on intus.fit. No sign-up here: accounts are made on the web.
- Today: weight, calories, protein, carbs, fat, mood and notes, the habit check-ins, and the supplements due today, saved to `daily_logs` using `draftFromLog` and `recordFromDraft`. Load today's row first so earlier entries are never overwritten with blanks.
- Habits: check in by kind (count, yes or no, amount against a goal), with streaks from `habits/streaks.ts`.
- Supplements due today from the schedule rules in `supplements/schedule.ts`.
- Writes go through the outbox. Show "not sent yet" on anything unsent.
- Done when, as the test account: sign in on the Simulator, log a day, tick a habit, kill and relaunch the app and see the same values, and read the same rows back over the REST API with the test user's token (a `curl` GET with the public key, never the service key). Screenshots `02-signin.png`, `03-today.png`, `04-habits.png`. Unit tests for any new pure code, in `test/`.

### R3: account (INT-135)
Read `src/features/account/` and `src/db/account.ts`, `photos.ts`, `labReports.ts`.
- Sign out; delete account; download my data; links to the privacy policy and terms on intus.fit (open in the system browser).
- Delete account follows the web exactly: type the email back, then `runDeletion` (shared; it removes the photos, then the uploaded lab reports, then calls `delete_my_account`), then clear device storage and sign out. Port the two Storage removals to the app's client against the buckets `check-in-photos` and `lab-reports` (list `<user id>/`, remove, list again to prove it is empty).
- **Do not press the final delete on the main test account.** Prove the order with unit tests on `runDeletion` and the Storage helpers, and prove the screen up to the confirm step (button disabled until the email matches). If `INTUS_TEST_EMAIL_2` and `INTUS_TEST_PASSWORD_2` exist in the environment, you may delete that second account end to end and confirm it is gone. Say which you did.
- Done when the above holds. Screenshot `05-account.png`.

### R4: sleep and Apple Health (INT-83)
Read `src/features/sleep/` and `mobile/src/sync/`, `mobile/src/healthkit.ts`.
- A Sleep screen on the shared rules: nights built from sources (`nights.ts`), averages only after five nights (`summary.ts`), the age band (`ageBand.ts`). Manual entry as a fallback, through the outbox.
- Apple Health: the existing connect and sync flow, the permission sheet, a clear status. Read-only: the app never writes to Apple Health.
- Done when the Sleep screen shows nights from `sleep_sessions` rows for the test account (create a few by the manual entry form), the mapping tests still pass, and the connect flow runs up to the system permission sheet. Getting through the HealthKit sheet and a real sample into the Simulator's Health app is **best effort**: try for at most 60 minutes. If it will not work, say exactly where it stops in `MORNING.md` and move on. Screenshot `06-sleep.png`.

### R5: bloodwork (INT-134)
Read `src/features/bloodwork/`, `src/lib/ranges.ts`, `src/lib/safety.ts`. This rung is safety-sensitive: use the shared code, do not re-implement a range or a critical rule.
- Results grouped by marker, each against the range printed on its own report (never a man's range for a woman), the arrow against the previous result, critical flags from the stored limits.
- Marker info as a sheet (`markerInfo.ts`).
- Manual entry with the web's checks: plain decimals, one result per marker per day, a number ten times outside the usual range asks for confirmation, units never converted (`entry.ts`).
- Out of scope: PDF upload and on-device reading, charts, the print view.
- Done when a result entered on the phone appears in a read of the table with the right range and flag, using the test account's profile, with a unit test for any new glue. Screenshot `07-bloodwork.png`.

### R6: polish and proof
- Empty, loading, error and offline states on every screen. Dynamic Type at the largest size on the Today and Bloodwork screens. VoiceOver labels checked on the main controls.
- If Maestro works: one smoke flow (`mobile/.maestro/smoke.yaml`) that signs in, opens each tab and checks a heading. Do not put the password in the flow file; pass it with `-e`.
- Run the whole check list once more (section 8), fix what is red, update every Linear issue, and finish the Miro frames with the screenshots.

## 7. The loop for each rung

1. **Plan.** `repo-search` and `call-sites` in parallel for what you will touch; `docs-pull` for any API you are unsure of. Write the plan in three to ten lines at the top of the rung's entry in `PROGRESS.md`. **Consult the advisor** before you lock it.
2. **Linear:** set the rung's issue to In Progress.
3. **Build.** Small steps. After each step the cheapest check that could fail (typecheck, a unit test).
4. **Prove.** `build-qa` builds and launches in the Simulator and takes the screenshot. Look at the screenshot yourself (read the image); do not trust "it built". Check the rows with a REST read as the test user.
5. **Consult the advisor** before calling the rung done. Fix what it finds, or write down why not.
6. **Commit** on `ios/overnight` with a clear message and the repo's attribution lines. Run `bash scripts/ios-ci-check.sh` through `build-qa`. If green, **push the branch** (`git push -u origin ios/overnight`, the only push form allowed).
7. **Linear:** Done, with a comment (what changed, commit, pull request link, screenshots). **Miro:** add the screenshot to frame 4.
8. **PROGRESS.md:** mark the rung done, note anything the founder should know.

When the same error comes up twice, consult the advisor. When it comes up a third time, stop that line of work: write down what you tried in `PROGRESS.md`, mark the rung or the sub-task **blocked**, and move to the next rung. A rung that has taken more than about three hours of wall-clock time gets the same treatment. Never leave the branch in a state where `npm run build`, `npm test` or `cd mobile && npm run typecheck` is red; revert the last step if you must.

## 8. The checks (all must be green before the final push)

```
npm run build
npm test
npm run test:db
cd mobile && npm run typecheck
bash scripts/ios-ci-check.sh
```

Run them through `build-qa`. Also run `node --test ".claude/hooks/*.test.mjs"` once at the end to prove the guard is still intact.

## 9. Running out of usage

If you are cut off by a usage limit, the launcher script waits and resumes this same conversation at 05:01 IST (23:31 UTC) on 16 Oct 2026 and runs the prompt again. So: keep `docs/ios/PROGRESS.md` current at all times, with the next action written at the top, so that a resume costs nothing. On resume, read `PROGRESS.md` first and continue from the first rung that is not done. At about 05:00 IST the launcher writes a status line to `~/ios-overnight-logs/checks.log`; nothing is needed from you for that.

## 10. Finishing

When every rung is done or marked blocked:
1. Write `docs/ios/MORNING.md`: what works (with the screenshots), what does not and exactly why, every web file you touched, every proposal in `PROPOSED_CHANGES.md` or `PROPOSED_MIGRATION.sql`, what only the founder can do (install on the real iPhone with a free Apple ID, INT-136; the HealthKit sheet; deleting the test account; the second-account delete test), the decisions you made on their behalf, and an honest estimate of how close this is to a TestFlight build.
2. Update `CLAUDE.md`: an "iOS app" section (where the app lives, the Linear project, the Miro board, how to run it in the Simulator, the advisor rule), and change the single-board Miro rule so it mentions the Intus.iOS board.
3. Update `mobile/README.md` so it describes the app as it now is, not the sync companion.
4. Final Linear pass: every issue you touched is in the right state with a comment. Final Miro pass: all four frames filled.
5. Push, and make sure the draft pull request description lists what changed, what was verified and how, what was not, and the five check results.
6. Say in your last message what you changed in Linear and in Miro.
7. Create `docs/ios/DONE` containing `COMPLETE` (or `STOPPED`) and one line saying why. Do this last. Until it exists, the session will not let you stop.

Do not delete the test account, do not merge, do not announce anything outside Linear and Miro.
