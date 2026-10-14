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
  the build record. The workspace is "Intus" (https://linear.app/intus), team INT, project "Intus".
- Keep it current as you work. Move the issue you are on to In Progress. When a change ships, set the issue to Done
  and comment with the PR link. Search before creating an issue and never add a duplicate. Nest a new issue under
  the parent it belongs to (the web MVP launch, safety and thresholds, decisions, mobile, launch run) and label
  anything needed before sign-ups open `MVP launch`.
- Do not use Notion for the project. The old "Intus" Notion page
  (https://app.notion.com/p/3f0ed785ad7881d1b357f89c1abd9048) is an archive and stays as it is.
- Miro is the visual record: journey maps, diagrams, flows and screens. There is exactly one board, "Intus"
  (https://miro.com/app/board/uXjVEeXXqhk=/). Never create a new board. Each session, add a new numbered frame (a
  section) below the last one, or update the latest one, to show what the work changed. Anything that is a task or
  a status goes in Linear, not on the board.

## Checks before pushing

`npm run build`, `npm test` and `npm run test:db` must pass. CI (`.github/workflows/ci.yml`) runs the same three, and typechecks the iPhone app in `mobile/` (`npm run typecheck` there).
