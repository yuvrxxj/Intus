import { test } from 'node:test';
import assert from 'node:assert/strict';
import { PERSONAL_TABLES } from '../src/features/export/model.ts';
import { KIND_DEFS, MARKER_KINDS, PERIODIC_GAP_DAYS, TABLE_KIND, kindOfRow, kindOfSource, tablesOfKind } from '../src/features/markers/kinds.ts';

test('every personal table is placed, so a new table cannot be added without choosing its kind', () => {
  assert.deepEqual(Object.keys(TABLE_KIND).sort(), [...PERSONAL_TABLES].sort());
});

test('there are three kinds, each described', () => {
  assert.deepEqual([...MARKER_KINDS], ['active', 'daily', 'periodic']);
  for (const k of MARKER_KINDS) assert.equal(KIND_DEFS[k].id, k);
});

test('a row from a health platform is active, one typed by hand is daily', () => {
  assert.equal(kindOfSource('healthkit'), 'active');
  assert.equal(kindOfSource('health_connect'), 'active');
  assert.equal(kindOfSource('apple_health_export'), 'active');
  assert.equal(kindOfSource('manual'), 'daily');
  assert.equal(kindOfSource('other'), 'daily');
});

test('sleep, heart and cycle rows take their kind from their source; blood and screening are periodic', () => {
  assert.equal(kindOfRow('sleep_sessions', 'healthkit'), 'active');
  assert.equal(kindOfRow('sleep_sessions', 'manual'), 'daily');
  assert.equal(kindOfRow('cardio_metrics', 'health_connect'), 'active');
  assert.equal(kindOfRow('cycle_days'), 'daily');
  assert.equal(kindOfRow('biomarker_readings'), 'periodic');
  assert.equal(kindOfRow('screening_history'), 'periodic');
  assert.equal(kindOfRow('daily_logs'), 'daily');
  assert.equal(kindOfRow('habits'), null);
});

test('blood tests are repeated every 2 to 3 months, never daily or weekly', () => {
  assert.deepEqual(PERIODIC_GAP_DAYS.biomarker_readings, { min: 60, max: 90 });
  assert.ok(tablesOfKind('periodic').includes('biomarker_readings'));
  assert.ok(!tablesOfKind('daily').includes('biomarker_readings'));
  assert.ok(!tablesOfKind('active').includes('biomarker_readings'));
});
