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
| Personal | `biomarker_readings`, `daily_logs`, `habits`, `medications`, `profile`, `screening_history`, and the tables no screen uses yet (`action_items`, `body_composition`, `cardio_metrics`, `devices`, `diagnoses`, `meals`, `photo_log`, `supplement_catalog`) | Each row has a `user_id`, filled in from the signed-in user. You see and change only your own rows |
| Reference | `biomarkers`, `screening_rules` | Everyone signed in can read them. Nobody can change them through the API; they are edited by migration |
| Internal | `app_owner` | Unreachable through the API. Only used to hand existing rows to the first owner |

One log per person per day (`unique (user_id, log_date)`), and one profile per person.

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

All eight are applied to the live project and listed in `baseline.txt`, so the workflow's first run has nothing to
apply. `one-off/20261005_seed_owner_habits.sql` is not a migration. It carries
the original owner's old hardcoded habits (cigarettes, lift, core, cardio, steps) into the new table and copies
their old `daily_logs` columns into the new `habits` column. It is safe to run more than once, and only adds what
is missing.

To undo the per-user change, put the owner-only policies back by re-running `20261001000200_owner_lockdown.sql`.
The `user_id` columns can stay, since the owner-only rule ignores them.

## Sign-ups

Sign-ups are open for testing: email and password only. In the Supabase dashboard (Authentication, Sign In /
Providers) **Allow new users to sign up** must be on and **Confirm email** must be off, so a new account gets a
session straight away and no email is sent. With Confirm email on, new people would see "Check your email", and
Supabase's built-in sender only delivers to members of your own Supabase organisation. Neither setting can be read
from the repository, so check them in the dashboard if sign-up misbehaves.

Left for later, on purpose: CAPTCHA, email confirmation, leaked-password protection, a custom SMTP sender, and
password reset by email (it needs the SMTP sender). Until then, a tester who forgets their password has to be
reset from the Supabase dashboard (Authentication, Users). Social login comes after the mobile apps, and payments
after the app is on the App Store.

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
