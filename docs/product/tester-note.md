# Intus tester note

Two parts: the note to send to testers, and the two-account check to run yourself before you send it.

## Note to send to testers

Hi, thanks for trying Intus.

Intus is a place to keep your daily numbers (weight, food, habits), your bloodwork and your supplements together, with every lab result set against its reference range. It is early. I would like to hear what is confusing or broken more than what is nice.

**How to open it**

- Go to https://intus.fit on a laptop, desktop or tablet. On a phone it shows a "coming soon" screen, because the iOS and Android apps are not built yet.
- Make an account with an email and password. You do not need to confirm your email. If you see "Continue with Google", that works too.
- Your data is yours alone. Nobody who signs in with another account can see it, including me through the app.

**What to try, in this order**

1. Answer the first-run questions (about you, a target, what to track). You can skip them and come back.
2. Under Today, log a day. It should take under a minute.
3. Under Goals and habits, change a target and add a habit of your own.
4. Under Bloodwork, type in one or two results from a lab report. You will see them flagged against the reference range.
5. Under Supplements, add something you take with a start date.
6. Sign out and sign back in. Try "Forgot password" once if you are happy to.

**What is not there yet**

- No phone apps, no Apple sign-in, no wearable sync.
- Lab results are typed in by hand for now. There is no photo or PDF upload.
- The supplement comparison stays quiet until you have 10 logged days on each side of the start date.
- Intus shows ranges and changes. It does not give medical advice.

**What I would like back**

Anything that confused you, anything that broke, and what you expected instead. Please include your browser (for example Chrome on Windows) and a screenshot if you can. A one-line reply is fine.

## The two-account check (run this yourself first)

This proves that a brand-new account sees none of another account's data. It takes about five minutes and needs two browsers (or one normal window and one private window).

1. Window A: open https://intus.fit and create an account with one email address. Finish or skip the first-run questions. Log today, add a habit, type in one lab result and add one supplement.
2. Window B: open https://intus.fit and create a second account with a different email address.
3. In window B, go through every section (Today, Progress, Goals and habits, Bloodwork, Supplements, Screening, History). Each should be empty, apart from any habits that account's own first-run answers created. Nothing from window A should appear anywhere, including A's habit, lab result and supplement.
4. In window B, add one entry of your own (for example log today). Go back to window A and refresh. Window A should show only its own entry.
5. Sign both out. Delete the two test accounts under Authentication, Users in the Supabase dashboard.

If anything from A shows up in B, stop and send the section name and a screenshot.

### What has already been checked

- Automated: the database test suite (`npm run test:db`, 48 tests) runs the real migrations on a throwaway Postgres. It proves that a second person reads zero rows from every personal table, cannot write a row for someone else, and cannot change, delete or take over another person's row. It runs on every pull request.
- Live database, read-only, 8 Oct 2026: row-level security is on for every table in `public`. Every personal table has one policy that limits reads and writes to rows whose `user_id` is the signed-in person. The two reference tables (`biomarkers`, `screening_rules`) can be read by signed-in people and not changed. The signed-out role has no access to any table. The `app_owner` table has no policy and no grants, so nobody can reach it through the API. The old copy of the data in the `backup_20261005` schema is not reachable through the API at all.
- Not yet done: signing up two real accounts against the live site. That needs a network route to Supabase that Claude's cloud session does not have, so the steps above are for you to run.
