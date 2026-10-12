import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { PERSONAL_TABLES, buildExport, exportFileName } from '../src/features/export/model.ts';

const empty = Object.fromEntries(PERSONAL_TABLES.map((t) => [t, []])) as unknown as Parameters<typeof buildExport>[0]['tables'];

test('every personal table in the database README is exported', () => {
  const readme = readFileSync(new URL('../supabase/README.md', import.meta.url), 'utf8');
  const personal = readme.split('\n').find((l) => l.startsWith('| Personal |')) ?? '';
  const named = [...(personal.split('|')[2] ?? '').matchAll(/`([a-z_]+)`/g)].map((m) => m[1]);
  assert.ok(named.length > 10);
  for (const table of named) assert.ok((PERSONAL_TABLES as readonly string[]).includes(table), `${table} is personal but not exported`);
});

test('rows are kept as stored, without the owner id, and blood results say which marker they are', () => {
  const at = new Date('2026-10-12T06:00:00Z');
  const out = buildExport({
    email: 'a@example.test',
    exportedAt: at,
    tables: { ...empty, biomarker_readings: [{ id: 'r1', user_id: 'u', biomarker_id: 'b1', value: 13.2, ref_low: 12, measured_at: '2026-10-06' }], habits: [{ id: 'h', user_id: 'u', name: 'Walk' }] },
    biomarkers: [{ id: 'b1', code: 'hemoglobin', name: 'Hemoglobin', unit: 'g/dL' }],
    files: { photos: ['p.webp'], reports: [] },
  }) as { tables: Record<string, Record<string, unknown>[]>; counts: Record<string, number>; exported_at: string; files: unknown };
  assert.deepEqual(out.tables.biomarker_readings, [{ id: 'r1', biomarker_id: 'b1', value: 13.2, ref_low: 12, measured_at: '2026-10-06', marker: { code: 'hemoglobin', name: 'Hemoglobin', unit: 'g/dL' } }]);
  assert.deepEqual(out.tables.habits, [{ id: 'h', name: 'Walk' }]);
  assert.equal(out.counts.biomarker_readings, 1);
  assert.equal(out.counts.sleep_sessions, 0);
  assert.equal(out.exported_at, '2026-10-12T06:00:00.000Z');
  assert.deepEqual(out.files, { photos: ['p.webp'], reports: [] });
  assert.equal(JSON.stringify(out).includes('"user_id"'), false);
  assert.equal(exportFileName(at), 'intus-data-2026-10-12.json');
});
