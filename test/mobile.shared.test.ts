import { test } from 'node:test';
import assert from 'node:assert/strict';

// The iPhone app (mobile/) imports these files from src/. They have to stay plain TypeScript: no window, document,
// localStorage or import.meta, and no import of the web Supabase client. Importing each one under Node here means a
// change that makes one of them non-shareable fails loudly. The list is docs/ios/SHARED.md.
const SHARED = [
  '../src/lib/numbers.ts',
  '../src/lib/dates.ts',
  '../src/lib/sex.ts',
  '../src/lib/ranges.ts',
  '../src/lib/safety.ts',
  '../src/lib/age.ts',
  '../src/lib/nutrition.ts',
  '../src/lib/trends.ts',
  '../src/lib/programme.ts',
  '../src/features/today/draft.ts',
  '../src/features/today/mood.ts',
  '../src/features/auth/credentials.ts',
  '../src/util/dates.ts',
  '../src/features/habits/model.ts',
  '../src/features/habits/streaks.ts',
  '../src/features/supplements/course.ts',
  '../src/features/supplements/schedule.ts',
  '../src/features/supplements/model.ts',
  '../src/features/bloodwork/model.ts',
  '../src/features/bloodwork/entry.ts',
  '../src/features/bloodwork/format.ts',
  '../src/features/bloodwork/markerInfo.ts',
  '../src/features/sleep/time.ts',
  '../src/features/sleep/ageBand.ts',
  '../src/features/sleep/model.ts',
  '../src/features/sleep/nights.ts',
  '../src/features/sleep/metrics.ts',
  '../src/features/sleep/summary.ts',
  '../src/features/sleep/format.ts',
  '../src/features/sleep/rows.ts',
  '../src/features/account/deletion.ts',
  '../src/features/profile/details.ts',
  '../src/features/profile/profileLine.ts',
  '../src/features/onboarding/model.ts',
  '../src/features/goals/model.ts',
];

// Files that must stay out of the shared set. A type-only import from the table files would pull the client into the
// app's type check, so the shared rules reach the row types through src/db/rows.ts.
const FORBIDDEN = /from\s+['"][^'"]*\/db\/(?!rows\.ts|types\.ts)[^'"]+['"]|import\.meta|\bwindow\b\.|\bdocument\b\.|localStorage/;

for (const path of SHARED) {
  test(`${path.replace('../src/', '')} loads under Node`, async () => {
    const mod = await import(path);
    assert.ok(Object.keys(mod).length >= 0);
  });

  test(`${path.replace('../src/', '')} imports no web client, browser global or import.meta`, async () => {
    const { readFile } = await import('node:fs/promises');
    const source = await readFile(new URL(path, import.meta.url), 'utf8');
    const code = source
      .split('\n')
      .filter((line) => !/^\s*(\/\/|\/\*|\*)/.test(line))
      .join('\n');
    assert.doesNotMatch(code, FORBIDDEN);
  });
}
