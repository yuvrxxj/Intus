# Apple Health: which Intus fields can come from it

Written 20 Oct 2026. This is the map, not a build. Nothing here widens what the app asks Apple Health for; that is a
decision for the founder (see "What has to be decided").

## Where we are today

The app reads three Health types, read only, and never writes: sleep analysis, heart rate variability (SDNN) and resting
heart rate (`mobile/src/healthkit.ts`). They land in `sleep_sessions` and `cardio_metrics`, not in the daily log. So no
field on Today is fed from Apple Health yet.

## The map

"Connected" below means Health can supply the number. "Lock" means the field on Today becomes read-only, shows
"From Apple Health" and is filled by the sync, so a typed number can never disagree with the device.

| Intus field | Health type | Can connect | Lock when connected |
| --- | --- | --- | --- |
| Sleep (sleep tab, R4) | `SleepAnalysis` | already | yes, nights from Health are not edited |
| HRV, resting heart rate | `HeartRateVariabilitySDNN`, `RestingHeartRate` | already | yes |
| Steps (habit, amount) | `StepCount`, summed per local day | yes | yes: counted by the device, nobody types it |
| Active calories (`daily_logs.active_kcal`) | `ActiveEnergyBurned`, summed | yes | yes |
| Exercise minutes (a habit, amount) | `AppleExerciseTime`, summed | yes | yes |
| Water (`daily_logs.water_ml`) | `DietaryWater`, summed | yes | no: people log it by hand in Health too, so show it, keep it editable |
| Weight | `BodyMass`, latest of the day | yes | no: a scale writes it, but a person also types it; prefill and let them change it |
| Calories, protein, carbs, fat | `DietaryEnergyConsumed`, `DietaryProtein`, `DietaryCarbohydrates`, `DietaryFatTotal`, summed | yes, if another food app writes to Health | no: prefill only |
| Lift (yes or no) | `HKWorkout` of type traditional strength training | as a suggestion | no: suggest "Yes, a workout was recorded", the person answers |
| Mood | `HKStateOfMind` (iOS 17 and later) | possible, 1 to 5 would need a stated mapping from valence | no |
| Cycle | `MenstrualFlow` | possible, the web app has a cycle feature | decide with the cycle feature |
| Cigarettes, other counts | none | no | n/a |
| Supplements taken | none we can rely on (iOS 26 added medications to Health, read access is limited and unchecked) | no | n/a |
| Notes | none | no | n/a |
| Bloodwork | Health Records (`HKClinicalRecord`, lab results) needs a special entitlement and Apple approval | not for now | n/a |

Count: 3 are connected already (sleep, HRV, resting heart rate). 11 more can be connected (steps, active calories,
exercise minutes, water, weight, calories, protein, carbs, fat, lift as a suggestion, mood). 4 cannot (cigarettes and
other counts, supplements, notes, bloodwork for now).

Of those, the ones that should lock are the ones a device measures and a person would never type: steps, active
calories, exercise minutes, and the three already connected. The ones a person also enters by hand (weight, food, water)
should prefill and stay editable, otherwise someone who weighs in on a scale that does not talk to Health is stuck.

## One thing that changes the lock rule

iOS never tells an app whether a read permission was granted (so nobody can learn that a person has no heart data).
The app only knows that samples came back or did not. So "connected" cannot mean "the person said yes to steps". It has
to mean "a sync returned steps for today or in the last few days". A field locks only while that is true, and unlocks
the moment samples stop arriving (permission turned off, watch off the wrist for days), so nobody is locked out of
logging their own steps. `mobile/src/health/fields.ts` holds this rule as pure code with tests.

## What has to be decided (founder)

1. **Widen the permission sheet?** Today it asks for sleep, HRV and resting heart rate, and says "and nothing else"
   (`app.json` `NSHealthShareUsageDescription`, the in-app copy, and the privacy policy on intus.fit). Adding steps and
   the rest means changing all three, and App Store review reads them. Nothing has been widened.
2. **Which to start with.** Suggest steps and active calories first: one-way, measured, no editing, and the habit and
   column already exist.
3. **Lift suggestion and mood.** Both are optional and the mood mapping is a product call.

## How it would be built (not started)

- `mobile/src/health/fields.ts`: the table above as data, plus `lockedFields(lastSampleDayByField, today)`.
- Read the day's sum per type with `queryStatisticsForQuantity` (cumulative types) and write it into the draft, so Today
  and the outbox carry it like any other entry. Locked fields render as read-only rows with "From Apple Health".
- Add the new types to `READ_TYPES`, the permission string and the privacy policy in the same pull request.
