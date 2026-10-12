# Database access

Every person sees only their own rows. The database enforces this with row level security, so it holds even
if someone calls the API directly with the public key in the app.

## Changing the database

Add a file to `supabase/migrations/` (name it `YYYYMMDDHHMMSS_what_it_does.sql`), open a pull request, merge it.
The workflow `.github/workflows/migrate.yml` then:

1. runs the migrations on a throwaway Postgres (`npm run test:db`); if that fails, production is not touched;
2. applies the files production has not seen yet, oldest first, each in its own transaction, using
   `supabase/apply-migrations.sh`.

A file lands completely or not at all. A failed file is rolled back and tried again on the next run. Applied
files are recorded in `supabase_migrations.repo_migrations`, a table the API cannot reach.

Do not apply schema changes through the Supabase connector in a Claude Code session. Anything that drops or
deletes makes it ask for a confirmation that never reaches a person in a cloud session, and the call hangs until it
times out. Reads (`select`) are fine there.

**One-time setup:** add the repository secret `SUPABASE_DB_URL` (GitHub, Settings, Secrets and variables, Actions).
Its value is the **session pooler** connection string from the Supabase dashboard (Connect, Session pooler), with
the database password filled in. The direct connection is IPv6 only and GitHub's runners cannot reach it. To check
the connection without changing anything, run the workflow by hand (Actions, Apply database migrations, Run
workflow). It defaults to a dry run that lists what is pending.

The same script works from a laptop: `DATABASE_URL=... bash supabase/apply-migrations.sh --dry-run`.

`supabase/baseline.txt` lists the files that were applied by hand before the script existed. They are never run
again. Do not add new files to it.

## The model

| Kind of table | Tables | Rule |
| --- | --- | --- |
| Personal | `biomarker_readings`, `cycle_days`, `daily_logs`, `habits`, `medications`, `profile`, `profile_conditions`, `screening_history`, `sleep_sessions`, `workouts`, `workout_sets`, and the tables no screen uses yet (`action_items`, `body_composition`, `cardio_metrics`, `devices`, `diagnoses`, `meals`, `photo_log`, `supplement_catalog`) | Each row has a `user_id`, filled in from the signed-in user. You see and change only your own rows |
| Reference | `biomarkers`, `screening_rules` | Everyone signed in can read them. Nobody can change them through the API; they are edited by migration |
| Files | the `check-in-photos` Storage bucket | Private. Each person can read, add and delete only inside their own `<user id>/` folder, names must be `<uuid>.jpg` or `.webp`, files are at most 2 MiB, and a person holds at most 200. There is no update policy |
| Files | the `lab-reports` Storage bucket | The same rules for uploaded lab report PDFs: own folder only, `<uuid>.pdf`, at most 10 MiB each and 200 per person, no update policy. `delete_my_account()` refuses while any remain, and the app removes them first |
| Internal | `app_owner` | Unreachable through the API. Only used to hand existing rows to the first owner |

One log per person per day (`unique (user_id, log_date)`), one profile per person, and one row of heart readings per person, day and source (`unique (user_id, measured_at, source)` on `cardio_metrics`, so the phone sync can upsert).

## Deleting an account

The Account section of the app has a Delete account button. It calls `public.delete_my_account()` through the API.
The browser cannot delete an `auth.users` row with the public key, and the service key must never ship in the app,
so the function does it with its owner's rights. It takes no arguments and only ever removes the caller's own row,
read from their login token; it refuses a caller with no token, and the signed-out role cannot run it.

Deleting that row removes everything that hangs off it, because every table with a `user_id` references `auth.users`
with `on delete cascade`, as do `app_owner` and Supabase's own identities, sessions and refresh tokens. The database
tests fail if a new table with a `user_id` column does not cascade, since that would make deletion fail for everyone.

**Files in Supabase Storage are not covered by the cascade, and SQL cannot remove them.** Deleting a row from
`storage.objects` leaves the file itself in the bucket, so only the Storage API can delete a photo. The Account
section therefore removes every photo first (list the folder, remove, list again to prove it is empty; a delete that
Storage silently refuses stops the whole deletion) and only then calls the function. As a backstop the function
itself refuses with "remove your photos first" while the caller still has any, so calling it directly can never leave
photos behind with no account to own them. `test/photos.model.test.ts` pins the order and the database tests pin the
refusal.

Google keeps its own record that a person signed in to the app. Deleting the account does not remove that; they can
at myaccount.google.com, under connections to third-party apps.

