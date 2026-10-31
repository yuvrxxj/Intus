import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { HRV_KIND, SLEEP_VALUE, cardioRows, sleepRows } from '../mobile/src/sync/mapping.ts';
import {
  FALLBACK_SOURCE_NAME,
  HC_SLEEP_STAGE,
  activityDays,
  hrvSamples,
  restingHrSamples,
  sleepSamples,
  sleepValueOf,
  sourceNameOf,
  type HcSleepSessionIn,
} from '../mobile/src/sync/healthConnectMapping.ts';
import { parseStages } from '../src/features/sleep/rows.ts';

// Invented records. A fixed offset (UTC+5:30, India) stands in for the phone's time zone so the tests do not depend on where they run.
const IST = () => 330;
const recordedAt = new Date('2026-10-30T03:00:00Z');
const FIT = 'com.google.android.apps.fitness';

const night: HcSleepSessionIn = {
  metadata: { id: 'sess-1', dataOrigin: FIT },
  startTime: '2026-10-29T17:00:00Z',
  endTime: '2026-10-30T01:00:00Z',
  stages: [
    { startTime: '2026-10-29T17:00:00Z', endTime: '2026-10-29T19:00:00Z', stage: HC_SLEEP_STAGE.light },
    { startTime: '2026-10-29T19:00:00Z', endTime: '2026-10-29T20:00:00Z', stage: HC_SLEEP_STAGE.deep },
    { startTime: '2026-10-29T20:00:00Z', endTime: '2026-10-29T20:10:00Z', stage: HC_SLEEP_STAGE.awake },
    { startTime: '2026-10-29T20:10:00Z', endTime: '2026-10-30T01:00:00Z', stage: HC_SLEEP_STAGE.rem },
  ],
};

test('every Health Connect stage maps to the sleep value mapping.ts reads, and an unknown one is dropped', () => {
  assert.equal(sleepValueOf(HC_SLEEP_STAGE.light), SLEEP_VALUE.asleepCore);
  assert.equal(sleepValueOf(HC_SLEEP_STAGE.deep), SLEEP_VALUE.asleepDeep);
  assert.equal(sleepValueOf(HC_SLEEP_STAGE.rem), SLEEP_VALUE.asleepREM);
  assert.equal(sleepValueOf(HC_SLEEP_STAGE.sleeping), SLEEP_VALUE.asleepUnspecified);
  assert.equal(sleepValueOf(HC_SLEEP_STAGE.unknown), SLEEP_VALUE.asleepUnspecified);
  for (const awake of [HC_SLEEP_STAGE.awake, HC_SLEEP_STAGE.outOfBed, HC_SLEEP_STAGE.awakeInBed]) assert.equal(sleepValueOf(awake), SLEEP_VALUE.awake);
  assert.equal(sleepValueOf(99), null);
});

test('a Health Connect night becomes one health_connect session, named for the app that wrote it, with its stages kept', () => {
  const { rows, skipped } = sleepRows(sleepSamples([night]), { offsetAt: IST, tzId: 'Asia/Kolkata', recordedAt, sourceKind: 'health_connect' });
  assert.equal(skipped, 0);
  assert.equal(rows.length, 1);
  const [row] = rows;
  assert.equal(row.source_kind, 'health_connect');
  assert.equal(row.source_name, 'Google Fit');
  assert.equal(row.external_id, 'sess-1#0');
  assert.equal(row.start_at, '2026-10-29T17:00:00.000Z');
  assert.equal(row.end_at, '2026-10-30T01:00:00.000Z');
  assert.equal(row.start_offset_min, 330);
  assert.equal(row.start_is_in_bed, false, 'Health Connect has no in-bed sample, so the start is never an in-bed time');
  assert.deepEqual(row.stages.map((s) => s.t), ['light', 'deep', 'awake', 'rem']);
  assert.equal(parseStages(row.stages).length, 4, 'the web app reads the stages back without dropping any');
});

