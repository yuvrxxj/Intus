# Notes for Claude Code sessions

## Database changes

- Schema changes go in a new file under `supabase/migrations/`, through a pull request. Merging it applies it to
  production (`.github/workflows/migrate.yml`). See `supabase/README.md`.
- Do not apply schema changes with the Supabase connector's `apply_migration` or `execute_sql`. A statement that
  drops or deletes makes the connector ask for a confirmation that never reaches anyone in a cloud session, and
  the call hangs for 60 seconds and times out. Use the connector for reads only (`select`, advisors, logs).
- Never edit a migration that has been merged. Add a new file.
- Do not add files to `supabase/baseline.txt`.

## Linear and Miro

- Linear is the one place for daily logging and product management: tasks, roadmap, decisions, research notes and
  the build record. The workspace is "Intus" (https://linear.app/intus), team INT, project "Intus".
- Keep it current as you work. Move the issue you are on to In Progress. When a change ships, set the issue to Done
  and comment with the PR link. Search before creating an issue and never add a duplicate.
- Do not use Notion for the project. The old "Intus" Notion page
  (https://app.notion.com/p/3f0ed785ad7881d1b357f89c1abd9048) is an archive and stays as it is.
- Miro is only for visualisation (journey maps, diagrams, flows), and only when one is needed. There is one board,
  "Intus" (https://miro.com/app/board/uXjVEeXXqhk=/). Never create a new board. Add a new numbered frame (a section)
  below the last one. Anything that is a task or a status goes in Linear, not on the board.

## Checks before pushing

`npm run build`, `npm test` and `npm run test:db` must pass. CI (`.github/workflows/ci.yml`) runs the same three.
