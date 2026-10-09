# Notes for Claude Code sessions

## Database changes

- Schema changes go in a new file under `supabase/migrations/`, through a pull request. Merging it applies it to
  production (`.github/workflows/migrate.yml`). See `supabase/README.md`.
- Do not apply schema changes with the Supabase connector's `apply_migration` or `execute_sql`. A statement that
  drops or deletes makes the connector ask for a confirmation that never reaches anyone in a cloud session, and
  the call hangs for 60 seconds and times out. Use the connector for reads only (`select`, advisors, logs).
- Never edit a migration that has been merged. Add a new file.
- Do not add files to `supabase/baseline.txt`.

## Notion and Miro

- There is one Notion page, "Intus" (https://app.notion.com/p/3f0ed785ad7881d1b357f89c1abd9048), and one Miro board,
  "Intus" (https://miro.com/app/board/uXjVEeXXqhk=/). Everything for the project goes inside them.
- Never create a new top-level Notion page or a new Miro board. Search first, then add a child page under the
  matching section of the Intus page, or a new numbered frame (a section) on the Intus board below the last one.
- If a page or board for the project already exists elsewhere, move or copy it into these two instead of adding
  another, and tell the user which old ones can be deleted.

## Checks before pushing

`npm run build`, `npm test` and `npm run test:db` must pass. CI (`.github/workflows/ci.yml`) runs the same three.
