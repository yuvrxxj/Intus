# Database access

Who can see what, and how it is enforced. Row-level security does the work in the database itself; the sign-in screen only decides what to show.

## The model

| Kind of table | Tables | Rule |
| --- | --- | --- |
| Personal | `daily_logs`, `biomarker_readings`, `medications`, `profile`, `screening_history` | Each row has a `user_id`. You see and change only your own rows. `user_id` fills itself in from the signed-in user on insert |
| Reference | `biomarkers`, `screening_rules` | Everyone signed in can read them. Nobody can change them through the API; they are edited by migration |
| Not used yet | `action_items`, `body_composition`, `cardio_metrics`, `devices`, `diagnoses`, `meals`, `photo_log`, `supplement_catalog` | Closed to everyone. When a feature needs one, add `user_id` and an `own_rows` policy first (copy the pattern in `20261005000100_multi_user.sql`) |
| Internal | `app_owner` | Unreachable through the API. After the multi-user migration it is only used to hand existing rows to the first owner |

One log per person per day (`unique (user_id, log_date)`), and one profile per person.

## Migrations

| File | What it does | State |
| --- | --- | --- |
| `20261001000100_app_owner.sql` | Adds the `app_owner` table and an owner check | Applied to the live project |
| `20261001000150_private_is_owner.sql` | Moves the owner check into a private schema the API cannot call | Applied to the live project |
| `20261001000200_owner_lockdown.sql` | Replaces the open `allow_all` policies with owner-only ones | Applied to the live project (checked 2026-10-05: an `owner_only` policy exists on all 15 tables) |
| `20261005000100_multi_user.sql` | Adds `user_id` to the personal tables and hands existing rows to the owner, then replaces owner-only with per-user policies | **Not applied yet** |

### Applying the multi-user migration

The app and the database change together: the app now upserts on `(user_id, log_date)`, which only exists after the migration. Applying either one alone breaks saving a day's log, so do both in one sitting.

1. Apply the migration to a staging copy of the project first (a Supabase branch, or a second project).
2. Run the checks below against it. All of them must print `ok`.
3. Apply it to the live project and deploy the app straight after.

The migration stops with an error if there are rows and `app_owner` is empty, so it cannot leave rows nobody can see.

It does not turn on sign-ups. When the sign-up screen exists, also set these in the Supabase dashboard (Authentication): allow new users, require email confirmation, a real SMTP sender (the built-in one is heavily rate-limited), CAPTCHA, and leaked-password protection (the advisor currently warns it is off).

## Checks

`tests/multi_user_rls.sql` creates two throwaway users in a transaction, tries to read and change each other's rows, tries to write reference and unused tables, and tries everything signed out. It rolls back, so it leaves nothing behind.

```
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f supabase/tests/multi_user_rls.sql
```

Run it as the `postgres` role, on a database with every migration applied. A failed check raises an error and stops the run. It was written against a local Postgres 16 with the Supabase roles and `auth.uid()` stubbed, and it was confirmed to fail when a policy is deliberately opened up.

## Undoing the multi-user migration

Only possible while one person's data is in the database. Restore the owner policy on each table (`create policy owner_only on public.<table> for all to authenticated using ((select private.is_owner())) with check ((select private.is_owner()))`), drop `daily_logs_user_id_log_date_key`, and re-add `unique (log_date)`. The `user_id` columns can stay.