## Migrations

| File | What it does |
| --- | --- |
| `20261001000100_app_owner.sql` | Adds the `app_owner` table and an owner check |
| `20261001000150_private_is_owner.sql` | Moves the owner check into a private schema |
| `20261001000200_owner_lockdown.sql` | Replaces the open policies with owner-only ones |
| `20261005000100_per_user_data.sql` | Adds `user_id` to every personal table, assigns existing rows to the owner, and replaces owner-only with per-person policies |
| `20261005000200_drop_single_user_unique.sql` | Drops the one-person `unique(log_date)` on `daily_logs` |
| `20261005000300_supplement_schedule.sql` | Adds the days of the week a supplement is taken, and checks on doses a day |
| `20261005000400_habits.sql` | Adds the `habits` table (per person from the start) and the `habits` column on `daily_logs` |
| `20261005000500_onboarding_answers.sql` | Adds the first-run answers to `profile` |
| `20261009000100_delete_my_account.sql` | Adds `public.delete_my_account()`, which the Account section's Delete button calls |
| `20261009000200_photo_check_ins.sql` | Adds the private `check-in-photos` bucket and its policies, the `storage_path` and `pose` columns on `photo_log`, and makes `delete_my_account()` refuse while photos remain |
| `20261011000100_sleep_sessions.sql` | Adds `sleep_sessions`: one row per sleep per source (what you entered, or later what Apple or Google health reported), as instants with the UTC offset at each end, optional stage segments and your own estimates. Checks on length, plausibility and one record per source id; per-person policies; no derived value is stored |

The first eight are applied to the live project and listed in `baseline.txt`. Everything after them is applied by the
workflow when its pull request is merged. `one-off/20261005_seed_owner_habits.sql` is not a migration. It carries
the original owner's old hardcoded habits (cigarettes, lift, core, cardio, steps) into the new table and copies
their old `daily_logs` columns into the new `habits` column. It is safe to run more than once, and only adds what
is missing.

To undo the per-user change, put the owner-only policies back by re-running `20261001000200_owner_lockdown.sql`.
The `user_id` columns can stay, since the owner-only rule ignores them.

## Sign-in

Three ways in, all free:

- **Email and password.** Sign-up, sign-in, and "Forgot password?" with a link that opens a "Choose a new
  password" screen.
- **Google.** The "Continue with Google" button appears by itself once Google is switched on under Authentication,
  Sign In / Providers. The app reads `/auth/v1/settings`, so there is no code change to make. It needs a Google
  Cloud OAuth client (free) whose redirect URI is `https://zfyeqfnretrrmtevczrc.supabase.co/auth/v1/callback`.
- Apple is not offered: Sign in with Apple needs a paid Apple Developer account.

Emails (confirm your address, reset your password) need a sender. Supabase's built-in one only delivers to
members of your own Supabase organisation, a few an hour. A free option is Gmail over SMTP with an app password
(Authentication, Emails, SMTP Settings: host `smtp.gmail.com`, port 465, the Gmail address as user and sender,
the 16-character app password). Until a sender is set up, keep **Confirm email** off so new accounts get in
straight away, and reset forgotten passwords from the dashboard (Authentication, Users).

Under Authentication, URL Configuration, the Site URL must be the production address, `https://intus.fit`, and the
redirect URLs must include it (`https://intus.fit/**`), `http://localhost:5173/**`, and the preview pattern
`https://*-yuvrxxjs-projects.vercel.app/**`.
Otherwise Google and the email links send people to the wrong place.

Left for later, on purpose: CAPTCHA, leaked-password protection (paid) and Sign in with Apple (paid). Payments
come after the app is on the App Store.

## How the rules work

- **Personal tables** have a `user_id` filled in automatically from the signed-in person. The policy `own_rows`
  lets a person read and write only rows whose `user_id` is theirs, and refuses to write a row for anyone else or
  hand one over.
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
Twenty-four breaks of the photo migration were tried as well (the cap removed or loosened, any file name or type
allowed, a policy opened to every signed-in person or to the signed-out role, an update policy added, a public
bucket, a larger size limit, the deletion guard removed or aimed at the wrong person, a path pointing into someone
else's folder, and so on). Each one fails at least one test, except one that changes nothing: deleting the `revoke`
on `delete_my_account()` in that migration, because `create or replace` keeps the revoke the earlier migration made.
