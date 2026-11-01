# Testing the iPhone app against a local Supabase

Test accounts must never be made on the production project, and there is no staging project. This runs a full
Supabase on your Mac instead: database, sign-in, file storage and an inbox that catches every email it sends.
Nothing here is linked to production. (INT-166)

Needs Docker Desktop running and the Supabase CLI (`brew install supabase/tap/supabase`).

## Start it

```
bash scripts/local-supabase.sh start
```

The first start downloads the Supabase images (a few GB, several minutes). After that it takes seconds. On a fresh
database it loads the schema: the tables production had before migrations, then every file in
`supabase/migrations`, oldest first. It ends by printing two lines like these:

```
EXPO_PUBLIC_SUPABASE_URL=http://127.0.0.1:54321
EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY=sb_publishable_...
```

## Point the iPhone app at it

The Simulator reaches the Mac at `127.0.0.1`, so run the app with those two lines in front:

```
cd mobile
EXPO_PUBLIC_SUPABASE_URL=http://127.0.0.1:54321 EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY=sb_publishable_... npx expo run:ios
```

Both values are read when the JavaScript is bundled. A build made without them talks to production, as before.
Restart Metro (`npx expo start --clear`) after changing them.

## Make a test account

1. In the app, Create account with any address, for example `test1@example.com`, and a password of 8 or more
   characters.
2. Open the local inbox at http://127.0.0.1:54324 and open the confirmation email.
3. Open the link in it. It confirms the address on the local stack, then lands on intus.fit (the redirect the app
   asks for). The landing page does not matter: the address is confirmed before the redirect.
4. Back in the app, sign in.

Sign-up is limited to a few emails an hour, as in production. Use a new address per test, or reset.

## Look at the data

Supabase Studio runs at http://127.0.0.1:54323. Use it to check that a second account sees none of the first
account's rows.

## Reset or stop

```
bash scripts/local-supabase.sh reset   # empty database, schema loaded again, every test account gone
bash scripts/local-supabase.sh stop    # stop the containers; the data stays until the next reset
```

## What differs from production

- Confirmation emails are caught by the local inbox. Nothing reaches a real address.
- The `biomarkers` reference list holds only the markers the migrations add, not the full production list.
- Edge Functions (the waitlist) are not running. The iPhone app does not use them.
- Google sign-in is not set up locally.
