# iPhone app: the end-to-end check

Run before a TestFlight build or after any change to sign-in, sync or the account screens. It takes about 15 minutes
on the Simulator. Use the local Supabase (`docs/ios/local-supabase.md`): never make test accounts on production.
(INT-84)

Each line is something to do, then what should happen. Mark anything that differs and file it in Linear under
Intus.iOS.

## Set up

1. `bash scripts/local-supabase.sh reset`, so no accounts are left from the last run.
2. Start the app against it (the two `EXPO_PUBLIC_*` values from `bash scripts/local-supabase.sh env`).
3. Keep the local inbox open: http://127.0.0.1:54324.

## Create an account

1. Tap "New to Intus? Create an account". The card becomes Create account, with two password fields and the consent
   line.
2. Type two different passwords and tap Create account. "The two passwords do not match." and the second field turns
   red.
3. Make them match, leave the consent box empty, tap Create account. "Read and agree to the privacy policy and terms to
   create an account."
4. Tap Privacy policy and Terms of use. Each opens in the in-app browser. Close it.
5. Tick the box, tap Create account. "Check your email" with the address you typed. One email arrives in the local
   inbox.
6. Tap "Back to sign in". The email is already filled in.
7. Type the password and sign in before confirming. "Confirm your email first. Check your inbox for the link."
8. Open the link in the email. Sign in again. The Apple Health sheet appears, then Sleep.

## Sleep and Apple Health

1. On the Apple Health sheet tap Not now. Sleep says "No nights yet".
2. Add a night (the default 23:00 to 07:00 is fine) and Save night. It appears in the list with a Delete button.
3. Delete it. It goes, and "No nights yet" returns.
4. Add five nights on different dates. The averages appear only once the fifth is saved.
5. Sync now. On the Simulator Apple Health is empty, so expect no new nights and no error. On a real iPhone, last
   night's sleep from the Health app appears, marked with its source.

## Activity

1. Open Activity. With nothing synced: "Nothing for today yet. Tap Sync now on the Sleep tab."
2. On a real iPhone after Sync now: today's steps and active calories, and averages with the number of days they
   come from.

## Two accounts never see each other

1. Sign out (Sleep, bottom, or More, Account). Back on Sign in, with the fields empty.
2. Create a second account and sign in as it. Sleep says "No nights yet", although the first account has nights.
3. Optional, at the API: `docs/ios/local-supabase.md` shows how to look in Studio. Each person's rows carry their own
   `user_id`, and the signed-out key is refused.

## Account

1. More, Account: the signed-in address is shown.
2. Download my data. The share sheet opens with one JSON file. Cancelling it shows no error.
3. Delete account: the button asks you to type a phrase with your email. A wrong phrase keeps the button disabled.
4. Type it and delete. You are signed out, and signing in again with that account fails.

## Large text

1. Settings, Accessibility, Display and Text Size, Larger Text: the largest size.
2. The signed-out screen scrolls, and every field and button can be reached (fixed in #64). Check Create account too,
   which is longer.
3. Sleep, Activity and Account: nothing is cut off; long figures wrap or stack.

## Known, not bugs

- iOS offers "Use Strong Password" on the Create account password fields and "Save Password" after sign-in.
- The confirmation link lands on intus.fit after confirming. The address is confirmed before the redirect.
- When typing is driven by a script, the first characters after focusing a field can be lost. A person typing does
  not hit this.
