import { test } from 'node:test';
import assert from 'node:assert/strict';
import { zipSync, strToU8 } from 'fflate';
import { ExportScanner, parseExportDate, toRows } from '../src/features/import/appleHealth.ts';
import { scanExportFile } from '../src/features/import/readExport.ts';

// An invented export in Apple's shape: one Record per line, dates with their own offset.
const rec = (type: string, start: string, end: string, value: string, source = 'Apple Watch') =>
  ` <Record type="${type}" sourceName="${source}" sourceVersion="11.0" unit="ms" creationDate="${end}" startDate="${start}" endDate="${end}" value="${value}"/>`;
const SLEEP = 'HKCategoryTypeIdentifierSleepAnalysis';
const XML = [
  '<?xml version="1.0" encoding="UTF-8"?>',
  '<HealthData locale="en_IN">',
  rec(SLEEP, '2026-10-05 23:00:00 +0530', '2026-10-06 01:00:00 +0530', 'HKCategoryValueSleepAnalysisAsleepCore'),
  rec(SLEEP, '2026-10-06 01:00:00 +0530', '2026-10-06 02:00:00 +0530', 'HKCategoryValueSleepAnalysisAsleepDeep'),
  rec(SLEEP, '2026-10-06 02:00:00 +0530', '2026-10-06 06:30:00 +0530', 'HKCategoryValueSleepAnalysisAsleepREM'),
  rec('HKQuantityTypeIdentifierHeartRateVariabilitySDNN', '2026-10-06 07:00:00 +0530', '2026-10-06 07:01:00 +0530', '42'),
  rec('HKQuantityTypeIdentifierHeartRateVariabilitySDNN', '2026-10-06 22:00:00 +0530', '2026-10-06 22:01:00 +0530', '50'),
  rec('HKQuantityTypeIdentifierRestingHeartRate', '2026-10-06 00:00:00 +0530', '2026-10-06 23:59:00 +0530', '57', 'Health &amp; Co'),
  rec('HKQuantityTypeIdentifierStepCount', '2026-10-06 08:00:00 +0530', '2026-10-06 08:10:00 +0530', '900'),
  rec(SLEEP, '2024-01-01 23:00:00 +0000', '2024-01-02 07:00:00 +0000', 'HKCategoryValueSleepAnalysisAsleepCore'), // too old
  '</HealthData>',
].join('\n');
const SINCE = new Date('2026-01-01T00:00:00Z');

test('export dates keep their own offset', () => {
  assert.deepEqual(parseExportDate('2026-10-05 23:00:00 +0530'), { at: new Date('2026-10-05T17:30:00Z'), offsetMin: 330 });
  assert.equal(parseExportDate('2026-10-05T23:00:00Z'), null);
});

test('the scanner keeps the three record types from the cutoff, whatever the chunk boundaries', () => {
  for (const size of [7, 64, 100000]) {
    const s = new ExportScanner(SINCE);
    for (let i = 0; i < XML.length; i += size) s.feed(XML.slice(i, i + size));
    const r = s.end();
    assert.deepEqual([r.sleep.length, r.hrv.length, r.resting.length, r.seen], [3, 2, 1, 7], `chunk ${size}`);
    assert.equal(r.resting[0].sourceName, 'Health & Co');
  }
});

test('rows: one night from the export source, one day of heart readings in the local day of the export', () => {
  const s = new ExportScanner(SINCE);
  s.feed(XML);
  const rows = toRows(s.end(), new Date('2026-10-12T00:00:00Z'), 'Asia/Kolkata');
  assert.equal(rows.sleep.length, 1);
  assert.equal(rows.sleep[0].source_kind, 'apple_health_export');
  assert.equal(rows.sleep[0].start_offset_min, 330);
  assert.deepEqual(rows.sleep[0].stages.map((x) => x.t), ['light', 'deep', 'rem']);
  // importing the same file again gives the same ids, so the upsert adds nothing twice
  const again = new ExportScanner(SINCE);
  again.feed(XML);
  assert.equal(toRows(again.end(), new Date(), null).sleep[0].external_id, rows.sleep[0].external_id);
  assert.deepEqual(rows.cardio, [{ measured_at: '2026-10-06', hrv_ms: 46, resting_hr: 57, source: 'healthkit' }]);
});

test('the zip is streamed and only export.xml inside it is read', async () => {
  const zip = zipSync({ 'apple_health_export/export.xml': strToU8(XML), 'apple_health_export/export_cda.xml': strToU8('<x/>') });
  const file = new File([zip], 'export.zip', { type: 'application/zip' });
  const r = await scanExportFile(file, SINCE, () => {});
  assert.deepEqual([r.sleep.length, r.hrv.length, r.resting.length], [3, 2, 1]);
  await assert.rejects(() => scanExportFile(new File([zipSync({ 'other.txt': strToU8('x') })], 'x.zip'), SINCE, () => {}), /No export\.xml/);
  const xml = await scanExportFile(new File([XML], 'export.xml'), SINCE, () => {});
  assert.equal(xml.sleep.length, 3);
});
