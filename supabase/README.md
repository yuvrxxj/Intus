# Database access

Every person sees only their own rows. The database enforces this with row level security, so it holds even
if someone calls the API directly with the public key in the app.

| File | What it does | Applied to the live project? |
| --- | --- | --- |
| `20261001000100_app_owner.sql` | Adds the `app_owner` table and an owner check | Yes |
| `20261001000150_private_is_owner.sql` | Moves the owner check into a private schema | Yes |
| `20261001000200_owner_lockdown.sql` | Replaces the open policies with owner-only ones | Yes |
| `20261005000100_per_user_data.sql` | Adds `user_id` to every personal table, assigns existing rows to the owner, and replaces owner-only with per-person policies | Yes (run in the SQL editor on 5 Oct 2026) |
| `20261005000200_drop_single_user_unique.sql` | Drops the one-person `unique(log_date)` on `daily_logs` | **No, apply last** |
| `20261005000300_supplement_schedule.sql` | Adds the days of the week a supplement is taken, and checks on doses a day | Yes |
| `20261005000400_habits.sql` | Adds the `habits` table (per person from the start) and the `habits` column on `daily_logs` | Yes |
| `20261005000500_onboarding_answers.sql` | Adds the first-run answers to `profile` (activity level, diet, workouts a week, cardio notes, typical and desired day) | Yes |
| `20261005000600_threshold_verification.sql` | Adds `threshold_verified_at` / `threshold_verified_by` to `biomarkers`. Nothing is marked verified, so no critical alert fires until a clinician signs a marker off | Not yet (written, not applied). Safe to apply any time: the new app reads a missing column as "unverified" |

`one-off/20261005_seed_owner_habits.sql` is not a migration. It carries the original owner's old hardcoded habits
(cigarettes, lift, core, cardio, steps) into the new table and copies their old `daily_logs` columns into the new
`habits` column. It is safe to run more than once, and only adds what is missing. It was run once on 5 Oct 2026.
Run it again right after the new app is deployed, to pick up any days the old app logged in the meantime.

## Applying the per-user change

Order matters, because the app and the database have to agree on how a day is saved.

1. **Apply `20261005000100_per_user_data.sql`** (done). It is safe while the current app is live. Every existing row
   is assigned to the one registered owner, so you still see everything, and the old save keeps working. It
   refuses to run unless `app_owner` holds exactly one row.
2. **Regenerate `src/db/types.ts`** so the new `user_id` column is in the types, and commit it (done).
3. **Deploy the new app** (merge the pull request). Saving a day now uses the per-person key
   `(user_id, log_date)`.
4. **Apply `20261005000200_drop_single_user_unique.sql`.** Then run the habits seed again (see above). Until then a second person could not save a log for a
   date you already have. It refuses to run if step 1 has not been applied.

Applying a file that contains a `DROP` from an AI coding session can stall, because the Supabase tool asks for a
confirmation that never reaches the person running it. If that happens, paste the file into the Supabase
dashboard's SQL editor and run it there.

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
`MIGRATIONS_DIR=/path/to/broken/copy npm --prefix supabase/tests test` (and `ONE_OFF_DIR` for the seed). Thirteen
such breaks of the per-user migration, eight of the supplement schedule one, and nineteen of the habits migration
and seed were tried when this was written (a policy opened to everyone, writes allowed on shared tables, existing
rows not assigned, values overwritten by the seed, and so on). Each one fails at least one test, except one that
changes nothing: leaving `WITH CHECK` off a `FOR ALL` policy makes Postgres reuse the `USING` rule for writes.
