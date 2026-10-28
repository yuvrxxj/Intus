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
| Personal | `biomarker_readings`, `cycle_days`, `daily_logs`, `habits`, `medications`, `profile`, `profile_conditions`, `sleep_sessions`, `workouts`, `workout_sets`, and the tables no screen uses yet (`action_items`, `body_composition`, `cardio_metrics`, `devices`, `diagnoses`, `meals`, `photo_log`, `supplement_catalog`) | Each row has a `user_id`, filled in from the signed-in user. You see and change only your own rows |
| Reference | `biomarkers` | Everyone signed in can read it. Nobody can change it through the API; it is edited by migration |
| Files | the `check-in-photos` Storage bucket | Private. Each person can read, add and delete only inside their own `<user id>/` folder, names must be `<uuid>.jpg` or `.webp`, files are at most 2 MiB, and a person holds at most 200. There is no update policy |
| Files | the `lab-reports` Storage bucket | The same rules for uploaded lab report PDFs: own folder only, `<uuid>.pdf`, at most 10 MiB each and 200 per person, no update policy. `delete_my_account()` refuses while any remain, and the app removes them first |
| Internal | `ai_settings` | Unreachable through the API: row level security with no policy. Edited in the Supabase dashboard |
| Internal | `ai_usage` | A person can read their own rows. Only the Edge Function writes them |
| Internal | `waitlist` | No `user_id`. Row level security is forced and there is no policy, and `anon` and `authenticated` have no grants, so the API cannot read it. Only the `join-waitlist` Edge Function (service role) inserts. The email is stored in lower case and is unique. A confirmation token is stored as a SHA-256 hash with an expiry, for the later double opt-in email, which this table does not send |

One log per person per day (`unique (user_id, log_date)`), one profile per person, and one row of heart readings per person, day and source (`unique (user_id, measured_at, source)` on `cardio_metrics`, so the phone sync can upsert).

## Deleting an account

The Account section of the app has a Delete account button. It calls `public.delete_my_account()` through the API.
The browser cannot delete an `auth.users` row with the public key, and the service key must never ship in the app,
so the function does it with its owner's rights. It takes no arguments and only ever removes the caller's own row,
read from their login token; it refuses a caller with no token, and the signed-out role cannot run it.

Deleting that row removes everything that hangs off it, because every table with a `user_id` references `auth.users`
with `on delete cascade`, as do Supabase's own identities, sessions and refresh tokens. The database
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
| `20261012000100_cardio_source.sql` | Adds a `source` to heart readings and makes (person, day, source) the key, so the phone sync can upsert |
| `20261012000200_printed_ranges.sql` | Adds `ref_low` and `ref_high` to each result (the range printed on the report) and `ref_sex` to markers whose usual range is for one sex only |
| `20261012000300_lab_reports.sql` | Adds the private `lab-reports` bucket, and makes `delete_my_account()` refuse while uploaded reports remain |
| `20261012000400_cycle_and_conditions.sql` | Adds `cycle_days`, `profile_conditions` and the six reproductive hormone markers |
| `20261012000500_strength.sql` | Adds `workouts` and `workout_sets`, saved by an id made on the device so a resend changes nothing |
| `20261012000600_ai_reading.sql` | Adds `ai_settings` (off by default: the limits, provider, model and prices), `ai_usage` (one row per AI call, never any report text) and the three functions that enforce the limits |
| `20261013000100_date_of_birth.sql` | Adds `profile.date_of_birth` (nullable, not before 1900), so a person's age is worked out from it and goes up on their birthday. The old `age` column stays for people who have not given a date |
| `20261015000100_cleanup_after_per_user_change.sql` | Housekeeping after the 5 Oct change (INT-67). First writes the one old `daily_logs.cardio` word the seed could not map (`stairs`) into the Cardio habit. Then drops `screening_history` and `screening_rules`, the profile columns `family_colorectal_cancer`, `family_prostate_cancer` and `noise_or_blast_exposure`, `medications.paracetamol_mg_per_dose`, the old `daily_logs` columns `lift`, `core`, `cardio`, `cigs` and `steps`, `private.is_owner()`, `app_owner`, and the `backup_20261005` schema (a copy of all 16 tables from before the per-person change) |
| `20261028000100_waitlist.sql` | Adds `waitlist` for early access (INT-94): unique email, device, `pending` or `confirmed`, a SHA-256 confirm-token hash and its expiry, and `created_at`. Row level security is forced and the API roles cannot read or write it. The confirmation email is not part of this migration |

