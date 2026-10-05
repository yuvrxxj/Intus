# Database access

Every person sees only their own rows. The database enforces this with row level security, so it holds even
if someone calls the API directly with the public key in the app.

| File | What it does | Applied to the live project? |
| --- | --- | --- |
| `20261001000100_app_owner.sql` | Adds the `app_owner` table and an owner check | Yes |
| `20261001000150_private_is_owner.sql` | Moves the owner check into a private schema | Yes |
| `20261001000200_owner_lockdown.sql` | Replaces the open policies with owner-only ones | Yes |
| `20261005000100_per_user_data.sql` | Adds `user_id` to every personal table, assigns existing rows to the owner, and replaces owner-only with per-person policies | **No, see below** |
| `20261005000200_drop_single_user_unique.sql` | Drops the one-person `unique(log_date)` on `daily_logs` | **No, apply last** |

## Applying the per-user change

Order matters, because the app and the database have to agree on how a day is saved.

1. **Apply `20261005000100_per_user_data.sql`.** It is safe while the current app is live. Every existing row
   is assigned to the one registered owner, so you still see everything, and the old save keeps working. It
   refuses to run unless `app_owner` holds exactly one row.
2. **Regenerate `src/db/types.ts`** so the new `user_id` column is in the types, and commit it.
3. **Deploy the new app** (merge the pull request). Saving a day now uses the per-person key
   `(user_id, log_date)`.
4. **Apply `20261005000200_drop_single_user_unique.sql`.** Until then a second person could not save a log for a
   date you already have. It refuses to run if step 1 has not been applied.

To undo step 1, put the owner-only policies back by re-running `20261001000200_owner_lockdown.sql`. The
`user_id` columns can stay, since the owner-only rule ignores them.

## Before opening sign-ups

Sign-ups are off in Supabase today, which is the safe state. When the onboarding work is ready:

- Supabase dashboard, Authentication, Sign In / Providers: turn **Allow new users to sign up** on, keep
  **Confirm email** on, and set the minimum password length to 8 or more.
- Authentication, URL Configuration: set the Site URL to the production address and add it (and any preview
  address you want to test on) to the redirect URLs, so the confirmation link brings people back to the app.
- Leaked-password protection is a paid feature and stays off for now.

## How the rules work

- **Personal tables** (readings, daily logs, profile, medications, screening history, and the others) have a
  `user_id` filled in automatically from the signed-in person. The policy `own_rows` lets a person read and
  write only rows whose `user_id` is theirs, and refuses to write a row for anyone else or hand one over.
- **Shared reference tables** (`biomarkers`, `screening_rules`) can be read by any signed-in person and cannot
  be changed through the API at all.
- **Signed out** gets nothing, in every table.
- **Deleting an account** removes that person's rows and no one else's.
- Tables created from now on start closed to the signed-out role.

## Tests

`npm run test:db` runs the migrations against a real Postgres engine (PGlite) with Supabase's `anon` and
`authenticated` roles, as three kinds of visitor (the owner, another signed-in person, signed out). It covers
the backfill, isolation between people, the shared tables, the two-step save change, account deletion and
re-running the migration. It never touches the live project.

To check that the tests would notice a mistake, point them at a deliberately broken copy of the migrations:
`MIGRATIONS_DIR=/path/to/broken/copy npm --prefix supabase/tests test`. Thirteen such breaks were tried when this
was written (a policy opened to everyone, writes allowed on shared tables, existing rows not assigned, and so
on), and each one fails at least one test.
