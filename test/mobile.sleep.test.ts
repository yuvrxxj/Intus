import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { test } from 'node:test';
import { session, NOW } from './sleep.helpers.ts';
import { MIN_NIGHTS } from '../src/features/sleep/summary.ts';
import type { SleepSession } from '../src/features/sleep/model.ts';
import {
  HEALTH_SHARE_PURPOSE,
  HEALTH_SHEET,
  averageFigures,
  blankSleepForm,
  deviceResolver,
  nightLine,
  presentSleep,
  shouldOfferHealthSheet,
  showManualEntry,
  todayKey,
  waitingCopy,
} from '../mobile/src/sleep/rules.ts';

const TODAY = '2026-10-12';

function nights(count: number): SleepSession[] {
  return Array.from({ length: count }, (_, index) => {
    const wake = 12 - (count - 1 - index);
    const wakeDay = String(wake).padStart(2, '0');
    const bedDay = String(wake - 1).padStart(2, '0');
    return session({ from: `2026-10-${bedDay} 23:00`, to: `2026-10-${wakeDay} 07:00` });
  });
}

test('averages stay hidden until five nights, then the shared summary is shown', () => {
  const few = presentSleep(nights(MIN_NIGHTS - 1), TODAY, NOW, null, true);
  assert.equal(few.showAverages, false);
  assert.equal(few.summary.medianAsleepMin, null);
  assert.equal(averageFigures(few.summary, null), null);
  assert.match(waitingCopy(few.summary), new RegExp(String(MIN_NIGHTS)));

  const enough = presentSleep(nights(MIN_NIGHTS), TODAY, NOW, 30, true);
  assert.equal(enough.showAverages, true);
  const figures = averageFigures(enough.summary, enough.band);
  assert.ok(figures);
  assert.match(figures.asleep, /^about /);
  assert.match(figures.footnote, /left out, not counted as zero/);
  assert.match(figures.footnote, /middle night/);
});

test('one source is used per night and the other is only listed', () => {
  const manual = session({ from: '2026-10-11 23:00', to: '2026-10-12 07:00', sourceKind: 'manual' });
  const watch = session({
    from: '2026-10-11 23:10',
    to: '2026-10-12 07:10',
    sourceKind: 'healthkit',
    sourceName: 'Apple Watch',
    externalId: 'night-1',
    startIsInBed: false,
  });
  const view = presentSleep([manual, watch], TODAY, NOW, null, true);
  assert.equal(view.nights.length, 1);
  assert.equal(view.nights[0].main.session.sourceKind, 'manual');
  assert.equal(view.nights[0].main.alternatives.length, 1);
  assert.equal(view.nights[0].main.metrics.tstMin, 8 * 60);
  const line = nightLine(view.nights[0], null);
  assert.equal(line.duration, '8 h');
  assert.equal(line.alternatives.length, 1);
  assert.match(line.alternatives[0], /Apple Watch/);
  assert.match(line.alternatives[0], /not used/);

  const deviceOnly = presentSleep([watch], TODAY, NOW, null, true);
  assert.match(nightLine(deviceOnly.nights[0], null).duration, /^about /);
});

test('manual entry is the fallback when Health is missing or empty', () => {
  const watch = session({ from: '2026-10-11 23:00', to: '2026-10-12 07:00', sourceKind: 'healthkit', sourceName: 'Apple Watch', externalId: 'a' });
  const typed = session({ from: '2026-10-11 23:00', to: '2026-10-12 07:00' });
  assert.equal(showManualEntry([], true), true);
  assert.equal(showManualEntry([typed], true), true);
  assert.equal(showManualEntry([watch], true), false);
  assert.equal(showManualEntry([watch], false), true);
  assert.equal(presentSleep([watch], TODAY, NOW, null, false).showManual, true);
});

test('the Health sheet is offered once, only where Health exists', () => {
  assert.equal(shouldOfferHealthSheet(true, false), true);
  assert.equal(shouldOfferHealthSheet(true, true), false);
  assert.equal(shouldOfferHealthSheet(false, false), false);
});

test('a blank night starts the evening before today, and the device clock resolves a real moment', () => {
  assert.deepEqual(blankSleepForm('2026-10-12'), {
    start: '2026-10-11T23:00',
    end: '2026-10-12T07:00',
    latency: '',
    awake: '',
    notes: '',
  });
  const resolved = deviceResolver('2026-10-09', '23:10');
  assert.ok(resolved);
  const when = new Date(2026, 9, 9, 23, 10);
  assert.equal(resolved.utcMs, when.getTime());
  assert.equal(resolved.offsetMin, -when.getTimezoneOffset());
  assert.equal(deviceResolver('2026-02-31', '00:00'), null);
  assert.equal(todayKey(new Date(2026, 9, 12, 15, 0)), '2026-10-12');
});

test('the Health purpose string is honest, shared with the plist, and background delivery stays off', () => {
  const app = JSON.parse(readFileSync('mobile/app.json', 'utf8')) as {
    expo: {
      ios: { infoPlist: { NSHealthShareUsageDescription: string } };
      plugins: (string | [string, { NSHealthShareUsageDescription?: string; NSHealthUpdateUsageDescription?: false; background?: boolean }])[];
    };
  };
  const plugin = app.expo.plugins.find((item) => Array.isArray(item) && item[0] === '@kingstinct/react-native-healthkit');
  if (!Array.isArray(plugin)) assert.fail('HealthKit plugin missing from app.json');
  assert.equal(plugin[1].NSHealthShareUsageDescription, HEALTH_SHARE_PURPOSE);
  assert.equal(app.expo.ios.infoPlist.NSHealthShareUsageDescription, HEALTH_SHARE_PURPOSE);
  assert.equal(plugin[1].NSHealthUpdateUsageDescription, false);
  assert.equal(plugin[1].background, false);
  const copy = [HEALTH_SHARE_PURPOSE, HEALTH_SHEET.title, HEALTH_SHEET.aside, HEALTH_SHEET.denial, ...HEALTH_SHEET.reads].join(' ');
  assert.match(copy, /sleep/i);
  assert.match(copy, /heart rate variability/i);
  assert.match(copy, /resting heart rate/i);
  assert.match(copy, /never writes/i);
  assert.doesNotMatch(copy, /diagnos|treat|cure|prescri|apnea|insomnia|clinical|disorder/i);

  const banned = /enableBackgroundDelivery|configureBackgroundTypes|background-delivery/;
  for (const file of sourceFiles('mobile/src')) {
    assert.doesNotMatch(readFileSync(file, 'utf8'), banned, file);
  }
});

function sourceFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return sourceFiles(path);
    return /\.(ts|tsx)$/.test(name) ? [path] : [];
  });
}
