# Sleep tracker: decisions and the research behind them

Written 11 Oct 2026. Three research reports sit next to this file and carry the sources, numbers and confidence tags:

- [`sleep/research-platforms.md`](sleep/research-platforms.md): what Apple Health (HealthKit) and Google Health Connect expose, and how a web app can get it.
- [`sleep/research-accuracy.md`](sleep/research-accuracy.md): how accurate and how variable wearable sleep tracking is.
- [`sleep/research-metrics.md`](sleep/research-metrics.md): definitions, formulas, ranges by age, night assignment, merging sources, plausibility limits and the implementation spec.

Read the caveats first. The research was done in a sandbox that could not open most primary papers, so many numbers come from abstracts or search summaries and are tagged as such ([S]); design defaults chosen for Intus are tagged [D]; things that could not be checked are tagged [U]. Re-check a number against its source before it goes into the interface.

## The short version

1. **Sleep tracking from wearables is good at when and for how long, and weak at stages and wake.** Devices detect sleep well (sensitivity 0.93 to 0.97) and wake poorly (specificity 0.18 to 0.54 in one seven-device study), so time asleep is usually overstated on restless nights. Per-night error in time asleep is about 22 to 31 minutes; four-stage agreement with a sleep lab is kappa 0.20 to 0.65 depending on device and who paid for the study. Devices also differ from each other by amounts of a similar size (no study compares several on the same nights directly, so that part is inference).
2. **So Intus shows the robust things prominently and the fragile things as labelled estimates.** Prominent: time asleep (median over weeks), wake-up time, bedtime, midpoint, how much those vary, and how many nights the figures are based on. Estimated, one tap away: time awake, time to fall asleep, stages. Never: a composite sleep score, stage targets, sleep debt, good-or-bad colours on a night.
3. **Neither Apple Health nor Health Connect can be read from a web page.** Both need a native phone app. Before that exists, the free routes are manual entry and importing Apple's own export file in the browser. The Google routes for the web are closing or restricted (below).
4. **Several sources can describe one night. Intus never adds them, averages them or blends them.** It picks one source by a visible rule and lists the others beside it, so every number can be checked in the app that produced it.

## Where the data comes from

| Source | Route | Status |
| --- | --- | --- |
| You, by hand | The Sleep section | Built |
| Apple Health | Export All Health Data (zip) read in the browser, nothing uploaded except the sleep rows you confirm | Next. A streaming scan of a synthetic 1 GB export took about 5 s and 120 MB in Node; real files in a browser are untested, and phones are riskier than laptops |
| Apple Watch live | HealthKit from a native iOS app | Needs the phone app. Libraries: `@kingstinct/react-native-healthkit` (active), `react-native-health` (last release 2024). Both need a development build. iOS 27 adds time-limited history authorisation |
| Android | Health Connect from a native Android app | Needs the phone app. `react-native-health-connect` (Expo plugin bundled). 30 days of history unless the history permission is granted |
| Fitbit and Pixel Watch | Fitbit Web API | Off on 2026-10-30. The replacement (Google Health API) covers only Fitbit and Pixel Watch data, shows "not onboarding new projects", and a public app would need restricted-scope verification plus a paid annual security assessment. Not worth building |
| Google Fit | REST and Android APIs | Closed to new sign-ups since 2024-05-01 and ending in 2026. Skip |
| Aggregators (Terra, Junction, Rook and similar) | Paid, and they need native SDKs anyway | Skip while the rule is free options only |

According to an Apple developer-relations reply, Apple Watch stopped writing in-bed samples in iOS 18, so efficiency (asleep over in bed) cannot be worked out for those nights; and an Apple engineer says the sleep score has no API (it would have to be our own number under another name, with its formula shown, and we are not building one).

## The rules the code follows