The first eight are applied to the live project and listed in `baseline.txt`. Everything after them is applied by the
workflow when its pull request is merged. `one-off/20261005_seed_owner_habits.sql` is not a migration. It carried
the original owner's old hardcoded habits (cigarettes, lift, core, cardio, steps) into the new table and copied
their old `daily_logs` columns into the new `habits` column. It has done its job and can no longer be run against the
live project, because it reads `app_owner` and the old columns, which the cleanup migration drops.

The per-user change can no longer be undone: the cleanup migration dropped the owner check, `app_owner` and the
pre-change copy of the data.

## AI reading of lab reports

Optional, off until you switch it on. The upload screen reads a report on the device first. With AI reading on, a
person can also choose to send the text of their report, with their name, ID numbers and contact details removed on
their device, to an AI model that lists the results. Every number the model returns is checked against the text that
was sent: a number that is not printed there is dropped. The person still checks every row before anything is saved.

**What runs where.** `src/features/reports/redact.ts` removes identity on the device. The Edge Function
`supabase/functions/read-report` checks the person is signed in, asks the database for permission, calls the provider
and returns the rows. It never logs report text. `src/features/reports/aiRows.ts` checks the rows against the text.

**The limits live in one row, `public.ai_settings`**, and nothing else decides whether a call happens. Change them in
the dashboard (Table Editor, `ai_settings`, edit the row), with no deploy:

| Column | Starts at | What it does |
| --- | --- | --- |
| `enabled` | `false` | The switch. Off means nobody can use AI reading, and the upload screen does not offer it |
| `per_user_daily` | 3 | Calls one person can make in a UTC day. A failed call counts, so failures cannot be used to hammer it |
| `global_daily` | 30 | Calls everyone together can make in a UTC day |
| `monthly_budget_usd` | 5 | Stops calls when this month's estimated spend, plus the worst case of the next call, would pass it |
| `provider`, `model`, `json_mode` | `gemini`, `gemini-flash-lite-latest`, `schema` | Who reads the report. `openrouter` takes names like `vendor/model:free`. `object` asks for any JSON, for models that cannot do `schema` |
| `input_usd_per_million`, `output_usd_per_million` | 0.50, 3.00 | The model's real prices. The starting values are high on purpose, so the estimate errs towards stopping. A free model is 0 and 0 |
| `max_input_chars`, `max_output_tokens` | 200000, 16384 | The largest report accepted, and the most the model may write back |

`ai_take_slot` takes a lock, checks all of this, and reserves the worst-case cost of a call before the provider is
asked, so two calls at once cannot both squeeze under a limit. `ai_finish` replaces the reserve with the real cost
from the provider's token counts. A call that fails before the provider answers costs 0 and still counts as a call.

**Limits outside the app, which are the ones that hold even if something here is wrong:**

- Gemini: in Google AI Studio, the project's Spend page has a monthly spend cap. Set it at or below your monthly
  credit. Google says it takes about ten minutes to act, so it is a backstop and not a hard stop. A Cloud Billing
  budget sends alerts at the amounts you pick but does not stop anything. Keep the API key restricted to the Gemini API.
- OpenRouter: it is prepaid. With no credit bought, a paid model fails and nothing can be charged, and free models
  cost nothing. Leave auto top-up off. Free models are limited to 20 requests a minute and, without a credit purchase,
  50 a day for the whole account, so keep `global_daily` at 50 or below.

**Privacy.** On OpenRouter every request carries `provider: { data_collection: "deny", require_parameters: true }`,
set in code (`buildChatRequest`), not in the settings. A model with no host that promises not to keep or train on
prompts fails with "no endpoints", and nothing is sent. On Gemini, make sure Cloud Billing is on for the key's project:
the free tier lets Google use prompts to improve its products and human reviewers may read them, which is not
acceptable for health data.

