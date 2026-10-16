// The one place the app reaches into the web's plain TypeScript (src/ at the repo root). Importing every shared module
// here means the app's type check and Metro both cover them, so a shared file that starts needing the DOM, the web
// client or an npm package the app lacks fails the app's check, not just on someone's machine. The list is
// docs/ios/SHARED.md, and test/mobile.shared.test.ts loads the same files under Node.
export * as age from '../../src/lib/age.ts';
export * as dates from '../../src/lib/dates.ts';
export * as nutrition from '../../src/lib/nutrition.ts';
export * as numbers from '../../src/lib/numbers.ts';
export * as programme from '../../src/lib/programme.ts';
export * as ranges from '../../src/lib/ranges.ts';
export * as safety from '../../src/lib/safety.ts';
export * as sex from '../../src/lib/sex.ts';
export * as trends from '../../src/lib/trends.ts';

export * as todayDraft from '../../src/features/today/draft.ts';
export * as todayMood from '../../src/features/today/mood.ts';
export * as authCredentials from '../../src/features/auth/credentials.ts';
export * as utilDates from '../../src/util/dates.ts';
export * as habitsModel from '../../src/features/habits/model.ts';
export * as habitsStreaks from '../../src/features/habits/streaks.ts';
export * as supplementsCourse from '../../src/features/supplements/course.ts';
export * as supplementsModel from '../../src/features/supplements/model.ts';
export * as supplementsSchedule from '../../src/features/supplements/schedule.ts';
export * as bloodworkEntry from '../../src/features/bloodwork/entry.ts';
export * as bloodworkFormat from '../../src/features/bloodwork/format.ts';
export * as bloodworkMarkerInfo from '../../src/features/bloodwork/markerInfo.ts';
export * as bloodworkModel from '../../src/features/bloodwork/model.ts';
export * as sleepAgeBand from '../../src/features/sleep/ageBand.ts';
export * as sleepFormat from '../../src/features/sleep/format.ts';
export * as sleepMetrics from '../../src/features/sleep/metrics.ts';
export * as sleepModel from '../../src/features/sleep/model.ts';
export * as sleepNights from '../../src/features/sleep/nights.ts';
export * as sleepRows from '../../src/features/sleep/rows.ts';
export * as sleepSummary from '../../src/features/sleep/summary.ts';
export * as sleepTime from '../../src/features/sleep/time.ts';
export * as accountDeletion from '../../src/features/account/deletion.ts';
export * as profileDetails from '../../src/features/profile/details.ts';
export * as profileLine from '../../src/features/profile/profileLine.ts';
export * as onboardingModel from '../../src/features/onboarding/model.ts';
export * as goalsModel from '../../src/features/goals/model.ts';
