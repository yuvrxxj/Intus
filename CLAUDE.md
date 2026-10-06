# Notes for Claude Code sessions

## Database changes

- Schema changes go in a new file under `supabase/migrations/`, through a pull request. Merging it applies it to
  production (`.github/workflows/migrate.yml`). See `supabase/README.md`.
- Do not apply schema changes with the Supabase connector's `apply_migration` or `execute_sql`. A statement that
  drops or deletes makes the connector ask for a confirmation that never reaches anyone in a cloud session, and
  the call hangs for 60 seconds and times out. Use the connector for reads only (`select`, advisors, logs).
- Never edit a migration that has been merged. Add a new file.
- Do not add files to `supabase/baseline.txt`.

## Checks before pushing

`npm run build`, `npm test` and `npm run test:db` must pass. CI (`.github/workflows/ci.yml`) runs the same three.