- **Store what each source said; work the numbers out when reading.** One row per session per source, with the source, its own id (so importing twice updates), start and end as instants plus the UTC offset at each end, optional stage segments, and the person's own estimates (minutes to fall asleep, minutes awake). Nothing derived is stored, so a rule can be changed later without re-importing.
- **A night is filed under the date you woke up.** The longest sleep that day is the main one; others are naps (up to 3 hours asleep) or second sleeps. Two sessions of one source less than 60 minutes apart are one sleep with a wake in the middle.
- **One source per night.** Priority: what you entered yourself, then wearables with stages, then other sources, then your saved order. A higher-priority automatic source that recorded under half of the best candidate loses the night (a watch that died at 02:00). Sources that differ by an hour or more are flagged.
- **A missing night is a gap, never zero.** Averages exclude it and say how many nights they use. Under 5 nights nothing is averaged. Spreads under 14 nights are marked rough.
- **Clock times are circular.** The mean and spread of bedtimes use the circular mean, because 23:30 and 00:30 average to noon in naive arithmetic.
- **Sanity limits.** Under 15 minutes is not sleep; over 20 hours is rejected; over 14 hours asks for a second look; the future and dates before 2000 are rejected; time to fall asleep plus time awake must fit inside the time in bed; an imported record that fails is shown in a list, never silently dropped.
- **Ranges by age are the National Sleep Foundation panel's, shown as a shaded band and never as a verdict.** Adults 26 to 64: 7 to 9 hours recommended, 6 and 10 "may be appropriate for some people". Longer is not ranked above shorter, and there is no "catch up on sleep" advice and no sleep-debt counter. If your age is not set, no band is drawn.

## What the page must say

From the accuracy report, adapted. Plain English, near the numbers they qualify:

- "Your watch or ring guesses your sleep from movement and heart rate. It is not a sleep lab. Use the numbers to see your own pattern over weeks, not to judge one night."
- Under any average: "Based on {n} of the last {m} nights. Nights with no data are left out, not counted as zero."
- Bed and wake time only: "Time asleep here is the time between getting into bed and getting up. Add how long it took you to fall asleep and how long you were awake to make it closer."
- Stages: "Stages are a rough guess. Devices get the stage right for roughly half to three quarters of the night, and often mix up light and deep sleep. Look at the two-week trend, not one night."
- What it cannot show: "This cannot tell you whether you have a sleep problem such as sleep apnea or insomnia. If you often feel unrested or very sleepy in the day, talk to a doctor, whatever the numbers say."
- Anxiety guard: "These numbers describe your sleep. They do not grade it. If checking them makes you worry about sleep, you can hide stages or show weekly numbers only."

## Built, and what comes next

Built in the first sleep pull request: the `sleep_sessions` table, manual entry (bed time, up time, optional minutes to fall asleep and awake), nights built with the rules above, a nightly-duration chart with the age band and gaps left as gaps, the usual times and how much they vary, and a list of nights with the rule for each number. The merging and stage code is written and tested for the imports that follow, but no stage data can arrive yet.

Next, in order:

1. Apple Health export import in the browser, with a preview before anything is saved.
2. Sleep duration as one more metric in the supplement before and after view, with the conditions the research sets: 14 logged nights minimum, whole weeks only, and "not comparable" when the source changed between the periods. It can only flag shifts of about 40 to 70 minutes, depending on how many nights are logged (melatonin trials find about 8), so it will say "no clear change" almost always and must say so.
3. Sleep Regularity Index (Phillips 2017) and social jetlag, with the parameter set printed beside the value.
4. The phone apps for live HealthKit and Health Connect sync, which also settles the Android route.

## Open questions the research could not settle

- How Apple Health reconciles overlapping sleep from several sources, and which UTC offset a record in `export.xml` carries (secondary sources disagree). Treat the local date of imported nights as an estimate and keep the original offset.
- A real, current `export.xml` sleep line and file layout. The examples in the platform report are assembled from verified pieces.
- Whether a new Google Cloud project can enable the Google Health API, and Health Connect's scheduled-export format.
- Independent lab validation for recent devices (Oura Ring 4, Whoop 5, Galaxy Watch 4 to 8, Apple Watch Series 9 to 11 on watchOS 26). Vendor figures are marked as vendor figures in the accuracy report.
- Safari on iPhone memory limits for the client-side Apple Health parse.