## Waitlist

`public.waitlist` holds early-access sign-ups. It is not a personal table: there is no `user_id`, and deleting an account does not touch it. Row level security is forced on, there is no policy, and `anon` and `authenticated` have no grants. The browser never reads the table.

The Edge Function `supabase/functions/join-waitlist` checks the email, the device and a honeypot field, allows 5 joins from one IP address per 10 minutes (in memory, per isolate), and inserts. It stores SHA-256 of a confirmation token and an expiry seven days out. Signing up again while the row is still pending replaces that hash. Opening the link sets `confirmed_at` and clears the hash. Only a confirmed row is eligible for an invite. It does not return the token and it does not send email.

**Not deployed.** Shipping the function is a separate step, after this migration is merged: `supabase functions deploy join-waitlist --no-verify-jwt --project-ref zfyeqfnretrrmtevczrc`. The gateway check stays off because callers are signed out and the publishable key is not a JWT. Do not deploy it until the migration is on the project. The confirmation email (Resend), country, UTM and analytics are later pull requests.

**Deploying the function.** It is not part of the migration workflow. Deploy `supabase/functions/read-report` with the
Supabase CLI (`supabase functions deploy read-report --no-verify-jwt --project-ref zfyeqfnretrrmtevczrc`) or the
Supabase connector in a Claude Code session, and keep the repository and the deployed copy the same. It checks the
caller's login itself, which is why the gateway check is off: projects on the newer signing keys reject their own
tokens there. Secrets (Edge Functions, Secrets in the dashboard, never in chat): `GEMINI_API_KEY` and/or
`OPENROUTER_API_KEY`. `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` are provided by Supabase.

**Trying models before choosing one.** `node scripts/report-text.ts report.pdf --name FirstName > report.txt` prepares
the redacted text. `node scripts/ai-eval.ts --list-free` lists OpenRouter's free models. `node scripts/ai-eval.ts
report.txt --models a,b` (with `OPENROUTER_API_KEY` set) runs each one through the same request the function sends and
scores it against the on-device reader: results reproduced, wrong numbers dropped, extra results found, tokens and
time. A model with no private host is reported as unusable. Keep real reports and their text out of the repository.

## Sign-in

Three ways in, all free:

- **Email and password.** Sign-up, sign-in, and "Forgot password?" with a link that opens a "Choose a new
  password" screen.
- **Google.** The "Continue with Google" button appears by itself once Google is switched on under Authentication,
  Sign In / Providers. The app reads `/auth/v1/settings`, so there is no code change to make. It needs a Google
  Cloud OAuth client (free) whose redirect URI is `https://zfyeqfnretrrmtevczrc.supabase.co/auth/v1/callback`.
- Apple is not offered: Sign in with Apple needs a paid Apple Developer account.

Emails (confirm your address, reset your password) go out through Resend over SMTP, because Supabase's built-in
sender only delivers to members of your own Supabase organisation, a few an hour. In Authentication, Emails, SMTP
Settings: host `smtp.resend.com`, port 465, username `resend`, the password a Resend API key that can only send,
sender `hello@mail.intus.fit`, sender name Intus. **Confirm email** is on, and the email rate limit
(Authentication, Rate Limits) is raised to 80 an hour. Resend's free plan allows 100 emails a day. A new sending
domain has no reputation yet, so a confirmation email can land in a junk folder (it did in iCloud Mail on day one).

DNS for intus.fit has three sets of records, and all of them have to stay. The root carries the iCloud+ custom
email domain for yuvraaj@intus.fit: two MX records, an SPF record, the `sig1._domainkey` DKIM record and Apple's
`apple-domain` verification record. `_dmarc` is `v=DMARC1; p=none; rua=mailto:yuvraaj@intus.fit;`, so the reports
arrive in that mailbox. Resend's DKIM, SPF and return-path records sit under `mail.intus.fit`, off the root, so they
never clash with the iCloud ones. Deleting the root MX records stops all inbound mail, including the contact
address in the footers.

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
- **The shared reference table** (`biomarkers`) can be read by any signed-in person and cannot
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
