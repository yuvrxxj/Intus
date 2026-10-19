# Facts a post may use

Every claim in a post or a picture comes from one of these. Each was true of the product on 19 Oct 2026, and the source file is named so it can be checked. If a feature changes, change this file first. If something is not here, it does not go in a post.

Fact ids are the headings below (`F1`, `F2`, ...). `scripts/social-cards.ts` refuses a card that cites an id that does not exist.

## F1 What Intus is
A personal health tracker at intus.fit: a daily log, progress charts, history and bloodwork. The line the brand uses is "Your health, in plain numbers." Source: README, `docs/brand/og-image.html`.

## F2 Early access
The homepage says "Free during early access." and "Laptop, desktop and tablet today. Phone apps are coming." Quote it as written. Say nothing about what happens after early access. Source: `src/features/home/Home.tsx`.

## F3 Lab report upload
On the Bloodwork screen a lab report PDF is read on the device (scanned pages go through OCR on the device). Nothing is saved until the person checks the table. Units are never converted. Source: README, `src/features/reports/`.

## F4 Printed ranges
Each result is flagged against the range printed on its own report when it has one. The screen says which range each result was read against. Source: README "Bloodwork and safety", `src/lib/ranges.ts`.

## F5 One real report
On 12 Oct 2026 the on-device reader found all 69 results on one real 38-page lab report. That is one report from one lab. Always say "one report". Source: Linear INT-108.

## F6 Typed results
Results can be typed in. They are shown as "entered by you" and can be deleted. A number ten times outside the usual range asks for a confirmation in case it was typed in the wrong unit. Source: README "Bloodwork and safety".

## F7 Supplement before and after
Supplements are recorded with their dates and schedule. "What changed since you started" sets the 28 days before the start date against days 8 to 63 after it, using only days the person logged. It says nothing until each period has 10 logged days. It never colours a change good or bad, and it states that it cannot show that a supplement works. Source: README, `src/features/supplements/effect.ts`.

## F8 No dose checks
Intus does not assess medicines or doses. Source: README.

## F9 Sleep
Sleep is logged by hand or imported from Apple Health. It shows nightly bars, the usual bedtime and wake time, and averages once there are 5 nights. Each night comes from one source and sources are never blended. Intus has no sleep score, no sleep debt counter, no stage targets and no good-or-bad colours on a night. Source: README, `docs/product/sleep-tracker.md`.

## F10 Apple Health import
The zip from the Health app's Export All Health Data is read in the browser. Intus keeps sleep, HRV and resting heart rate from the last year. Nothing but those rows leaves the device. Importing again adds nothing twice. Source: README `src/features/import/`.

## F11 Your data
Download everything as one JSON file, print the latest results for a doctor, and delete the account from the Account page (it asks for the email to be typed back). Source: README `src/features/export/`, `src/features/account/`.

## F12 Sets are never lost
A strength set is saved on the device first and then sent. A closed tab or a lost connection never loses a set, and unsent sets are marked "not sent yet". Source: README `src/features/strength/`.

## F13 Photo check-ins
Pictures are resized and re-encoded on the device so location and camera tags never leave it, and they are stored in a private bucket. Source: README `src/features/photos/`.

## F14 Cycle tracking
Women can log bleeding days. Cycle day and the usual cycle appear once three cycles are logged. Intus never predicts periods, ovulation or fertile days. Source: README `src/features/cycle/`.

## F15 Habit streaks
Streaks count calendar days against each habit's own goal and direction, so a smoking habit reads "No Cigarettes". Source: README `src/features/progress/`.

## F16 Phones
On a phone browser the site shows the homepage and "Coming soon to iOS and Android". The iPhone app exists only as a sync companion in build. It is not released. Source: `src/features/mobile/`, `mobile/README.md`.

## Not allowed, whatever the draft says

- Any price, plan, trial, "free forever", "no subscription", "pay once" or discount. Pricing is undecided (INT-38, INT-49). F2 is the only wording about cost.
- AI reading of lab reports, AI chat or any AI feature. The AI reader is off and not live (INT-108).
- Live wearable sync or any named wearable other than the Apple Health import in F10.
- The iPhone or Android app as available.
- Any claim to diagnose, treat, prevent or cure, any supplement that "works", any dose, any advice about what a result means for a person, any "normal" or "healthy" range of our own.
- Other products by name, user counts, testimonials, quotes from people, "clinically", "doctor approved", "FDA", "HIPAA".
- Real health data in a picture. Screenshots come only from a demo account with made-up numbers.
- Features on the roadmap but not shipped.
