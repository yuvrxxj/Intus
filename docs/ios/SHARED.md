# Shared code: web rules the iPhone app imports

Verified 2026-10-16 by a read-only search of `src/`. Paths are under `src/`. "Runtime" means safe to run in Expo: no `window`, `document`, `localStorage`, `import.meta`, no enum, namespace or constructor parameter property, and no npm package imported at runtime. "Mobile tsc" says what `cd mobile && npm run typecheck` is expected to hit (not yet run against these files).

- `ext`: the file imports siblings with explicit `.ts` extensions. `mobile/tsconfig.json` extends the Expo base, which lacks `allowImportingTsExtensions`, so expect TS5097 until the mobile config adds it (with `noEmit`).
- `chain`: the file has an `import type` from `db/<table>.ts`. It is erased at runtime, but `tsc` follows it to `db/client.ts`, which uses `import.meta.env`. Fix per the brief: point the type import at `db/types.ts` or add a pure `db/rows.ts`. Each web file touched is listed in `PROGRESS.md`.
- `clean`: no problem expected.

| File | Runtime | Mobile tsc | Imports |
| --- | --- | --- | --- |
| `lib/numbers.ts`, `lib/dates.ts`, `lib/sex.ts` | yes | clean | none |
| `lib/ranges.ts` | yes | ext | sex, numbers |
| `lib/safety.ts` | yes | ext | dates, numbers |
| `lib/age.ts` | yes | ext | dates |
| `lib/nutrition.ts` | yes | ext | type sex |
| `lib/trends.ts` | yes | ext | dates |
| `lib/programme.ts` | yes | ext | dates, numbers |
| `features/today/draft.ts` | yes | chain | type `db/dailyLogs`, `db/habits`; `habits/model` |
| `features/habits/model.ts` | yes | chain | type `db/habits`, `db/types`; numbers |
| `features/habits/streaks.ts` | yes | chain | type `db/habits`; dates; `./model` |
| `features/supplements/course.ts` | yes | chain | type `db/medications`; dates |
| `features/supplements/schedule.ts` | yes | chain | type `db/medications`; dates, numbers, course |
| `features/supplements/model.ts` | yes | chain | type `db/medications`; dates, course, schedule |
| `features/bloodwork/model.ts` | yes | chain | type `db/queries`; dates, numbers, safety, ranges, trends |
| `features/bloodwork/entry.ts` | yes | chain | type `db/queries`, `db/biomarkerReadings`; dates, numbers |
| `features/bloodwork/format.ts` | yes | chain | type `./model` (reaches `db/queries`) |
| `features/bloodwork/markerInfo.ts` | yes | clean | none |
| `features/sleep/time.ts`, `ageBand.ts` | yes | clean | none |
| `features/sleep/model.ts` | yes | ext | time |
| `features/sleep/nights.ts` | yes | ext | metrics, model, time |
| `features/sleep/metrics.ts` | yes | ext | type model; time |
| `features/sleep/summary.ts` | yes | ext | dates; type nights; time |
| `features/sleep/format.ts` | yes | ext | type model; time |
| `features/sleep/rows.ts` | yes | ext | type `db/types` (pure); model |
| `features/account/deletion.ts` | yes | clean | none |
| `features/profile/details.ts` | yes | chain | type `db/profile`; age, nutrition, sex |
| `features/profile/profileLine.ts` | yes | chain | type `db/profile`; programme, sex |
| `features/onboarding/model.ts` | yes | chain | type `db/habits`, `db/profile`; age, dates, nutrition, sex; `goals/model`; `habits/model` |
| `features/goals/model.ts` | yes | chain | type `db/profile`; dates, programme |

`features/goals/model.ts` is not on the brief's list; `onboarding/model.ts` needs it.

## Findings

- No shareable file imports an npm package at runtime, so the CI rule (no root `node_modules`) holds for this list. `clsx` and `tailwind-merge` appear only in `lib/utils.ts`, and `chart.js` only in `features/progress/ChartCanvas.tsx`; neither is shared.
- The two `window` hits in `sleep/summary.ts` are in comments.
- No test imports `bloodwork/format.ts`, `profile/details.ts`, `lib/numbers.ts` or `lib/sex.ts` directly. `test/mobile.shared.test.ts` should import every file above so a regression fails loudly.
- Types that tsc follows into the web client: `db/dailyLogs`, `db/habits`, `db/medications`, `db/queries`, `db/biomarkerReadings`, `db/profile`. `db/types.ts` is pure and already safe.
