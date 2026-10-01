# Database access

Until now the database policies let anyone with the public key in `index.html` read and write every table. The
sign-in screen in `index.html` only hid the page. These migrations make the database itself refuse everyone except
the owner.

| File | What it does | Safe to apply any time? |
| --- | --- | --- |
| `20261001000100_app_owner.sql` | Adds the `app_owner` table and an owner check | Yes, changes no existing access |
| `20261001000150_private_is_owner.sql` | Moves the owner check into a private schema the API cannot call | Yes |
| `20261001000200_owner_lockdown.sql` | Replaces the open `allow_all` policies with owner-only ones | No, follow the steps below |

The first two are already applied to the live project. The third is not.

## Turning the lock-down on

Do these in order. Applying the lock-down before step 3 makes the live dashboard show nothing.

1. Create your login: Supabase dashboard, Authentication, Users, Add user. Enter your email and a password, and tick
   auto-confirm. Also turn off "Allow new users to sign up" under Authentication, Sign In / Providers.
2. Register yourself as the owner:
   `insert into public.app_owner (user_id) select id from auth.users where email = '<your email>';`
3. Deploy the `index.html` that has the sign-in screen, open it, and check you can sign in and see your data.
4. Apply `20261001000200_owner_lockdown.sql`. It refuses to run if `app_owner` is empty.

To undo step 4, restore the old policy on each table:
`create policy allow_all on public.<table> for all using (true) with check (true);` and
`grant all on public.<table> to anon;`.

## What was checked

The lock-down was applied inside a transaction that was forced to roll back, then tried as three kinds of visitor:

- the owner: reads all 65 readings, can insert, update and delete
- another signed-in user: sees 0 rows, inserts are refused, updates and deletes touch 0 rows
- signed out: reads and inserts are refused, and the owner check cannot be called

The guard that blocks the migration while `app_owner` is empty was also confirmed to fire.
