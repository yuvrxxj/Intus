# Notes for Claude Code sessions

## Database changes

- Schema changes go in a new file under `supabase/migrations/`, through a pull request. Merging it applies it to
  production (`.github/workflows/migrate.yml`). See `supabase/README.md`.
- Do not apply schema changes with the Supabase connector's `apply_migration` or `execute_sql`. A statement that
  drops or deletes makes the connector ask for a confirmation that never reaches anyone in a cloud session, and
  the call hangs for 60 seconds and times out. Use the connector for reads only (`select`, advisors, logs).
- Never edit a migration that has been merged. Add a new file.
- Do not add files to `supabase/baseline.txt`.

## Linear and Miro: update both, every session

Every session that touches this repo ends with Linear and the Miro board both up to date. That is not optional and
not only when asked. Before you finish, check both, and say in your last message what you changed in each.

- Linear is the one place for daily logging and product management: tasks, roadmap, decisions, research notes and
  the build record. The workspace is "Intus" (https://linear.app/intus), team INT. Web work is in the project
  "Intus"; everything for the iPhone app is in the project "Intus.iOS".
- Keep it current as you work. Move the issue you are on to In Progress. When a change ships, set the issue to Done
  and comment with the PR link. Search before creating an issue and never add a duplicate. Nest a new issue under
  the parent it belongs to (the web MVP launch, safety and thresholds, decisions, mobile, launch run) and label
  anything needed before sign-ups open `MVP launch`.
- Do not use Notion for the project. The old "Intus" Notion page
  (https://app.notion.com/p/3f0ed785ad7881d1b357f89c1abd9048) is an archive and stays as it is.
- Miro is the visual record: journey maps, diagrams, flows and screens. The web app has exactly one board, "Intus"
  (https://miro.com/app/board/uXjVEeXXqhk=/); never create another for it. The iPhone app has its own board,
  "Intus.iOS", the one exception (see the iOS section below). Each session, add a new numbered frame (a section)
  below the last one, or update the latest one, on the board for the app you worked on, to show what the work
  changed. Anything that is a task or a status goes in Linear, not on a board.

## iOS app

- The iPhone app is `mobile/` (Expo, React Native), in this same repository. Do not start a second repo. Its Linear
  project is "Intus.iOS" (https://linear.app/intus/project/intusios-3a51eb1a9ad3); its Miro board is "Intus.iOS"
  (https://miro.com/app/board/uXjVEZLWcBQ=/).
- Run it in the Simulator: build the Debug configuration (`cd mobile && npx expo run:ios --no-bundler`), start Metro
  (`npx expo start --dev-client`) and open it from DeviceHub (Xcode 27 has no Simulator.app). The notes on what broke
  and why are in `mobile/README.md` and `docs/ios/PROGRESS.md`. The Apple Health field map is `docs/ios/APPLE_HEALTH.md`.
- It imports the web's plain TypeScript rules (`src/lib`, the pure `model.ts`-style files) rather than copying them.
  CI has no root `node_modules`, so after committing, check the app the way CI does: `bash scripts/ios-ci-check.sh`.
- Unattended builds use the kit in `docs/ios/` (read `docs/ios/README.md`). It runs only when the launcher sets
  `INTUS_IOS_OVERNIGHT=1`; ordinary sessions are unaffected.
- When an advisor is attached (`claude --model sonnet --advisor opus`), consult it before locking a plan, after the
  same error shows up twice, and before calling a task done. Use the read-only subagents in `.claude/agents/`
  (`repo-search`, `call-sites`, `docs-pull`) for exploring, and `build-qa` for builds and test runs, so long logs stay
  out of the main session.

## Checks before pushing

`npm run build`, `npm test` and `npm run test:db` must pass. CI (`.github/workflows/ci.yml`) runs the same three, and typechecks the iPhone app in `mobile/` (`npm run typecheck` there).