test('syncing the same night twice lands on the same external id, even when a stage is added later', () => {
  const again = sleepSamples([{ ...night, stages: [...(night.stages ?? []), { startTime: '2026-10-30T01:00:00Z', endTime: '2026-10-30T01:20:00Z', stage: HC_SLEEP_STAGE.light }] }]);
  const first = sleepRows(sleepSamples([night]), { offsetAt: IST, recordedAt, sourceKind: 'health_connect' }).rows[0];
  const second = sleepRows(again, { offsetAt: IST, recordedAt, sourceKind: 'health_connect' }).rows[0];
  assert.equal(second.external_id, first.external_id);
});

test('a session with no stages is one unspecified sleep, a session with a bad date is skipped, and the origin falls back to its package name', () => {
  const plain: HcSleepSessionIn = { metadata: { id: 'plain', dataOrigin: 'com.example.sleeper' }, startTime: '2026-10-29T18:00:00Z', endTime: '2026-10-30T00:00:00Z' };
  const bad: HcSleepSessionIn = { metadata: { id: 'bad' }, startTime: 'nonsense', endTime: '2026-10-30T00:00:00Z' };
  const samples = sleepSamples([plain, bad]);
  assert.equal(samples.length, 1);
  assert.equal(samples[0].value, SLEEP_VALUE.asleepUnspecified);
  const { rows } = sleepRows(samples, { offsetAt: IST, recordedAt, sourceKind: 'health_connect' });
  assert.equal(rows[0].source_name, 'com.example.sleeper');
  assert.deepEqual(rows[0].stages.map((s) => s.t), ['asleep']);
});

