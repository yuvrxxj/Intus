import { test } from 'node:test';
import assert from 'node:assert/strict';
import { isPhone, type DeviceHints } from '../src/features/mobile/device.ts';

const UA = {
  iphone: 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1',
  android: 'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0.0.0 Mobile Safari/537.36',
  androidTablet: 'Mozilla/5.0 (Linux; Android 14; SM-X710) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0.0.0 Safari/537.36',
  ipadChrome: 'Mozilla/5.0 (iPad; CPU OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/129.0 Mobile/15E148 Safari/604.1',
  mac: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Safari/605.1.15',
  windows: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0.0.0 Safari/537.36',
};
const desk = (over: Partial<DeviceHints>): DeviceHints => ({ userAgent: UA.mac, coarsePointer: false, shortSide: 900, ...over });

test('phones get the coming-soon screen', () => {
  assert.equal(isPhone(desk({ userAgent: UA.iphone, coarsePointer: true, shortSide: 390 })), true);
  assert.equal(isPhone(desk({ userAgent: UA.android, coarsePointer: true, shortSide: 412 })), true);
  assert.equal(isPhone(desk({ userAgent: UA.windows, uaMobile: true })), true);
});

test('a phone asking for the desktop site is still caught by its small touch screen', () => {
  assert.equal(isPhone(desk({ userAgent: UA.mac, coarsePointer: true, shortSide: 390 })), true);
});

test('desktops, laptops and tablets get the app', () => {
  assert.equal(isPhone(desk({})), false);
  assert.equal(isPhone(desk({ userAgent: UA.windows, uaMobile: false })), false);
  assert.equal(isPhone(desk({ userAgent: UA.ipadChrome, coarsePointer: true, shortSide: 820 })), false);
  assert.equal(isPhone(desk({ userAgent: UA.ipadChrome, uaMobile: true, coarsePointer: true, shortSide: 820 })), false);
  assert.equal(isPhone(desk({ userAgent: UA.androidTablet, coarsePointer: true, shortSide: 800 })), false);
  // a narrow desktop window is not a phone
  assert.equal(isPhone(desk({ shortSide: 0 })), false);
});