test('without a record id the session id is made from its origin and start, so it is still the same next time', () => {
  const noId: HcSleepSessionIn = { metadata: { dataOrigin: FIT }, startTime: '2026-10-29T18:00:00Z', endTime: '2026-10-30T00:00:00Z' };
  assert.equal(sleepSamples([noId])[0].uuid, sleepSamples([noId])[0].uuid);
  assert.match(sleepSamples([noId])[0].uuid, /^com\.google\.android\.apps\.fitness:2026-10-29T18:00:00Z#0$/);
});

test('source names: known apps are named, an unknown app keeps its package, and a missing one is Health Connect', () => {
  assert.equal(sourceNameOf('com.sec.android.app.shealth'), 'Samsung Health');
  assert.equal(sourceNameOf(' com.fitbit.FitbitMobile '), 'Fitbit');
  assert.equal(sourceNameOf('com.example.thing'), 'com.example.thing');
  assert.equal(sourceNameOf(undefined), FALLBACK_SOURCE_NAME);
  assert.equal(sourceNameOf('  '), FALLBACK_SOURCE_NAME);
});

test('HRV from Health Connect is RMSSD in its own health_connect rows, and never shares a row with HealthKit\'s SDNN', () => {
  const hrv = hrvSamples([
    { time: '2026-10-29T05:00:00Z', heartRateVariabilityMillis: 40 },
    { time: '2026-10-29T07:00:00Z', heartRateVariabilityMillis: 50 },
    { time: 'nonsense', heartRateVariabilityMillis: 60 },
    { time: '2026-10-29T08:00:00Z', heartRateVariabilityMillis: 9000 }, // a sensor glitch
  ]);
  const resting = restingHrSamples([
    { time: '2026-10-29T03:00:00Z', beatsPerMinute: 58.4 },
    { time: '2026-10-29T09:00:00Z', beatsPerMinute: 60.2 }, // the day's last reading wins
  ]);
  const rows = cardioRows(hrv, resting, IST, 'health_connect');
  assert.deepEqual(rows, [{ measured_at: '2026-10-29', hrv_ms: 45, resting_hr: 60, source: 'health_connect' }]);
  assert.equal(HRV_KIND.health_connect, 'RMSSD');
  assert.equal(HRV_KIND.healthkit, 'SDNN');
  // the iPhone default is unchanged
  assert.equal(cardioRows(hrv, resting, IST)[0].source, 'healthkit');
});

test('daily activity: whole numbers per local day, bad totals dropped, either total alone is enough', () => {
  const rows = activityDays(
    [
      { startTime: '2026-10-29T18:30:00Z', value: 8123.6 }, // 30 Oct 00:00 in India
      { startTime: '2026-10-28T18:30:00Z', value: 4000 }, // 29 Oct
      { startTime: '2026-10-30T18:30:00Z', value: -5 },
    ],
    [
      { startTime: '2026-10-29T18:30:00Z', value: 410.4 },
      { startTime: '2026-10-31T18:30:00Z', value: 120 }, // 1 Nov, calories only
      { startTime: '2026-10-30T18:30:00Z', value: Number.NaN },
    ],
    IST,
  );
  assert.deepEqual(rows, [
    { measured_at: '2026-10-29', steps: 4000, active_kcal: null, source: 'health_connect' },
    { measured_at: '2026-10-30', steps: 8124, active_kcal: 410, source: 'health_connect' },
    { measured_at: '2026-11-01', steps: null, active_kcal: 120, source: 'health_connect' },
  ]);
});

const read = (path: string) => readFileSync(new URL(`../mobile/${path}`, import.meta.url), 'utf8');

test('the config plugin asks for read permissions only, and for the history permission the 90-day first sync needs', () => {
  const names = [...read('plugins/withHealthConnectPermissions.js').matchAll(/'(android\.permission\.health\.[A-Z_]+)'/g)].map((m) => m[1]);
  assert.deepEqual(names.sort(), [
    'android.permission.health.READ_ACTIVE_CALORIES_BURNED',
    'android.permission.health.READ_HEALTH_DATA_HISTORY',
    'android.permission.health.READ_HEART_RATE_VARIABILITY',
    'android.permission.health.READ_RESTING_HEART_RATE',
    'android.permission.health.READ_SLEEP',
    'android.permission.health.READ_STEPS',
  ]);
  assert.ok(names.every((n) => n.includes('.READ_')), 'Intus never writes to Health Connect');
});

test('Android is configured: SDK levels for Health Connect, both plugins, and an APK for testing and a bundle for the store', () => {
  const app = JSON.parse(read('app.json')).expo;
  assert.ok(app.plugins.includes('react-native-health-connect'));
  assert.ok(app.plugins.includes('./plugins/withHealthConnectPermissions'));
  const build = app.plugins.find((p: unknown) => Array.isArray(p) && p[0] === 'expo-build-properties')[1];
  assert.deepEqual(build.android, { compileSdkVersion: 36, targetSdkVersion: 36, minSdkVersion: 26 });
  assert.equal(build.ios.deploymentTarget, '16.4', 'iOS is unchanged');
  const eas = JSON.parse(read('eas.json'));
  assert.equal(eas.build.preview.android.buildType, 'apk');
  assert.equal(eas.build.production.android.buildType, 'app-bundle');
});

test('each platform bundles only its own health library, and the sync reads through the provider', () => {
  const ios = read('src/health/provider.ts');
  const android = read('src/health/provider.android.ts');
  assert.match(ios, /from '\.\.\/healthkit'/);
  assert.doesNotMatch(ios, /healthconnect/i);
  assert.match(android, /from '\.\.\/healthconnect'/);
  assert.doesNotMatch(android, /healthkit/i);
  const run = read('src/sync/run.ts');
  assert.match(run, /from '\.\.\/health\/provider'/);
  assert.doesNotMatch(run, /from '\.\.\/healthkit'|from '\.\.\/healthconnect'/);
  assert.doesNotMatch(read('src/sleep/SleepScreen.tsx'), /from '\.\.\/healthkit'|from '\.\.\/healthconnect'/);
});
